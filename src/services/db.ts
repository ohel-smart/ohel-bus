// Types Definitions
export type UserRole = 'admin' | 'driver' | 'dispatcher';
export type DriverStatus = 'idle' | 'en_route' | 'break';
export type Direction = 'to_770' | 'to_ohel' | null;
export type DepartureLocation = '770' | 'Ohel';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  capacity?: number; // Only for drivers
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

// Coordinates
export const LOCATIONS = {
  '770': { latitude: 40.6690, longitude: -73.9429, name: '770 (קראון הייטס)' },
  'Ohel': { latitude: 40.7061, longitude: -73.7291, name: 'אוהל חב"ד (קווינס)' }
};

// Fallback Default Web App URL
const DEFAULT_SHEETS_URL = "https://script.google.com/macros/s/AKfycbwVnb0iH84jwtf6q2yk7JmuRQPV5HtQgBXtz1MWmyXoxi5J45UREctNsO_yCAsZzgZB/exec";

// Default Pre-Populated Users (Used as offline/local fallback)
const DEFAULT_USERS: User[] = [
  { id: 'usr_admin', name: 'הרב רוזנברג', phone: '050-770-7700', role: 'admin', code: '770', createdAt: new Date().toISOString() },
  { id: 'drv_777', name: 'נהג 777 (נהג)', phone: '050-777-7777', role: 'driver', code: '777', createdAt: new Date().toISOString() },
  { id: 'drv_778', name: 'נהג 778 (נהג)', phone: '050-778-7788', role: 'driver', code: '778', createdAt: new Date().toISOString() },
  { id: 'disp_1000', name: 'סדרן 1000 (סדרן)', phone: '050-100-1000', role: 'dispatcher', code: '1000', createdAt: new Date().toISOString() }
];

class DBService {
  private listeners: Set<() => void> = new Set();
  
  // Local cache
  private usersCache: User[] = [];
  private scansCache: Scan[] = [];
  private configCache: GlobalConfig = { reportEmail: 'manager@transit.pro', googleSheetsUrl: DEFAULT_SHEETS_URL };

  constructor() {
    this.initDatabase();
    this.fetchDataFromSheets();
    this.startSimulation();
    
    // Periodically poll Google Sheets for updates (every 3 seconds for instant driver syncing)
    setInterval(() => {
      this.fetchDataFromSheets();
    }, 3000);
  }

