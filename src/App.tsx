import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import confetti from 'canvas-confetti';
import { 
  MapPin, Users, Calendar, WifiOff, QrCode, LogOut,
  Plus, Trash, Edit, Search, Clock, Send, CheckCircle,
  RefreshCw, ShieldAlert, FileText, UserCheck, AlertOctagon,
  Mail, Download, Copy, MessageSquare, Navigation, Map, Table,
  ChevronDown, ChevronRight, X
} from 'lucide-react';
import dbService, { LOCATIONS } from './services/db';
import type { User, Scan, ActiveLocation, DepartureLocation, DriverStatus, Direction, PendingRegistration } from './services/db';
import { getWeeklyParsha, getHebrewDate, roundToHalfHourStr, exactTimeStr, getDayOfWeekHe, getHebrewYearMonth, renderHebrewYear, HEBREW_MONTH_OPTIONS } from './services/hebrewDate';

// Shared cell styles for the central master summary table.
const thCentral: CSSProperties = { padding: '8px 12px', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' };
const tdCentral: CSSProperties = { padding: '8px 12px', whiteSpace: 'nowrap' };
import { Html5Qrcode } from 'html5-qrcode';
import logo from './assets/logo.png';
import logoDark from './assets/logo-dark.png'; // black-lettered variant for light/printed backgrounds (PDF report)
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
    noPhoneToggle: 'אין לסדרן טלפון? הוצא הסעה מכאן',
    noPhoneCodePrompt: 'סדרן: הזן את הקוד האישי שלך',
    noPhoneCodePlaceholder: 'קוד אישי',
    noPhoneVerifyBtn: 'אמת קוד',
    noPhoneInvalidCode: 'קוד לא תקין - יש להזין קוד של סדרן או מנהל',
    noPhoneWelcome: 'שלום {name}, כמה נוסעים עולים?',
    noPhoneSendBtn: 'שלח הסעה',
    noPhoneCancel: 'ביטול',
    updateStatus: 'עדכן סטטוס פעילות נוכחי:',
    myTripsTodayTitle: 'הנסיעות שלי היום (סיכום אישי)',
    myReportTitle: 'הדוח האישי שלי',
    myReportWeek: 'שבוע אחרון',
    myReportMonth: 'חודש אחרון',
    myReportDownload: 'הורד דוח PDF',
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
    situationReport: 'ערכת מצב בזמן אמת',
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
    monthFilterLabel: 'סינון לפי חודש',
    clearMonth: 'נקה חודש',
    yearFilterLabel: 'סינון לפי שנה עברית',
    clearYear: 'נקה שנה',
    parshaFilterLabel: 'כל הפרשות',
    clearParsha: 'נקה פרשה',
    originFilterLabel: 'כל נקודות המוצא',
    clearOrigin: 'נקה מוצא',
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
    roleScreen: 'קוד מסך (לוח תצוגה)',
    screenLocationLabel: 'מיקום המסך (לזיהוי)',
    screenLocationPlaceholder: 'לדוגמה: 770 / אוהל / כניסה ראשית',
    capacityLabel: 'קיבולת רכב (מספר מושבים)',
    bigBusLabel: 'אוטובוס גדול',
    canSelfReportLabel: 'מורשה לדיווח נסיעת חזרה עצמאי (קישור לנהג)',
    createUser: 'צור משתמש חדש',
    pendingRegistrationsTitle: 'בקשות הרשמה ממתינות',
    requestedCodeLabel: 'קוד מבוקש',
    editRegistration: 'ערוך',
    approveRegistration: 'אשר',
    rejectRegistration: 'דחה',
    confirmRejectRegistration: 'לדחות ולמחוק את בקשת ההרשמה הזו?',
    registrationRejected: 'הבקשה נדחתה',
    approveRegistrationFailed: 'האישור נכשל (בעיית רשת?) - הבקשה נשארה ברשימה, נסה שוב',
    rejectRegistrationFailed: 'הדחייה נכשלה (בעיית רשת?), נסה שוב',
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
    screenCodeLoginRejected: 'קוד זה מיועד למסך תצוגה בלבד ואינו מקנה גישה למערכת הניהול.',
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
    selectMode: 'בחירה מרובה',
    exitSelectMode: 'בטל בחירה',
    selectAll: 'בחר הכל',
    deselectAll: 'בטל את כל הבחירה',
    deleteSelected: 'מחק נבחרים ({count})',
    confirmBulkDeleteScans: 'האם אתה בטוח שברצונך למחוק {count} שורות שנבחרו? פעולה זו אינה הפיכה.',
    bulkScansDeleted: '{count} שורות נמחקו בהצלחה',
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
    screenRole: 'מסך',
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
    parshaHeader: 'פרשת שבוע',
    hebrewDateHeader: 'תאריך עברי',
    dayHeader: 'יום',
    scannerDispatcherHeader: 'סדרן סורק',
    originHeader: 'נקודת מוצא',
    passengersBoardedHeader: 'נוסעים שהועלו',
    emptySeatsHeader: 'מקומות פנויים',
    driverCapacityHeader: 'קיבולת נהג',
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
    noPhoneToggle: "Dispatcher doesn't have a phone? Issue a ride from here",
    noPhoneCodePrompt: 'Dispatcher: enter your personal code',
    noPhoneCodePlaceholder: 'Personal code',
    noPhoneVerifyBtn: 'Verify Code',
    noPhoneInvalidCode: 'Invalid code - must be a dispatcher or admin code',
    noPhoneWelcome: 'Hi {name}, how many passengers?',
    noPhoneSendBtn: 'Send Ride',
    noPhoneCancel: 'Cancel',
    updateStatus: 'Update Current Activity Status:',
    myTripsTodayTitle: 'My Trips Today (Personal Summary)',
    myReportTitle: 'My Personal Report',
    myReportWeek: 'Last Week',
    myReportMonth: 'Last Month',
    myReportDownload: 'Download PDF Report',
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
    situationReport: 'Situation Report',
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
    monthFilterLabel: 'Filter by Month',
    clearMonth: 'Clear Month',
    yearFilterLabel: 'Filter by Hebrew Year',
    clearYear: 'Clear Year',
    parshaFilterLabel: 'All Parshas',
    clearParsha: 'Clear Parsha',
    originFilterLabel: 'All Origins',
    clearOrigin: 'Clear Origin',
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
    roleScreen: 'Screen Code (Display Board)',
    screenLocationLabel: 'Screen Location (for reference)',
    screenLocationPlaceholder: 'e.g. 770 / Ohel / Main Entrance',
    capacityLabel: 'Vehicle Capacity (Number of Seats)',
    bigBusLabel: 'Big Bus',
    canSelfReportLabel: 'Authorized for self-service return report (driver link)',
    createUser: 'Create New User',
    pendingRegistrationsTitle: 'Pending Registration Requests',
    requestedCodeLabel: 'Requested code',
    editRegistration: 'Edit',
    approveRegistration: 'Approve',
    rejectRegistration: 'Reject',
    confirmRejectRegistration: 'Reject and delete this registration request?',
    registrationRejected: 'Request rejected',
    approveRegistrationFailed: 'Approval failed (network issue?) - the request is still in the list, try again',
    rejectRegistrationFailed: 'Rejection failed (network issue?), try again',
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
    screenCodeLoginRejected: 'This code is for the display board only and does not grant access to the management system.',
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
    selectMode: 'Bulk Select',
    exitSelectMode: 'Cancel Selection',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    deleteSelected: 'Delete Selected ({count})',
    confirmBulkDeleteScans: 'Are you sure you want to delete {count} selected rows? This cannot be undone.',
    bulkScansDeleted: '{count} rows deleted successfully',
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
    screenRole: 'Screen',
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
    parshaHeader: 'Weekly Parsha',
    hebrewDateHeader: 'Hebrew Date',
    dayHeader: 'Day',
    scannerDispatcherHeader: 'Scanning Dispatcher',
    originHeader: 'Origin Point',
    passengersBoardedHeader: 'Boarded Passengers',
    emptySeatsHeader: 'Empty Seats',
    driverCapacityHeader: 'Driver Capacity',
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

// HTML-escapes a value before it's interpolated into the driver/dispatcher PDF
// report templates (built as raw HTML strings and rendered via document.write).
// Without this, an admin-entered name containing markup would execute as real
// HTML/script in that same-origin print window - matches the escaping already
// used in api/daily-email.js.
const escHtml = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// Quotes a CSV cell and escapes embedded quotes. A leading '=', '+', '-' or '@'
// is neutralized with a leading apostrophe first - Excel/Sheets would otherwise
// treat a cell starting with one of those as a formula (a driver/dispatcher
// name or phone number is admin-entered free text, not something to trust).
const csvCell = (v: unknown): string => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

// Races a promise against a timeout so a Firestore call that hangs forever
// (no resolve, no reject - seen on a degraded long-poll connection) can't
// leave a caller stuck indefinitely with no feedback. Used by
// handleApproveRegistration, which chains three separate Firestore calls
// (a re-fetch, then a create, then a delete) - any one of them hanging used
// to freeze the whole approval with no toast and no way to know it needs a
// retry, in one observed case after the create had already succeeded,
// leaving a real user created but its pending request stuck forever.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))
  ]);
}

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

// --- Hourly activity breakdown (drives both the "situation" tab hour summary and the
// PDF reports' hourly-breakdown section) -----------------------------------------------
//
// This feeds payroll ("how much do we owe this driver") so the grouping rule needs to be
// explainable, not just observed. Two things it must get right:
//
// 1. Day-awareness: scans are bucketed by (calendar day in America/New_York, clock hour).
//    "11:00 on Monday" and "11:00 on Tuesday" are NEVER merged into one "11:00" bucket or
//    treated as adjacent/continuous with each other - a multi-day query produces one
//    section per day, each with its own itemize/collapse decision. Silently summing
//    hour-of-day counts across different days would misrepresent hours actually worked.
//
// 2. Itemize vs. collapse, per day: within a single day, find maximal runs of consecutive
//    active clock hours (e.g. 11,12,13 back-to-back). A run collapses into one
//    "from X to Y - N rides" line ONLY if it is both (a) at least RUN_MIN_HOURS hours long
//    AND (b) averages at least RUN_MIN_AVG_PER_HOUR rides/hour across the run - i.e. a
//    genuinely busy stretch. Everything else - a single active hour, two isolated
//    back-to-back light hours (e.g. "11:00 - 2, 12:00 - 1"), or a long but low-volume
//    stretch - stays itemized one line per hour. This directly matches what was asked for:
//    light/back-to-back hours must stay as separate itemized lines, while a real busy
//    stretch collapses into one range+total line. The two constants below are a judgment
//    call (not a fixed business rule) - adjust them here if the owner wants the line drawn
//    elsewhere; both are documented so a future reader can find and reason about them.
const RUN_MIN_HOURS = 3;
const RUN_MIN_AVG_PER_HOUR = 3;

interface DayHourBreakdown {
  dateKey: string; // YYYY-MM-DD in America/New_York
  segments: string[]; // pre-formatted, localized text segments for that day, chronological
}

// Buckets scan timestamps into (NY calendar day, clock hour), then within each day emits
// either itemized "HH:00 - N" segments or collapsed "from HH:00 to HH:00 - N rides"
// segments per the rule documented above. Returns one entry per distinct day, sorted
// chronologically.
//
// NOTE: a lucide icon named `Map` is imported at module scope elsewhere in this file and
// shadows the built-in Map constructor (see the identical note near `logicalDateToParsha`
// around line 1219), so this uses plain nested objects/records instead of Map/Set.
const computeHourlyBreakdown = (scannedAtTimes: string[], locale: string): DayHourBreakdown[] => {
  if (scannedAtTimes.length === 0) return [];

  // dateKey -> hour(0-23) -> count
  const buckets: Record<string, Record<number, number>> = {};
  const fmt = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
    timeZone: 'America/New_York'
  });

  for (const t of scannedAtTimes) {
    const d = new Date(t);
    if (isNaN(d.getTime())) continue;
    const parts = fmt.formatToParts(d);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
    const hour = parseInt(get('hour'), 10) % 24;
    if (!buckets[dateKey]) buckets[dateKey] = {};
    buckets[dateKey][hour] = (buckets[dateKey][hour] || 0) + 1;
  }

  const dateKeys = Object.keys(buckets).sort();
  const result: DayHourBreakdown[] = [];

  for (const dateKey of dateKeys) {
    const hourCounts = buckets[dateKey];
    const activeHours = Object.keys(hourCounts).map(h => parseInt(h, 10)).sort((a, b) => a - b);
    const segments: string[] = [];

    let i = 0;
    while (i < activeHours.length) {
      // Extend to the maximal run of consecutive clock hours starting at i.
      let j = i;
      while (j + 1 < activeHours.length && activeHours[j + 1] === activeHours[j] + 1) {
        j++;
      }
      const runHours = activeHours.slice(i, j + 1);
      const runTotal = runHours.reduce((sum, h) => sum + (hourCounts[h] || 0), 0);
      const avgPerHour = runTotal / runHours.length;

      if (runHours.length >= RUN_MIN_HOURS && avgPerHour >= RUN_MIN_AVG_PER_HOUR) {
        const startLabel = `${String(runHours[0]).padStart(2, '0')}:00`;
        const endLabel = `${String((runHours[runHours.length - 1] + 1) % 24).padStart(2, '0')}:00`;
        segments.push(
          locale === 'he'
            ? `מהשעה ${startLabel} עד השעה ${endLabel} - הוצאו ${runTotal} אוטובוסים`
            : `from ${startLabel} to ${endLabel} - ${runTotal} rides dispatched`
        );
      } else {
        for (const h of runHours) {
          segments.push(`${String(h).padStart(2, '0')}:00 - ${hourCounts[h]}`);
        }
      }
      i = j + 1;
    }

    result.push({ dateKey, segments });
  }

  return result;
};

// Plain-string rendering of computeHourlyBreakdown for the "situation" tab driver/dispatcher
// cards (next to the "שעות:"/"Hours:" label). Single-day results are one comma-joined line;
// multi-day results (week/month/custom timeframe) get one dated line per day, newline-
// separated, so hours from different days are never visually run together.
const formatActiveHours = (scannedAtTimes: string[], lang: string) => {
  const breakdown = computeHourlyBreakdown(scannedAtTimes, lang);
  if (breakdown.length === 0) return lang === 'he' ? 'אין פעילות' : 'No activity';

  if (breakdown.length === 1) {
    return breakdown[0].segments.join(lang === 'he' ? ' | ' : ' | ');
  }

  return breakdown.map(day => {
    const dateLabel = new Date(`${day.dateKey}T12:00:00`).toLocaleDateString(
      lang === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit' }
    );
    return `${dateLabel}: ${day.segments.join(' | ')}`;
  }).join('\n');
};

// HTML rendering of computeHourlyBreakdown for the driver/dispatcher PDF reports
// (handleExportDriverPdf / handleExportDispatcherPdf). These reports can span a driver's
// or dispatcher's entire history, so the per-day grouping from computeHourlyBreakdown is
// exercised for real here (not just the usually-single-day "situation" tab case): one
// dated block per day, each showing that day's itemized-hours/collapsed-range segments as
// chips. This is an ADDITIONAL section alongside the existing full per-ride table, not a
// replacement for it - payroll review still needs the row-level detail.
const buildHourlyBreakdownHtml = (scannedAtTimes: string[], locale: 'he' | 'en'): string => {
  const breakdown = computeHourlyBreakdown(scannedAtTimes, locale);
  if (breakdown.length === 0) {
    return `<div class="empty">${locale === 'he' ? 'אין נתוני שעות' : 'No hourly data'}</div>`;
  }
  return breakdown.map(day => {
    const dayDate = new Date(`${day.dateKey}T12:00:00`);
    const greg = dayDate.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const label = locale === 'he' ? `${getHebrewDate(dayDate)} (${greg})` : greg;
    const chips = day.segments.map(seg => `<span class="hours-chip">${seg}</span>`).join('');
    return `<div class="hours-day">
      <div class="hours-day-title">${label}</div>
      <div class="hours-list">${chips}</div>
    </div>`;
  }).join('');
};

