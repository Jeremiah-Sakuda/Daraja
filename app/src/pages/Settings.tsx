import { useState, useEffect } from 'react';
import { ChevronRight, Trash2, Database, Globe, Info, Shield } from 'lucide-react';
import { LANGUAGE_PAIRS } from '../types/translation';
import { useOfflineSync } from '../hooks/useOfflineSync';

interface SettingsState {
  defaultLanguagePair: string;
  defaultDomain: string;
  showConfidenceScores: boolean;
  autoSyncWhenOnline: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  defaultLanguagePair: 'so-sw',
  defaultDomain: 'general',
  showConfidenceScores: true,
  autoSyncWhenOnline: true,
};

const DOMAINS = [
  { value: 'general', label: 'General' },
  { value: 'legal', label: 'Legal / RSD' },
  { value: 'medical', label: 'Medical' },
  { value: 'administrative', label: 'Administrative' },
];

export function Settings() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [cachedDataSize, setCachedDataSize] = useState<string>('Calculating...');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { pendingCount } = useOfflineSync();

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('daraja-settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch {
        // Use defaults if parsing fails
      }
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('daraja-settings', JSON.stringify(settings));
  }, [settings]);

  // Estimate cached data size
  useEffect(() => {
    const estimateStorageSize = async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
        setCachedDataSize(`${usedMB} MB used`);
      } else {
        setCachedDataSize('Unknown');
      }
    };
    estimateStorageSize();
  }, []);

  const updateSetting = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const handleClearData = async () => {
    // Clear IndexedDB
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }

    // Clear localStorage (except settings)
    const savedSettings = localStorage.getItem('daraja-settings');
    localStorage.clear();
    if (savedSettings) {
      localStorage.setItem('daraja-settings', savedSettings);
    }

    // Clear service worker cache
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }

    setShowClearConfirm(false);
    setCachedDataSize('0 MB used');
  };

  const getLanguagePairLabel = (code: string): string => {
    const pair = LANGUAGE_PAIRS.find(
      (p) => `${p.source.code}-${p.target.code}` === code
    );
    return pair
      ? `${pair.source.name} → ${pair.target.name}`
      : code;
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="section-header">Settings</h1>
        <p className="text-sm text-daraja-500">
          Configure app preferences
        </p>
      </div>

      {/* Language & Translation */}
      <section>
        <h2 className="text-xs font-semibold text-daraja-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Language & Translation
        </h2>
        <div className="card divide-y divide-daraja-100">
          <div className="py-4 first:pt-0 last:pb-0">
            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-daraja-800">Default Language Pair</span>
                <p className="text-sm text-daraja-500 mt-0.5">
                  {getLanguagePairLabel(settings.defaultLanguagePair)}
                </p>
              </div>
              <select
                value={settings.defaultLanguagePair}
                onChange={(e) => updateSetting('defaultLanguagePair', e.target.value)}
                className="input-field w-auto text-sm"
              >
                {LANGUAGE_PAIRS.filter((p) => p.status === 'available').map((pair) => (
                  <option key={`${pair.source.code}-${pair.target.code}`} value={`${pair.source.code}-${pair.target.code}`}>
                    {pair.source.name} → {pair.target.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="py-4 first:pt-0 last:pb-0">
            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-daraja-800">Default Domain</span>
                <p className="text-sm text-daraja-500 mt-0.5">
                  Affects translation terminology
                </p>
              </div>
              <select
                value={settings.defaultDomain}
                onChange={(e) => updateSetting('defaultDomain', e.target.value)}
                className="input-field w-auto text-sm"
              >
                {DOMAINS.map((domain) => (
                  <option key={domain.value} value={domain.value}>
                    {domain.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="py-4 first:pt-0 last:pb-0">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="font-medium text-daraja-800">Show Confidence Scores</span>
                <p className="text-sm text-daraja-500 mt-0.5">
                  Display translation confidence percentages
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateSetting('showConfidenceScores', !settings.showConfidenceScores)}
                className={`
                  relative w-12 h-7 rounded-full transition-colors
                  ${settings.showConfidenceScores ? 'bg-trust-600' : 'bg-daraja-300'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform
                    ${settings.showConfidenceScores ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </label>
          </div>
        </div>
      </section>

      {/* Offline & Storage */}
      <section>
        <h2 className="text-xs font-semibold text-daraja-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Database className="w-4 h-4" />
          Offline & Storage
        </h2>
        <div className="card divide-y divide-daraja-100">
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-daraja-800">Cached Data</span>
                <p className="text-sm text-daraja-500 mt-0.5">
                  {cachedDataSize}
                </p>
              </div>
              {pendingCount > 0 && (
                <span className="text-xs bg-caution-100 text-caution-700 px-2 py-1 rounded-full">
                  {pendingCount} pending
                </span>
              )}
            </div>
          </div>

          <div className="py-4 first:pt-0 last:pb-0">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="font-medium text-daraja-800">Auto-sync When Online</span>
                <p className="text-sm text-daraja-500 mt-0.5">
                  Automatically upload pending data
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateSetting('autoSyncWhenOnline', !settings.autoSyncWhenOnline)}
                className={`
                  relative w-12 h-7 rounded-full transition-colors
                  ${settings.autoSyncWhenOnline ? 'bg-trust-600' : 'bg-daraja-300'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform
                    ${settings.autoSyncWhenOnline ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </label>
          </div>

          <div className="py-4 first:pt-0 last:pb-0">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <span className="font-medium text-alert-600">Clear All Data</span>
                <p className="text-sm text-daraja-500 mt-0.5">
                  Delete cached translations and sessions
                </p>
              </div>
              <Trash2 className="w-5 h-5 text-alert-500" />
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="text-xs font-semibold text-daraja-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" />
          About
        </h2>
        <div className="card divide-y divide-daraja-100">
          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-daraja-800">Version</span>
              <span className="text-daraja-600">0.1.0</span>
            </div>
          </div>

          <div className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-daraja-800">Model Status</span>
                <p className="text-sm text-daraja-500 mt-0.5">
                  Daraja-SO-SW v1.0
                </p>
              </div>
              <span className="text-xs bg-trust-100 text-trust-700 px-2 py-1 rounded-full">
                Ready
              </span>
            </div>
          </div>

          <button className="py-4 first:pt-0 last:pb-0 w-full flex items-center justify-between text-left">
            <span className="font-medium text-daraja-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-daraja-500" />
              Privacy Policy
            </span>
            <ChevronRight className="w-5 h-5 text-daraja-400" />
          </button>

          <button className="py-4 first:pt-0 last:pb-0 w-full flex items-center justify-between text-left">
            <span className="font-medium text-daraja-800">Open Source Licenses</span>
            <ChevronRight className="w-5 h-5 text-daraja-400" />
          </button>
        </div>
      </section>

      {/* Clear Data Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-sm w-full">
            <h3 className="text-lg font-semibold text-daraja-800 mb-2">
              Clear All Data?
            </h3>
            <p className="text-sm text-daraja-600 mb-6">
              This will permanently delete all cached translations, session history, and offline data.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="btn-primary flex-1 bg-alert-600 hover:bg-alert-700"
              >
                Clear Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
