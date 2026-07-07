import { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  MapPin, Users, Calendar, WifiOff, Settings, QrCode, LogOut, 
  Plus, Trash, Edit, Search, AlertTriangle, Clock, Send, CheckCircle, 
  RefreshCw, ShieldAlert, FileText, UserCheck, AlertOctagon,
  Mail, Download, Copy, MessageSquare, Navigation, Map
} from 'lucide-react';
import dbService, { LOCATIONS } from './services/db';
import type { User, Scan, ActiveLocation, DepartureLocation, DriverStatus, Direction } from './services/db';
import LiveMap from './components/LiveMap';
import { Html5Qrcode } from 'html5-qrcode';
import logo from './assets/logo.png';
import './App.css';

const TRANSLATIONS = {
  he: {
    title: 'מערכת אוהל בוס',
    subtitle: 'מערכת שליטה מבוססת ענן לניהול, סריקה ומעקב GPS חי.',
    enterCode: 'הזן את קוד הכניסה האישי שלך כדי להתחבר:',
    codeLabel: 'קוד כניסה אישי',
    connectButton: 'התחבר למערכת',
    logout: 'התנתקות',
    dispatcherTitle: 'סדרן שטח פעיל',
    registerTrip: 'רישום נסיעה (סריקה מהשטח)',
    driverLabel: 'נהג הסעה',
    selectDriver: '-- בחר נהג שעולה --',
    passengersLabel: 'מספר נוסעים שעלו',
    reset: 'אפס',
    manualGpsLabel: 'נקודת מוצא (מנוע GPS מזהה אוטומטית)',
    submitScan: 'אישור ורישום נסיעה',
    cameraScan: 'סרוק קוד QR במצלמה',
    cameraScanActive: 'סורק QR במצלמה פעיל',
    closeCamera: 'סגור מצלמה',
    departureFeed: 'לוח יציאות חי',
    noScansToday: 'אין נסיעות מתועדות להיום',
    myScansToday: 'היסטוריית סריקות אישית להיום',
    time: 'שעה',
    driver: 'נהג',
    passengers: 'נוסעים',
    status: 'סטטוס',
    remainingSeats: 'נותרו {count} מקומות פנויים',
    shuttleFull: 'הסעה מלאה 🔴',
    driverTitle: 'נהג הסעה פעיל',
    yourQr: 'קוד ה-QR האישי שלך',
    scanGuidance: 'הצג קוד QR זה לסדרן בשטח בעת ההעמסה.',
    scanGuidance2: 'הסריקה תרשום את היציאה, כמות הנוסעים ומיקומך ב-GPS.',
    updateStatus: 'עדכן סטטוס פעילות נוכחי:',
    myTripsTodayTitle: 'הנסיעות שלי היום (סיכום אישי)',
    totalTrips: 'סה"כ נסיעות',
    totalPassengers: 'סה"כ נוסעים',
    noTripsRecorded: 'אין נסיעות מוקלטות עבורך היום',
    departure: 'מוצא',
    managerTitle: 'מנהל',
    managerDashboard: 'מפת מעקב וסטטיסטיקה',
    fleetActivity: 'כלל הפעילות בשטח',
    usersManagement: 'ניהול משתמשים',
    settings: 'הגדרות וחיבור ענן',
    managerWelcome: 'ברוך הבא, מנהל',
    todaySummary: 'סיכום יומי מרוכז',
    activeDrivers: 'נהגים פעילים',
    activeDispatchers: 'סדרנים פעילים',
    sosAlerts: 'התראות SOS פעילות',
    sosTitle: 'קריאות מצוקה:',
    clearAlert: 'ביטול התראה',
    fleetMap: 'מפת מעקב חי - GPS Fleet Tracking',
    fleetStatus: 'סטטוס פעילות צי רכבים',
    managerScansTitle: 'יומן יציאות וסריקות שטח',
    managerScansSub: 'רשימת כלל הסריקות, עריכת רשומות, ונוכחות סדרנים',
    searchPlaceholder: 'חיפוש חופשי (נהג, סדרן, מוצא)...',
    clearDate: 'נקה תאריך',
    actions: 'פעולות',
    editScanTitle: 'עריכת פרטי נסיעה',
    save: 'שמור',
    cancel: 'ביטול',
    dispatcherAttendance: 'שעון נוכחות סדרנים ושעות עבודה',
    dispatcherAttendanceSub: 'שעות כניסה ויציאה חודשיות לפי ימי עבודה לוגיים',
    firstScan: 'סריקה ראשונה',
    lastScan: 'סריקה אחרונה',
    totalHours: 'סך שעות מחושב',
    scansCount: 'נסיעות שסרק',
    addUser: 'הוספת משתמש חדש לצי',
    userName: 'שם המשתמש',
    namePlaceholder: 'שם פרטי / מלא',
    phoneLabel: 'מספר טלפון',
    phonePlaceholder: '050-123-4567',
    passcodeLabel: 'קוד כניסה ייחודי',
    userRole: 'תפקיד במערכת',
    roleDriver: 'נהג (הסעות)',
    roleDispatcher: 'סדרן (שטח)',
    roleAdmin: 'מנהל (פיקוח)',
    capacityLabel: 'קיבולת רכב (מספר מושבים)',
    createUser: 'צור משתמש חדש',
    usersListTitle: 'סגל סדרנים ונהגים במערכת',
    delete: 'מחק',
    emailConfig: 'הגדרות הפצת דוחות ומיילים',
    emailConfigSub: 'המערכת מפיקה סיכומים ושולחת אותם אוטומטית לקובץ תפוצה מוגדר מראש:',
    dailySummaryCron: 'דו"ח יומי מרוכז בכל לילה בשעה 00:00.',
    monthlySummaryCron: 'דו"ח שעות סדרנים חודשי ב-1 לכל חודש ב-08:00 בבוקר.',
    managerEmail: 'כתובת מייל להפצה (מנהל)',
    saveConfig: 'שמור הגדרות הפצה',
    simulateReports: 'סימולטור שליחת דוחות (דמו במייל)',
    simulateReportsSub: 'הפקת סימולציית דו"ח מרוכז המעוצב לתיבת הדואר של המנהל',
    previewDaily: 'תצוגה מקדימה דו"ח יומי',
    previewMonthly: 'תצוגה מקדימה דו"ח חודשי',
    firebaseSettings: 'הגדרות חיבור ענן (Firebase Cloud Real-Time)',
    firebaseSub: 'חיבור האפליקציה למסד הנתונים Firestore בענן. מאפשר סנכרון מלא של מיקומי GPS וסריקות בין כל המכשירים.',
    saveFirebase: 'שמור ופתח חיבור לענן',
    disconnectFirebase: 'נתק חיבור ענן',
    connectedUser: 'משתמש מחובר',
    
    // New Keys
    welcomeUser: 'ברוך הבא, {name}!',
    loginError: 'קוד כניסה שגוי. אנא נסה שנית.',
    enterPasscode: 'נא להזין קוד כניסה',
    logoutSuccess: 'התנתקת מהמערכת בהצלחה',
    offlineNotice: 'המכשיר עבר למצב אופליין (ללא קליטה). סריקות יישמרו מקומית.',
    onlineNotice: 'החיבור חזר! כל הסריקות שנעשו אופליין סונכרנו בהצלחה לענן.',
    selectDriverError: 'נא לבחור נהג לסריקה',
    passengersError: 'נא להזין מספר נוסעים תקין',
    scanSuccess: 'הסריקה בוצעה בהצלחה ע"י {dispatcher} עבור הנהג {driver}',
    statusUpdated: 'הסטטוס שלך עודכן ל: {status}',
    sosTriggered: 'קריאת SOS שודרה למנהל! מיקומך מהבהב באדום.',
    sosCancelled: 'קריאת SOS בוטלה',
    scanUpdated: 'הסריקה עודכנה בהצלחה',
    confirmDeleteScan: 'האם אתה בטוח שברצונך למחוק שורה זו?',
    scanDeleted: 'הסריקה נמחקה מהמערכת',
    fillAllFields: 'נא למלא את כל השדות',
    codeDuplicate: 'הקוד שהזנת כבר בשימוש ע"י משתמש אחר במערכת',
    userCreatedText: 'המשתמש {name} נוצר בהצלחה!',
    cannotDeleteAdmin: 'אין אפשרות למחוק את מנהל המערכת הראשי',
    confirmDeleteUser: 'האם למחוק משתמש זה לצמיתות מהמערכת?',
    userDeleted: 'המשתמש נמחק מהמערכת',
    emailUpdated: 'כתובת המייל להפצה עודכנה בהצלחה',
    firebaseConfigRequired: 'נא למלא את שדות החובה של תצורת Firebase',
    firebaseConfigSaved: 'חיבור הענן של Firebase נשמר! המערכת מסתנכרנת כעת...',
    confirmDisconnectFirebase: 'האם להתנתק ממסד הנתונים בענן של Firebase ולחזור למצב מקומי?',
    firebaseDisconnected: 'החיבור לענן נותק. המערכת חזרה למצב מקומי (Sandbox)',
    mockEmailSent: 'הדו"ח המעוצב נשלח בהצלחה לכתובת המנהל: {email}',
    externalQrSuccess: 'נקלט קוד QR נהג בהצלחה מחיבור חיצוני!',
    
    statusIdle: 'הסעה לא זמינה',
    statusEnRoute: 'בנסיעה',
    statusBreak: 'הפסקה',

    gpsDetectedOrigin: 'מוצא מזהה GPS',
    dispatcherGps: 'GPS סדרן:',
    near770: 'קרוב ל-770',
    nearOhel: 'קרוב לאוהל',
    realGps: 'GPS אמיתי',
    signal: 'קליטה:',
    offline: 'מנותק',
    online: 'מחובר',
    offlineActiveWarning: 'מצב אופליין פעיל! הסריקות יישמרו מקומית ({count} ממתינים)',
    backToAutoGps: 'חזור לזיהוי GPS אוטומטי ({loc})',
    saveAndSendScan: 'שמור ושלח סריקה',
    myScansTodayTitle: 'הסריקות שביצעת היום',
    logicalDateLabel: 'תאריך לוגי: {date}',
    scannedTrips: 'הסעות שסרקת',
    totalBoardedPassengers: 'סך נוסעים שהעלית',
    noScansTodayField: 'טרם ביצעת סריקות היום.',
    scanDriverTab: 'סריקת נהג',
    todayScansCount: 'סריקות היום ({count})',
    driversMapTab: 'מפת נהגים',
    yourPersonalQrTitle: 'קוד ה-QR האישי שלך לסריקה',
    myQrTab: 'קוד QR שלי',
    myTripsCount: 'נסיעות היום ({count})',
    liveGpsStreamTab: 'שידור GPS חי',
    driverTripsCompleted: 'הסעות שביצעת היום',
    driverPassengersTotal: 'נוסעים שהסעת סה"ך',
    driverNoTripsToday: 'לא רשומות נסיעות עבורך היום.',
    departureFrom: 'יציאה מ{loc}',
    departureTimeAndDispatcher: 'שעת יציאה: {time} | סדרן: {dispatcher}',
    resetTimeNotice: 'resets ב-01:00 בלילה',
    managerDashboardTitle: 'לוח בקרה ומעקב צי רכבים',
    managerDashboardSubtitle: 'סקירת סטטוס הסעות ומיקומי נהגים בזמן אמת',
    logicalWorkDateText: 'תאריך עבודה לוגי: {date} ( resets ב-01:00 בלילה )',
    tripsCompletedToday: 'נסיעות שבוצעו היום',
    totalPassengersToday: 'סה"ך נוסעים היום',
    driversActiveToday: 'נהגים פעילים היום',
    dispatchersActiveToday: 'סדרנים פעילים בשטח',
    sosAlertBannerTitle: '🚨 קריאת חירום SOS פעילה בשטח!',
    sosAlertBannerSubtitle: 'הנהג {names} דיווח/ו על עיכוב או בעיה.',
    clearSosForDriverButton: 'אשר וסגור התראה ל-{name}',
    edit: 'ערוך',
    editTripTitle: 'עריכת שורת יציאה',
    editTripSubtitle: 'עריכת סריקה עבור: {driver}',
    editTripMeta: 'סדרן: {dispatcher} בשעה {time}',
    passengersCountLabel: 'מספר נוסעים',
    saveChanges: 'שמור שינויים',
    dispatcherAttendanceHeader: 'שעון נוכחות סדרנים',
    workDate: 'תאריך עבודה',
    fieldDispatcher: 'סדרן שטח',
    firstScanIn: 'סריקה ראשונה (כניסה)',
    lastScanOut: 'סריקה אחרונה (יציאה)',
    totalHoursCalculated: 'סך שעות עבודה מחושב',
    tripsScannedCount: 'נסיעות שסרק',
    noAttendanceData: 'אין נתוני שעות עבודה מוקלטים לסדרנים.',
    tripsCountText: '{count} נסיעות',
    singleTripText: 'נסיעה בודדת',
    adminRole: 'מנהל',
    dispatcherRole: 'סדרן',
    driverRole: 'נהג',
    seatsCountText: '{count} מושבים',
    updateEmailButton: 'עדכן מייל',
    emailReportSimulatorTitle: 'סימולטור שליחת דוחות במייל:',
    showDailyReportButton: 'הצג דו"ח יומי (00:00)',
    showMonthlyReportButton: 'הצג דו"ח חודשי (1 בחודש)',
    firebaseHeader: 'חיבור לענן בזמן אמת (Firebase Firestore)',
    firebaseDesc: 'כדי להפוך את האפליקציה למערכת ענן אמיתית התומכת בסנכרון קבוצתי מלא, באפשרותך להזין תצורת Firebase Web SDK משלך. המערכת תתחבר ישירות ל-Cloud Firestore ותסנכרן את כל הנתונים, ה-GPS והסריקות בין כל המשתמשים במכשירים שונים!',
    firebaseActiveStatus: '🟢 חיבור הענן פעיל ומסונכרן!',
    firebaseConnectedProject: 'פרויקט מחובר: {projectId}',
    firebaseConnectedDesc: 'כל הנתונים מסונכרנים כעת בזמן אמת בשרתי הענן של גוגל.',
    firebaseDisconnectButton: 'נתק חיבור ענן ועבור למצב מקומי (Sandbox)',
    firebaseLocalNotice: '🟡 המערכת פועלת כעת במצב מקומי (LocalStorage Sandbox). הזן תצורה לחיבור ענן:',
    firebaseSaveButton: 'שמור ופתח חיבור לענן (Firebase)',
    emailPreviewTitle: 'תצוגה מקדימה של מייל הדו"ח ({type})',
    dailyReportType: 'דו"ח יומי מרוכז',
    monthlyReportType: 'דו"ח שעות חודשי',
    sendMockEmailButton: 'שלח מייל דמו כעת',
    closeButton: 'סגור',
    timeHeader: 'שעת יציאה',
    logicalDateHeader: 'תאריך לוגי',
    scannerDispatcherHeader: 'סדרן סורק',
    originHeader: 'נקודת מוצא',
    passengersBoardedHeader: 'נוסעים שהועלו',
    emptySeatsHeader: 'מקומות פנויים',
    actionsHeader: 'פעולות',
    noMatchingScans: 'לא נמצאו סריקות תואמות לפילטרים.',
    toOhelDirection: '← לאוהל',
    to770Direction: '← ל-770',
    workDateNotice: 'הערת חישוב: שעות העבודה מחושבות אוטומטית בהתאם לחוק ה-01:00 בלילה. אם סדרן עבד בחצות, הפעילות משוייכת ליום האתמול לצורך שלמות המשמרת.',
    dailySummaryCronDesc: 'דו"ח יומי מרוכז בכל לילה בשעה 00:00.',
    monthlySummaryCronDesc: 'דו"ח שעות סדרנים חודשי ב-1 לכל חודש ב-08:00 בבוקר.',
    connectedCloud: 'ענן מחובר 🟢',
    connectedLocal: 'שרת מקומי 🟡',
    directionToOhel: '← לאוהל',
    directionTo770: '← ל-770',
    etaNotice: 'כ-{eta} דק\' (לפי עומס תנועה במפות גוגל 🚗)',
    managerReal: 'מנהל',
    gpsError: 'שגיאה בקריאת מיקום ה-GPS האמיתי במכשיר',
    qrSuccess: 'קוד QR נסרק בהצלחה!',
    qrInvalid: 'קוד QR לא תקין או נהג לא קיים במערכת',
    cancelSosButton: 'בטל קריאת מצוקה SOS',
    triggerSosButton: 'לחצן SOS / דיווח עיכוב',
  },
  en: {
    title: 'Ohel Bus System',
    subtitle: 'Cloud-based control system for management, scanning, and live GPS tracking.',
    enterCode: 'Enter your personal login code to connect:',
    codeLabel: 'Personal Login Code',
    connectButton: 'Connect to System',
    logout: 'Logout',
    dispatcherTitle: 'Active Field Dispatcher',
    registerTrip: 'Register Trip (Field Scan)',
    driverLabel: 'Shuttle Driver',
    selectDriver: '-- Select driver boarding --',
    passengersLabel: 'Number of passengers boarded',
    reset: 'Reset',
    manualGpsLabel: 'Origin Point (Auto-detected by GPS)',
    submitScan: 'Confirm & Register Trip',
    cameraScan: 'Scan QR Code with Camera',
    cameraScanActive: 'Camera QR Scanner Active',
    closeCamera: 'Close Camera',
    departureFeed: 'Live Departures Feed',
    noScansToday: 'No recorded trips for today',
    myScansToday: 'My Personal Scan Log for Today',
    time: 'Time',
    driver: 'Driver',
    passengers: 'Passengers',
    status: 'Status',
    remainingSeats: '{count} empty seats remaining',
    shuttleFull: 'Shuttle Full 🔴',
    driverTitle: 'Active Shuttle Driver',
    yourQr: 'Your Personal QR Code',
    scanGuidance: 'Show this QR code to the dispatcher at boarding.',
    scanGuidance2: 'The scan registers your departure, passenger count, and GPS location.',
    updateStatus: 'Update Current Activity Status:',
    myTripsTodayTitle: 'My Trips Today (Personal Summary)',
    totalTrips: 'Total Trips',
    totalPassengers: 'Total Passengers',
    noTripsRecorded: 'No trips recorded for you today',
    departure: 'Origin',
    managerTitle: 'Manager',
    managerDashboard: 'Tracking Map & Statistics',
    fleetActivity: 'All Field Activity',
    usersManagement: 'Staff & Drivers Directory',
    settings: 'Settings & Cloud Connection',
    managerWelcome: 'Welcome, Manager',
    todaySummary: 'Daily Summary Statistics',
    activeDrivers: 'Active Drivers',
    activeDispatchers: 'Active Dispatchers',
    sosAlerts: 'Active SOS Alerts',
    sosTitle: 'Emergency Alerts:',
    clearAlert: 'Clear Alert',
    fleetMap: 'Live Tracking Map - GPS Fleet Tracking',
    fleetStatus: 'Fleet Status & Locations',
    managerScansTitle: 'Departures & Scans Directory',
    managerScansSub: 'List of all scans, entry edits, and dispatcher logs',
    searchPlaceholder: 'Search (driver, dispatcher, origin)...',
    clearDate: 'Clear Date',
    actions: 'Actions',
    editScanTitle: 'Edit Trip Details',
    save: 'Save',
    cancel: 'Cancel',
    dispatcherAttendance: 'Dispatcher Attendance & Working Hours',
    dispatcherAttendanceSub: 'Monthly check-in and check-out logs calculated by logical work days',
    firstScan: 'First Scan',
    lastScan: 'Last Scan',
    totalHours: 'Total Hours Calculated',
    scansCount: 'Scans Done',
    addUser: 'Add New Staff to Directory',
    userName: 'User Name',
    namePlaceholder: 'First / Full Name',
    phoneLabel: 'Phone Number',
    phonePlaceholder: '050-123-4567',
    passcodeLabel: 'Unique Login Code',
    userRole: 'System Role',
    roleDriver: 'Driver (Shuttle)',
    roleDispatcher: 'Dispatcher (Field)',
    roleAdmin: 'Manager (Admin)',
    capacityLabel: 'Vehicle Capacity (Number of Seats)',
    createUser: 'Create New User',
    usersListTitle: 'Staff & Drivers in the System',
    delete: 'Delete',
    emailConfig: 'Reports Distribution & Emails Settings',
    emailConfigSub: 'The system automatically compiles and mails reports to the defined manager:',
    dailySummaryCron: 'Daily Summary Report every night at 00:00.',
    monthlySummaryCron: 'Monthly Dispatcher Attendance Report on the 1st of every month at 08:00.',
    managerEmail: 'Distribution Email Address (Manager)',
    saveConfig: 'Save Distribution Settings',
    simulateReports: 'Reports Simulator (Email Demo)',
    simulateReportsSub: 'Generate a mock report email template formatted for the manager inbox',
    previewDaily: 'Preview Daily Report',
    previewMonthly: 'Preview Monthly Report',
    firebaseSettings: 'Cloud Connection Settings (Firebase Cloud Real-Time)',
    firebaseSub: 'Connect the application to Firestore database in the cloud. Enables real-time sync of GPS locations and scans across all devices.',
    saveFirebase: 'Save & Open Cloud Connection',
    disconnectFirebase: 'Disconnect Cloud Connection',
    connectedUser: 'Connected User',
    
    // New Keys
    welcomeUser: 'Welcome, {name}!',
    loginError: 'Invalid login code. Please try again.',
    enterPasscode: 'Please enter login code',
    logoutSuccess: 'Logged out successfully',
    offlineNotice: 'Device is offline (no signal). Scans will be saved locally.',
    onlineNotice: 'Connection restored! All offline scans successfully synced to cloud.',
    selectDriverError: 'Please select a driver for scanning',
    passengersError: 'Please enter a valid passenger count',
    scanSuccess: 'Scan recorded successfully by {dispatcher} for driver {driver}',
    statusUpdated: 'Your status has been updated to: {status}',
    sosTriggered: 'SOS alert sent to manager! Your location is flashing red.',
    sosCancelled: 'SOS alert cancelled',
    scanUpdated: 'Scan updated successfully',
    confirmDeleteScan: 'Are you sure you want to delete this row?',
    scanDeleted: 'Scan deleted from system',
    fillAllFields: 'Please fill in all fields',
    codeDuplicate: 'The code you entered is already in use by another user in the system',
    userCreatedText: 'User {name} created successfully!',
    cannotDeleteAdmin: 'Cannot delete the primary system administrator',
    confirmDeleteUser: 'Permanently delete this user from the system?',
    userDeleted: 'User deleted from the system',
    emailUpdated: 'Distribution email address updated successfully',
    firebaseConfigRequired: 'Please fill in the required Firebase configuration fields',
    firebaseConfigSaved: 'Firebase cloud connection saved! System is now syncing...',
    confirmDisconnectFirebase: 'Disconnect from Firebase cloud database and return to local mode?',
    firebaseDisconnected: 'Cloud connection disconnected. System returned to local mode (Sandbox)',
    mockEmailSent: 'The formatted report was successfully sent to the manager email: {email}',
    externalQrSuccess: 'Driver QR code loaded successfully from external link!',
    
    statusIdle: 'Shuttle unavailable',
    statusEnRoute: 'En Route',
    statusBreak: 'Break',

    gpsDetectedOrigin: 'GPS Detected Origin',
    dispatcherGps: 'Dispatcher GPS:',
    near770: 'Near 770',
    nearOhel: 'Near Ohel',
    realGps: 'Real GPS',
    signal: 'Signal:',
    offline: 'Offline',
    online: 'Online',
    offlineActiveWarning: 'Offline mode active! Scans saved locally ({count} pending)',
    backToAutoGps: 'Back to Auto GPS detection ({loc})',
    saveAndSendScan: 'Save & Send Scan',
    myScansTodayTitle: 'Your Scans Today',
    logicalDateLabel: 'Logical Date: {date}',
    scannedTrips: 'Trips Scanned',
    totalBoardedPassengers: 'Total Boarded',
    noScansTodayField: 'You haven\'t scanned any trips today.',
    scanDriverTab: 'Scan Driver',
    todayScansCount: 'Today\'s Scans ({count})',
    driversMapTab: 'Drivers Map',
    yourPersonalQrTitle: 'Your Personal QR Code for Scanning',
    myQrTab: 'My QR Code',
    myTripsCount: 'Today\'s Trips ({count})',
    liveGpsStreamTab: 'Live GPS Stream',
    driverTripsCompleted: 'Trips Completed Today',
    driverPassengersTotal: 'Total Passengers Carried',
    driverNoTripsToday: 'No trips recorded for you today.',
    departureFrom: 'Departure from {loc}',
    departureTimeAndDispatcher: 'Departure: {time} | Dispatcher: {dispatcher}',
    resetTimeNotice: 'resets at 01:00 AM',
    managerDashboardTitle: 'Fleet Tracking & Control Board',
    managerDashboardSubtitle: 'Real-time overview of shuttles status and driver locations',
    logicalWorkDateText: 'Logical Work Date: {date} ( resets at 01:00 AM )',
    tripsCompletedToday: 'Trips Completed Today',
    totalPassengersToday: 'Total Passengers Today',
    driversActiveToday: 'Active Drivers Today',
    dispatchersActiveToday: 'Active Dispatchers Today',
    sosAlertBannerTitle: '🚨 Active Emergency SOS Alert!',
    sosAlertBannerSubtitle: 'Driver {names} reported a delay or emergency.',
    clearSosForDriverButton: 'Acknowledge & clear SOS for {name}',
    edit: 'Edit',
    editTripTitle: 'Edit Departure Entry',
    editTripSubtitle: 'Editing scan for: {driver}',
    editTripMeta: 'Dispatcher: {dispatcher} at {time}',
    passengersCountLabel: 'Number of passengers',
    saveChanges: 'Save Changes',
    dispatcherAttendanceHeader: 'Dispatcher Attendance Clock',
    workDate: 'Work Date',
    fieldDispatcher: 'Field Dispatcher',
    firstScanIn: 'First Scan (Check-in)',
    lastScanOut: 'Last Scan (Check-out)',
    totalHoursCalculated: 'Total Work Hours',
    tripsScannedCount: 'Trips Scanned',
    noAttendanceData: 'No dispatcher attendance data recorded.',
    tripsCountText: '{count} trips',
    singleTripText: 'Single Trip',
    adminRole: 'Manager',
    dispatcherRole: 'Dispatcher',
    driverRole: 'Driver',
    seatsCountText: '{count} seats',
    updateEmailButton: 'Update Email',
    emailReportSimulatorTitle: 'Email Reports Simulator:',
    showDailyReportButton: 'Show Daily Report (00:00)',
    showMonthlyReportButton: 'Show Monthly Report (1st of month)',
    firebaseHeader: 'Real-time Cloud Connection (Firebase Firestore)',
    firebaseDesc: 'To turn the app into a real cloud system supporting full group sync, you can enter your own Firebase Web SDK configuration. The system will connect directly to Cloud Firestore and sync all data, GPS, and scans across all devices in real-time!',
    firebaseActiveStatus: '🟢 Cloud connection active and synced!',
    firebaseConnectedProject: 'Connected Project: {projectId}',
    firebaseConnectedDesc: 'All data is now synced in real-time on Google\'s cloud servers.',
    firebaseDisconnectButton: 'Disconnect Cloud & return to Local mode (Sandbox)',
    firebaseLocalNotice: '🟡 The system is currently running in local mode (LocalStorage Sandbox). Enter config to connect to cloud:',
    firebaseSaveButton: 'Save & Connect Cloud (Firebase)',
    emailPreviewTitle: 'Email Report Preview ({type})',
    dailyReportType: 'Daily Summary Report',
    monthlyReportType: 'Monthly Attendance Report',
    sendMockEmailButton: 'Send Mock Email Now',
    closeButton: 'Close',
    timeHeader: 'Departure Time',
    logicalDateHeader: 'Logical Date',
    scannerDispatcherHeader: 'Scanning Dispatcher',
    originHeader: 'Origin Point',
    passengersBoardedHeader: 'Boarded Passengers',
    emptySeatsHeader: 'Empty Seats',
    actionsHeader: 'Actions',
    noMatchingScans: 'No scans matching the filters were found.',
    toOhelDirection: '← to Ohel',
    to770Direction: '← to 770',
    workDateNotice: 'Calculation note: Work hours are automatically calculated based on the 01:00 AM logical reset rule. If a dispatcher worked at midnight, the activity is linked to the previous calendar day.',
    dailySummaryCronDesc: 'Daily summary report sent every night at 00:00.',
    monthlySummaryCronDesc: 'Monthly dispatcher attendance report on the 1st of every month at 08:00 AM.',
    connectedCloud: 'Cloud Connected 🟢',
    connectedLocal: 'Local Server 🟡',
    directionToOhel: '← to Ohel',
    directionTo770: '← to 770',
    etaNotice: '~{eta} min (via Google Maps 🚗)',
    managerReal: 'Manager',
    gpsError: 'Error reading real GPS location on device',
    qrSuccess: 'QR code scanned successfully!',
    qrInvalid: 'Invalid QR code or driver not found in system',
    cancelSosButton: 'Cancel SOS Emergency',
    triggerSosButton: 'SOS Button / Report Delay',
  }
};

