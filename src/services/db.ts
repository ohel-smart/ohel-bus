import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, 
  updateDoc, deleteDoc, onSnapshot, query, 
  Firestore
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

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
}

export interface GlobalConfig {
  reportEmail: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Coordinates
export const LOCATIONS = {
  '770': { latitude: 40.6690, longitude: -73.9429, name: '770 (קראון הייטס)' },
  'Ohel': { latitude: 40.7061, longitude: -73.7291, name: 'אוהל חב"ד (קווינס)' }
};

// Default Pre-Populated Users
const DEFAULT_USERS: User[] = [
  { id: 'usr_admin', name: 'מנהל', phone: '050-770-7700', role: 'admin', code: '770', createdAt: new Date().toISOString() },
  { id: 'drv_777', name: 'נהג 777 (נהג)', phone: '050-777-7777', role: 'driver', code: '777', createdAt: new Date().toISOString() },
  { id: 'drv_778', name: 'נהג 778 (נהג)', phone: '050-778-7788', role: 'driver', code: '778', createdAt: new Date().toISOString() },
  { id: 'disp_1000', name: 'סדרן 1000 (סדרן)', phone: '050-100-1000', role: 'dispatcher', code: '1000', createdAt: new Date().toISOString() }
];

class DBService {
  private listeners: Set<() => void> = new Set();
  private firebaseDb: Firestore | null = null;
  private firebaseUnsubscribes: Unsubscribe[] = [];
  
  // Local cache when Firebase is active
  private usersCache: User[] = [];
  private scansCache: Scan[] = [];
  private activeLocationsCache: ActiveLocation[] = [];
  private configCache: GlobalConfig = { reportEmail: 'manager@transit.pro' };

  constructor() {
    this.initDatabase();
    this.initFirebase();
    this.startSimulation();
  }

  private initDatabase() {
    const rawUsers = localStorage.getItem('tp_users');
    let needsReset = false;
    if (rawUsers) {
      try {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed) && parsed.length > 0 && !parsed[0].code) {
          needsReset = true;
        }
      } catch (e) {
        needsReset = true;
      }
    }

