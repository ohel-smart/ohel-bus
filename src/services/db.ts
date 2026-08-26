import {
  collection, doc, onSnapshot, setDoc, deleteDoc, getDocs,
} from 'firebase/firestore';
import { db as firestore, authReady } from './firebase';
import { Location, Zmanim, isAssurBemlacha } from '@hebcal/core';

// Types Definitions
export type UserRole = 'admin' | 'driver' | 'dispatcher' | 'screen';
export type DriverStatus = 'idle' | 'en_route' | 'break';
export type Direction = 'to_770' | 'to_ohel' | null;
export type DepartureLocation = '770' | 'Ohel';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  capacity?: number; // Only for drivers
  isBigBus?: boolean; // Only for drivers - explicit tag, not derived from capacity
  canSelfReport?: boolean; // Only for drivers - admin approval to use the self-report link (default: not approved)
  code: string;
  createdAt: string;
}

export interface Scan {
  id: string;
  dispatcherId: string;
  dispatcherName: string;
  driverId: string;
  driverName: string;
  passengersCount: number;
  driverCapacity: number;
  isBigBus: boolean; // captured from the driver's profile at scan time
  remainingSeats: number;
  scannedAt: string;
  logicalDate: string; // YYYY-MM-DD based on 01:00 AM rule
  location: { latitude: number; longitude: number };
  departureLocation: DepartureLocation;
  etaMinutes?: number;
  expectedArrivalTime?: string;
  actualArrivalTime?: string;
}

export interface ActiveLocation {
  id: string; // User ID
  name: string;
  role: 'driver' | 'dispatcher';
  latitude: number;
  longitude: number;
  status?: DriverStatus;
  direction?: Direction;
  etaMinutes?: number;
  updatedAt: string;
  speedWarning?: boolean;
  lastEtaUpdateTime?: string;
  etaHistory?: number[];
  scannedAt?: string;
  expectedArrivalTime?: string;
}

export interface GlobalConfig {
  reportEmail: string;
  googleSheetsUrl?: string;
  googleMapsApiKey?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioRecipientSms?: string;
}

// A driver/dispatcher self-registration request, awaiting admin approval
// before it becomes a real User with a login code.
export interface PendingRegistration {
  id: string;
  name: string;
  phone: string;
  role: 'driver' | 'dispatcher';
  code: string; // Self-chosen at registration; admin can still change it on approval
  capacity?: number; // Only for drivers
  isBigBus?: boolean; // Only for drivers
  submittedAt: string;
}

// Coordinates (Precise physical locations for GPS verification and Map routing)
export const LOCATIONS = {
  '770': { latitude: 40.6690, longitude: -73.9429, name: '770 Eastern Parkway' },
  'Ohel': { latitude: 40.686559, longitude: -73.737622, name: 'Ohel Chabad Lubavitch' }
};

// Crown Heights coordinates, reused for the Erev Shabbat/Yom Tov logical-day cutover
// below - close enough to Ohel/Boro Park that the few minutes of difference in
// sunset never matter for this purpose.
const NY_LOCATION = new Location(40.6690, -73.9429, false, 'America/New_York', 'Crown Heights', 'US');

// Per-NY-calendar-day cache of the Erev Shabbat/Yom Tov early cutover moment (or null
// on a regular day).
const earlyCutoverCache = new Map<string, Date | null>();

