import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ActiveLocation } from '../services/db';
import { LOCATIONS } from '../services/db';

interface LiveMapProps {
  locations: ActiveLocation[];
  sosAlerts: { id: string; name: string }[];
  onClearSOS?: (driverId: string) => void;
  lang?: 'he' | 'en';
}

const MAP_TRANSLATIONS = {
  he: {
    origin770: 'מוצא קראון הייטס',
    originOhel: 'מוצא קווינס',
    driver: 'נהג',
    dispatcher: 'סדרן',
    status: 'סטטוס',
    enRoute: 'בנסיעה',
    break: 'הפסקה',
    unavailable: 'הסעה לא זמינה',
    direction: 'כיוון',
    toOhel: 'לאוהל',
    to770: 'ל-770',
    eta: 'זמן הגעה: כ-{eta} דק\' (לפי מפות גוגל 🚗)',
    sosAlertActive: '🚨 קריאת SOS פעילה!',
    title: 'מפת מעקב חי - GPS Fleet Tracking',
    activeSosAlerts: '{count} התראות SOS פעילות',
    sosCalls: 'קריאות מצוקה:',
    clearAlert: 'ביטול התראה'
  },
  en: {
    origin770: 'Crown Heights Origin',
    originOhel: 'Queens Origin',
    driver: 'Driver',
    dispatcher: 'Dispatcher',
    status: 'Status',
    enRoute: 'En Route',
    break: 'Break',
    unavailable: 'Shuttle unavailable',
    direction: 'Direction',
    toOhel: 'to Ohel',
    to770: 'to 770',
    eta: 'ETA: ~{eta} min (via Google Maps 🚗)',
    sosAlertActive: '🚨 Active SOS Alert!',
    title: 'Live Tracking Map - GPS Fleet Tracking',
    activeSosAlerts: '{count} Active SOS Alerts',
    sosCalls: 'Emergency Alerts:',
    clearAlert: 'Clear Alert'
  }
};

