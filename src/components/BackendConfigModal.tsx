import React, { useState, useEffect } from 'react';
import { 
  X, 
  Server, 
  Cloud, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Laptop
} from 'lucide-react';
import { BACKEND_URL, setBackendUrl } from '../config/api';

interface BackendConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({ isOpen, onClose }) => {
  const [urlInput, setUrlInput] = useState(BACKEND_URL);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    statusText: string;
    details?: any;
    latencyMs?: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(BACKEND_URL);
      testConnection(BACKEND_URL);
    }
  }, [isOpen]);

  const testConnection = async (targetUrl: string) => {
    setTesting(true);
    setTestResult(null);
    const clean = targetUrl.trim().replace(/\/+$/, '');
    const startTime = performance.now();
    try {
      const res = await fetch(`${clean}/health`, { signal: AbortSignal.timeout(5000) });
      const latencyMs = Math.round(performance.now() - startTime);
      if (res.ok) {
        const json = await res.json();
        setTestResult({
          ok: true,
          statusText: 'Connected & Operational',
          details: json,
          latencyMs
        });
      } else {
        setTestResult({
          ok: false,
          statusText: `HTTP Error: ${res.status}`,
          latencyMs
        });
      }
    } catch (e: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      setTestResult({
        ok: false,
        statusText: e?.message || 'Connection failed',
        latencyMs
      });
    } finally {
      setTesting(false);
    }
  };

  const handleApply = () => {
    setBackendUrl(urlInput);
  };

  const handleSetPreset = (presetUrl: string) => {
    setUrlInput(presetUrl);
    testConnection(presetUrl);
  };

  if (!isOpen) return null;

  const isLocal = BACKEND_URL.includes('127.0.0.1') || BACKEND_URL.includes('localhost');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Backend & Cloud Settings</h2>
              <p className="text-[11px] text-zinc-500 font-mono">Render Deployment & Desktop Sync</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Active Status Badge */}
          <div className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-200 bg-zinc-50/80">
            <div className="flex items-center space-x-3">
              <span className={`w-3 h-3 rounded-full shrink-0 ${testResult?.ok ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <div className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                  {isLocal ? (
                    <>
                      <Laptop className="w-3.5 h-3.5 text-zinc-600" />
                      <span>Local Desktop Supervisor</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-blue-600" />
                      <span>Render Cloud Engine</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] font-mono text-zinc-500 truncate max-w-xs">
                  {BACKEND_URL}
                </div>
              </div>
            </div>
            {testResult?.latencyMs !== undefined && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200 text-zinc-700 font-medium">
                {testResult.latencyMs}ms
              </span>
            )}
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block mb-2 font-mono">
              Quick Presets
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSetPreset('http://127.0.0.1:8000')}
                className={`px-3 py-2 rounded-lg border text-left transition-all ${
                  urlInput === 'http://127.0.0.1:8000'
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm'
                    : 'border-zinc-200 hover:border-zinc-300 text-zinc-700 bg-white'
                }`}
              >
                <div className="text-xs font-bold">Local Engine</div>
                <div className="text-[10px] font-mono opacity-70">127.0.0.1:8000</div>
              </button>

              <button
                type="button"
                onClick={() => handleSetPreset('https://surveynaksha-backend.onrender.com')}
                className={`px-3 py-2 rounded-lg border text-left transition-all ${
                  urlInput.includes('onrender.com')
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : 'border-zinc-200 hover:border-zinc-300 text-zinc-700 bg-white'
                }`}
              >
                <div className="text-xs font-bold">Render Cloud</div>
                <div className="text-[10px] font-mono opacity-70">*.onrender.com</div>
              </button>
            </div>
          </div>

          {/* Custom Backend URL Input */}
          <div>
            <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block mb-1.5 font-mono">
              Backend API URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://your-service.onrender.com"
                className="flex-1 px-3 py-2 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <button
                type="button"
                onClick={() => testConnection(urlInput)}
                disabled={testing}
                className="px-3 py-2 text-xs font-medium border border-zinc-200 hover:bg-zinc-100 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Test endpoint reachability"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>Test</span>
              </button>
            </div>
          </div>

          {/* Live Test Feedback */}
          {testResult && (
            <div className={`p-3 rounded-lg border text-xs ${
              testResult.ok 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-2 font-medium">
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.statusText}</span>
              </div>
              {testResult.details && (
                <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 font-mono text-[10px] space-y-0.5">
                  <div>Service: {testResult.details.service || 'Naksha 2.0'}</div>
                  <div>DB: {testResult.details.db || 'Ready'} • Storage: {testResult.details.storage || 'Ready'}</div>
                </div>
              )}
            </div>
          )}

          {/* Download Desktop App Banner */}
          <div className="p-3.5 rounded-lg border border-blue-100 bg-blue-50/60">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Naksha 2.0 Desktop Platform</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Windows 64-bit installer with embedded Tauri supervisor, local file system dialogs, and native hardware acceleration.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 text-xs bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium shadow-sm"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};