// On Erev Shabbat / Erev Yom Tov the organization's "day" ends 15 minutes before
// sunset (America/New_York), not at midnight - a scan after that moment already
// belongs to the next logical day. Returns the cutover Date for `ymd` (YYYY-MM-DD,
// NY calendar date), or null if `ymd` is a regular day (plain midnight cutover applies).
function getEarlyCutover(ymd: string): Date | null {
  const cached = earlyCutoverCache.get(ymd);
  if (cached !== undefined) return cached;

  let result: Date | null = null;
  try {
    const [y, m, d] = ymd.split('-').map(Number);
    // Local-constructed on purpose: Zmanim only reads the Y/M/D fields off this Date
    // (hours are ignored), and building it via the local constructor makes those
    // fields round-trip correctly regardless of the runtime's own timezone.
    const dayRef = new Date(y, m - 1, d);
    const sunset = new Zmanim(NY_LOCATION, dayRef, false).sunset();
    const justBeforeSunset = new Date(sunset.getTime() - 60000);
    const justAfterSunset = new Date(sunset.getTime() + 60000);
    // Erev Shabbat / Erev Yom Tov = melacha becomes newly prohibited at tonight's
    // sunset. If it was already prohibited beforehand (e.g. this is Shabbat or a
    // Yom Tov day itself, still running into the evening, or day 1 of a 2-day
    // diaspora Yom Tov flowing straight into day 2), that's not "erev" of anything.
    if (!isAssurBemlacha(justBeforeSunset, NY_LOCATION, false) && isAssurBemlacha(justAfterSunset, NY_LOCATION, false)) {
      result = new Date(sunset.getTime() - 15 * 60000);
    }
  } catch { /* fall back to a plain midnight cutover on any calculation error */ }

  earlyCutoverCache.set(ymd, result);
  return result;
}

// Adds `days` calendar days to a YYYY-MM-DD string, letting the local Date
// constructor normalize month/year rollovers.
function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Public client-side Google Maps key (Routes API), used for the live traffic-aware ETA.
// A client Maps key is ALWAYS visible in the shipped JS bundle, so exposure here is
// unavoidable and expected. This key is locked down in Google Cloud to the site's
// HTTP referrers (ohel-bus.vercel.app + localhost) and capped by a daily Routes API
// quota, so a copied key is worthless off-domain / bounded in cost. Prefer the build
// env var when present; this constant guarantees every device has a working key.
const DEFAULT_GOOGLE_MAPS_API_KEY = "AIzaSyAw9YueiwU3xsjjpOPy4PsHq3uS0X5IW54";

// Default Pre-Populated Users (Used as offline/local fallback before Firestore connects)
const DEFAULT_USERS: User[] = [
  { id: 'usr_admin', name: 'הרב רוזנברג', phone: '050-770-7700', role: 'admin', code: '770', createdAt: new Date().toISOString() },
  { id: 'drv_777', name: 'נהג 777 (נהג)', phone: '050-777-7777', role: 'driver', code: '777', createdAt: new Date().toISOString() },
  { id: 'drv_778', name: 'נהג 778 (נהג)', phone: '050-778-7788', role: 'driver', code: '778', createdAt: new Date().toISOString() },
  { id: 'disp_1000', name: 'סדרן 1000 (סדרן)', phone: '050-100-1000', role: 'dispatcher', code: '1000', createdAt: new Date().toISOString() }
];

const SETTINGS_DOC = 'global_config';

class DBService {
  private listeners: Set<() => void> = new Set();

  // Local cache, kept in sync live by Firestore onSnapshot listeners.
  private usersCache: User[] = [];
  private scansCache: Scan[] = [];
  private configCache: GlobalConfig = { reportEmail: 'manager@transit.pro' };
  private pendingRegistrationsCache: PendingRegistration[] = [];

  constructor() {
    // Seed from localStorage instantly so the UI has something to render
    // before Firestore's first snapshot arrives (avoids a blank-screen flash).
    this.initLocalCache();
    this.initFirestoreListeners();
  }

  private initLocalCache() {
    try {
      const rawUsersList = JSON.parse(localStorage.getItem('tp_users') || '[]');
      const rawScansList = JSON.parse(localStorage.getItem('tp_scans') || '[]');
      const rawConfig = JSON.parse(localStorage.getItem('tp_config') || '{}');
      this.usersCache = rawUsersList.length > 0 ? rawUsersList : DEFAULT_USERS;
      this.scansCache = rawScansList.map((s: Scan) => ({ ...s, logicalDate: this.cleanDate(s.logicalDate) }));
      this.configCache = { reportEmail: 'manager@transit.pro', ...rawConfig };
    } catch (e) {
      this.usersCache = DEFAULT_USERS;
    }
  }

