import React from 'react';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Accessibility, Eye, Type, Move, Palette, Speaker, Info, Moon, Ghost } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

export function AccessibilityMenu() {
  const { settings, updateSetting } = useAccessibility();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full w-8 h-8 md:w-9 md:h-9 border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all"
          title="Acessibilidade"
        >
          <Accessibility className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-xl">
            <Accessibility className="w-6 h-6 text-blue-600" />
            Acessibilidade
          </DialogTitle>
          <DialogDescription>
            Personalize sua experiência para uma navegação mais confortável e inclusiva.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Visual e Cores</h4>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Eye className="w-5 h-5 text-slate-600" />
                </div>
                <div className="space-y-0.5">
                  <Label className="font-bold cursor-pointer" htmlFor="highContrast">Alto Contraste</Label>
                  <p className="text-xs text-slate-500">Melhora a visibilidade das cores.</p>
                </div>
              </div>
              <Switch 
                id="highContrast"
                checked={settings.highContrast} 
                onCheckedChange={(val) => updateSetting('highContrast', val)} 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Palette className="w-5 h-5 text-slate-600" />
                </div>
                <div className="space-y-0.5">
                  <Label className="font-bold cursor-pointer" htmlFor="accessibleColors">Cores Acessíveis</Label>
                  <p className="text-xs text-slate-500">Otimizado para daltonismo.</p>
                </div>
              </div>
              <Switch 
                id="accessibleColors"
                checked={settings.accessibleColors} 
                onCheckedChange={(val) => updateSetting('accessibleColors', val)} 
              />
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipografia e Texto</h4>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Type className="w-5 h-5 text-slate-600" />
                </div>
                <div className="space-y-0.5">
                  <Label className="font-bold cursor-pointer" htmlFor="largeFonts">Fontes Maiores</Label>
                  <p className="text-xs text-slate-500">Aumenta o tamanho dos textos.</p>
                </div>
              </div>
              <Switch 
                id="largeFonts"
                checked={settings.largeFonts} 
                onCheckedChange={(val) => updateSetting('largeFonts', val)} 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Ghost className="w-5 h-5 text-slate-600" />
                </div>
                <div className="space-y-0.5">
                  <Label className="font-bold cursor-pointer" htmlFor="dyslexicFont">Fonte para Dislexia</Label>
                  <p className="text-xs text-slate-500">Melhora a legibilidade para disléxicos.</p>
                </div>
              </div>
              <Switch 
                id="dyslexicFont"
                checked={settings.dyslexicFont} 
                onCheckedChange={(val) => updateSetting('dyslexicFont', val)} 
              />
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Interação e Navegação</h4>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Move className="w-5 h-5 text-slate-600" />
                </div>
                <div className="space-y-0.5">
                  <Label className="font-bold cursor-pointer" htmlFor="reducedMotion">Reduzir Movimento</Label>
                  <p className="text-xs text-slate-500">Desativa as animações da interface.</p>
                </div>
              </div>
              <Switch 
                id="reducedMotion"
                checked={settings.reducedMotion} 
                onCheckedChange={(val) => updateSetting('reducedMotion', val)} 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-xl">
                  <Speaker className="w-5 h-5 text-slate-600" />
                </div>
                <div className="space-y-0.5">
                  <Label className="font-bold cursor-pointer" htmlFor="screenReader">Otimizar p/ Leitor de Tela</Label>
                  <p className="text-xs text-slate-500">Melhora descrições e foco do teclado.</p>
                </div>
              </div>
              <Switch 
                id="screenReader"
                checked={settings.screenReader} 
                onCheckedChange={(val) => updateSetting('screenReader', val)} 
              />
            </div>
          </section>

          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
            <p className="text-[10px] text-blue-700 leading-normal">
              Essas configurações são salvas automaticamente em seu navegador para visitas futuras.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
