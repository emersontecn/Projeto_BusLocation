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
import { UserPlus, Users, Trash2, ShieldCheck, Mail, User as UserIcon, Loader2, CheckCircle2, History, Eraser, Key, Map as MapIcon, AlertTriangle, GraduationCap, Search, Pencil, MapPin, Phone, Clock, Globe, Sparkles } from 'lucide-react';
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
  const [editingDriver, setEditingDriver] = useState<UserProfile | null>(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverEmail, setEditDriverEmail] = useState('');
  const [editDriverPassword, setEditDriverPassword] = useState('');
  const [editDriverStatus, setEditDriverStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [updatingDriver, setUpdatingDriver] = useState(false);

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
  const [editingAdmin, setEditingAdmin] = useState<UserProfile | null>(null);
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editAdminStatus, setEditAdminStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [updatingAdmin, setUpdatingAdmin] = useState(false);

  // School states
  const [schools, setSchools] = useState<any[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolInep, setNewSchoolInep] = useState('');
  const [newSchoolCity, setNewSchoolCity] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolLatitude, setSchoolLatitude] = useState('');
  const [schoolLongitude, setSchoolLongitude] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolResponsible, setSchoolResponsible] = useState('');
  const [schoolArrivalTime, setSchoolArrivalTime] = useState('');
  const [schoolDepartureTime, setSchoolDepartureTime] = useState('');
  const [schoolIsActive, setSchoolIsActive] = useState(true);
  const [schoolStatus, setSchoolStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [editingSchool, setEditingSchool] = useState<any | null>(null);
  const [schoolToDelete, setSchoolToDelete] = useState<any | null>(null);
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [schoolPage, setSchoolPage] = useState(1);

  // Cidades do Brasil (IBGE)
  const [allCities, setAllCities] = useState<{ name: string; uf: string }[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const fetchCities = async () => {
    if (allCities.length > 0) return;
    setLoadingCities(true);
    try {
      const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map((item: any) => ({
          name: item.nome,
          uf: item.microrregiao?.mesorregiao?.UF?.sigla || item.regiaoImediata?.subregiaoImediata?.regiaoIntermediaria?.UF?.sigla || 'PE'
        }));
        setAllCities(formatted);
      } else {
        throw new Error('Falha na resposta do servidor IBGE');
      }
    } catch (err) {
      console.error("Erro ao carregar cidades do IBGE:", err);
      // Fallback robusto com cidades de Pernambuco
      setAllCities([
        { name: "Belo Jardim", uf: "PE" },
        { name: "Caruaru", uf: "PE" },
        { name: "Recife", uf: "PE" },
        { name: "Sanharó", uf: "PE" },
        { name: "Tacaimbó", uf: "PE" },
        { name: "São Bento do Una", uf: "PE" },
        { name: "Pesqueira", uf: "PE" },
        { name: "Gravatá", uf: "PE" },
        { name: "Garanhuns", uf: "PE" },
        { name: "Arcoverde", uf: "PE" },
        { name: "Toritama", uf: "PE" },
        { name: "Santa Cruz do Capibaribe", uf: "PE" }
      ]);
    } finally {
      setLoadingCities(false);
    }
  };

  const filteredCitySuggestions = React.useMemo(() => {
    if (!newSchoolCity || newSchoolCity.trim().length === 0) return [];
    const term = newSchoolCity.toLowerCase();
    return allCities
      .filter(c => 
        c.name.toLowerCase().includes(term) || 
        `${c.name} - ${c.uf}`.toLowerCase().includes(term)
      )
      .slice(0, 50);
  }, [newSchoolCity, allCities]);

  const handleSelectCity = (city: { name: string; uf: string }) => {
    setNewSchoolCity(`${city.name} - ${city.uf}`);
    setShowCitySuggestions(false);
  };

  const ADMIN_EMAIL = 'emerson0712002@gmail.com';

  useEffect(() => {
    const qSchools = query(collection(db, 'schools'));
    const unsubscribe = onSnapshot(
      qSchools, 
      (snapshot) => {
        const schoolsList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        setSchools(schoolsList);
        setLoadingSchools(false);
      },
      (error) => {
        console.error("Error reading schools:", error);
        setSchoolStatus({ type: 'error', message: 'Erro ao carregar escolas de forma síncrona. Verifique as regras do banco de dados.' });
        setLoadingSchools(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLoadDefaultSchools = async () => {
    setLoadingSchools(true);
    setSchoolStatus(null);
    try {
      const defaultBeloJardimSchools = [
        {
          name: "IFPE",
          inep: "26141360",
          city: "Belo Jardim",
          address: "Av. Sebastião Rodrigues da Costa, s/n - Manoel Valdevino",
          phone: "(81) 3411-3200",
          responsible: "Direção Geral",
          arrivalTime: "07:30",
          departureTime: "22:15",
          latitude: -8.3204,
          longitude: -36.4172,
          status: "active"
        },
        {
          name: "UFRPE/UABJ",
          inep: "26402312",
          city: "Belo Jardim",
          address: "Av. Dr. Sebastião Cabral, s/n - Centro",
          phone: "(81) 3726-8700",
          responsible: "Secretaria de Curso",
          arrivalTime: "07:30",
          departureTime: "22:00",
          latitude: -8.3347,
          longitude: -36.4179,
          status: "active"
        },
        {
          name: "ETE",
          inep: "26154320",
          city: "Belo Jardim",
          address: "PE-166, Km 02, s/n - Aeroporto",
          phone: "(81) 3726-8480",
          responsible: "Diretoria Técnica",
          arrivalTime: "07:30",
          departureTime: "17:00",
          latitude: -8.3115,
          longitude: -36.4190,
          status: "active"
        }
      ];

      let addedCount = 0;
      for (const sch of defaultBeloJardimSchools) {
        // Check if school already exists by INEP
        const exists = schools.some(s => s.inep === sch.inep);
        if (!exists) {
          const schoolId = `school_${sch.inep}`;
          await setDoc(doc(db, 'schools', schoolId), sch);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        setSchoolStatus({ type: 'success', message: `${addedCount} escolas padrão da região foram adicionadas com sucesso!` });
      } else {
        setSchoolStatus({ type: 'success', message: 'Todas as escolas padrão já estão cadastradas no sistema.' });
      }
    } catch (err) {
      console.error("Error seeding schools:", err);
      setSchoolStatus({ type: 'error', message: 'Erro ao carregar as escolas padrão.' });
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSchools(true);
    setSchoolStatus(null);

    try {
      if (
        !newSchoolName.trim() || 
        !newSchoolInep.trim() || 
        !newSchoolCity.trim() || 
        !schoolAddress.trim() ||
        !schoolArrivalTime.trim() ||
        !schoolDepartureTime.trim()
      ) {
        setSchoolStatus({ type: 'error', message: 'Preencha todos os campos obrigatórios.' });
        setLoadingSchools(false);
        return;
      }

      const parsedLat = schoolLatitude.trim() ? parseFloat(schoolLatitude) : -8.3347;
      const parsedLng = schoolLongitude.trim() ? parseFloat(schoolLongitude) : -36.4179;
      if (isNaN(parsedLat) || isNaN(parsedLng)) {
        setSchoolStatus({ type: 'error', message: 'As coordenadas latitude e longitude devem ser números válidos.' });
        setLoadingSchools(false);
        return;
      }

      // Check INEP is valid number/string and doesn't already exist unless we're editing
      const isDuplicateInep = schools.some(s => s.inep === newSchoolInep.trim() && (!editingSchool || s.uid !== editingSchool.uid));
      if (isDuplicateInep) {
        setSchoolStatus({ type: 'error', message: 'Já existe uma escola cadastrada com este código/INEP.' });
        setLoadingSchools(false);
        return;
      }

      const schoolId = editingSchool ? editingSchool.uid : `school_${Date.now()}`;
      await setDoc(doc(db, 'schools', schoolId), {
        name: newSchoolName.trim(),
        inep: newSchoolInep.trim(),
        city: newSchoolCity.trim(),
        address: schoolAddress.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        phone: schoolPhone.trim(),
        responsible: schoolResponsible.trim(),
        arrivalTime: schoolArrivalTime.trim(),
        departureTime: schoolDepartureTime.trim(),
        status: schoolIsActive ? 'active' : 'inactive'
      }, { merge: true });

      setSchoolStatus({ 
        type: 'success', 
        message: editingSchool ? 'Escola atualizada com sucesso!' : 'Escola cadastrada com sucesso!' 
      });
      
      // Reset form
      setNewSchoolName('');
      setNewSchoolInep('');
      setNewSchoolCity('');
      setSchoolAddress('');
      setSchoolLatitude('');
      setSchoolLongitude('');
      setSchoolPhone('');
      setSchoolResponsible('');
      setSchoolArrivalTime('');
      setSchoolDepartureTime('');
      setSchoolIsActive(true);
      setEditingSchool(null);
    } catch (err: any) {
      console.error(err);
      setSchoolStatus({ type: 'error', message: `Erro: ${err.message || 'Desconhecido'}` });
    } finally {
      setLoadingSchools(false);
    }
  };

  const removeSchool = async () => {
    if (!schoolToDelete) return;
    setLoadingSchools(true);
    try {
      await deleteDoc(doc(db, 'schools', schoolToDelete.uid));
      setSchoolStatus({ type: 'success', message: 'Escola excluída com sucesso!' });
      setSchoolToDelete(null);
    } catch (err: any) {
      console.error(err);
      setSchoolStatus({ type: 'error', message: `Erro ao excluir: ${err.message || 'Desconhecido'}` });
    } finally {
      setLoadingSchools(false);
    }
  };

  const filteredSchools = schools.filter(s => 
    s.name?.toLowerCase().includes(schoolSearchTerm.toLowerCase()) ||
    s.inep?.toLowerCase().includes(schoolSearchTerm.toLowerCase()) ||
    s.city?.toLowerCase().includes(schoolSearchTerm.toLowerCase())
  );

  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(filteredSchools.length / ITEMS_PER_PAGE);
  const paginatedSchools = filteredSchools.slice((schoolPage - 1) * ITEMS_PER_PAGE, schoolPage * ITEMS_PER_PAGE);

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
      const emailVal = newEmail.trim();
      const nameVal = newName.trim();
      const passwordVal = newPassword.trim() || '123456';

      if (!emailVal) {
        setStatus({ type: 'error', message: 'O email é obrigatório.' });
        setRegistering(false);
        return;
      }

      const q = query(collection(db, 'users'), where('email', '==', emailVal));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setStatus({ type: 'error', message: 'Este email já está cadastrado.' });
        setRegistering(false);
        return;
      }
      
      const driverId = `manual_${Date.now()}`;
      const driverData: UserProfile = {
        email: emailVal,
        name: nameVal,
        role: 'driver' as const,
        uid: driverId,
        password: passwordVal
      };

      await setDoc(doc(db, 'users', driverId), driverData);
      
      setStatus({ 
        type: 'success', 
        message: 'Perfil de motorista criado com sucesso!' 
      });
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

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    setUpdatingDriver(true);
    setEditDriverStatus(null);

    try {
      const finalEmail = editDriverEmail.trim();
      const finalName = editDriverName.trim();
      const finalPassword = editDriverPassword.trim();

      if (!finalEmail) {
        setEditDriverStatus({ type: 'error', message: 'O email é obrigatório.' });
        setUpdatingDriver(false);
        return;
      }

      if (finalEmail.toLowerCase() !== editingDriver.email.toLowerCase()) {
        const q = query(collection(db, 'users'), where('email', '==', finalEmail));
        const querySnapshot = await getDocs(q);
        const emailOwnerExists = querySnapshot.docs.some(doc => doc.id !== editingDriver.uid);
        if (emailOwnerExists) {
          setEditDriverStatus({ type: 'error', message: 'Este email já está cadastrado por outro usuário.' });
          setUpdatingDriver(false);
          return;
        }
      }

      const driverId = editingDriver.uid;
      const driverData: Partial<UserProfile> = {
        email: finalEmail,
        name: finalName,
        password: finalPassword || '123456'
      };

      await setDoc(doc(db, 'users', driverId), driverData, { merge: true });
      
      setEditDriverStatus({ type: 'success', message: 'Perfil de motorista atualizado com sucesso!' });
      setTimeout(() => {
        setEditingDriver(null);
        setEditDriverStatus(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setEditDriverStatus({ type: 'error', message: 'Erro ao atualizar motorista.' });
    } finally {
      setUpdatingDriver(false);
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
      const emailVal = adminEmail.trim();
      const nameVal = adminName.trim();
      const passwordVal = adminPassword.trim() || '123456';

      if (!emailVal) {
        setAdminStatus({ type: 'error', message: 'O email é obrigatório.' });
        setRegisteringAdmin(false);
        return;
      }

      const q = query(collection(db, 'users'), where('email', '==', emailVal));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setAdminStatus({ type: 'error', message: 'Este email já está cadastrado.' });
        setRegisteringAdmin(false);
        return;
      }
      
      const adminId = `admin_${Date.now()}`;
      const adminData: UserProfile = {
        email: emailVal,
        name: nameVal,
        role: 'admin' as const,
        uid: adminId,
        password: passwordVal
      };

      await setDoc(doc(db, 'users', adminId), adminData);
      
      setAdminStatus({ 
        type: 'success', 
        message: 'Perfil de administrador criado com sucesso!' 
      });
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

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setUpdatingAdmin(true);
    setEditAdminStatus(null);

    try {
      const finalEmail = editAdminEmail.trim();
      const finalName = editAdminName.trim();
      const finalPassword = editAdminPassword.trim();

      if (!finalEmail) {
        setEditAdminStatus({ type: 'error', message: 'O email é obrigatório.' });
        setUpdatingAdmin(false);
        return;
      }

      if (finalEmail.toLowerCase() !== editingAdmin.email.toLowerCase()) {
        const q = query(collection(db, 'users'), where('email', '==', finalEmail));
        const querySnapshot = await getDocs(q);
        const emailOwnerExists = querySnapshot.docs.some(doc => doc.id !== editingAdmin.uid);
        if (emailOwnerExists) {
          setEditAdminStatus({ type: 'error', message: 'Este email já está cadastrado por outro usuário.' });
          setUpdatingAdmin(false);
          return;
        }
      }

      const adminId = editingAdmin.uid;
      const adminData: Partial<UserProfile> = {
        email: finalEmail,
        name: finalName,
        password: finalPassword || '123456'
      };

      await setDoc(doc(db, 'users', adminId), adminData, { merge: true });
      
      setEditAdminStatus({ type: 'success', message: 'Perfil de administrador atualizado com sucesso!' });
      setTimeout(() => {
        setEditingAdmin(null);
        setEditAdminStatus(null);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setEditAdminStatus({ type: 'error', message: 'Erro ao atualizar administrador.' });
    } finally {
      setUpdatingAdmin(false);
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
        <p className="text-xs md:text-sm text-slate-500 font-medium">Gestão centralizada de motoristas e rotas.</p>
      </div>

      <Tabs defaultValue="management" className="w-full">
        <TabsList className="flex flex-wrap md:grid md:grid-cols-5 gap-1.5 mb-4 md:mb-8 h-auto bg-slate-200 p-1.5 rounded-xl sticky top-0 z-10 shadow-sm sm:static">
          <TabsTrigger value="management" className="flex-1 min-w-[110px] sm:min-w-0 shrink-0 flex items-center justify-center gap-1 md:gap-2 rounded-lg data-[active]:bg-white data-[active]:text-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[11px] sm:text-xs md:text-sm py-1.5 sm:py-2 px-2 sm:px-3 md:px-1 whitespace-nowrap">
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" /> Motoristas
          </TabsTrigger>
          <TabsTrigger value="routes" className="flex-1 min-w-[100px] sm:min-w-0 shrink-0 flex items-center justify-center gap-1 md:gap-2 rounded-lg data-[active]:bg-white data-[active]:text-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[11px] sm:text-xs md:text-sm py-1.5 sm:py-2 px-2 sm:px-3 md:px-1 whitespace-nowrap">
            <MapIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" /> Rotas
          </TabsTrigger>
          <TabsTrigger value="schools" className="flex-1 min-w-[100px] sm:min-w-0 shrink-0 flex items-center justify-center gap-1 md:gap-2 rounded-lg data-[active]:bg-white data-[active]:text-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[11px] sm:text-xs md:text-sm py-1.5 sm:py-2 px-2 sm:px-3 md:px-1 whitespace-nowrap">
            <GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" /> Escolas
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 min-w-[100px] sm:min-w-0 shrink-0 flex items-center justify-center gap-1 md:gap-2 rounded-lg data-[active]:bg-white data-[active]:text-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[11px] sm:text-xs md:text-sm py-1.5 sm:py-2 px-2 sm:px-3 md:px-1 whitespace-nowrap">
            <History className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex-1 min-w-[100px] sm:min-w-0 shrink-0 flex items-center justify-center gap-1 md:gap-2 rounded-lg data-[active]:bg-white data-[active]:text-blue-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold text-[11px] sm:text-xs md:text-sm py-1.5 sm:py-2 px-2 sm:px-3 md:px-1 whitespace-nowrap">
            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" /> Admins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="flex flex-col">
          <RouteManager serviceConfig={serviceConfig} />
        </TabsContent>

        <TabsContent value="schools" className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <Card className="border-0 shadow-xl overflow-hidden rounded-2xl">
              <CardHeader className="bg-slate-900 text-white pb-6 pt-8 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-black">
                  <GraduationCap className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                  {editingSchool ? 'Editar Escola' : 'Nova Escola'}
                </CardTitle>
                <CardDescription className="text-slate-300">
                  {editingSchool ? 'Altere as informações da escola cadastrada.' : 'Cadastre uma nova escola no sistema.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-6">
                <>
                {schoolStatus && (
                  <div className={`mb-4 p-3 rounded-xl border font-bold text-xs md:text-sm flex items-center gap-2 ${
                    schoolStatus.type === 'success' 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                      : 'bg-red-50 border-red-100 text-red-600'
                  }`}>
                    {schoolStatus.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                    {schoolStatus.message}
                  </div>
                )}
                  <form onSubmit={handleCreateSchool} className="space-y-5">
                  {/* Seção 1: Identificação */}
                  <div className="space-y-3 bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-200/60">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200/50 pb-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-500" /> Identificação da Escola
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-1 sm:col-span-2">
                        <Label htmlFor="school-name" className="text-slate-700 font-bold text-xs">Nome da Escola *</Label>
                        <Input 
                          id="school-name"
                          placeholder="Ex: Escola Técnica Estadual" 
                          value={newSchoolName}
                          onChange={(e) => setNewSchoolName(e.target.value)}
                          required
                          maxLength={100}
                          className="rounded-xl border-slate-200 h-10 text-sm bg-white focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="school-inep" className="text-slate-700 font-bold text-xs">Código/INEP *</Label>
                        <Input 
                          id="school-inep"
                          placeholder="Ex: 26115042" 
                          value={newSchoolInep}
                          onChange={(e) => setNewSchoolInep(e.target.value)}
                          required
                          maxLength={20}
                          className="rounded-xl border-slate-200 h-10 font-mono text-sm bg-white focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="school-resp" className="text-slate-700 font-bold text-xs">Responsável Transporte (opcional)</Label>
                        <Input 
                          id="school-resp"
                          placeholder="Ex: Maria Silva" 
                          value={schoolResponsible}
                          onChange={(e) => setSchoolResponsible(e.target.value)}
                          maxLength={80}
                          className="rounded-xl border-slate-200 h-10 text-sm bg-white focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1 col-span-1 sm:col-span-2">
                        <Label htmlFor="school-phone" className="text-slate-700 font-bold text-xs">Telefone de Contato (opcional)</Label>
                        <Input 
                          id="school-phone"
                          placeholder="Ex: (81) 98765-4321" 
                          value={schoolPhone}
                          onChange={(e) => setSchoolPhone(e.target.value)}
                          maxLength={25}
                          className="rounded-xl border-slate-200 h-10 text-sm bg-white focus-visible:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção 2: Localização */}
                  <div className="space-y-3 bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-200/60">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200/50 pb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500" /> Localização & Endereço
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-1 sm:col-span-2">
                        <Label htmlFor="school-address" className="text-slate-700 font-bold text-xs">Endereço da Escola *</Label>
                        <Input 
                          id="school-address"
                          placeholder="Ex: Av. Dep. Fábio Corrêa, 560, Centro" 
                          value={schoolAddress}
                          onChange={(e) => setSchoolAddress(e.target.value)}
                          required
                          maxLength={200}
                          className="rounded-xl border-slate-200 h-10 text-sm bg-white focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1 col-span-1 sm:col-span-2 relative">
                        <Label htmlFor="school-city" className="text-slate-700 font-bold text-xs">Cidade/Região *</Label>
                        <Input 
                          id="school-city"
                          placeholder="Digite para buscar a cidade... Ex: Belo Jardim - PE" 
                          value={newSchoolCity}
                          onChange={(e) => {
                            setNewSchoolCity(e.target.value);
                            setShowCitySuggestions(true);
                          }}
                          onFocus={() => {
                            fetchCities();
                            setShowCitySuggestions(true);
                          }}
                          onBlur={() => {
                            // Slight delay to allow clicking a suggestion before selection registers
                            setTimeout(() => setShowCitySuggestions(false), 200);
                          }}
                          required
                          maxLength={100}
                          className="rounded-xl border-slate-200 h-10 text-sm bg-white focus-visible:ring-blue-500"
                          autoComplete="off"
                        />
                        {showCitySuggestions && newSchoolCity.trim().length > 0 && (
                          <div className="absolute z-[100] left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-50 cursor-pointer">
                            {loadingCities && (
                              <div className="p-3 text-xs text-slate-500 flex items-center justify-between">
                                <span className="font-semibold">Buscando cidades do Brasil...</span>
                                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                            {!loadingCities && filteredCitySuggestions.length === 0 && (
                              <div className="p-3 text-xs text-slate-400 italic">
                                Nenhuma cidade encontrada. Continue digitando para cadastrar.
                              </div>
                            )}
                            {!loadingCities && filteredCitySuggestions.map((city, idx) => (
                              <button
                                key={`${city.name}-${city.uf}-${idx}`}
                                type="button"
                                onMouseDown={() => handleSelectCity(city)}
                                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 font-bold hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer border-0"
                              >
                                <span className="truncate">{city.name}</span>
                                <span className="bg-slate-100 text-slate-600 text-[10px] uppercase px-1.5 py-0.5 rounded font-mono shrink-0 font-extrabold">{city.uf}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Seção 3: Horários e Funcionamento */}
                  <div className="space-y-3 bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-200/60">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-200/50 pb-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" /> Horários & Operação
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="school-in" className="text-slate-700 font-bold text-xs">Horário de Entrada *</Label>
                        <Input 
                          id="school-in"
                          type="time"
                          value={schoolArrivalTime}
                          onChange={(e) => setSchoolArrivalTime(e.target.value)}
                          required
                          className="rounded-xl border-slate-200 h-10 text-sm font-bold bg-white focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="school-out" className="text-slate-700 font-bold text-xs">Horário de Saída *</Label>
                        <Input 
                          id="school-out"
                          type="time"
                          value={schoolDepartureTime}
                          onChange={(e) => setSchoolDepartureTime(e.target.value)}
                          required
                          className="rounded-xl border-slate-200 h-10 text-sm font-bold bg-white focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-1 col-span-1 sm:col-span-2">
                        <Label className="text-slate-700 font-bold text-xs block">Status da Escola</Label>
                        <div className="flex gap-4 mt-1">
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input 
                              type="radio" 
                              name="school-status" 
                              checked={schoolIsActive === true} 
                              onChange={() => setSchoolIsActive(true)}
                              className="text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" 
                            />
                            Ativa
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input 
                              type="radio" 
                              name="school-status" 
                              checked={schoolIsActive === false} 
                              onChange={() => setSchoolIsActive(false)}
                              className="text-red-500 focus:ring-red-500 w-4 h-4 cursor-pointer"
                            />
                            Inativa
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {editingSchool && (
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => {
                          setEditingSchool(null);
                          setNewSchoolName('');
                          setNewSchoolInep('');
                          setNewSchoolCity('');
                          setSchoolAddress('');
                          setSchoolLatitude('');
                          setSchoolLongitude('');
                          setSchoolPhone('');
                          setSchoolResponsible('');
                          setSchoolArrivalTime('');
                          setSchoolDepartureTime('');
                          setSchoolIsActive(true);
                        }}
                        className="flex-1 h-10 rounded-xl font-bold border-slate-200 shadow-sm text-xs"
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button 
                      type="submit" 
                      disabled={loadingSchools || !newSchoolName.trim() || !newSchoolInep.trim() || !newSchoolCity.trim() || !schoolAddress.trim() || !schoolArrivalTime.trim() || !schoolDepartureTime.trim()} 
                      className={`flex-[2] h-10 rounded-xl font-black text-white shadow-md transition-all text-xs tracking-wider uppercase ${
                        editingSchool ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {loadingSchools ? <Loader2 className="animate-spin w-4 h-4 mx-auto" /> : (editingSchool ? 'ATUALIZAR' : 'CADASTRAR ESCOLA')}
                    </Button>
                  </div>
                </form>
                </>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl overflow-hidden rounded-2xl flex flex-col">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-4 md:p-6 pt-8 pb-6 shrink-0">
                <CardTitle className="text-slate-800 text-lg md:text-xl font-black flex items-center justify-between">
                  Lista de Escolas
                  <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-full font-bold">{filteredSchools.length}</span>
                </CardTitle>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                  <CardDescription className="text-slate-500">Visualização de escolas cadastradas.</CardDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadDefaultSchools}
                    disabled={loadingSchools}
                    className="self-start sm:self-auto bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 hover:border-blue-300 font-bold text-xs gap-1.5 h-8 rounded-lg"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    Importar Escolas Já Existentes
                  </Button>
                </div>
                
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Pesquisar escola ou cidade..." 
                    value={schoolSearchTerm}
                    onChange={(e) => {
                      setSchoolSearchTerm(e.target.value);
                      setSchoolPage(1);
                    }}
                    className="pl-9 h-10 text-xs md:text-sm rounded-xl max-w-sm"
                    maxLength={100}
                  />
                </div>
              </CardHeader>

              <CardContent className="p-0 flex-1 max-h-[550px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {paginatedSchools.length === 0 ? (
                  <div className="p-8 text-center max-w-md mx-auto space-y-4">
                    <p className="text-slate-400 font-medium text-sm">
                      Nenhuma escola cadastrada ou encontrada.
                    </p>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Gostaria de carregar automaticamente as instituições de ensino já existentes na região (como IFPE, UFRPE/UABJ, ETE)?
                      </p>
                      <Button
                        type="button"
                        onClick={handleLoadDefaultSchools}
                        disabled={loadingSchools}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm px-4 py-2 gap-1.5 w-full"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                        Sim, Carregar Escolas Existentes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 md:p-4 space-y-3">
                    {paginatedSchools.map((school) => (
                      <div key={school.uid} className="relative overflow-hidden bg-white p-3.5 md:p-4 rounded-xl border border-slate-200/60 flex flex-col gap-3 transition-all hover:shadow-md hover:border-blue-200/80">
                        {/* Linha Superior: Título e Ações */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <h4 className="font-extrabold text-slate-800 text-sm md:text-base leading-tight break-words">{school.name}</h4>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                school.status === 'inactive' 
                                  ? 'bg-red-50 text-red-500 border border-red-100' 
                                  : 'bg-green-50 text-green-600 border border-green-100'
                              }`}>
                                {school.status === 'inactive' ? 'Inativa' : 'Ativa'}
                              </span>
                              <span className="bg-blue-50 text-blue-700 font-bold text-[9px] px-1.5 py-0.5 rounded border border-blue-100 font-mono">INEP: {school.inep}</span>
                              <span className="bg-slate-100 text-slate-600 font-bold text-[9px] px-1.5 py-0.5 rounded border border-slate-200">{school.city}</span>
                            </div>
                          </div>
                          
                          {/* Botões de Ação */}
                          <div className="flex items-center gap-1 shrink-0 bg-slate-50 p-1 rounded-lg border border-slate-100">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setEditingSchool(school);
                                setNewSchoolName(school.name);
                                setNewSchoolInep(school.inep);
                                setNewSchoolCity(school.city);
                                setSchoolAddress(school.address || '');
                                setSchoolLatitude(school.latitude !== undefined ? String(school.latitude) : '');
                                setSchoolLongitude(school.longitude !== undefined ? String(school.longitude) : '');
                                setSchoolPhone(school.phone || '');
                                setSchoolResponsible(school.responsible || '');
                                setSchoolArrivalTime(school.arrivalTime || '');
                                setSchoolDepartureTime(school.departureTime || '');
                                setSchoolIsActive(school.status !== 'inactive');
                              }}
                              className="w-7 h-7 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Editar Escola"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setSchoolToDelete(school)}
                              className="w-7 h-7 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Remover Escola"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Conteúdo Técnico */}
                        <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-2">
                          <p className="flex items-start gap-1.5 leading-tight">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="break-words">{school.address || 'Endereço não cadastrado'}</span>
                          </p>

                          <div className="flex flex-wrap gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                            <span className="flex items-center gap-1.5 text-blue-600 font-bold text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span>Entrada: {school.arrivalTime || '--:--'} • Saída: {school.departureTime || '--:--'}</span>
                            </span>
                          </div>
                        </div>

                        {/* Contatos / Responsáveis */}
                        {(school.phone || school.responsible) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500 pt-1">
                            {school.phone && (
                              <span className="flex items-center gap-1 font-medium bg-slate-100/55 px-2 py-0.5 rounded-full">
                                <Phone className="w-3.5 h-3.5 text-slate-400" /> {school.phone}
                              </span>
                            )}
                            {school.responsible && (
                              <span className="flex items-center gap-1 font-medium bg-slate-100/55 px-2 py-0.5 rounded-full">
                                <UserIcon className="w-3.5 h-3.5 text-slate-400" /> Resp: {school.responsible}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>

              {totalPages > 1 && (
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    disabled={schoolPage === 1}
                    onClick={() => setSchoolPage(prev => Math.max(1, prev - 1))}
                    className="rounded-lg h-8 px-3 text-xs"
                  >
                    Anterior
                  </Button>
                  <span>Página {schoolPage} de {totalPages}</span>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    disabled={schoolPage === totalPages}
                    onClick={() => setSchoolPage(prev => Math.min(totalPages, prev + 1))}
                    className="rounded-lg h-8 px-3 text-xs"
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </Card>
          </div>
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
                        maxLength={100}
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
                        maxLength={100}
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
                        maxLength={100}
                      />
                    </div>
                  </div>

                  {status && (
                    <div className={`p-4 rounded-xl flex items-start gap-3 border ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <ShieldCheck className="w-5 h-5 shrink-0" />}
                      <p className="text-xs font-medium leading-relaxed">{status.message}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      className="w-full h-11 md:h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-100"
                      disabled={registering}
                    >
                      {registering ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Salvar Motorista'}
                    </Button>
                  </div>
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
              <CardContent className="p-0 flex-1 min-h-0 max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                        <div className="flex items-center gap-1 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-300 hover:text-blue-600 hover:bg-blue-50 shrink-0"
                            onClick={() => {
                              setEditingDriver(driver);
                              setEditDriverName(driver.name || '');
                              setEditDriverEmail(driver.email || '');
                              setEditDriverPassword(driver.password || '');
                              setEditDriverStatus(null);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                            onClick={() => setDriverToDelete(driver)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
                <CardDescription className="text-slate-300 text-xs">
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
                        maxLength={100}
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
                        maxLength={100}
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
                        maxLength={100}
                      />
                    </div>
                  </div>

                  {adminStatus && (
                    <div className={`p-4 rounded-xl flex items-start gap-3 border ${adminStatus.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                      {adminStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />}
                      <p className="text-xs font-medium leading-relaxed">{adminStatus.message}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      className="w-full h-11 md:h-12 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl shadow-lg shadow-purple-100"
                      disabled={registeringAdmin}
                    >
                      {registeringAdmin ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Salvar Administrador'}
                    </Button>
                  </div>
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
              <CardContent className="p-0 flex-1 min-h-0 max-h-[500px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                         <div className="flex items-center gap-1 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-300 hover:text-blue-600 hover:bg-blue-50 shrink-0"
                            onClick={() => {
                              setEditingAdmin(adminUser);
                              setEditAdminName(adminUser.name || '');
                              setEditAdminEmail(adminUser.email || '');
                              setEditAdminPassword(adminUser.password || '');
                              setEditAdminStatus(null);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
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
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[92vw] sm:max-w-sm max-w-full">
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
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[92vw] sm:max-w-sm max-w-full">
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

      <Dialog open={!!schoolToDelete} onOpenChange={(open) => !open && setSchoolToDelete(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[92vw] sm:max-w-sm max-w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600">Excluir Escola?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-500 text-sm">
              Deseja realmente remover a escola <strong>{schoolToDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </p>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="outline" onClick={() => setSchoolToDelete(null)} className="h-12 rounded-xl font-bold border-slate-200">Cancelar</Button>
            <Button onClick={removeSchool} className="h-12 rounded-xl bg-red-600 font-black text-white hover:bg-red-700">REMOVER</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!clearAction} onOpenChange={(open) => !open && setClearAction(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[92vw] sm:max-w-sm max-w-full">
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

      {/* DIALOG DE EDITAR MOTORISTA */}
      <Dialog open={!!editingDriver} onOpenChange={(open) => !open && setEditingDriver(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[94vw] sm:max-w-md max-w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600 animate-pulse" />
              Editar Motorista
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Altere os dados do motorista. Modifique somente o dado que você desejar.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleUpdateDriver} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-driver-name" className="text-slate-700 font-bold text-xs md:text-sm">Nome Completo</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="edit-driver-name"
                  placeholder="Nome do motorista"
                  value={editDriverName}
                  onChange={(e) => setEditDriverName(e.target.value)}
                  className="pl-10 h-11 rounded-xl text-sm"
                  required
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-driver-email" className="text-slate-700 font-bold text-xs md:text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="edit-driver-email"
                  type="email"
                  placeholder="motorista@exemplo.com"
                  value={editDriverEmail}
                  onChange={(e) => setEditDriverEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl text-sm"
                  required
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-driver-password" className="text-slate-700 font-bold text-xs md:text-sm">Senha</Label>
              <div className="relative">
                <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="edit-driver-password"
                  type="text"
                  placeholder="Senha"
                  value={editDriverPassword}
                  onChange={(e) => setEditDriverPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl text-sm"
                  maxLength={100}
                />
              </div>
            </div>

            {editDriverStatus && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border ${editDriverStatus.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                {editDriverStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <ShieldCheck className="w-5 h-5 shrink-0" />}
                <p className="text-xs font-medium leading-relaxed">{editDriverStatus.message}</p>
              </div>
            )}

            <DialogFooter className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingDriver(null)} 
                className="h-12 rounded-xl font-bold border-slate-200"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updatingDriver}
                className="h-12 rounded-xl bg-blue-600 font-black text-white hover:bg-blue-700 shadow-md shadow-blue-100"
              >
                {updatingDriver ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'SALVAR'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE EDITAR ADMINISTRADOR */}
      <Dialog open={!!editingAdmin} onOpenChange={(open) => !open && setEditingAdmin(null)}>
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[94vw] sm:max-w-md max-w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600 animate-pulse" />
              Editar Administrador
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Altere os dados do administrador. Modifique somente o dado que você desejar.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleUpdateAdmin} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-admin-name" className="text-slate-700 font-bold text-xs md:text-sm">Nome Completo</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="edit-admin-name"
                  placeholder="Nome do administrador"
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  className="pl-10 h-11 rounded-xl text-sm"
                  required
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-admin-email" className="text-slate-700 font-bold text-xs md:text-sm">Email de Acesso</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="edit-admin-email"
                  type="email"
                  placeholder="admin@exemplo.com"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl text-sm"
                  required
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-admin-password" className="text-slate-700 font-bold text-xs md:text-sm">Senha de Acesso</Label>
              <div className="relative">
                <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="edit-admin-password"
                  type="text"
                  placeholder="Senha"
                  value={editAdminPassword}
                  onChange={(e) => setEditAdminPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl text-sm"
                  required
                  maxLength={100}
                />
              </div>
            </div>

            {editAdminStatus && (
              <div className={`p-4 rounded-xl flex items-start gap-3 border ${editAdminStatus.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                {editAdminStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />}
                <p className="text-xs font-medium leading-relaxed">{editAdminStatus.message}</p>
              </div>
            )}

            <DialogFooter className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingAdmin(null)} 
                className="h-12 rounded-xl font-bold border-slate-200"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updatingAdmin}
                className="h-12 rounded-xl bg-purple-700 hover:bg-purple-800 font-black text-white hover:bg-purple-900"
              >
                {updatingAdmin ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'SALVAR'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

