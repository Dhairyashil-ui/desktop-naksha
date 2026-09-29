import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, X, ChevronDown, Filter, Circle } from 'lucide-react';
import { API_BASE, WS_BASE } from '../config/api';

/* ─── Types ────────────────────────────────────────────────── */
export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'DEBUG';
export type LogCategory =
  | 'PROJECT' | 'LIDAR' | 'PHOTOGRAMMETRY' | 'FUSION'
  | 'BUILDING' | 'RECORD' | 'VALIDATION' | 'PACKAGE' | 'SYSTEM';

export interface LogEntry {
  id: string;
  timestamp: number;
  timestamp_display: string;   // HH:MM:SS
  level: LogLevel;
  category: string;
  message: string;
  detail?: string;
}

/* ─── Seed data — mirrors backend Phase 23 seed ──────────────── */
const SEED_ENTRIES: LogEntry[] = [
  { id: 'l0', timestamp: 0, timestamp_display: '14:32:01', level: 'INFO',    category: 'PROJECT',        message: 'Project created',                   detail: 'Haveli Taluka Cadastre & 3D Land Demarcation' },
  { id: 'l1', timestamp: 1, timestamp_display: '14:32:12', level: 'INFO',    category: 'LIDAR',          message: 'LiDAR uploaded',                    detail: '12.4M points • LAS 1.4' },
  { id: 'l2', timestamp: 2, timestamp_display: '14:32:15', level: 'INFO',    category: 'LIDAR',          message: 'LiDAR validation started',           detail: undefined },
  { id: 'l3', timestamp: 3, timestamp_display: '14:32:18', level: 'SUCCESS', category: 'LIDAR',          message: 'CRS detected: EPSG:32643',           detail: 'WGS 84 / UTM Zone 43N' },
  { id: 'l4', timestamp: 4, timestamp_display: '14:32:22', level: 'SUCCESS', category: 'LIDAR',          message: 'LiDAR accepted',                    detail: 'Point density: 18.2 pts/m²' },
  { id: 'l5', timestamp: 5, timestamp_display: '14:32:40', level: 'INFO',    category: 'PHOTOGRAMMETRY', message: 'Photogrammetry started',             detail: '1,420 frames queued' },
  { id: 'l6', timestamp: 6, timestamp_display: '14:33:10', level: 'INFO',    category: 'PHOTOGRAMMETRY', message: 'Feature extraction running',         detail: 'SIFT keypoints' },
  { id: 'l7', timestamp: 7, timestamp_display: '14:34:21', level: 'INFO',    category: 'PHOTOGRAMMETRY', message: 'Bundle block adjustment complete',   detail: 'RMSE: 0.3 cm' },
  { id: 'l8', timestamp: 8, timestamp_display: '14:35:12', level: 'SUCCESS', category: 'PHOTOGRAMMETRY', message: 'Point cloud generated',              detail: '8.2M pts dense optical model' },
  { id: 'l9', timestamp: 9, timestamp_display: '14:36:01', level: 'INFO',    category: 'FUSION',         message: 'Point cloud fusion started',         detail: 'LiDAR + Photogrammetry' },
  { id: 'l10',timestamp:10, timestamp_display: '14:36:22', level: 'INFO',    category: 'FUSION',         message: 'ICP registration running',           detail: 'Iteration 12/50' },
  { id: 'l11',timestamp:11, timestamp_display: '14:37:08', level: 'SUCCESS', category: 'FUSION',         message: 'Fused reality model complete',       detail: '12.4M pts watertight' },
  { id: 'l12',timestamp:12, timestamp_display: '14:38:00', level: 'INFO',    category: 'BUILDING',       message: 'Building reconstruction started',    detail: 'LoD-2.2 target' },
  { id: 'l13',timestamp:13, timestamp_display: '14:39:44', level: 'SUCCESS', category: 'BUILDING',       message: 'Building model complete',            detail: '8 floors • 64 units' },
  { id: 'l14',timestamp:14, timestamp_display: '14:40:02', level: 'INFO',    category: 'RECORD',         message: 'Record matching started',            detail: '64 units vs Mahabhulekh DB' },
  { id: 'l15',timestamp:15, timestamp_display: '14:40:31', level: 'WARNING', category: 'RECORD',         message: 'Unit 304: Area mismatch detected',  detail: 'GIS: 68.4m² vs Record: 71.2m²' },
  { id: 'l16',timestamp:16, timestamp_display: '14:40:45', level: 'SUCCESS', category: 'RECORD',         message: 'Record matching complete',           detail: '63/64 matched • 1 flagged' },
  { id: 'l17',timestamp:17, timestamp_display: '14:41:00', level: 'INFO',    category: 'VALIDATION',     message: 'Final validation started',           detail: '8 checks' },
  { id: 'l18',timestamp:18, timestamp_display: '14:41:05', level: 'SUCCESS', category: 'VALIDATION',     message: 'Geometry: PASSED',                  detail: undefined },
  { id: 'l19',timestamp:19, timestamp_display: '14:41:07', level: 'SUCCESS', category: 'VALIDATION',     message: 'Coordinates: PASSED (EPSG:32643)',   detail: undefined },
  { id: 'l20',timestamp:20, timestamp_display: '14:41:09', level: 'SUCCESS', category: 'VALIDATION',     message: 'Topology: PASSED',                  detail: '0 overlaps' },
  { id: 'l21',timestamp:21, timestamp_display: '14:41:11', level: 'WARNING', category: 'VALIDATION',     message: 'Record match: 63/64',               detail: 'Unit 304 flagged for review' },
  { id: 'l22',timestamp:22, timestamp_display: '14:41:30', level: 'INFO',    category: 'PACKAGE',        message: 'Package generation started',         detail: '4 output formats' },
  { id: 'l23',timestamp:23, timestamp_display: '14:41:45', level: 'SUCCESS', category: 'PACKAGE',        message: 'TBK package ready',                 detail: 'Imagery + Georef' },
  { id: 'l24',timestamp:24, timestamp_display: '14:41:52', level: 'SUCCESS', category: 'PACKAGE',        message: 'GIB package ready',                 detail: '2D GIS layers' },
  { id: 'l25',timestamp:25, timestamp_display: '14:41:58', level: 'SUCCESS', category: 'PACKAGE',        message: 'Vertical Property ZIP ready',        detail: '64 unit strata' },
  { id: 'l26',timestamp:26, timestamp_display: '14:42:03', level: 'SUCCESS', category: 'PACKAGE',        message: '3D Survey ZIP ready',               detail: 'Point cloud + mesh' },
];

