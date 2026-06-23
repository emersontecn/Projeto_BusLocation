import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import { Stop } from '../types';

const getTileUrl = (style: 'google-roads' | 'google-hybrid' | 'google-traffic' | 'osm') => {
  switch (style) {
    case 'google-roads':
      return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    case 'google-hybrid':
      return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    case 'google-traffic':
      return 'https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}';
    case 'osm':
    default:
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
};

const getAttribution = (style: 'google-roads' | 'google-hybrid' | 'google-traffic' | 'osm') => {
  if (style.startsWith('google')) {
    return '&copy; Google Maps';
  }
  return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
};

// Fix for default marker icons in Leaflet with React
const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// Helper to calculate exact distance in meters between two coordinates (Haversine Formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

const createStopIcon = (status: 'pending' | 'passing' | 'passed', order: number) => {
  let bgColorClass = 'bg-rose-500';
  let pulseElement = '';
  let borderClass = 'border-white';
  let textShadow = 'text-shadow';
  let innerContent = `<span class="text-[9px] font-black">${order}</span>`;

  if (status === 'passing') {
    bgColorClass = 'bg-emerald-500 animate-pulse scale-110';
    borderClass = 'border-white dark:border-slate-900';
    pulseElement = `<div class="absolute inset-x-0 inset-y-0 rounded-full bg-emerald-400 opacity-60 animate-ping"></div>`;
    innerContent = `<span class="text-[9px] font-black">★</span>`;
  } else if (status === 'passed') {
    bgColorClass = 'bg-slate-400';
    borderClass = 'border-slate-200';
    innerContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="45" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  }

  return L.divIcon({
    className: 'bg-transparent border-none',
    html: `
      <div class="relative flex items-center justify-center w-7 h-7">
        ${pulseElement}
        <div class="absolute bottom-0 w-2 h-2 bg-slate-800 rotate-45 transform translate-y-[2px] shadow-sm"></div>
        <div class="z-10 flex items-center justify-center w-6 h-6 rounded-full text-white font-black text-[10px] shadow-lg border-2 ${borderClass} ${bgColorClass} transition-all duration-300">
          ${innerContent}
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

interface MapProps {
  center: [number, number];
  zoom?: number;
  busLocation?: [number, number];
  stops?: Stop[];
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
  pendingStop?: [number, number] | null;
  autoFollow?: boolean;
  routeGeometry?: [number, number][];
  returnGeometry?: [number, number][];
}

function MapEvents({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onClick) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ChangeView({ 
  center, 
  zoom, 
  userInteracted, 
  setUserInteracted 
}: { 
  center: [number, number]; 
  zoom: number; 
  userInteracted: boolean; 
  setUserInteracted: (val: boolean) => void 
}) {
  const map = useMap();
  
  useMapEvents({
    dragstart: () => {
      setUserInteracted(true);
    },
    zoomstart: () => {
      setUserInteracted(true);
    }
  });
  
  // Force invalidateSize to fix gray areas on layout changes
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  // Update center when it changes, but keep current zoom level
  useEffect(() => {
    if (userInteracted) return;

    // Only move if the distance is significant to avoid jitter
    const currentCenter = map.getCenter();
    const distSq = Math.pow(currentCenter.lat - center[0], 2) + Math.pow(currentCenter.lng - center[1], 2);
    
    // Only move if distance is significant (> ~10 meters)
    if (distSq > 0.0000001) {
      map.flyTo(center, map.getZoom(), {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [center, map, userInteracted]);

  // Update zoom only when the zoom prop explicitly changes
  useEffect(() => {
    if (userInteracted) return;
    map.setZoom(zoom);
  }, [zoom, map, userInteracted]);

  return null;
}

// Helper to calculate angle between two coordinates
function getAngle(coord1: [number, number], coord2: [number, number]): number {
  const lat1 = coord1[0];
  const lng1 = coord1[1];
  const lat2 = coord2[0];
  const lng2 = coord2[1];

  const dy = lat2 - lat1;
  const dx = (lng2 - lng1) * Math.cos((lat1 + lat2) * Math.PI / 360);
  return Math.atan2(dy, dx) * 180 / Math.PI;
}

// Helper to shift a path to the right side of driving direction (mão) to prevent overlap on two-way streets with corner smoothing
function offsetPath(path: [number, number][], offsetDegrees: number = 0.000045): [number, number][] {
  if (!path || path.length < 2) return path;

  const result: [number, number][] = [];
  const normals: [number, number][] = [];

  // 1. Calculate raw normals for each point based on local segment directions
  for (let i = 0; i < path.length; i++) {
    const curr = path[i];
    let prev = path[i - 1];
    let next = path[i + 1];

    if (!prev) prev = curr;
    if (!next) next = curr;

    const lat1 = prev[0];
    const lng1 = prev[1];
    const lat2 = next[0];
    const lng2 = next[1];

    const dy = lat2 - lat1;
    const cosLat = Math.cos((lat1 + lat2) * Math.PI / 360);
    const dx = (lng2 - lng1) * cosLat;

    const len = Math.sqrt(dy * dy + dx * dx);

    if (len === 0) {
      normals.push([0, 0]);
    } else {
      // Perpendicular vector pointing to the right of standard driving direction
      const nx = -dx / len;
      const ny = dy / len;
      normals.push([nx, ny]);
    }
  }

  // 2. Smooth normals using a moving average window to prevent angular spikes on sharp turns/intersections
  const smoothedNormals: [number, number][] = [];
  const windowSize = 3;
  for (let i = 0; i < normals.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let w = -Math.floor(windowSize / 2); w <= Math.floor(windowSize / 2); w++) {
      const idx = i + w;
      if (idx >= 0 && idx < normals.length) {
        sumX += normals[idx][0];
        sumY += normals[idx][1];
        count++;
      }
    }
    const avgX = sumX / count;
    const avgY = sumY / count;
    const len = Math.sqrt(avgX * avgX + avgY * avgY);
    if (len === 0) {
      smoothedNormals.push([0, 0]);
    } else {
      smoothedNormals.push([avgX / len, avgY / len]);
    }
  }

  // 3. Apply smoothed offsets to the coordinates, relative to local latitude scaling
  for (let i = 0; i < path.length; i++) {
    const curr = path[i];
    const [nx, ny] = smoothedNormals[i];
    const cosLat = Math.cos(curr[0] * Math.PI / 180);

    const offsetLat = nx * offsetDegrees;
    const offsetLng = (ny * offsetDegrees) / cosLat;

    result.push([curr[0] + offsetLat, curr[1] + offsetLng]);
  }

  return result;
}

// Function to generate directional markers at intervals along a path
function renderDirectionalMarkers(path: [number, number][], idPrefix: string, color: string = '#2563eb', isDashed: boolean = false) {
  if (!path || path.length < 5) return null;

  const markers: { position: [number, number]; angle: number; id: string }[] = [];
  
  // High intensity/density directional arrows to satisfy user request perfectly
  const totalPoints = path.length;
  const interval = Math.max(5, Math.floor(totalPoints / 22));

  for (let i = interval; i < totalPoints - 5; i += interval) {
    const coord1 = path[i];
    const coord2 = path[i + 3]; // look slightly ahead to get a smoother direction average
    if (!coord1 || !coord2) continue;

    const angle = getAngle(coord1, coord2);
    markers.push({
      position: coord1,
      angle: angle,
      id: `${idPrefix}-arrow-${i}`,
    });
  }

  return markers.map(m => {
    const arrowIcon = L.divIcon({
      className: 'bg-transparent border-none',
      html: `
        <div class="flex items-center justify-center w-5 h-5 rounded-full shadow-md border-2 border-white" 
             style="background-color: ${color}; transform: rotate(${90 - m.angle}deg); transform-origin: center; display: flex; justify-content: center; align-items: center; ${isDashed ? 'border-style: dashed; border-color: #f1f5f9;' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="width: 9px; height: 9px;">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    return (
      <Marker key={m.id} position={m.position} icon={arrowIcon} interactive={false} />
    );
  });
}

