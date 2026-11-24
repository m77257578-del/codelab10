'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { useI18n } from '../lib/LocaleContext';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, isInIframe, swReady, install } = usePWAInstall();
  const { t } = useI18n();
  const [guideOpen, setGuideOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Automatically hide once running in installed standalone app mode
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <button
        type="button"
        data-testid="pwa-install-btn"
        title={t('installAppTitle')}
        onClick={handleClick}
        disabled={installing}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
          isInstallable
            ? 'bg-sky-600/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 hover:bg-sky-600/30'
            : 'bg-white/60 dark:bg-[#252526] text-[#333333] dark:text-[#cccccc] border border-[#c8c8c8] dark:border-[#3c3c3c] hover:bg-slate-100 dark:hover:bg-[#3c3c3c]'
        }`}
      >
        <Download className="w-3.5 h-3.5 text-sky-500 shrink-0" />
        <span className="hidden sm:inline">{t('installAppBtn')}</span>
      </button>

      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/codelab-logo.png"
                  alt={t('brandName')}
                  className="w-7 h-7 rounded-lg object-cover shrink-0"
                />
                <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {t('installModalTitle')}
                </h2>
              </div>
              <button
                type="button"
                aria-label={t('closeAria')}
                onClick={() => setGuideOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <p className="leading-relaxed">{t('installModalSubtitle')}</p>

              {/* PWA Readiness Checklist */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t('pwaCheckManifest')}</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    swReady
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t('pwaCheckSW')}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t('pwaCheckStandalone')}</span>
                </div>
              </div>

              {isInstallable ? (
                <button
                  type="button"
                  onClick={async () => {
                    const accepted = await install();
                    if (accepted) setGuideOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('installReadyNativeBtn')}</span>
                </button>
              ) : isIOS ? (
                <div className="p-3.5 rounded-lg border border-sky-500/30 bg-sky-500/10 space-y-2 text-xs text-slate-800 dark:text-slate-200">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-sky-500" />
                    <span>{t('installIOSHeading')}</span>
                  </div>
                  <p className="flex items-center gap-1.5">
                    <Share className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span>{t('installIOSStep1')}</span>
                  </p>
                  <p>{t('installIOSStep2')}</p>
                </div>
              ) : isInIframe ? (
                <div className="p-3.5 rounded-lg border border-sky-500/30 bg-sky-500/10 space-y-3 text-xs text-slate-800 dark:text-slate-200">
                  <p className="leading-relaxed">{t('installOpenTabHint')}</p>
                  <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{t('installOpenTabBtn')}</span>
                  </a>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs leading-relaxed">
                  {t('installBrowserHint')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { t } = useI18n();

  if (isOnline) return null;

  return (
    <div
      role="status"
      data-testid="pwa-offline-indicator"
      className="fixed bottom-8 start-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>{t('offlineBanner')}</span>
    </div>
  );
}
