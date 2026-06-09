import React, { createContext, useContext, useState, useEffect } from 'react';

interface AccessibilitySettings {
  highContrast: boolean;
  largeFonts: boolean;
  reducedMotion: boolean;
  accessibleColors: boolean;
  screenReader: boolean;
  dyslexicFont: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: (key: keyof AccessibilitySettings, value: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const saved = localStorage.getItem('accessibility_settings');
    return saved ? JSON.parse(saved) : {
      highContrast: false,
      largeFonts: false,
      reducedMotion: false,
      accessibleColors: false,
      screenReader: false,
      dyslexicFont: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('accessibility_settings', JSON.stringify(settings));
    
    // Apply classes to root element for global styling
    const root = document.documentElement;
    if (settings.highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');
    
    if (settings.largeFonts) root.classList.add('large-fonts');
    else root.classList.remove('large-fonts');
    
    if (settings.reducedMotion) root.classList.add('reduced-motion');
    else root.classList.remove('reduced-motion');

    if (settings.accessibleColors) root.classList.add('accessible-colors');
    else root.classList.remove('accessible-colors');

    if (settings.screenReader) root.classList.add('screen-reader-optimized');
    else root.classList.remove('screen-reader-optimized');

    if (settings.dyslexicFont) root.classList.add('dyslexic-font');
    else root.classList.remove('dyslexic-font');
  }, [settings]);

  const updateSetting = (key: keyof AccessibilitySettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
