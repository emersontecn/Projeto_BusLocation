import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bus, GraduationCap, CarFront, ChevronRight, MapPin, Building2, Search, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ServiceType } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { PREDEFINED_ENTITIES } from '../constants';

interface ServiceSelectionProps {
  onSelect: (type: ServiceType, entity?: string) => void;
  onDriverAccessClick?: () => void;
  onAdminAccessClick?: () => void;
}

export default function ServiceSelection({ onSelect, onDriverAccessClick, onAdminAccessClick }: ServiceSelectionProps) {
  const [step, setStep] = useState<'type' | 'entity'>('type');
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);
  const [entities, setEntities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const services = [
    { 
      id: 'escolar' as ServiceType, 
      title: 'Transporte Escolar', 
      desc: 'Rotas exclusivas para escolas e faculdades', 
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
    
    setLoading(true);
    setStep('entity');
    try {
      // Find all unique entityNames for this serviceType in routes
      const q = query(collection(db, 'routes'), where('serviceType', '==', type));
      const snapshot = await getDocs(q);
      const uniqueEntities = new Set<string>(PREDEFINED_ENTITIES[type] || []);
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.entityName) uniqueEntities.add(data.entityName);
      });
      setEntities(Array.from(uniqueEntities).sort());
    } catch (err) {
      console.error("Error fetching entities:", err);
      // Fallback to predefined if Firestore fails
      setEntities(PREDEFINED_ENTITIES[type] || []);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntities = entities.filter(e => 
    e.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 md:py-8">
      <AnimatePresence mode="wait">
        {step === 'type' ? (
          <motion.div
            key="type-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4 md:space-y-6"
          >
            <div className="text-center space-y-1 md:space-y-2">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">Bem-vindo ao BusLocation</h1>
              <p className="text-slate-500 text-sm md:text-base">O que você deseja rastrear hoje?</p>
            </div>

            <div className="grid gap-3 md:gap-4">
              {services.map((service) => (
                <button
                  key={service.id}
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
              <div className="pt-6 border-t border-slate-100 flex flex-col items-center gap-3">
                <span className="text-xs text-slate-400 font-extrabold uppercase tracking-widest">Painel Operacional</span>
                
                {/* BIG PROMINENT BUTTON FOR MOTORISTA */}
                <button
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
        ) : (
          <motion.div
            key="entity-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 md:space-y-6"
          >
            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setStep('type')}
                className="rounded-full h-8 w-8 md:h-10 md:w-10 shrink-0"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 truncate">
                  {selectedType === 'escolar' ? 'Selecione a Escola' : 'Selecione o Serviço'}
                </h1>
                <p className="text-slate-500 text-xs md:text-sm">Quase lá...</p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 md:top-3 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Pesquisar..."
                className="w-full pl-9 pr-4 py-2 md:py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none transition-all text-sm md:text-base shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="py-10 md:py-20 text-center space-y-4">
                <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 font-medium text-sm">Buscando opções...</p>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="py-10 md:py-20 text-center space-y-4 bg-white rounded-2xl border-2 border-dashed border-slate-100 p-4">
                <Building2 className="w-10 h-10 md:w-12 md:h-12 text-slate-200 mx-auto" />
                <div className="space-y-1">
                  <p className="text-slate-500 font-bold text-sm md:text-base">Nenhum registro encontrado</p>
                  <p className="text-slate-400 text-[10px] md:text-xs">Ainda não há {selectedType === 'escolar' ? 'escolas' : 'serviços'} cadastrados para este serviço.</p>
                </div>
                <Button variant="ghost" onClick={() => setStep('type')} className="text-blue-600 font-bold text-xs md:text-sm">
                  Tentar outro serviço
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 md:gap-3">
                {filteredEntities.map((entity) => (
                  <button
                    key={entity}
                    onClick={() => onSelect(selectedType!, entity)}
                    className="flex items-center justify-between p-3.5 md:p-5 bg-white border-2 border-slate-50 rounded-xl hover:border-blue-500 hover:shadow-sm transition-all group text-left"
                  >
                    <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                      <div className="p-1.5 md:p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors shrink-0">
                        {selectedType === 'escolar' ? <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-blue-500" /> :
                         <CarFront className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-blue-500" />}
                      </div>
                      <span className="font-bold text-slate-700 text-sm md:text-base truncate">{entity}</span>
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