  private initDatabase() {
    // Load local storage cache initially
    const rawUsersList = JSON.parse(localStorage.getItem('tp_users') || '[]');
    const rawScansList = JSON.parse(localStorage.getItem('tp_scans') || '[]');
    const rawConfig = JSON.parse(localStorage.getItem('tp_config') || '{}');
    
    this.configCache = {
      reportEmail: rawConfig.reportEmail || 'manager@transit.pro',
      googleSheetsUrl: rawConfig.googleSheetsUrl && 
        !rawConfig.googleSheetsUrl.includes("AKfycbwBDFDOITw1G9TRo05flrcGGMB05SNQzkZLnLgKHSF6u6JohWdJvctnNyv8j-0AYa9S") && 
        !rawConfig.googleSheetsUrl.includes("AKfycbytfHnxo1rsPmmx7bjFTlgWc4h2MJrYce5E_r5MBV64ouNcrLppm90aCsW40GRlNWWT") &&
        !rawConfig.googleSheetsUrl.includes("AKfycbzgGtU1PUlLNqCfbol9b68tXDo5m6vIBZBdrIqsonDZml8dVCnTUHkTPqC_-y6O_Jl1") &&
        !rawConfig.googleSheetsUrl.includes("AKfycbwCIg6Npl01Hk8_Y2T9ZIBYRPlHXtJfO6G_a4DVouHieHovoOMqZxE01X8mgJKsRD1U") &&
        !rawConfig.googleSheetsUrl.includes("AKfycbzWBuis76UbkEziZmnA0jzspOLRtLfbunq5PtS9RtTpew-nkxCAmkX5hhz_fBliJTrU") &&
        !rawConfig.googleSheetsUrl.includes("AKfycbyuuijzy2EcEYHREeIodzvl_h4xmSHkdCK948LOZvJCo9oF65KN8OH8G6MDmynjxoFt") &&
        !rawConfig.googleSheetsUrl.includes("AKfycbwaHPeJ20BKaveyGzKe4MEUAoiyP8q55m2S4J8oJyv3Fy1whWfbwnBEcZ1C5UMJRxUI") &&
        !rawConfig.googleSheetsUrl.includes("AKfycbwhc_Mjh_8nyu-wikew74nKe0DUJu9hLRo9eJCLwfoAApS9enUrSpTfS7f0idwyVAIY")
        ? rawConfig.googleSheetsUrl 
        : DEFAULT_SHEETS_URL,
      googleMapsApiKey: rawConfig.googleMapsApiKey || '',
      twilioAccountSid: rawConfig.twilioAccountSid || '',
      twilioAuthToken: rawConfig.twilioAuthToken || '',
      twilioFromNumber: rawConfig.twilioFromNumber || '',
      twilioRecipientSms: rawConfig.twilioRecipientSms || ''
    };

    let deletedUsers: string[] = [];
    let deletedScans: string[] = [];
    try {
      deletedUsers = JSON.parse(localStorage.getItem('tp_deleted_users') || '[]');
      deletedScans = JSON.parse(localStorage.getItem('tp_deleted_scans') || '[]');
    } catch (e) {}

    // Populate cache with default or local stored data
    this.usersCache = rawUsersList.length > 0 
      ? rawUsersList.filter((u: User) => !deletedUsers.includes(u.id))
      : DEFAULT_USERS;
    this.scansCache = rawScansList
      .filter((s: Scan) => !deletedScans.includes(s.id))
      .map((s: Scan) => ({ ...s, logicalDate: this.cleanDate(s.logicalDate) }));
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



  // --- Google Sheets Integration Fetching (GET) ---
  public async fetchDataFromSheets() {
    const url = this.configCache.googleSheetsUrl;
    if (!url) return;

    try {
      const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
      const res = await fetch(cacheBustUrl);
      const data = await res.json();
      if (data && !data.error) {
        let deletedUsers: string[] = [];
        let deletedScans: string[] = [];
        try {
          deletedUsers = JSON.parse(localStorage.getItem('tp_deleted_users') || '[]');
          deletedScans = JSON.parse(localStorage.getItem('tp_deleted_scans') || '[]');
        } catch (e) {}

        if (Array.isArray(data.users)) {
          const filteredUsers = data.users.filter((u: User) => !deletedUsers.includes(u.id));
          this.usersCache = filteredUsers;
          localStorage.setItem('tp_users', JSON.stringify(filteredUsers));
        }
        if (Array.isArray(data.scans)) {
          const remoteScans = data.scans
            .filter((s: Scan) => !deletedScans.includes(s.id))
            .map((s: Scan) => ({ ...s, logicalDate: this.cleanDate(s.logicalDate) }));
            
          this.scansCache = remoteScans;
          localStorage.setItem('tp_scans', JSON.stringify(remoteScans));
        }
        // Active locations are computed dynamically in getActiveLocations() from users and scans
        this.notify();
      }
    } catch (e) {
      console.error("Failed to fetch data from Google Sheets:", e);
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

  // --- Online/Offline Handling ---
  public isOffline(): boolean {
    return localStorage.getItem('tp_is_offline') === 'true';
  }

  public setOfflineStatus(offline: boolean) {
    localStorage.setItem('tp_is_offline', String(offline));
    if (!offline) {
      this.syncOfflineScans();
    }
    this.notify();
  }

  private async syncOfflineScans() {
    const offlineScans: Scan[] = JSON.parse(localStorage.getItem('tp_offline_scans') || '[]');
    if (offlineScans.length > 0) {
      const scans = this.getScans();
      const newScans = [...scans, ...offlineScans];
      localStorage.setItem('tp_scans', JSON.stringify(newScans));
      this.scansCache = newScans;
      
      // Upload offline scans
      for (const scan of offlineScans) {
        this.syncToGoogleSheets('syncScan', scan);
      }
      
      localStorage.setItem('tp_offline_scans', JSON.stringify([]));
      this.notify();
      
      setTimeout(() => this.fetchDataFromSheets(), 1500);
    }
  }

  public getOfflineScansCount(): number {
    const offlineScans: Scan[] = JSON.parse(localStorage.getItem('tp_offline_scans') || '[]');
    return offlineScans.length;
  }

  public loginWithCode(code: string): User | null {
    return this.usersCache.find(u => u.code === code) || null;
  }

  // --- Users CRUD ---
  public getUsers(): User[] {
    let deletedUsers: string[] = [];
    try {
      deletedUsers = JSON.parse(localStorage.getItem('tp_deleted_users') || '[]');
    } catch (e) {}
    return this.usersCache.filter(u => !deletedUsers.includes(u.id));
  }

  public async saveUser(user: User) {
    // 1. Update local storage and cache immediately (Zero-Lag UI)
    const users = JSON.parse(localStorage.getItem('tp_users') || '[]');
    const index = users.findIndex((u: User) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem('tp_users', JSON.stringify(users));
    this.usersCache = users;


    this.notify();

    // 2. Sync in background with Google Sheets
    this.syncToGoogleSheets('syncUser', user);
    
    // Refresh cache from Sheets in 1.5 seconds to align spreadsheets formula columns
    setTimeout(() => this.fetchDataFromSheets(), 1500);
  }

  public async deleteUser(userId: string) {
    // 1. Update local storage and cache immediately (Zero-Lag UI)
    let users = JSON.parse(localStorage.getItem('tp_users') || '[]');
    users = users.filter((u: User) => u.id !== userId);
    localStorage.setItem('tp_users', JSON.stringify(users));
    
    // Add to deleted users cache to make it permanent client-side
    try {
      const deletedUsers = JSON.parse(localStorage.getItem('tp_deleted_users') || '[]');
      if (!deletedUsers.includes(userId)) {
        deletedUsers.push(userId);
        localStorage.setItem('tp_deleted_users', JSON.stringify(deletedUsers));
      }
    } catch (e) {}

    this.usersCache = this.usersCache.filter(u => u.id !== userId);



    // Track if a default user was explicitly deleted to prevent self-healing from re-creating it
    if (DEFAULT_USERS.some(u => u.id === userId)) {
      try {
        const deletedDefaults = JSON.parse(localStorage.getItem('tp_deleted_defaults') || '[]');
        if (!deletedDefaults.includes(userId)) {
          deletedDefaults.push(userId);
          localStorage.setItem('tp_deleted_defaults', JSON.stringify(deletedDefaults));
        }
      } catch (e) {}
    }

    this.notify();

    // 2. Sync in background
    this.syncToGoogleSheets('deleteUser', { id: userId });
    
    setTimeout(() => this.fetchDataFromSheets(), 1500);
  }

  // --- Scans CRUD ---
  public getScans(): Scan[] {
    let deletedScans: string[] = [];
    try {
      deletedScans = JSON.parse(localStorage.getItem('tp_deleted_scans') || '[]');
    } catch (e) {}
    return this.scansCache.filter(s => !deletedScans.includes(s.id));
  }

  public getLogicalDate(dateStr: string = new Date().toISOString()): string {
    const date = new Date(dateStr);
    const hours = date.getHours();
    
    // 01:00 AM Rule
    if (hours === 0) {
      const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
      return yesterday.toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  }

  public async addScan(scanData: Omit<Scan, 'id' | 'logicalDate' | 'remainingSeats' | 'driverCapacity'>) {
    const usersList = this.getUsers();
    const driver = usersList.find(u => u.id === scanData.driverId);
    const capacity = driver?.capacity || 15;
    const remainingSeats = Math.max(0, capacity - scanData.passengersCount);

    const targetDirection: Direction = scanData.departureLocation === '770' ? 'to_ohel' : 'to_770';
    const startLoc = targetDirection === 'to_ohel' ? LOCATIONS['770'] : LOCATIONS['Ohel'];
    const etaMinutes = await this.getRouteEtaMinutes(startLoc.latitude, startLoc.longitude, targetDirection);
    
    // Calculate expected arrival time clock string
    const startTime = new Date(scanData.scannedAt || new Date().toISOString()).getTime();
    const arrivalTime = new Date(startTime + (etaMinutes * 60000));
    const expectedArrivalTime = arrivalTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    const newScan: Scan = {
      ...scanData,
      id: 'scn_' + Math.random().toString(36).substr(2, 9),
      driverCapacity: capacity,
      remainingSeats,
      logicalDate: this.getLogicalDate(scanData.scannedAt),
      etaMinutes,
      expectedArrivalTime
    };

    if (this.isOffline()) {
      const offlineScans: Scan[] = JSON.parse(localStorage.getItem('tp_offline_scans') || '[]');
      offlineScans.push(newScan);
      localStorage.setItem('tp_offline_scans', JSON.stringify(offlineScans));
    } else {
      const scans = JSON.parse(localStorage.getItem('tp_scans') || '[]');
      scans.push(newScan);
      localStorage.setItem('tp_scans', JSON.stringify(scans));
      this.scansCache = scans;
    }

    // Sync to Google Sheets
    this.syncToGoogleSheets('syncScan', newScan);

    // Trigger driver driving simulation to the opposite location of departure with precomputed ETA
    this.updateDriverTripState(scanData.driverId, 'en_route', targetDirection, etaMinutes);

    this.notify();
    
    setTimeout(() => this.fetchDataFromSheets(), 1500);
    return newScan;
  }

  public async updateScan(updatedScan: Scan) {
    const freshScan = {
      ...updatedScan,
      remainingSeats: Math.max(0, updatedScan.driverCapacity - updatedScan.passengersCount)
    };

    const scans = JSON.parse(localStorage.getItem('tp_scans') || '[]');
    const index = scans.findIndex((s: Scan) => s.id === freshScan.id);
    if (index >= 0) {
      scans[index] = freshScan;
      localStorage.setItem('tp_scans', JSON.stringify(scans));
      this.scansCache = scans;
      this.notify();
    }
    
    // Sync to Google Sheets
    this.syncToGoogleSheets('syncScan', freshScan);
    
    setTimeout(() => this.fetchDataFromSheets(), 1500);
  }

  public async deleteScan(scanId: string) {
    // 1. Update local storage and cache immediately (Zero-Lag UI)
    let scans = JSON.parse(localStorage.getItem('tp_scans') || '[]');
    scans = scans.filter((s: Scan) => s.id !== scanId);
    localStorage.setItem('tp_scans', JSON.stringify(scans));
    
    // Add to deleted scans cache to make it permanent client-side
    try {
      const deletedScans = JSON.parse(localStorage.getItem('tp_deleted_scans') || '[]');
      if (!deletedScans.includes(scanId)) {
        deletedScans.push(scanId);
        localStorage.setItem('tp_deleted_scans', JSON.stringify(deletedScans));
      }
    } catch (e) {}

    this.scansCache = this.scansCache.filter((s: Scan) => s.id !== scanId);
    this.notify();

    // 2. Sync in background
    this.syncToGoogleSheets('deleteScan', { id: scanId });
    
    setTimeout(() => this.fetchDataFromSheets(), 1500);
  }

  // --- Active Locations ---
  public getActiveLocations(): ActiveLocation[] {
    let deletedUsers: string[] = [];
    try {
      deletedUsers = JSON.parse(localStorage.getItem('tp_deleted_users') || '[]');
    } catch (e) {}

    const drivers = this.getUsers().filter(u => u.role === 'driver' && !deletedUsers.includes(u.id));
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
      const actualArrivalTime = latestScan?.actualArrivalTime;

      if (latestScan && !actualArrivalTime) {
        const startTime = new Date(latestScan.scannedAt).getTime();
        const duration = latestScan.etaMinutes || 28;
        const endTime = startTime + (duration * 60000);

        if (now < endTime) {
          status = 'en_route';
          direction = latestScan.departureLocation === '770' ? 'to_ohel' : 'to_770';
          etaMinutes = Math.max(1, Math.round((endTime - now) / 60000));
          scannedAt = latestScan.scannedAt;
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
        scannedAt
      };
    });
  }

  public async updateActiveLocation(_userId: string, _lat: number, _lng: number, _driverFields?: Partial<Pick<ActiveLocation, 'status' | 'direction' | 'etaMinutes' | 'speedWarning'>>) {
    // No-op to disable writing active GPS/locations to Google Sheets
  }

  public async updateDriverTripState(driverId: string, status: DriverStatus, _direction: Direction, _precomputedEta?: number) {
    if (status === 'idle' || status === 'break') {
      const scans = this.getScans();
      const activeScan = scans.find(s => s.driverId === driverId && !s.actualArrivalTime);
      if (activeScan) {
        activeScan.actualArrivalTime = new Date().toISOString();
        localStorage.setItem('tp_scans', JSON.stringify(scans));
        this.scansCache = scans;
        this.notify();
        
        this.syncToGoogleSheets('syncScan', activeScan);
        setTimeout(() => this.fetchDataFromSheets(), 1500);
      }
    }
  }

  public async updateDriverEta(_driverId: string, _etaMinutes: number) {
    // No-op - active driver ETA is managed at scan time
  }

  public async resetTrips() {
    localStorage.setItem('tp_scans', JSON.stringify([]));
    localStorage.setItem('tp_deleted_scans', JSON.stringify([]));
    this.scansCache = [];
    this.notify();

    this.syncToGoogleSheets('resetTrips', {});
    setTimeout(() => this.fetchDataFromSheets(), 1500);
  }

  // --- Global Settings ---
  public getConfig(): GlobalConfig {
    return this.configCache;
  }

  public async saveConfig(config: GlobalConfig) {
    localStorage.setItem('tp_config', JSON.stringify(config));
    this.configCache = config;
    this.notify();
    
    // Reload local settings
    this.initDatabase();
    
    // Sync settings to Sheets
    this.syncToGoogleSheets('syncConfig', config);
  }

  public async sendEmail(to: string, subject: string, html: string) {
    // Send email using Google Apps Script webhook
    this.syncToGoogleSheets('sendEmail', { to, subject, html });
  }

  private startSimulation() {
    // Disabled simulation as status is computed dynamically from scans
  }

  public async triggerSOS(driverId: string) {
    const user = this.getUsers().find(u => u.id === driverId);
    if (!user) return;

    let sosAlerts: string[] = [];
    try {
      sosAlerts = JSON.parse(localStorage.getItem('tp_sos_alerts') || '[]');
    } catch(e) {}

    const isSOSNow = !sosAlerts.includes(driverId);
    if (isSOSNow) {
      sosAlerts.push(driverId);
      const config = this.getConfig() as any;
      const recipient = config.twilioRecipientSms || config.reportEmail;
      if (recipient) {
        const sosText = `🚨 התראת SOS במערכת אוהל בוס! 🚨\nהנהג ${user.name.replace(' (נהג)', '')} הפעיל קריאת חירום דחופה!`;
        this.sendSMS(recipient, sosText);
      }
    } else {
      sosAlerts = sosAlerts.filter(id => id !== driverId);
    }

    localStorage.setItem('tp_sos_alerts', JSON.stringify(sosAlerts));
    this.notify();
  }

  public getSOSAlerts(): { id: string; name: string; latitude: number; longitude: number }[] {
    let sosAlerts: string[] = [];
    try {
      sosAlerts = JSON.parse(localStorage.getItem('tp_sos_alerts') || '[]');
    } catch(e) {}

    return sosAlerts.map(id => {
      const user = this.getUsers().find(u => u.id === id);
      return {
        id,
        name: user?.name || 'Driver',
        latitude: LOCATIONS['770'].latitude,
        longitude: LOCATIONS['770'].longitude
      };
    });
  }

  public async clearSOSAlert(driverId: string) {
    let sosAlerts: string[] = [];
    try {
      sosAlerts = JSON.parse(localStorage.getItem('tp_sos_alerts') || '[]');
    } catch(e) {}

    if (sosAlerts.includes(driverId)) {
      sosAlerts = sosAlerts.filter(id => id !== driverId);
      localStorage.setItem('tp_sos_alerts', JSON.stringify(sosAlerts));
      
      const user = this.getUsers().find(u => u.id === driverId);
      const config = this.getConfig() as any;
      const recipient = config.twilioRecipientSms || config.reportEmail;
      if (recipient && user) {
        this.sendSMS(recipient, `✅ קריאת החירום (SOS) עבור הנהג ${user.name.replace(' (נהג)', '')} בוטלה.`);
      }
      this.notify();
    }
  }

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
    
    // Check if Google Maps API Key is configured
    const config = this.getConfig() as any;
    const apiKey = config.googleMapsApiKey;
    
    if (apiKey) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat},${lng}&destinations=${destination.latitude},${destination.longitude}&key=${apiKey}`
        );
        const data = await response.json();
        if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
          const element = data.rows[0].elements[0];
          if (element.status === 'OK' && element.duration) {
            return Math.round(element.duration.value / 60);
          }
        }
      } catch (e) {
        console.error("Google Maps Distance Matrix error:", e);
      }
    }
    
    // Fallback formula: Haversine distance * NYC winding coefficient / typical speed
    const distanceKm = this.calculateHaversineDistance(lat, lng, destination.latitude, destination.longitude);
    const roadDistanceKm = distanceKm * 1.28;
    const averageSpeedKmh = 38; // ~24 mph
    
    let eta = Math.round((roadDistanceKm / averageSpeedKmh) * 60);
    if (distanceKm < 0.2) {
      eta = 0;
    } else {
      eta = Math.max(1, eta);
    }
    return eta;
  }

  // --- External APIs (Twilio SMS & Google Sheets POST Webhook) ---
  public async sendSMS(to: string, body: string) {
    const config = this.getConfig() as any;
    const { twilioAccountSid, twilioAuthToken, twilioFromNumber } = config;
    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      console.log("Twilio credentials not configured. SMS simulation: ", to, body);
      return;
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      
      const params = new URLSearchParams();
      params.append('To', to);
      params.append('From', twilioFromNumber);
      params.append('Body', body);

      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });
      console.log("Twilio SMS sent successfully.");
    } catch (e) {
      console.error("Failed to send Twilio SMS:", e);
    }
  }

  public async syncToGoogleSheets(action: string, data: any) {
    const config = this.getConfig() as any;
    const url = config.googleSheetsUrl;
    if (!url) return;

    try {
      fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data })
      }).catch(err => console.error("Google Sheets sync request error:", err));
    } catch (e) {
      console.error("Google Sheets sync error:", e);
    }
  }
}

export const dbService = new DBService();
export default dbService;
