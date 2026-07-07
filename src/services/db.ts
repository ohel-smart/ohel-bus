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
const DEFAULT_SHEETS_URL = "https://script.google.com/macros/s/AKfycbydOGZ-ADMwO1Da0QeALANeI0GGnXBfke3mUeDcGBdW4R7jhy5psNXHcPasvNu7eGkN/exec";

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
  private activeLocationsCache: ActiveLocation[] = [];
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
    const rawLocsList = JSON.parse(localStorage.getItem('tp_active_locations') || '[]');
    const rawConfig = JSON.parse(localStorage.getItem('tp_config') || '{}');
    
    this.configCache = {
      reportEmail: rawConfig.reportEmail || 'manager@transit.pro',
      googleSheetsUrl: rawConfig.googleSheetsUrl && 
        !rawConfig.googleSheetsUrl.includes("AKfycbwBDFDOITw1G9TRo05flrcGGMB05SNQzkZLnLgKHSF6u6JohWdJvctnNyv8j-0AYa9S") && 
        !rawConfig.googleSheetsUrl.includes("AKfycbytfHnxo1rsPmmx7bjFTlgWc4h2MJrYce5E_r5MBV64ouNcrLppm90aCsW40GRlNWWT") &&
        !rawConfig.googleSheetsUrl.includes("AKfycbzgGtU1PUlLNqCfbol9b68tXDo5m6vIBZBdrIqsonDZml8dVCnTUHkTPqC_-y6O_Jl1") &&
        !rawConfig.googleSheetsUrl.includes("AKfycbwCIg6Npl01Hk8_Y2T9ZIBYRPlHXtJfO6G_a4DVouHieHovoOMqZxE01X8mgJKsRD1U")
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
    this.activeLocationsCache = rawLocsList.length > 0
      ? rawLocsList.filter((l: ActiveLocation) => !deletedUsers.includes(l.id))
      : this.getInitialActiveLocations();
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

  private getInitialActiveLocations(): ActiveLocation[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'drv_777',
        name: 'נהג 777',
        role: 'driver',
        latitude: LOCATIONS['770'].latitude,
        longitude: LOCATIONS['770'].longitude,
        status: 'idle',
        updatedAt: now,
        isSimulated: true
      } as any,
      {
        id: 'drv_778',
        name: 'נהג 778',
        role: 'driver',
        latitude: LOCATIONS['770'].latitude,
        longitude: LOCATIONS['770'].longitude,
        status: 'idle',
        updatedAt: now,
        isSimulated: true
      } as any
    ];
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
            
          // Merge local scans not yet synced to Google Sheets
          const localScans: Scan[] = JSON.parse(localStorage.getItem('tp_scans') || '[]');
          const mergedScans = [...remoteScans];
          localScans.forEach((ls: Scan) => {
            if (!mergedScans.some(rs => rs.id === ls.id)) {
              mergedScans.push(ls);
            }
          });
          
          this.scansCache = mergedScans;
          localStorage.setItem('tp_scans', JSON.stringify(mergedScans));
        }
        if (Array.isArray(data.activeLocations)) {
          const currentLocs: ActiveLocation[] = JSON.parse(localStorage.getItem('tp_active_locations') || '[]');
          const filteredLocs = data.activeLocations.filter((l: ActiveLocation) => !deletedUsers.includes(l.id)).map((newLoc: ActiveLocation) => {
            const existing = currentLocs.find(curr => curr.id === newLoc.id);
            if (existing) {
              // If remote has a active trip (en_route) but local is idle, always accept it immediately
              if (newLoc.status === 'en_route' && existing.status === 'idle') {
                return newLoc;
              }
              const existingTime = new Date(existing.updatedAt || 0).getTime();
              const newTime = new Date(newLoc.updatedAt || 0).getTime();
              // Keep local changes if local is newer (stale spreadsheet fetch protection)
              if (existingTime > newTime) {
                return {
                  ...newLoc,
                  ...existing,
                  name: newLoc.name || existing.name
                };
              }
            }
            return newLoc;
          });
          this.activeLocationsCache = filteredLocs;
          localStorage.setItem('tp_active_locations', JSON.stringify(filteredLocs));
        }
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

    if (user.role === 'driver' || user.role === 'dispatcher') {
      const locations = this.getActiveLocations();
      const locIndex = locations.findIndex(l => l.id === user.id);
      if (locIndex >= 0) {
        locations[locIndex].name = user.name.replace(' (נהג)', '').replace(' (סדרן)', '').replace(' (מנהל)', '');
        locations[locIndex].role = user.role as 'driver' | 'dispatcher';
      } else {
        locations.push({
          id: user.id,
          name: user.name.replace(' (נהג)', '').replace(' (סדרן)', '').replace(' (מנהל)', ''),
          role: user.role as 'driver' | 'dispatcher',
          latitude: LOCATIONS['770'].latitude,
          longitude: LOCATIONS['770'].longitude,
          status: user.role === 'driver' ? 'idle' : undefined,
          updatedAt: new Date().toISOString()
        });
      }
      localStorage.setItem('tp_active_locations', JSON.stringify(locations));
      this.activeLocationsCache = locations;
    } else {
      // Changed to admin, remove from active locations list
      let locations = this.getActiveLocations();
      locations = locations.filter(l => l.id !== user.id);
      localStorage.setItem('tp_active_locations', JSON.stringify(locations));
      this.activeLocationsCache = locations;
    }
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

    let locations = this.getActiveLocations();
    locations = locations.filter(l => l.id !== userId);
    localStorage.setItem('tp_active_locations', JSON.stringify(locations));
    this.activeLocationsCache = locations;

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
    
    const newScan: Scan = {
      ...scanData,
      id: 'scn_' + Math.random().toString(36).substr(2, 9),
      driverCapacity: capacity,
      remainingSeats,
      logicalDate: this.getLogicalDate(scanData.scannedAt),
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

    // Trigger driver driving simulation to the opposite location of departure
    const targetDirection: Direction = scanData.departureLocation === '770' ? 'to_ohel' : 'to_770';
    this.updateDriverTripState(scanData.driverId, 'en_route', targetDirection);

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
    return this.activeLocationsCache.filter(l => !deletedUsers.includes(l.id));
  }

  private ensureActiveLocationExists(userId: string, locationsList: ActiveLocation[]): number {
    let index = locationsList.findIndex((l: ActiveLocation) => l.id === userId);
    if (index === -1) {
      const user = this.getUsers().find(u => u.id === userId);
      if (user) {
        const newLoc: ActiveLocation = {
          id: userId,
          name: user.name,
          role: user.role as 'driver' | 'dispatcher',
          latitude: LOCATIONS['770'].latitude,
          longitude: LOCATIONS['770'].longitude,
          status: 'idle',
          updatedAt: new Date().toISOString()
        };
        locationsList.push(newLoc);
        index = locationsList.length - 1;
      }
    }
    return index;
  }

  public async updateActiveLocation(userId: string, lat: number, lng: number, driverFields?: Partial<Pick<ActiveLocation, 'status' | 'direction' | 'etaMinutes' | 'speedWarning'>>) {
    // 1. Resolve ETA dynamically if driver is en_route
    let finalFields: any = { ...driverFields, isSimulated: false };
    const locations = this.getActiveLocations();
    const loc = locations.find(l => l.id === userId);
    
    if (loc && loc.role === 'driver') {
      const status = finalFields.status || loc.status;
      const direction = finalFields.direction !== undefined ? finalFields.direction : loc.direction;
      if (status === 'en_route' && direction) {
        // Preserving the initial scan-time calculated ETA to eliminate jumping and API overuse
        if (loc.etaMinutes !== undefined) {
          finalFields.etaMinutes = loc.etaMinutes;
          finalFields.scannedAt = loc.scannedAt || new Date().toISOString();
        } else {
          const computedEta = await this.getRouteEtaMinutes(lat, lng, direction);
          finalFields.etaMinutes = computedEta;
          finalFields.scannedAt = new Date().toISOString();
        }
        finalFields.lastEtaUpdateTime = loc.lastEtaUpdateTime || new Date().toISOString();
      } else {
        finalFields.etaMinutes = undefined;
        finalFields.scannedAt = undefined;
        finalFields.lastEtaUpdateTime = undefined;
      }
    }

    const locationsList = JSON.parse(localStorage.getItem('tp_active_locations') || '[]');
    const index = this.ensureActiveLocationExists(userId, locationsList);
    if (index >= 0) {
      locationsList[index] = {
        ...locationsList[index],
        latitude: lat,
        longitude: lng,
        updatedAt: new Date().toISOString(),
        ...finalFields
      };
      localStorage.setItem('tp_active_locations', JSON.stringify(locationsList));
      this.activeLocationsCache = locationsList;
      this.notify();
      
      // Sync location state to Google Sheets on status changes
      if (driverFields?.status || driverFields?.direction) {
        this.syncToGoogleSheets('syncLocation', locationsList[index]);
      }
    }
  }

  public async updateDriverTripState(driverId: string, status: DriverStatus, direction: Direction) {
    let lat = 0;
    let lng = 0;
    
    if (status === 'en_route' && direction) {
      const start = direction === 'to_ohel' ? LOCATIONS['770'] : LOCATIONS['Ohel'];
      lat = start.latitude;
      lng = start.longitude;
    }

    const computedEta = (status === 'en_route' && direction) ? await this.getRouteEtaMinutes(lat, lng, direction) : undefined;

    const locations = JSON.parse(localStorage.getItem('tp_active_locations') || '[]');
    const index = this.ensureActiveLocationExists(driverId, locations);
    if (index >= 0) {
      locations[index].status = status;
      locations[index].direction = direction;
      (locations[index] as any).isSimulated = true; // reset simulated flag
      if (status === 'en_route' && direction && computedEta !== undefined) {
        const start = direction === 'to_ohel' ? LOCATIONS['770'] : LOCATIONS['Ohel'];
        locations[index].latitude = start.latitude;
        locations[index].longitude = start.longitude;
        locations[index].etaMinutes = computedEta;
        locations[index].etaHistory = [computedEta];
        locations[index].scannedAt = new Date().toISOString();
        locations[index].lastEtaUpdateTime = new Date().toISOString();
      } else {
        locations[index].direction = null;
        locations[index].etaMinutes = undefined;
        locations[index].etaHistory = undefined;
        locations[index].scannedAt = undefined;
        locations[index].lastEtaUpdateTime = undefined;
      }
      locations[index].updatedAt = new Date().toISOString();
      localStorage.setItem('tp_active_locations', JSON.stringify(locations));
      this.activeLocationsCache = locations;
      this.notify();
      
      // Sync in background with force: true to bypass stale-state Apps Script locks
      this.syncToGoogleSheets('syncLocation', { ...locations[index], force: true });
    }
  }

  public async updateDriverEta(driverId: string, etaMinutes: number) {
    const locations = JSON.parse(localStorage.getItem('tp_active_locations') || '[]');
    const index = locations.findIndex((l: ActiveLocation) => l.id === driverId);
    if (index >= 0) {
      locations[index].etaMinutes = etaMinutes;
      locations[index].etaHistory = [etaMinutes];
      locations[index].updatedAt = new Date().toISOString();
      localStorage.setItem('tp_active_locations', JSON.stringify(locations));
      this.activeLocationsCache = locations;
      this.notify();
      
      // Sync in background
      this.syncToGoogleSheets('syncLocation', locations[index]);
    }
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

  // --- GPS Driving Simulation Engine ---
  private startSimulation() {
    setInterval(async () => {
      const locations = this.getActiveLocations();
      let changed = false;

      for (const loc of locations) {
        // Only run simulation for drivers marked as simulated (default ones, until a real device takes over)
        if (loc.role === 'driver' && loc.status === 'en_route' && loc.direction && (loc as any).isSimulated !== false) {
          const end = loc.direction === 'to_ohel' ? LOCATIONS['Ohel'] : LOCATIONS['770'];

          const latDiff = end.latitude - loc.latitude;
          const lngDiff = end.longitude - loc.longitude;
          const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

          const updatedFields: any = {};

          if (distance < 0.005) {
            updatedFields.status = 'idle';
            updatedFields.direction = null;
            updatedFields.etaMinutes = null;
            updatedFields.latitude = end.latitude + (Math.random() - 0.5) * 0.001;
            updatedFields.longitude = end.longitude + (Math.random() - 0.5) * 0.001;
            updatedFields.speedWarning = false;
          } else {
            const speedFactor = 0.04 + Math.random() * 0.02;
            let newLat = loc.latitude + latDiff * speedFactor + (Math.random() - 0.5) * 0.0001;
            let newLng = loc.longitude + lngDiff * speedFactor + (Math.random() - 0.5) * 0.0001;

            const totalSpan = Math.sqrt(
              Math.pow(LOCATIONS['770'].latitude - LOCATIONS['Ohel'].latitude, 2) +
              Math.pow(LOCATIONS['770'].longitude - LOCATIONS['Ohel'].longitude, 2)
            );
            const ratioLeft = distance / totalSpan;
            
            updatedFields.latitude = newLat;
            updatedFields.longitude = newLng;
            updatedFields.etaMinutes = Math.max(1, Math.round(ratioLeft * 25));

            if (Math.random() < 0.08) {
              updatedFields.speedWarning = !loc.speedWarning;
            }
          }
          
          updatedFields.updatedAt = new Date().toISOString();
          
          // Local sync
          const index = locations.findIndex((l: ActiveLocation) => l.id === loc.id);
          if (index >= 0) {
            locations[index] = { ...locations[index], ...updatedFields };
          }
          changed = true;
        }
      }

      if (changed) {
        localStorage.setItem('tp_active_locations', JSON.stringify(locations));
        this.activeLocationsCache = locations;
        this.notify();
      }
    }, 4000);
  }

  public async triggerSOS(driverId: string) {
    const locations = this.getActiveLocations();
    const loc = locations.find(l => l.id === driverId);
    if (!loc) return;

    const isSOSNow = !(loc as any).sosAlert;

    if (isSOSNow) {
      // Trigger real-time SMS to manager
      const config = this.getConfig() as any;
      const recipient = config.twilioRecipientSms || config.reportEmail;
      if (recipient) {
        const sosText = `🚨 התראת SOS במערכת אוהל בוס! 🚨\nהנהג ${loc.name.replace(' (נהג)', '')} הפעיל קריאת חירום דחופה! מיקום נוכחי: https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
        this.sendSMS(recipient, sosText);
      }
    }

    const index = locations.findIndex((l: ActiveLocation) => l.id === driverId);
    if (index >= 0) {
      (locations[index] as any).sosAlert = isSOSNow;
      locations[index].updatedAt = new Date().toISOString();
      localStorage.setItem('tp_active_locations', JSON.stringify(locations));
      this.activeLocationsCache = locations;
      this.notify();
      
      // Sync in background
      this.syncToGoogleSheets('syncLocation', locations[index]);
    }
  }

  public getSOSAlerts(): { id: string; name: string; latitude: number; longitude: number }[] {
    const locations = this.getActiveLocations();
    return locations
      .filter((l: any) => l.sosAlert)
      .map(l => ({ id: l.id, name: l.name, latitude: l.latitude, longitude: l.longitude }));
  }

  public async clearSOSAlert(driverId: string) {
    const locations = this.getActiveLocations();
    const loc = locations.find(l => l.id === driverId);
    if (loc) {
      const config = this.getConfig() as any;
      const recipient = config.twilioRecipientSms || config.reportEmail;
      if (recipient) {
        this.sendSMS(recipient, `✅ קריאת החירום (SOS) עבור הנהג ${loc.name.replace(' (נהג)', '')} בוטלה.`);
      }
    }

    const index = locations.findIndex(l => l.id === driverId);
    if (index >= 0) {
      (locations[index] as any).sosAlert = false;
      locations[index].updatedAt = new Date().toISOString();
      localStorage.setItem('tp_active_locations', JSON.stringify(locations));
      this.activeLocationsCache = locations;
      this.notify();
      
      // Sync in background
      this.syncToGoogleSheets('syncLocation', locations[index]);
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
