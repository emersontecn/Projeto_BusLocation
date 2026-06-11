import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Route, Trip, Stop, ServiceType } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Bus, Clock, MapPin, Navigation, AlertTriangle, Bell, BellOff, User, Building2, GraduationCap, CarFront, ChevronRight } from 'lucide-react';
import Map from './Map';
import { fetchRouteGeometry } from '../services/routingService';

const BELO_JARDIM_CENTER: [number, number] = [-8.3347, -36.4179];

interface StudentViewProps {
  serviceType?: ServiceType;
  entityName?: string;
}

export default function StudentView({ serviceType, entityName }: StudentViewProps) {
  const [activeTrips, setActiveTrips] = useState<(Trip & { routeName?: string, stops?: Stop[] })[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [alarmStopId, setAlarmStopId] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [returnPath, setReturnPath] = useState<[number, number][]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load routes filtered by serviceType and entityName if provided
    let q = query(collection(db, 'routes'));
    
    if (serviceType) {
      q = query(q, where('serviceType', '==', serviceType));
    }
    if (entityName) {
      q = query(q, where('entityName', '==', entityName));
    }

    const unsubRoutes = onSnapshot(q, (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
    });

    return () => unsubRoutes();
  }, [serviceType, entityName]);

  useEffect(() => {
    // Load active trips and link with current routes
    const q = query(collection(db, 'trips'), where('status', '==', 'active'));
    const unsubTrips = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      const trips = snapshot.docs
        .map(doc => {
          const data = doc.data() as Trip;
          const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : new Date(0);
          
          // Strict filter: Ignore stale trips or those with placeholder/empty names
          const isGeneric = !data.driverName || 
                           ['Mock User', 'Administrador', 'Motorista', 'Motorista (Protótipo)', 'Administrador (Protótipo)', 'Administrador Central'].some(n => data.driverName === n);
          
          if (lastUpdated < fifteenMinutesAgo || isGeneric) return null;

          const route = routes.find(r => r.id === data.routeId);
          if (!route) return null; // If the route is not in our filtered routes list, skip this trip

          return { 
            id: doc.id, 
            ...data, 
            routeName: route?.name || 'Rota Desconhecida',
            stops: route?.stops || []
          };
        })
        .filter((t): t is (Trip & { routeName: string, stops: Stop[] }) => t !== null);

      setActiveTrips(trips);
      // Reset selected trip if it's no longer available or not selected yet
      if (trips.length > 0) {
        if (!selectedTripId || !trips.find(t => t.id === selectedTripId)) {
          setSelectedTripId(trips[0].id);
        }
      } else {
        setSelectedTripId(null);
      }
    });

    return () => unsubTrips();
  }, [routes, selectedTripId]);

  const selectedTrip = activeTrips.find(t => t.id === selectedTripId);

  // Fetch detailed route path
  useEffect(() => {
    if (selectedTrip && selectedTrip.stops && selectedTrip.stops.length >= 2) {
      const sortedStops = [...selectedTrip.stops].sort((a, b) => a.order - b.order);
      
      // Outward path
      fetchRouteGeometry(sortedStops).then(path => setRoutePath(path));
      
      // Return path
      fetchRouteGeometry([sortedStops[sortedStops.length - 1], sortedStops[0]]).then(path => setReturnPath(path));
    } else {
      setRoutePath([]);
      setReturnPath([]);
    }
  }, [selectedTripId, activeTrips]);

  // Proximity Alarm Logic
  useEffect(() => {
    if (selectedTrip && alarmStopId) {
      const stop = selectedTrip.stops?.find(s => s.id === alarmStopId);
      if (stop) {
        // Calculate distance using approximation
        const dist = Math.sqrt(
          Math.pow(selectedTrip.currentLat - stop.lat, 2) + 
          Math.pow(selectedTrip.currentLng - stop.lng, 2)
        );
        
        // Threshold reduced to ~100 meters (0.001) to prevent premature reset
        if (dist < 0.001) {
          playAlarm();
          setAlarmStopId(null); // Reset after trigger
        }
      }
    }
  }, [selectedTrip?.currentLat, selectedTrip?.currentLng, alarmStopId]);

  const playAlarm = () => {
    // Visual feedback is always possible, audio depends on browser policy
    if (Notification.permission === "granted") {
      new Notification("Ônibus Chegando!", {
        body: `O ônibus da rota ${selectedTrip?.routeName} está próximo do seu ponto!`,
        icon: "https://cdn-icons-png.flaticon.com/512/3448/3448339.png"
      });
    }
    
    // Fallback alert
    alert(`ALERTA: O ônibus (${selectedTrip?.routeName}) está chegando!`);
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Simple ETA calculation
  const calculateETA = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dist = Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
    const minutes = Math.round(dist * 1000); 
    return minutes < 1 ? 'Chegando' : `${minutes} min`;
  };

  const [isRoutesExpanded, setIsRoutesExpanded] = useState(true);
  const [isStopsExpanded, setIsStopsExpanded] = useState(false);

  return (
    <div className="relative flex-1 h-full w-full rounded-2xl md:rounded-3xl overflow-hidden border-2 md:border-4 border-white shadow-2xl bg-white min-h-[680px]">
      {/* MAPA - Elemento Primário (Fundo) */}
      <div className="absolute inset-0 z-0">
        <Map 
          center={selectedTrip ? [selectedTrip.currentLat, selectedTrip.currentLng] : BELO_JARDIM_CENTER} 
          busLocation={selectedTrip ? [selectedTrip.currentLat, selectedTrip.currentLng] : undefined}
          stops={selectedTrip?.stops}
          zoom={15}
          routeGeometry={routePath}
          returnGeometry={returnPath}
        />
      </div>

      {/* ALERTAS DO MOTORISTA - Flutuante Topo */}
      {selectedTrip?.alert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] w-[90%] max-w-md">
          <Alert variant="destructive" className="animate-bounce shadow-xl border-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-bold">Aviso do Motorista</AlertTitle>
            <AlertDescription className="text-sm font-medium">{selectedTrip.alert}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* PAINEL LATERAL ESQUERDO: LISTA DE ROTAS */}
      <div className="absolute top-2 left-2 md:top-4 md:left-4 z-40 w-[calc(100%-1rem)] sm:w-72 md:w-80 flex flex-col gap-2 md:gap-3 pointer-events-none max-h-[calc(100%-1rem)] sm:max-h-[calc(100%-2rem)]">
        <div className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all shrink-0">
          <button 
            onClick={() => setIsRoutesExpanded(!isRoutesExpanded)}
            className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <h2 className="text-xs md:text-sm font-black flex items-center gap-2 text-slate-800 uppercase tracking-tight">
              <Navigation className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600" />
              Ônibus Ativos ({activeTrips.length})
            </h2>
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isRoutesExpanded ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {isRoutesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-2 border-t border-slate-100 max-h-[30vh] md:max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar">
                  {activeTrips.length === 0 ? (
                    <div className="py-6 md:py-8 text-center bg-slate-50/50 rounded-xl m-1">
                      <Bus className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-[10px] md:text-xs text-slate-400 font-medium">Nenhum ônibus em rota</p>
                    </div>
                  ) : (
                    activeTrips.map(trip => (
                      <button 
                        key={trip.id} 
                        onClick={() => setSelectedTripId(trip.id)}
                        className={`w-full text-left p-2.5 md:p-3 rounded-xl transition-all flex items-center justify-between border-2 ${
                          selectedTripId === trip.id 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                            : 'bg-white border-transparent hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                          <Bus className={`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 ${selectedTripId === trip.id ? 'text-white' : 'text-blue-500'}`} />
                          <span className="font-bold text-xs md:text-sm truncate">{trip.routeName}</span>
                        </div>
                        {trip.alert && (
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-ping" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* INFO DO ÔNIBUS SELECIONADO */}
        {selectedTrip && (
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col shrink min-h-0">
            <div className="p-3 md:p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg">
                  <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase leading-none">Motorista</p>
                  <p className="font-bold text-xs md:text-sm text-slate-900 leading-tight">
                    {((selectedTrip as any).driverName || 'Motorista').replace(/Direção/gi, '').trim() || 'Motorista'}
                  </p>
                </div>
              </div>
              <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-1.5 py-0 text-[8px] md:text-[10px] font-black uppercase">
                Ao Vivo
              </Badge>
            </div>
            
            {/* PRÓXIMAS PARADAS EXPANSÍVEL */}
            <button 
              onClick={() => setIsStopsExpanded(!isStopsExpanded)}
              className="w-full px-4 py-2.5 md:py-3 border-t border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors text-slate-500 shrink-0"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider">Paradas da Rota</span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-transform duration-300 ${isStopsExpanded ? 'rotate-90 text-blue-600' : ''}`} />
            </button>

            <AnimatePresence>
              {isStopsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-2 pb-2 max-h-[25vh] md:max-h-[250px] overflow-y-auto space-y-1 custom-scrollbar">
                    {selectedTrip.stops?.map((stop, i) => (
                      <div 
                        key={stop.id} 
                        className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                          alarmStopId === stop.id ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-full bg-white text-[10px] font-black border border-slate-200 text-slate-400">
                            {i + 1}
                          </span>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-700 truncate">{stop.name}</p>
                            <p className="text-[10px] text-slate-400 truncate tracking-tight">
                              {calculateETA(selectedTrip.currentLat, selectedTrip.currentLng, stop.lat, stop.lng)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 rounded-full ${
                            alarmStopId === stop.id ? 'text-blue-600 bg-white' : 'text-slate-300 hover:text-blue-600'
                          }`}
                          onClick={() => setAlarmStopId(alarmStopId === stop.id ? null : stop.id)}
                        >
                          {alarmStopId === stop.id ? <Bell className="h-4 w-4 fill-current" /> : <BellOff className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* CONTROLES DE ZOOM / CENTRO (OPCIONAL SE O MAPA JÁ TIVER) */}
      <div className="absolute bottom-4 right-4 z-[1001] flex flex-col gap-2">
        <div className="p-3 bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-slate-200">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black text-blue-600 uppercase">GPS</span>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
