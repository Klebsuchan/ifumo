import React, { useEffect, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstructions((prev) => !prev);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label="Instalar Aplicativo PWA"
        className="px-3.5 py-2 rounded-xl border border-[#26272B] bg-[#1A1B1E] text-xs font-bold text-[#F5A623] hover:border-[#F5A623] transition-colors flex items-center gap-1.5 min-h-[38px] whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5 text-[#F5A623]" />
        <span>Instalar App</span>
      </button>

      {showInstructions && (
        <div
          role="dialog"
          aria-label="Instruções de Instalação"
          className="absolute right-0 mt-2 w-72 p-4 rounded-2xl bg-[#1A1B1E] border border-[#26272B] shadow-2xl z-50 text-xs text-[#D1D5DB] space-y-2"
        >
          <p className="font-bold text-white">Instalar Ifumo Mobile App</p>
          <p>
            No Safari (iOS), toque em <strong>Compartilhar</strong> e selecione{' '}
            <strong>Adicionar à Tela de Início</strong>. No Chrome/Android, abra o menu do navegador e toque em <strong>Instalar aplicativo</strong>.
          </p>
          <button
            type="button"
            onClick={() => setShowInstructions(false)}
            className="w-full py-2 mt-1 rounded-xl bg-[#F5A623] text-[#0B0B0D] font-bold"
          >
            Entendi
          </button>
        </div>
      )}
    </div>
  );
}

export function OfflineIndicator({ simulatedOffline }: { simulatedOffline: boolean }) {
  const [browserOffline, setBrowserOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setBrowserOffline(false);
    const handleOffline = () => setBrowserOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOffline = browserOffline || simulatedOffline;
  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-40 flex items-center gap-3 p-3.5 rounded-2xl bg-[#1A1B1E] border border-[#F5A623] text-white shadow-2xl"
    >
      <WifiOff className="w-5 h-5 text-[#F5A623] shrink-0" />
      <div className="text-xs leading-snug">
        <p className="font-bold text-[#F5A623]">Modo Offline Ativo (Cache Local PWA)</p>
        <p className="text-[#9CA3AF]">
          Catálogo de tabacarias e sacola disponíveis sem internet. Pedidos serão sincronizados automaticamente.
        </p>
      </div>
    </div>
  );
}
