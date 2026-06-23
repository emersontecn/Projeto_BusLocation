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
import { Bus, LogIn, LogOut, User, Map as MapIcon, ShieldCheck, ChevronLeft, Settings, RefreshCw, HelpCircle, GraduationCap, Map, BookOpen, Clock, Shield, Plus, Sparkles, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/dialog';

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
  const [authRole, setAuthRole] = useState<'driver' | 'admin' | null>(null);
  const [hasStartedShift, setHasStartedShift] = useState(false);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'admin'>('map');
  const [showAdminHelp, setShowAdminHelp] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'geral' | 'rotas' | 'dicas'>('geral');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (user?.role === 'admin') {
      setViewMode('admin');
    }
  }, [user]);

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
          if (userData.email === ADMIN_EMAIL && userData.role !== 'admin') {
            const adminUpdate = { ...userData, role: 'admin' as UserRole };
            if (userData.name === 'Direção' || userData.name === 'Direção (emerson)' || !userData.name) {
              adminUpdate.name = 'Administrador';
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), adminUpdate);
            setUser(adminUpdate);
          } else {
            let finalData = userData;
            if (userData.email === ADMIN_EMAIL && (userData.name === 'Direção' || userData.name === 'Direção (emerson)' || !userData.name)) {
              finalData = { ...userData, name: 'Administrador' };
              await setDoc(doc(db, 'users', firebaseUser.uid), finalData);
            }
            setUser(finalData);
          }
          
          if (userData.name && userData.role === 'driver') {
            setHasStartedShift(true);
          }
        } else {
          const newUser: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'Administrador',
            role: firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'student'
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
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setViewMode(viewMode === 'map' ? 'admin' : 'map')} 
                  className="gap-2 rounded-full font-bold border-2 border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  {viewMode === 'map' ? <Settings className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
                  <span className="hidden sm:inline">{viewMode === 'map' ? 'Painel Admin' : 'Ver Mapa'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAdminHelp(true)}
                  className="w-8 h-8 md:w-9 md:h-9 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50 flex items-center justify-center font-black shadow-sm shrink-0"
                  title="Ajuda do Painel"
                >
                  <HelpCircle className="w-4 h-4 md:w-5 md:h-5 text-purple-600 animate-pulse" />
                </Button>
              </div>
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
                  onClick={() => {
                    setAuthRole('admin');
                    setIsLoggingInAsDriver(true);
                  }}
                  className="gap-2 rounded-full font-bold border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Acesso da Direção</span>
                </Button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        <div className={`flex-1 flex flex-col relative ${viewMode !== 'admin' || !isAdmin ? 'h-[calc(100dvh-4rem)] overflow-hidden' : ''}`}>
          {showSelection ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <ServiceSelection 
                onSelect={handleServiceSelect} 
                onDriverAccessClick={() => {
                  setAuthRole('driver');
                  setIsLoggingInAsDriver(true);
                }}
                onAdminAccessClick={() => {
                  setAuthRole('admin');
                  setIsLoggingInAsDriver(true);
                }}
              />
            </div>
          ) : !user && isLoggingInAsDriver ? (
            <div className="space-y-4 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setIsLoggingInAsDriver(false);
                  setAuthRole(null);
                }}
                className="gap-2 text-slate-500 font-bold hover:text-blue-600"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar para o Mapa
              </Button>
              <div className="max-w-xl mx-auto">
                <DriverAuth 
                  initialRole={authRole} 
                  onAuthSuccess={onAuthSuccess} 
                  onBack={() => {
                    setIsLoggingInAsDriver(false);
                    setAuthRole(null);
                  }}
                />
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

      {/* DIALOG DE AJUDA DO PAINEL ADMIN */}
      <Dialog open={showAdminHelp} onOpenChange={setShowAdminHelp}>
        <DialogContent className="rounded-2xl sm:rounded-3xl border-none shadow-2xl w-[92vw] sm:max-w-2xl max-w-full max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-5 sm:p-7 bg-white">
          <DialogHeader className="pb-2 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-purple-600 animate-pulse" />
              Central de Ajuda Admin
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-500 font-medium pt-1">
              Saiba como gerenciar motoristas, rotas, paradas e aproveitar ao máximo o painel administrativo.
            </DialogDescription>
          </DialogHeader>

          {/* Sub-tabs Seletores */}
          <div className="flex border-b border-slate-100 mt-2 shrink-0">
            <button
              onClick={() => setActiveHelpTab('geral')}
              className={`flex-1 py-2 text-center text-[10px] sm:text-xs font-bold transition-all border-b-2 uppercase tracking-wider ${
                activeHelpTab === 'geral'
                  ? 'border-purple-600 text-purple-600 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Geral & FAQ
            </button>
            <button
              onClick={() => setActiveHelpTab('rotas')}
              className={`flex-1 py-2 text-center text-[10px] sm:text-xs font-bold transition-all border-b-2 uppercase tracking-wider ${
                activeHelpTab === 'rotas'
                  ? 'border-purple-600 text-purple-600 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Criar & Editar Rotas
            </button>
            <button
              onClick={() => setActiveHelpTab('dicas')}
              className={`flex-1 py-2 text-center text-[10px] sm:text-xs font-bold transition-all border-b-2 uppercase tracking-wider ${
                activeHelpTab === 'dicas'
                  ? 'border-purple-600 text-purple-600 font-black'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Dicas de Controle
            </button>
          </div>

          <div className="space-y-6 py-4">
            {activeHelpTab === 'geral' && (
              <>
                {/* Guia de Funcionalidades */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-purple-600 tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Guia de Recursos
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex gap-3 text-left">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-600 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">Motoristas</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Gerencie quem dirige cada veículo. Cadastre novos motoristas com e-mail, senha e nome. Eles farão login no app móvel para iniciar o envio de sinal.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3 text-left">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 shrink-0">
                        <Map className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">Rotas</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Crie trajetos, determine seus horários principais, e ordene as paradas no mapa interativo para que os estudantes possam planejar suas esperas.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex gap-3 text-left">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-amber-600 shrink-0">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">Escolas</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Defina os polos de destino (Escolas, Faculdades, Destinos) onde os estudantes desembarcam, associando os turnos (Manhã, Tarde ou Noite).
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex gap-3 text-left">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center font-bold text-slate-600 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">Histórico</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Audite o registro de turnos concluídos, horários de início e término e histórico de movimentações dos ônibus no sistema.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FAQs */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black uppercase text-purple-600 tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Respostas para dúvidas comuns (FAQ)
                  </h3>

                  <div className="space-y-3.5">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 text-left">
                      <h4 className="font-black text-xs md:text-sm text-slate-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
                        Como o motorista começa a enviar a localização?
                      </h4>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-3 border-l-2 border-purple-200">
                        O motorista deve logar com o e-mail e a senha que você cadastrou no painel administrativo, preencher seu nome/turno se solicitado, selecionar a rota e pressionar <strong>"Iniciar Turno"</strong>. O GPS do aparelho celular dele passará a enviar as coordenadas em tempo real.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 text-left">
                      <h4 className="font-black text-xs md:text-sm text-slate-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
                        O sinal do ônibus parou de atualizar no mapa. O que fazer?
                      </h4>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-3 border-l-2 border-purple-200">
                        Peça ao motorista para verificar se a internet do celular dele está ativa, se o sinal de GPS do aparelho está ligado e se o app BusLocation tem permissão concedida de "Sempre Permitir Localização" nas configurações do smartphone.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 text-left">
                      <h4 className="font-black text-xs md:text-sm text-slate-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
                        Como os alunos conseguem visualizar o veículo?
                      </h4>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed pl-3 border-l-2 border-purple-200">
                        Os alunos utilizam a tela inicial do app para escolher se querem estudar ou rastrear rotas. Eles selecionam o tipo de serviço que desejam e visualizam instantaneamente o traçado das rotas no mapa, além do ônibus ativo se movendo em tempo real nas paradas indicadas.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeHelpTab === 'rotas' && (
              <div className="space-y-4 text-left">
                <h3 className="text-xs font-black uppercase text-purple-600 tracking-wider flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5" />
                  Manual Interativo de Gestão de Rotas
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed">
                  As rotas do sistema guiam os trajetos dos ônibus. Elas são formadas por uma sequência ordenada de paradas (Pontos de Parada) marcadas livremente por você diretamente no mapa.
                </p>

                <div className="relative border-l border-slate-100 pl-4 ml-2 space-y-5">
                  {/* Passo 1 */}
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0 flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-[10px] font-black text-white">1</span>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight font-sans">Criar uma Nova Rota</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      No card <strong>"Gestão de Rotas"</strong>, clique no botão <strong className="text-blue-600 text-sm">+</strong> superior. Escolha o tipo de serviço (<strong className="text-indigo-600">Universitário</strong> ou <strong className="text-amber-600">Escolar</strong>), digite a instituição de destino (ex: <em>"AESA"</em>, <em>"IFPE"</em> ou <em>"Escolas Municipais"</em>) e dê um nome descritivo para a rota. Clique em <strong>"Criar Rota"</strong>.
                    </p>
                  </div>

                  {/* Passo 2 */}
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0 flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-[10px] font-black text-white">2</span>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight font-sans">Selecionar e Visualizar</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Escolha a rota recém-criada no menu de seleção. O mapa focará automaticamente no epicentro da rota. Se ela ainda não possuir paradas, ela aparecerá vazia.
                    </p>
                  </div>

                  {/* Passo 3 */}
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0 flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-[10px] font-black text-white">3</span>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight font-sans">Marcar Pontos de Parada (Paradas)</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Clique no ícone de <strong className="text-blue-600 font-black">+</strong> verde na seção <strong>"Pontos de Parada"</strong> para ativar o modo de adição de paradas. Agora, <strong>toque ou clique no mapa exatamente no local da parada desejada</strong>.
                    </p>
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg mt-1.5 text-[11px] text-slate-500 flex flex-nowrap items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                      <span><strong>Dica Inteligente:</strong> Ao clicar no mapa, o sistema realiza uma busca de endereço automática (reversa). Ele preencherá o CEP e o nome da rua para você. Basta ajustar o nome do ponto e a previsão de horário!</span>
                    </div>
                  </div>

                  {/* Passo 4 */}
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0 flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-[10px] font-black text-white">4</span>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight font-sans font-sans">Salvar e traçar o Caminho</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Insira o nome amigável do ponto (ex: <em>"Praça do Jardim"</em>), o horário estimado de passagem e clique em <strong>"Salvar Parada"</strong>. O sistema traçará imediatamente o trajeto rodoviário real entre o ponto anterior e o novo ponto!
                    </p>
                  </div>

                  {/* Passo 5 */}
                  <div className="relative">
                    <span className="absolute -left-[21px] top-0 flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-[10px] font-black text-white">5</span>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight font-sans">Exclusão e Limpeza</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Adicione quantos pontos desejar na sequência correta de paradas. Se errar alguma parada, clique na lixeirinha vermelha ao lado dela na lista para removê-la. Para excluir a rota completa, clique em <strong>"Excluir Rota"</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeHelpTab === 'dicas' && (
              <div className="space-y-4 text-left">
                <h3 className="text-xs font-black uppercase text-purple-600 tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Dicas e Boas Práticas de Administração
                </h3>

                <div className="space-y-3.5">
                  <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 space-y-1.5">
                    <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                      Importação Inteligente de Escolas de Belo Jardim
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Se você ainda não cadastrou destinos ou deseja preencher rapidamente, clique no botão <strong>"Importar Escolas Já Existentes"</strong> no topo da aba de Escolas. Isso criará de forma automática e instantânea o <strong>IFPE</strong>, a <strong>UFRPE/UABJ</strong> e a <strong>ETE</strong> da região, completas com turnos, telefones e responsáveis!
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100 space-y-1.5">
                    <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-blue-600 shrink-0" />
                      Organização Adaptativa para Smartphones (Modo Foco)
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      O painel executivo para Estudantes e Motoristas foi simplificado e estruturado no <strong>Modo Foco</strong>. Ao abrir em dispositivos celulares, os botões e detalhes secundários fecham automaticamente ao selecionar uma rota para expandir a área ativa do mapa, garantindo visibilidade total sem barras de rolagem excessivas.
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-100 space-y-1.5">
                    <h4 className="font-bold text-slate-800 text-xs md:text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      Histórico e Conclusão de Turnos
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Sempre que os motoristas clicam em <strong>"Finalizar Turno"</strong>, um registro consolidado é guardado nos logs. Você pode auditar o horário exato de término e o trajeto percorrido para calcular estimativas operacionais do transporte coletivo.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
            <Button 
              onClick={() => setShowAdminHelp(false)} 
              className="bg-purple-600 text-white hover:bg-purple-700 font-bold rounded-xl px-5 py-2.5 shadow-md w-full sm:w-auto"
            >
              Entendido!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {!user?.role && (
        <footer className="py-4 text-center text-slate-400 text-[10px] border-t border-slate-100 bg-white">
          <p className="font-bold text-slate-500">&copy; 2026 BusBJ - Belo Jardim, PE</p>
        </footer>
      )}
    </div>
    </AccessibilityProvider>
  );
}