export default function Map({ center, zoom = 14, busLocation, stops = [], className, onMapClick, pendingStop, routeGeometry, returnGeometry }: MapProps) {
  const stopPositions = stops.map(stop => [stop.lat, stop.lng] as [number, number]);
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [mapStyle, setMapStyle] = useState<'google-roads' | 'google-hybrid' | 'google-traffic' | 'osm'>('google-roads');
  
  const [passedStopIds, setPassedStopIds] = useState<string[]>([]);
  const [passingStopId, setPassingStopId] = useState<string | null>(null);
  const [detectionRadius, setDetectionRadius] = useState<number>(75); // dynamic meter range for API tracking!

  const [userInteracted, setUserInteracted] = useState(false);
  const [interpolatedBusLocation, setInterpolatedBusLocation] = useState<[number, number] | undefined>(busLocation);

  // Reset passed stops tracking when the route/stops array changes
  const stopsHash = stops.map(s => s.id).join(',');
  useEffect(() => {
    setPassedStopIds([]);
    setPassingStopId(null);
  }, [stopsHash]);

  // Smoothly interpolate the bus location
  useEffect(() => {
    if (!busLocation) {
      setInterpolatedBusLocation(undefined);
      return;
    }
    if (!interpolatedBusLocation) {
      setInterpolatedBusLocation(busLocation);
      return;
    }

    const startLat = interpolatedBusLocation[0];
    const startLng = interpolatedBusLocation[1];
    const endLat = busLocation[0];
    const endLng = busLocation[1];

    // If change is extremely tiny, set immediately and skip animation
    const latDiff = Math.abs(endLat - startLat);
    const lngDiff = Math.abs(endLng - startLng);
    if (latDiff < 0.000001 && lngDiff < 0.000001) {
      setInterpolatedBusLocation(busLocation);
      return;
    }

    const duration = 2000; // interpolate over 2 seconds (updates generally arrive every 2-3s)
    const startTime = performance.now();

    let animationId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth step using quadratic ease out
      const t = progress * (2 - progress);

      const currentLat = startLat + (endLat - startLat) * t;
      const currentLng = startLng + (endLng - startLng) * t;

      setInterpolatedBusLocation([currentLat, currentLng]);

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [busLocation]);

  // Track the bus position relative to each stop in real-time
  useEffect(() => {
    if (!busLocation || !stops || stops.length === 0) return;

    let currentPassingId: string | null = null;
    let closestDist = Infinity;

    stops.forEach((stop) => {
      const dist = calculateDistance(busLocation[0], busLocation[1], stop.lat, stop.lng);
      // Check if within the chosen detection accuracy radius (e.g. 50m, 75m, 120m)
      if (dist < detectionRadius && dist < closestDist) {
        currentPassingId = stop.id;
        closestDist = dist;
      }
    });

    if (currentPassingId) {
      setPassingStopId(currentPassingId);
      setPassedStopIds((prev) => {
        const targetStop = stops.find((s) => s.id === currentPassingId);
        const targetOrder = targetStop ? targetStop.order : 0;

        // Auto-complete preceding stops since routes are traversed sequentially
        const completedIds = stops
          .filter((s) => s.order <= targetOrder)
          .map((s) => s.id);

        return Array.from(new Set([...prev, ...completedIds]));
      });
    } else {
      setPassingStopId(null);
    }
  }, [busLocation, stops, detectionRadius]);

  return (
    <div className={`relative ${className || ''}`} style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={mapStyle}
          attribution={getAttribution(mapStyle)}
          url={getTileUrl(mapStyle)}
        />
        <ChangeView 
          center={center} 
          zoom={zoom} 
          userInteracted={userInteracted} 
          setUserInteracted={setUserInteracted} 
        />
        <MapEvents onClick={onMapClick} />
        
        {interpolatedBusLocation && (
          <Marker position={interpolatedBusLocation} icon={busIcon}>
            <Popup>Ônibus em tempo real</Popup>
          </Marker>
        )}

        {pendingStop && (
          <Marker position={pendingStop} icon={defaultIcon}>
            <Popup>Novo Ponto Selecionado</Popup>
          </Marker>
        )}



        {routeGeometry && routeGeometry.length > 1 && (() => {
          // Offset the outbound path slightly to place it on its correct lane
          const offsetOutbound = offsetPath(routeGeometry, 0.00004);
          
          // Offset slightly down-right for a stunning 3D drop-shadow (relevo)
          const shadowPath = offsetOutbound.map(pt => [pt[0] - 0.000015, pt[1] + 0.00001] as [number, number]);

          return (
            <>
              {/* 3D Drop-Shadow Relief Polyline */}
              <Polyline 
                positions={shadowPath} 
                color="#0f172a" 
                weight={10} 
                opacity={0.25} 
                lineCap="round"
                lineJoin="round"
              />
              {/* White outline/rim to make the line pop/feel elevated */}
              <Polyline 
                positions={offsetOutbound} 
                color="#ffffff" 
                weight={10} 
                opacity={1} 
                lineCap="round"
                lineJoin="round"
              />
              {/* Main Outbound Lane (Blue) */}
              <Polyline 
                positions={offsetOutbound} 
                color="#2563eb" 
                weight={6} 
                opacity={1.0} 
                lineCap="round"
                lineJoin="round"
              />
              {/* Double density directional arrows */}
              {renderDirectionalMarkers(offsetOutbound, 'route', '#2563eb')}
            </>
          );
        })()}

        {returnGeometry && returnGeometry.length > 1 && (() => {
          // Offset the return path slightly to place it on its correct lane
          const offsetReturn = offsetPath(returnGeometry, 0.00004);
          
          // Offset slightly down-right for matching 3D drop-shadow
          const shadowReturn = offsetReturn.map(pt => [pt[0] - 0.000015, pt[1] + 0.00001] as [number, number]);

          return (
            <>
              {/* 3D Drop-Shadow Polyline */}
              <Polyline 
                positions={shadowReturn} 
                color="#0f172a" 
                weight={9} 
                opacity={0.2} 
                lineCap="round"
                lineJoin="round"
              />
              {/* White outline/rim to elevate */}
              <Polyline 
                positions={offsetReturn} 
                color="#ffffff" 
                weight={9} 
                opacity={1} 
                lineCap="round"
                lineJoin="round"
              />
              {/* Main Return Lane (Purple/Indigo) */}
              <Polyline 
                positions={offsetReturn} 
                color="#4f46e5" 
                weight={5} 
                opacity={0.85} 
                dashArray="8, 8"
                lineCap="round"
                lineJoin="round"
              />
              {/* Double density return arrows */}
              {renderDirectionalMarkers(offsetReturn, 'return', '#4f46e5', true)}
            </>
          );
        })()}

        {!routeGeometry && !returnGeometry && stopPositions.length > 1 && (() => {
          const offsetDirect = offsetPath(stopPositions, 0.00004);
          const shadowDirect = offsetDirect.map(pt => [pt[0] - 0.000015, pt[1] + 0.00001] as [number, number]);

          return (
            <>
              <Polyline 
                positions={shadowDirect} 
                color="#0f172a" 
                weight={8} 
                opacity={0.15} 
                lineCap="round"
                lineJoin="round"
              />
              <Polyline 
                positions={offsetDirect} 
                color="#ffffff" 
                weight={8} 
                opacity={1} 
                lineCap="round"
                lineJoin="round"
              />
              <Polyline 
                positions={offsetDirect} 
                color="#3b82f6" 
                weight={5} 
                opacity={0.7} 
                lineCap="round"
                lineJoin="round"
              />
              {renderDirectionalMarkers(offsetDirect, 'direct', '#3b82f6')}
            </>
          );
        })()}

        {stops.map((stop, index) => {
          let status: 'pending' | 'passing' | 'passed' = 'pending';
          if (stop.id === passingStopId) {
            status = 'passing';
          } else if (passedStopIds.includes(stop.id)) {
            status = 'passed';
          }

          return (
            <Marker 
              key={stop.id || index} 
              position={[stop.lat, stop.lng]} 
              icon={createStopIcon(status, stop.order || index + 1)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">Ponto {stop.order || index + 1}</span>
                    {status === 'passing' && <span className="text-[9px] font-black uppercase text-emerald-600 animate-pulse bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">Atual</span>}
                    {status === 'passed' && <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-100">✔ Visitado</span>}
                  </div>
                  <p className="font-bold text-slate-800">{stop.name}</p>
                  {stop.streetName && <p className="text-xs text-slate-500">Rua: {stop.streetName} {stop.zipCode && `- CEP: ${stop.zipCode}`}</p>}
                  {stop.referencePoint && <p className="text-xs text-slate-400 italic">Ref: {stop.referencePoint}</p>}
                  {stop.estimatedTime && <p className="text-xs font-semibold text-rose-500 mt-1">Horário Estimado: {stop.estimatedTime}</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Route Legend Overlay */}
      <div className={`absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 md:px-4 rounded-2xl shadow-xl border border-slate-100 pointer-events-auto max-w-[210px] sm:max-w-[270px] transition-all duration-300 ${
        isLegendExpanded ? 'pb-2.5 pt-3' : 'py-2'
      }`}>
        <button 
          onClick={() => setIsLegendExpanded(!isLegendExpanded)}
          className={`flex items-center justify-between w-full text-left transition-colors duration-200 outline-none select-none cursor-pointer ${
            isLegendExpanded ? 'border-b border-slate-100 pb-1.5 mb-2' : ''
          }`}
          title={isLegendExpanded ? "Contrair legenda" : "Expandir legenda"}
        >
          <div className="flex items-center gap-1.5 mr-2">
            <h4 className="text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Configurações</h4>
            {isLegendExpanded && (
              <span className="text-[8px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-black uppercase tracking-wider animate-pulse">Ativo</span>
            )}
          </div>
          {isLegendExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors shrink-0" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors shrink-0" />
          )}
        </button>
        <div className={`space-y-2.5 text-[10px] sm:text-xs text-slate-600 leading-relaxed transition-all duration-300 ease-in-out origin-bottom ${
          isLegendExpanded ? 'max-h-[500px] opacity-100 scale-100' : 'max-h-0 opacity-0 scale-95 overflow-hidden pointer-events-none'
        }`}>
          {/* Mão de Ida */}
          <div className="flex items-start gap-2 pt-0.5">
            <div className="flex flex-col items-center gap-0.5 pt-1">
              <div className="w-7 h-1.5 bg-blue-600 rounded"></div>
              <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-600 shadow-sm border border-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} className="w-1.5 h-1.5">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-800 leading-none">Mão de Ida</p>
              <p className="text-[9px] text-slate-400 font-medium">Sentido Escola</p>
            </div>
          </div>

          {/* Contra-Mão / Volta */}
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center gap-0.5 pt-1">
              <div className="w-7 h-1.5 border-t-[3px] border-dashed border-indigo-600"></div>
              <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-indigo-600 shadow-sm border border-dashed border-indigo-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} className="w-1.5 h-1.5 transform rotate-180">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-800 leading-none">Mão de Volta</p>
              <p className="text-[9px] text-slate-400 font-medium">Retorno / Contra-mão</p>
            </div>
          </div>

          {/* Estado de Pontos de Embarque */}
          <div className="border-t border-slate-100 pt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-500 border-2 border-white shadow flex items-center justify-center text-white text-[8px] font-black shrink-0">1</span>
              <div>
                <p className="font-bold text-slate-700 leading-none">Ponto Programado</p>
                <p className="text-[8px] text-slate-400 font-medium">Próximo na rota</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500 border border-white text-white text-[9px] font-black items-center justify-center shadow-md">★</span>
              </span>
              <div>
                <p className="font-bold text-slate-700 leading-none">Ponto em Trânsito</p>
                <p className="text-[8px] text-emerald-600 font-medium animate-pulse">Ônibus detectado aqui</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-slate-400 border border-slate-200 shadow flex items-center justify-center text-white shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <div>
                <p className="font-bold text-slate-700 leading-none">Ponto Visitado</p>
                <p className="text-[8px] text-slate-400 font-medium">Finalizado com sucesso</p>
              </div>
            </div>
          </div>

          {/* Ônibus Realtime */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <div className="w-7 flex justify-center shrink-0">
              <img src="https://cdn-icons-png.flaticon.com/512/3448/3448339.png" alt="ônibus" className="w-4 h-4" />
            </div>
            <p className="font-bold text-slate-700">GPS Ônibus Vivo</p>
          </div>
        </div>
      </div>
    </div>
  );
}