    let users = DEFAULT_USERS;
    if (rawUsers && !needsReset) {
      try {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed)) {
          const userMap = new Map(parsed.map(u => [u.id, u]));
          DEFAULT_USERS.forEach(u => {
            if (!userMap.has(u.id)) {
              userMap.set(u.id, u);
            }
          });
          users = Array.from(userMap.values());
        }
      } catch (e) {}
    }
    localStorage.setItem('tp_users', JSON.stringify(users));

    let locations = this.getInitialActiveLocations();
    const rawLocs = localStorage.getItem('tp_active_locations');
    if (rawLocs) {
      try {
        const parsed = JSON.parse(rawLocs);
        if (Array.isArray(parsed)) {
          const locMap = new Map(parsed.map(l => [l.id, l]));
          this.getInitialActiveLocations().forEach(l => {
            if (!locMap.has(l.id)) {
              locMap.set(l.id, l);
            }
          });
          locations = Array.from(locMap.values());
        }
      } catch (e) {}
    }
    localStorage.setItem('tp_active_locations', JSON.stringify(locations));

    if (!localStorage.getItem('tp_scans')) {
      localStorage.setItem('tp_scans', JSON.stringify([]));
    }
    if (!localStorage.getItem('tp_offline_scans')) {
      localStorage.setItem('tp_offline_scans', JSON.stringify([]));
    }
    if (!localStorage.getItem('tp_config')) {
      const defaultConfig: GlobalConfig = { reportEmail: 'manager@transit.pro' };
      localStorage.setItem('tp_config', JSON.stringify(defaultConfig));
    }
    if (localStorage.getItem('tp_is_offline') === null) {
      localStorage.setItem('tp_is_offline', 'false');
    }
    
    // Load local caches initially
    this.usersCache = JSON.parse(localStorage.getItem('tp_users') || '[]');
    this.scansCache = JSON.parse(localStorage.getItem('tp_scans') || '[]');
    this.activeLocationsCache = JSON.parse(localStorage.getItem('tp_active_locations') || '[]');
    this.configCache = JSON.parse(localStorage.getItem('tp_config') || '{"reportEmail": "manager@transit.pro"}');
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
        updatedAt: now
      },
      {
        id: 'drv_778',
        name: 'נהג 778',
        role: 'driver',
        latitude: LOCATIONS['770'].latitude,
        longitude: LOCATIONS['770'].longitude,
        status: 'idle',
        updatedAt: now
      }
    ];
  }

  // --- Firebase Cloud Connection ---
  public getFirebaseConfig(): FirebaseConfig | null {
    // Unconditionally use the default Firebase configuration for ohel-smart
    return {
      apiKey: "AIzaSyB6D83wnOoA8oLWn5SFzIIpcbb-f454kDo",
      authDomain: "ohel-smart.firebaseapp.com",
      projectId: "ohel-smart",
      storageBucket: "ohel-smart.firebasestorage.app",
      messagingSenderId: "48634858514",
      appId: "1:48634858514:web:94bffc06fc42a1a2cb5ccb"
    };
  }

  public saveFirebaseConfig(config: FirebaseConfig | null) {
    if (config) {
      localStorage.setItem('tp_firebase_config', JSON.stringify(config));
    } else {
      localStorage.setItem('tp_firebase_config', 'disabled');
    }
    
    // Terminate old listeners and reload app
    this.disconnectFirebase();
    this.initFirebase();
    this.notify();
  }

  public isFirebaseConnected(): boolean {
    return this.firebaseDb !== null;
  }

  private initFirebase() {
    const config = this.getFirebaseConfig();
    if (!config) return;

    try {
      // Initialize Firebase App
      const app = getApps().length === 0 ? initializeApp(config) : getApp();
      const db = getFirestore(app);
      this.firebaseDb = db;

      // 1. Subscribe to users collection
      const usersQuery = query(collection(db, 'users'));
      const unsubUsers = onSnapshot(usersQuery, (snapshot: any) => {
        const usersList: User[] = [];
        snapshot.forEach((doc: any) => {
          usersList.push(doc.data() as User);
        });
        
        // If collection in cloud is completely empty, upload default users
        if (usersList.length === 0) {
          this.uploadDefaultDataToFirebase(db);
        } else {
          this.usersCache = usersList;
          localStorage.setItem('tp_users', JSON.stringify(usersList));
          this.notify();
        }
      }, (error: any) => {
        console.error("Firebase users listener error:", error);
      });
      this.firebaseUnsubscribes.push(unsubUsers);

      // 2. Subscribe to scans collection
      const scansQuery = query(collection(db, 'scans'));
      const unsubScans = onSnapshot(scansQuery, (snapshot: any) => {
        const scansList: Scan[] = [];
        snapshot.forEach((doc: any) => {
          scansList.push(doc.data() as Scan);
        });
        this.scansCache = scansList;
        localStorage.setItem('tp_scans', JSON.stringify(scansList));
        this.notify();
      });
      this.firebaseUnsubscribes.push(unsubScans);

      // 3. Subscribe to active locations collection
      const locQuery = query(collection(db, 'active_locations'));
      const unsubLoc = onSnapshot(locQuery, (snapshot: any) => {
        const locList: ActiveLocation[] = [];
        snapshot.forEach((doc: any) => {
          locList.push(doc.data() as ActiveLocation);
        });
        this.activeLocationsCache = locList;
        localStorage.setItem('tp_active_locations', JSON.stringify(locList));
        this.notify();
      });
      this.firebaseUnsubscribes.push(unsubLoc);

      // 4. Subscribe to settings collection
      const configQuery = query(collection(db, 'settings'));
      const unsubConfig = onSnapshot(configQuery, (snapshot: any) => {
        snapshot.forEach((doc: any) => {
          if (doc.id === 'global_config') {
            this.configCache = doc.data() as GlobalConfig;
            localStorage.setItem('tp_config', JSON.stringify(this.configCache));
            this.notify();
          }
        });
      });
      this.firebaseUnsubscribes.push(unsubConfig);

    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      this.firebaseDb = null;
    }
  }

  private disconnectFirebase() {
    this.firebaseUnsubscribes.forEach(unsub => {
      try {
        unsub();
      } catch (e) {}
    });
    this.firebaseUnsubscribes = [];
    this.firebaseDb = null;
    
    // Reload local storage cache
    this.initDatabase();
  }

  private async uploadDefaultDataToFirebase(db: any) {
    // Write defaults to Firebase on first connection
    try {
      const localUsers: User[] = JSON.parse(localStorage.getItem('tp_users') || JSON.stringify(DEFAULT_USERS));
      const localLocations: ActiveLocation[] = JSON.parse(localStorage.getItem('tp_active_locations') || JSON.stringify(this.getInitialActiveLocations()));
      const localConfig: GlobalConfig = JSON.parse(localStorage.getItem('tp_config') || '{"reportEmail": "manager@transit.pro"}');
      const localScans: Scan[] = JSON.parse(localStorage.getItem('tp_scans') || '[]');

      // Upload users
      for (const u of localUsers) {
        await setDoc(doc(db, 'users', u.id), u);
      }
      // Upload active locations
      for (const loc of localLocations) {
        await setDoc(doc(db, 'active_locations', loc.id), loc);
      }
      // Upload settings
      await setDoc(doc(db, 'settings', 'global_config'), localConfig);
      
      // Upload scans
      for (const scan of localScans) {
        await setDoc(doc(db, 'scans', scan.id), scan);
      }
    } catch (e) {
      console.error("Error uploading defaults to Firebase:", e);
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
      if (this.firebaseDb) {
        // Real cloud write
        for (const scan of offlineScans) {
          try {
            await setDoc(doc(this.firebaseDb, 'scans', scan.id), scan);
          } catch (e) {
            console.error("Sync to cloud error:", e);
          }
        }
      } else {
        // Local storage write
        const scans = this.getScans();
        localStorage.setItem('tp_scans', JSON.stringify([...scans, ...offlineScans]));
      }
      
      localStorage.setItem('tp_offline_scans', JSON.stringify([]));
      this.notify();
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
    return this.usersCache;
  }

  public async saveUser(user: User) {
    // 1. Update local storage and cache immediately so the change is instantaneous
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

    // 2. Sync with Firebase in the background
    if (this.firebaseDb) {
      try {
        await setDoc(doc(this.firebaseDb, 'users', user.id), user);
        
        if (user.role === 'driver' || user.role === 'dispatcher') {
          const locDoc: ActiveLocation = {
            id: user.id,
            name: user.name.replace(' (נהג)', '').replace(' (סדרן)', '').replace(' (מנהל)', ''),
            role: user.role as 'driver' | 'dispatcher',
            latitude: LOCATIONS['770'].latitude,
            longitude: LOCATIONS['770'].longitude,
            status: user.role === 'driver' ? 'idle' : undefined,
            updatedAt: new Date().toISOString()
          };
          await setDoc(doc(this.firebaseDb, 'active_locations', user.id), locDoc);
        } else {
          await deleteDoc(doc(this.firebaseDb, 'active_locations', user.id));
        }
      } catch (e) {
        console.error("Firebase save user error:", e);
      }
    }
  }

  public async deleteUser(userId: string) {
    // 1. Update local storage and cache immediately so the change is instantaneous
    let users = JSON.parse(localStorage.getItem('tp_users') || '[]');
    users = users.filter((u: User) => u.id !== userId);
    localStorage.setItem('tp_users', JSON.stringify(users));
    this.usersCache = users;

    let locations = this.getActiveLocations();
    locations = locations.filter(l => l.id !== userId);
    localStorage.setItem('tp_active_locations', JSON.stringify(locations));
    this.activeLocationsCache = locations;

    this.notify();

    // 2. Sync with Firebase in the background
    if (this.firebaseDb) {
      try {
        await deleteDoc(doc(this.firebaseDb, 'users', userId));
        await deleteDoc(doc(this.firebaseDb, 'active_locations', userId));
      } catch (e) {
        console.error("Firebase delete user error:", e);
      }
    }
  }

  // --- Scans CRUD ---
  public getScans(): Scan[] {
    return this.scansCache;
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
    } else if (this.firebaseDb) {
      try {
        await setDoc(doc(this.firebaseDb, 'scans', newScan.id), newScan);
      } catch (e) {
        console.error("Firebase write scan error:", e);
      }
    } else {
      const scans = JSON.parse(localStorage.getItem('tp_scans') || '[]');
      scans.push(newScan);
      localStorage.setItem('tp_scans', JSON.stringify(scans));
      this.scansCache = scans;
    }

    // Trigger driver driving simulation to the opposite location of departure
    const targetDirection: Direction = scanData.departureLocation === '770' ? 'to_ohel' : 'to_770';
    this.updateDriverTripState(scanData.driverId, 'en_route', targetDirection);

    this.notify();
    return newScan;
  }

  public async updateScan(updatedScan: Scan) {
    const freshScan = {
      ...updatedScan,
      remainingSeats: Math.max(0, updatedScan.driverCapacity - updatedScan.passengersCount)
    };

    if (this.firebaseDb) {
      try {
        await setDoc(doc(this.firebaseDb, 'scans', freshScan.id), freshScan);
      } catch (e) {
        console.error("Firebase update scan error:", e);
      }
    } else {
      const scans = JSON.parse(localStorage.getItem('tp_scans') || '[]');
      const index = scans.findIndex((s: Scan) => s.id === freshScan.id);
      if (index >= 0) {
        scans[index] = freshScan;
        localStorage.setItem('tp_scans', JSON.stringify(scans));
        this.scansCache = scans;
        this.notify();
      }
    }
  }

  public async deleteScan(scanId: string) {
    if (this.firebaseDb) {
      try {
        await deleteDoc(doc(this.firebaseDb, 'scans', scanId));
      } catch (e) {
        console.error("Firebase delete scan error:", e);
      }
    } else {
      let scans = JSON.parse(localStorage.getItem('tp_scans') || '[]');
      scans = scans.filter((s: Scan) => s.id !== scanId);
      localStorage.setItem('tp_scans', JSON.stringify(scans));
      this.scansCache = scans;
      this.notify();
    }
  }

  // --- Active Locations ---
  public getActiveLocations(): ActiveLocation[] {
    return this.activeLocationsCache;
  }

  public async updateActiveLocation(userId: string, lat: number, lng: number, driverFields?: Partial<Pick<ActiveLocation, 'status' | 'direction' | 'etaMinutes' | 'speedWarning'>>) {
    if (this.firebaseDb) {
      try {
        const updateData: any = {
          latitude: lat,
          longitude: lng,
          updatedAt: new Date().toISOString(),
          ...driverFields
        };
        await updateDoc(doc(this.firebaseDb, 'active_locations', userId), updateData);
      } catch (e) {
        console.error("Firebase update location error:", e);
      }
    } else {
      const locations = JSON.parse(localStorage.getItem('tp_active_locations') || '[]');
      const index = locations.findIndex((l: ActiveLocation) => l.id === userId);
      if (index >= 0) {
        locations[index] = {
          ...locations[index],
          latitude: lat,
          longitude: lng,
          updatedAt: new Date().toISOString(),
          ...driverFields
        };
        localStorage.setItem('tp_active_locations', JSON.stringify(locations));
        this.activeLocationsCache = locations;
        this.notify();
      }
    }
  }

  public async updateDriverTripState(driverId: string, status: DriverStatus, direction: Direction) {
    if (this.firebaseDb) {
      try {
        let lat = 0;
        let lng = 0;
        let hasLocation = false;
        
        if (status === 'en_route' && direction) {
          const start = direction === 'to_ohel' ? LOCATIONS['770'] : LOCATIONS['Ohel'];
          lat = start.latitude;
          lng = start.longitude;
          hasLocation = true;
        }

        const updateData: any = {
          status,
          direction: direction || null,
          etaMinutes: status === 'en_route' ? 25 : null,
          updatedAt: new Date().toISOString()
        };
        
        if (hasLocation) {
          updateData.latitude = lat;
          updateData.longitude = lng;
        }

        await updateDoc(doc(this.firebaseDb, 'active_locations', driverId), updateData);
      } catch (e) {
        console.error("Firebase update driver state error:", e);
      }
    } else {
      const locations = JSON.parse(localStorage.getItem('tp_active_locations') || '[]');
      const index = locations.findIndex((l: ActiveLocation) => l.id === driverId);
      if (index >= 0) {
        locations[index].status = status;
        locations[index].direction = direction;
        if (status === 'en_route' && direction) {
          const start = direction === 'to_ohel' ? LOCATIONS['770'] : LOCATIONS['Ohel'];
          locations[index].latitude = start.latitude;
          locations[index].longitude = start.longitude;
          locations[index].etaMinutes = 25;
        } else {
          locations[index].direction = null;
          locations[index].etaMinutes = undefined;
        }
        locations[index].updatedAt = new Date().toISOString();
        localStorage.setItem('tp_active_locations', JSON.stringify(locations));
        this.activeLocationsCache = locations;
        this.notify();
      }
    }
  }

  // --- Global Settings ---
  public getConfig(): GlobalConfig {
    return this.configCache;
  }

  public async saveConfig(config: GlobalConfig) {
    if (this.firebaseDb) {
      try {
        await setDoc(doc(this.firebaseDb, 'settings', 'global_config'), config);
      } catch (e) {
        console.error("Firebase save config error:", e);
      }
    } else {
      localStorage.setItem('tp_config', JSON.stringify(config));
      this.configCache = config;
      this.notify();
    }
  }

  public async sendEmail(to: string, subject: string, html: string) {
    if (this.firebaseDb) {
      try {
        const mailCol = collection(this.firebaseDb, 'mail');
        const newMailDoc = doc(mailCol);
        await setDoc(newMailDoc, {
          to: to,
          message: {
            subject: subject,
            html: html
          },
          createdAt: new Date().toISOString()
        });
        console.log("Email queued in Firestore successfully.");
      } catch (e) {
        console.error("Firebase sendEmail error:", e);
      }
    }
  }

  // --- GPS Driving Simulation Engine ---
  private startSimulation() {
    setInterval(async () => {
      const locations = this.getActiveLocations();
      let changed = false;

      for (const loc of locations) {
        if (loc.role === 'driver' && loc.status === 'en_route' && loc.direction) {
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
          
          if (this.firebaseDb) {
            try {
              await updateDoc(doc(this.firebaseDb, 'active_locations', loc.id), updatedFields);
            } catch (e) {
              console.error("Firebase simulation sync error:", e);
            }
          } else {
            // Local sync
            const index = locations.findIndex((l: ActiveLocation) => l.id === loc.id);
            if (index >= 0) {
              locations[index] = { ...locations[index], ...updatedFields };
            }
            changed = true;
          }
        }
      }

      if (changed && !this.firebaseDb) {
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

    if (this.firebaseDb) {
      try {
        await updateDoc(doc(this.firebaseDb, 'active_locations', driverId), {
          sosAlert: isSOSNow,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("Firebase trigger SOS error:", e);
      }
    } else {
      const index = locations.findIndex((l: ActiveLocation) => l.id === driverId);
      if (index >= 0) {
        (locations[index] as any).sosAlert = isSOSNow;
        locations[index].updatedAt = new Date().toISOString();
        localStorage.setItem('tp_active_locations', JSON.stringify(locations));
        this.activeLocationsCache = locations;
        this.notify();
      }
    }
  }

  public getSOSAlerts(): { id: string; name: string; latitude: number; longitude: number }[] {
    const locations = this.getActiveLocations();
    return locations
      .filter((l: any) => l.sosAlert)
      .map(l => ({ id: l.id, name: l.name, latitude: l.latitude, longitude: l.longitude }));
  }

  public async clearSOSAlert(driverId: string) {
    if (this.firebaseDb) {
      try {
        await updateDoc(doc(this.firebaseDb, 'active_locations', driverId), {
          sosAlert: false,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("Firebase clear SOS error:", e);
      }
    } else {
      const locations = this.getActiveLocations();
      const index = locations.findIndex(l => l.id === driverId);
      if (index >= 0) {
        delete (locations[index] as any).sosAlert;
        locations[index].updatedAt = new Date().toISOString();
        localStorage.setItem('tp_active_locations', JSON.stringify(locations));
        this.activeLocationsCache = locations;
        this.notify();
      }
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
}

export const dbService = new DBService();
export default dbService;
