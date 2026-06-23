import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, serverTimestamp, getDocs } from 'firebase/firestore';
import { Route, Trip, UserProfile, ServiceType } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Play, Square, AlertTriangle, Navigation, ChevronRight, Settings, MapPin } from 'lucide-react';
import Map from './Map';
import { fetchRouteGeometry } from '../services/routingService';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Textarea } from './ui/textarea';

const BELO_JARDIM_CENTER: [number, number] = [-8.3347, -36.4179];

function calculateDistanceInKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Planet earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DriverView({ user, serviceConfig }: { user: UserProfile, serviceConfig?: { type: ServiceType, entity?: string } }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [customAlert, setCustomAlert] = useState('');
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [returnPath, setReturnPath] = useState<[number, number][]>([]);
  const [driverNameInput, setDriverNameInput] = useState(() => {
    const rawName = user.name || '';
    if (rawName === 'Direção' || rawName === 'Direção (emerson)') return 'Administrador';
    return rawName;
  });
  const [isEndTripDialogOpen, setIsEndTripDialogOpen] = useState(false);
  const [kmInput, setKmInput] = useState('');
  const [endingInProgress, setEndingInProgress] = useState(false);

  // Load all available routes for the selected service type if applicable
  useEffect(() => {
    let q = query(collection(db, 'routes'));
    
    // If we have a service config, filter routes by type and entity
    if (serviceConfig?.type) {
      if (serviceConfig.entity) {
        q = query(collection(db, 'routes'), 
          where('serviceType', '==', serviceConfig.type),
          where('entityName', '==', serviceConfig.entity)
        );
      } else {
        q = query(collection(db, 'routes'), 
          where('serviceType', '==', serviceConfig.type)
        );
      }
    }
    
    return onSnapshot(q, (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
    });
  }, [serviceConfig]);

  // Fetch detailed route path
  useEffect(() => {
    const activeRoute = routes.find(r => r.id === (activeTrip?.routeId || selectedRouteId));
    if (activeRoute && activeRoute.stops && activeRoute.stops.length >= 2) {
      const sortedStops = [...activeRoute.stops].sort((a, b) => a.order - b.order);
      
      // Outward path: stop 1 to last stop
      fetchRouteGeometry(sortedStops).then(path => setRoutePath(path));
      
      // Return path: last stop back to first stop
      fetchRouteGeometry([sortedStops[sortedStops.length - 1], sortedStops[0]]).then(path => setReturnPath(path));
    } else {
      setRoutePath([]);
      setReturnPath([]);
    }
  }, [selectedRouteId, activeTrip?.routeId, routes]);

  // Monitor active trip
  useEffect(() => {
    const q = query(
      collection(db, 'trips'),
      where('driverId', '==', user.uid),
      where('status', '==', 'active')
    );
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as Trip;
        const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : new Date(0);
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        if (lastUpdated > fifteenMinutesAgo) {
          const tripData = { id: docSnap.id, ...data } as Trip;
          setActiveTrip(tripData);
          setSelectedRouteId(tripData.routeId);
        } else {
          // If the trip is stale, we can potentially mark it as completed here or just ignore it
          setActiveTrip(null);
        }
      } else {
        setActiveTrip(null);
      }
    });
  }, [user.uid]);

  // Update location
  useEffect(() => {
    const tripId = activeTrip?.id;
    const shiftId = activeTrip?.shiftId;
    if (!tripId) return;

    let lastLat: number | null = null;
    let lastLng: number | null = null;
    let accumulatedKm = activeTrip?.kmTraveled || 0;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentLocation([latitude, longitude]);
        
        let kmDelta = 0;
        if (lastLat !== null && lastLng !== null) {
          const distance = calculateDistanceInKm(lastLat, lastLng, latitude, longitude);
          // Only accumulate if distance is positive, greater than 5 meters (0.005 km) to reduce GPS jitter, 
          // and less than 2 km (to prevent sudden GPS coordinates jumps on first startup)
          if (distance > 0.005 && distance < 2) {
            kmDelta = distance;
            accumulatedKm += kmDelta;
          }
        }

        if (lastLat === null || lastLng === null) {
          lastLat = latitude;
          lastLng = longitude;
        } else if (kmDelta > 0) {
          lastLat = latitude;
          lastLng = longitude;
        }

        updateDoc(doc(db, 'trips', tripId), {
          currentLat: latitude,
          currentLng: longitude,
          lastUpdated: new Date().toISOString(),
          kmTraveled: Number(accumulatedKm.toFixed(2))
        });

        if (shiftId) {
          updateDoc(doc(db, 'shifts', shiftId), {
            kmTraveled: Number(accumulatedKm.toFixed(2))
          });
        }
      },
      (err) => console.error(err),
      { 
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: 0
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTrip?.id]);

  const startTrip = async () => {
    if (!selectedRouteId || !driverNameInput.trim()) return;
    
    // FIRST: Check and terminate any existing active trip for this driver
    try {
      const activeQuery = query(
        collection(db, 'trips'), 
        where('driverId', '==', user.uid), 
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(activeQuery);
      if (!snapshot.empty) {
        const terminatePromises = snapshot.docs.map(t => 
          updateDoc(doc(db, 'trips', t.id), { status: 'completed', lastUpdated: new Date().toISOString() })
        );
        await Promise.all(terminatePromises);
      }
    } catch (e) {
      console.error("Error cleaning up previous trips:", e);
    }

    const selectedRoute = routes.find(r => r.id === selectedRouteId);
    
    // Get current location once to start
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      
      const now = new Date();
      
      // 1. Log the activity in 'shifts' for the administrator
      const shiftRef = await addDoc(collection(db, 'shifts'), {
        driverId: user.uid,
        driverName: driverNameInput.trim(),
        routeName: selectedRoute?.name || 'Rota Desconhecida',
        date: format(now, 'dd/MM/yyyy', { locale: ptBR }),
        startTime: serverTimestamp(),
        kmTraveled: 0
      });

      // 2. Create the trip
      await addDoc(collection(db, 'trips'), {
        routeId: selectedRouteId,
        driverId: user.uid,
        driverName: driverNameInput.trim(),
        status: 'active',
        currentLat: latitude,
        currentLng: longitude,
        lastUpdated: now.toISOString(),
        shiftId: shiftRef.id,
        kmTraveled: 0
      });
    });
  };

  const endTrip = async () => {
    if (!activeTrip) return;
    setKmInput((activeTrip.kmTraveled || 0).toFixed(1));
    setIsEndTripDialogOpen(true);
  };

  const confirmEndTrip = async () => {
    if (!activeTrip) return;
    setEndingInProgress(true);
    try {
      const km = activeTrip.kmTraveled || 0;
      
      // Update trip
      await updateDoc(doc(db, 'trips', activeTrip.id), {
        status: 'completed',
        lastUpdated: new Date().toISOString(),
        kmTraveled: km
      });

      // Update shifts/logs
      if (activeTrip.shiftId) {
        await updateDoc(doc(db, 'shifts', activeTrip.shiftId), {
          endTime: serverTimestamp(),
          kmTraveled: km
        });
      }

      setActiveTrip(null);
      setIsEndTripDialogOpen(false);
      setKmInput('');
    } catch (error) {
      console.error("Error ending trip:", error);
    } finally {
      setEndingInProgress(false);
    }
  };

  const sendAlert = async () => {
    if (!activeTrip || !customAlert.trim()) return;
    await updateDoc(doc(db, 'trips', activeTrip.id), {
      alert: customAlert
    });
    setCustomAlert('');
    setIsAlertDialogOpen(false);
    
    // Clear alert after 30 seconds
    setTimeout(() => {
      updateDoc(doc(db, 'trips', activeTrip.id), { alert: null });
    }, 30000);
  };

  const [isConfigExpanded, setIsConfigExpanded] = useState(true);
  const [isStopsExpanded, setIsStopsExpanded] = useState(false);

  // Expand stops list when a route is selected
  useEffect(() => {
    if (selectedRouteId) {
      setIsStopsExpanded(true);
    }
  }, [selectedRouteId]);

  return (
    <div className="relative flex-1 h-full w-full rounded-none sm:rounded-2xl md:rounded-3xl overflow-hidden border-0 sm:border-2 md:border-4 border-white shadow-none sm:shadow-2xl bg-white min-h-[500px] md:min-h-[680px]">
      {/* MAPA - Elemento Primário */}
      <div className="absolute inset-0 z-0">
        <Map 
          center={autoFollow ? (currentLocation || BELO_JARDIM_CENTER) : (currentLocation || BELO_JARDIM_CENTER)} 
          busLocation={currentLocation || undefined}
          stops={routes.find(r => r.id === (activeTrip?.routeId || selectedRouteId))?.stops}
          autoFollow={autoFollow}
          routeGeometry={routePath}
          returnGeometry={returnPath}
        />
      </div>

      {/* PAINEL DE CONTROLE - Flutuante Esquerda */}
      <div className="absolute top-2 left-2 md:top-4 md:left-4 z-30 w-[calc(100%-1rem)] sm:w-72 md:w-80 flex flex-col gap-2 md:gap-3 pointer-events-none h-[calc(100%-2rem)]">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden transition-all shrink-0">
          <button 
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
            className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <h2 className="text-xs md:text-sm font-black flex items-center gap-2 text-slate-800 uppercase tracking-tight">
              <Settings className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600" />
              {activeTrip ? 'Viagem Ativa' : 'Painel de Início'}
            </h2>
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isConfigExpanded ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {isConfigExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 md:p-4 border-t border-slate-100 space-y-3 md:space-y-4">
                  {!activeTrip ? (
                    <div className="space-y-3 md:space-y-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black text-slate-400 uppercase">Nome do Motorista:</Label>
                        <Input 
                          placeholder="Digite seu nome" 
                          value={driverNameInput}
                          onChange={(e) => setDriverNameInput(e.target.value)}
                          className="h-9 md:h-10 rounded-xl text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-black text-slate-400 uppercase">Selecione a Rota</Label>
                        <div className="max-h-[150px] md:max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                          {routes.length > 0 ? (
                            routes.map(route => (
                              <button
                                key={route.id}
                                onClick={() => setSelectedRouteId(route.id)}
                                className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all border-2 flex items-center justify-between ${
                                  selectedRouteId === route.id 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                    : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span className="truncate pr-2">{route.name}</span>
                                {selectedRouteId === route.id && <div className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />}
                              </button>
                            ))
                          ) : (
                            <div className="py-4 text-center">
                              <p className="text-[10px] text-slate-400">Nenhuma rota para {serviceConfig?.type || 'este serviço'}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button 
                        disabled={!selectedRouteId || !driverNameInput.trim()}
                        onClick={startTrip}
                        className="w-full h-11 md:h-12 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl gap-2 text-sm"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        INICIAR ROTA
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 md:space-y-4">
                      <div className="flex items-center justify-between p-2.5 md:p-3 bg-green-50 rounded-xl border border-green-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="font-bold text-xs md:text-sm text-green-700 truncate">
                            {routes.find(r => r.id === activeTrip.routeId)?.name}
                          </span>
                        </div>
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                          {(activeTrip.kmTraveled || 0).toFixed(2)} km
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="h-11 md:h-12 flex-col gap-1 rounded-xl font-black text-[9px] md:text-[10px]"
                          onClick={endTrip}
                        >
                          <Square className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" />
                          ENCERRAR
                        </Button>
                        
                        <Button 
                          variant="secondary"
                          size="sm"
                          className="h-11 md:h-12 flex-col gap-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[9px] md:text-[10px]"
                          onClick={() => setIsAlertDialogOpen(true)}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          ALERTA
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* LISTA DE PARADAS - Flutuante Esquerda Inferior */}
        {selectedRouteId && (
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col shrink min-h-0 max-h-[40vh] sm:max-h-[400px]">
            <button 
              onClick={() => setIsStopsExpanded(!isStopsExpanded)}
              className="w-full p-2.5 md:p-3 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors shrink-0"
            >
              <h3 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                <MapPin className="w-3 h-3 text-blue-600" />
                Paradas da Rota ({routes.find(r => r.id === selectedRouteId)?.stops?.length || 0})
              </h3>
              <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isStopsExpanded ? 'rotate-90' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isStopsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar max-h-[30vh] sm:max-h-[350px]">
                    {routes.find(r => r.id === selectedRouteId)?.stops?.sort((a, b) => a.order - b.order).map((stop, i) => (
                      <div key={stop.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-full bg-slate-100 text-[9px] font-black text-slate-400">
                            {i + 1}
                          </span>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-700 truncate">{stop.name}</p>
                            {stop.estimatedTime && <p className="text-[9px] text-blue-500">{stop.estimatedTime}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!routes.find(r => r.id === selectedRouteId)?.stops || routes.find(r => r.id === selectedRouteId)?.stops?.length === 0) && (
                      <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 m-2">
                        <p className="text-[10px] text-slate-400 font-medium italic">Nenhuma parada</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* CONTROLES DO MAPA - Flutuante Direita */}

      {/* DIALOG DE ALERTA */}
      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <AlertTriangle className="text-amber-500" />
              Notificar Atraso
            </DialogTitle>
            <DialogDescription>A mensagem será enviada instantaneamente para todos os alunos nesta rota.</DialogDescription>
          </DialogHeader>
          <Textarea 
            placeholder="Ex: Pneu furado, vamos atrasar 15 min." 
            value={customAlert} 
            onChange={e => setCustomAlert(e.target.value)}
            className="h-32 rounded-2xl border-slate-200"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsAlertDialogOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
            <Button variant="destructive" onClick={sendAlert} disabled={!customAlert.trim()} className="rounded-xl font-black bg-amber-500 hover:bg-amber-600 text-white">
              Enviar Alerta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE ENCERRAR ROTA COM QUILOMETROS */}
      <Dialog open={isEndTripDialogOpen} onOpenChange={(open) => !open && setIsEndTripDialogOpen(false)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Navigation className="text-blue-600 animate-pulse w-5 h-5 rotate-45" />
              Encerrar Rota
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Parabéns por concluir mais uma rota! A quilometragem total percorrida foi calculada automaticamente por geolocalização.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Distância Percorrida</span>
              <span className="text-3xl font-black text-blue-600 block">
                {(activeTrip?.kmTraveled || 0).toFixed(2)} <span className="text-sm font-bold text-slate-500 font-sans">km</span>
              </span>
              <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full mt-2 inline-block">
                ✓ Calculado automaticamente por GPS
              </span>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-2">
            <Button 
              variant="outline" 
              onClick={() => setIsEndTripDialogOpen(false)} 
              className="h-12 rounded-xl font-bold border-slate-200"
              disabled={endingInProgress}
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmEndTrip} 
              disabled={endingInProgress} 
              className="h-12 rounded-xl font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100"
            >
              {endingInProgress ? 'Encerrando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONTROLES DO MAPA - Flutuante Direita */}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2">
        <Button 
          variant="secondary" 
          size="icon" 
          className={`h-12 w-12 rounded-2xl shadow-xl transition-all ${autoFollow ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
          onClick={() => setAutoFollow(!autoFollow)}
        >
          <Navigation className={`w-5 h-5 ${autoFollow ? 'fill-current' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
