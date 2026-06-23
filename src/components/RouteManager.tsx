import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, deleteDoc } from 'firebase/firestore';
import { Route, Stop, ServiceType } from '../types';
import { PREDEFINED_ENTITIES } from '../constants';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { MapPin, Plus, RotateCcw, Trash2, Map as MapIcon, ChevronRight, Square } from 'lucide-react';
import Map from './Map';
import { fetchRouteGeometry } from '../services/routingService';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { motion, AnimatePresence } from 'motion/react';

const BELO_JARDIM_CENTER: [number, number] = [-8.3347, -36.4179];

export default function RouteManager({ serviceConfig }: { serviceConfig?: { type: ServiceType, entity?: string } }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRegisteringStop, setIsRegisteringStop] = useState(false);
  const [newStopName, setNewStopName] = useState('');
  const [newStopStreet, setNewStopStreet] = useState('');
  const [newStopET, setNewStopET] = useState('');
  const [newStopZip, setNewStopZip] = useState('');
  const [pendingStopLocation, setPendingStopLocation] = useState<[number, number] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [returnPath, setReturnPath] = useState<[number, number][]>([]);

  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteType, setNewRouteType] = useState<ServiceType>(serviceConfig?.type || 'escolar');
  const [newRouteEntity, setNewRouteEntity] = useState(serviceConfig?.entity || '');

  // Reset new route fields when serviceConfig changes or dialog opens
  useEffect(() => {
    if (isAddingRoute) {
      setNewRouteType(serviceConfig?.type || 'escolar');
      setNewRouteEntity(serviceConfig?.entity || '');
    }
  }, [isAddingRoute, serviceConfig]);

  // Load all routes
  useEffect(() => {
    const q = query(collection(db, 'routes'));
    return onSnapshot(q, (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
    });
  }, []);

  // Fetch detailed route path
  useEffect(() => {
    const activeRoute = routes.find(r => r.id === selectedRouteId);
    if (activeRoute && activeRoute.stops && activeRoute.stops.length >= 2) {
      const sortedStops = [...activeRoute.stops].sort((a, b) => a.order - b.order);
      fetchRouteGeometry(sortedStops).then(path => setRoutePath(path));
      fetchRouteGeometry([sortedStops[sortedStops.length - 1], sortedStops[0]]).then(path => setReturnPath(path));
    } else {
      setRoutePath([]);
      setReturnPath([]);
    }
  }, [selectedRouteId, routes]);

  const registerStop = async () => {
    if (!selectedRouteId || !newStopName || !pendingStopLocation) return;
    
    const routeRef = doc(db, 'routes', selectedRouteId);
    const route = routes.find(r => r.id === selectedRouteId);
    if (!route) return;

    const newStop: Stop = {
      id: Math.random().toString(36).substr(2, 9),
      name: newStopName,
      streetName: newStopStreet,
      estimatedTime: newStopET,
      zipCode: newStopZip,
      lat: pendingStopLocation[0],
      lng: pendingStopLocation[1],
      order: (route.stops?.length || 0) + 1
    };

    await updateDoc(routeRef, {
      stops: [...(route.stops || []), newStop]
    });
    
    setNewStopName('');
    setNewStopStreet('');
    setNewStopET('');
    setNewStopZip('');
    setPendingStopLocation(null);
    setIsRegisteringStop(false);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!isRegisteringStop) return;
    
    setPendingStopLocation([lat, lng]);
    setIsSearching(true);
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
      const data = await response.json();
      
      if (data.address) {
        const street = data.address.road || data.address.pedestrian || data.address.suburb || '';
        const postcode = data.address.postcode || '';
        setNewStopName(street);
        setNewStopStreet(street);
        setNewStopZip(postcode);
      }
    } catch (error) {
      console.error("Erro na busca de endereço:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const deleteStop = async (stopId: string) => {
    if (!selectedRouteId) return;
    const routeRef = doc(db, 'routes', selectedRouteId);
    const route = routes.find(r => r.id === selectedRouteId);
    if (!route) return;

    const updatedStops = route.stops.filter(s => s.id !== stopId);
    await updateDoc(routeRef, { stops: updatedStops });
  };

  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);

  const deleteRoute = async () => {
    if (!routeToDelete) return;
    try {
      await deleteDoc(doc(db, 'routes', routeToDelete));
      if (selectedRouteId === routeToDelete) setSelectedRouteId('');
      setRouteToDelete(null);
    } catch (error) {
      console.error("Erro ao deletar rota:", error);
      setErrorMessage("Não foi possível excluir a rota. Verifique sua conexão.");
    }
  };

  const createRoute = async () => {
    if (!newRouteName.trim()) return;
    const docRef = await addDoc(collection(db, 'routes'), {
      name: newRouteName.trim(),
      serviceType: newRouteType,
      entityName: newRouteEntity.trim(),
      driverId: '', // System-managed route
      stops: []
    });
    setSelectedRouteId(docRef.id);
    setIsAddingRoute(false);
    setNewRouteName('');
    setNewRouteEntity('');
  };

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 flex flex-col sm:relative sm:h-[500px] md:h-[600px]">
      <div className="w-full h-[320px] sm:h-full relative sm:absolute sm:inset-0 sm:z-0 shrink-0">
        <Map 
          center={pendingStopLocation || BELO_JARDIM_CENTER} 
          stops={routes.find(r => r.id === selectedRouteId)?.stops}
          onMapClick={handleMapClick}
          pendingStop={pendingStopLocation}
          routeGeometry={routePath}
          returnGeometry={returnPath}
        />
      </div>

      <div className="relative sm:absolute sm:top-2 sm:left-2 md:top-4 md:left-4 z-30 w-full sm:w-80 flex flex-col gap-2 md:gap-3 p-3 sm:p-0 pointer-events-none h-auto sm:h-[calc(100%-1rem)] md:h-[calc(100%-2rem)]">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden shrink-0">
          <div className="p-3 md:p-4 bg-slate-900 text-white flex items-center justify-between">
            <h2 className="text-xs md:text-sm font-black flex items-center gap-2 uppercase tracking-tight">
              <MapIcon className="w-4 h-4 text-blue-400" />
              Gestão de Rotas
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setIsAddingRoute(true)} className="h-8 w-8 text-blue-400 hover:text-white hover:bg-slate-800">
              <Plus className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-3 md:p-4 space-y-3 md:space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase">Selecionar Rota</Label>
              <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                <SelectTrigger className="h-9 md:h-10 rounded-xl text-sm">
                  <SelectValue placeholder="Escolha uma rota..." />
                </SelectTrigger>
                <SelectContent>
                  {routes.map(route => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name} ({route.serviceType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRouteId && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setRouteToDelete(selectedRouteId)}
                className="w-full text-red-500 border-red-100 hover:bg-red-50 text-[10px] font-black uppercase h-8"
              >
                <Trash2 className="w-3 h-3 mr-2" /> Excluir Rota
              </Button>
            )}
          </div>
        </div>

        {selectedRouteId && (
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col shrink min-h-0 max-h-[220px] sm:max-h-[30vh] md:max-h-[500px]">
            <div className="p-2.5 md:p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                <MapPin className="w-3 h-3 text-blue-600" />
                Pontos de Parada ({routes.find(r => r.id === selectedRouteId)?.stops?.length || 0})
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-blue-600 bg-blue-50" onClick={() => setIsRegisteringStop(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {routes.find(r => r.id === selectedRouteId)?.stops?.sort((a, b) => a.order - b.order).map((stop, i) => (
                <div key={stop.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-full bg-slate-100 text-[9px] font-black text-slate-400">
                      {i + 1}
                    </span>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-700 truncate">{stop.name}</p>
                      {stop.estimatedTime && <p className="text-[9px] text-blue-500">{stop.estimatedTime}</p>}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-300 hover:text-red-500 transition-colors"
                    onClick={() => deleteStop(stop.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isRegisteringStop && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-lg"
          >
            <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border-2 border-blue-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Registrar Ponto
                </h3>
                <Button variant="ghost" size="icon" onClick={() => { setIsRegisteringStop(false); setPendingStopLocation(null); }} className="rounded-full">
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                </Button>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Nome</Label>
                    <Input placeholder="Ex: Escola Técnica" value={newStopName} onChange={e => setNewStopName(e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Horário</Label>
                    <Input type="time" value={newStopET} onChange={e => setNewStopET(e.target.value)} className="rounded-xl" />
                  </div>
                </div>
                
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    {pendingStopLocation ? 'Local demarcado • SALVE AGORA' : 'CLIQUE NO MAPA PARA MARCAR'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => setIsRegisteringStop(false)} variant="outline" className="flex-1 rounded-xl font-bold h-12">Cancelar</Button>
                  <Button onClick={registerStop} disabled={isSearching || !newStopName || !pendingStopLocation} className="flex-[2] rounded-xl font-black h-12 bg-blue-600">
                    {isSearching ? 'Calculando...' : 'Salvar Ponto'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isAddingRoute} onOpenChange={setIsAddingRoute}>
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[92vw] sm:max-w-sm max-w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Nova Rota</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase">Nome</Label>
              <Input placeholder="Ex: Circular Centro" value={newRouteName} onChange={e => setNewRouteName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase">Tipo</Label>
              <Select value={newRouteType} onValueChange={(v: any) => setNewRouteType(v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="escolar">Escolar</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-400 uppercase">Entidade</Label>
              <Select 
                value={PREDEFINED_ENTITIES[newRouteType].includes(newRouteEntity) ? newRouteEntity : (newRouteEntity ? "custom" : "")} 
                onValueChange={(v) => v === "custom" ? setNewRouteEntity("") : setNewRouteEntity(v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_ENTITIES[newRouteType].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  <SelectItem value="custom">Outro</SelectItem>
                </SelectContent>
              </Select>
              {(!PREDEFINED_ENTITIES[newRouteType].includes(newRouteEntity) || newRouteEntity === "") && (
                <Input placeholder="Nome..." value={newRouteEntity} onChange={e => setNewRouteEntity(e.target.value)} className="rounded-xl mt-2" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createRoute} disabled={!newRouteName.trim()} className="w-full h-12 rounded-xl bg-blue-600 font-black text-white">CRIAR ROTA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!routeToDelete} onOpenChange={(open) => !open && setRouteToDelete(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[92vw] sm:max-w-sm max-w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600">Excluir Rota?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-500 text-sm">
              Esta ação não pode ser desfeita. Todos os pontos de parada desta rota serão perdidos.
            </p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="outline" onClick={() => setRouteToDelete(null)} className="h-12 rounded-xl font-bold border-slate-200">Cancelar</Button>
            <Button onClick={deleteRoute} className="h-12 rounded-xl bg-red-600 font-black text-white hover:bg-red-700">EXCLUIR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!errorMessage} onOpenChange={(open) => !open && setErrorMessage(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[92vw] sm:max-w-sm max-w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-amber-600">Ops!</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-500 text-sm">{errorMessage}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setErrorMessage(null)} className="w-full h-12 rounded-xl bg-slate-900 font-black text-white">Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
