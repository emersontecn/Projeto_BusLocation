import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { DriverLog } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Calendar, User, Clock, Route as RouteIcon, Trash2, Search, X, Filter, ChevronDown, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { motion, AnimatePresence } from 'motion/react';

export default function DriverLogs() {
  const [logs, setLogs] = useState<DriverLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  
  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterDriver, setFilterDriver] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');

  useEffect(() => {
    const q = query(
      collection(db, 'shifts'),
      orderBy('startTime', 'desc'),
      limit(200)
    );

    return onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DriverLog)));
      setLoading(false);
    });
  }, []);

  const deleteLog = async () => {
    if (!logToDelete) return;
    try {
      await deleteDoc(doc(db, 'shifts', logToDelete));
      setLogToDelete(null);
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir registro.');
    }
  };

  // Get unique drivers and routes for filter dropdowns
  const uniqueDrivers = useMemo(() => {
    const drivers = new Set<string>();
    logs.forEach(log => {
      if (log.driverName) drivers.add(log.driverName);
    });
    return Array.from(drivers).sort();
  }, [logs]);

  const uniqueRoutes = useMemo(() => {
    const routes = new Set<string>();
    logs.forEach(log => {
      if (log.routeName) routes.add(log.routeName);
    });
    return Array.from(routes).sort();
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.driverName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.routeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.date || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !filterDate || log.date === format(new Date(filterDate + 'T12:00:00'), 'dd/MM/yyyy');
    const matchesDriver = filterDriver === 'all' || log.driverName === filterDriver;
    const matchesRoute = filterRoute === 'all' || log.routeName === filterRoute;

    // Period filtering logic
    let matchesPeriod = true;
    if (filterPeriod !== 'all' && log.startTime?.toDate) {
      const hour = log.startTime.toDate().getHours();
      if (filterPeriod === 'manha') matchesPeriod = hour >= 0 && hour < 12;
      else if (filterPeriod === 'tarde') matchesPeriod = hour >= 12 && hour < 18;
      else if (filterPeriod === 'noite') matchesPeriod = hour >= 18 && hour < 24;
    }

    return matchesSearch && matchesDate && matchesDriver && matchesRoute && matchesPeriod;
  });

  const clearFilters = () => {
    setFilterDate('');
    setFilterDriver('all');
    setFilterRoute('all');
    setFilterPeriod('all');
    setSearchTerm('');
  };

  const hasActiveFilters = filterDate !== '' || filterDriver !== 'all' || filterRoute !== 'all' || filterPeriod !== 'all' || searchTerm !== '';

  const totalKms = useMemo(() => {
    return filteredLogs.reduce((acc, log) => acc + (log.kmTraveled || 0), 0);
  }, [filteredLogs]);

  if (loading) return <div className="p-8 text-center text-slate-400">Carregando histórico...</div>;

  return (
    <div className="space-y-4 px-1 md:px-0">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 md:h-12 rounded-xl bg-white border-slate-200 shadow-sm text-sm"
          />
          {searchTerm && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
            >
              <X className="w-4 h-4 text-slate-400" />
            </Button>
          )}
        </div>
        <Button 
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className={`h-10 md:h-12 w-10 md:w-12 p-0 rounded-xl shrink-0 transition-all ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}
        >
          <Filter className="w-5 h-5" />
        </Button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-0 shadow-lg rounded-2xl bg-slate-50 mb-2">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Data</Label>
                    <Input 
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="h-10 rounded-xl text-sm bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Motorista</Label>
                    <Select value={filterDriver} onValueChange={setFilterDriver}>
                      <SelectTrigger className="h-10 rounded-xl bg-white text-sm">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Motoristas</SelectItem>
                        {uniqueDrivers.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Rota</Label>
                    <Select value={filterRoute} onValueChange={setFilterRoute}>
                      <SelectTrigger className="h-10 rounded-xl bg-white text-sm">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Rotas</SelectItem>
                        {uniqueRoutes.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase">Turno</Label>
                    <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                      <SelectTrigger className="h-10 rounded-xl bg-white text-sm">
                        <SelectValue placeholder="Qualquer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Qualquer Horário</SelectItem>
                        <SelectItem value="manha">Manhã (00h - 12h)</SelectItem>
                        <SelectItem value="tarde">Tarde (12h - 18h)</SelectItem>
                        <SelectItem value="noite">Noite (18h - 00h)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={clearFilters}
                    className="w-full text-xs text-red-500 font-bold hover:text-red-600 hover:bg-red-50"
                  >
                    LIPAR TODOS OS FILTROS
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-900 text-white pb-6 pt-8 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg md:text-xl font-black flex items-center gap-2">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                Histórico
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Registro dos turnos e viagens realizadas.
              </CardDescription>
            </div>
            <div className="text-right flex flex-col gap-1 items-end shrink-0">
              <div className="bg-white/10 px-2.5 py-1 rounded text-[10px] font-black uppercase text-slate-200">
                {filteredLogs.length} viagens
              </div>
              <div className="bg-blue-600 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider text-white">
                {totalKms.toFixed(1)} KM Total
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 italic">
                {hasActiveFilters ? 'Nenhum resultado para os filtros aplicados.' : 'Nenhum registro encontrado.'}
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="p-3 md:p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 sm:mb-2 gap-1 overflow-hidden">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg shrink-0">
                          <User className="w-3 md:w-4 h-3 md:h-4 text-blue-600" />
                        </div>
                        <span className="font-bold text-slate-900 text-sm md:text-base truncate">{log.driverName}</span>
                      </div>
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 md:px-2 py-0.5 md:py-1 rounded self-start sm:self-auto">
                        {log.startTime?.toDate() ? format(log.startTime.toDate(), 'eeee, dd/MM', { locale: ptBR }) : log.date}
                      </span>
                    </div>
                    
                    <div className="flex items-center flex-wrap gap-2 md:gap-4 text-[10px] md:text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Início: {log.startTime?.toDate() ? format(log.startTime.toDate(), 'HH:mm', { locale: ptBR }) : '...'}</span>
                      </div>
                      {log.routeName && (
                        <div className="flex items-center gap-1 overflow-hidden">
                          <RouteIcon className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{log.routeName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                        <Navigation className="w-2.5 h-2.5 text-blue-500 shrink-0 rotate-45" />
                        <span>{(log.kmTraveled || 0).toFixed(1)} km</span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                    onClick={() => setLogToDelete(log.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600">Excluir Registro?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-500 text-sm">
            Esta ação removerá este turno do histórico permanentemente.
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="outline" onClick={() => setLogToDelete(null)} className="h-12 rounded-xl font-bold border-slate-200">Cancelar</Button>
            <Button onClick={deleteLog} className="h-12 rounded-xl bg-red-600 font-black text-white hover:bg-red-700">EXCLUIR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

