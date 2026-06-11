import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile, UserRole, ServiceType } from './types';
import DriverView from './components/DriverView';
import StudentView from './components/StudentView';
import DirectionView from './components/DirectionView';
import DriverAuth from './components/DriverAuth';
import DriverNameStep from './components/DriverNameStep';
import ServiceSelection from './components/ServiceSelection';
import { Button } from './components/ui/button';
import { Bus, LogIn, LogOut, User, Map as MapIcon, ShieldCheck, ChevronLeft, Settings, RefreshCw } from 'lucide-react';

const ADMIN_EMAIL = 'emerson0712002@gmail.com';

interface ServiceConfig {
  type: ServiceType;
  entity?: string;
}

import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { AccessibilityMenu } from './components/AccessibilityMenu';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingInAsDriver, setIsLoggingInAsDriver] = useState(false);
  const [hasStartedShift, setHasStartedShift] = useState(false);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'admin'>('map');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    // Carrega a configuração do serviço se houver
    const savedConfig = localStorage.getItem('service_config');
    if (savedConfig) {
      setServiceConfig(JSON.parse(savedConfig));
    }

    // Primeiro verifica se há um usuário salvo localmente
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      const u = JSON.parse(savedUser) as UserProfile;
      setUser(u);
      if (u.name) setHasStartedShift(true);
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          if (userData.email === ADMIN_EMAIL && userData.role !== 'driver') {
            const adminUpdate = { ...userData, role: 'driver' as UserRole };
            if (userData.name === 'Direção' || userData.name === 'Direção (emerson)') {
              adminUpdate.name = 'Administrador';
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), adminUpdate);
            setUser(adminUpdate);
          } else {
            let finalData = userData;
            if (userData.email === ADMIN_EMAIL && (userData.name === 'Direção' || userData.name === 'Direção (emerson)')) {
              finalData = { ...userData, name: 'Administrador' };
              await setDoc(doc(db, 'users', firebaseUser.uid), finalData);
            }
            setUser(finalData);
          }
          
          if (userData.name) {
            setHasStartedShift(true);
          }
        } else {
          const newUser: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '',
            role: firebaseUser.email === ADMIN_EMAIL ? 'driver' : 'student'
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
        setHasStartedShift(false);
      }
      setLoading(false);
    });
  }, []);

  const handleServiceSelect = (type: ServiceType, entity?: string) => {
    const config = { type, entity };
    setServiceConfig(config);
    localStorage.setItem('service_config', JSON.stringify(config));
  };

  const clearServiceConfig = () => {
    setServiceConfig(null);
    localStorage.removeItem('service_config');
  };

  const login = async (role: UserRole) => {
    if (role === 'driver') {
      setIsLoggingInAsDriver(true);
      return;
    }
    
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_user');
    await signOut(auth);
    setUser(null);
    setIsLoggingInAsDriver(false);
    setHasStartedShift(false);
  };

  const onAuthSuccess = (updatedUser: UserProfile) => {
    setUser(updatedUser);
    setIsLoggingInAsDriver(false);
    if (updatedUser.name) setHasStartedShift(true);
  };

  const onNameStepComplete = (updatedUser: UserProfile) => {
    setUser(updatedUser);
    setHasStartedShift(true);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Bus className="w-12 h-12 text-blue-600 animate-bounce" />
          <p className="text-muted-foreground font-medium">Carregando BusLocation...</p>
        </div>
      </div>
    );
  }

  const showSelection = !serviceConfig && !isLoggingInAsDriver && user?.role !== 'driver' && !(viewMode === 'admin' && isAdmin);

  return (
    <AccessibilityProvider>
      <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b shrink-0 z-50 sticky top-0">
        <div className="mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => !showSelection && !isAdmin && user?.role !== 'driver' && clearServiceConfig()}>
            <Bus className="w-8 h-8 text-blue-600" />
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight text-slate-900 leading-none">BusLocation</span>
              {serviceConfig && (
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                  {serviceConfig.type} {serviceConfig.entity ? `• ${serviceConfig.entity}` : ''}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            {isAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setViewMode(viewMode === 'map' ? 'admin' : 'map')} 
                className="gap-2 rounded-full font-bold border-2 border-purple-200 text-purple-600 hover:bg-purple-50"
              >
                {viewMode === 'map' ? <Settings className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                <span className="hidden sm:inline">{viewMode === 'map' ? 'Painel Admin' : 'Ver Mapa'}</span>
              </Button>
            )}

            {serviceConfig && user?.role !== 'driver' && (
              <Button variant="ghost" size="icon" onClick={clearServiceConfig} className="rounded-full text-slate-400 hover:text-blue-600" title="Trocar Serviço">
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}

            <AccessibilityMenu />
            
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-700">{user.name || (isAdmin ? 'Administrador' : 'Motorista')}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isAdmin ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}`}>
                    {isAdmin ? 'Admin' : (user.role === 'driver' ? 'Motorista' : 'Aluno')}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="rounded-full hover:bg-red-50 hover:text-red-500">
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            ) : (
              !isLoggingInAsDriver && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsLoggingInAsDriver(true)}
                  className="gap-2 rounded-full font-bold border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Acesso</span>
                </Button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        <div className={`flex-1 flex flex-col relative ${viewMode !== 'admin' || !isAdmin ? 'h-[calc(100vh-4rem)] overflow-hidden' : ''}`}>
          {showSelection ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <ServiceSelection onSelect={handleServiceSelect} onDriverAccessClick={() => setIsLoggingInAsDriver(true)} />
            </div>
          ) : !user && isLoggingInAsDriver ? (
            <div className="space-y-4 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <Button 
                variant="ghost" 
                onClick={() => setIsLoggingInAsDriver(false)}
                className="gap-2 text-slate-500 font-bold hover:text-blue-600"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar para o Mapa
              </Button>
              <div className="max-w-md mx-auto">
                <DriverAuth onAuthSuccess={onAuthSuccess} />
              </div>
            </div>
          ) : user?.role === 'driver' ? (
            !hasStartedShift ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <DriverNameStep user={user} onComplete={onNameStepComplete} serviceConfig={serviceConfig || undefined} />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden relative">
                <DriverView user={user} serviceConfig={serviceConfig || undefined} />
              </div>
            )
          ) : viewMode === 'admin' && isAdmin ? (
            <div className="flex-1 px-2 md:px-6 py-6 scroll-smooth">
              <div className="max-w-7xl mx-auto">
                <DirectionView serviceConfig={serviceConfig || undefined} />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden relative">
              <StudentView serviceType={serviceConfig?.type} entityName={serviceConfig?.entity} />
            </div>
          )}
        </div>
      </main>

      {!user?.role && (
        <footer className="py-4 text-center text-slate-400 text-[10px] border-t border-slate-100 bg-white">
          <p className="font-bold text-slate-500">&copy; 2026 BusBJ - Belo Jardim, PE</p>
        </footer>
      )}
    </div>
    </AccessibilityProvider>
  );
}