// One pending self-registration request, with inline Approve / Edit-then-approve
// / Reject actions. Reused by both the admin's auto-popup modal and the
// "Pending Registration Requests" card in the Users tab, so both stay in sync.
function PendingRegistrationCard({ reg, t, onApprove, onReject }: {
  reg: PendingRegistration;
  t: (key: keyof typeof TRANSLATIONS.he, variables?: { [key: string]: any }) => string;
  onApprove: (reg: PendingRegistration, values: { name: string; phone: string; code: string; capacity?: number; isBigBus?: boolean }) => void;
  onReject: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(reg.name);
  const [phone, setPhone] = useState(reg.phone);
  const [code, setCode] = useState(reg.code);
  const [capacity, setCapacity] = useState(reg.capacity || 15);
  const [isBigBus, setIsBigBus] = useState(reg.isBigBus || false);

  const submitFieldStyle: CSSProperties = { fontSize: '13px', padding: '7px 10px' };
  const roleLine = `${phone} · ${reg.role === 'driver' ? t('roleDriver') : t('roleDispatcher')}` +
    (reg.role === 'driver' && capacity ? ` · ${capacity} ${t('capacityLabel')}` : '') +
    (reg.role === 'driver' && isBigBus ? ` · ${t('bigBusLabel')}` : '');

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px' }}>
      {!editing ? (
        <div style={{ marginBottom: '10px' }}>
          <strong style={{ color: '#fff', fontSize: '14px', display: 'block' }}>{name}</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>{roleLine}</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{t('requestedCodeLabel')}: <code>{code}</code></span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
          <input value={name} onChange={e => setName(e.target.value)} className="form-input" style={submitFieldStyle} placeholder={t('userName')} />
          <input value={phone} onChange={e => setPhone(e.target.value)} className="form-input" style={submitFieldStyle} placeholder={t('phoneLabel')} />
          <input value={code} onChange={e => setCode(e.target.value)} className="form-input" style={submitFieldStyle} placeholder={t('passcodeLabel')} />
          {reg.role === 'driver' && (
            <input type="number" value={capacity} onChange={e => setCapacity(Math.max(1, parseInt(e.target.value) || 15))} className="form-input" style={submitFieldStyle} />
          )}
          {reg.role === 'driver' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fff', cursor: 'pointer' }}>
              <input type="checkbox" checked={isBigBus} onChange={e => setIsBigBus(e.target.checked)} style={{ width: '14px', height: '14px' }} />
              {t('bigBusLabel')}
            </label>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => onApprove(reg, { name, phone, code, capacity, isBigBus })} className="btn btn-primary" style={{ flex: 1, padding: '7px', fontSize: '12px' }}>
          {t('approveRegistration')}
        </button>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary" style={{ flex: 1, padding: '7px', fontSize: '12px', color: '#fff' }}>
            {t('editRegistration')}
          </button>
        ) : (
          <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary" style={{ flex: 1, padding: '7px', fontSize: '12px', color: '#fff' }}>
            {t('cancel')}
          </button>
        )}
        <button type="button" onClick={() => onReject(reg.id)} className="btn btn-secondary" style={{ flex: 1, padding: '7px', fontSize: '12px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
          {t('rejectRegistration')}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  // Internationalization (Language Switcher) - persisted like currentUser, so it
  // survives a refresh or closing and reopening the app.
  const [lang, setLang] = useState<'he' | 'en'>(() => {
    return (localStorage.getItem('tp_lang') as 'he' | 'en') || 'he';
  });

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

  // Dynamically toggle body/document text direction, and remember the choice
  useEffect(() => {
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('tp_lang', lang);
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
  const [currentLiveTime, setCurrentLiveTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentLiveTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
  const [situationTimeframe, setSituationTimeframe] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [situationStartDate, setSituationStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [situationEndDate, setSituationEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  // Situation tab: which logicalDates currently have their individual-ride list
  // expanded open (used by both the Daily Breakdown card and the day-level
  // drill-in inside the Monthly Summary card - date strings are globally unique
  // so one shared set works for both).
  const [expandedSituationDates, setExpandedSituationDates] = useState<Set<string>>(new Set());
  // Situation tab: which Hebrew "{year}-{monthKey}" keys are expanded in the
  // Monthly Summary card, showing that month's day-by-day breakdown.
  const [expandedSituationMonths, setExpandedSituationMonths] = useState<Set<string>>(new Set());

  // Toast notifications
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'danger'; closing?: boolean }[]>([]);
  // Shows a full-screen spinner from the moment a scan is submitted until the
  // save actually resolves, so the wait is visible instead of the screen going
  // silent between tap and the success/error toast.
  const [isSavingScan, setIsSavingScan] = useState(false);

  // Simulation GPS overrides for dispatcher
  const [gpsSource, setGpsSource] = useState<'real' | '770' | 'ohel'>('770');

  // Scanner Form state
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [manualDepartureLocation, setManualDepartureLocation] = useState<DepartureLocation | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Search & Filter state for Manager Dashboard
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(''); // Hebrew month key, e.g. "Elul"
  const [yearFilter, setYearFilter] = useState(''); // Hebrew year, e.g. "5786"
  const [parshaFilter, setParshaFilter] = useState(''); // weekly parsha name
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
  const [staffFilter, setStaffFilter] = useState<'driver' | 'dispatcher' | 'screen'>('driver');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'driver' | 'dispatcher' | 'admin' | 'screen'>('driver');
  const [newUserCapacity, setNewUserCapacity] = useState<number>(15);
  const [newUserIsBigBus, setNewUserIsBigBus] = useState(false);
  const [newUserCanSelfReport, setNewUserCanSelfReport] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [newUserCode, setNewUserCode] = useState('');
  // Self-registration requests (…/join) awaiting admin approval.
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([]);
  // Auto-opens once per newly-arrived pending registration - see the effect below.
  const [showPendingRegModal, setShowPendingRegModal] = useState(false);
  const dismissedRegIdsRef = useRef<Set<string>>(new Set());
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserCode, setEditUserCode] = useState('');
  const [editUserRole, setEditUserRole] = useState<'driver' | 'dispatcher' | 'admin' | 'screen'>('driver');
  const [editUserCapacity, setEditUserCapacity] = useState<number>(15);
  const [editUserIsBigBus, setEditUserIsBigBus] = useState(false);
  const [editUserCanSelfReport, setEditUserCanSelfReport] = useState(false);
  // Email Reports Simulator state
  const [emailPreviewType, setEmailPreviewType] = useState<'daily' | 'monthly' | null>(null);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string>('');

  // Active watch position for GPS streaming
  const [dispatcherRealCoords, setDispatcherRealCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Login screen interactive Apple-style glows
  const [loginRipples, setLoginRipples] = useState<{ id: string; x: number; y: number }[]>([]);
  
  // Expanded daily history days state
  const [expandedDays, setExpandedDays] = useState<{ [date: string]: boolean }>({ [dbService.getLogicalDate()]: true });
  const [showDriverHistory, setShowDriverHistory] = useState<boolean>(false);
  const [scannerModalDriver, setScannerModalDriver] = useState<User | null>(null);
  const [scannerModalPassengers, setScannerModalPassengers] = useState<number>(0);

  // "No phone" flow: a dispatcher without their own device can issue a ride
  // using the driver's phone, from below the driver's own QR code screen.
  const [noPhoneShowForm, setNoPhoneShowForm] = useState<boolean>(false);
  const [noPhoneCode, setNoPhoneCode] = useState<string>('');
  const [noPhoneDispatcher, setNoPhoneDispatcher] = useState<User | null>(null);
  const [noPhonePassengers, setNoPhonePassengers] = useState<number>(0);

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
  const dismissToast = (id: string) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, closing: true } : t)));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 250);
  };

  const triggerToast = (message: string, type: 'success' | 'danger' = 'success') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), 4000);
  };

  // Sync state from dbService updates
  useEffect(() => {
    const handleUpdate = () => {
      setUsers(dbService.getUsers());
      setScans(dbService.getScans());
      setActiveLocations(dbService.getActiveLocations());
      setIsOffline(dbService.isOffline());
      setPendingRegistrations(dbService.getPendingRegistrations());
    };

    handleUpdate();
    const unsubscribe = dbService.subscribe(handleUpdate);

    // Periodic local refresh timer (forces React UI to update every 5 seconds for live countdowns)
    const intervalId = setInterval(handleUpdate, 5000);

    // Initial config load
    const config = dbService.getConfig();
    setReportEmail(config.reportEmail || '');
    setGoogleSheetsUrl(config.googleSheetsUrl || '');
    setGoogleMapsApiKey(config.googleMapsApiKey || '');
    setTwilioAccountSid(config.twilioAccountSid || '');
    setTwilioAuthToken(config.twilioAuthToken || '');
    setTwilioFromNumber(config.twilioFromNumber || '');
    setTwilioRecipientSms(config.twilioRecipientSms || '');

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  // Auto-pop the pending-registrations modal for the admin whenever there's at
  // least one request that hasn't already been shown-and-dismissed this
  // session - covers both "just opened the app" and "a new one arrived live".
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    if (pendingRegistrations.length === 0) { setShowPendingRegModal(false); return; }
    const hasUndismissed = pendingRegistrations.some(r => !dismissedRegIdsRef.current.has(r.id));
    if (hasUndismissed) setShowPendingRegModal(true);
  }, [currentUser, pendingRegistrations]);

  const closePendingRegModal = () => {
    pendingRegistrations.forEach(r => dismissedRegIdsRef.current.add(r.id));
    setShowPendingRegModal(false);
  };

  // Deep linking simulator URL query scanner
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'dispatcher' || users.length === 0) return;
    
    const params = new URLSearchParams(window.location.search);
    const driverIdParam = params.get('driverId');
    if (driverIdParam) {
      const matched = users.find(u => u.id === driverIdParam && u.role === 'driver');
      if (matched) {
        setScannerModalDriver(matched);
        setScannerModalPassengers(0);
        setActiveTab('scan');
        triggerToast(t('externalQrSuccess'), 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [currentUser, users]);

  // In-app QR Code Scanner camera handler (Using Html5Qrcode directly for instant back-camera load)
  useEffect(() => {
    if (!showCameraScanner) return;

    const html5QrCode = new Html5Qrcode("qr-reader");
    const config = { fps: 15, qrbox: { width: 250, height: 250 } };

    const onScanSuccess = (decodedText: string) => {
      let matchedDriver = users.find(u => (u.id === decodedText || u.code === decodedText) && u.role === 'driver');
      
      if (!matchedDriver) {
        try {
          const url = new URL(decodedText);
          const driverIdParam = url.searchParams.get('driverId');
          if (driverIdParam) {
            matchedDriver = users.find(u => u.id === driverIdParam && u.role === 'driver');
          }
        } catch (e) {}
      }

      if (matchedDriver) {
        const targetDriver = matchedDriver;
        
        // Open the passenger modal overlay instantly (synchronously)!
        setScannerModalDriver(targetDriver);
        setScannerModalPassengers(0);
        
        // Stop the camera asynchronously in the background
        if (html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            html5QrCode.clear();
            setShowCameraScanner(false);
          }).catch(err => {
            console.error("Failed to stop scanner", err);
            setShowCameraScanner(false);
          });
        } else {
          setShowCameraScanner(false);
        }
        triggerToast(t('qrSuccess'), 'success');
      } else {
        triggerToast(t('qrInvalid'), 'danger');
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
    return dbService.getLogicalDate(currentLiveTime.toISOString());
  }, [scans, currentLiveTime]);

  // Real-time Situation Assessment Data
  const situationData = useMemo(() => {
    // 1. Filter scans by timeframe
    const filtered = scans.filter(scan => {
      if (situationTimeframe === 'today') {
        return scan.logicalDate === logicalToday;
      }
      
      const scanTime = new Date(scan.scannedAt).getTime();
      const now = currentLiveTime.getTime();
      
      if (situationTimeframe === 'week') {
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        return scanTime >= sevenDaysAgo;
      }
      
      if (situationTimeframe === 'month') {
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        return scanTime >= thirtyDaysAgo;
      }

      if (situationTimeframe === 'custom') {
        let match = true;
        if (situationStartDate) {
          match = match && scan.logicalDate >= situationStartDate;
        }
        if (situationEndDate) {
          match = match && scan.logicalDate <= situationEndDate;
        }
        return match;
      }
      
      return false;
    });

    // 2. Aggregate statistics for Drivers
    const driversMap: { [id: string]: { name: string; trips: number; passengers: number; times: string[] } } = {};
    // 3. Aggregate statistics for Dispatchers
    const dispatchersMap: { [id: string]: { name: string; scansCount: number; passengers: number; times: string[] } } = {};
    // 4. Daily breakdown
    const dailyMap: { [date: string]: { date: string; trips: number; passengers: number } } = {};

    let totalPassengers = 0;
    let totalTrips = 0;

    filtered.forEach(scan => {
      totalTrips += 1;
      totalPassengers += (scan.passengersCount || 0);

      // Driver Grouping
      if (scan.driverId) {
        if (!driversMap[scan.driverId]) {
          driversMap[scan.driverId] = { name: scan.driverName, trips: 0, passengers: 0, times: [] };
        }
        driversMap[scan.driverId].trips += 1;
        driversMap[scan.driverId].passengers += (scan.passengersCount || 0);
        driversMap[scan.driverId].times.push(scan.scannedAt);
      }

      // Dispatcher Grouping
      if (scan.dispatcherId) {
        if (!dispatchersMap[scan.dispatcherId]) {
          dispatchersMap[scan.dispatcherId] = { name: scan.dispatcherName, scansCount: 0, passengers: 0, times: [] };
        }
        dispatchersMap[scan.dispatcherId].scansCount += 1;
        dispatchersMap[scan.dispatcherId].passengers += (scan.passengersCount || 0);
        dispatchersMap[scan.dispatcherId].times.push(scan.scannedAt);
      }

      // Daily breakdown grouping
      const dDate = scan.logicalDate;
      if (!dailyMap[dDate]) {
        dailyMap[dDate] = { date: dDate, trips: 0, passengers: 0 };
      }
      dailyMap[dDate].trips += 1;
      dailyMap[dDate].passengers += (scan.passengersCount || 0);
    });

    // Sort daily breakdown chronologically desc (newest date first)
    const dailyList = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));

    return {
      driversList: Object.values(driversMap),
      dispatchersList: Object.values(dispatchersMap),
      dailyList,
      totalPassengers,
      totalTrips
    };
  }, [scans, situationTimeframe, situationStartDate, situationEndDate, logicalToday, currentLiveTime]);

  // --- Scans Filters for Dashboard ---
  // Plain object of logicalDate -> parsha name, built once per distinct set of dates present in
  // `scans` (getWeeklyParsha itself is memoized per-week internally, so this is just avoiding
  // recomputing the whole distinct-date scan on every render). NOTE: a lucide icon named `Map`
  // is imported at module scope and shadows the built-in Map constructor, so use a plain object.
  const logicalDateToParsha = useMemo(() => {
    const dict: Record<string, string> = {};
    for (const s of scans) {
      if (!(s.logicalDate in dict)) {
        dict[s.logicalDate] = getWeeklyParsha(new Date(s.logicalDate + 'T12:00:00'));
      }
    }
    return dict;
  }, [scans]);

  // Distinct parsha names occurring in `scans`, ordered by chronological first-occurrence
  // (not alphabetical - Hebrew alphabetical order isn't meaningful for parsha order).
  const availableParshas = useMemo(() => {
    const datesSorted = Object.keys(logicalDateToParsha).sort(); // YYYY-MM-DD sorts chronologically
    const seen = new Set<string>();
    const result: string[] = [];
    for (const d of datesSorted) {
      const p = logicalDateToParsha[d];
      if (p && !seen.has(p)) {
        seen.add(p);
        result.push(p);
      }
    }
    return result;
  }, [logicalDateToParsha]);

  // logicalDate -> { year, monthKey } in the HEBREW calendar - "month" filtering
  // in this app means Hebrew months, not Gregorian ones.
  const logicalDateToHebrewYM = useMemo(() => {
    const dict: Record<string, { year: number; monthKey: string }> = {};
    for (const s of scans) {
      if (!(s.logicalDate in dict)) {
        dict[s.logicalDate] = getHebrewYearMonth(new Date(s.logicalDate + 'T12:00:00'));
      }
    }
    return dict;
  }, [scans]);

  // Distinct Hebrew years actually present in `scans`, newest first.
  const availableHebrewYears = useMemo(() => {
    const years = new Set<number>();
    Object.values(logicalDateToHebrewYM).forEach(v => { if (v.year) years.add(v.year); });
    return Array.from(years).sort((a, b) => b - a);
  }, [logicalDateToHebrewYM]);

  // Monthly Summary (Situation tab) - totals by HEBREW month, across ALL scans in
  // the system. Deliberately NOT scoped by situationTimeframe/situationStartDate/
  // situationEndDate: those control the "current window" cards above (today/week/
  // month/custom), while a monthly summary reads more usefully as its own full
  // history at a glance. Sorted newest month first.
  const monthlySummaryData = useMemo(() => {
    // NOTE: a lucide icon named `Map` is imported at module scope and shadows the
    // built-in Map constructor here, so group with a plain object instead.
    const monthMap: Record<string, { year: number; monthKey: string; trips: number; passengers: number; maxDate: string }> = {};
    scans.forEach(scan => {
      const ym = logicalDateToHebrewYM[scan.logicalDate];
      if (!ym || !ym.monthKey) return;
      const key = `${ym.year}-${ym.monthKey}`;
      if (!monthMap[key]) {
        monthMap[key] = { year: ym.year, monthKey: ym.monthKey, trips: 0, passengers: 0, maxDate: scan.logicalDate };
      }
      monthMap[key].trips += 1;
      monthMap[key].passengers += (scan.passengersCount || 0);
      if (scan.logicalDate > monthMap[key].maxDate) monthMap[key].maxDate = scan.logicalDate;
    });
    // Sort by the latest logicalDate actually seen in each month (sidesteps having
    // to reason about Hebrew leap-year month ordering for the sort itself).
    return Object.values(monthMap).sort((a, b) => b.maxDate.localeCompare(a.maxDate));
  }, [scans, logicalDateToHebrewYM]);

  // Day-by-day breakdown for one Hebrew "{year}-{monthKey}" key, computed on demand
  // for whichever month row is currently expanded in the Monthly Summary card.
  const situationMonthDays = useMemo(() => {
    if (expandedSituationMonths.size === 0) return {} as Record<string, { date: string; trips: number; passengers: number }[]>;
    // NOTE: plain object, not `new Map()` - see the `Map` shadowing note above.
    const byMonth: Record<string, Record<string, { date: string; trips: number; passengers: number }>> = {};
    scans.forEach(scan => {
      const ym = logicalDateToHebrewYM[scan.logicalDate];
      if (!ym || !ym.monthKey) return;
      const monthKeyFull = `${ym.year}-${ym.monthKey}`;
      if (!expandedSituationMonths.has(monthKeyFull)) return;
      const days = (byMonth[monthKeyFull] ||= {});
      const d = (days[scan.logicalDate] ||= { date: scan.logicalDate, trips: 0, passengers: 0 });
      d.trips += 1;
      d.passengers += (scan.passengersCount || 0);
    });
    const result: Record<string, { date: string; trips: number; passengers: number }[]> = {};
    Object.entries(byMonth).forEach(([monthKeyFull, days]) => {
      result[monthKeyFull] = Object.values(days).sort((a, b) => b.date.localeCompare(a.date));
    });
    return result;
  }, [scans, logicalDateToHebrewYM, expandedSituationMonths]);

  // Renders one clickable/expandable day row for the Situation tab (used by both
  // the Daily Breakdown card and the day drill-in inside an expanded month in the
  // Monthly Summary card). Clicking toggles an inline list of that day's individual
  // rides - driver, exact scan time, origin, passengers - sorted earliest-first.
  const renderSituationDayRow = (day: { date: string; trips: number; passengers: number }) => {
    const isExpanded = expandedSituationDates.has(day.date);
    const dayScans = isExpanded
      ? scans
          .filter(s => s.logicalDate === day.date)
          .slice()
          .sort((a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime())
      : [];

    const toggle = () => setExpandedSituationDates(prev => {
      const next = new Set(prev);
      if (next.has(day.date)) next.delete(day.date); else next.add(day.date);
      return next;
    });

    return (
      <div
        key={day.date}
        style={{
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          background: 'rgba(255,255,255,0.01)',
          overflow: 'hidden'
        }}
      >
        <div
          onClick={toggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
          style={{
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isExpanded ? <ChevronDown size={14} color="var(--text-secondary)" /> : <ChevronRight size={14} color="var(--text-secondary)" />}
            <div>
              <strong style={{ fontSize: '13px', color: '#fff' }}>
                {lang === 'he' ? formatHebrewAndGregorianDate(day.date) : day.date}
              </strong>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {lang === 'he' ? `${day.trips} נסיעות` : `${day.trips} Trips`}
              </span>
            </div>
          </div>
          <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent)' }}>
              {day.passengers}
            </span>
            <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-secondary)' }}>
              {lang === 'he' ? 'נוסעים' : 'Passengers'}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div style={{ borderTop: '1px solid var(--border-color)', padding: '4px 14px 10px' }}>
            {dayScans.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '10px 0' }}>
                {lang === 'he' ? 'אין נסיעות מתועדות ביום זה' : 'No rides recorded for this day'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thCentral}>{lang === 'he' ? 'שעה' : 'Time'}</th>
                      <th style={thCentral}>{lang === 'he' ? 'נהג' : 'Driver'}</th>
                      <th style={thCentral}>{lang === 'he' ? 'מוצא' : 'Origin'}</th>
                      <th style={thCentral}>{lang === 'he' ? 'נוסעים' : 'Passengers'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayScans.map(s => (
                      <tr key={s.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ ...tdCentral, fontFamily: 'monospace', color: '#fff' }}>
                          {exactTimeStr(new Date(s.scannedAt))}
                        </td>
                        <td style={{ ...tdCentral, color: '#fff' }}>
                          {(s.driverName || '').replace(' (נהג)', '')}
                        </td>
                        <td style={tdCentral}>
                          <span style={{ color: s.departureLocation === 'Ohel' ? '#06b6d4' : 'var(--accent)', fontWeight: 700 }}>
                            {s.departureLocation === '770' ? '770' : (lang === 'he' ? 'אוהל' : 'Ohel')}
                          </span>
                        </td>
                        <td style={tdCentral}>{s.passengersCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const filteredScans = useMemo(() => {
    return scans
      .filter(s => {
        const matchesSearch =
          s.driverName.toLowerCase().includes(searchText.toLowerCase()) ||
          s.dispatcherName.toLowerCase().includes(searchText.toLowerCase()) ||
          s.departureLocation.toLowerCase().includes(searchText.toLowerCase());

        const matchesDate = dateFilter ? s.logicalDate === dateFilter : true;
        const ym = logicalDateToHebrewYM[s.logicalDate];
        const matchesMonth = monthFilter ? ym?.monthKey === monthFilter : true;
        const matchesYear = yearFilter ? String(ym?.year) === yearFilter : true;
        const matchesParsha = parshaFilter ? logicalDateToParsha[s.logicalDate] === parshaFilter : true;

        return matchesSearch && matchesDate && matchesMonth && matchesYear && matchesParsha;
      })
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [scans, searchText, dateFilter, monthFilter, yearFilter, parshaFilter, logicalDateToParsha, logicalDateToHebrewYM]);

  // --- Central Summary (master table): one row per ride, grouped by day. ---
  // --- Outbound (הלוך) and return (חזור) are separate rows, each tagged ---
  // --- with a direction column: כיוון | שעה | נהג | אנשים | אוטובוס גדול. ---
  const BIG_BUS_MIN_CAPACITY = 25; // capacity >= this counts as "אוטובוס גדול"
  const [centralBigBusOnly, setCentralBigBusOnly] = useState(false);
  const [centralDateFrom, setCentralDateFrom] = useState('');
  const [centralDateTo, setCentralDateTo] = useState('');
  const [centralMonthFilter, setCentralMonthFilter] = useState(''); // Hebrew month key, e.g. "Elul"
  const [centralYearFilter, setCentralYearFilter] = useState(''); // Hebrew year, e.g. "5786"
  const [centralParshaFilter, setCentralParshaFilter] = useState('');
  const [centralOriginFilter, setCentralOriginFilter] = useState<'' | DepartureLocation>('');
  const [centralSelectMode, setCentralSelectMode] = useState(false);
  const [centralSelectedIds, setCentralSelectedIds] = useState<Set<string>>(new Set());
  // Also used to filter the central table itself, not just the PDF exports.
  const [selectedDriverForPdf, setSelectedDriverForPdf] = useState('');
  const [selectedDispatcherForPdf, setSelectedDispatcherForPdf] = useState('');

  const centralSummary = useMemo(() => {
    // NOTE: a lucide icon named `Map` is imported at module scope and shadows the
    // built-in Map constructor here, so group with a plain object instead.
    const byDay: Record<string, Scan[]> = {};
    for (const s of scans) {
      if (!s.logicalDate) continue;
      if (centralDateFrom && s.logicalDate < centralDateFrom) continue;
      if (centralDateTo && s.logicalDate > centralDateTo) continue;
      const ym = logicalDateToHebrewYM[s.logicalDate];
      if (centralMonthFilter && ym?.monthKey !== centralMonthFilter) continue;
      if (centralYearFilter && String(ym?.year) !== centralYearFilter) continue;
      if (centralParshaFilter && logicalDateToParsha[s.logicalDate] !== centralParshaFilter) continue;
      if (centralOriginFilter && s.departureLocation !== centralOriginFilter) continue;
      if (selectedDriverForPdf && (s.driverName || '').replace(' (נהג)', '') !== selectedDriverForPdf) continue;
      if (selectedDispatcherForPdf && (s.dispatcherName || '').replace(' (סדרן)', '') !== selectedDispatcherForPdf) continue;
      (byDay[s.logicalDate] ||= []).push(s);
    }
    const days = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1)); // newest first
    return days.map(dateStr => {
      const dayDate = new Date(dateStr + 'T12:00:00');
      const isToday = dateStr === logicalToday;

      const rows = byDay[dateStr]
        .slice()
        .sort((a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime())
        .map(s => {
          const when = new Date(s.scannedAt);
          // Prefer the driver's explicit "big bus" tag (set at scan time); fall back
          // to the capacity threshold for older scans written before that field existed.
          const bigBus = s.isBigBus ?? ((s.driverCapacity || 0) >= BIG_BUS_MIN_CAPACITY);
          const isReturn = s.departureLocation === 'Ohel';
          return {
            id: s.id,
            direction: (isReturn ? 'return' : 'outbound') as 'return' | 'outbound',
            // Explicit origin -> destination, not just an abstract "outbound/return" label.
            routeLabel: isReturn ? 'אוהל ← 770' : '770 ← אוהל',
            routeLabelEn: isReturn ? 'Ohel -> 770' : '770 -> Ohel',
            // Central summary always rounds to the nearest half hour, including today's rows.
            time: roundToHalfHourStr(when),
            // Computed from this ride's own scan time, not the day's noon - a
            // Saturday-night ride is already in next week's parsha even though
            // the calendar day is still "Saturday".
            parsha: getWeeklyParsha(when),
            driver: (s.driverName || '').replace(' (נהג)', ''),
            dispatcher: (s.dispatcherName || '').replace(' (סדרן)', ''),
            origin: s.departureLocation === '770' ? '770' : (lang === 'he' ? 'אוהל' : 'Ohel'),
            passengers: s.passengersCount,
            remainingSeats: s.remainingSeats,
            driverCapacity: s.driverCapacity,
            bigBus,
          };
        })
        .filter(r => !centralBigBusOnly || r.bigBus);

      return {
        dateStr,
        isToday,
        hebrewDate: getHebrewDate(dayDate),
        parsha: getWeeklyParsha(dayDate),
        gregorian: dayDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rows,
      };
    }).filter(day => day.rows.length > 0);
  }, [scans, logicalToday, centralBigBusOnly, centralDateFrom, centralDateTo, centralMonthFilter, centralYearFilter, centralParshaFilter, centralOriginFilter, selectedDriverForPdf, selectedDispatcherForPdf, logicalDateToParsha, logicalDateToHebrewYM, lang]);

  // Flattened row ids across all day-groups currently shown, for "select all".
  const centralAllRowIds = useMemo(
    () => centralSummary.flatMap(day => day.rows.map(r => r.id)),
    [centralSummary]
  );

  // One flat, single-table row list for on-screen display - each row already carries
  // its own parsha/Hebrew date/day/logical date, so no separate per-day header/table
  // is needed. Days stay newest-first; within a day, newest scan first (reverse of
  // the underlying oldest-first order still used by the CSV export).
  const centralFlatRows = useMemo(() => {
    return centralSummary.flatMap(day => {
      const dayOfWeek = getDayOfWeekHe(new Date(day.dateStr + 'T12:00:00'));
      // Each row already carries its own scan-time-accurate `parsha` (set in
      // centralSummary above) - don't overwrite it with the day's value here.
      return [...day.rows].reverse().map(r => ({ ...r, dateStr: day.dateStr, hebrewDate: day.hebrewDate, dayOfWeek }));
    });
  }, [centralSummary]);

  // Applies the SAME filters currently active on the central table (date range,
  // Hebrew month/year, parsha, origin, big-bus-only) to an arbitrary scan list -
  // used so the driver/dispatcher PDF reports reflect whatever is filtered there,
  // instead of always dumping a driver's/dispatcher's entire history.
  // `dateOverride` lets a caller (the driver/dispatcher self-service report)
  // apply just its own date range, ignoring whatever admin-only central-table
  // filters (month/year/parsha/origin/big-bus) might be sitting in state.
  const applyCentralFilters = (list: Scan[], dateOverride?: { from: string; to: string }): Scan[] => {
    if (dateOverride) {
      return list.filter(s => s.logicalDate >= dateOverride.from && s.logicalDate <= dateOverride.to);
    }
    return list.filter(s => {
      if (centralDateFrom && s.logicalDate < centralDateFrom) return false;
      if (centralDateTo && s.logicalDate > centralDateTo) return false;
      const ym = logicalDateToHebrewYM[s.logicalDate];
      if (centralMonthFilter && ym?.monthKey !== centralMonthFilter) return false;
      if (centralYearFilter && String(ym?.year) !== centralYearFilter) return false;
      if (centralParshaFilter && logicalDateToParsha[s.logicalDate] !== centralParshaFilter) return false;
      if (centralOriginFilter && s.departureLocation !== centralOriginFilter) return false;
      if (centralBigBusOnly) {
        const bigBus = s.isBigBus ?? ((s.driverCapacity || 0) >= BIG_BUS_MIN_CAPACITY);
        if (!bigBus) return false;
      }
      return true;
    });
  };

  // Human-readable summary of whichever central-table filters are currently
  // active, shown at the top of the PDF reports so it's clear what the numbers
  // below actually cover.
  const buildFilterScopeLabel = (locale: 'he' | 'en', dateOverride?: { from: string; to: string }): string => {
    if (dateOverride) {
      const fromLabel = getHebrewDate(new Date(dateOverride.from + 'T12:00:00'));
      const toLabel = getHebrewDate(new Date(dateOverride.to + 'T12:00:00'));
      return locale === 'he' ? `טווח תאריכים: מ-${fromLabel} עד ${toLabel}` : `Date range: ${fromLabel} to ${toLabel}`;
    }
    const parts: string[] = [];
    if (centralDateFrom || centralDateTo) {
      const fromLabel = centralDateFrom ? getHebrewDate(new Date(centralDateFrom + 'T12:00:00')) : (locale === 'he' ? 'ההתחלה' : 'the start');
      const toLabel = centralDateTo ? getHebrewDate(new Date(centralDateTo + 'T12:00:00')) : (locale === 'he' ? 'היום' : 'today');
      parts.push(locale === 'he' ? `טווח תאריכים: מ-${fromLabel} עד ${toLabel}` : `Date range: ${fromLabel} to ${toLabel}`);
    }
    if (centralMonthFilter) {
      const monthLabel = HEBREW_MONTH_OPTIONS.find(m => m.key === centralMonthFilter)?.label || centralMonthFilter;
      parts.push(locale === 'he'
        ? `חודש עברי: ${monthLabel}${centralYearFilter ? ' ' + renderHebrewYear(Number(centralYearFilter)) : ''}`
        : `Hebrew month: ${monthLabel}`);
    } else if (centralYearFilter) {
      parts.push(locale === 'he' ? `שנה עברית: ${renderHebrewYear(Number(centralYearFilter))}` : `Hebrew year: ${renderHebrewYear(Number(centralYearFilter))}`);
    }
    if (centralParshaFilter) parts.push(locale === 'he' ? `פרשת שבוע: ${centralParshaFilter}` : `Parsha: ${centralParshaFilter}`);
    if (centralOriginFilter) parts.push(locale === 'he'
      ? `מוצא: ${centralOriginFilter === '770' ? '770' : 'אוהל'}`
      : `Origin: ${centralOriginFilter === '770' ? '770' : 'Ohel'}`);
    if (centralBigBusOnly) parts.push(locale === 'he' ? 'אוטובוסים גדולים בלבד' : 'Big buses only');
    return parts.length > 0
      ? parts.join(' · ')
      : (locale === 'he' ? 'כל הנתונים ההיסטוריים (ללא סינון)' : 'Full history (no filter applied)');
  };

  // --- Stats calculations ---
  const stats = useMemo(() => {
    const todayScans = scans.filter(s => s.logicalDate === logicalToday);
    const totalPassengers = todayScans.reduce((sum, s) => sum + s.passengersCount, 0);
    
    const scannedDriverIds = new Set(todayScans.map(s => s.driverId).filter(Boolean));
    const scannedDispIds = new Set(todayScans.map(s => s.dispatcherId).filter(Boolean));

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

  const todayScans = useMemo(() => {
    return scans
      .filter(s => s.logicalDate === logicalToday)
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [scans, logicalToday]);

  const activeDriversToday = useMemo(() => {
    return activeLocations.filter(loc => 
      loc.role === 'driver' && 
      (loc.status === 'en_route' || todayScans.some(s => s.driverId === loc.id))
    );
  }, [activeLocations, todayScans]);

  const filteredStaffList = useMemo(() => {
    return users.filter(u => u.role === staffFilter);
  }, [users, staffFilter]);

  const adminUsersList = useMemo(() => {
    return users.filter(u => u.role === 'admin');
  }, [users]);

  const myTripsHistoryByDay = useMemo(() => {
    if (!currentUser || currentUser.role !== 'driver') return [];
    const groups: { [date: string]: { date: string; tripsCount: number; passengersSum: number; trips: any[] } } = {};
    scans.forEach(scan => {
      if (scan.driverId !== currentUser.id) return;
      const date = scan.logicalDate;
      if (date === logicalToday) return;
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
  }, [scans, currentUser, logicalToday]);

  const myScansHistoryByDay = useMemo(() => {
    if (!currentUser || currentUser.role !== 'dispatcher') return [];
    const groups: { [date: string]: { date: string; scansCount: number; passengersSum: number; scans: any[] } } = {};
    scans.forEach(scan => {
      if (scan.dispatcherId !== currentUser.id) return;
      const date = scan.logicalDate;
      if (date === logicalToday) return;
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
  }, [scans, currentUser, logicalToday]);



  const shouldShowQrEvenEnRoute = useMemo(() => {
    const loc = activeLocations.find(l => l.id === currentUser?.id);
    if (!loc || loc.status !== 'en_route') return false;
    
    // Find the latest scan for this driver to get the static trip start time
    const driverScans = scans.filter(s => s.driverId === currentUser?.id);
    if (driverScans.length === 0) return false;
    
    driverScans.sort((x, y) => new Date(y.scannedAt).getTime() - new Date(x.scannedAt).getTime());
    const latestScan = driverScans[0];
    
    const startTime = dbService.parseScannedAt(latestScan.scannedAt, latestScan.logicalDate).getTime();
    const durationMs = (latestScan.etaMinutes || 28) * 60000;
    const arrivalTimeMs = startTime + durationMs;
    const remainingMins = (arrivalTimeMs - Date.now()) / 60000;
    
    return remainingMins <= 5;
  }, [activeLocations, currentUser, scans]);

  // Tracks scan IDs already auto-closed below, so the DB call only fires once per trip.
  const autoClosedScanIdsRef = useRef<Set<string>>(new Set());

  // Once the barcode reappears (shouldShowQrEvenEnRoute), close out the trip record
  // (stamp actualArrivalTime) so it doesn't linger open forever in the sheet.
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'driver') return;
    if (!shouldShowQrEvenEnRoute) return;

    const loc = activeLocations.find(l => l.id === currentUser.id);
    if (!loc || loc.status !== 'en_route') return;

    const driverScans = scans.filter(s => s.driverId === currentUser.id);
    if (driverScans.length === 0) return;
    driverScans.sort((x, y) => new Date(y.scannedAt).getTime() - new Date(x.scannedAt).getTime());
    const latestScan = driverScans[0];

    if (latestScan.actualArrivalTime) return;
    if (autoClosedScanIdsRef.current.has(latestScan.id)) return;

    autoClosedScanIdsRef.current.add(latestScan.id);
    const latestScanDirection: Direction = latestScan.departureLocation === '770' ? 'to_ohel' : 'to_770';
    dbService.updateDriverTripState(currentUser.id, 'idle', latestScanDirection);
    triggerToast(
      lang === 'he' ? 'הנסיעה נסגרה אוטומטית - התקרבת ליעד' : 'Trip auto-closed - approaching destination',
      'success'
    );
  }, [shouldShowQrEvenEnRoute, activeLocations, scans, currentUser]);

  const activeArrivalsTo770 = useMemo(() => {
    return activeLocations
      .filter(loc => loc.role === 'driver' && loc.status === 'en_route' && loc.direction === 'to_770')
      .map(loc => {
        const driverScans = scans.filter(s => s.driverId === loc.id);
        driverScans.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
        const matchingScan = driverScans[0];
        const startTime = matchingScan
          ? dbService.parseScannedAt(matchingScan.scannedAt, matchingScan.logicalDate).getTime()
          : new Date(loc.scannedAt || loc.updatedAt).getTime();
        const etaDuration = matchingScan?.etaMinutes || 28;
        const arrivalTimeMs = startTime + (etaDuration * 60000);
        return {
          ...loc,
          passengersCount: matchingScan?.passengersCount || 0,
          arrivalTimeMs
        };
      })
      .sort((a, b) => a.arrivalTimeMs - b.arrivalTimeMs);
  }, [activeLocations, scans]);

  const activeArrivalsToOhel = useMemo(() => {
    return activeLocations
      .filter(loc => loc.role === 'driver' && loc.status === 'en_route' && loc.direction === 'to_ohel')
      .map(loc => {
        const driverScans = scans.filter(s => s.driverId === loc.id);
        driverScans.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
        const matchingScan = driverScans[0];
        const startTime = matchingScan
          ? dbService.parseScannedAt(matchingScan.scannedAt, matchingScan.logicalDate).getTime()
          : new Date(loc.scannedAt || loc.updatedAt).getTime();
        const etaDuration = matchingScan?.etaMinutes || 28;
        const arrivalTimeMs = startTime + (etaDuration * 60000);
        return {
          ...loc,
          passengersCount: matchingScan?.passengersCount || 0,
          arrivalTimeMs
        };
      })
      .sort((a, b) => a.arrivalTimeMs - b.arrivalTimeMs);
  }, [activeLocations, scans]);

  // --- Handlers ---
  const handleCodeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim()) {
      triggerToast(t('enterPasscode'), 'danger');
      return;
    }
    const user = dbService.loginWithCode(loginCode.trim());
    if (user && user.role === 'screen') {
      // Screen codes only ever unlock the public /board display — never the
      // dispatcher app itself, so reject explicitly rather than letting it
      // silently fall through and behave like some other role.
      triggerToast(t('screenCodeLoginRejected'), 'danger');
      return;
    }
    if (user) {
      localStorage.setItem('tp_current_user', JSON.stringify(user));
      setCurrentUser(user);
      setLoginCode('');
      triggerToast(t('welcomeUser', { name: user.name }), 'success');
    } else {
      triggerToast(t('loginError'), 'danger');
    }
  };

  // Unmounting the current role's view (especially the driver's live-tracking
  // screen, with its GPS watch and real-time cards) is real synchronous work.
  // Show the spinner FIRST via a state update, then defer the actual teardown
  // to the next tick so the browser gets a chance to paint that spinner before
  // the heavy unmount blocks the main thread - otherwise the tap can feel
  // "stuck" for a moment with zero feedback.
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('tp_current_user');
      setCurrentUser(null);
      setIsLoggingOut(false);
      triggerToast(t('logoutSuccess'), 'success');
    }, 30);
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



  // --- Driver Actions ---
  const handleDriverStatusChange = (status: DriverStatus) => {
    if (!currentUser) return;
    let direction: Direction = null;
    if (status === 'en_route') {
      const driverScans = scans.filter(s => s.driverId === currentUser.id);
      driverScans.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
      const lastScan = driverScans[0];
      direction = lastScan?.departureLocation === '770' ? 'to_ohel' : 'to_770';
    }
    dbService.updateDriverTripState(currentUser.id, status, direction);
    triggerToast(t('statusUpdated', { status: status === 'idle' ? t('statusIdle') : status === 'break' ? t('statusBreak') : t('statusEnRoute') }), 'success');
  };

  const handleEndTripWithGpsCheck = (loc: any) => {
    if (!loc) return;
    
    triggerToast(lang === 'he' ? 'בודק מיקום GPS נוכחי...' : 'Checking current GPS location...');
    
    if (!navigator.geolocation) {
      triggerToast(lang === 'he' ? 'גישת GPS אינה נתמכת בדפדפן זה!' : 'GPS is not supported by this browser!', 'danger');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        
        // Find destination coordinates
        const dest = loc.direction === 'to_ohel' ? LOCATIONS['Ohel'] : LOCATIONS['770'];
        
        // Calculate distance in km
        const R = 6371; // Earth radius in km
        const dLat = (dest.latitude - userLat) * Math.PI / 180;
        const dLon = (dest.longitude - userLng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(userLat * Math.PI / 180) * Math.cos(dest.latitude * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        
        if (distanceKm > 1.0) {
          const distanceMsg = lang === 'he' 
            ? `אינך ברדיוס ההגעה! מרחק נוכחי: ${distanceKm.toFixed(2)} ק"מ מהיעד. עליך להיות במרחק של פחות מ-1 ק"מ כדי לאשר הגעה.`
            : `You are not within range! Current distance: ${distanceKm.toFixed(2)} km. You must be under 1 km to confirm arrival.`;
          alert(distanceMsg);
          triggerToast(lang === 'he' ? 'אישור ההגעה נכשל - מחוץ לרדיוס!' : 'Arrival confirmation failed - out of range!', 'danger');
        } else {
          // Success! End the trip
          handleDriverStatusChange('idle');
          triggerToast(lang === 'he' ? 'הנסיעה הסתיימה בהצלחה!' : 'Trip ended successfully!', 'success');
        }
      },
      (error) => {
        console.error("GPS Error:", error);
        const errorMsg = lang === 'he'
          ? 'שגיאת מיקום: אנא ודא שהפעלת GPS ואשר גישת מיקום בדפדפן!'
          : 'Location error: Please ensure GPS is enabled and allow location permission!';
        alert(errorMsg);
        triggerToast(lang === 'he' ? 'נכשל בקבלת מיקום GPS!' : 'Failed to retrieve GPS location!', 'danger');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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

  const handleBulkDeleteScans = async (ids: Set<string>, clearSelection: () => void) => {
    if (ids.size === 0) return;
    if (!window.confirm(t('confirmBulkDeleteScans', { count: ids.size }))) return;
    await Promise.all(Array.from(ids).map(id => dbService.deleteScan(id)));
    clearSelection();
    triggerToast(t('bulkScansDeleted', { count: ids.size }), 'success');
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    // A screen isn't a real staff member, so the "phone" field (repurposed as a
    // free-text screen location note) isn't required for that role.
    if (!newUserName || !newUserCode || (newUserRole !== 'screen' && !newUserPhone)) {
      triggerToast(t('fillAllFields'), 'danger');
      return;
    }

    const cleanCode = newUserCode.trim();
    if (users.some(u => u.code === cleanCode)) {
      triggerToast(t('codeDuplicate'), 'danger');
      return;
    }

    const id = 'usr_' + Math.random().toString(36).substr(2, 9);
    const roleSuffix = newUserRole === 'driver' ? ' (נהג)' : newUserRole === 'dispatcher' ? ' (סדרן)' : newUserRole === 'screen' ? ' (מסך)' : ' (מנהל)';

    dbService.saveUser({
      id,
      name: newUserName + roleSuffix,
      phone: newUserPhone,
      role: newUserRole,
      code: cleanCode,
      capacity: newUserRole === 'driver' ? newUserCapacity : undefined,
      isBigBus: newUserRole === 'driver' ? newUserIsBigBus : undefined,
      canSelfReport: newUserRole === 'driver' ? newUserCanSelfReport : undefined,
      createdAt: new Date().toISOString()
    });

    triggerToast(t('userCreatedText', { name: newUserName }), 'success');

    // Reset Form
    setNewUserName('');
    setNewUserPhone('');
    setNewUserCode('');
    setNewUserIsBigBus(false);
    setNewUserCanSelfReport(false);
    setNewUserCapacity(15);
  };

  // Creates the real User directly from a pending self-registration request
  // (optionally admin-edited first) and removes the pending request. Used by
  // both the auto-popup modal and the Users-tab card - see PendingRegistrationCard.
  const handleApproveRegistration = async (reg: PendingRegistration, values: { name: string; phone: string; code: string; capacity?: number; isBigBus?: boolean }) => {
    const cleanName = values.name.trim();
    const cleanPhone = values.phone.trim();
    const cleanCode = values.code.trim();
    if (!cleanName || !cleanCode || !cleanPhone) {
      triggerToast(t('fillAllFields'), 'danger');
      return;
    }

    // The actual create-user + delete-pending-request writes happen entirely
    // server-side (api/approve-registration.js), as one atomic Firestore
    // batch - either both land or neither does. This used to be two
    // sequential client-side Firestore calls guarded by a client-side
    // setTimeout-based timeout; that guard didn't actually help against the
    // real failure mode observed live: a backgrounded browser tab (admin
    // switches apps, phone screen locks mid-approval) throttles JS timers,
    // including the "safety" timeout itself, leaving the card silently
    // stuck with zero feedback and zero Firestore writes ever attempted.
    // Doing the writes server-side removes the browser tab's lifecycle from
    // the equation - the approval completes regardless of what the tab does
    // after the request is sent.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const resp = await fetch('/api/approve-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          pendingId: reg.id,
          name: cleanName,
          phone: cleanPhone,
          role: reg.role,
          code: cleanCode,
          capacity: reg.role === 'driver' ? values.capacity : undefined,
          isBigBus: reg.role === 'driver' ? values.isBigBus : undefined
        })
      });
      await resp.json();
      if (!resp.ok) {
        if (resp.status === 409) {
          triggerToast(t('codeDuplicate'), 'danger');
        } else {
          triggerToast(t('approveRegistrationFailed'), 'danger');
        }
        return;
      }
      triggerToast(t('userCreatedText', { name: cleanName }), 'success');
    } catch (e) {
      // The request may still complete server-side even if the client never
      // sees the response (e.g. the tab was backgrounded when it returned) -
      // the pending card will simply disappear once the live Firestore
      // listener picks up the delete, whenever that response actually lands.
      triggerToast(t('approveRegistrationFailed'), 'danger');
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleRejectRegistration = async (id: string) => {
    if (!window.confirm(t('confirmRejectRegistration'))) return;
    try {
      await withTimeout(dbService.deletePendingRegistration(id), 10000, 'deletePendingRegistration');
      triggerToast(t('registrationRejected'), 'success');
    } catch (e) {
      triggerToast(t('rejectRegistrationFailed'), 'danger');
    }
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
      .replace(' (מנהל)', '')
      .replace(' (מסך)', '');
    setEditUserName(cleanName);
    setEditUserPhone(user.phone);
    setEditUserCode(user.code);
    setEditUserRole(user.role);
    setEditUserCapacity(user.capacity || 15);
    setEditUserIsBigBus(user.isBigBus || false);
    setEditUserCanSelfReport(user.canSelfReport || false);
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    if (!editUserName || !editUserCode || (editUserRole !== 'screen' && !editUserPhone)) {
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
    else if (editUserRole === 'screen') roleSuffix = ' (מסך)';
    else if (editUserRole === 'admin') roleSuffix = ' (מנהל)';

    const updatedUser: User = {
      ...selectedUserForEdit,
      name: editUserName + roleSuffix,
      phone: editUserPhone,
      role: editUserRole,
      code: cleanCode,
      capacity: editUserRole === 'driver' ? editUserCapacity : undefined,
      isBigBus: editUserRole === 'driver' ? editUserIsBigBus : undefined,
      canSelfReport: editUserRole === 'driver' ? editUserCanSelfReport : undefined
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
      lang === 'he' ? 'פרשת שבוע' : 'Weekly Parsha',
      lang === 'he' ? 'תאריך עברי' : 'Hebrew Date',
      lang === 'he' ? 'יום' : 'Day',
      lang === 'he' ? 'שעת סריקה' : 'Scan Time',
      lang === 'he' ? 'תאריך עבודה' : 'Logical Date',
      lang === 'he' ? 'נהג' : 'Driver',
      lang === 'he' ? 'סדרן' : 'Dispatcher',
      lang === 'he' ? 'מוצא' : 'Origin',
      lang === 'he' ? 'נוסעים שעלו' : 'Passengers',
      lang === 'he' ? 'מושבים פנויים' : 'Empty Seats',
      lang === 'he' ? 'קיבולת נהג' : 'Capacity'
    ];
    
    const rows = filteredScans.map(scan => {
      const scanDate = new Date(scan.logicalDate + 'T12:00:00');
      return [
        getWeeklyParsha(new Date(scan.scannedAt)),
        getHebrewDate(scanDate),
        getDayOfWeekHe(scanDate),
        new Date(scan.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        scan.logicalDate,
        scan.driverName.replace(' (נהג)', ''),
        scan.dispatcherName.replace(' (סדרן)', ''),
        scan.departureLocation === '770' ? '770' : (lang === 'he' ? 'אוהל' : 'Ohel'),
        scan.passengersCount,
        scan.remainingSeats,
        scan.driverCapacity
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');
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
      u.role === 'admin' ? (lang === 'he' ? 'מנהל' : 'Admin') : u.role === 'dispatcher' ? (lang === 'he' ? 'סדרן' : 'Dispatcher') : u.role === 'screen' ? (lang === 'he' ? 'מסך' : 'Screen') : (lang === 'he' ? 'נהג' : 'Driver'),
      u.code,
      u.capacity || ''
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');
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

  const handleExportCentralToCsv = () => {
    const q = csvCell;
    const colHeaders = [
      'פרשת שבוע', 'תאריך עברי', 'יום', 'שעת סריקה', 'תאריך עבודה',
      'נהג', 'סדרן', 'מוצא', 'נוסעים שעלו', 'מושבים פנויים', 'קיבולת נהג'
    ];
    // One flat table, no repeated per-day header/column blocks - every row
    // already carries its own parsha/Hebrew date/day/logical date columns.
    // centralFlatRows is ordered newest-first overall (matching the on-screen
    // table) - reverse it here so the download is the opposite: oldest ride at
    // the top, newest at the bottom, all the way through (not just within a day).
    const lines: string[] = [colHeaders.map(q).join(',')];
    [...centralFlatRows].reverse().forEach(r => {
      lines.push([
        q(r.parsha), q(r.hebrewDate), q(r.dayOfWeek), q(r.time), q(r.dateStr),
        q(r.driver), q(r.dispatcher), q(r.origin), q(r.passengers), q(r.remainingSeats), q(r.driverCapacity)
      ].join(','));
    });

    const csvContent = "﻿" + lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const rangeSuffix = (centralDateFrom || centralDateTo) ? `_${centralDateFrom || 'start'}_to_${centralDateTo || 'now'}` : `_${new Date().toISOString().split('T')[0]}`;
    link.setAttribute("download", `central_summary${centralBigBusOnly ? '_big_bus' : ''}${rangeSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(lang === 'he' ? 'הטבלה המרכזית יוצאה לאקסל בהצלחה' : 'Central table exported to Excel', 'success');
  };

  // --- Per-driver detailed PDF report (via browser print -> "Save as PDF") ---
  // jsPDF's built-in fonts don't support Hebrew glyphs without embedding a custom
  // font, so a real browser print window is the reliable way to get correct
  // Hebrew/RTL rendering in the exported PDF.
  const driverNamesForPdf = useMemo(() => {
    const names = new Set<string>();
    users.filter(u => u.role === 'driver').forEach(u => names.add(u.name.replace(' (נהג)', '')));
    scans.forEach(s => { if (s.driverName) names.add(s.driverName.replace(' (נהג)', '')); });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'he'));
  }, [users, scans]);

  const handleExportDriverPdf = (override?: { name: string; dateFrom: string; dateTo: string; lang?: 'he' | 'en' }) => {
    const driverName = override?.name ?? selectedDriverForPdf;
    if (!driverName) return;
    const pdfLang = override?.lang ?? lang;
    const driverScans = applyCentralFilters(
      scans.filter(s => (s.driverName || '').replace(' (נהג)', '') === driverName),
      override ? { from: override.dateFrom, to: override.dateTo } : undefined
    )
      .slice()
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

    const totalRides = driverScans.length;
    const totalPassengers = driverScans.reduce((sum, s) => sum + (s.passengersCount || 0), 0);

    const buildRows = (locale: 'he' | 'en') => driverScans.map(s => {
      const when = new Date(s.scannedAt);
      const dayDate = new Date((s.logicalDate || '') + 'T12:00:00');
      const isReturn = s.departureLocation === 'Ohel';
      const bigBus = (s.driverCapacity || 0) >= BIG_BUS_MIN_CAPACITY;
      const route = locale === 'he' ? (isReturn ? 'אוהל ← 770' : '770 ← אוהל') : (isReturn ? 'Ohel → 770' : '770 → Ohel');
      const greg = dayDate.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const yesNo = (v: boolean) => (locale === 'he' ? (v ? 'כן' : 'לא') : (v ? 'Yes' : 'No'));
      return `<tr>
        <td>${getHebrewDate(dayDate)}</td>
        <td>${greg}</td>
        <td class="route ${isReturn ? 'return' : 'out'}">${route}</td>
        <td class="mono">${exactTimeStr(when)}</td>
        <td>${s.passengersCount ?? ''}</td>
        <td>${yesNo(bigBus)}</td>
      </tr>`;
    }).join('');

    const generatedOn = new Date();
    const noDataRow = (locale: 'he' | 'en') => `<tr><td colspan="6" class="empty">${locale === 'he' ? 'אין נסיעות רשומות' : 'No rides recorded'}</td></tr>`;

    const section = (locale: 'he' | 'en') => {
      const t = locale === 'he' ? {
        title: 'דו"ח נסיעות מפורט', driver: 'נהג', generated: 'הופק בתאריך', rides: 'סה"כ נסיעות', pax: 'סה"כ נוסעים שהסיע',
        hDate: 'תאריך עברי', gDate: 'תאריך לועזי', route: 'מסלול', time: 'שעה', people: 'אנשים', bigBus: 'אוטובוס גדול',
        hoursTitle: 'פירוט לפי שעות', scope: 'טווח הדוח', footer: 'הופק אוטומטית ממערכת אוהל בוס',
        download: 'הורד כ-PDF'
      } : {
        title: 'Detailed Driver Report', driver: 'Driver', generated: 'Generated on', rides: 'Total Rides', pax: 'Total Passengers Driven',
        hDate: 'Hebrew Date', gDate: 'Gregorian Date', route: 'Route', time: 'Time', people: 'People', bigBus: 'Big Bus',
        hoursTitle: 'Hourly Breakdown', scope: 'Report scope', footer: 'Automatically generated by the Ohel Bus system',
        download: 'Download as PDF'
      };
      const dir = locale === 'he' ? 'rtl' : 'ltr';
      return `<div class="lang-section" data-lang="${locale}" dir="${dir}">
        <div class="report-header">
          <img src="${new URL(logoDark, window.location.origin).href}" alt="Ohel Smart" class="logo" />
          <div>
            <h1>${t.title}</h1>
            <div class="driver-name">${t.driver}: ${escHtml(driverName)}</div>
            <div class="sub">${t.generated} ${generatedOn.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')} · ${generatedOn.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div class="scope-badge"><strong>${t.scope}:</strong> ${buildFilterScopeLabel(locale, override ? { from: override.dateFrom, to: override.dateTo } : undefined)}</div>
        </div>
        </div>
        <div class="stats-row">
          <div class="stat-card"><span class="stat-value">${totalRides}</span><span class="stat-label">🚗 ${t.rides}</span></div>
          <div class="stat-card"><span class="stat-value">${totalPassengers}</span><span class="stat-label">👥 ${t.pax}</span></div>
        </div>
        <div class="hours-section">
          <h2 class="section-title">${t.hoursTitle}</h2>
          ${buildHourlyBreakdownHtml(driverScans.map(s => s.scannedAt), locale)}
        </div>
        <table>
          <thead><tr><th>${t.hDate}</th><th>${t.gDate}</th><th>${t.route}</th><th>${t.time}</th><th>${t.people}</th><th>${t.bigBus}</th></tr></thead>
          <tbody>${buildRows(locale) || noDataRow(locale)}</tbody>
        </table>
        <div class="download-footer"><button onclick="window.print()">📥 ${t.download}</button></div>
        <div class="footer">${t.footer}</div>
      </div>`;
    };

    const html = `<!DOCTYPE html><html lang="${pdfLang}" dir="${pdfLang === 'he' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
      <title>${pdfLang === 'he' ? 'דו"ח נהג' : 'Driver Report'} - ${escHtml(driverName)}</title>
      <style>
        :root { --gold: #b9872f; --gold-bg: #fbf3e3; --ink: #1a1a1a; --muted: #6b6b6b; --border: #e3d9c4; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; padding: 32px; color: var(--ink); background: #fff; margin: 0; }
        .lang-section { max-width: 760px; margin: 0 auto; }
        .report-header { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; border-bottom: 3px solid var(--gold); padding-bottom: 16px; margin-bottom: 20px; }
        .logo { height: 44px; }
        h1 { font-size: 20px; margin: 0 0 2px; color: var(--ink); }
        .driver-name { font-size: 15px; font-weight: 700; color: var(--gold); }
        .sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
        .scope-badge { flex-basis: 100%; background: var(--gold-bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 12px; color: var(--ink); }
        .scope-badge strong { color: var(--gold); }
        .stats-row { display: flex; gap: 12px; margin-bottom: 22px; }
        .stat-card { flex: 1; background: var(--gold-bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; }
        .stat-value { font-size: 24px; font-weight: 800; color: var(--ink); }
        .stat-label { font-size: 12px; color: var(--muted); }
        .section-title { font-size: 14px; font-weight: 700; color: var(--ink); margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
        .hours-section { margin-bottom: 22px; }
        .hours-day { margin-bottom: 10px; }
        .hours-day-title { font-size: 12px; font-weight: 700; color: var(--gold); margin-bottom: 5px; }
        .hours-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .hours-chip { background: var(--gold-bg); border: 1px solid var(--border); border-radius: 6px; padding: 4px 9px; font-size: 11.5px; font-family: 'Courier New', monospace; color: var(--ink); }
        table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        th { background: var(--ink); color: #fff; padding: 9px 10px; font-weight: 600; }
        td { border-bottom: 1px solid var(--border); padding: 8px 10px; }
        tbody tr:nth-child(even) { background: #faf7f0; }
        .mono { font-family: 'Courier New', monospace; }
        .route.out { color: var(--gold); font-weight: 700; }
        .route.return { color: #0891b2; font-weight: 700; }
        .empty { text-align: center; color: var(--muted); padding: 20px; }
        .download-footer { text-align: center; margin-top: 24px; }
        .download-footer button { background: var(--gold); color: #fff; border: none; border-radius: 8px; padding: 12px 28px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .download-footer button:hover { opacity: 0.9; }
        .footer { margin-top: 20px; text-align: center; color: var(--muted); font-size: 11px; }
        @media print { .download-footer { display: none; } body { padding: 0; } }
      </style></head>
      <body>
        ${section(pdfLang)}
      </body></html>`;

    // A Blob URL is a more reliable way to hand a full document to a new tab
    // than document.write() - document.write() is a legacy API Chrome
    // actively intervenes on/deprioritizes in some contexts, which could
    // leave the trailing <script> (the language toggle) not running.
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow) { triggerToast(lang === 'he' ? 'החלון נחסם - אפשר חלונות קופצים' : 'Popup blocked - allow popups', 'danger'); return; }
    printWindow.focus();
  };

  // --- Per-dispatcher detailed PDF report (same print->PDF approach as the driver report) ---
  const dispatcherNamesForPdf = useMemo(() => {
    const names = new Set<string>();
    users.filter(u => u.role === 'dispatcher').forEach(u => names.add(u.name.replace(' (סדרן)', '')));
    scans.forEach(s => { if (s.dispatcherName) names.add(s.dispatcherName.replace(' (סדרן)', '')); });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'he'));
  }, [users, scans]);

  const handleExportDispatcherPdf = (override?: { name: string; dateFrom: string; dateTo: string; lang?: 'he' | 'en' }) => {
    const dispatcherName = override?.name ?? selectedDispatcherForPdf;
    if (!dispatcherName) return;
    const pdfLang = override?.lang ?? lang;
    const dispatcherScans = applyCentralFilters(
      scans.filter(s => (s.dispatcherName || '').replace(' (סדרן)', '') === dispatcherName),
      override ? { from: override.dateFrom, to: override.dateTo } : undefined
    )
      .slice()
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

    const totalRides = dispatcherScans.length;
    const totalPassengers = dispatcherScans.reduce((sum, s) => sum + (s.passengersCount || 0), 0);
    const distinctBuses = new Set(dispatcherScans.map(s => (s.driverName || '').replace(' (נהג)', ''))).size;

    const buildRows = (locale: 'he' | 'en') => dispatcherScans.map(s => {
      const when = new Date(s.scannedAt);
      const dayDate = new Date((s.logicalDate || '') + 'T12:00:00');
      const isReturn = s.departureLocation === 'Ohel';
      const route = locale === 'he' ? (isReturn ? 'אוהל ← 770' : '770 ← אוהל') : (isReturn ? 'Ohel → 770' : '770 → Ohel');
      const greg = dayDate.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `<tr>
        <td>${getHebrewDate(dayDate)}</td>
        <td>${greg}</td>
        <td class="route ${isReturn ? 'return' : 'out'}">${route}</td>
        <td class="mono">${exactTimeStr(when)}</td>
        <td>${escHtml((s.driverName || '').replace(' (נהג)', ''))}</td>
        <td>${s.passengersCount ?? ''}</td>
      </tr>`;
    }).join('');

    const generatedOn = new Date();
    const noDataRow = (locale: 'he' | 'en') => `<tr><td colspan="6" class="empty">${locale === 'he' ? 'אין נסיעות רשומות' : 'No rides recorded'}</td></tr>`;

    const section = (locale: 'he' | 'en') => {
      const t = locale === 'he' ? {
        title: 'דו"ח סריקות מפורט', dispatcher: 'סדרן', generated: 'הופק בתאריך', rides: 'סה"כ נסיעות', pax: 'סה"כ נוסעים',
        buses: 'סה"כ אוטובוסים שונים', hDate: 'תאריך עברי', gDate: 'תאריך לועזי', route: 'מסלול', time: 'שעה', driver: 'נהג', people: 'אנשים',
        hoursTitle: 'פירוט לפי שעות', scope: 'טווח הדוח', footer: 'הופק אוטומטית ממערכת אוהל בוס',
        download: 'הורד כ-PDF'
      } : {
        title: 'Detailed Dispatcher Report', dispatcher: 'Dispatcher', generated: 'Generated on', rides: 'Total Rides', pax: 'Total Passengers',
        buses: 'Distinct Buses', hDate: 'Hebrew Date', gDate: 'Gregorian Date', route: 'Route', time: 'Time', driver: 'Driver', people: 'People',
        hoursTitle: 'Hourly Breakdown', scope: 'Report scope', footer: 'Automatically generated by the Ohel Bus system',
        download: 'Download as PDF'
      };
      const dir = locale === 'he' ? 'rtl' : 'ltr';
      return `<div class="lang-section" data-lang="${locale}" dir="${dir}">
        <div class="report-header">
          <img src="${new URL(logoDark, window.location.origin).href}" alt="Ohel Smart" class="logo" />
          <div>
            <h1>${t.title}</h1>
            <div class="driver-name">${t.dispatcher}: ${escHtml(dispatcherName)}</div>
            <div class="sub">${t.generated} ${generatedOn.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')} · ${generatedOn.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div class="scope-badge"><strong>${t.scope}:</strong> ${buildFilterScopeLabel(locale, override ? { from: override.dateFrom, to: override.dateTo } : undefined)}</div>
        </div>
        <div class="stats-row">
          <div class="stat-card"><span class="stat-value">${totalRides}</span><span class="stat-label">🚗 ${t.rides}</span></div>
          <div class="stat-card"><span class="stat-value">${distinctBuses}</span><span class="stat-label">🚌 ${t.buses}</span></div>
          <div class="stat-card"><span class="stat-value">${totalPassengers}</span><span class="stat-label">👥 ${t.pax}</span></div>
        </div>
        <div class="hours-section">
          <h2 class="section-title">${t.hoursTitle}</h2>
          ${buildHourlyBreakdownHtml(dispatcherScans.map(s => s.scannedAt), locale)}
        </div>
        <table>
          <thead><tr><th>${t.hDate}</th><th>${t.gDate}</th><th>${t.route}</th><th>${t.time}</th><th>${t.driver}</th><th>${t.people}</th></tr></thead>
          <tbody>${buildRows(locale) || noDataRow(locale)}</tbody>
        </table>
        <div class="download-footer"><button onclick="window.print()">📥 ${t.download}</button></div>
        <div class="footer">${t.footer}</div>
      </div>`;
    };

    const html = `<!DOCTYPE html><html lang="${pdfLang}" dir="${pdfLang === 'he' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
      <title>${pdfLang === 'he' ? 'דו"ח סדרן' : 'Dispatcher Report'} - ${escHtml(dispatcherName)}</title>
      <style>
        :root { --gold: #b9872f; --gold-bg: #fbf3e3; --ink: #1a1a1a; --muted: #6b6b6b; --border: #e3d9c4; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; padding: 32px; color: var(--ink); background: #fff; margin: 0; }
        .lang-section { max-width: 760px; margin: 0 auto; }
        .report-header { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; border-bottom: 3px solid var(--gold); padding-bottom: 16px; margin-bottom: 20px; }
        .logo { height: 44px; }
        h1 { font-size: 20px; margin: 0 0 2px; color: var(--ink); }
        .driver-name { font-size: 15px; font-weight: 700; color: var(--gold); }
        .sub { color: var(--muted); font-size: 12px; margin-top: 2px; }
        .scope-badge { flex-basis: 100%; background: var(--gold-bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 12px; color: var(--ink); }
        .scope-badge strong { color: var(--gold); }
        .stats-row { display: flex; gap: 12px; margin-bottom: 22px; }
        .stat-card { flex: 1; background: var(--gold-bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; }
        .stat-value { font-size: 24px; font-weight: 800; color: var(--ink); }
        .stat-label { font-size: 12px; color: var(--muted); }
        .section-title { font-size: 14px; font-weight: 700; color: var(--ink); margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
        .hours-section { margin-bottom: 22px; }
        .hours-day { margin-bottom: 10px; }
        .hours-day-title { font-size: 12px; font-weight: 700; color: var(--gold); margin-bottom: 5px; }
        .hours-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .hours-chip { background: var(--gold-bg); border: 1px solid var(--border); border-radius: 6px; padding: 4px 9px; font-size: 11.5px; font-family: 'Courier New', monospace; color: var(--ink); }
        table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        th { background: var(--ink); color: #fff; padding: 9px 10px; font-weight: 600; }
        td { border-bottom: 1px solid var(--border); padding: 8px 10px; }
        tbody tr:nth-child(even) { background: #faf7f0; }
        .mono { font-family: 'Courier New', monospace; }
        .route.out { color: var(--gold); font-weight: 700; }
        .route.return { color: #0891b2; font-weight: 700; }
        .empty { text-align: center; color: var(--muted); padding: 20px; }
        .download-footer { text-align: center; margin-top: 24px; }
        .download-footer button { background: var(--gold); color: #fff; border: none; border-radius: 8px; padding: 12px 28px; font-size: 14px; font-weight: 700; cursor: pointer; }
        .download-footer button:hover { opacity: 0.9; }
        .footer { margin-top: 20px; text-align: center; color: var(--muted); font-size: 11px; }
        @media print { .download-footer { display: none; } body { padding: 0; } }
      </style></head>
      <body>
        ${section(pdfLang)}
      </body></html>`;

    // A Blob URL is a more reliable way to hand a full document to a new tab
    // than document.write() - document.write() is a legacy API Chrome
    // actively intervenes on/deprioritizes in some contexts, which could
    // leave the trailing <script> (the language toggle) not running.
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow) { triggerToast(lang === 'he' ? 'החלון נחסם - אפשר חלונות קופצים' : 'Popup blocked - allow popups', 'danger'); return; }
    printWindow.focus();
  };

  // --- Self-service report for a logged-in driver/dispatcher: their own data
  // only, for a period they pick (week/month), no on-screen table - just a
  // period choice and a download, reusing the same PDF builders admins use.
  const [selfReportPeriod, setSelfReportPeriod] = useState<'week' | 'month'>('month');
  const [selfReportLang, setSelfReportLang] = useState<'he' | 'en'>(lang);

  const handleDownloadMyReport = () => {
    if (!currentUser) return;
    const to = new Date();
    const from = new Date(to);
    if (selfReportPeriod === 'week') from.setDate(from.getDate() - 7);
    else from.setMonth(from.getMonth() - 1);
    const dateFrom = from.toISOString().split('T')[0];
    const dateTo = to.toISOString().split('T')[0];

    if (currentUser.role === 'driver') {
      handleExportDriverPdf({ name: currentUser.name.replace(' (נהג)', ''), dateFrom, dateTo, lang: selfReportLang });
    } else if (currentUser.role === 'dispatcher') {
      handleExportDispatcherPdf({ name: currentUser.name.replace(' (סדרן)', ''), dateFrom, dateTo, lang: selfReportLang });
    }
  };

  const handleCopyReturnLink = () => {
    const link = `${window.location.origin}/?report=return`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(
        () => triggerToast(lang === 'he' ? 'קישור הדיווח לנהגים הועתק!' : 'Driver report link copied!', 'success'),
        () => triggerToast(link, 'success')
      );
    } else {
      triggerToast(link, 'success');
    }
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



  return (
    <div className="app-container">
      {/* Toast Messages Layer */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast ${toast.type === 'danger' ? 'toast-danger' : ''} ${toast.closing ? 'toast-closing' : ''}`}
          >
            <span className="toast-icon">
              {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertOctagon size={16} />}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button className="toast-close" onClick={() => dismissToast(toast.id)} aria-label={lang === 'he' ? 'סגור' : 'Close'}>
              <X size={14} />
            </button>
            <span className="toast-progress" />
          </div>
        ))}
      </div>

      {/* Scan-saving / logout overlay: visible feedback from tap until it resolves */}
      {(isSavingScan || isLoggingOut) && (
        <div className="saving-overlay">
          <div className="saving-spinner" />
        </div>
      )}

      {/* Pending self-registration requests - pops up for the admin as soon as
          the app is open (any tab), not just when they navigate to Users. */}
      {showPendingRegModal && currentUser?.role === 'admin' && pendingRegistrations.length > 0 && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', maxHeight: '85vh', overflowY: 'auto', padding: '24px', border: '1px solid var(--accent)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="var(--accent)" />
                {t('pendingRegistrationsTitle')} ({pendingRegistrations.length})
              </h3>
              <button onClick={closePendingRegModal} className="btn btn-icon-only" style={{ color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingRegistrations.map(reg => (
                <PendingRegistrationCard key={reg.id} reg={reg} t={t} onApprove={handleApproveRegistration} onReject={handleRejectRegistration} />
              ))}
            </div>
          </div>
        </div>
      )}

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

            {/* Version indicator */}
            <div style={{ marginTop: '24px', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              {lang === 'he' ? 'גרסה 2.3 (תגובת סריקה מהירה)' : 'Version 2.3 (Instant Scan Response)'}
            </div>
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

                    <form onSubmit={(e) => e.preventDefault()}>
                      <div className="form-group">
                        <label className="form-label">{t('driverLabel')}</label>
                        <select 
                          className="form-input form-select"
                          value={selectedDriverId}
                          onChange={(e) => {
                            const drvId = e.target.value;
                            if (drvId) {
                              const matched = users.find(u => u.id === drvId && u.role === 'driver');
                              if (matched) {
                                setScannerModalDriver(matched);
                                setScannerModalPassengers(0);
                                setSelectedDriverId('');
                              }
                            }
                          }}
                        >
                          <option value="">{t('selectDriver')}</option>
                          {driversList.map(drv => (
                            <option key={drv.id} value={drv.id}>
                              {drv.name.replace(' (נהג)', '')} ({drv.capacity} {lang === 'he' ? 'מקומות רכב' : 'seats'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: '8px' }}>
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
                    </form>
                  </div>
                )}

                {activeTab === 'arrivals' && (
                  <>
                    {/* Real-time Arrivals Board */}
                    <div className="card" style={{ padding: '24px', marginBottom: '16px', textAlign: lang === 'he' ? 'right' : 'left' }}>
                      <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#fff' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }}></span>
                        <span>{lang === 'he' ? 'לוח הגעות אוטובוסים בזמן אמת' : 'Live Bus Arrivals Board'}</span>
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        {/* Heading to 770 */}
                        <div style={{ background: 'rgba(226, 176, 78, 0.03)', border: '1px solid rgba(226, 176, 78, 0.15)', borderRadius: '12px', padding: '16px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Navigation size={14} style={{ transform: 'rotate(45deg)' }} />
                            {lang === 'he' ? 'בדרך ל-770 (קראון הייטס)' : 'En Route to 770 (Crown Heights)'}
                          </h4>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {activeArrivalsTo770.length === 0 ? (
                              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                                {lang === 'he' ? 'אין אוטובוסים בדרך' : 'No shuttles en route'}
                              </div>
                            ) : (
                              activeArrivalsTo770.map(arr => (
                                <div key={arr.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                                    <strong style={{ fontSize: '13px', color: '#fff', display: 'block' }}>{arr.name.replace(' (נהג)', '')}</strong>
                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                      {arr.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                                    <span 
                                      className="badge" 
                                      style={{ 
                                        background: 'rgba(226, 176, 78, 0.15)', 
                                        color: 'var(--accent)', 
                                        borderColor: 'rgba(226, 176, 78, 0.2)',
                                        fontSize: '11px',
                                        padding: '4px 8px',
                                        fontWeight: 'bold',
                                        animation: 'pulse 2s infinite'
                                      }}
                                    >
                                      {arr.expectedArrivalTime || (lang === 'he' ? 'מחשב...' : 'calc...')}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Heading to Ohel */}
                        <div style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '12px', padding: '16px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-route-ohel)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Navigation size={14} style={{ transform: 'rotate(135deg)' }} />
                            {lang === 'he' ? 'בדרך לאוהל חב"ד (קווינס)' : 'En Route to Chabad Ohel (Queens)'}
                          </h4>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {activeArrivalsToOhel.length === 0 ? (
                              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                                {lang === 'he' ? 'אין אוטובוסים בדרך' : 'No shuttles en route'}
                              </div>
                            ) : (
                              activeArrivalsToOhel.map(arr => (
                                <div key={arr.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                                    <strong style={{ fontSize: '13px', color: '#fff', display: 'block' }}>{arr.name.replace(' (נהג)', '')}</strong>
                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                      {arr.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                                    <span 
                                      className="badge" 
                                      style={{ 
                                        background: 'rgba(6, 182, 212, 0.15)', 
                                        color: 'var(--accent-route-ohel)', 
                                        borderColor: 'rgba(6, 182, 212, 0.2)',
                                        fontSize: '11px',
                                        padding: '4px 8px',
                                        fontWeight: 'bold',
                                        animation: 'pulse 2s infinite'
                                      }}
                                    >
                                      {arr.expectedArrivalTime || (lang === 'he' ? 'מחשב...' : 'calc...')}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Today's Departures Schedule */}
                    <div className="card" style={{ padding: '24px', textAlign: lang === 'he' ? 'right' : 'left' }}>
                      <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={18} color="var(--accent)" />
                          <span>{lang === 'he' ? 'לו"ז יציאות להיום' : "Today's Departures"}</span>
                        </div>
                        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                          {todayScans.length}
                        </span>
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                        {todayScans.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {lang === 'he' ? 'אין נסיעות היום' : 'No departures today'}
                          </div>
                        ) : (
                          todayScans.map(scan => (
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

                    {/* Self-service PDF report - small link at the bottom */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                      <select
                        value={selfReportPeriod}
                        onChange={e => setSelfReportPeriod(e.target.value as 'week' | 'month')}
                        style={{ fontSize: '11px', padding: '4px 6px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)' }}
                      >
                        <option value="week">{t('myReportWeek')}</option>
                        <option value="month">{t('myReportMonth')}</option>
                      </select>
                      <select
                        value={selfReportLang}
                        onChange={e => setSelfReportLang(e.target.value as 'he' | 'en')}
                        style={{ fontSize: '11px', padding: '4px 6px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)' }}
                      >
                        <option value="he">עברית</option>
                        <option value="en">English</option>
                      </select>
                      <button
                        onClick={handleDownloadMyReport}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', padding: '4px 2px' }}
                      >
                        <FileText size={12} />
                        {t('myReportDownload')}
                      </button>
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

                <button 
                  onClick={() => setActiveTab('arrivals')} 
                  className={`bottom-nav-item ${activeTab === 'arrivals' ? 'active' : ''}`}
                >
                  <Clock size={18} />
                  <span>{lang === 'he' ? 'לוח הגעות' : 'Arrivals Board'}</span>
                </button>

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
              
              <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>{t('driverTitle')}</span>
                    <strong style={{ fontSize: '14px', color: '#fff' }}>{currentUser.name.replace(' (נהג)', '')}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  </div>
                </div>

                {/* Live Clock Widget */}
                <div style={{ padding: '0 20px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '0.5px', lineHeight: 1 }}>
                    {currentLiveTime.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/New_York' })}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {currentLiveTime.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/New_York' })}
                  </span>
                </div>
              </div>

              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {activeTab === 'qr' && (() => {
                  const loc = activeLocations.find(l => l.id === currentUser.id);
                  const isDriverEnRoute = loc?.status === 'en_route';

                  // Direction and the arrival-time numbers below must both be derived from
                  // the exact same latest scan, in the same render, so they can never
                  // contradict each other (previously direction came from `loc.direction`,
                  // a separately-sourced field, while the time numbers were recomputed
                  // fresh from `scans` here — those two could transiently disagree).
                  const driverScans = scans.filter(s => s.driverId === currentUser.id);
                  driverScans.sort((x, y) => new Date(y.scannedAt).getTime() - new Date(x.scannedAt).getTime());
                  const latestScan = driverScans[0];

                  const currentDriverDirection: Direction = latestScan
                    ? (latestScan.departureLocation === '770' ? 'to_ohel' : 'to_770')
                    : (loc?.direction ?? null);

                  let expectedTimeStr = '--:--';
                  let remainingMinutes: number | null = null;
                  if (isDriverEnRoute && latestScan && latestScan.scannedAt) {
                    const startTime = dbService.parseScannedAt(latestScan.scannedAt, latestScan.logicalDate);
                    const duration = latestScan.etaMinutes || 28;
                    const arrivalTimeMs = startTime.getTime() + duration * 60000;
                    const arrivalTime = new Date(arrivalTimeMs);
                    expectedTimeStr = arrivalTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                    remainingMinutes = Math.max(0, Math.round((arrivalTimeMs - currentLiveTime.getTime()) / 60000));
                  }

                  // Same-source correction applied to the loc object passed down to the
                  // End Trip GPS check, so it compares against the correct destination.
                  const correctedLoc = loc ? { ...loc, direction: currentDriverDirection } : loc;

                  const routeColor = currentDriverDirection === 'to_ohel' ? 'var(--accent-route-ohel)' : 'var(--accent)';
                  const routeColorRgb = currentDriverDirection === 'to_ohel' ? '6, 182, 212' : '226, 176, 78';

                  return (isDriverEnRoute && !shouldShowQrEvenEnRoute) ? (
                    <div className="card" style={{
                      padding: '28px 22px',
                      textAlign: 'center',
                      background: `linear-gradient(180deg, rgba(${routeColorRgb}, 0.08) 0%, rgba(255,255,255,0.02) 55%)`,
                      border: `1px solid rgba(${routeColorRgb}, 0.25)`,
                      overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
                        <div className="pulsing-glow" style={{ background: `rgba(${routeColorRgb}, 0.12)`, padding: '18px', borderRadius: '50%' }}>
                          <Navigation size={34} color={routeColor} style={{ transform: currentDriverDirection === 'to_ohel' ? 'rotate(0deg)' : 'rotate(180deg)' }} />
                        </div>
                      </div>

                      <h3 style={{ fontSize: '21px', fontWeight: 800, marginBottom: '10px', color: '#fff' }}>
                        {lang === 'he' ? 'הנהג בנסיעה' : 'Driver in Trip'}
                      </h3>

                      {/* Route breadcrumb — explicit From/To micro-labels so the origin vs.
                          destination reads unambiguously regardless of the arrow direction
                          (the icon alone wasn't clear enough in English per the owner). */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '10px', marginBottom: '22px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {lang === 'he' ? 'מוצא' : 'From'}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: currentDriverDirection === 'to_ohel' ? 'var(--accent)' : routeColor }}>
                            {currentDriverDirection === 'to_ohel' ? '770' : (lang === 'he' ? 'אוהל חב"ד' : 'Ohel')}
                          </span>
                        </div>
                        <div style={{ flex: '0 0 44px', height: '2px', background: `linear-gradient(90deg, rgba(${routeColorRgb},0.15), rgba(${routeColorRgb},0.7))`, position: 'relative', marginTop: '15px' }}>
                          <Navigation size={12} color={routeColor} style={{ position: 'absolute', top: '-5px', right: lang === 'he' ? 'auto' : '-4px', left: lang === 'he' ? '-4px' : 'auto', transform: lang === 'he' ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {lang === 'he' ? 'יעד' : 'To'}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: currentDriverDirection === 'to_ohel' ? routeColor : 'var(--accent)' }}>
                            {currentDriverDirection === 'to_ohel' ? (lang === 'he' ? 'אוהל חב"ד' : 'Ohel') : '770'}
                          </span>
                        </div>
                      </div>

                      {/* ETA stat row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '22px' }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px 10px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                            {lang === 'he' ? 'שעת הגעה צפויה' : 'Expected Arrival'}
                          </span>
                          <strong style={{ fontSize: '26px', color: '#fff', display: 'block', fontFamily: 'monospace', lineHeight: 1.1 }}>
                            {expectedTimeStr}
                          </strong>
                        </div>
                        <div style={{ background: `rgba(${routeColorRgb}, 0.1)`, border: `1px solid rgba(${routeColorRgb}, 0.25)`, borderRadius: '14px', padding: '14px 10px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                            {lang === 'he' ? 'זמן נסיעה נותר' : 'Time Remaining'}
                          </span>
                          <strong style={{ fontSize: '26px', color: routeColor, display: 'block', lineHeight: 1.1 }}>
                            {remainingMinutes !== null ? (lang === 'he' ? `${remainingMinutes} דק'` : `${remainingMinutes} min`) : '--'}
                          </strong>
                        </div>
                      </div>

                      {/* Navigation Options Container */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                        {/* Google Maps Button */}
                        <a
                          href={currentDriverDirection === 'to_ohel'
                            ? `https://www.google.com/maps/dir/?api=1&destination=${LOCATIONS['Ohel'].latitude},${LOCATIONS['Ohel'].longitude}`
                            : `https://www.google.com/maps/dir/?api=1&destination=${LOCATIONS['770'].latitude},${LOCATIONS['770'].longitude}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{
                            padding: '13px 4px',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px',
                            background: 'rgba(255,255,255,0.06)',
                            borderColor: 'var(--border-color)',
                            color: '#fff',
                            textDecoration: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                          }}
                        >
                          <Map size={15} />
                          {lang === 'he' ? 'ניווט ב-Google' : 'Google Maps'}
                        </a>

                        {/* Waze Button */}
                        <a
                          href={currentDriverDirection === 'to_ohel'
                            ? `https://waze.com/ul?ll=${LOCATIONS['Ohel'].latitude},${LOCATIONS['Ohel'].longitude}&navigate=yes`
                            : `https://waze.com/ul?ll=${LOCATIONS['770'].latitude},${LOCATIONS['770'].longitude}&navigate=yes`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          style={{
                            padding: '13px 4px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px',
                            background: 'rgba(51, 204, 255, 0.15)',
                            border: '1px solid rgba(51, 204, 255, 0.35)',
                            color: '#33ccff',
                            textDecoration: 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 8px rgba(51, 204, 255, 0.08)'
                          }}
                        >
                          <Navigation size={15} style={{ transform: 'rotate(45deg)' }} />
                          {lang === 'he' ? 'ניווט ב-Waze' : 'Waze'}
                        </a>
                      </div>

                      {/* End Trip button */}
                      <button
                        onClick={() => handleEndTripWithGpsCheck(correctedLoc)}
                        className="btn btn-primary"
                        style={{
                          width: '100%',
                          padding: '15px',
                          fontSize: '15px',
                          fontWeight: 'bold',
                          background: 'var(--success)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        <CheckCircle size={17} />
                        {lang === 'he' ? 'הגעתי ליעד (סיים נסיעה)' : 'Arrived at Destination (End Trip)'}
                      </button>
                      <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: '15px' }}>
                        {lang === 'he' ? 'הכפתור פעיל רק במרחק של עד 1 ק"מ מהיעד' : 'Button is active only within 1km of the destination'}
                      </p>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: '30px 20px', textAlign: 'center' }}>
                      {isDriverEnRoute && (
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }}></span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#a7f3d0' }}>
                            {lang === 'he' ? 'מתקרב ליעד - הברקוד זמין כעת לסריקה בכניסה' : 'Approaching destination - Barcode available for scanning'}
                          </span>
                        </div>
                      )}

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

                      {/* No-phone flow: a dispatcher without their own device can
                          issue a ride using the driver's phone, right here. */}
                      {!noPhoneShowForm ? (
                        <button
                          type="button"
                          onClick={() => setNoPhoneShowForm(true)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11.5px', textDecoration: 'underline', cursor: 'pointer', padding: '4px' }}
                        >
                          {t('noPhoneToggle')}
                        </button>
                      ) : (
                        <div style={{ maxWidth: '300px', margin: '0 auto', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px' }}>
                          {!noPhoneDispatcher ? (
                            <>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                {t('noPhoneCodePrompt')}
                              </p>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="form-input"
                                value={noPhoneCode}
                                onChange={(e) => setNoPhoneCode(e.target.value)}
                                placeholder={t('noPhoneCodePlaceholder')}
                                style={{ textAlign: 'center', marginBottom: '10px' }}
                              />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ flex: 1, fontSize: '12px' }}
                                  onClick={() => { setNoPhoneShowForm(false); setNoPhoneCode(''); }}
                                >
                                  {t('noPhoneCancel')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ flex: 1, fontSize: '12px' }}
                                  onClick={() => {
                                    const disp = dbService.loginWithCode(noPhoneCode.trim());
                                    if (disp && (disp.role === 'dispatcher' || disp.role === 'admin')) {
                                      setNoPhoneDispatcher(disp);
                                      setNoPhoneCode('');
                                    } else {
                                      triggerToast(t('noPhoneInvalidCode'), 'danger');
                                    }
                                  }}
                                >
                                  {t('noPhoneVerifyBtn')}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p style={{ fontSize: '12.5px', color: '#fff', fontWeight: 'bold', marginBottom: '12px' }}>
                                {t('noPhoneWelcome', { name: noPhoneDispatcher.name.replace(' (סדרן)', '') })}
                              </p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                                {[5, 10, 15, 20, 25, 30].map(val => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => setNoPhonePassengers(val)}
                                    className={`btn ${noPhonePassengers === val ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{
                                      fontSize: '13px',
                                      padding: '10px 4px',
                                      background: noPhonePassengers === val ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                      color: noPhonePassengers === val ? '#000' : '#fff',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                              <input
                                type="number"
                                className="form-input"
                                value={noPhonePassengers === 0 ? '' : noPhonePassengers}
                                onChange={(e) => setNoPhonePassengers(Math.max(0, parseInt(e.target.value) || 0))}
                                placeholder="0"
                                style={{ textAlign: 'center', marginBottom: '12px' }}
                              />
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ flex: 1, fontSize: '12px' }}
                                  onClick={() => { setNoPhoneShowForm(false); setNoPhoneDispatcher(null); setNoPhonePassengers(0); }}
                                >
                                  {t('noPhoneCancel')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ flex: 1, fontSize: '12px' }}
                                  onClick={async () => {
                                    if (noPhonePassengers <= 0) {
                                      triggerToast(lang === 'he' ? 'נא להזין לפחות נוסע אחד' : 'Please enter at least 1 passenger', 'danger');
                                      return;
                                    }
                                    const disp = noPhoneDispatcher;
                                    const passengers = noPhonePassengers;
                                    setNoPhoneShowForm(false);
                                    setNoPhoneDispatcher(null);
                                    setNoPhonePassengers(0);
                                    setIsSavingScan(true);
                                    try {
                                      await dbService.addScan({
                                        dispatcherId: disp.id,
                                        dispatcherName: disp.name,
                                        driverId: currentUser.id,
                                        driverName: currentUser.name,
                                        passengersCount: passengers,
                                        scannedAt: new Date().toISOString(),
                                        location: { latitude: dispatcherLocation.latitude, longitude: dispatcherLocation.longitude },
                                        departureLocation: currentDepartureLocation
                                      });
                                      confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
                                      triggerToast(lang === 'he' ? 'הסריקה נשלחה בהצלחה' : 'Scan sent successfully', 'success');
                                    } catch (err) {
                                      console.error('Failed to save no-phone scan:', err);
                                      triggerToast(
                                        lang === 'he'
                                          ? 'הסריקה לא נשמרה בשרת (בעיית רשת?) - נסה שוב'
                                          : 'Scan failed to save to server (network issue?) - try again',
                                        'danger'
                                      );
                                    } finally {
                                      setIsSavingScan(false);
                                    }
                                  }}
                                >
                                  {t('noPhoneSendBtn')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* SOS Emergency button removed */}
                    </div>
                  );
                })()}

                {activeTab === 'my-trips' && (
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>{t('myTripsTodayTitle')}</h3>
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

                    {/* Self-service PDF report - small link at the bottom */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                      <select
                        value={selfReportPeriod}
                        onChange={e => setSelfReportPeriod(e.target.value as 'week' | 'month')}
                        style={{ fontSize: '11px', padding: '4px 6px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)' }}
                      >
                        <option value="week">{t('myReportWeek')}</option>
                        <option value="month">{t('myReportMonth')}</option>
                      </select>
                      <select
                        value={selfReportLang}
                        onChange={e => setSelfReportLang(e.target.value as 'he' | 'en')}
                        style={{ fontSize: '11px', padding: '4px 6px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)' }}
                      >
                        <option value="he">עברית</option>
                        <option value="en">English</option>
                      </select>
                      <button
                        onClick={handleDownloadMyReport}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', padding: '4px 2px' }}
                      >
                        <FileText size={12} />
                        {t('myReportDownload')}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'arrivals' && (
                  <div className="card" style={{ padding: '20px', textAlign: lang === 'he' ? 'right' : 'left' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                      <Clock size={16} color="var(--accent)" />
                      {lang === 'he' ? 'לוח הגעת אוטובוסים פעילים' : 'Live Bus Arrivals Board'}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Heading to 770 */}
                      <div style={{ background: 'rgba(226, 176, 78, 0.03)', border: '1px solid rgba(226, 176, 78, 0.15)', borderRadius: '12px', padding: '16px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Navigation size={14} style={{ transform: 'rotate(45deg)' }} />
                          {lang === 'he' ? 'בדרך ל-770 (קראון הייטס)' : 'En Route to 770 (Crown Heights)'}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {activeArrivalsTo770.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                              {lang === 'he' ? 'אין אוטובוסים בדרך' : 'No shuttles en route'}
                            </div>
                          ) : (
                            activeArrivalsTo770.map(arr => (
                              <div key={arr.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                                  <strong style={{ fontSize: '13px', color: '#fff', display: 'block' }}>{arr.name.replace(' (נהג)', '')}</strong>
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                    {arr.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                                  </span>
                                </div>
                                <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                                  <span 
                                    className="badge" 
                                    style={{ 
                                      background: 'rgba(226, 176, 78, 0.15)', 
                                      color: 'var(--accent)', 
                                      borderColor: 'rgba(226, 176, 78, 0.2)',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    {arr.expectedArrivalTime
                                      ? (lang === 'he' ? `עוד ${Math.max(0, Math.round((arr.arrivalTimeMs - currentLiveTime.getTime()) / 60000))} דק'` : `in ${Math.max(0, Math.round((arr.arrivalTimeMs - currentLiveTime.getTime()) / 60000))} min`)
                                      : (lang === 'he' ? 'מחשב...' : 'calc...')}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Heading to Ohel */}
                      <div style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '12px', padding: '16px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-route-ohel)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Navigation size={14} style={{ transform: 'rotate(135deg)' }} />
                          {lang === 'he' ? 'בדרך לאוהל חב"ד (קווינס)' : 'En Route to Chabad Ohel (Queens)'}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {activeArrivalsToOhel.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                              {lang === 'he' ? 'אין אוטובוסים בדרך' : 'No shuttles en route'}
                            </div>
                          ) : (
                            activeArrivalsToOhel.map(arr => (
                              <div key={arr.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ textAlign: lang === 'he' ? 'right' : 'left' }}>
                                  <strong style={{ fontSize: '13px', color: '#fff', display: 'block' }}>{arr.name.replace(' (נהג)', '')}</strong>
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                    {arr.passengersCount} {lang === 'he' ? 'נוסעים' : 'passengers'}
                                  </span>
                                </div>
                                <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                                  <span 
                                    className="badge" 
                                    style={{ 
                                      background: 'rgba(6, 182, 212, 0.15)', 
                                      color: 'var(--accent-route-ohel)', 
                                      borderColor: 'rgba(6, 182, 212, 0.2)',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    {arr.expectedArrivalTime
                                      ? (lang === 'he' ? `עוד ${Math.max(0, Math.round((arr.arrivalTimeMs - currentLiveTime.getTime()) / 60000))} דק'` : `in ${Math.max(0, Math.round((arr.arrivalTimeMs - currentLiveTime.getTime()) / 60000))} min`)
                                      : (lang === 'he' ? 'מחשב...' : 'calc...')}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
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

                <button 
                  onClick={() => setActiveTab('arrivals')} 
                  className={`bottom-nav-item ${activeTab === 'arrivals' ? 'active' : ''}`}
                >
                  <Clock size={18} />
                  <span>{lang === 'he' ? 'לוח הגעות' : 'Arrivals Board'}</span>
                </button>

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
                <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
                  <img src={logo} alt="Ohel Bus Logo" style={{ height: '42px', width: 'auto', display: 'block' }} />
                  <button 
                    onClick={() => setLang(lang === 'he' ? 'en' : 'he')} 
                    style={{ 
                      background: 'rgba(255,255,255,0.05)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px',
                      padding: '4px 10px',
                      color: 'var(--text-secondary)', 
                      cursor: 'pointer', 
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    {lang === 'he' ? 'English' : 'עברית'}
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
                    onClick={() => setActiveTab('situation')} 
                    className={`sidebar-item ${activeTab === 'situation' ? 'active' : ''}`}
                  >
                    <FileText size={16} />
                    <span>{t('situationReport')}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('history')}
                    className={`sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
                  >
                    <Calendar size={16} />
                    <span>{t('fleetActivity')}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('central')}
                    className={`sidebar-item ${activeTab === 'central' ? 'active' : ''}`}
                  >
                    <Table size={16} />
                    <span>{lang === 'he' ? 'טבלה מרכזית' : 'Master Table'}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('users')}
                    className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
                  >
                    <Users size={16} />
                    <span>{t('usersManagement')}</span>
                  </button>

                  {/* Settings button removed */}
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

                     {/* SOS Alert box removed */}

                    {/* Fleet Status (Live Tracking List) */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', margin: 0 }}>
                        <Clock size={16} color="var(--accent)" />
                        {t('fleetStatus')}
                      </h3>
                      
                      <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {activeDriversToday.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {lang === 'he' ? 'אין נהגים פעילים היום' : 'No active drivers today'}
                          </div>
                        ) : (
                          activeDriversToday.map(drv => {
                            return (
                              <div 
                                key={drv.id} 
                                style={{ 
                                  padding: '12px 14px', 
                                  borderRadius: '8px', 
                                  border: '1px solid var(--border-color)', 
                                  background: 'rgba(255,255,255,0.01)',
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center' 
                                }}
                              >
                                <div>
                                  <strong style={{ color: '#fff', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {drv.name}
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
                                        {lang === 'he' ? `(הגעה צפויה ב-${drv.expectedArrivalTime || '--:--'})` : `(Expected: ${drv.expectedArrivalTime || '--:--'})`}
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
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* TAB: CENTRAL MASTER SUMMARY TABLE */}
                {activeTab === 'central' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Table size={22} color="var(--accent)" />
                          {lang === 'he' ? 'טבלת סיכום מרכזית' : 'Master Summary Table'}
                        </h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {lang === 'he'
                            ? 'כל הנסיעות לפי ימים — פרשה, תאריך עברי ולועזי, שעות מעוגלות לחצי שעה, נהגים ואנשים. ניתן להוריד לאקסל.'
                            : 'All rides by day — parsha, Hebrew & Gregorian dates, times rounded to the nearest half hour, drivers and passengers. Exportable to Excel.'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button onClick={handleCopyReturnLink} className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: '13px', color: '#fff' }}>
                          <Copy size={15} />
                          <span>{lang === 'he' ? 'קישור דיווח לנהגים' : 'Driver report link'}</span>
                        </button>
                        <button onClick={handleExportCentralToCsv} className="btn btn-primary" style={{ padding: '10px 16px', fontSize: '13px' }}>
                          <Download size={15} />
                          <span>{lang === 'he' ? 'הורדה לאקסל' : 'Export to Excel'}</span>
                        </button>
                        <button
                          onClick={() => {
                            if (centralSelectMode) setCentralSelectedIds(new Set());
                            setCentralSelectMode(!centralSelectMode);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '10px 16px', fontSize: '13px' }}
                        >
                          {centralSelectMode ? t('exitSelectMode') : t('selectMode')}
                        </button>
                        {centralSelectMode && (
                          <>
                            <button
                              onClick={() => setCentralSelectedIds(
                                centralSelectedIds.size === centralAllRowIds.length
                                  ? new Set()
                                  : new Set(centralAllRowIds)
                              )}
                              className="btn btn-secondary"
                              style={{ padding: '10px 16px', fontSize: '13px' }}
                            >
                              {centralSelectedIds.size === centralAllRowIds.length ? t('deselectAll') : t('selectAll')}
                            </button>
                            {centralSelectedIds.size > 0 && (
                              <button
                                onClick={() => handleBulkDeleteScans(centralSelectedIds, () => setCentralSelectedIds(new Set()))}
                                className="btn btn-danger"
                                style={{ padding: '10px 16px', fontSize: '13px' }}
                              >
                                {t('deleteSelected', { count: centralSelectedIds.size })}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Filter + date range + per-driver PDF toolbar */}
                    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', padding: '14px 16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                        <input type="checkbox" checked={centralBigBusOnly} onChange={e => setCentralBigBusOnly(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                        {lang === 'he' ? 'הצג רק אוטובוסים גדולים' : 'Show big buses only'}
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{lang === 'he' ? 'מתאריך' : 'From'}</span>
                        <input
                          type="date" value={centralDateFrom} onChange={e => setCentralDateFrom(e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary, #0d0d0d)', color: '#fff', fontSize: '13px' }}
                        />
                        <span style={{ color: 'var(--text-secondary)' }}>{lang === 'he' ? 'עד תאריך' : 'To'}</span>
                        <input
                          type="date" value={centralDateTo} onChange={e => setCentralDateTo(e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary, #0d0d0d)', color: '#fff', fontSize: '13px' }}
                        />
                        {(centralDateFrom || centralDateTo) && (
                          <button onClick={() => { setCentralDateFrom(''); setCentralDateTo(''); }} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px', color: '#fff' }}>
                            {lang === 'he' ? 'נקה' : 'Clear'}
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', flexWrap: 'wrap' }}>
                        <select
                          value={centralMonthFilter}
                          onChange={e => setCentralMonthFilter(e.target.value)}
                          title={t('monthFilterLabel')}
                          style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary, #0d0d0d)', color: '#fff', fontSize: '13px' }}
                        >
                          <option value="">{t('monthFilterLabel')}</option>
                          {HEBREW_MONTH_OPTIONS.map(m => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                        {centralMonthFilter && (
                          <button
                            onClick={() => setCentralMonthFilter('')}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {t('clearMonth')}
                          </button>
                        )}

                        <select
                          value={centralYearFilter}
                          onChange={e => setCentralYearFilter(e.target.value)}
                          title={t('yearFilterLabel')}
                          style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary, #0d0d0d)', color: '#fff', fontSize: '13px' }}
                        >
                          <option value="">{t('yearFilterLabel')}</option>
                          {availableHebrewYears.map(y => (
                            <option key={y} value={y}>{renderHebrewYear(y)}</option>
                          ))}
                        </select>
                        {centralYearFilter && (
                          <button
                            onClick={() => setCentralYearFilter('')}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {t('clearYear')}
                          </button>
                        )}

                        <select
                          className="form-input"
                          value={centralParshaFilter}
                          onChange={e => setCentralParshaFilter(e.target.value)}
                          style={{ width: '160px', height: '38px', fontSize: '13px' }}
                        >
                          <option value="">{t('parshaFilterLabel')}</option>
                          {availableParshas.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {centralParshaFilter && (
                          <button
                            onClick={() => setCentralParshaFilter('')}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {t('clearParsha')}
                          </button>
                        )}

                        <select
                          className="form-input"
                          value={centralOriginFilter}
                          onChange={e => setCentralOriginFilter(e.target.value as '' | DepartureLocation)}
                          style={{ width: '160px', height: '38px', fontSize: '13px' }}
                        >
                          <option value="">{t('originFilterLabel')}</option>
                          <option value="770">{lang === 'he' ? '770 (קראון הייטס)' : '770 (Crown Heights)'}</option>
                          <option value="Ohel">{lang === 'he' ? 'אוהל חב"ד' : 'Chabad Ohel'}</option>
                        </select>
                        {centralOriginFilter && (
                          <button
                            onClick={() => setCentralOriginFilter('')}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {t('clearOrigin')}
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginInlineStart: 'auto', flexWrap: 'wrap' }}>
                        <select
                          value={selectedDriverForPdf}
                          onChange={e => setSelectedDriverForPdf(e.target.value)}
                          style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary, #0d0d0d)', color: '#fff', fontSize: '13px' }}
                        >
                          <option value="">{lang === 'he' ? 'בחר נהג...' : 'Select driver...'}</option>
                          {driverNamesForPdf.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button onClick={() => handleExportDriverPdf()} disabled={!selectedDriverForPdf} className="btn btn-secondary" style={{ padding: '9px 14px', fontSize: '13px', color: '#fff', opacity: selectedDriverForPdf ? 1 : 0.5 }}>
                          <FileText size={15} />
                          <span>{lang === 'he' ? 'דו"ח PDF לנהג' : 'Driver PDF report'}</span>
                        </button>

                        <select
                          value={selectedDispatcherForPdf}
                          onChange={e => setSelectedDispatcherForPdf(e.target.value)}
                          style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary, #0d0d0d)', color: '#fff', fontSize: '13px' }}
                        >
                          <option value="">{lang === 'he' ? 'בחר סדרן...' : 'Select dispatcher...'}</option>
                          {dispatcherNamesForPdf.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        <button onClick={() => handleExportDispatcherPdf()} disabled={!selectedDispatcherForPdf} className="btn btn-secondary" style={{ padding: '9px 14px', fontSize: '13px', color: '#fff', opacity: selectedDispatcherForPdf ? 1 : 0.5 }}>
                          <FileText size={15} />
                          <span>{lang === 'he' ? 'דו"ח PDF לסדרן' : 'Dispatcher PDF report'}</span>
                        </button>
                      </div>
                    </div>

                    {centralFlatRows.length === 0 ? (
                      <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {lang === 'he' ? 'אין נתונים להצגה' : 'No data to display'}
                      </div>
                    ) : (
                      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '480px' }}>
                            <thead>
                              <tr style={{ color: 'var(--text-secondary)', textAlign: lang === 'he' ? 'right' : 'left' }}>
                                {centralSelectMode && <th style={thCentral}></th>}
                                <th style={thCentral}>{t('parshaHeader')}</th>
                                <th style={thCentral}>{t('hebrewDateHeader')}</th>
                                <th style={thCentral}>{t('dayHeader')}</th>
                                <th style={thCentral}>{lang === 'he' ? 'שעה' : 'Time'}</th>
                                <th style={thCentral}>{t('logicalDateHeader')}</th>
                                <th style={thCentral}>{lang === 'he' ? 'נהג' : 'Driver'}</th>
                                <th style={thCentral}>{t('scannerDispatcherHeader')}</th>
                                <th style={thCentral}>{t('originHeader')}</th>
                                <th style={thCentral}>{lang === 'he' ? 'אנשים' : 'People'}</th>
                                <th style={thCentral}>{t('emptySeatsHeader')}</th>
                                <th style={thCentral}>{t('driverCapacityHeader')}</th>
                                <th style={thCentral}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {centralFlatRows.map(r => (
                                <tr key={r.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                  {centralSelectMode && (
                                    <td style={tdCentral}>
                                      <input
                                        type="checkbox"
                                        checked={centralSelectedIds.has(r.id)}
                                        onChange={() => setCentralSelectedIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                                          return next;
                                        })}
                                        style={{ width: '16px', height: '16px' }}
                                      />
                                    </td>
                                  )}
                                  <td style={tdCentral}>{r.parsha}</td>
                                  <td style={tdCentral}>{r.hebrewDate}</td>
                                  <td style={tdCentral}>{r.dayOfWeek}</td>
                                  <td style={{ ...tdCentral, fontFamily: 'monospace', color: '#fff' }}>{r.time}</td>
                                  <td style={tdCentral}>{r.dateStr}</td>
                                  <td style={{ ...tdCentral, color: '#fff' }}>{r.driver}</td>
                                  <td style={tdCentral}>{r.dispatcher}</td>
                                  <td style={tdCentral}>
                                    <span style={{ color: r.direction === 'return' ? '#06b6d4' : 'var(--accent)', fontWeight: 700 }}>
                                      {r.origin}
                                    </span>
                                  </td>
                                  <td style={tdCentral}>{r.passengers}</td>
                                  <td style={tdCentral}>{r.remainingSeats}</td>
                                  <td style={tdCentral}>{r.driverCapacity}</td>
                                  <td style={tdCentral}>
                                    <button
                                      onClick={() => handleDeleteScan(r.id)}
                                      className="btn btn-danger"
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                      title={lang === 'he' ? 'מחק שורה' : 'Delete row'}
                                    >
                                      <Trash size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: REAL-TIME SITUATION ASSESSMENT */}
                {activeTab === 'situation' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Header Card */}
                    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ShieldAlert size={22} color="var(--accent)" />
                          {lang === 'he' ? 'הערכת מצב וסיכומי שעות' : 'Situation & Hours Report'}
                        </h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {lang === 'he' 
                            ? 'ריכוז סטטיסטיקות, שעות פעילות והספק של נהגים וסדרנים לפי טווחי זמן' 
                            : 'Consolidated active hours, performance and metrics for drivers and dispatchers'}
                        </p>
                      </div>

                      {/* Timeframe Selector Button Group */}
                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '4px', gap: '4px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setSituationTimeframe('today')}
                          className={`btn ${situationTimeframe === 'today' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '8px 14px', fontSize: '12px', border: 'none', color: situationTimeframe === 'today' ? '#000' : '#fff' }}
                        >
                          {lang === 'he' ? 'היום' : 'Today'}
                        </button>
                        <button
                          onClick={() => setSituationTimeframe('week')}
                          className={`btn ${situationTimeframe === 'week' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '8px 14px', fontSize: '12px', border: 'none', color: situationTimeframe === 'week' ? '#000' : '#fff' }}
                        >
                          {lang === 'he' ? 'שבוע אחרון' : 'Last Week'}
                        </button>
                        <button
                          onClick={() => setSituationTimeframe('month')}
                          className={`btn ${situationTimeframe === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '8px 14px', fontSize: '12px', border: 'none', color: situationTimeframe === 'month' ? '#000' : '#fff' }}
                        >
                          {lang === 'he' ? 'חודש אחרון' : 'Last Month'}
                        </button>
                        <button
                          onClick={() => setSituationTimeframe('custom')}
                          className={`btn ${situationTimeframe === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '8px 14px', fontSize: '12px', border: 'none', color: situationTimeframe === 'custom' ? '#000' : '#fff' }}
                        >
                          {lang === 'he' ? 'טווח תאריכים' : 'Date Range'}
                        </button>
                      </div>
                    </div>

                    {/* Custom Date Picker Fields */}
                    {situationTimeframe === 'custom' && (
                      <div className="card" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', padding: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '150px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lang === 'he' ? 'מתאריך:' : 'From Date:'}</span>
                          <input 
                            type="date" 
                            value={situationStartDate}
                            onChange={(e) => setSituationStartDate(e.target.value)}
                            style={{ 
                              background: 'rgba(255,255,255,0.05)', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: '6px', 
                              color: '#fff', 
                              padding: '8px 12px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '150px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{lang === 'he' ? 'עד תאריך:' : 'To Date:'}</span>
                          <input 
                            type="date" 
                            value={situationEndDate}
                            onChange={(e) => setSituationEndDate(e.target.value)}
                            style={{ 
                              background: 'rgba(255,255,255,0.05)', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: '6px', 
                              color: '#fff', 
                              padding: '8px 12px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Overview Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(51, 204, 255, 0.1)', padding: '12px', borderRadius: '10px' }}>
                          <Users size={24} color="var(--accent)" />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>
                            {lang === 'he' ? 'סה"כ נוסעים בטווח' : 'Total Passengers in Range'}
                          </span>
                          <strong style={{ fontSize: '20px', color: '#fff' }}>{situationData.totalPassengers}</strong>
                        </div>
                      </div>
                      <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '10px' }}>
                          <Navigation size={24} color="#10b981" />
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>
                            {lang === 'he' ? 'סה"כ נסיעות בטווח' : 'Total Trips in Range'}
                          </span>
                          <strong style={{ fontSize: '20px', color: '#fff' }}>{situationData.totalTrips}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Content Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                      
                      {/* Daily Breakdown Card */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                          <Calendar size={18} color="var(--accent)" />
                          {lang === 'he' ? 'פירוט יומי' : 'Daily Breakdown'}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                          {situationData.dailyList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              {lang === 'he' ? 'אין פעילות מתועדת' : 'No recorded activity'}
                            </div>
                          ) : (
                            situationData.dailyList.map(day => renderSituationDayRow(day))
                          )}
                        </div>
                      </div>

                      {/* Monthly Summary Card (Hebrew calendar) - full history, not scoped
                          to the timeframe toggle above; see monthlySummaryData comment. */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                          <Calendar size={18} color="var(--accent)" />
                          {lang === 'he' ? 'סיכום חודשי (עברי)' : 'Monthly Summary (Hebrew)'}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                          {monthlySummaryData.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              {lang === 'he' ? 'אין פעילות מתועדת' : 'No recorded activity'}
                            </div>
                          ) : (
                            monthlySummaryData.map(month => {
                              const monthKeyFull = `${month.year}-${month.monthKey}`;
                              const isExpanded = expandedSituationMonths.has(monthKeyFull);
                              const monthLabel = HEBREW_MONTH_OPTIONS.find(m => m.key === month.monthKey)?.label || month.monthKey;
                              const toggleMonth = () => setExpandedSituationMonths(prev => {
                                const next = new Set(prev);
                                if (next.has(monthKeyFull)) next.delete(monthKeyFull); else next.add(monthKeyFull);
                                return next;
                              });
                              const monthDays = situationMonthDays[monthKeyFull] || [];

                              return (
                                <div
                                  key={monthKeyFull}
                                  style={{
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'rgba(255,255,255,0.01)',
                                    overflow: 'hidden'
                                  }}
                                >
                                  <div
                                    onClick={toggleMonth}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMonth(); } }}
                                    style={{
                                      padding: '12px 14px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {isExpanded ? <ChevronDown size={14} color="var(--text-secondary)" /> : <ChevronRight size={14} color="var(--text-secondary)" />}
                                      <div>
                                        <strong style={{ fontSize: '13px', color: '#fff' }}>
                                          {monthLabel} {renderHebrewYear(month.year)}
                                        </strong>
                                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                          {lang === 'he' ? `${month.trips} נסיעות` : `${month.trips} Trips`}
                                        </span>
                                      </div>
                                    </div>
                                    <div style={{ textAlign: lang === 'he' ? 'left' : 'right' }}>
                                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent)' }}>
                                        {month.passengers}
                                      </span>
                                      <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-secondary)' }}>
                                        {lang === 'he' ? 'נוסעים' : 'Passengers'}
                                      </span>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border-color)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {monthDays.length === 0 ? (
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 0' }}>
                                          {lang === 'he' ? 'טוען...' : 'Loading...'}
                                        </div>
                                      ) : (
                                        monthDays.map(day => renderSituationDayRow(day))
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Drivers Situation Card */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                          <UserCheck size={18} color="var(--accent)" />
                          {lang === 'he' ? 'סיכום נהגים' : 'Drivers Summary'}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                          {situationData.driversList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              {lang === 'he' ? 'אין פעילות נהגים מתועדת בטווח זמן זה' : 'No driver activity recorded for this period'}
                            </div>
                          ) : (
                            situationData.driversList.map((drv, idx) => (
                              <div 
                                key={idx}
                                style={{ 
                                  padding: '14px', 
                                  borderRadius: '8px', 
                                  border: '1px solid var(--border-color)', 
                                  background: 'rgba(255,255,255,0.01)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong style={{ fontSize: '14px', color: '#fff' }}>{drv.name}</strong>
                                  <span className="badge badge-accent" style={{ fontSize: '11px', padding: '3px 8px' }}>
                                    {lang === 'he' ? `${drv.trips} נסיעות` : `${drv.trips} Trips`}
                                  </span>
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '6px' }}>
                                  <span>
                                    {lang === 'he' ? `נוסעים:` : `Passengers:`}{' '}
                                    <strong style={{ color: '#fff' }}>{drv.passengers}</strong>
                                  </span>
                                  <span>
                                    {lang === 'he' ? `שעות:` : `Hours:`}{' '}
                                    <strong style={{ color: '#fff', fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
                                      {formatActiveHours(drv.times, lang)}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Dispatchers Situation Card */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
                          <Users size={18} color="var(--accent)" />
                          {lang === 'he' ? 'סיכום סדרנים' : 'Dispatchers Summary'}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                          {situationData.dispatchersList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              {lang === 'he' ? 'אין פעילות סדרנים מתועדת בטווח זמן זה' : 'No dispatcher activity recorded for this period'}
                            </div>
                          ) : (
                            situationData.dispatchersList.map((disp, idx) => (
                              <div 
                                key={idx}
                                style={{ 
                                  padding: '14px', 
                                  borderRadius: '8px', 
                                  border: '1px solid var(--border-color)', 
                                  background: 'rgba(255,255,255,0.01)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong style={{ fontSize: '14px', color: '#fff' }}>{disp.name}</strong>
                                  <span className="badge badge-primary" style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    {lang === 'he' ? `${disp.scansCount} סריקות` : `${disp.scansCount} Scans`}
                                  </span>
                                </div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '6px' }}>
                                  <span>
                                    {lang === 'he' ? `נוסעים:` : `Passengers:`}{' '}
                                    <strong style={{ color: '#fff' }}>{disp.passengers}</strong>
                                  </span>
                                  <span>
                                    {lang === 'he' ? `שעות:` : `Hours:`}{' '}
                                    <strong style={{ color: '#fff', fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
                                      {formatActiveHours(disp.times, lang)}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* TAB 2: GLOBAL ACTIVITY LOG */}
                {activeTab === 'history' && (
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Same header-box style as the central table's day headers. */}
                    <div style={{ padding: '12px 16px', margin: '-24px -24px 0', background: 'rgba(226,176,78,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <strong style={{ color: '#fff', fontSize: '14px' }}>{getHebrewDate(new Date())}</strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {new Date().toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      {getWeeklyParsha(new Date()) && (
                        <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700 }}>
                          · {lang === 'he' ? 'פרשת' : 'Parashat'} {getWeeklyParsha(new Date())}
                        </span>
                      )}
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>· {getDayOfWeekHe(new Date())}</span>
                      <span style={{ marginInlineStart: 'auto', fontSize: '10px', color: 'var(--success)', fontWeight: 700 }}>{lang === 'he' ? 'היום' : 'Today'}</span>
                    </div>

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

                        <select
                          className="form-input"
                          style={{ width: '150px', height: '38px', fontSize: '13px' }}
                          value={monthFilter}
                          onChange={(e) => setMonthFilter(e.target.value)}
                          title={t('monthFilterLabel')}
                        >
                          <option value="">{t('monthFilterLabel')}</option>
                          {HEBREW_MONTH_OPTIONS.map(m => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                        {monthFilter && (
                          <button
                            onClick={() => setMonthFilter('')}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {t('clearMonth')}
                          </button>
                        )}

                        <select
                          className="form-input"
                          style={{ width: '130px', height: '38px', fontSize: '13px' }}
                          value={yearFilter}
                          onChange={(e) => setYearFilter(e.target.value)}
                          title={t('yearFilterLabel')}
                        >
                          <option value="">{t('yearFilterLabel')}</option>
                          {availableHebrewYears.map(y => (
                            <option key={y} value={y}>{renderHebrewYear(y)}</option>
                          ))}
                        </select>
                        {yearFilter && (
                          <button
                            onClick={() => setYearFilter('')}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {t('clearYear')}
                          </button>
                        )}

                        <select
                          className="form-input"
                          style={{ width: '160px', height: '38px', fontSize: '13px' }}
                          value={parshaFilter}
                          onChange={(e) => setParshaFilter(e.target.value)}
                        >
                          <option value="">{t('parshaFilterLabel')}</option>
                          {availableParshas.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {parshaFilter && (
                          <button
                            onClick={() => setParshaFilter('')}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            {t('clearParsha')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="desktop-scans-table">
                      <div className="table-container">
                        <table className="tp-table">
                          <thead>
                            <tr>
                              <th>{t('parshaHeader')}</th>
                              <th>{t('hebrewDateHeader')}</th>
                              <th>{t('dayHeader')}</th>
                              <th>{t('timeHeader')}</th>
                              <th>{t('logicalDateHeader')}</th>
                              <th>{t('driver')}</th>
                              <th>{t('scannerDispatcherHeader')}</th>
                              <th>{t('originHeader')}</th>
                              <th style={{ textAlign: 'center' }}>{t('passengersBoardedHeader')}</th>
                              <th style={{ textAlign: 'center' }}>{t('emptySeatsHeader')}</th>
                              <th style={{ textAlign: 'center' }}>{t('driverCapacityHeader')}</th>
                              <th style={{ textAlign: 'center' }}>{t('actionsHeader')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredScans.length === 0 ? (
                              <tr>
                                <td colSpan={12} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  {t('noMatchingScans')}
                                </td>
                              </tr>
                            ) : (
                              filteredScans.map(scan => {
                                const scanDate = new Date(scan.logicalDate + 'T12:00:00');
                                return (
                                <tr key={scan.id}>
                                  <td>{getWeeklyParsha(new Date(scan.scannedAt))}</td>
                                  <td>{getHebrewDate(scanDate)}</td>
                                  <td>{getDayOfWeekHe(scanDate)}</td>
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
                                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{scan.remainingSeats}</td>
                                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{scan.driverCapacity}</td>
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
                                );
                              })
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
                        filteredScans.map(scan => {
                          const scanDate = new Date(scan.logicalDate + 'T12:00:00');
                          return (
                          <div key={scan.id} className="card user-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                  {new Date(scan.scannedAt).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </div>
                              <span style={{ color: scan.departureLocation === '770' ? 'var(--accent)' : 'var(--info)', fontWeight: 'bold', fontSize: '13px' }}>
                                {scan.departureLocation === '770' ? (lang === 'he' ? '770 קראון הייטס' : '770 Crown Heights') : (lang === 'he' ? 'אוהל חב"ד' : 'Chabad Ohel')}
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('parshaHeader')}</span>
                                <span style={{ color: '#fff' }}>{getWeeklyParsha(new Date(scan.scannedAt)) || '—'}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('hebrewDateHeader')}</span>
                                <span style={{ color: '#fff' }}>{getHebrewDate(scanDate)}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('dayHeader')}</span>
                                <span style={{ color: '#fff' }}>{getDayOfWeekHe(scanDate)}</span>
                              </div>
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
                                <span style={{ color: 'var(--text-secondary)' }}>{scan.remainingSeats}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>{t('driverCapacityHeader')}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{scan.driverCapacity}</span>
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
                          );
                        })
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
                    
                    {/* Add user form & Reset Data column */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {pendingRegistrations.length > 0 && (
                        <div className="card" style={{ border: '1px solid rgba(226, 176, 78, 0.3)', background: 'rgba(226, 176, 78, 0.03)' }}>
                          <h3 className="card-title">
                            <UserCheck size={16} color="var(--accent)" />
                            {t('pendingRegistrationsTitle')} ({pendingRegistrations.length})
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {pendingRegistrations.map(reg => (
                              <PendingRegistrationCard key={reg.id} reg={reg} t={t} onApprove={handleApproveRegistration} onReject={handleRejectRegistration} />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="card" id="add-user-form-card">
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
                            <label className="form-label">{newUserRole === 'screen' ? t('screenLocationLabel') : t('phoneLabel')}</label>
                            <input
                              type={newUserRole === 'screen' ? 'text' : 'tel'}
                              className="form-input"
                              value={newUserPhone}
                              onChange={(e) => setNewUserPhone(e.target.value)}
                              placeholder={newUserRole === 'screen' ? t('screenLocationPlaceholder') : t('phonePlaceholder')}
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
                              <option value="screen">{t('roleScreen')}</option>
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

                          {newUserRole === 'driver' && (
                            <div className="form-group">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={newUserIsBigBus}
                                  onChange={(e) => setNewUserIsBigBus(e.target.checked)}
                                  style={{ width: '16px', height: '16px' }}
                                />
                                {t('bigBusLabel')}
                              </label>
                            </div>
                          )}

                          {newUserRole === 'driver' && (
                            <div className="form-group">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={newUserCanSelfReport}
                                  onChange={(e) => setNewUserCanSelfReport(e.target.checked)}
                                  style={{ width: '16px', height: '16px' }}
                                />
                                {t('canSelfReportLabel')}
                              </label>
                            </div>
                          )}

                          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                            <Plus size={14} />
                            {t('createUser')}
                          </button>
                        </form>
                      </div>

                    </div>

                    {/* Users list card - shown first on mobile (see .users-list-card in index.css) */}
                    <div className="card users-list-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                        
                        {/* Role Filter Toggle */}
                        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)', alignSelf: 'flex-start' }}>
                          <button
                            type="button"
                            onClick={() => setStaffFilter('driver')}
                            style={{
                              background: staffFilter === 'driver' ? 'var(--accent)' : 'transparent',
                              color: staffFilter === 'driver' ? '#000' : 'var(--text-secondary)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 16px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {lang === 'he' ? `נהגים (${users.filter(u => u.role === 'driver').length})` : `Drivers (${users.filter(u => u.role === 'driver').length})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStaffFilter('dispatcher')}
                            style={{
                              background: staffFilter === 'dispatcher' ? 'var(--accent)' : 'transparent',
                              color: staffFilter === 'dispatcher' ? '#000' : 'var(--text-secondary)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 16px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {lang === 'he' ? `סדרנים (${users.filter(u => u.role === 'dispatcher').length})` : `Dispatchers (${users.filter(u => u.role === 'dispatcher').length})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStaffFilter('screen')}
                            style={{
                              background: staffFilter === 'screen' ? 'var(--accent)' : 'transparent',
                              color: staffFilter === 'screen' ? '#000' : 'var(--text-secondary)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 16px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {lang === 'he' ? `קודי מסך (${users.filter(u => u.role === 'screen').length})` : `Screens (${users.filter(u => u.role === 'screen').length})`}
                          </button>
                        </div>
                      </div>

                      {/* Desktop Table View */}
                      <div className="table-container desktop-users-table">
                        <table className="tp-table">
                          <thead>
                            <tr>
                              <th>{t('userName')}</th>
                              <th>{staffFilter === 'screen' ? t('screenLocationLabel') : t('phoneLabel')}</th>
                              <th>{t('userRole')}</th>
                              <th style={{ textAlign: 'center' }}>{t('passcodeLabel')}</th>
                              <th style={{ textAlign: 'center' }}>{t('capacityLabel')}</th>
                              <th style={{ textAlign: 'center' }}>{t('actionsHeader')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStaffList.map(u => (
                              <tr key={u.id}>
                                <td><strong>{u.name}</strong></td>
                                <td>{u.phone}</td>
                                <td>
                                  <span className={`badge ${
                                    u.role === 'admin' ? 'badge-danger' : u.role === 'dispatcher' ? 'badge-success' : u.role === 'screen' ? 'badge-info' : 'badge-warning'
                                  }`}>
                                    {u.role === 'admin' ? t('adminRole') : u.role === 'dispatcher' ? t('dispatcherRole') : u.role === 'screen' ? t('screenRole') : t('driverRole')}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                  <span style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', border: '1px solid #334155', color: 'var(--accent)', fontSize: '12px', fontFamily: 'monospace' }}>
                                    {u.code}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  {u.role === 'driver' ? (
                                    <>
                                      {t('seatsCountText', { count: u.capacity })}
                                      {u.isBigBus && <span title={t('bigBusLabel')} style={{ marginInlineStart: '6px' }}>🚌</span>}
                                    </>
                                  ) : '-'}
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
                        {filteredStaffList.map(u => (
                          <div key={u.id} className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '15px', color: '#fff' }}>{u.name}</strong>
                              <span className={`badge ${
                                u.role === 'admin' ? 'badge-danger' : u.role === 'dispatcher' ? 'badge-success' : u.role === 'screen' ? 'badge-info' : 'badge-warning'
                              }`}>
                                {u.role === 'admin' ? t('adminRole') : u.role === 'dispatcher' ? t('dispatcherRole') : u.role === 'screen' ? t('screenRole') : t('driverRole')}
                              </span>
                            </div>

                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div><strong>{(u.role === 'screen' ? t('screenLocationLabel') : (lang === 'he' ? 'טלפון:' : 'Phone:'))}</strong> {u.phone}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong>{lang === 'he' ? 'קוד כניסה:' : 'Passcode:'}</strong>
                                <span style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--accent)', fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold' }}>
                                  {u.code}
                                </span>
                              </div>
                              {u.role === 'driver' && (
                                <div>
                                  <strong>{lang === 'he' ? 'קיבולת:' : 'Capacity:'}</strong> {t('seatsCountText', { count: u.capacity })}
                                  {u.isBigBus && <span title={t('bigBusLabel')} style={{ marginInlineStart: '6px' }}>🚌</span>}
                                </div>
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

                    {/* System Administrators Section */}
                    {adminUsersList.length > 0 && (
                      <div className="card" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f43f5e', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ShieldAlert size={16} color="#f43f5e" />
                          {lang === 'he' ? 'מנהלי מערכת (מורשי גישה)' : 'System Administrators'}
                        </h3>
                        
                        <div className="table-container">
                          <table className="tp-table">
                            <thead>
                              <tr>
                                <th>{t('userName')}</th>
                                <th>{t('phoneLabel')}</th>
                                <th style={{ textAlign: 'center' }}>{t('passcodeLabel')}</th>
                                <th style={{ textAlign: 'center' }}>{t('actionsHeader')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminUsersList.map(u => (
                                <tr key={u.id}>
                                  <td><strong>{u.name}</strong></td>
                                  <td>{u.phone}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                    <span style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', border: '1px solid #334155', color: 'var(--accent)', fontSize: '12px', fontFamily: 'monospace' }}>
                                      {u.code}
                                    </span>
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
                                        disabled={u.id === 'usr_admin' || u.id === 'usr_admin_rosenberg'} 
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
                      </div>
                    )}
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
                          <label className="form-label">{editUserRole === 'screen' ? t('screenLocationLabel') : t('phoneLabel')}</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editUserPhone}
                            onChange={e => setEditUserPhone(e.target.value)}
                            required={editUserRole !== 'screen'}
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
                            <option value="screen">{t('roleScreen')}</option>
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
                        {editUserRole === 'driver' && (
                          <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={editUserIsBigBus}
                                onChange={e => setEditUserIsBigBus(e.target.checked)}
                                style={{ width: '16px', height: '16px' }}
                              />
                              {t('bigBusLabel')}
                            </label>
                          </div>
                        )}
                        {editUserRole === 'driver' && (
                          <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={editUserCanSelfReport}
                                onChange={e => setEditUserCanSelfReport(e.target.checked)}
                                style={{ width: '16px', height: '16px' }}
                              />
                              {t('canSelfReportLabel')}
                            </label>
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
                  onClick={() => setActiveTab('situation')} 
                  className={`bottom-nav-item ${activeTab === 'situation' ? 'active' : ''}`}
                >
                  <FileText size={18} />
                  <span>{t('situationReport')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`bottom-nav-item ${activeTab === 'history' ? 'active' : ''}`}
                >
                  <Calendar size={18} />
                  <span>{t('fleetActivity')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('central')}
                  className={`bottom-nav-item ${activeTab === 'central' ? 'active' : ''}`}
                >
                  <Table size={18} />
                  <span>{lang === 'he' ? 'טבלה' : 'Table'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`bottom-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                >
                  <Users size={18} />
                  <span>{t('usersManagement')}</span>
                </button>
                {/* Settings button removed */}
              </nav>

            </div>
          )}

          {/* Quick Scanner modal */}
          {scannerModalDriver && (
            <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
              <div className="card" style={{ width: '100%', maxWidth: '380px', padding: '24px', position: 'relative', border: '1px solid var(--accent)', background: 'var(--bg-secondary)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: '#fff', textAlign: 'center' }}>
                  {lang === 'he' ? `סריקת נהג: ${scannerModalDriver.name.replace(' (נהג)', '')}` : `Scan Driver: ${scannerModalDriver.name}`}
                </h3>
                
                <div style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 'bold', textAlign: 'center', marginBottom: '16px', background: 'rgba(226, 176, 78, 0.08)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(226, 176, 78, 0.15)' }}>
                  {currentDepartureLocation === '770' 
                    ? (lang === 'he' ? 'יציאה מ-770 בדרך לאוהל ➔' : 'Departure from 770 to Ohel ➔')
                    : (lang === 'he' ? 'יציאה מהאוהל בדרך ל-770 ➔' : 'Departure from Ohel to 770 ➔')
                  }
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px' }}>
                  {lang === 'he' ? `נא להזין את מספר הנוסעים שעלו להסעה (קיבולת: ${scannerModalDriver.capacity || 15} מקומות):` : `Enter number of passengers (Capacity: ${scannerModalDriver.capacity || 15} seats):`}
                </p>

                {/* Quick Selection Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                  {[5, 10, 15, 20, 25, 30].map(val => (
                    <button 
                      key={val}
                      type="button"
                      onClick={() => setScannerModalPassengers(val)}
                      className={`btn ${scannerModalPassengers === val ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        fontSize: '14px', 
                        padding: '12px 6px',
                        background: scannerModalPassengers === val ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                        color: scannerModalPassengers === val ? '#000' : '#fff',
                        borderColor: scannerModalPassengers === val ? 'var(--accent)' : 'var(--border-color)',
                        fontWeight: 'bold'
                      }}
                    >
                      {val}
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label" style={{ fontSize: '12px' }}>
                    {lang === 'he' ? 'או הזן מספר אחר:' : 'Or enter custom amount:'}
                  </label>
                  <input 
                    type="number"
                    className="form-input"
                    style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}
                    value={scannerModalPassengers === 0 ? '' : scannerModalPassengers}
                    onChange={(e) => setScannerModalPassengers(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="0"
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={async () => {
                      if (scannerModalPassengers <= 0) {
                        triggerToast(lang === 'he' ? 'נא להזין לפחות נוסע אחד' : 'Please enter at least 1 passenger', 'danger');
                        return;
                      }

                      const driverForScan = scannerModalDriver;
                      const passengersForScan = scannerModalPassengers;

                      // Reset the modal immediately (the scan is already visible in
                      // this dispatcher's own local view) - but the success/error
                      // toast below reflects what actually happened on the server,
                      // not just the optimistic local write.
                      setScannerModalDriver(null);
                      setScannerModalPassengers(0);

                      setIsSavingScan(true);
                      try {
                        await dbService.addScan({
                          dispatcherId: currentUser.id,
                          dispatcherName: currentUser.name,
                          driverId: driverForScan.id,
                          driverName: driverForScan.name,
                          passengersCount: passengersForScan,
                          scannedAt: new Date().toISOString(),
                          location: { latitude: dispatcherLocation.latitude, longitude: dispatcherLocation.longitude },
                          departureLocation: currentDepartureLocation
                        });

                        confetti({
                          particleCount: 100,
                          spread: 70,
                          origin: { y: 0.8 }
                        });

                        triggerToast(lang === 'he' ? `סריקה נשמרה בהצלחה עבור ${driverForScan.name.replace(' (נהג)', '')}` : `Scan saved successfully for ${driverForScan.name}`, 'success');
                      } catch (err) {
                        console.error('Failed to save scan:', err);
                        triggerToast(
                          lang === 'he'
                            ? `הסריקה לא נשמרה בשרת (בעיית רשת?) - נסה שוב או בדוק חיבור`
                            : `Scan failed to save to server (network issue?) - try again or check connection`,
                          'danger'
                        );
                      } finally {
                        setIsSavingScan(false);
                      }
                    }}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 'bold', color: '#000' }}
                  >
                    <CheckCircle size={16} />
                    {lang === 'he' ? 'שמור ושלח סריקה' : 'Save & Send Scan'}
                  </button>

                  <button 
                    onClick={() => {
                      setScannerModalDriver(null);
                      setScannerModalPassengers(0);
                    }}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '12px', fontSize: '13px', background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    {lang === 'he' ? 'ביטול' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
