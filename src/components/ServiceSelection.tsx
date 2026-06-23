import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bus, GraduationCap, CarFront, ChevronRight, MapPin, Building2, Search, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { ServiceType } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { PREDEFINED_ENTITIES } from '../constants';

const normalizeCityNameForGroup = (name: string): string => {
  if (!name) return 'Belo Jardim - PE';
  let cleaned = name.trim();
  
  // Substituir espaços múltiplos por um só
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Padronizar Belo Jardim e suas variações comuns para "Belo Jardim - PE"
  const lower = cleaned.toLowerCase();
  if (lower === 'belo jardim' || lower === 'belo jardim - pe' || lower === 'belo jardim-pe') {
    return 'Belo Jardim - PE';
  }
  
  // Para outras cidades, padronizar para Title Case preservando siglas de estado em maiúsculas
  return cleaned
    .split(/\s+/)
    .map(word => {
      const wordUpper = word.toUpperCase();
      if (['PE', 'SP', 'RJ', 'MG', 'BA', 'PB', 'AL', 'RN', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'PA', 'PI', 'PR', 'SE', 'TO', 'SC', 'RS', 'RO', 'AC', 'AM', 'AP', 'RR'].includes(wordUpper)) {
        return wordUpper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

interface ServiceSelectionProps {
  onSelect: (type: ServiceType, entity?: string) => void;
  onDriverAccessClick?: () => void;
  onAdminAccessClick?: () => void;
}

export default function ServiceSelection({ onSelect, onDriverAccessClick, onAdminAccessClick }: ServiceSelectionProps) {
  const [step, setStep] = useState<'type' | 'city' | 'entity'>('type');
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);
  const [schools, setSchools] = useState<{ name: string; city: string; status: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [entities, setEntities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [citySearchTerm, setCitySearchTerm] = useState('');

  const services = [
    { 
      id: 'escolar' as ServiceType, 
      title: 'Transporte Escolar', 
      desc: 'Rotas exclusivas para escolas, faculdades e institutos', 
      icon: GraduationCap,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    },
    { 
      id: 'outros' as ServiceType, 
      title: 'Outros Serviços', 
      desc: 'Táxi, Moto Táxi e transportes alternativos', 
      icon: CarFront,
      color: 'bg-amber-50 text-amber-600 border-amber-100'
    }
  ];

  const handleTypeSelect = async (type: ServiceType) => {
    setSelectedType(type);
    setSearchTerm('');
    setCitySearchTerm('');
    
    setLoading(true);
    if (type === 'escolar') {
      setStep('city');
      try {
        // Buscar escolas do banco de dados
        const qSchools = query(collection(db, 'schools'));
        const snapshot = await getDocs(qSchools);
        const schoolsList: any[] = [];
        const uniqueCities = new Set<string>();

        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.status !== 'inactive') {
            const cityName = normalizeCityNameForGroup(data.city);
            schoolsList.push({
              name: data.name,
              city: cityName,
              status: data.status || 'active'
            });
            uniqueCities.add(cityName);
          }
        });

        // Complementar com outras rotas do banco
        const qRoutes = query(collection(db, 'routes'), where('serviceType', '==', 'escolar'));
        const routesSnap = await getDocs(qRoutes);
        routesSnap.forEach(doc => {
          const data = doc.data();
          if (data.entityName) {
            const exists = schoolsList.some(s => s.name.toLowerCase() === data.entityName.toLowerCase());
            if (!exists) {
              const cityName = 'Belo Jardim - PE';
              schoolsList.push({
                name: data.entityName,
                city: cityName,
                status: 'active'
              });
              uniqueCities.add(cityName);
            }
          }
        });

        // Fallback para predefinidos
        if (schoolsList.length === 0) {
          PREDEFINED_ENTITIES.escolar.forEach(name => {
            const cityName = 'Belo Jardim - PE';
            schoolsList.push({
              name,
              city: cityName,
              status: 'active'
            });
            uniqueCities.add(cityName);
          });
        }

        setSchools(schoolsList);
        setCities(Array.from(uniqueCities).sort());
      } catch (err) {
        console.error("Erro buscando escolas/cidades:", err);
        // Fallback
        const fallbackList = PREDEFINED_ENTITIES.escolar.map(name => ({
          name,
          city: 'Belo Jardim - PE',
          status: 'active'
        }));
        setSchools(fallbackList);
        setCities(['Belo Jardim - PE']);
      } finally {
        setLoading(false);
      }
    } else {
      // Go straight to entity choice for 'outros'
      setStep('entity');
      try {
        const q = query(collection(db, 'routes'), where('serviceType', '==', 'outros'));
        const snapshot = await getDocs(q);
        const uniqueEntities = new Set<string>(PREDEFINED_ENTITIES.outros || []);
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.entityName) uniqueEntities.add(data.entityName);
        });
        setEntities(Array.from(uniqueEntities).sort());
      } catch (err) {
        console.error("Erro carregando outros serviços:", err);
        setEntities(PREDEFINED_ENTITIES.outros || []);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    // Filtrar escolas pertencentes à cidade selecionada comparando valores normalizados
    const selectedCityNorm = normalizeCityNameForGroup(city).toLowerCase();
    const filtered = schools
      .filter(s => normalizeCityNameForGroup(s.city).toLowerCase() === selectedCityNorm && s.status !== 'inactive')
      .map(s => s.name);
    
    setEntities(filtered);
    setStep('entity');
  };

  const filteredCities = cities.filter(c =>
    c.toLowerCase().includes(citySearchTerm.toLowerCase())
  );

  const filteredEntities = entities.filter(e => 
    e.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 md:py-8" id="service-selection-wrapper">
      <AnimatePresence mode="wait">
        {step === 'type' && (
          <motion.div
            key="type-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4 md:space-y-6"
            id="type-selection-container"
          >
            <div className="text-center space-y-1 md:space-y-2">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">Bem-vindo ao BusLocation</h1>
              <p className="text-slate-500 text-sm md:text-base">O que você deseja rastrear hoje?</p>
            </div>

            <div className="grid gap-3 md:gap-4">
              {services.map((service) => (
                <button
                  key={service.id}
                  id={`service-${service.id}`}
                  onClick={() => handleTypeSelect(service.id)}
                  className={`flex items-center gap-3 md:gap-4 p-4 md:p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-left group ${service.color} hover:bg-white hover:border-current`}
                >
                  <div className="p-2.5 md:p-3 rounded-xl bg-white shadow-sm group-hover:shadow-md transition-all shrink-0">
                    <service.icon className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base md:text-lg truncate">{service.title}</h3>
                    <p className="text-xs md:text-sm opacity-80 line-clamp-1">{service.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 opacity-40 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>

            {onDriverAccessClick && (
              <div className="pt-6 border-t border-slate-100 flex flex-col items-center gap-3" id="driver-access-container">
                <span className="text-xs text-slate-400 font-extrabold uppercase tracking-widest">Painel Operacional</span>
                
                {/* BIG PROMINENT BUTTON FOR MOTORISTA */}
                <button
                  id="driver-access-button"
                  type="button"
                  onClick={onDriverAccessClick}
                  className="w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black hover:shadow-lg hover:shadow-blue-100 transition-all hover:scale-[1.01] active:scale-[0.99] group flex items-center justify-between cursor-pointer border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl text-white">
                      <Bus className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="text-left">
                      <p className="text-lg font-extrabold tracking-tight">Sou Motorista</p>
                      <p className="text-xs text-blue-100 font-normal opacity-90">Iniciar rota de transporte em tempo real</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/80 group-hover:text-white transition-all shrink-0" />
                </button>

                {/* DISCREET LINK FOR DIREÇÃO */}
                {onAdminAccessClick && (
                  <button
                    id="admin-access-button"
                    type="button"
                    onClick={onAdminAccessClick}
                    className="mt-2 text-slate-400 hover:text-purple-600 text-xs font-semibold py-1.5 px-4 rounded-full hover:bg-slate-100 transition-all flex items-center gap-1.5 select-none cursor-pointer border border-transparent hover:border-slate-200"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
                    <span>Acesso da Direção (Administrativo)</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {step === 'city' && (
          <motion.div
            key="city-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 md:space-y-6"
            id="city-selection-container"
          >
            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                id="back-to-type-button"
                onClick={() => setStep('type')}
                className="rounded-full h-8 w-8 md:h-10 md:w-10 shrink-0"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 truncate">
                  Selecione sua Região/Cidade
                </h1>
                <p className="text-slate-500 text-xs md:text-sm">Filtre as instituições de ensino pela sua localidade</p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 md:top-3 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
              <input 
                id="city-search"
                type="text" 
                placeholder="Pesquisar cidade..."
                className="w-full pl-9 pr-4 py-2 md:py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-sm md:text-base shadow-sm"
                value={citySearchTerm}
                onChange={(e) => setCitySearchTerm(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="py-10 md:py-20 text-center space-y-4" id="city-loading">
                <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 font-medium text-sm">Buscando regiões...</p>
              </div>
            ) : filteredCities.length === 0 ? (
              <div className="py-10 md:py-20 text-center space-y-4 bg-white rounded-2xl border-2 border-dashed border-slate-100 p-4" id="city-empty">
                <MapPin className="w-10 h-10 md:w-12 md:h-12 text-slate-200 mx-auto" />
                <div className="space-y-1">
                  <p className="text-slate-500 font-bold text-sm md:text-base">Nenhuma cidade localizada</p>
                  <p className="text-slate-400 text-[10px] md:text-xs">Não encontramos nenhuma cidade com escolas ativas cadastradas.</p>
                </div>
                <Button variant="ghost" onClick={() => setStep('type')} className="text-blue-600 font-bold text-xs md:text-sm">
                  Voltar ao início
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 md:gap-3" id="cities-list">
                {filteredCities.map((city) => (
                  <button
                    key={city}
                    id={`city-${city.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => handleCitySelect(city)}
                    className="flex items-center justify-between p-3.5 md:p-5 bg-white border-2 border-slate-50 hover:border-emerald-500 rounded-xl hover:shadow-sm transition-all group text-left"
                  >
                    <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                      <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg group-hover:bg-emerald-50 transition-colors shrink-0">
                        <MapPin className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 group-hover:text-emerald-600" />
                      </div>
                      <div className="overflow-hidden">
                        <span className="font-bold text-slate-800 text-sm md:text-base block truncate">{city}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {schools.filter(s => s.city.toLowerCase() === city.toLowerCase() && s.status !== 'inactive').length} escola(s) disponível(is)
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-300 group-hover:text-emerald-500 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {step === 'entity' && (
          <motion.div
            key="entity-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 md:space-y-6"
            id="entity-selection-container"
          >
            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                id="back-to-previous-step"
                onClick={() => selectedType === 'escolar' ? setStep('city') : setStep('type')}
                className="rounded-full h-8 w-8 md:h-10 md:w-10 shrink-0"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 truncate">
                  {selectedType === 'escolar' ? 'Selecione a Escola' : 'Selecione o Serviço'}
                </h1>
                <p className="text-slate-500 text-xs md:text-sm">
                  {selectedType === 'escolar' ? `Exibindo escolas em ${selectedCity}` : 'Selecione um dos serviços disponíveis para iniciar o rastreamento'}
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 md:top-3 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
              <input 
                id="entity-search"
                type="text" 
                placeholder="Pesquisar..."
                className="w-full pl-9 pr-4 py-2 md:py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-sm md:text-base shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="py-10 md:py-20 text-center space-y-4" id="entity-loading">
                <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 font-medium text-sm">Buscando opções...</p>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="py-10 md:py-20 text-center space-y-4 bg-white rounded-2xl border-2 border-dashed border-slate-100 p-4" id="entity-empty">
                <Building2 className="w-10 h-10 md:w-12 md:h-12 text-slate-200 mx-auto" />
                <div className="space-y-1">
                  <p className="text-slate-500 font-bold text-sm md:text-base">Nenhum registro encontrado</p>
                  <p className="text-slate-400 text-[10px] md:text-xs">Ainda não há {selectedType === 'escolar' ? 'escolas' : 'serviços'} cadastrados para este serviço nesta localidade.</p>
                </div>
                <Button variant="ghost" onClick={() => selectedType === 'escolar' ? setStep('city') : setStep('type')} className="text-blue-600 font-bold text-xs md:text-sm">
                  Voltar e selecionar outra região
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 md:gap-3" id="entities-list">
                {filteredEntities.map((entity) => (
                  <button
                    key={entity}
                    id={`entity-${entity.replace(/\s+/g, '-').toLowerCase()}`}
                    onClick={() => onSelect(selectedType!, entity)}
                    className="flex items-center justify-between p-3.5 md:p-5 bg-white border-2 border-slate-50 rounded-xl hover:border-blue-500 hover:shadow-sm transition-all group text-left"
                  >
                    <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                      <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors shrink-0">
                        {selectedType === 'escolar' ? <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-blue-500" /> :
                         <CarFront className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-blue-500" />}
                      </div>
                      <div className="overflow-hidden">
                        <span className="font-bold text-slate-700 text-sm md:text-base block truncate">{entity}</span>
                        {selectedType === 'escolar' && selectedCity && (
                          <span className="text-[10px] text-slate-400 font-mono">{selectedCity}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-300 group-hover:text-blue-500 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