  private async initFirestoreListeners() {
    await authReady;

    onSnapshot(collection(firestore, 'users'), (snap) => {
      this.usersCache = snap.docs.map(d => d.data() as User);
      localStorage.setItem('tp_users', JSON.stringify(this.usersCache));
      this.notify();
    }, (e) => console.error('Firestore users listener error:', e));

    onSnapshot(collection(firestore, 'scans'), (snap) => {
      this.scansCache = snap.docs.map(d => ({ ...(d.data() as Scan), logicalDate: this.cleanDate((d.data() as Scan).logicalDate) }));
      localStorage.setItem('tp_scans', JSON.stringify(this.scansCache));
      this.notify();
    }, (e) => console.error('Firestore scans listener error:', e));

    onSnapshot(doc(firestore, 'settings', SETTINGS_DOC), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GlobalConfig;
        this.configCache = { ...data, reportEmail: data.reportEmail || 'manager@transit.pro' };
        localStorage.setItem('tp_config', JSON.stringify(this.configCache));
        this.notify();
      }
    }, (e) => console.error('Firestore settings listener error:', e));

    onSnapshot(collection(firestore, 'pending_registrations'), (snap) => {
      this.pendingRegistrationsCache = snap.docs.map(d => d.data() as PendingRegistration);
      this.notify();
    }, (e) => console.error('Firestore pending_registrations listener error:', e));
  }

  private cleanDate(dateStr: string): string {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (trimmed.includes('GMT') || trimmed.length > 15) {
      try {
        const d = new Date(trimmed);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch (e) {}
    }
    return trimmed;
  }

  // Kept for backwards compatibility — ReturnReport.tsx calls this once on mount to
  // force a fresh read before code lookup. Firestore's onSnapshot listeners already
  // keep the cache live, but on a very cold page load there can be a brief gap before
  // the first snapshot arrives, so this does one direct one-shot fetch to close it.
  public async fetchDataFromSheets() {
    await authReady;
    try {
      const [usersSnap, scansSnap] = await Promise.all([
        getDocs(collection(firestore, 'users')),
        getDocs(collection(firestore, 'scans')),
      ]);
      this.usersCache = usersSnap.docs.map(d => d.data() as User);
      this.scansCache = scansSnap.docs.map(d => ({ ...(d.data() as Scan), logicalDate: this.cleanDate((d.data() as Scan).logicalDate) }));
      localStorage.setItem('tp_users', JSON.stringify(this.usersCache));
      localStorage.setItem('tp_scans', JSON.stringify(this.scansCache));
      this.notify();
    } catch (e) {
      console.error('Failed to fetch data from Firestore:', e);
    }
  }

  // --- Pub/Sub ---
  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  public loginWithCode(code: string): User | null {
    return this.usersCache.find(u => u.code === code) || null;
  }

  // --- Users CRUD ---
  public getUsers(): User[] {
    return this.usersCache;
  }

  public async saveUser(user: User) {
    // 1. Update cache immediately (zero-lag UI)
    const index = this.usersCache.findIndex(u => u.id === user.id);
    if (index >= 0) this.usersCache[index] = user; else this.usersCache.push(user);
    localStorage.setItem('tp_users', JSON.stringify(this.usersCache));
    this.notify();

    // 2. Persist to Firestore
    await authReady;
    await setDoc(doc(firestore, 'users', user.id), user);
  }

  public async deleteUser(userId: string) {
    this.usersCache = this.usersCache.filter(u => u.id !== userId);
    localStorage.setItem('tp_users', JSON.stringify(this.usersCache));
    this.notify();

    await authReady;
    await deleteDoc(doc(firestore, 'users', userId));
  }

  // --- Self-registration requests (pending admin approval) ---
  public getPendingRegistrations(): PendingRegistration[] {
    return this.pendingRegistrationsCache;
  }

  // Called from the public, unauthenticated self-registration page - does NOT
  // create a real User (no login code yet). An admin reviews it and creates
  // the actual user via the normal Add User form; see App.tsx's
  // "Pending Registrations" section.
  public async submitRegistration(reg: Omit<PendingRegistration, 'id' | 'submittedAt'>) {
    await authReady;
    const newReg: PendingRegistration = {
      ...reg,
      id: 'reg_' + Math.random().toString(36).substr(2, 9),
      submittedAt: new Date().toISOString()
    };
    await setDoc(doc(firestore, 'pending_registrations', newReg.id), newReg);
    return newReg;
  }

  // Removes a pending request - used both to reject one and to clear it out
  // once an admin has approved it and created the real User.
  public async deletePendingRegistration(id: string) {
    this.pendingRegistrationsCache = this.pendingRegistrationsCache.filter(r => r.id !== id);
    this.notify();

    await authReady;
    await deleteDoc(doc(firestore, 'pending_registrations', id));
  }

  // --- Scans CRUD ---
  public getScans(): Scan[] {
    return this.scansCache;
  }

  public getLogicalDate(dateStr: string = new Date().toISOString()): string {
    const date = new Date(dateStr);

    // Format to YYYY-MM-DD in New York timezone (transitions at midnight NY time,
    // except on Erev Shabbat/Erev Yom Tov - see the early-cutover check below).
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const ymd = `${year}-${month}-${day}`;

    // On Erev Shabbat / Erev Yom Tov, this day's "logical date" already ends 15
    // minutes before tonight's sunset instead of at midnight.
    const cutover = getEarlyCutover(ymd);
    if (cutover && date.getTime() >= cutover.getTime()) {
      return addDaysToYmd(ymd, 1);
    }

    return ymd;
  }

  private async writeScan(scan: Scan) {
    await authReady;
    await setDoc(doc(firestore, 'scans', scan.id), scan, { merge: true });
  }

  public async addScan(scanData: Omit<Scan, 'id' | 'logicalDate' | 'remainingSeats' | 'driverCapacity' | 'isBigBus'>) {
    const usersList = this.getUsers();
    const driver = usersList.find(u => u.id === scanData.driverId);
    const capacity = driver?.capacity || 15;
    const isBigBus = driver?.isBigBus ?? false;
    const remainingSeats = Math.max(0, capacity - scanData.passengersCount);

    const targetDirection: Direction = scanData.departureLocation === '770' ? 'to_ohel' : 'to_770';
    const startLoc = targetDirection === 'to_ohel' ? LOCATIONS['770'] : LOCATIONS['Ohel'];
    const etaMinutes = await this.getRouteEtaMinutes(startLoc.latitude, startLoc.longitude, targetDirection);

    // Calculate expected arrival time clock string
    const startTime = new Date(scanData.scannedAt || new Date().toISOString()).getTime();
    const arrivalTime = new Date(startTime + (etaMinutes * 60000));
    const expectedArrivalTime = arrivalTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' });

    const newScan: Scan = {
      ...scanData,
      id: 'scn_' + Math.random().toString(36).substr(2, 9),
      driverCapacity: capacity,
      isBigBus,
      remainingSeats,
      logicalDate: this.getLogicalDate(scanData.scannedAt),
      etaMinutes,
      expectedArrivalTime
    };

    this.scansCache = [...this.scansCache, newScan];
    localStorage.setItem('tp_scans', JSON.stringify(this.scansCache));
    this.notify();
    // Awaited (not fire-and-forget): the dispatcher needs real feedback if this
    // fails (e.g. a dropped connection right at scan time) rather than seeing a
    // false "success" while the ride silently never reaches Firestore or the
    // WhatsApp group. The local cache write above already happened, so the scan
    // still shows in this dispatcher's own view even if the sync below fails.
    await this.writeScan(newScan);

    // Trigger driver driving simulation to the opposite location of departure with precomputed ETA
    this.updateDriverTripState(scanData.driverId, 'en_route', targetDirection, etaMinutes);

    this.notify();
    return newScan;
  }

  public addLocalScan(scan: Scan) {
    if (!this.scansCache.some(s => s.id === scan.id)) {
      this.scansCache = [...this.scansCache, scan];
      localStorage.setItem('tp_scans', JSON.stringify(this.scansCache));
      this.notify();
    }
  }

  public async updateScan(updatedScan: Scan) {
    const freshScan = {
      ...updatedScan,
      remainingSeats: Math.max(0, updatedScan.driverCapacity - updatedScan.passengersCount)
    };

    const index = this.scansCache.findIndex(s => s.id === freshScan.id);
    if (index >= 0) {
      this.scansCache = [...this.scansCache];
      this.scansCache[index] = freshScan;
      localStorage.setItem('tp_scans', JSON.stringify(this.scansCache));
      this.notify();
    }

    await this.writeScan(freshScan);
  }

  public async deleteScan(scanId: string) {
    this.scansCache = this.scansCache.filter(s => s.id !== scanId);
    localStorage.setItem('tp_scans', JSON.stringify(this.scansCache));
    this.notify();

    await authReady;
    await deleteDoc(doc(firestore, 'scans', scanId));
  }

  // --- Active Locations ---
  public getActiveLocations(): ActiveLocation[] {
    const drivers = this.getUsers().filter(u => u.role === 'driver');
    const now = Date.now();
    const scans = this.getScans();

    return drivers.map(driver => {
      const driverScans = scans.filter(s => s.driverId === driver.id);
      driverScans.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
      const latestScan = driverScans[0];

      let status: DriverStatus = 'idle';
      let direction: Direction = null;
      let etaMinutes: number | undefined = undefined;
      let scannedAt: string | undefined = undefined;
      let expectedArrivalTime: string | undefined = undefined;
      const actualArrivalTime = latestScan?.actualArrivalTime;

      if (latestScan && !actualArrivalTime) {
        const startTime = this.parseScannedAt(latestScan.scannedAt, latestScan.logicalDate).getTime();
        const duration = latestScan.etaMinutes || 28;
        const endTime = startTime + (duration * 60000);

        if (now < endTime) {
          status = 'en_route';
          direction = latestScan.departureLocation === '770' ? 'to_ohel' : 'to_770';
          etaMinutes = Math.max(1, Math.round((endTime - now) / 60000));
          scannedAt = latestScan.scannedAt;
          expectedArrivalTime = latestScan.expectedArrivalTime
            || new Date(endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' });
        }
      }

      return {
        id: driver.id,
        name: driver.name,
        role: 'driver',
        latitude: 0,
        longitude: 0,
        status,
        direction,
        etaMinutes,
        updatedAt: latestScan?.scannedAt || new Date().toISOString(),
        scannedAt,
        expectedArrivalTime
      };
    });
  }

  public async updateActiveLocation(_userId: string, _lat: number, _lng: number, _driverFields?: Partial<Pick<ActiveLocation, 'status' | 'direction' | 'etaMinutes' | 'speedWarning'>>) {
    // No-op — live GPS location broadcasting isn't wired up; status/direction/ETA are
    // derived dynamically from scans in getActiveLocations() instead.
  }

  public async updateDriverTripState(driverId: string, status: DriverStatus, _direction: Direction, _precomputedEta?: number) {
    if (status === 'idle' || status === 'break') {
      const activeScan = this.getScans().find(s => s.driverId === driverId && !s.actualArrivalTime);
      if (activeScan) {
        const updated = { ...activeScan, actualArrivalTime: new Date().toISOString() };
        const index = this.scansCache.findIndex(s => s.id === updated.id);
        if (index >= 0) {
          this.scansCache = [...this.scansCache];
          this.scansCache[index] = updated;
          localStorage.setItem('tp_scans', JSON.stringify(this.scansCache));
          this.notify();
        }
        await this.writeScan(updated);
      }
    }
  }

  public async updateDriverEta(_driverId: string, _etaMinutes: number) {
    // No-op - active driver ETA is managed at scan time (dead code path, kept for API compatibility)
  }

  // --- Global Settings ---
  public getConfig(): GlobalConfig {
    return this.configCache;
  }

  public async saveConfig(config: GlobalConfig) {
    localStorage.setItem('tp_config', JSON.stringify(config));
    this.configCache = config;
    this.notify();

    await authReady;
    await setDoc(doc(firestore, 'settings', SETTINGS_DOC), config, { merge: true });
  }

  public async sendEmail(_to: string, _subject: string, _html: string) {
    // No-op — ad-hoc report emails from the UI aren't wired to a backend sender;
    // the daily manager summary is sent separately via a Vercel Cron function.
  }

  // --- SOS Alerts (dead code paths — no UI ever calls triggerSOS, kept only for API compatibility) ---
  public async triggerSOS(_driverId: string) {}
  public getSOSAlerts(): { id: string; name: string; latitude: number; longitude: number }[] { return []; }
  public async clearSOSAlert(_driverId: string) {}
  public async sendSMS(_to: string, _body: string) {}

  // --- Dispatcher Shift / Hours Logging ---
  public getDispatcherAttendance(): { [date: string]: { [dispatcherId: string]: { firstScan: string; lastScan: string; count: number } } } {
    const scansList = this.getScans();
    const attendance: { [date: string]: { [dispatcherId: string]: { firstScan: string; lastScan: string; count: number } } } = {};

    scansList.forEach(scan => {
      const date = scan.logicalDate;
      const dispId = scan.dispatcherId;
      const time = scan.scannedAt;

      if (!attendance[date]) {
        attendance[date] = {};
      }

      if (!attendance[date][dispId]) {
        attendance[date][dispId] = { firstScan: time, lastScan: time, count: 1 };
      } else {
        const current = attendance[date][dispId];
        current.count += 1;
        if (new Date(time) < new Date(current.firstScan)) {
          current.firstScan = time;
        }
        if (new Date(time) > new Date(current.lastScan)) {
          current.lastScan = time;
        }
      }
    });

    return attendance;
  }

  public parseScannedAt(scannedAtStr: string, logicalDateStr: string): Date {
    const parsed = new Date(scannedAtStr);
    if (parsed.getFullYear() < 1970) {
      let timeStr = "00:00:00";
      if (scannedAtStr.includes('T')) {
        timeStr = scannedAtStr.split('T')[1].substring(0, 8);
      } else {
        const match = scannedAtStr.match(/\d{2}:\d{2}:\d{2}/);
        if (match) timeStr = match[0];
      }
      let datePart = logicalDateStr;
      if (logicalDateStr.includes('GMT') || logicalDateStr.length > 15) {
        try {
          const d = new Date(logicalDateStr);
          datePart = d.toISOString().split('T')[0];
        } catch(e) {}
      } else if (logicalDateStr.includes('/')) {
        const parts = logicalDateStr.split('/');
        if (parts.length === 3) datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return new Date(`${datePart}T${timeStr}`);
    }
    return parsed;
  }

  // --- GPS Location & Distance Helpers ---
  public calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public async getRouteEtaMinutes(lat: number, lng: number, direction: Direction): Promise<number> {
    if (!direction) return 0;
    const destination = direction === 'to_ohel' ? LOCATIONS['Ohel'] : LOCATIONS['770'];

    const config = this.getConfig() as any;
    // Prefer the build-time env key (available on EVERY device, incl. the dispatcher who scans),
    // fall back to the per-browser saved config key.
    const apiKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) || config.googleMapsApiKey || DEFAULT_GOOGLE_MAPS_API_KEY;

    // 1. Google Routes API (v2) — live traffic-aware ETA, identical to what Google Maps shows.
    if (apiKey) {
      try {
        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.duration'
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: lat, longitude: lng } } },
            destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE'
          })
        });
        const data = await response.json();
        const durationStr: string | undefined = data?.routes?.[0]?.duration;
        if (durationStr) {
          const seconds = parseInt(String(durationStr).replace('s', ''), 10);
          if (!isNaN(seconds) && seconds > 0) {
            return Math.max(1, Math.round(seconds / 60));
          }
        }
        // The call succeeded at the network level but returned no usable route -
        // e.g. a referrer-restriction rejection, an invalid key, or a quota error
        // all come back as a normal HTTP response with an `error` body, not a
        // thrown exception. Without logging this, a silent fallback to the much
        // less accurate distance-estimate below is completely invisible.
        console.warn('Routes API returned no duration - falling back to distance estimate. Response:', JSON.stringify(data).slice(0, 500));
      } catch (e) {
        console.error('Routes API ETA error - falling back to distance estimate:', e);
      }
    }

    // 2. Fallback: Haversine distance * NYC winding coefficient / typical speed.
    // Meaningfully less accurate than live traffic data - only reached when the
    // Routes API call above didn't return a usable result (see the warning logged
    // just above for why).
    const distanceKm = this.calculateHaversineDistance(lat, lng, destination.latitude, destination.longitude);
    const roadDistanceKm = distanceKm * 1.28;
    const averageSpeedKmh = 38; // ~24 mph

    let eta = Math.round((roadDistanceKm / averageSpeedKmh) * 60);
    if (distanceKm < 0.2) {
      eta = 0;
    } else {
      eta = Math.max(1, eta);
    }
    console.warn(`ETA fallback used: ${eta} min (distance estimate, not live traffic)`);
    return eta;
  }
}

export const dbService = new DBService();
export default dbService;