/* ─── Level styling ──────────────────────────────────────────── */
const LEVEL_STYLES: Record<LogLevel, { dot: string; text: string; bg: string }> = {
  INFO:    { dot: 'bg-zinc-400',   text: 'text-zinc-700',    bg: '' },
  SUCCESS: { dot: 'bg-emerald-500',text: 'text-emerald-700', bg: 'bg-emerald-50/60' },
  WARNING: { dot: 'bg-amber-500',  text: 'text-amber-700',   bg: 'bg-amber-50/60' },
  ERROR:   { dot: 'bg-red-500',    text: 'text-red-700',     bg: 'bg-red-50/60' },
  DEBUG:   { dot: 'bg-violet-400', text: 'text-violet-600',  bg: '' },
};

const LEVEL_FILTERS: (LogLevel | 'ALL')[] = ['ALL', 'INFO', 'SUCCESS', 'WARNING', 'ERROR'];

/* ─── Component ──────────────────────────────────────────────── */
export const LogPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>(SEED_ENTRIES);
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /* WebSocket connection to /ws/logs */
  useEffect(() => {
    // Fetch backlog from REST
    fetch(`${API_BASE}/api/v2/logs?limit=100`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.entries?.length) {
          setEntries(data.entries);
        }
      })
      .catch(() => { /* keep seed data */ });

    // Real-time WebSocket
    try {
      const ws = new WebSocket(`${WS_BASE}/ws/logs`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.type === 'BACKLOG' && payload.entries) {
            setEntries(payload.entries);
          } else if (payload.type === 'NEW_ENTRY' && payload.entry) {
            setEntries(prev => {
              const next = [...prev, payload.entry];
              return next.length > 500 ? next.slice(-500) : next;
            });
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      wsRef.current?.close();
    };
  }, []);

  /* Auto-scroll to bottom when new entries arrive */
  useEffect(() => {
    if (autoScroll && logEndRef.current && isOpen && !isMinimized) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll, isOpen, isMinimized]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    setAutoScroll(atBottom);
  }, []);

  const filtered = entries.filter(e => {
    const levelOk = filter === 'ALL' || e.level === filter;
    const catOk = categoryFilter === 'ALL' || e.category === categoryFilter;
    return levelOk && catOk;
  });

  const warnCount = entries.filter(e => e.level === 'WARNING').length;
  const errCount  = entries.filter(e => e.level === 'ERROR').length;
  const lastEntry = entries[entries.length - 1];

  const categories = ['ALL', ...Array.from(new Set(entries.map(e => e.category)))];

  /* ─── Closed state: small status bar at bottom ─── */
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center space-x-2.5 bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl shadow-xl px-4 py-2.5 text-xs font-mono hover:border-zinc-300 transition-all group"
        title="Open Operation Log"
      >
        <Terminal className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 transition-colors" />
        <div className="flex items-center space-x-2">
          <span className="text-zinc-700 font-semibold">LOG</span>
          {errCount > 0 && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold text-[10px]">
              {errCount} ERR
            </span>
          )}
          {warnCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold text-[10px]">
              {warnCount} WARN
            </span>
          )}
        </div>
        {lastEntry && (
          <span className="text-zinc-400 text-[10px] truncate max-w-32 hidden sm:block">
            {lastEntry.timestamp_display} {lastEntry.message}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
      </button>
    );
  }

  /* ─── Open state: panel ─── */
  return (
    <div
      className="fixed bottom-6 left-6 z-40 font-mono select-none"
      style={{ width: isMinimized ? '300px' : '540px' }}
    >
      <div className="bg-white/98 backdrop-blur-md border border-zinc-200/90 rounded-2xl shadow-2xl overflow-hidden text-zinc-900 flex flex-col"
        style={{ height: isMinimized ? 'auto' : '380px' }}
      >
        {/* Header Bar */}
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <Terminal className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs font-bold text-zinc-900 tracking-wider">OPERATION LOG</span>
            <span className="text-[10px] text-zinc-400 font-medium">{filtered.length} entries</span>
            {errCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                {errCount} ERROR
              </span>
            )}
            {warnCount > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">
                {warnCount} WARN
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-zinc-200/60 rounded-lg text-zinc-400 hover:text-zinc-700 transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-zinc-200/60 rounded-lg text-zinc-400 hover:text-zinc-700 transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Filter Bar */}
            <div className="px-4 py-2 border-b border-zinc-100/80 flex items-center space-x-3 flex-shrink-0 bg-white/60">
              {/* Level filter pills */}
              <div className="flex items-center space-x-1">
                <Filter className="w-3 h-3 text-zinc-400 mr-1" />
                {LEVEL_FILTERS.map(lf => (
                  <button
                    key={lf}
                    onClick={() => setFilter(lf)}
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-all ${
                      filter === lf
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                    }`}
                  >
                    {lf}
                  </button>
                ))}
              </div>

              <div className="h-3 w-px bg-zinc-200 flex-shrink-0" />

              {/* Category select */}
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-[10px] font-mono text-zinc-600 bg-transparent border-0 outline-none cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Log Entries */}
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-1 py-1"
            >
              {filtered.map((entry) => {
                const style = LEVEL_STYLES[entry.level] || LEVEL_STYLES.INFO;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-start space-x-2.5 px-3 py-1.5 rounded-lg mb-0.5 hover:bg-zinc-50 transition-colors group ${style.bg}`}
                  >
                    {/* Timestamp */}
                    <span className="text-[11px] text-zinc-400 w-16 flex-shrink-0 pt-0.5 tabular-nums">
                      {entry.timestamp_display}
                    </span>

                    {/* Level dot */}
                    <span className="pt-1.5 flex-shrink-0">
                      <Circle className={`w-1.5 h-1.5 fill-current ${style.text}`} />
                    </span>

                    {/* Message */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-semibold leading-tight ${style.text}`}>
                        {entry.message}
                      </div>
                      {entry.detail && (
                        <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                          {entry.detail}
                        </div>
                      )}
                    </div>

                    {/* Category badge — shown on hover */}
                    <span className="text-[9px] text-zinc-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5 tracking-wider">
                      {entry.category}
                    </span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>

            {/* Footer: auto-scroll indicator */}
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-shrink-0 py-1.5 text-center text-[10px] text-zinc-500 hover:text-zinc-900 border-t border-zinc-100 bg-zinc-50/80 transition-colors font-semibold"
              >
                ↓ scroll to latest
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