export const LiveMap: React.FC<LiveMapProps> = ({ locations, sosAlerts, onClearSOS, lang = 'he' }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const static770MarkerRef = useRef<L.Marker | null>(null);
  const staticOhelMarkerRef = useRef<L.Marker | null>(null);
  const mapContainerId = 'live-fleet-map';

  const mapT = (key: keyof typeof MAP_TRANSLATIONS.he, variables?: { [key: string]: any }) => {
    let text = MAP_TRANSLATIONS[lang][key] || MAP_TRANSLATIONS.he[key] || '';
    if (variables) {
      Object.keys(variables).forEach(k => {
        text = text.replace(`{${k}}`, String(variables[k]));
      });
    }
    return text;
  };

  // Base64 Custom SVG Icons
  const icons = {
    '770': L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
          <circle cx="12" cy="12" r="10" fill="%230f172a" stroke="%23f59e0b" stroke-width="2"/>
          <path d="M12 7l1.5 3.5h3.5l-2.8 2.2 1 3.3-3.2-2-3.2 2 1-3.3-2.8-2.2h3.5z" fill="%23f59e0b"/>
          <text x="12" y="24" fill="%23f3f4f6" font-size="8" font-weight="bold" text-anchor="middle" font-family="sans-serif">770</text>
        </svg>
      `)}`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
    'Ohel': L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
          <circle cx="12" cy="12" r="10" fill="%230f172a" stroke="%2306b6d4" stroke-width="2"/>
          <path d="M12 6L7 11h3v7h4v-7h3z" fill="%2306b6d4"/>
          <text x="12" y="24" fill="%23f3f4f6" font-size="8" font-weight="bold" text-anchor="middle" font-family="sans-serif">אוהל</text>
        </svg>
      `)}`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
    'dispatcher': L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30">
          <circle cx="12" cy="12" r="8" fill="%2310b981" fill-opacity="0.3" stroke="%2310b981" stroke-width="2"/>
          <circle cx="12" cy="12" r="3" fill="%2310b981"/>
        </svg>
      `)}`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
    'driver_to_ohel': L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
          <circle cx="12" cy="12" r="10" fill="%23f59e0b" fill-opacity="0.25" stroke="%23f59e0b" stroke-width="2"/>
          <!-- Bus Icon -->
          <rect x="7" y="9" width="10" height="8" rx="1" fill="%23f59e0b"/>
          <rect x="8" y="11" width="3" height="2" fill="%2305070c"/>
          <rect x="13" y="11" width="3" height="2" fill="%2305070c"/>
          <circle cx="9" cy="17" r="1.5" fill="%23fff"/>
          <circle cx="15" cy="17" r="1.5" fill="%23fff"/>
          <!-- Direction arrow -->
          <path d="M12 4l3 3h-6z" fill="%23f59e0b"/>
        </svg>
      `)}`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
    'driver_to_770': L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
          <circle cx="12" cy="12" r="10" fill="%2306b6d4" fill-opacity="0.25" stroke="%2306b6d4" stroke-width="2"/>
          <!-- Bus Icon -->
          <rect x="7" y="9" width="10" height="8" rx="1" fill="%2306b6d4"/>
          <rect x="8" y="11" width="3" height="2" fill="%2305070c"/>
          <rect x="13" y="11" width="3" height="2" fill="%2305070c"/>
          <circle cx="9" cy="17" r="1.5" fill="%23fff"/>
          <circle cx="15" cy="17" r="1.5" fill="%23fff"/>
          <!-- Direction arrow -->
          <path d="M12 4l3 3h-6z" fill="%2306b6d4"/>
        </svg>
      `)}`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
    'driver_idle': L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
          <circle cx="12" cy="12" r="10" fill="%239ca3af" fill-opacity="0.2" stroke="%239ca3af" stroke-width="2"/>
          <rect x="7" y="9" width="10" height="8" rx="1" fill="%239ca3af"/>
          <rect x="8" y="11" width="3" height="2" fill="%2305070c"/>
          <rect x="13" y="11" width="3" height="2" fill="%2305070c"/>
          <circle cx="9" cy="17" r="1.5" fill="%23fff"/>
          <circle cx="15" cy="17" r="1.5" fill="%23fff"/>
        </svg>
      `)}`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
    'driver_sos': L.icon({
      iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="%23ef4444" stroke-width="3">
            <animate attributeName="r" values="8;16;8" dur="1.5s" repeatCount="indefinite"/>
            <animate attributeName="stroke-opacity" values="1;0;1" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="20" cy="20" r="10" fill="%23ef4444"/>
          <text x="20" y="23" fill="%23fff" font-size="10" font-weight="extrabold" text-anchor="middle" font-family="sans-serif">SOS</text>
        </svg>
      `)}`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    }),
  };

  // Initialize Map
  useEffect(() => {
    // 770 and Ohel center
    const centerLat = (LOCATIONS['770'].latitude + LOCATIONS['Ohel'].latitude) / 2;
    const centerLng = (LOCATIONS['770'].longitude + LOCATIONS['Ohel'].longitude) / 2;

    const map = L.map(mapContainerId, {
      center: [centerLat, centerLng],
      zoom: 11,
      minZoom: 10,
      maxZoom: 15,
      zoomControl: true,
    });

    // Dark styled map tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    // Draw route line between 770 and Ohel
    L.polyline(
      [
        [LOCATIONS['770'].latitude, LOCATIONS['770'].longitude],
        [LOCATIONS['Ohel'].latitude, LOCATIONS['Ohel'].longitude]
      ],
      {
        color: 'rgba(255, 255, 255, 0.15)',
        weight: 3,
        dashArray: '5, 10',
      }
    ).addTo(map);

    // Add static pins for 770 and Ohel
    const m770 = L.marker([LOCATIONS['770'].latitude, LOCATIONS['770'].longitude], { icon: icons['770'] })
      .addTo(map)
      .bindPopup(`<b>${LOCATIONS['770'].name}</b><br/>${mapT('origin770')}`);
    static770MarkerRef.current = m770;

    const mOhel = L.marker([LOCATIONS['Ohel'].latitude, LOCATIONS['Ohel'].longitude], { icon: icons['Ohel'] })
      .addTo(map)
      .bindPopup(`<b>${LOCATIONS['Ohel'].name}</b><br/>${mapT('originOhel')}`);
    staticOhelMarkerRef.current = mOhel;

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Locations Markers
  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) return;

    // Update static markers popup text
    if (static770MarkerRef.current) {
      static770MarkerRef.current.getPopup()?.setContent(`<b>${LOCATIONS['770'].name}</b><br/>${mapT('origin770')}`);
    }
    if (staticOhelMarkerRef.current) {
      staticOhelMarkerRef.current.getPopup()?.setContent(`<b>${LOCATIONS['Ohel'].name}</b><br/>${mapT('originOhel')}`);
    }

    // Check which markers to remove or add
    const currentLocIds = new Set(locations.map(l => l.id));

    // Remove obsolete markers
    Object.keys(markersRef.current).forEach(id => {
      if (!currentLocIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    locations.forEach(loc => {
      let icon = icons.dispatcher;

      if (loc.role === 'driver') {
        const isSOS = sosAlerts.some(alert => alert.id === loc.id);
        if (isSOS) {
          icon = icons.driver_sos;
        } else if (loc.status === 'en_route') {
          icon = loc.direction === 'to_ohel' ? icons.driver_to_ohel : icons.driver_to_770;
        } else if (loc.status === 'break') {
          icon = icons.driver_idle;
        } else {
          icon = icons.driver_idle;
        }
      }

      const position: L.LatLngExpression = [loc.latitude, loc.longitude];

      if (markersRef.current[loc.id]) {
        // Update existing marker position & icon
        const marker = markersRef.current[loc.id];
        marker.setLatLng(position);
        marker.setIcon(icon);
        
        // Update popup
        const isSOS = sosAlerts.some(alert => alert.id === loc.id);
        let roleName = loc.role === 'driver' ? mapT('driver') : mapT('dispatcher');
        let popupText = `<b>${loc.name}</b> (${roleName})`;
        if (loc.role === 'driver') {
          let statusText = loc.status === 'en_route' ? mapT('enRoute') : loc.status === 'break' ? mapT('break') : mapT('unavailable');
          popupText += `<br/>${mapT('status')}: ${statusText}`;
          if (loc.status === 'en_route' && loc.direction) {
            let directionText = loc.direction === 'to_ohel' ? mapT('toOhel') : mapT('to770');
            popupText += `<br/>${mapT('direction')}: ${directionText}`;
            popupText += `<br/>${mapT('eta', { eta: loc.etaMinutes || '?' })}`;
          }
          if (isSOS) {
            popupText += `<br/><span style="color: #ef4444; font-weight: bold;">${mapT('sosAlertActive')}</span>`;
          }
        }
        marker.getPopup()?.setContent(popupText);
      } else {
        // Create new marker
        const isSOS = sosAlerts.some(alert => alert.id === loc.id);
        let roleName = loc.role === 'driver' ? mapT('driver') : mapT('dispatcher');
        let popupText = `<b>${loc.name}</b> (${roleName})`;
        if (loc.role === 'driver') {
          let statusText = loc.status === 'en_route' ? mapT('enRoute') : loc.status === 'break' ? mapT('break') : mapT('unavailable');
          popupText += `<br/>${mapT('status')}: ${statusText}`;
          if (loc.status === 'en_route' && loc.direction) {
            let directionText = loc.direction === 'to_ohel' ? mapT('toOhel') : mapT('to770');
            popupText += `<br/>${mapT('direction')}: ${directionText}`;
            popupText += `<br/>${mapT('eta', { eta: loc.etaMinutes || '?' })}`;
          }
          if (isSOS) {
            popupText += `<br/><span style="color: #ef4444; font-weight: bold;">${mapT('sosAlertActive')}</span>`;
          }
        }

        const marker = L.marker(position, { icon })
          .addTo(mapInstance)
          .bindPopup(popupText);

        markersRef.current[loc.id] = marker;
      }
    });

  }, [locations, sosAlerts, lang]);

  return (
    <div className="card live-map-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="app-header" style={{ padding: '12px 16px', background: 'rgba(11, 15, 25, 0.9)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1.5s infinite' }}></span>
          {mapT('title')}
        </h3>
        {sosAlerts.length > 0 && (
          <span className="sos-badge-active" style={{ fontSize: '11px' }}>
            {mapT('activeSosAlerts', { count: sosAlerts.length })}
          </span>
        )}
      </div>
      <div id={mapContainerId} style={{ flex: 1, zIndex: 1 }} />
      
      {/* SOS Quick Resolution Panel inside dashboard */}
      {sosAlerts.length > 0 && onClearSOS && (
        <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderTop: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 16px', display: 'flex', gap: '12px', overflowX: 'auto', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fca5a5', whiteSpace: 'nowrap' }}>{mapT('sosCalls')}</span>
          {sosAlerts.map(alert => (
            <div key={alert.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: '8px', fontSize: '12px' }}>
              <span style={{ fontWeight: 600, color: '#fff' }}>{alert.name}</span>
              <button 
                onClick={() => onClearSOS(alert.id)}
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
              >
                {mapT('clearAlert')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default LiveMap;
