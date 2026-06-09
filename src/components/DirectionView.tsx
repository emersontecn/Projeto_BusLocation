import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile, ServiceType } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import DriverLogs from './DriverLogs';
import RouteManager from './RouteManager';
import { UserPlus, Users, Trash2, ShieldCheck, Mail, User as UserIcon, Loader2, CheckCircle2, History, Eraser, Key, Map as MapIcon, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

interface DirectionViewProps {
  serviceConfig?: {
    type: ServiceType;
    entity?: string;
  };
}

export default function DirectionView({ serviceConfig }: DirectionViewProps) {
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [clearingTrips, setClearingTrips] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearingDrivers, setClearingDrivers] = useState(false);
  
  // Form state for new driver profile
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Deletion state
  const [driverToDelete, setDriverToDelete] = useState<UserProfile | null>(null);
  const [clearAction, setClearAction] = useState<'history' | 'drivers' | 'activeTrips' | null>(null);

  // Admin state additions
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [registeringAdmin, setRegisteringAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminStatus, setAdminStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<UserProfile | null>(null);

  const ADMIN_EMAIL = 'emerson0712002@gmail.com';

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'driver'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driversList = snapshot.docs.map(doc => doc.data() as UserProfile);
      setDrivers(driversList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qAdmin = query(collection(db, 'users'), where('role', '==', 'admin'));
    
    const unsubscribe = onSnapshot(qAdmin, (snapshot) => {
      const adminsList = snapshot.docs.map(doc => doc.data() as UserProfile);
      // Prepend root admin if not there
      const hasRoot = adminsList.some(a => a.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      if (!hasRoot) {
        adminsList.unshift({
          uid: 'admin_root',
          email: ADMIN_EMAIL,
          name: 'Administrador Central (Você)',
          role: 'admin'
        });
      }
      setAdmins(adminsList);
      setLoadingAdmins(false);
    });

    return () => unsubscribe();
  }, []);

  const clearAllHistory = async () => {
    setClearingHistory(true);
    setClearAction(null);
    try {
      const shiftsSnapshot = await getDocs(collection(db, 'shifts'));
      const shiftPromises = shiftsSnapshot.docs.map(d => deleteDoc(doc(db, 'shifts', d.id)));
      
      const tripsSnapshot = await getDocs(collection(db, 'trips'));
      const tripPromises = tripsSnapshot.docs.map(d => deleteDoc(doc(db, 'trips', d.id)));
      
      await Promise.all([...shiftPromises, ...tripPromises]);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao apagar histórico: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setClearingHistory(false);
    }
  };

  const clearAllDrivers = async () => {
    setClearingDrivers(true);
    setClearAction(null);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'driver'));
      const snapshot = await getDocs(q);
      const promises = snapshot.docs.map(d => deleteDoc(doc(db, 'users', d.id)));
      
      await Promise.all(promises);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao remover motoristas: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setClearingDrivers(false);
    }
  };

  const clearAllActiveTrips = async () => {
    setClearingTrips(true);
    setClearAction(null);
    try {
      const q = query(collection(db, 'trips'), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      
      const promises = snapshot.docs.map(tripDoc => 
        deleteDoc(doc(db, 'trips', tripDoc.id))
      );
      
      await Promise.all(promises);
    } catch (err) {
      console.error(err);
      alert('Erro ao limpar rotas.');
    } finally {
      setClearingTrips(false);
    }
  };

  const handleCreateDriverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setStatus(null);

    try {
      const q = query(collection(db, 'users'), where('email', '==', newEmail.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setStatus({ type: 'error', message: 'Este email já está cadastrado.' });
        setRegistering(false);
        return;
      }
      
      const newDriver: Partial<UserProfile> = {
        email: newEmail.trim(),
        name: newName.trim(),
        role: 'driver' as const,
        uid: `manual_${Date.now()}`,
        password: newPassword.trim() || '123456'
      };

      await setDoc(doc(db, 'users', newDriver.uid!), newDriver);
      
      setStatus({ type: 'success', message: 'Perfil de motorista criado com sucesso!' });
      setNewEmail('');
      setNewName('');
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: 'Erro ao cadastrar motorista.' });
    } finally {
      setRegistering(false);
    }
  };

  const removeDriver = async () => {
    if (!driverToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', driverToDelete.uid));
      setDriverToDelete(null);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao remover motorista: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleCreateAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisteringAdmin(true);
    setAdminStatus(null);

    try {
      const q = query(collection(db, 'users'), where('email', '==', adminEmail.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setAdminStatus({ type: 'error', message: 'Este email já está cadastrado.' });
        setRegisteringAdmin(false);
        return;
      }
      
      const newAdmin: Partial<UserProfile> = {
        email: adminEmail.trim(),
        name: adminName.trim(),
        role: 'admin' as const,
        uid: `admin_${Date.now()}`,
        password: adminPassword.trim() || '123456'
      };

      await setDoc(doc(db, 'users', newAdmin.uid!), newAdmin);
      
      setAdminStatus({ type: 'success', message: 'Perfil de administrador criado com sucesso!' });
      setAdminEmail('');
      setAdminName('');
      setAdminPassword('');
    } catch (err: any) {
      console.error(err);
      setAdminStatus({ type: 'error', message: 'Erro ao cadastrar administrador.' });
    } finally {
      setRegisteringAdmin(false);
    }
  };

  const removeAdmin = async () => {
    if (!adminToDelete) return;
    if (adminToDelete.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      alert('Não é possível remover o administrador principal.');
      setAdminToDelete(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', adminToDelete.uid));
      setAdminToDelete(null);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao remover administrador: ${err.message || 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-2 md:p-4 space-y-4 md:space-y-8 pb-10 md:pb-20">
      <div className="flex flex-col gap-1 md:gap-2 px-2 md:px-0">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2 md:gap-3">
          <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
          Painel Administrativo
        </h1>
        <p className="text-xs md:text-sm text-slate-500 font-medium lowercase md:capitalize">Gestão centralizada de motoristas e rotas.</p>
      </div>

      <Tabs defaultValue="management" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4 md:mb-8 h-10 md:h-12 bg-slate-200 p-1 rounded-xl sticky top-0 z-10 shadow-sm sm:static">
          <TabsTrigger value="management" className="flex items-center gap-1 md:gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[10px] sm:text-sm">
            <Users className="w-3.5 h-3.5 md:w-4 md:h-4" /> Motoristas
          </TabsTrigger>
          <TabsTrigger value="routes" className="flex items-center gap-1 md:gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[10px] sm:text-sm">
            <MapIcon className="w-3.5 h-3.5 md:w-4 md:h-4" /> Rotas
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 md:gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[10px] sm:text-sm">
            <History className="w-3.5 h-3.5 md:w-4 md:h-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex items-center gap-1 md:gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[10px] sm:text-sm">
            <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" /> Admins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="flex flex-col">
          <RouteManager serviceConfig={serviceConfig} />
        </TabsContent>

        <TabsContent value="management" className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
              <CardHeader className="bg-slate-900 text-white pb-6 pt-8 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-black">
                  <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                  Novo Motorista
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Cadastre o perfil para permitir o acesso.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-6">
                <form onSubmit={handleCreateDriverProfile} className="space-y-3 md:space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="driver-name" className="text-slate-700 font-bold text-xs md:text-sm">Nome Completo</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input 
                        id="driver-name"
                        placeholder="Ex: João da Silva"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="pl-10 h-10 md:h-12 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="driver-email" className="text-slate-700 font-bold text-xs md:text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input 
                        id="driver-email"
                        type="email"
                        placeholder="motorista@exemplo.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="pl-10 h-10 md:h-12 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="driver-password" className="text-slate-700 font-bold text-xs md:text-sm">Senha</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input 
                        id="driver-password"
                        type="text"
                        placeholder="Senha (Opcional, padrão 123456)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 h-10 md:h-12 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  {status && (
                    <div className={`p-4 rounded-xl flex items-start gap-3 border ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <ShieldCheck className="w-5 h-5 shrink-0" />}
                      <p className="text-xs font-medium leading-relaxed">{status.message}</p>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-11 md:h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-100"
                    disabled={registering}
                  >
                    {registering ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Motorista'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl overflow-hidden rounded-2xl flex flex-col">
              <CardHeader className="bg-white border-b border-slate-100 pb-4 pt-6 md:pb-6 md:pt-8 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-black text-slate-900">
                  <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  Motoristas Ativos
                </CardTitle>
                <CardDescription className="text-xs md:text-sm text-slate-500">
                  Profissionais cadastrados no sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <div className="divide-y divide-slate-100">
                  {loading ? (
                    <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-200" /></div>
                  ) : drivers.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-medium italic">Nenhum motorista.</div>
                  ) : (
                    drivers.map(driver => (
                      <div key={driver.uid} className="p-3 md:p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 shrink-0">
                            {driver.name ? driver.name[0].toUpperCase() : 'M'}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-sm md:text-base text-slate-900 leading-tight truncate">{driver.name || 'Sem Nome'}</p>
                            <div className="flex flex-col gap-1 text-[10px]">
                              <p className="text-slate-500 truncate">{driver.email}</p>
                              {driver.password && (
                                <div className="flex">
                                  <span className="text-amber-600 bg-amber-50 px-1 py-0.5 rounded font-bold flex items-center gap-1">
                                    <Key className="w-2.5 h-2.5" /> {driver.password}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                          onClick={() => setDriverToDelete(driver)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="bg-amber-50 border border-amber-100 p-4 md:p-6 rounded-2xl flex flex-col gap-4">
            <div className="space-y-1">
              <h3 className="font-black text-amber-800 flex items-center gap-2 text-sm md:text-base">
                <AlertTriangle className="w-5 h-5" />
                Manutenção do Sistema
              </h3>
              <p className="text-xs md:text-sm text-amber-700 leading-relaxed">
                Ações globais para limpeza do banco de dados (Cuidado!)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <Button 
                variant="outline" 
                className="bg-white border-red-200 text-red-700 hover:bg-red-50 font-bold shadow-sm h-10 md:h-11 text-xs px-3"
                onClick={() => setClearAction('drivers')}
                disabled={clearingDrivers}
              >
                {clearingDrivers ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Remover Motoristas
              </Button>
              <Button 
                variant="outline" 
                className="bg-white border-red-200 text-red-700 hover:bg-red-50 font-bold shadow-sm h-10 md:h-11 text-xs px-3"
                onClick={() => setClearAction('history')}
                disabled={clearingHistory}
              >
                {clearingHistory ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Apagar Histórico
              </Button>
              <Button 
                variant="outline" 
                className="bg-white border-amber-200 text-amber-700 hover:bg-amber-100 font-bold shadow-sm h-10 md:h-11 text-xs px-3"
                onClick={() => setClearAction('activeTrips')}
                disabled={clearingTrips}
              >
                {clearingTrips ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eraser className="w-4 h-4 mr-2" />}
                Limpar Rotas Ativas
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <DriverLogs />
        </TabsContent>

        <TabsContent value="admins" className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
              <CardHeader className="bg-slate-950 text-white pb-6 pt-8 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-black">
                  <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-purple-400 animate-pulse" />
                  Novo Administrador
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs text-slate-300">
                  Cadastre novos administradores com e-mail e senha de acesso.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-6">
                <form onSubmit={handleCreateAdminProfile} className="space-y-3 md:space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-name" className="text-slate-700 font-bold text-xs md:text-sm">Nome Completo</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input 
                        id="admin-name"
                        placeholder="Ex: Carlos Oliveira"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="pl-10 h-10 md:h-12 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-email" className="text-slate-700 font-bold text-xs md:text-sm">Email de Acesso</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input 
                        id="admin-email"
                        type="email"
                        placeholder="admin@exemplo.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="pl-10 h-10 md:h-12 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-password" className="text-slate-700 font-bold text-xs md:text-sm">Senha de Acesso</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <Input 
                        id="admin-password"
                        type="text"
                        placeholder="Senha (mínimo 6 dígitos)"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="pl-10 h-10 md:h-12 rounded-xl text-sm"
                        required
                      />
                    </div>
                  </div>

                  {adminStatus && (
                    <div className={`p-4 rounded-xl flex items-start gap-3 border ${adminStatus.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      {adminStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />}
                      <p className="text-xs font-medium leading-relaxed">{adminStatus.message}</p>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-11 md:h-12 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-100"
                    disabled={registeringAdmin}
                  >
                    {registeringAdmin ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Administrador'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl overflow-hidden rounded-2xl flex flex-col">
              <CardHeader className="bg-white border-b border-slate-100 pb-4 pt-6 md:pb-6 md:pt-8 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-black text-slate-900">
                  <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                  Administradores Ativos
                </CardTitle>
                <CardDescription className="text-xs md:text-sm text-slate-500">
                  Gestores com permissão de acesso ao painel do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <div className="divide-y divide-slate-100">
                  {loadingAdmins ? (
                    <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-200" /></div>
                  ) : admins.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-medium italic">Nenhum administrador.</div>
                  ) : (
                    admins.map(adminUser => (
                      <div key={adminUser.uid} className="p-3 md:p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                          <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-100 rounded-full flex items-center justify-center font-bold text-purple-600 shrink-0">
                            {adminUser.name ? adminUser.name[0].toUpperCase() : 'A'}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-sm md:text-base text-slate-900 leading-tight truncate">{adminUser.name || 'Sem Nome'}</p>
                            <div className="flex flex-col gap-1 text-[10px]">
                              <p className="text-slate-500 truncate">{adminUser.email}</p>
                              {adminUser.password ? (
                                <div className="flex">
                                  <span className="text-purple-600 bg-purple-50 px-1 py-0.5 rounded font-bold flex items-center gap-1">
                                    <Key className="w-2.5 h-2.5" /> {adminUser.password}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex">
                                  <span className="text-slate-500 bg-slate-50 px-1 py-0.5 rounded font-bold flex items-center gap-1">
                                    Acesso Google / Central
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {adminUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                            onClick={() => setAdminToDelete(adminUser)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : (
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-full uppercase scale-90">Master</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGS DE EXCLUSÃO */}
      <Dialog open={!!adminToDelete} onOpenChange={(open) => !open && setAdminToDelete(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600">Excluir Administrador?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-500 text-sm">
              Deseja realmente remover <strong>{adminToDelete?.name}</strong>? Este usuário perderá instantaneamente todos os acessos de administração.
            </p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="outline" onClick={() => setAdminToDelete(null)} className="h-12 rounded-xl font-bold border-slate-200">Cancelar</Button>
            <Button onClick={removeAdmin} className="h-12 rounded-xl bg-red-600 font-black text-white hover:bg-red-700">REMOVER</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!driverToDelete} onOpenChange={(open) => !open && setDriverToDelete(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600">Excluir Motorista?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-500 text-sm">
              Deseja realmente remover <strong>{driverToDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="outline" onClick={() => setDriverToDelete(null)} className="h-12 rounded-xl font-bold border-slate-200">Cancelar</Button>
            <Button onClick={removeDriver} className="h-12 rounded-xl bg-red-600 font-black text-white hover:bg-red-700">REMOVER</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!clearAction} onOpenChange={(open) => !open && setClearAction(null)}>
        <DialogContent className="rounded-3xl border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600 uppercase">Atenção!</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-500 text-sm">
              {clearAction === 'history' && 'Deseja realmente apagar TODO o histórico de viagens e turnos?'}
              {clearAction === 'drivers' && 'Deseja realmente remover TODOS os motoristas cadastrados?'}
              {clearAction === 'activeTrips' && 'Deseja realmente remover todas as rotas ativas do mapa?'}
            </p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="outline" onClick={() => setClearAction(null)} className="h-12 rounded-xl font-bold border-slate-200">Cancelar</Button>
            <Button 
              onClick={() => {
                if (clearAction === 'history') clearAllHistory();
                if (clearAction === 'drivers') clearAllDrivers();
                if (clearAction === 'activeTrips') clearAllActiveTrips();
              }} 
              className="h-12 rounded-xl bg-red-600 font-black text-white hover:bg-red-700"
            >
              CONFIRMAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