// Haversine Distance Helper
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // distance in km
};

// Hebrew Date Formatter Helper
const formatHebrewAndGregorianDate = (dateInput: Date | string): string => {
  let date: Date;
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      date = new Date(dateInput + 'T12:00:00');
    } else {
      date = new Date(dateInput);
    }
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return typeof dateInput === 'string' ? dateInput : '';
  
  try {
    const dayStr = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric' }).format(date);
    const monthStr = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' }).format(date);
    const yearStr = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { year: 'numeric' }).format(date);
    
    const dayNum = parseInt(dayStr.replace(/[^0-9]/g, '')) || date.getDate();
    const yearNum = parseInt(yearStr.replace(/[^0-9]/g, '')) || 5786;
    
    const gematriaMap: { [key: number]: string } = {
      1: "א'", 2: "ב'", 3: "ג'", 4: "ד'", 5: "ה'", 6: "ו'", 7: "ז'", 8: "ח'", 9: "ט'",
      10: "י'", 11: 'י"א', 12: 'י"ב', 13: 'י"ג', 14: 'י"ד', 15: 'ט"ו', 16: 'ט"ז',
      17: 'י"ז', 18: 'י"ח', 19: 'י"ט', 20: "כ'", 21: 'כ"א', 22: 'כ"ב', 23: 'כ"ג',
      24: 'כ"ד', 25: 'כ"ה', 26: 'כ"ו', 27: 'כ"ז', 28: 'כ"ח', 29: 'כ"ט', 30: "ל'"
    };
    
    const dayHeb = gematriaMap[dayNum] || dayStr;
    
    // Year gematria
    const thousandRem = yearNum % 1000;
    const hundreds = Math.floor(thousandRem / 100);
    const tens = Math.floor((thousandRem % 100) / 10);
    const units = thousandRem % 10;
    
    let yearHeb = '';
    if (hundreds === 7) yearHeb += 'תש';
    else if (hundreds === 8) yearHeb += 'תת';
    
    const tensGematria: { [key: number]: string } = {
      1: 'י', 2: 'כ', 3: 'ל', 4: 'מ', 5: 'נ', 6: 'ס', 7: 'ע', 8: 'פ', 9: 'צ'
    };
    
    const unitsGematria: { [key: number]: string } = {
      1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט'
    };
    
    const lastPartVal = (tens * 10) + units;
    let lastPart = '';
    if (lastPartVal === 15) lastPart = 'טו';
    else if (lastPartVal === 16) lastPart = 'טז';
    else lastPart = (tensGematria[tens] || '') + (unitsGematria[units] || '');
    
    if (lastPart.length === 1) yearHeb += lastPart + "'";
    else if (lastPart.length > 1) yearHeb += lastPart.slice(0, -1) + '"' + lastPart.slice(-1);
    else yearHeb += "'";
    
    let monthPref = monthStr;
    if (!monthStr.startsWith('ב')) {
      monthPref = 'ב' + monthStr;
    }
    
    const hebrewFull = `${dayHeb} ${monthPref} ${yearHeb}`;
    const gregFull = date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    return `${hebrewFull} (${gregFull})`;
  } catch (e) {
    return date.toLocaleDateString('he-IL');
  }
};

export default function App() {
  // Internationalization (Language Switcher)
  const [lang, setLang] = useState<'he' | 'en'>('he');

  // Translation Helper
  const t = (key: keyof typeof TRANSLATIONS.he, variables?: { [key: string]: any }) => {
    let text = TRANSLATIONS[lang][key] || TRANSLATIONS.he[key] || '';
    if (variables) {
      Object.keys(variables).forEach(k => {
        text = text.replace(`{${k}}`, String(variables[k]));
      });
    }
    return text;
  };

  // Dynamically toggle body/document text direction
  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Authentication & Session persistent initialization
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('tp_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [activeLocations, setActiveLocations] = useState<ActiveLocation[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  // Customizable Glassmorphism values
  const [glassOpacity, setGlassOpacity] = useState(() => {
    return parseFloat(localStorage.getItem('tp_glass_opacity') || '0.15');
  });
  const [glassBlur, setGlassBlur] = useState(() => {
    return parseInt(localStorage.getItem('tp_glass_blur') || '16');
  });

  // Apply glass variables to root element
  useEffect(() => {
    document.documentElement.style.setProperty('--glass-opacity', glassOpacity.toString());
    document.documentElement.style.setProperty('--glass-blur', `${glassBlur}px`);
    document.documentElement.style.setProperty('--glass-border-opacity', (glassOpacity * 0.5).toString());
    localStorage.setItem('tp_glass_opacity', glassOpacity.toString());
    localStorage.setItem('tp_glass_blur', glassBlur.toString());
  }, [glassOpacity, glassBlur]);
  
  // App navigation tab
  const [activeTab, setActiveTab] = useState<string>('');

  // Toast notifications
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'danger' }[]>([]);

  // Simulation GPS overrides for dispatcher
  const [gpsSource, setGpsSource] = useState<'real' | '770' | 'ohel'>('770');

  // Scanner Form state
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [passengersCount, setPassengersCount] = useState<number>(0);
  const [manualDepartureLocation, setManualDepartureLocation] = useState<DepartureLocation | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Search & Filter state for Manager Dashboard
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedScanForEdit, setSelectedScanForEdit] = useState<Scan | null>(null);
  const [editPassengersCount, setEditPassengersCount] = useState<number>(0);
  const [editDepartureLocation, setEditDepartureLocation] = useState<DepartureLocation>('770');

  // Settings & Users Admin states
  const [reportEmail, setReportEmail] = useState('');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioFromNumber, setTwilioFromNumber] = useState('');
  const [twilioRecipientSms, setTwilioRecipientSms] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'driver' | 'dispatcher' | 'admin'>('driver');
  const [newUserCapacity, setNewUserCapacity] = useState<number>(15);
  const [loginCode, setLoginCode] = useState('');
  const [newUserCode, setNewUserCode] = useState('');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserCode, setEditUserCode] = useState('');
  const [editUserRole, setEditUserRole] = useState<'driver' | 'dispatcher' | 'admin'>('driver');
  const [editUserCapacity, setEditUserCapacity] = useState<number>(15);
  // Email Reports Simulator state
  const [emailPreviewType, setEmailPreviewType] = useState<'daily' | 'monthly' | null>(null);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string>('');

  // Active watch position for GPS streaming
  const [dispatcherRealCoords, setDispatcherRealCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Login screen interactive Apple-style glows
  const [loginRipples, setLoginRipples] = useState<{ id: string; x: number; y: number }[]>([]);
  
  // Expanded daily history days state
  const [expandedDays, setExpandedDays] = useState<{ [date: string]: boolean }>({});
  const [customEtaInput, setCustomEtaInput] = useState<number>(0);
  const [showDriverHistory, setShowDriverHistory] = useState<boolean>(false);
  
  const toggleDayExpanded = (date: string) => {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  };
  
  const handleLoginPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple = {
      id: Math.random().toString(),
      x,
      y
    };

    setLoginRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setLoginRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 2000);
  };

  // Toast trigger helper
  const triggerToast = (message: string, type: 'success' | 'danger' = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Sync state from dbService updates
  useEffect(() => {
    const handleUpdate = () => {
      setUsers(dbService.getUsers());
      setScans(dbService.getScans());
      setActiveLocations(dbService.getActiveLocations());
      setIsOffline(dbService.isOffline());
    };

    handleUpdate();
    const unsubscribe = dbService.subscribe(handleUpdate);

    // Initial config load
    const config = dbService.getConfig();
    setReportEmail(config.reportEmail || '');
    setGoogleSheetsUrl(config.googleSheetsUrl || '');
    setGoogleMapsApiKey(config.googleMapsApiKey || '');
    setTwilioAccountSid(config.twilioAccountSid || '');
    setTwilioAuthToken(config.twilioAuthToken || '');
    setTwilioFromNumber(config.twilioFromNumber || '');
    setTwilioRecipientSms(config.twilioRecipientSms || '');

    return () => unsubscribe();
  }, []);

  // Deep linking simulator URL query scanner
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const driverIdParam = params.get('driverId');
    if (driverIdParam && currentUser?.role === 'dispatcher') {
      setSelectedDriverId(driverIdParam);
      setActiveTab('scan');
      triggerToast(t('externalQrSuccess'), 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [currentUser]);

  // In-app QR Code Scanner camera handler (Using Html5Qrcode directly for instant back-camera load)
  useEffect(() => {
    if (!showCameraScanner) return;

    const html5QrCode = new Html5Qrcode("qr-reader");
    const config = { fps: 15, qrbox: { width: 250, height: 250 } };

    const onScanSuccess = (decodedText: string) => {
      try {
        const url = new URL(decodedText);
        const driverIdParam = url.searchParams.get('driverId');
        if (driverIdParam) {
          setSelectedDriverId(driverIdParam);
          setShowCameraScanner(false);
          triggerToast(t('qrSuccess'), 'success');
        } else {
          const matchedDriver = users.find(u => u.id === decodedText && u.role === 'driver');
          if (matchedDriver) {
            setSelectedDriverId(decodedText);
            setShowCameraScanner(false);
            triggerToast(t('qrSuccess'), 'success');
          } else {
            triggerToast(t('qrInvalid'), 'danger');
          }
        }
      } catch (e) {
        const matchedDriver = users.find(u => u.id === decodedText && u.role === 'driver');
        if (matchedDriver) {
          setSelectedDriverId(decodedText);
          setShowCameraScanner(false);
          triggerToast(t('qrSuccess'), 'success');
        } else {
          triggerToast(t('qrInvalid'), 'danger');
        }
      }
    };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      () => {}
    ).catch(err => {
      console.error("Camera start error:", err);
      triggerToast(lang === 'he' ? 'שגיאה בפתיחת המצלמה, אנא ודא הרשאת גישה' : 'Error opening camera, please check permission', 'danger');
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(err => console.error("Failed to stop scanner", err));
      }
    };
  }, [showCameraScanner, users]);

  // Set default tabs when user logs in
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') setActiveTab('dashboard');
      if (currentUser.role === 'dispatcher') setActiveTab('scan');
      if (currentUser.role === 'driver') setActiveTab('qr');
    } else {
      setActiveTab('');
    }
  }, [currentUser]);

  // Watch position of dispatcher or driver
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== 'dispatcher' && currentUser.role !== 'driver') return;

    // Drivers always watch location. Dispatchers only watch if gpsSource is 'real'
    const shouldWatch = currentUser.role === 'driver' || (currentUser.role === 'dispatcher' && gpsSource === 'real');
    if (!shouldWatch) return;

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (currentUser.role === 'dispatcher') {
            setDispatcherRealCoords({ latitude, longitude });
          }
          dbService.updateActiveLocation(currentUser.id, latitude, longitude);
        },
        (err) => {
          console.error("GPS Watch error:", err);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [currentUser, gpsSource]);

  // Dispatcher location based on GPS source
  const dispatcherLocation = useMemo(() => {
    if (gpsSource === '770') {
      return { latitude: LOCATIONS['770'].latitude, longitude: LOCATIONS['770'].longitude };
    }
    if (gpsSource === 'ohel') {
      return { latitude: LOCATIONS['Ohel'].latitude, longitude: LOCATIONS['Ohel'].longitude };
    }
    return dispatcherRealCoords || { latitude: LOCATIONS['770'].latitude, longitude: LOCATIONS['770'].longitude };
  }, [gpsSource, dispatcherRealCoords]);

  // Sync Dispatcher location in DB when simulator coordinates change
  useEffect(() => {
    if (currentUser && currentUser.role === 'dispatcher') {
      dbService.updateActiveLocation(currentUser.id, dispatcherLocation.latitude, dispatcherLocation.longitude);
    }
  }, [currentUser, dispatcherLocation]);

  // Auto-detected departure location based on proximity
  const autoDepartureLocation: DepartureLocation = useMemo(() => {
    const distTo770 = calculateDistance(
      dispatcherLocation.latitude, 
      dispatcherLocation.longitude, 
      LOCATIONS['770'].latitude, 
      LOCATIONS['770'].longitude
    );
    const distToOhel = calculateDistance(
      dispatcherLocation.latitude, 
      dispatcherLocation.longitude, 
      LOCATIONS['Ohel'].latitude, 
      LOCATIONS['Ohel'].longitude
    );
    return distTo770 < distToOhel ? '770' : 'Ohel';
  }, [dispatcherLocation]);

  // Selected departure location (manual override or auto)
  const currentDepartureLocation = manualDepartureLocation || autoDepartureLocation;

  // Drivers filter for dispatcher dropdown
  const driversList = useMemo(() => {
    return users.filter(u => u.role === 'driver');
  }, [users]);

  // Logical Today (01:00 AM reset rule)
  const logicalToday = useMemo(() => {
    return dbService.getLogicalDate();
  }, [scans]);

  // --- Scans Filters for Dashboard ---
  const filteredScans = useMemo(() => {
    return scans
      .filter(s => {
        const matchesSearch = 
          s.driverName.toLowerCase().includes(searchText.toLowerCase()) || 
          s.dispatcherName.toLowerCase().includes(searchText.toLowerCase()) || 
          s.departureLocation.toLowerCase().includes(searchText.toLowerCase());
        
        const matchesDate = dateFilter ? s.logicalDate === dateFilter : true;
        
        return matchesSearch && matchesDate;
      })
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [scans, searchText, dateFilter]);

  // --- Stats calculations ---
  const stats = useMemo(() => {
    const todayScans = scans.filter(s => s.logicalDate === logicalToday);
    const totalPassengers = todayScans.reduce((sum, s) => sum + s.passengersCount, 0);
    
    const scannedDriverIds = new Set(todayScans.map(s => s.driverId));
    const activeLocationsDrivers = activeLocations.filter(loc => loc.role === 'driver' && loc.status !== 'break');
    activeLocationsDrivers.forEach(d => scannedDriverIds.add(d.id));
    
    const scannedDispIds = new Set(todayScans.map(s => s.dispatcherId));
    activeLocations.filter(loc => loc.role === 'dispatcher').forEach(disp => scannedDispIds.add(disp.id));

    return {
      tripsToday: todayScans.length,
      passengersToday: totalPassengers,
      activeDrivers: scannedDriverIds.size,
      activeDispatchers: scannedDispIds.size
    };
  }, [scans, activeLocations, logicalToday]);

  // --- Personal Logs Today ---
  const myTripsToday = useMemo(() => {
    if (!currentUser || currentUser.role !== 'driver') return [];
    return scans
      .filter(s => s.driverId === currentUser.id && s.logicalDate === logicalToday)
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [scans, currentUser, logicalToday]);

  const myScansToday = useMemo(() => {
    if (!currentUser || currentUser.role !== 'dispatcher') return [];
    return scans
      .filter(s => s.dispatcherId === currentUser.id && s.logicalDate === logicalToday)
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [scans, currentUser, logicalToday]);

  const lastTwoHoursScans = useMemo(() => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    return scans
      .filter(s => new Date(s.scannedAt).getTime() >= twoHoursAgo)
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [scans]);

  const myTripsHistoryByDay = useMemo(() => {
    if (!currentUser || currentUser.role !== 'driver') return [];
    const groups: { [date: string]: { date: string; tripsCount: number; passengersSum: number; trips: any[] } } = {};
    scans.forEach(scan => {
      if (scan.driverId !== currentUser.id) return;
      const date = scan.logicalDate;
      if (!groups[date]) {
        groups[date] = { date, tripsCount: 0, passengersSum: 0, trips: [] };
      }
      groups[date].tripsCount += 1;
      groups[date].passengersSum += scan.passengersCount;
      groups[date].trips.push(scan);
    });
    return Object.values(groups)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(group => {
        group.trips.sort((x, y) => new Date(y.scannedAt).getTime() - new Date(x.scannedAt).getTime());
        return group;
      });
  }, [scans, currentUser]);

  const myScansHistoryByDay = useMemo(() => {
    if (!currentUser || currentUser.role !== 'dispatcher') return [];
    const groups: { [date: string]: { date: string; scansCount: number; passengersSum: number; scans: any[] } } = {};
    scans.forEach(scan => {
      if (scan.dispatcherId !== currentUser.id) return;
      const date = scan.logicalDate;
      if (!groups[date]) {
        groups[date] = { date, scansCount: 0, passengersSum: 0, scans: [] };
      }
      groups[date].scansCount += 1;
      groups[date].passengersSum += scan.passengersCount;
      groups[date].scans.push(scan);
    });
    return Object.values(groups)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(group => {
        group.scans.sort((x, y) => new Date(y.scannedAt).getTime() - new Date(x.scannedAt).getTime());
        return group;
      });
  }, [scans, currentUser]);

  // --- Handlers ---
  const handleCodeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim()) {
      triggerToast(t('enterPasscode'), 'danger');
      return;
    }
    const user = dbService.loginWithCode(loginCode.trim());
    if (user) {
      localStorage.setItem('tp_current_user', JSON.stringify(user));
      setCurrentUser(user);
      setLoginCode('');
      triggerToast(t('welcomeUser', { name: user.name }), 'success');
    } else {
      triggerToast(t('loginError'), 'danger');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tp_current_user');
    setCurrentUser(null);
    triggerToast(t('logoutSuccess'), 'success');
  };

  const handleOfflineToggle = () => {
    const newOffline = !isOffline;
    dbService.setOfflineStatus(newOffline);
    if (newOffline) {
      triggerToast(t('offlineNotice'), 'danger');
    } else {
      triggerToast(t('onlineNotice'), 'success');
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
    }
  };

  const handleCreateScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!selectedDriverId) {
      triggerToast(t('selectDriverError'), 'danger');
      return;
    }
    if (passengersCount <= 0) {
      triggerToast(t('passengersError'), 'danger');
      return;
    }

    const driver = users.find(u => u.id === selectedDriverId);
    if (!driver) return;

    dbService.addScan({
      dispatcherId: currentUser.id,
      dispatcherName: currentUser.name,
      driverId: selectedDriverId,
      driverName: driver.name,
      passengersCount: passengersCount,
      scannedAt: new Date().toISOString(),
      location: { latitude: dispatcherLocation.latitude, longitude: dispatcherLocation.longitude },
      departureLocation: currentDepartureLocation
    });

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.8 }
    });

    triggerToast(t('scanSuccess', { dispatcher: currentUser.name, driver: driver.name }), 'success');

    // Reset Form
    setSelectedDriverId('');
    setPassengersCount(0);
    setManualDepartureLocation(null);
  };

  // --- Driver Actions ---
  const handleDriverStatusChange = (status: DriverStatus) => {
    if (!currentUser) return;
    let direction: Direction = null;
    if (status === 'en_route') {
      const lastScan = scans.find(s => s.driverId === currentUser.id);
      direction = lastScan?.departureLocation === '770' ? 'to_ohel' : 'to_770';
    }
    dbService.updateDriverTripState(currentUser.id, status, direction);
    triggerToast(t('statusUpdated', { status: status === 'idle' ? t('statusIdle') : status === 'break' ? t('statusBreak') : t('statusEnRoute') }), 'success');
  };

  const handleSOSClick = () => {
    if (!currentUser) return;
    dbService.triggerSOS(currentUser.id);
    const loc = activeLocations.find(l => l.id === currentUser.id);
    const isSOSNow = !(loc as any)?.sosAlert;
    if (isSOSNow) {
      triggerToast(t('sosTriggered'), 'danger');
    } else {
      triggerToast(t('sosCancelled'), 'success');
    }
  };

  // --- Manager Dashboard Actions ---
  const handleEditScanClick = (scan: Scan) => {
    setSelectedScanForEdit(scan);
    setEditPassengersCount(scan.passengersCount);
    setEditDepartureLocation(scan.departureLocation);
  };

  const handleSaveEditScan = () => {
    if (!selectedScanForEdit) return;
    const updated = {
      ...selectedScanForEdit,
      passengersCount: editPassengersCount,
      departureLocation: editDepartureLocation
    };
    dbService.updateScan(updated);
    setSelectedScanForEdit(null);
    triggerToast(t('scanUpdated'), 'success');
  };

  const handleDeleteScan = (scanId: string) => {
    if (window.confirm(t('confirmDeleteScan'))) {
      dbService.deleteScan(scanId);
      triggerToast(t('scanDeleted'), 'success');
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserPhone || !newUserCode) {
      triggerToast(t('fillAllFields'), 'danger');
      return;
    }

    const cleanCode = newUserCode.trim();
    if (users.some(u => u.code === cleanCode)) {
      triggerToast(t('codeDuplicate'), 'danger');
      return;
    }
    
    const id = 'usr_' + Math.random().toString(36).substr(2, 9);
    const roleSuffix = newUserRole === 'driver' ? ' (נהג)' : newUserRole === 'dispatcher' ? ' (סדרן)' : ' (מנהל)';
    
    dbService.saveUser({
      id,
      name: newUserName + roleSuffix,
      phone: newUserPhone,
      role: newUserRole,
      code: cleanCode,
      capacity: newUserRole === 'driver' ? newUserCapacity : undefined,
      createdAt: new Date().toISOString()
    });

    triggerToast(t('userCreatedText', { name: newUserName }), 'success');
    
    // Reset Form
    setNewUserName('');
    setNewUserPhone('');
    setNewUserCode('');
    setNewUserCapacity(15);
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === 'usr_admin') {
      triggerToast(t('cannotDeleteAdmin'), 'danger');
      return;
    }
    if (window.confirm(t('confirmDeleteUser'))) {
      dbService.deleteUser(userId);
      triggerToast(t('userDeleted'), 'success');
    }
  };

  const handleEditUserClick = (user: User) => {
    setSelectedUserForEdit(user);
    const cleanName = user.name
      .replace(' (נהג)', '')
      .replace(' (סדרן)', '')
      .replace(' (מנהל)', '');
    setEditUserName(cleanName);
    setEditUserPhone(user.phone);
    setEditUserCode(user.code);
    setEditUserRole(user.role);
    setEditUserCapacity(user.capacity || 15);
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    if (!editUserName || !editUserPhone || !editUserCode) {
      triggerToast(t('fillAllFields'), 'danger');
      return;
    }

    const cleanCode = editUserCode.trim();
    if (users.some(u => u.code === cleanCode && u.id !== selectedUserForEdit.id)) {
      triggerToast(t('codeDuplicate'), 'danger');
      return;
    }

    let roleSuffix = '';
    if (editUserRole === 'driver') roleSuffix = ' (נהג)';
    else if (editUserRole === 'dispatcher') roleSuffix = ' (סדרן)';
    else if (editUserRole === 'admin') roleSuffix = ' (מנהל)';

    const updatedUser: User = {
      ...selectedUserForEdit,
      name: editUserName + roleSuffix,
      phone: editUserPhone,
      role: editUserRole,
      code: cleanCode,
      capacity: editUserRole === 'driver' ? editUserCapacity : undefined
    };

    dbService.saveUser(updatedUser);
    triggerToast(lang === 'he' ? `המשתמש ${editUserName} עודכן בהצלחה` : `User ${editUserName} updated successfully`, 'success');
    
    if (currentUser && currentUser.id === selectedUserForEdit.id) {
      localStorage.setItem('tp_current_user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
    }
    
    setSelectedUserForEdit(null);
  };

  const handleSaveConfig = () => {
    dbService.saveConfig({
      reportEmail,
      googleSheetsUrl,
      googleMapsApiKey,
      twilioAccountSid,
      twilioAuthToken,
      twilioFromNumber,
      twilioRecipientSms
    });
    triggerToast(lang === 'he' ? 'ההגדרות עודכנו בהצלחה' : 'Settings updated successfully', 'success');
  };

  // --- Reports Preview Generators ---
  const handleGenerateReportPreview = (type: 'daily' | 'monthly') => {
    setEmailPreviewType(type);
    const dateStr = new Date().toLocaleDateString('he-IL');
    
    if (type === 'daily') {
      const todayScans = scans.filter(s => s.logicalDate === logicalToday);
      const totalPassengers = todayScans.reduce((sum, s) => sum + s.passengersCount, 0);
      
      let tableRows = '';
      todayScans.forEach(s => {
        tableRows += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; text-align: right;">${new Date(s.scannedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="padding: 10px; text-align: right;">${s.driverName}</td>
            <td style="padding: 10px; text-align: right;">${s.departureLocation === '770' ? '770 Eastern Parkway' : 'אוהל חב"ד'}</td>
            <td style="padding: 10px; text-align: center; font-weight: bold; color: #d97706;">${s.passengersCount}</td>
            <td style="padding: 10px; text-align: right;">${s.dispatcherName}</td>
          </tr>
        `;
      });

      if (todayScans.length === 0) {
        tableRows = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #718096;">אין פעילות רשומה ליום זה</td></tr>';
      }

      const html = `
        <div style="direction: rtl; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7fafc; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 24px; letter-spacing: 1px; color: #f59e0b;">אוהל בוס</h2>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #94a3b8;">דו"ח פעילות יומי מרוכז - ${formatHebrewAndGregorianDate(logicalToday)}</p>
            </div>
            <div style="padding: 24px;">
              <div style="display: flex; justify-content: space-around; margin-bottom: 24px; background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #edf2f7; text-align: center;">
                <div style="flex: 1;">
                  <span style="font-size: 12px; color: #64748b; display: block;">סה"כ נסיעות</span>
                  <strong style="font-size: 20px; color: #0f172a;">${todayScans.length}</strong>
                </div>
                <div style="flex: 1; border-right: 1px solid #cbd5e1; border-left: 1px solid #cbd5e1;">
                  <span style="font-size: 12px; color: #64748b; display: block;">סה"כ נוסעים</span>
                  <strong style="font-size: 20px; color: #10b981;">${totalPassengers}</strong>
                </div>
                <div style="flex: 1;">
                  <span style="font-size: 12px; color: #64748b; display: block;">תאריך דוח</span>
                  <strong style="font-size: 13px; color: #0f172a; line-height: 20px; display: block; margin-top: 4px;">
                    ${dateStr} <br/>
                    <span style="font-size: 11px; color: #64748b; font-weight: normal;">${formatHebrewAndGregorianDate(logicalToday).split(' (')[0]}</span>
                  </strong>
                </div>
              </div>
              <h3 style="font-size: 16px; color: #0f172a; border-bottom: 2px solid #edf2f7; padding-bottom: 8px; margin-bottom: 12px;">פירוט נסיעות היום:</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #f1f5f9; color: #475569; font-weight: bold;">
                    <th style="padding: 10px; text-align: right;">שעה</th>
                    <th style="padding: 10px; text-align: right;">נהג</th>
                    <th style="padding: 10px; text-align: right;">מוצא</th>
                    <th style="padding: 10px; text-align: center;">נוסעים</th>
                    <th style="padding: 10px; text-align: right;">סדרן סורק</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
              <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #94a3b8; text-align: center;">
                נשלח אוטומטית ע"י מערכת אוהל בוס בענן. כתובת מנהל: ${reportEmail}
              </div>
            </div>
          </div>
        </div>
      `;
      setEmailPreviewHtml(html);
    } else {
      const attendance = dbService.getDispatcherAttendance();
      let tableRows = '';

      Object.entries(attendance).forEach(([date, disps]) => {
        Object.entries(disps).forEach(([dispId, data]) => {
          const dispUser = users.find(u => u.id === dispId);
          const dispName = dispUser ? dispUser.name.replace(' (סדרן)', '') : 'סדרן';
          
          const first = new Date(data.firstScan);
          const last = new Date(data.lastScan);
          const diffMs = last.getTime() - first.getTime();
          const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(2);
          
          const timeFormat = { hour: '2-digit' as const, minute: '2-digit' as const };
          const firstStr = first.toLocaleTimeString('he-IL', timeFormat);
          const lastStr = last.toLocaleTimeString('he-IL', timeFormat);

          tableRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; text-align: right; line-height: 18px;">
                ${date}<br/>
                <span style="font-size: 11px; color: #64748b;">${formatHebrewAndGregorianDate(date).split(' (')[0]}</span>
              </td>
              <td style="padding: 10px; text-align: right;"><b>${dispName}</b></td>
              <td style="padding: 10px; text-align: center;">${firstStr}</td>
              <td style="padding: 10px; text-align: center;">${lastStr}</td>
              <td style="padding: 10px; text-align: center; font-weight: bold; color: #10b981;">${diffHrs} שעות</td>
              <td style="padding: 10px; text-align: center; color: #64748b;">${data.count} סריקות</td>
            </tr>
          `;
        });
      });

      if (Object.keys(attendance).length === 0) {
        tableRows = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #718096;">אין נתונים חודשיים מוקלטים במערכת</td></tr>';
      }

      const html = `
        <div style="direction: rtl; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7fafc; padding: 20px;">
          <div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 24px; letter-spacing: 1px; color: #f59e0b;">אוהל בוס</h2>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #94a3b8;">דו"ח נוכחות ושעות סדרנים חודשי מרוכז - 1 לכל חודש</p>
            </div>
            <div style="padding: 24px;">
              <p style="font-size: 14px; color: #334155; margin-bottom: 20px;">שלום למנהל, להלן חישוב שעות העבודה החודשי של הסדרנים בשטח. שעות העבודה מחושבות לפי ההפרש בין הסריקה הראשונה לסריקה האחרונה של כל סדרן בכל יום עבודה.</p>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: #f1f5f9; color: #475569; font-weight: bold;">
                    <th style="padding: 10px; text-align: right;">תאריך</th>
                    <th style="padding: 10px; text-align: right;">סדרן</th>
                    <th style="padding: 10px; text-align: center;">סריקה ראשונה</th>
                    <th style="padding: 10px; text-align: center;">סריקה אחרונה</th>
                    <th style="padding: 10px; text-align: center;">סך שעות מחושב</th>
                    <th style="padding: 10px; text-align: center;">נסיעות שסרק</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
              
              <div style="margin-top: 30px; background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 6px; font-size: 12px; color: #b45309;">
                <strong>הערת חישוב:</strong> שעות העבודה מחושבות אוטומטית בהתאם לחוק ה-01:00 בלילה. אם סדרן עבד בחצות, הפעילות משוייכת ליום האתמול לצורך שלמות המשמרת.
              </div>

              <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #94a3b8; text-align: center;">
                נשלח אוטומטית ע"י מערכת אוהל בוס בענן. כתובת מנהל: ${reportEmail}
              </div>
            </div>
          </div>
        </div>
      `;
      setEmailPreviewHtml(html);
    }
  };

  const handleDownloadHtmlReport = () => {
    if (!emailPreviewHtml) return;
    const blob = new Blob([emailPreviewHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `report_${emailPreviewType}_${new Date().toISOString().split('T')[0]}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(lang === 'he' ? 'קובץ הדו"ח הורד בהצלחה' : 'Report HTML file downloaded successfully', 'success');
  };

  const handleCopyHtmlReport = () => {
    if (!emailPreviewHtml) return;
    navigator.clipboard.writeText(emailPreviewHtml).then(() => {
      triggerToast(lang === 'he' ? 'קוד ה-HTML הועתק ללוח' : 'HTML code copied to clipboard', 'success');
    }).catch(() => {
      triggerToast('Error copying', 'danger');
    });
  };

  const handleShareWhatsApp = () => {
    if (!emailPreviewHtml) return;
    const subject = emailPreviewType === 'daily' 
      ? `*דו"ח פעילות יומי - אוהל בוס 🚌*`
      : `*דו"ח נוכחות חודשי - אוהל בוס 🚌*`;
    
    let bodyText = `שלום, מצורף דו"ח פעילות מתוך מערכת אוהל בוס.`;
    if (emailPreviewType === 'daily') {
      const todayScans = scans.filter(s => s.logicalDate === logicalToday);
      const totalPassengers = todayScans.reduce((sum, s) => sum + s.passengersCount, 0);
      bodyText = `${subject}\n-----------------------------------\n*תאריך עבודה:* ${logicalToday}\n*סה"כ נסיעות:* ${todayScans.length}\n*סה"כ נוסעים:* ${totalPassengers}\n\n*פירוט הסריקות:*\n` + 
        todayScans.map(s => `• *${new Date(s.scannedAt).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}* - נהג: ${s.driverName.replace(' (נהג)', '')} | מוצא: ${s.departureLocation === '770' ? '770' : 'אוהל'} | נוסעים: *${s.passengersCount}*`).join('\n');
    } else {
      const totalTrips = scans.length;
      const totalPassengers = scans.reduce((sum, s) => sum + s.passengersCount, 0);
      bodyText = `${subject}\n-----------------------------------\n*סה"כ נסיעות החודש:* ${totalTrips}\n*סה"כ נוסעים:* ${totalPassengers}\n\nנשלח ממערכת אוהל בוס.`;
    }
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(bodyText)}`;
    window.open(whatsappUrl, '_blank');
    triggerToast(lang === 'he' ? 'פותח וואטסאפ לשיתוף...' : 'Opening WhatsApp for sharing...', 'success');
  };

  const handleExportScansToCsv = () => {
    const headers = [
      lang === 'he' ? 'שעת סריקה' : 'Scan Time',
      lang === 'he' ? 'תאריך עבודה' : 'Logical Date',
      lang === 'he' ? 'נהג' : 'Driver',
      lang === 'he' ? 'סדרן' : 'Dispatcher',
      lang === 'he' ? 'מוצא' : 'Origin',
      lang === 'he' ? 'נוסעים שעלו' : 'Passengers',
      lang === 'he' ? 'מושבים פנויים' : 'Empty Seats',
      lang === 'he' ? 'קיבולת נהג' : 'Capacity'
    ];
    
    const rows = filteredScans.map(scan => [
      new Date(scan.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      scan.logicalDate,
      scan.driverName.replace(' (נהג)', ''),
      scan.dispatcherName.replace(' (סדרן)', ''),
      scan.departureLocation === '770' ? '770' : (lang === 'he' ? 'אוהל' : 'Ohel'),
      scan.passengersCount,
      scan.remainingSeats,
      scan.driverCapacity
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `scans_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(lang === 'he' ? 'הדו"ח יוצא לאקסל בהצלחה' : 'Report exported to Excel successfully', 'success');
  };

  const handleExportUsersToCsv = () => {
    const headers = [
      lang === 'he' ? 'שם' : 'Name',
      lang === 'he' ? 'טלפון' : 'Phone',
      lang === 'he' ? 'תפקיד' : 'Role',
      lang === 'he' ? 'קוד' : 'Passcode',
      lang === 'he' ? 'קיבולת רכב' : 'Capacity'
    ];
    
    const rows = users.map(u => [
      u.name,
      u.phone,
      u.role === 'admin' ? (lang === 'he' ? 'מנהל' : 'Admin') : u.role === 'dispatcher' ? (lang === 'he' ? 'סדרן' : 'Dispatcher') : (lang === 'he' ? 'נהג' : 'Driver'),
      u.code,
      u.capacity || ''
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `users_list_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(lang === 'he' ? 'רשימת המשתמשים יוצאה בהצלחה' : 'Users list exported successfully', 'success');
  };

  const handleOpenMailClient = () => {
    if (!emailPreviewHtml) return;
    const subject = emailPreviewType === 'daily' 
      ? `דו"ח פעילות יומי - אוהל בוס (${logicalToday})`
      : `דו"ח נוכחות חודשי - אוהל בוס`;
    
    let bodyText = `שלום,\n\nמצורף דו"ח פעילות מתוך מערכת אוהל בוס.\n\nאנא מצא את הדו"ח המלא בקובץ המצורף או בכתובת המערכת.\n\nבברכה,\nמערכת אוהל בוס.`;
    if (emailPreviewType === 'daily') {
      const todayScans = scans.filter(s => s.logicalDate === logicalToday);
      const totalPassengers = todayScans.reduce((sum, s) => sum + s.passengersCount, 0);
      bodyText = `דו"ח פעילות יומי - אוהל בוס\n=========================\nתאריך עבודה: ${logicalToday}\nסה"כ נסיעות: ${todayScans.length}\nסה"כ נוסעים: ${totalPassengers}\n\nפירוט:\n` + 
        todayScans.map(s => `- ${new Date(s.scannedAt).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}: נהג: ${s.driverName}, מוצא: ${s.departureLocation === '770' ? '770' : 'אוהל'}, נוסעים: ${s.passengersCount}`).join('\n');
    }
    
    const mailtoUrl = `mailto:${encodeURIComponent(reportEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(mailtoUrl, '_blank');
    triggerToast(lang === 'he' ? 'פותח יישום מייל מקומי...' : 'Opening local mail client...', 'success');
  };

  const handleSendMockEmail = () => {
    const subject = emailPreviewType === 'daily' 
      ? (lang === 'he' ? "דו\"ח יומי מרוכז - אוהל בוס" : "Daily Summary Report - Ohel Bus")
      : (lang === 'he' ? "דו\"ח נוכחות חודשי - אוהל בוס" : "Monthly Attendance Report - Ohel Bus");

    dbService.sendEmail(reportEmail, subject, emailPreviewHtml);

    triggerToast(t('mockEmailSent', { email: reportEmail }), 'success');
    confetti({ particleCount: 50, spread: 40 });
    setEmailPreviewType(null);
  };

  // Attendance statistics formatted helper for manager UI
  const attendanceData = useMemo(() => {
    const data = dbService.getDispatcherAttendance();
    const rows: { date: string; name: string; first: string; last: string; hours: string; count: number }[] = [];
    
    Object.entries(data).forEach(([date, disps]) => {
      Object.entries(disps).forEach(([dispId, details]) => {
        const dispUser = users.find(u => u.id === dispId);
        const name = dispUser ? dispUser.name.replace(' (סדרן)', '') : (lang === 'he' ? 'סדרן' : 'Dispatcher');
        
        const first = new Date(details.firstScan);
        const last = new Date(details.lastScan);
        const diffMs = last.getTime() - first.getTime();
        const hours = (diffMs / (1000 * 60 * 60)).toFixed(2);
        
        const format = { hour: '2-digit' as const, minute: '2-digit' as const };
        rows.push({
          date,
          name,
          first: first.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', format),
          last: last.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', format),
          hours: hours === '0.00' ? (lang === 'he' ? 'נסיעה בודדת' : 'Single Trip') : (lang === 'he' ? `${hours} שעות` : `${hours} hours`),
          count: details.count
        });
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [scans, users, lang]);

  // Active SOS Alerts
  const sosAlerts = useMemo(() => {
    return dbService.getSOSAlerts();
  }, [activeLocations]);

  const handleClearSOS = (driverId: string) => {
    dbService.clearSOSAlert(driverId);
    triggerToast(t('sosCancelled'), 'success');
  };

  return (
    <div className="app-container">
      {/* Toast Messages Layer */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type === 'danger' ? 'toast-danger' : ''}`}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertOctagon size={18} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* NO USER SIGNED IN -> SHOW LOGIN SCREEN */}
      {!currentUser ? (
        <div 
          onPointerDown={handleLoginPointerDown}
          style={{ 
            flex: 1, 
            minHeight: '100dvh',
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '40px 20px', 
            background: '#05070c', 
            position: 'relative', 
            overflow: 'hidden',
            userSelect: 'none'
          }}
        >
          {/* Ambient Apple-style shifting glows in the background */}
          <div className="ambient-glow-1"></div>
          <div className="ambient-glow-2"></div>
          <div className="ambient-glow-3"></div>

          {/* Interactive touch-burst glows */}
          {loginRipples.map(ripple => (
            <div 
              key={ripple.id} 
              className="interactive-glow-blob" 
              style={{ left: `${ripple.x}px`, top: `${ripple.y}px` }} 
            />
          ))}

          {/* Language Switch Button (Top Left of Page) */}
          <button 
            onClick={() => setLang(lang === 'he' ? 'en' : 'he')} 
            style={{ 
              position: 'absolute', 
              left: '20px', 
              top: '20px', 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'var(--text-secondary)', 
              cursor: 'pointer', 
              fontSize: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              zIndex: 20,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            <span>🌐</span>
            <span>{lang === 'he' ? 'English' : 'עברית'}</span>
          </button>

          <div className="card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '40px 30px', background: 'rgba(18, 22, 32, 0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderColor: 'rgba(32, 38, 54, 0.6)', position: 'relative', zIndex: 10 }}>
            
            {/* Horizontal Brand Logo */}
            <div style={{ marginBottom: '24px' }}>
              <img src={logo} alt="Ohel Bus Logo" style={{ maxWidth: '240px', width: '100%', height: 'auto' }} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>{t('title')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '28px', lineHeight: '20px' }}>
              {t('subtitle')}
              <br/>{t('enterCode')}
            </p>

            <form onSubmit={handleCodeLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: lang === 'he' ? 'right' : 'left' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontSize: '13px', color: 'var(--text-secondary)' }}>{t('codeLabel')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder={t('codeLabel')}
                  style={{ textAlign: 'center', fontSize: '16px', letterSpacing: '2px', height: '46px', fontWeight: 'bold' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ height: '46px', fontSize: '14px', fontWeight: 'bold', justifyContent: 'center', marginTop: '4px' }}
              >
                {t('connectButton')}
              </button>
            </form>

            {/* Cloud connection status indicator removed */}
          </div>
        </div>
      ) : (
        /* LOGGED IN VIEW */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* ============================================================== */}
          {/* 1. DISPATCHER MOBILE VIEW (סדרן שטח) */}
          {/* ============================================================== */}
          {currentUser.role === 'dispatcher' && (
            <div className="role-mobile-wrapper">
              
              <div style={{ background: 'var(--bg-secondary)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>{t('dispatcherTitle')}</span>
                  <strong style={{ fontSize: '14px', color: '#fff' }}>{currentUser.name.replace(' (סדרן)', '')}</strong>
                </div>

                {/* Language Switch Button */}
                <button 
                  onClick={() => setLang(lang === 'he' ? 'en' : 'he')} 
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '6px',
                    padding: '4px 10px',
                    color: '#fff', 
                    cursor: 'pointer', 
                    fontSize: '11px', 
                    fontWeight: 'bold'
                  }}
                >
                  {lang === 'he' ? 'EN' : 'עב'}
                </button>
                
                <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>{t('gpsDetectedOrigin')}</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: currentDepartureLocation === '770' ? 'var(--accent)' : 'var(--info)' }}>
                    {currentDepartureLocation === '770' ? '770 Eastern Pkwy' : (lang === 'he' ? 'אוהל חב"ד' : 'Chabad Ohel')}
                  </span>
                </div>
              </div>

              {/* GPS & Network Simulator panel for Dispatcher Testing */}
              <div style={{ padding: '8px 16px', background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('dispatcherGps')}</span>
                  <button 
                    onClick={() => setGpsSource('770')}
                    className={`btn`} 
                    style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '4px', background: gpsSource === '770' ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: gpsSource === '770' ? '#000' : '#fff' }}
                  >
                    {t('near770')}
                  </button>
                  <button 
                    onClick={() => setGpsSource('ohel')}
                    className={`btn`}
                    style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '4px', background: gpsSource === 'ohel' ? 'var(--info)' : 'rgba(255,255,255,0.05)', color: gpsSource === 'ohel' ? '#fff' : '#fff' }}
                  >
                    {t('nearOhel')}
                  </button>
                  <button 
                    onClick={() => setGpsSource('real')}
                    className={`btn`}
                    style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '4px', background: gpsSource === 'real' ? 'var(--success)' : 'rgba(255,255,255,0.05)', color: gpsSource === 'real' ? '#000' : '#fff' }}
                  >
                    {t('realGps')}
                  </button>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('signal')}</span>
                  <button 
                    onClick={handleOfflineToggle}
                    className="btn" 
                    style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '4px', background: isOffline ? 'var(--danger-bg)' : 'var(--success-bg)', color: isOffline ? '#fca5a5' : '#a7f3d0', border: isOffline ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,185,129,0.2)' }}
                  >
                    {isOffline ? t('offline') : t('online')}
                  </button>
                </div>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {activeTab === 'scan' && (
                  <>
                    {/* Scanner Panel */}
                    <div className="card" style={{ padding: '24px' }}>
                      <h3 className="card-title">
                        <QrCode size={18} color="var(--accent)" />
                        {t('registerTrip')}
                      </h3>

                      {isOffline && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#fca5a5', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <WifiOff size={15} />
                          <span>{t('offlineActiveWarning', { count: dbService.getOfflineScansCount() })}</span>
                        </div>
                      )}

                      {/* In-app Camera Scanner UI component */}
                      <div style={{ marginBottom: '20px' }}>
                        {!showCameraScanner ? (
                          <button 
                            type="button" 
                            onClick={() => setShowCameraScanner(true)} 
                            className="btn btn-secondary" 
                            style={{ width: '100%', padding: '12px', justifyContent: 'center', gap: '8px', fontSize: '13px', background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)', color: 'var(--accent)' }}
                          >
                            <QrCode size={16} />
                            {t('cameraScan')}
                          </button>
                        ) : (
                          <div style={{ background: '#181e2e', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{t('cameraScanActive')}</span>
                              <button 
                                type="button" 
                                onClick={() => setShowCameraScanner(false)} 
                                className="btn btn-danger" 
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                {t('closeCamera')}
                              </button>
                            </div>
                            <div id="qr-reader" style={{ width: '100%', borderRadius: '8px', overflow: 'hidden' }}></div>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleCreateScan}>
                        <div className="form-group">
                          <label className="form-label">{t('driverLabel')}</label>
                          <select 
                            className="form-input form-select"
                            value={selectedDriverId}
                            onChange={(e) => setSelectedDriverId(e.target.value)}
                          >
                            <option value="">{t('selectDriver')}</option>
                            {driversList.map(drv => (
                              <option key={drv.id} value={drv.id}>
                                {drv.name.replace(' (נהג)', '')} ({drv.capacity} {lang === 'he' ? 'מקומות רכב' : 'seats'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">{t('passengersLabel')}</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="number" 
                              className="form-input" 
                              style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                              value={passengersCount === 0 ? '' : passengersCount}
                              onChange={(e) => setPassengersCount(Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="0"
                            />
                            
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button type="button" onClick={() => setPassengersCount(prev => prev + 5)} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>+5</button>
                              <button type="button" onClick={() => setPassengersCount(prev => prev + 10)} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>+10</button>
                              <button type="button" onClick={() => setPassengersCount(0)} className="btn btn-danger" style={{ padding: '8px 10px', fontSize: '12px' }}>{t('reset')}</button>
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">{t('manualGpsLabel')}</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button
                              type="button"
                              onClick={() => setManualDepartureLocation('770')}
                              className={`btn ${currentDepartureLocation === '770' ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ fontSize: '13px', background: currentDepartureLocation === '770' ? 'var(--accent)' : '', color: currentDepartureLocation === '770' ? '#000' : '' }}
                            >
                              770 ({lang === 'he' ? 'קראון הייטס' : 'Crown Heights'})
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => setManualDepartureLocation('Ohel')}
                              className={`btn ${currentDepartureLocation === 'Ohel' ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ fontSize: '13px', background: currentDepartureLocation === 'Ohel' ? 'var(--info)' : '', color: currentDepartureLocation === 'Ohel' ? '#fff' : '' }}
                            >
                              {lang === 'he' ? 'אוהל חב"ד (קווינס)' : 'Chabad Ohel (Queens)'}
                            </button>
                          </div>
                          {manualDepartureLocation && (
                            <button 
                              type="button" 
                              onClick={() => setManualDepartureLocation(null)}
                              style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer' }}
                            >
                              {t('backToAutoGps', { loc: autoDepartureLocation === '770' ? '770' : (lang === 'he' ? 'אוהל' : 'Ohel') })}
                            </button>
                          )}
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '10px' }}>
                          <CheckCircle size={16} />
                          {t('saveAndSendScan')}
                        </button>
                      </form>
                    </div>

                    {/* Last 2 Hours Departures Schedule */}
                    <div className="card" style={{ padding: '24px' }}>
                      <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={18} color="var(--accent)" />
                          <span>{lang === 'he' ? 'לו"ז יציאות (שעתיים אחרונות)' : 'Departures (Last 2 Hours)'}</span>
                        </div>
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                          {lastTwoHoursScans.length}
                        </span>
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                        {lastTwoHoursScans.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {lang === 'he' ? 'אין נסיעות בשעתיים האחרונות' : 'No departures in the last 2 hours'}
                          </div>
                        ) : (
                          lastTwoHoursScans.map(scan => (
                            <div 
                              key={scan.id} 
                              style={{ 
                                background: 'rgba(255, 255, 255, 0.02)', 
                                padding: '12px 14px', 
                                borderRadius: '8px', 
                                border: '1px solid var(--border-color)', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center' 
                              }}
                            >
                              <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <strong style={{ color: '#fff', fontSize: '14px' }}>{scan.driverName.replace(' (נהג)', '')}</strong>
                                  <span 
                                    style={{ 
                                      fontSize: '10px', 
                                      fontWeight: 'bold', 
                                      padding: '2px 6px', 
                                      borderRadius: '4px', 
                                      background: scan.departureLocation === '770' ? 'rgba(226, 176, 78, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                                      color: scan.departureLocation === '770' ? 'var(--accent)' : 'var(--accent-route-ohel)',
                                      border: scan.departureLocation === '770' ? '1px solid rgba(226, 176, 78, 0.2)' : '1px solid rgba(6, 182, 212, 0.2)'
                                    }}
                                  >
                                    {scan.departureLocation === '770' ? (lang === 'he' ? 'מ-770' : 'From 770') : (lang === 'he' ? 'מהאוהל' : 'From Ohel')}
                                  </span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  {lang === 'he' ? 'יציאה בשעה' : 'Departure time'}: {new Date(scan.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                                <span className="badge badge-success" style={{ display: 'inline-block', marginBottom: '4px' }}>
                                  {scan.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                                </span>
                                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)' }}>
                                  {lang === 'he' ? `פנוי: ${scan.remainingSeats} מקומות` : `Free: ${scan.remainingSeats} seats`}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'my-history' && (
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{t('myScansTodayTitle')}</h3>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {lang === 'he' ? `תאריך עבודה: ${formatHebrewAndGregorianDate(logicalToday)}` : t('logicalDateLabel', { date: logicalToday })}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('scannedTrips')}</span>
                        <strong style={{ fontSize: '18px', color: 'var(--accent)', display: 'block' }}>{myScansToday.length}</strong>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('totalBoardedPassengers')}</span>
                        <strong style={{ fontSize: '18px', color: 'var(--success)', display: 'block' }}>
                          {myScansToday.reduce((sum, s) => sum + s.passengersCount, 0)}
                        </strong>
                      </div>
                    </div>

                    {/* Today's Scans List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                      {myScansToday.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {t('noScansTodayField')}
                        </div>
                      ) : (
                        myScansToday.map(scan => (
                          <div key={scan.id} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                              <strong style={{ color: '#fff', fontSize: '14px', display: 'block' }}>{scan.driverName.replace(' (נהג)', '')}</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {t('time')}: {new Date(scan.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })} | {t('departure')}: {scan.departureLocation === '770' ? '770' : (lang === 'he' ? 'אוהל' : 'Ohel')}
                              </span>
                            </div>
                            <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                              <span className="badge badge-success">
                                {scan.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Daily History Groups */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px', textAlign: lang === 'he' ? 'right' : 'left' }}>
                        {lang === 'he' ? 'היסטוריית סריקות יומית' : 'Daily Scans History'}
                      </h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {myScansHistoryByDay.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {lang === 'he' ? 'אין היסטוריית נסיעות' : 'No scans history'}
                          </div>
                        ) : (
                          myScansHistoryByDay.map(group => {
                            const isExpanded = !!expandedDays[group.date];
                            return (
                              <div key={group.date} style={{ background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                <div 
                                  onClick={() => toggleDayExpanded(group.date)}
                                  style={{ 
                                    padding: '12px 14px', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.02)'
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: lang === 'he' ? 'right' : 'left' }}>
                                    <strong style={{ fontSize: '13px', color: '#fff' }}>
                                      {formatHebrewAndGregorianDate(group.date)}
                                    </strong>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      {lang === 'he' ? `${group.scansCount} סבבים | סה"ך ${group.passengersSum} נוסעים` : `${group.scansCount} trips | ${group.passengersSum} passengers`}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                      {isExpanded ? '▲' : '▼'}
                                    </span>
                                  </div>
                                </div>
                                
                                {isExpanded && (
                                  <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                                    {group.scans.map(scan => (
                                      <div key={scan.id} style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                                          <strong style={{ color: '#fff', fontSize: '12px', display: 'block' }}>{scan.driverName.replace(' (נהג)', '')}</strong>
                                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                            {t('time')}: {new Date(scan.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })} | {t('departure')}: {scan.departureLocation === '770' ? '770' : (lang === 'he' ? 'אוהל' : 'Ohel')}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 6px' }}>
                                            {scan.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dispatcher Bottom Menu */}
              <nav className="bottom-nav">
                <button 
                  onClick={() => setActiveTab('scan')} 
                  className={`bottom-nav-item ${activeTab === 'scan' ? 'active' : ''}`}
                >
                  <QrCode size={18} />
                  <span>{t('scanDriverTab')}</span>
                </button>
                
                <button 
                  onClick={() => setActiveTab('my-history')} 
                  className={`bottom-nav-item ${activeTab === 'my-history' ? 'active' : ''}`}
                >
                  <Calendar size={18} />
                  <span>{t('todayScansCount', { count: myScansToday.length })}</span>
                </button>

                <div className="bottom-nav-item" style={{ opacity: 0.25, cursor: 'not-allowed' }}>
                  <MapPin size={18} />
                  <span>{t('driversMapTab')}</span>
                </div>

                <button onClick={handleLogout} className="bottom-nav-item">
                  <LogOut size={18} />
                  <span>{t('logout')}</span>
                </button>
              </nav>

            </div>
          )}

          {/* ============================================================== */}
          {/* 2. DRIVER MOBILE VIEW (נהג הסעה) */}
          {/* ============================================================== */}
          {currentUser.role === 'driver' && (
            <div className="role-mobile-wrapper">
              
              <div style={{ background: 'var(--bg-secondary)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>{t('driverTitle')}</span>
                  <strong style={{ fontSize: '14px', color: '#fff' }}>{currentUser.name.replace(' (נהג)', '')}</strong>
                </div>

                {/* Language Switch Button */}
                <button 
                  onClick={() => setLang(lang === 'he' ? 'en' : 'he')} 
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '6px',
                    padding: '4px 10px',
                    color: '#fff', 
                    cursor: 'pointer', 
                    fontSize: '11px', 
                    fontWeight: 'bold'
                  }}
                >
                  {lang === 'he' ? 'EN' : 'עב'}
                </button>
                
                <div>
                  {(() => {
                    const loc = activeLocations.find(l => l.id === currentUser.id);
                    const status = loc?.status || 'idle';
                    let badgeClass = 'badge-secondary';
                    let text = t('statusIdle');
                    if (status === 'en_route') {
                      badgeClass = 'badge-warning';
                      text = t('statusEnRoute');
                    } else if (status === 'break') {
                      badgeClass = 'badge-danger';
                      text = t('statusBreak');
                    }
                    return (
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '12px', padding: '4px 8px' }}>
                        {text}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {activeTab === 'qr' && (() => {
                  const loc = activeLocations.find(l => l.id === currentUser.id);
                  const isDriverEnRoute = loc?.status === 'en_route';
                  const currentDriverEta = loc?.etaMinutes;
                  const currentDriverDirection = loc?.direction;

                  return isDriverEnRoute ? (
                    <div className="card" style={{ padding: '30px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                        <div className="pulsing-glow" style={{ background: 'rgba(226, 176, 78, 0.1)', padding: '16px', borderRadius: '50%' }}>
                          <Navigation size={32} color="var(--accent)" />
                        </div>
                      </div>

                      <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
                        {lang === 'he' ? 'נסיעה פעילה בעיצומה' : 'Active trip in progress'}
                      </h3>
                      
                      <p style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 'bold', marginBottom: '24px' }}>
                        {currentDriverDirection === 'to_ohel' 
                          ? (lang === 'he' ? 'מסלול: מ-770 לאוהל חב"ד ➔' : 'Route: From 770 to Chabad Ohel ➔')
                          : (lang === 'he' ? 'מסלול: מהאוהל ל-770 ➔' : 'Route: From Ohel to 770 ➔')
                        }
                      </p>

                      {/* Google Maps Navigation button */}
                      <a 
                        href={currentDriverDirection === 'to_ohel' 
                          ? "https://www.google.com/maps/dir/?api=1&destination=Chabad+Ohel" 
                          : "https://www.google.com/maps/dir/?api=1&destination=770+Eastern+Parkway"
                        }
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-secondary" 
                        style={{ 
                          width: '100%', 
                          padding: '12px', 
                          fontSize: '14px', 
                          marginBottom: '20px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px',
                          background: 'rgba(255,255,255,0.05)',
                          borderColor: 'var(--border-color)',
                          color: '#fff',
                          textDecoration: 'none'
                        }}
                      >
                        <Map size={16} />
                        {lang === 'he' ? 'פתח ניווט ב-Google Maps' : 'Open Google Maps Navigation'}
                      </a>

                      {/* Estimated Arrival Time (ETA) Slider/Selection */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginBottom: '24px', textAlign: lang === 'he' ? 'right' : 'left' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                          {lang === 'he' ? 'עדכן זמן הגעה משוער (דקות):' : 'Update Estimated Arrival (minutes):'}
                        </h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
                          {[15, 30, 45, 60].map(mins => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => {
                                dbService.updateDriverEta(currentUser.id, mins);
                                triggerToast(lang === 'he' ? `זמן הגעה עודכן ל-${mins} דקות` : `ETA updated to ${mins} minutes`, 'success');
                              }}
                              className={`btn ${currentDriverEta === mins ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ 
                                fontSize: '12px', 
                                padding: '8px 2px',
                                background: currentDriverEta === mins ? 'var(--accent)' : '',
                                color: currentDriverEta === mins ? '#000' : '',
                                borderColor: currentDriverEta === mins ? 'var(--accent)' : 'var(--border-color)'
                              }}
                            >
                              {mins} {lang === 'he' ? "דק'" : "m"}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="number"
                            placeholder={lang === 'he' ? "דקות אחר..." : "Other mins..."}
                            value={customEtaInput || ''}
                            onChange={(e) => setCustomEtaInput(parseInt(e.target.value) || 0)}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#fff',
                              fontSize: '13px'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (customEtaInput > 0) {
                                dbService.updateDriverEta(currentUser.id, customEtaInput);
                                triggerToast(lang === 'he' ? `זמן הגעה עודכן ל-${customEtaInput} דקות` : `ETA updated to ${customEtaInput} minutes`, 'success');
                                setCustomEtaInput(0);
                              }
                            }}
                            className="btn btn-primary"
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                          >
                            {lang === 'he' ? 'עדכן' : 'Update'}
                          </button>
                        </div>
                      </div>

                      {/* End Trip button */}
                      <button 
                        onClick={() => {
                          handleDriverStatusChange('idle');
                          triggerToast(lang === 'he' ? 'הנסיעה הסתיימה בהצלחה' : 'Trip ended successfully', 'success');
                        }}
                        className="btn btn-primary" 
                        style={{ 
                          width: '100%', 
                          padding: '14px', 
                          fontSize: '15px', 
                          fontWeight: 'bold',
                          background: 'var(--success)',
                          color: '#000',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <CheckCircle size={16} />
                        {lang === 'he' ? 'הגעתי ליעד (סיים נסיעה)' : 'Arrived at Destination (End Trip)'}
                      </button>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: '30px 20px', textAlign: 'center' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', color: '#fff' }}>{t('yourPersonalQrTitle')}</h3>
                      
                      <div style={{ background: '#fff', padding: '14px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px' }}>
                        <div style={{ border: '2px solid #000', padding: '4px' }}>
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.protocol}//${window.location.host}/?driverId=${currentUser.id}`)}`} 
                            alt="Driver QR Code" 
                            style={{ display: 'block' }}
                          />
                        </div>
                      </div>
                      
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '300px', margin: '0 auto 20px', lineHeight: '18px', textAlign: 'center' }}>
                        {t('scanGuidance')}
                        <br/>{t('scanGuidance2')}
                      </p>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px', textAlign: lang === 'he' ? 'right' : 'left' }}>{t('updateStatus')}</h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                          <button
                            onClick={() => handleDriverStatusChange('idle')}
                            className="btn btn-secondary"
                            style={{ 
                              fontSize: '12px', 
                              padding: '10px 4px', 
                              borderColor: loc?.status === 'idle' ? 'var(--success)' : ''
                            }}
                          >
                            {t('statusIdle')}
                          </button>
                          
                          <button
                            onClick={() => handleDriverStatusChange('en_route')}
                            className="btn btn-secondary"
                            style={{ 
                              fontSize: '12px', 
                              padding: '10px 4px',
                              borderColor: loc?.status === 'en_route' ? 'var(--accent)' : ''
                            }}
                          >
                            {t('statusEnRoute')}
                          </button>

                          <button
                            onClick={() => handleDriverStatusChange('break')}
                            className="btn btn-secondary"
                            style={{ 
                              fontSize: '12px', 
                              padding: '10px 4px',
                              borderColor: loc?.status === 'break' ? 'var(--danger)' : ''
                            }}
                          >
                            {t('statusBreak')}
                          </button>
                        </div>
                      </div>

                      {/* SOS Emergency button */}
                      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '20px' }}>
                        <button 
                          onClick={handleSOSClick}
                          className="btn btn-danger" 
                          style={{ 
                            width: '100%', 
                            padding: '12px', 
                            fontSize: '14px', 
                            fontWeight: 'bold',
                            boxShadow: (loc as any)?.sosAlert ? '0 0 12px rgba(239,68,68,0.5)' : '',
                          }}
                        >
                          <AlertTriangle size={16} />
                          { (loc as any)?.sosAlert ? t('cancelSosButton') : t('triggerSosButton') }
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {activeTab === 'my-trips' && (
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{t('myTripsTodayTitle')}</h3>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {lang === 'he' ? `תאריך עבודה: ${formatHebrewAndGregorianDate(logicalToday)}` : t('logicalDateLabel', { date: logicalToday })}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('driverTripsCompleted')}</span>
                        <strong style={{ fontSize: '18px', color: 'var(--accent)', display: 'block' }}>{myTripsToday.length}</strong>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('driverPassengersTotal')}</span>
                        <strong style={{ fontSize: '18px', color: 'var(--success)', display: 'block' }}>
                          {myTripsToday.reduce((sum, s) => sum + s.passengersCount, 0)}
                        </strong>
                      </div>
                    </div>

                    {/* Today's Trips List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                      {myTripsToday.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {t('driverNoTripsToday')}
                        </div>
                      ) : (
                        myTripsToday.map(trip => (
                          <div key={trip.id} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                              <strong style={{ color: '#fff', fontSize: '14px', display: 'block' }}>
                                {t('departureFrom', { loc: trip.departureLocation === '770' ? (lang === 'he' ? '770 קראון הייטס' : '770 Crown Heights') : (lang === 'he' ? 'אוהל חב"ד' : 'Chabad Ohel') })}
                              </strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {t('departureTimeAndDispatcher', { time: new Date(trip.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' }), dispatcher: trip.dispatcherName })}
                              </span>
                            </div>
                            <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                              <span className="badge badge-success">
                                {trip.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Toggle past history button */}
                    <button
                      onClick={() => setShowDriverHistory(!showDriverHistory)}
                      className="btn btn-secondary"
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: 'rgba(255,255,255,0.03)',
                        borderColor: 'var(--border-color)',
                        color: '#fff',
                        marginTop: '16px'
                      }}
                    >
                      <Calendar size={14} />
                      {showDriverHistory 
                        ? (lang === 'he' ? 'הסתר היסטוריית נסיעות קודמות' : 'Hide Past Trips History')
                        : (lang === 'he' ? 'הצג היסטוריית נסיעות קודמות' : 'Show Past Trips History')
                      }
                    </button>

                    {/* Daily History Groups */}
                    {showDriverHistory && (
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px', textAlign: lang === 'he' ? 'right' : 'left' }}>
                          {lang === 'he' ? 'היסטוריית נסיעות יומית' : 'Daily Trips History'}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {myTripsHistoryByDay.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                              {lang === 'he' ? 'אין היסטוריית נסיעות' : 'No trips history'}
                            </div>
                          ) : (
                            myTripsHistoryByDay.map(group => {
                              const isExpanded = !!expandedDays[group.date];
                              return (
                                <div key={group.date} style={{ background: 'rgba(255, 255, 255, 0.01)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                  <div 
                                    onClick={() => toggleDayExpanded(group.date)}
                                    style={{ 
                                      padding: '12px 14px', 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center', 
                                      cursor: 'pointer',
                                      background: 'rgba(255,255,255,0.02)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: lang === 'he' ? 'right' : 'left' }}>
                                      <strong style={{ fontSize: '13px', color: '#fff' }}>
                                        {formatHebrewAndGregorianDate(group.date)}
                                      </strong>
                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        {lang === 'he' ? `${group.tripsCount} סבבים | סה"ך ${group.passengersSum} נוסעים` : `${group.tripsCount} trips | ${group.passengersSum} passengers`}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {isExpanded ? '▲' : '▼'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {isExpanded && (
                                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
                                      {group.trips.map(trip => (
                                        <div key={trip.id} style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                                            <strong style={{ color: '#fff', fontSize: '12px', display: 'block' }}>
                                              {t('departureFrom', { loc: trip.departureLocation === '770' ? (lang === 'he' ? '770 קראון הייטס' : '770 Crown Heights') : (lang === 'he' ? 'אוהל חב"ד' : 'Chabad Ohel') })}
                                            </strong>
                                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                              {t('departureTimeAndDispatcher', { time: new Date(trip.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' }), dispatcher: trip.dispatcherName })}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 6px' }}>
                                              {trip.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Driver Bottom Menu */}
              <nav className="bottom-nav">
                <button 
                  onClick={() => setActiveTab('qr')} 
                  className={`bottom-nav-item ${activeTab === 'qr' ? 'active' : ''}`}
                >
                  <QrCode size={18} />
                  <span>{t('myQrTab')}</span>
                </button>
                
                <button 
                  onClick={() => setActiveTab('my-trips')} 
                  className={`bottom-nav-item ${activeTab === 'my-trips' ? 'active' : ''}`}
                >
                  <Calendar size={18} />
                  <span>{t('myTripsCount', { count: myTripsToday.length })}</span>
                </button>

                <div className="bottom-nav-item" style={{ opacity: 0.25, cursor: 'not-allowed' }}>
                  <MapPin size={18} />
                  <span>{t('liveGpsStreamTab')}</span>
                </div>

                <button onClick={handleLogout} className="bottom-nav-item">
                  <LogOut size={18} />
                  <span>{t('logout')}</span>
                </button>
              </nav>

            </div>
          )}

          {/* ============================================================== */}
          {/* 3. MANAGER DESKTOP VIEW (דאשבורד מנהל מורחב - סרגל צדי) */}
          {/* ============================================================== */}
          {currentUser.role === 'admin' && (
            <div className="desktop-layout">
              {/* MOBILE HEADER */}
              <header className="mobile-manager-header" style={{ display: 'none', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 1000 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={logo} alt="Ohel Bus Logo" style={{ height: '32px' }} />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{t('title')}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    onClick={() => setLang(lang === 'he' ? 'en' : 'he')} 
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 10px', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {lang === 'he' ? 'EN' : 'עב'}
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="btn btn-danger" 
                    style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              </header>
              
              {/* DESKTOP SIDEBAR MENU (Human designed feel) */}
              <aside className="desktop-sidebar">
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <img src={logo} alt="Ohel Bus Logo" style={{ height: '36px', width: 'auto', maxWidth: '120px' }} />
                  <button 
                    onClick={() => setLang(lang === 'he' ? 'en' : 'he')} 
                    style={{ 
                      background: 'rgba(255,255,255,0.05)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: '#fff', 
                      cursor: 'pointer', 
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    {lang === 'he' ? 'EN' : 'עב'}
                  </button>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12px', marginBottom: '20px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('connectedUser')}</span>
                  <strong style={{ color: '#fff', fontSize: '13px' }}>{currentUser.name.replace(' (מנהל)', '')}</strong>
                </div>

                <nav className="sidebar-nav">
                  <button 
                    onClick={() => setActiveTab('dashboard')} 
                    className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  >
                    <MapPin size={16} />
                    <span>{t('managerDashboard')}</span>
                  </button>
                  
                  <button 
                    onClick={() => setActiveTab('history')} 
                    className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
                  >
                    <Calendar size={16} />
                    <span>{t('fleetActivity')}</span>
                  </button>

                  <button 
                    onClick={() => setActiveTab('users')} 
                    className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
                  >
                    <Users size={16} />
                    <span>{t('usersManagement')}</span>
                  </button>

                  <button 
                    onClick={() => setActiveTab('settings')} 
                    className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
                  >
                    <Settings size={16} />
                    <span>{t('settings')}</span>
                  </button>
                </nav>

                <div style={{ marginTop: 'auto' }}>
                  <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', padding: '10px', fontSize: '13px' }}>
                    <LogOut size={14} />
                    <span>{t('logout')}</span>
                  </button>
                </div>
              </aside>

              {/* MAIN CONTENT AREA */}
              <main className="desktop-content">
                
                {/* TAB 1: DASHBOARD & LIVE MAP */}
                {activeTab === 'dashboard' && (
                  <>
                    {/* Header line */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>{t('managerDashboardTitle')}</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('managerDashboardSubtitle')}</p>
                      </div>
                       <div style={{ fontSize: '14px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                         {lang === 'he' ? `תאריך עבודה לוגי: ${formatHebrewAndGregorianDate(logicalToday)}` : t('logicalWorkDateText', { date: logicalToday })}
                       </div>
                    </div>

                    {/* Stats Widget Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: 'rgba(226, 176, 78, 0.1)', color: 'var(--accent)', padding: '12px', borderRadius: '8px' }}>
                          <RefreshCw size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('tripsCompletedToday')}</span>
                          <strong style={{ fontSize: '24px', display: 'block', color: '#fff', fontWeight: 800 }}>{stats.tripsToday}</strong>
                        </div>
                      </div>

                      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '12px', borderRadius: '8px' }}>
                          <Users size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('totalPassengersToday')}</span>
                          <strong style={{ fontSize: '24px', display: 'block', color: '#fff', fontWeight: 800 }}>{stats.passengersToday}</strong>
                        </div>
                      </div>

                      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', padding: '12px', borderRadius: '8px' }}>
                          <UserCheck size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('driversActiveToday')}</span>
                          <strong style={{ fontSize: '24px', display: 'block', color: '#fff', fontWeight: 800 }}>{stats.activeDrivers}</strong>
                        </div>
                      </div>

                      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '12px', borderRadius: '8px' }}>
                          <ShieldAlert size={22} />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('dispatchersActiveToday')}</span>
                          <strong style={{ fontSize: '24px', display: 'block', color: '#fff', fontWeight: 800 }}>{stats.activeDispatchers}</strong>
                        </div>
                      </div>
                    </div>

                    {/* SOS Alert box */}
                    {sosAlerts.length > 0 && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--danger)', padding: '16px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <AlertTriangle size={24} color="var(--danger)" />
                          <div>
                            <strong style={{ color: '#fff', fontSize: '15px' }}>{t('sosAlertBannerTitle')}</strong>
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {t('sosAlertBannerSubtitle', { names: sosAlerts.map(a => a.name).join(', ') })}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {sosAlerts.map(a => (
                            <button key={a.id} onClick={() => handleClearSOS(a.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px' }}>
                              {t('clearSosForDriverButton', { name: a.name })}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Map & Live list grid */}
                    <div className="dashboard-grid">
                      <LiveMap 
                        locations={activeLocations} 
                        sosAlerts={sosAlerts}
                        onClearSOS={handleClearSOS}
                        lang={lang}
                      />

                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '400px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                          <Clock size={16} color="var(--accent)" />
                          {t('fleetStatus')}
                        </h3>
                        
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {activeLocations.filter(loc => loc.role === 'driver').map(drv => {
                            const isSOS = sosAlerts.some(a => a.id === drv.id);
                            return (
                              <div 
                                key={drv.id} 
                                style={{ 
                                  padding: '10px 12px', 
                                  borderRadius: '8px', 
                                  border: '1px solid var(--border-color)', 
                                  background: isSOS ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.01)',
                                  borderColor: isSOS ? 'rgba(239, 68, 68, 0.25)' : '',
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center' 
                                }}
                              >
                                <div>
                                  <strong style={{ color: '#fff', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {drv.name}
                                    {isSOS && <span style={{ background: 'var(--danger)', color: '#fff', fontSize: '9px', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>SOS</span>}
                                  </strong>
                                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {drv.status === 'break' ? t('statusBreak') : drv.status === 'en_route' ? t('statusEnRoute') : t('statusIdle')}
                                    {drv.status === 'en_route' && drv.direction && (
                                      <>
                                        {' '}
                                        {drv.direction === 'to_ohel' ? t('directionToOhel') : t('directionTo770')}
                                      </>
                                    )}
                                  </span>
                                </div>

                                <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                                  {drv.status === 'en_route' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: lang === 'he' ? 'flex-end' : 'flex-start' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent)' }}>
                                        {lang === 'he' ? `זמן נסיעה נותר: כ-${drv.etaMinutes || 25} דקות` : `Remaining: ~${drv.etaMinutes || 25} min`}
                                      </span>
                                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        {lang === 'he' ? '(לפי עומס תנועה)' : '(via Google Maps)'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      {lang === 'he' ? 'לא בנסיעה / ממתין' : 'Not en route / Idle'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 2: GLOBAL ACTIVITY LOG */}
                {activeTab === 'history' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{t('managerScansTitle')}</h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('managerScansSub')}</p>
                      </div>
                      
                      {/* Filters */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button 
                          onClick={handleExportScansToCsv}
                          className="btn btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', fontSize: '13px' }}
                        >
                          <Download size={14} />
                          {lang === 'he' ? 'ייצא לאקסל' : 'Export to Excel'}
                        </button>

                        <div style={{ position: 'relative' }}>
                          <Search size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ width: '220px', paddingRight: '36px', height: '38px', fontSize: '13px' }}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder={t('searchPlaceholder')}
                          />
                        </div>

                        <input 
                          type="date" 
                          className="form-input" 
                          style={{ width: '150px', height: '38px', fontSize: '13px' }}
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                        />
                        {dateFilter && (
                          <button 
                            onClick={() => setDateFilter('')}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {t('clearDate')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="desktop-scans-table">
                      <div className="table-container">
                        <table className="tp-table">
                          <thead>
                            <tr>
                              <th>{t('timeHeader')}</th>
                              <th>{t('logicalDateHeader')}</th>
                              <th>{t('driver')}</th>
                              <th>{t('scannerDispatcherHeader')}</th>
                              <th>{t('originHeader')}</th>
                              <th style={{ textAlign: 'center' }}>{t('passengersBoardedHeader')}</th>
                              <th style={{ textAlign: 'center' }}>{t('emptySeatsHeader')}</th>
                              <th style={{ textAlign: 'center' }}>{t('actionsHeader')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredScans.length === 0 ? (
                              <tr>
                                <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  {t('noMatchingScans')}
                                </td>
                              </tr>
                            ) : (
                              filteredScans.map(scan => (
                                <tr key={scan.id}>
                                  <td>{new Date(scan.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                  <td>{lang === 'he' ? formatHebrewAndGregorianDate(scan.logicalDate) : scan.logicalDate}</td>
                                  <td><strong>{scan.driverName}</strong></td>
                                  <td>{scan.dispatcherName}</td>
                                  <td>
                                    <span style={{ color: scan.departureLocation === '770' ? 'var(--accent)' : 'var(--info)', fontWeight: 'bold' }}>
                                      {scan.departureLocation === '770' ? (lang === 'he' ? '770 קראון הייטס' : '770 Crown Heights') : (lang === 'he' ? 'אוהל חב"ד' : 'Chabad Ohel')}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--success)' }}>{scan.passengersCount}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    {scan.remainingSeats} / {scan.driverCapacity}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                      <button onClick={() => handleEditScanClick(scan)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                                        <Edit size={11} />
                                        {t('edit')}
                                      </button>
                                      <button onClick={() => handleDeleteScan(scan.id)} className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '11px' }}>
                                        <Trash size={11} />
                                        {t('delete')}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Scans Card List */}
                    <div className="mobile-scans-cards" style={{ flexDirection: 'column', gap: '16px' }}>
                      {filteredScans.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {t('noMatchingScans')}
                        </div>
                      ) : (
                        filteredScans.map(scan => (
                          <div key={scan.id} className="card user-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {new Date(scan.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span style={{ color: scan.departureLocation === '770' ? 'var(--accent)' : 'var(--info)', fontWeight: 'bold', fontSize: '13px' }}>
                                {scan.departureLocation === '770' ? (lang === 'he' ? '770 קראון הייטס' : '770 Crown Heights') : (lang === 'he' ? 'אוהל חב"ד' : 'Chabad Ohel')}
                              </span>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('driver')}</span>
                                <strong style={{ color: '#fff' }}>{scan.driverName}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('scannerDispatcherHeader')}</span>
                                <span style={{ color: '#fff' }}>{scan.dispatcherName}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('passengersBoardedHeader')}</span>
                                <strong style={{ color: 'var(--success)', fontSize: '15px' }}>{scan.passengersCount}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('emptySeatsHeader')}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{scan.remainingSeats} / {scan.driverCapacity}</span>
                              </div>
                            </div>
                            
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
                              {lang === 'he' ? formatHebrewAndGregorianDate(scan.logicalDate) : scan.logicalDate}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                              <button onClick={() => handleEditScanClick(scan)} className="btn btn-secondary" style={{ flex: 1, padding: '8px 12px', fontSize: '12px', justifyContent: 'center' }}>
                                <Edit size={12} />
                                {t('edit')}
                              </button>
                              <button onClick={() => handleDeleteScan(scan.id)} className="btn btn-danger" style={{ flex: 1, padding: '8px 12px', fontSize: '12px', justifyContent: 'center' }}>
                                <Trash size={12} />
                                {t('delete')}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* EDIT MODAL DIALOG MOCK */}
                    {selectedScanForEdit && (
                      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
                        <div className="card" style={{ maxWidth: '400px', width: '90%', padding: '24px', background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#fff' }}>{t('editTripTitle')}</h3>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '20px' }}>
                            {t('editTripSubtitle', { driver: selectedScanForEdit.driverName })}
                            <br/>{t('editTripMeta', { dispatcher: selectedScanForEdit.dispatcherName, time: new Date(selectedScanForEdit.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US') })}
                          </p>

                          <div className="form-group">
                            <label className="form-label">{t('passengersCountLabel')}</label>
                            <input 
                              type="number" 
                              className="form-input"
                              value={editPassengersCount}
                              onChange={(e) => setEditPassengersCount(Math.max(0, parseInt(e.target.value) || 0))}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">{t('originHeader')}</label>
                            <select 
                              className="form-input form-select"
                              value={editDepartureLocation}
                              onChange={(e) => setEditDepartureLocation(e.target.value as DepartureLocation)}
                            >
                              <option value="770">770 ({lang === 'he' ? 'קראון הייטס' : 'Crown Heights'})</option>
                              <option value="Ohel">{lang === 'he' ? 'אוהל חב"ד (קווינס)' : 'Chabad Ohel (Queens)'}</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                            <button onClick={handleSaveEditScan} className="btn btn-primary" style={{ flex: 1 }}>{t('saveChanges')}</button>
                            <button onClick={() => setSelectedScanForEdit(null)} className="btn btn-secondary" style={{ flex: 1 }}>{t('cancel')}</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Attendance Grid */}
                    <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                        <Clock size={16} color="var(--accent)" />
                        {t('dispatcherAttendanceHeader')}
                      </h3>
                      
                      <div className="table-container">
                        <table className="tp-table">
                          <thead>
                            <tr>
                              <th>{t('workDate')}</th>
                              <th>{t('fieldDispatcher')}</th>
                              <th style={{ textAlign: 'center' }}>{t('firstScanIn')}</th>
                              <th style={{ textAlign: 'center' }}>{t('lastScanOut')}</th>
                              <th style={{ textAlign: 'center' }}>{t('totalHoursCalculated')}</th>
                              <th style={{ textAlign: 'center' }}>{t('tripsScannedCount')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceData.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  {t('noAttendanceData')}
                                </td>
                              </tr>
                            ) : (
                              attendanceData.map((row, idx) => (
                                <tr key={idx}>
                                  <td>{row.date}</td>
                                  <td><strong>{row.name}</strong></td>
                                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.first}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.last}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--success)' }}>{row.hours}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{t('tripsCountText', { count: row.count })}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 3: USER MANAGEMENT */}
                {activeTab === 'users' && (
                  <div className="users-grid">
                    
                    {/* Add user form */}
                    <div className="card">
                      <h3 className="card-title">
                        <Plus size={16} color="var(--accent)" />
                        {t('addUser')}
                      </h3>
                      
                      <form onSubmit={handleCreateUser}>
                        <div className="form-group">
                          <label className="form-label">{t('userName')}</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder={t('namePlaceholder')}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">{t('phoneLabel')}</label>
                          <input 
                            type="tel" 
                            className="form-input" 
                            value={newUserPhone}
                            onChange={(e) => setNewUserPhone(e.target.value)}
                            placeholder={t('phonePlaceholder')}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">{t('passcodeLabel')}</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={newUserCode}
                            onChange={(e) => setNewUserCode(e.target.value)}
                            placeholder={t('enterPasscode')}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">{t('userRole')}</label>
                          <select 
                            className="form-input form-select"
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value as any)}
                          >
                            <option value="driver">{t('roleDriver')}</option>
                            <option value="dispatcher">{t('roleDispatcher')}</option>
                            <option value="admin">{t('roleAdmin')}</option>
                          </select>
                        </div>

                        {newUserRole === 'driver' && (
                          <div className="form-group">
                            <label className="form-label">{t('capacityLabel')}</label>
                            <input 
                              type="number" 
                              className="form-input" 
                              value={newUserCapacity}
                              onChange={(e) => setNewUserCapacity(Math.max(1, parseInt(e.target.value) || 15))}
                            />
                          </div>
                        )}

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                          <Plus size={14} />
                          {t('createUser')}
                        </button>
                      </form>
                    </div>

                    {/* Users list card */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>
                          {t('usersListTitle')}
                        </h3>
                        <button 
                          onClick={handleExportUsersToCsv}
                          className="btn btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                        >
                          <Download size={12} />
                          {lang === 'he' ? 'ייצא לאקסל' : 'Export to Excel'}
                        </button>
                      </div>

                      {/* Desktop Table View */}
                      <div className="table-container desktop-users-table">
                        <table className="tp-table">
                          <thead>
                            <tr>
                              <th>{t('userName')}</th>
                              <th>{t('phoneLabel')}</th>
                              <th>{t('userRole')}</th>
                              <th style={{ textAlign: 'center' }}>{t('passcodeLabel')}</th>
                              <th style={{ textAlign: 'center' }}>{t('capacityLabel')}</th>
                              <th style={{ textAlign: 'center' }}>{t('actionsHeader')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u.id}>
                                <td><strong>{u.name}</strong></td>
                                <td>{u.phone}</td>
                                <td>
                                  <span className={`badge ${
                                    u.role === 'admin' ? 'badge-danger' : u.role === 'dispatcher' ? 'badge-success' : 'badge-warning'
                                  }`}>
                                    {u.role === 'admin' ? t('adminRole') : u.role === 'dispatcher' ? t('dispatcherRole') : t('driverRole')}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                  <span style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', border: '1px solid #334155', color: 'var(--accent)', fontSize: '12px', fontFamily: 'monospace' }}>
                                    {u.code}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  {u.role === 'driver' ? t('seatsCountText', { count: u.capacity }) : '-'}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button 
                                      onClick={() => handleEditUserClick(u)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                                    >
                                      <Edit size={11} />
                                      {t('edit')}
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteUser(u.id)} 
                                      className="btn btn-danger" 
                                      style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} 
                                      disabled={u.id === 'usr_admin'} 
                                    >
                                      <Trash size={11} />
                                      {t('delete')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="mobile-users-cards" style={{ flexDirection: 'column', gap: '12px' }}>
                        {users.map(u => (
                          <div key={u.id} className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '15px', color: '#fff' }}>{u.name}</strong>
                              <span className={`badge ${
                                u.role === 'admin' ? 'badge-danger' : u.role === 'dispatcher' ? 'badge-success' : 'badge-warning'
                              }`}>
                                {u.role === 'admin' ? t('adminRole') : u.role === 'dispatcher' ? t('dispatcherRole') : t('driverRole')}
                              </span>
                            </div>
                            
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div><strong>{lang === 'he' ? 'טלפון:' : 'Phone:'}</strong> {u.phone}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong>{lang === 'he' ? 'קוד כניסה:' : 'Passcode:'}</strong>
                                <span style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--accent)', fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold' }}>
                                  {u.code}
                                </span>
                              </div>
                              {u.role === 'driver' && (
                                <div><strong>{lang === 'he' ? 'קיבולת:' : 'Capacity:'}</strong> {t('seatsCountText', { count: u.capacity })}</div>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                              <button 
                                onClick={() => handleEditUserClick(u)} 
                                className="btn btn-secondary" 
                                style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px' }} 
                              >
                                <Edit size={14} />
                                {t('edit')}
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(u.id)} 
                                className="btn btn-danger" 
                                style={{ flex: 1, padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '36px' }} 
                                disabled={u.id === 'usr_admin'} 
                              >
                                <Trash size={14} />
                                {t('delete')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: SETTINGS */}
                {activeTab === 'settings' && (
                  <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                    
                    {/* Settings Form */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: '#fff' }}>
                        {lang === 'he' ? 'הגדרות מערכת מתקדמות' : 'Advanced System Settings'}
                      </h3>

                      {/* 1. Email Config */}
                      <div className="form-group">
                        <label className="form-label">{t('managerEmail')}</label>
                        <input 
                          type="email" 
                          className="form-input" 
                          value={reportEmail}
                          onChange={(e) => setReportEmail(e.target.value)}
                          placeholder="manager@example.com"
                        />
                      </div>

                      {/* 2. Google Sheets URL */}
                      <div className="form-group">
                        <label className="form-label">{lang === 'he' ? 'קישור גוגל שיטס (Apps Script Web App)' : 'Google Sheets Apps Script URL'}</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={googleSheetsUrl}
                          onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                          placeholder="https://script.google.com/macros/s/.../exec"
                        />
                      </div>

                      {/* 3. Google Maps Key */}
                      <div className="form-group">
                        <label className="form-label">{lang === 'he' ? 'מפתח Google Maps API (לזמן נסיעה מדויק)' : 'Google Maps API Key (for precise ETA)'}</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={googleMapsApiKey}
                          onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                        />
                      </div>

                      {/* 4. Twilio SMS Integration */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                          {lang === 'he' ? 'הגדרות Twilio SMS' : 'Twilio SMS Integration'}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Account SID</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={twilioAccountSid}
                              onChange={(e) => setTwilioAccountSid(e.target.value)}
                              placeholder="AC..."
                            />
                          </div>
                          
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Auth Token</label>
                            <input 
                              type="password" 
                              className="form-input" 
                              value={twilioAuthToken}
                              onChange={(e) => setTwilioAuthToken(e.target.value)}
                              placeholder="••••••••••••••••"
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">{lang === 'he' ? 'מספר טלפון שולח (Twilio)' : 'Twilio From Number'}</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={twilioFromNumber}
                                onChange={(e) => setTwilioFromNumber(e.target.value)}
                                placeholder="+1234567890"
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label">{lang === 'he' ? 'טלפון לקבלת התראות (מנהל)' : 'Recipient Phone for Alerts'}</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={twilioRecipientSms}
                                onChange={(e) => setTwilioRecipientSms(e.target.value)}
                                placeholder="+972..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 5. Glassmorphism sliders */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                          {lang === 'he' ? 'עיצוב זכוכית (Apple Glassmorphism)' : 'Glassmorphism Style Settings'}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{lang === 'he' ? 'שקיפות רקע' : 'Background Opacity'}</span>
                              <strong style={{ color: 'var(--accent)' }}>{Math.round(glassOpacity * 100)}%</strong>
                            </div>
                            <input 
                              type="range" 
                              min="0.05" 
                              max="0.80" 
                              step="0.05" 
                              value={glassOpacity} 
                              onChange={(e) => setGlassOpacity(parseFloat(e.target.value))}
                              style={{ width: '100%', accentColor: 'var(--accent)' }}
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{lang === 'he' ? 'עוצמת טשטוש' : 'Blur Intensity'}</span>
                              <strong style={{ color: 'var(--accent)' }}>{glassBlur}px</strong>
                            </div>
                            <input 
                              type="range" 
                              min="4" 
                              max="32" 
                              step="1" 
                              value={glassBlur} 
                              onChange={(e) => setGlassBlur(parseInt(e.target.value))}
                              style={{ width: '100%', accentColor: 'var(--accent)' }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Save All Settings */}
                      <button onClick={handleSaveConfig} className="btn btn-primary" style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }}>
                        {lang === 'he' ? 'שמור את כל ההגדרות' : 'Save All Settings'}
                      </button>

                      {/* Email Simulator inside settings */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>{t('emailReportSimulatorTitle')}</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '18px' }}>
                          {t('emailConfigSub')}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <button 
                            type="button"
                            onClick={() => handleGenerateReportPreview('daily')}
                            className="btn btn-secondary" 
                            style={{ fontSize: '12px', padding: '10px', justifyContent: 'center' }}
                          >
                            <FileText size={12} />
                            {t('showDailyReportButton')}
                          </button>
                          
                          <button 
                            type="button"
                            onClick={() => handleGenerateReportPreview('monthly')}
                            className="btn btn-secondary" 
                            style={{ fontSize: '12px', padding: '10px', justifyContent: 'center' }}
                          >
                            <Clock size={12} />
                            {t('showMonthlyReportButton')}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* Email HTML Preview Modal */}
                {emailPreviewType && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', padding: '16px', zIndex: 4000 }}>
                    <div className="card" style={{ maxWidth: '750px', width: '100%', margin: 'auto', display: 'flex', flexDirection: 'column', height: '92%', overflow: 'hidden', background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', padding: '16px' }}>
                      
                      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                            {lang === 'he' ? `תצוגה מקדימה: ${emailPreviewType === 'daily' ? 'דו"ח יומי' : 'דו"ח חודשי'}` : `Report Preview: ${emailPreviewType === 'daily' ? 'Daily' : 'Monthly'}`}
                          </h3>
                          <button onClick={() => setEmailPreviewType(null)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                            {lang === 'he' ? 'סגור' : 'Close'}
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={handleSendMockEmail} className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '12px', color: '#000', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Send size={12} />
                            <span>{lang === 'he' ? 'שלח בענן' : 'Send via Cloud'}</span>
                          </button>

                          <button onClick={handleOpenMailClient} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'var(--info)' }}>
                            <Mail size={12} color="var(--info)" />
                            <span>{lang === 'he' ? 'פתח ביישום מייל' : 'Open in Mail Client'}</span>
                          </button>

                          <button onClick={handleDownloadHtmlReport} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Download size={12} />
                            <span>{lang === 'he' ? 'הורד קובץ HTML' : 'Download HTML'}</span>
                          </button>

                          <button onClick={handleCopyHtmlReport} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Copy size={12} />
                            <span>{lang === 'he' ? 'העתק תוכן' : 'Copy HTML'}</span>
                          </button>

                          <button onClick={handleShareWhatsApp} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#25D366' }}>
                            <MessageSquare size={12} color="#25D366" />
                            <span style={{ color: '#25D366', fontWeight: 'bold' }}>{lang === 'he' ? 'שתף בוואטסאפ (חינם)' : 'Share WhatsApp (Free)'}</span>
                          </button>
                        </div>
                      </div>

                      <div style={{ flex: 1, background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <iframe 
                          srcDoc={emailPreviewHtml} 
                          title="Email HTML Preview" 
                          style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit User Modal */}
                {selectedUserForEdit && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4000 }}>
                    <div className="card" style={{ maxWidth: '450px', width: '90%', background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', padding: '24px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                        {lang === 'he' ? 'עריכת פרטי משתמש' : 'Edit User Profile'}
                      </h3>
                      <form onSubmit={handleSaveEditUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                          <label className="form-label">{t('userName')}</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={editUserName} 
                            onChange={e => setEditUserName(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('phoneLabel')}</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={editUserPhone} 
                            onChange={e => setEditUserPhone(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('passcodeLabel')}</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            value={editUserCode} 
                            onChange={e => setEditUserCode(e.target.value)} 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('userRole')}</label>
                          <select 
                            className="form-input form-select" 
                            value={editUserRole} 
                            onChange={e => setEditUserRole(e.target.value as any)}
                          >
                            <option value="driver">{t('roleDriver')}</option>
                            <option value="dispatcher">{t('roleDispatcher')}</option>
                            <option value="admin">{t('roleAdmin')}</option>
                          </select>
                        </div>
                        {editUserRole === 'driver' && (
                          <div className="form-group">
                            <label className="form-label">{t('capacityLabel')}</label>
                            <input 
                              type="number" 
                              className="form-input" 
                              value={editUserCapacity}
                              onChange={e => setEditUserCapacity(Math.max(1, parseInt(e.target.value) || 15))} 
                              required 
                            />
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1, color: '#000' }}>
                            {t('saveChanges')}
                          </button>
                          <button type="button" onClick={() => setSelectedUserForEdit(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                            {t('cancel')}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

              </main>

              {/* MOBILE BOTTOM NAVIGATION */}
              <nav className="mobile-manager-nav">
                <button 
                  onClick={() => setActiveTab('dashboard')} 
                  className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                >
                  <MapPin size={18} />
                  <span>{t('managerDashboard')}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('history')} 
                  className={`bottom-nav-item ${activeTab === 'history' ? 'active' : ''}`}
                >
                  <Calendar size={18} />
                  <span>{t('fleetActivity')}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('users')} 
                  className={`bottom-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                >
                  <Users size={18} />
                  <span>{t('usersManagement')}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('settings')} 
                  className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                >
                  <Settings size={18} />
                  <span>{t('settings')}</span>
                </button>
              </nav>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
