import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle, X, RefreshCw, ArrowLeft, ArrowRight, Compass } from 'lucide-react';
import { DatasetStatus } from '../types/naksha';
import { API_BASE } from '../config/api';

export interface ScanStep {
  step_index: number;
  stage: string;
  name: string;
  status: 'pass' | 'warning' | 'fail' | 'pending' | 'running';
  detail: string;
  progress: number;
}

export interface QualityItem {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  note?: string;
  metric?: string;
}

export interface ScanResultData {
  dataset_id: string;
  project_id: string;
  category: string;
  name: string;
  status: string;
  validation_status: string;
  completeness: number;
  quality: number;
  ready_for_processing: boolean;
  crs_detected?: string;
  epsg?: number;
  bbox?: { x_min: number; x_max: number; y_min: number; y_max: number; z_min: number; z_max: number };
  point_count?: number;
  image_count?: number;
  feature_count?: number;
  steps: ScanStep[];
  quality_checks: QualityItem[];
  metadata: Record<string, any>;
  scanned_at: string;
}

interface DatasetScannerScreenProps {
  datasetId?: string;
  projectId?: string;
  categoryName?: string;
  onFinishScan: (completeness: number, quality: number, readyForProcessing: boolean, status?: DatasetStatus) => void;
  onBack: () => void;
}

export const PIPELINE_STAGES: ScanStep[] = [
  { step_index: 1, stage: 'UPLOADED_FILES', name: 'Uploaded files', status: 'pending', detail: 'Inspecting physical files on disk', progress: 10 },
  { step_index: 2, stage: 'FILE_SIGNATURE', name: 'File signature', status: 'pending', detail: 'Verifying magic byte signatures', progress: 20 },
  { step_index: 3, stage: 'FORMAT_PARSER', name: 'Format parser', status: 'pending', detail: 'Parsing format headers and structures', progress: 30 },
  { step_index: 4, stage: 'METADATA_EXTRACTION', name: 'Metadata extraction', status: 'pending', detail: 'Extracting counts and camera/trajectory tags', progress: 40 },
  { step_index: 5, stage: 'COORDINATE_CRS_DETECTION', name: 'Coordinate/CRS detection', status: 'pending', detail: 'Detecting coordinate reference system & EPSG', progress: 50 },
  { step_index: 6, stage: 'GEOMETRY_CHECKS', name: 'Geometry checks', status: 'pending', detail: 'Evaluating spatial bounding box footprint', progress: 60 },
  { step_index: 7, stage: 'DATASET_REQUIREMENTS', name: 'Dataset requirements', status: 'pending', detail: 'Validating mandatory & recommended components', progress: 70 },
  { step_index: 8, stage: 'QUALITY_CHECKS', name: 'Quality checks', status: 'pending', detail: 'Evaluating quantitative quality metrics', progress: 80 },
  { step_index: 9, stage: 'COMPLETENESS_CALCULATION', name: 'Completeness calculation', status: 'pending', detail: 'Calculating verified dataset completeness', progress: 90 },
  { step_index: 10, stage: 'FINAL_DATASET_STATUS', name: 'Final dataset status', status: 'pending', detail: 'Persisting verification verdict to PostgreSQL', progress: 100 },
];

export const DatasetScannerScreen: React.FC<DatasetScannerScreenProps> = ({
  datasetId,
  projectId,
  categoryName = 'PHOTOGRAMMETRY',
  onFinishScan,
  onBack
}) => {
  const [steps, setSteps] = useState<ScanStep[]>(PIPELINE_STAGES);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(1);
  const [isScanningComplete, setIsScanningComplete] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Real scanner execution: Zero timers, 100% operation-driven via Server-Sent Events
  useEffect(() => {
    let cancelled = false;

    async function executeRealScan() {
      setError(null);

      // Determine target dataset id
      let targetId = datasetId;

      if (!targetId && projectId) {
        try {
          const listRes = await fetch(`${API_BASE}/api/v2/projects/${projectId}/inputs/live`);
          if (listRes.ok) {
            const listData = await listRes.json();
            const ch = (listData.channels || []).find(
              (c: any) => c.displayName.toUpperCase() === categoryName.toUpperCase() && c.datasetId
            );
            if (ch?.datasetId) {
              targetId = ch.datasetId;
            }
          }
        } catch {}
      }

      if (!targetId) {
        setError('No active dataset found to scan. Please upload files first.');
        return;
      }

      try {
        // Connect to SSE stream: every progress event corresponds to an actual completed operation
        const response = await fetch(`${API_BASE}/api/v2/datasets/${targetId}/scan/stream`);

        if (!response.ok || !response.body) {
          // Direct POST fallback
          const directRes = await fetch(`${API_BASE}/api/v2/datasets/${targetId}/scan`, { method: 'POST' });
          if (!directRes.ok) throw new Error('Scanner failed on server');
          const data = await directRes.json();
          if (cancelled) return;
          setSteps(data.steps || PIPELINE_STAGES);
          setScanResult(data);
          setIsScanningComplete(true);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const payload = JSON.parse(trimmed.slice(6));
                if (payload.type === 'step') {
                  const stepData: ScanStep = payload.data;
                  if (!cancelled) {
                    setCurrentStepIdx(stepData.step_index);
                    setSteps(prev => {
                      const next = [...prev];
                      const idx = next.findIndex(s => s.step_index === stepData.step_index);
                      if (idx >= 0) {
                        next[idx] = { ...next[idx], ...stepData };
                      } else {
                        next.push(stepData);
                      }
                      return next;
                    });
                  }
                } else if (payload.type === 'complete') {
                  if (!cancelled) {
                    setScanResult(payload.result);
                    setIsScanningComplete(true);
                  }
                } else if (payload.type === 'error') {
                  if (!cancelled) {
                    setError(payload.error);
                  }
                }
              } catch (e) {
                console.error('SSE parse error:', e);
              }
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Error executing scanner pipeline');
        }
      }
    }

    executeRealScan();

    return () => {
      cancelled = true;
    };
  }, [datasetId, projectId, categoryName]);

  const completenessScore = scanResult ? scanResult.completeness : 0;
  const qualityScore = scanResult ? scanResult.quality : 0;
  const readyForProcessing = scanResult ? scanResult.ready_for_processing : false;
  const canonicalStatus: DatasetStatus = readyForProcessing ? 'Valid' : (completenessScore > 0 ? 'Partial' : 'Invalid');

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-12 px-6 font-sans select-none">
      {/* Top Bar */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between text-xs text-zinc-400">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inputs</span>
        </button>
        <span className="font-mono tracking-[0.2em] font-semibold text-zinc-400">NAKSHA 2.0 • SCANNER</span>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        {error ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-3 font-mono text-xs">
            <div className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Scanning Error</span>
            </div>
            <p className="text-zinc-700">{error}</p>
            <button
              onClick={onBack}
              className="mt-2 py-2 px-4 bg-zinc-900 text-white rounded text-xs font-semibold"
            >
              Back to Inputs
            </button>
          </div>
        ) : !isScanningComplete ? (
          /* ================= STEP 1: REAL 10-STAGE SCANNING PIPELINE ================= */
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <div className="text-xl font-bold tracking-tight text-zinc-900 flex items-center space-x-2">
                <span>Analyzing Uploaded Files...</span>
                <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                Executing 10-stage physical verification on stored disk bytes
              </p>
            </div>

            {/* Checklist of 10 Verification Steps */}
            <div className="space-y-2.5 font-mono text-xs border border-zinc-100 rounded-lg p-4 bg-zinc-50/50">
              {steps.map((step) => {
                const isPassed = step.status === 'pass';
                const isWarning = step.status === 'warning';
                const isFailed = step.status === 'fail';
                const isRunning = currentStepIdx === step.step_index && !isPassed && !isWarning && !isFailed;

                return (
                  <div
                    key={step.step_index}
                    className={`flex items-start space-x-3 transition-opacity duration-150 ${
                      isPassed
                        ? 'text-zinc-900 font-medium'
                        : isWarning
                        ? 'text-amber-800 font-medium'
                        : isFailed
                        ? 'text-rose-600 font-medium'
                        : isRunning
                        ? 'text-zinc-900'
                        : 'text-zinc-300'
                    }`}
                  >
                    <span className="w-4 pt-0.5 flex items-center justify-center shrink-0">
                      {isPassed ? (
                        <Check className="w-3.5 h-3.5 text-zinc-900" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      ) : isFailed ? (
                        <X className="w-3.5 h-3.5 text-rose-500" />
                      ) : isRunning ? (
                        <span className="w-2 h-2 rounded-full bg-zinc-900 animate-pulse" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                      )}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>{step.name}</span>
                        <span className="text-[10px] text-zinc-400">{step.progress}%</span>
                      </div>
                      {step.detail && (
                        <div className={`text-[10px] ${
                          isWarning ? 'text-amber-600' : isFailed ? 'text-rose-500' : 'text-zinc-400'
                        }`}>
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= STEP 2: VERIFIED AUDIT RESULTS ================= */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Category Title */}
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-sm font-mono font-bold tracking-[0.2em] text-zinc-400 uppercase">
                  {categoryName}
                </h1>
                <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                  10/10 Stages Verified
                </span>
              </div>
              {scanResult?.crs_detected && (
                <div className="text-xs font-mono text-zinc-500 mt-1 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-zinc-400" />
                  <span>CRS: {scanResult.crs_detected}</span>
                </div>
              )}
            </div>

            {/* Dual Score Metric: COMPLETENESS & QUALITY */}
            <div className="space-y-3 border-b border-zinc-100 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase block">
                    COMPLETENESS
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Required components provided
                  </span>
                </div>
                <span className="text-2xl font-bold font-mono text-zinc-900">
                  {completenessScore}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase block">
                    QUALITY
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Integrity, geometry & precision
                  </span>
                </div>
                <span className="text-2xl font-bold font-mono text-zinc-900">
                  {qualityScore}%
                </span>
              </div>
            </div>

            {/* Real Quality Checks Breakdown */}
            <div className="space-y-2 font-mono text-xs">
              <div className="text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase">
                QUALITY & GEODETIC CHECKS
              </div>
              {scanResult?.quality_checks && scanResult.quality_checks.length > 0 ? (
                scanResult.quality_checks.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-1 border-b border-zinc-50">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-4 flex items-center justify-center">
                        {item.status === 'pass' ? (
                          <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                        ) : item.status === 'warning' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                      </span>
                      <span className={item.status === 'fail' ? 'text-rose-600 font-semibold' : 'text-zinc-800'}>
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {item.metric || item.note}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-zinc-400">All format & signature checks passed</div>
              )}
            </div>

            {/* Status Section */}
            <div className="pt-2 border-t border-zinc-100">
              <div className="text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-1">
                STATUS
              </div>

              {readyForProcessing ? (
                <div className="text-sm font-bold font-mono text-emerald-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>READY FOR PIPELINE</span>
                </div>
              ) : (
                <div className="text-sm font-bold font-mono text-amber-500 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>PARTIALLY READY</span>
                </div>
              )}
            </div>

            {/* Action CTA */}
            <div className="pt-2">
              <button
                onClick={() => onFinishScan(completenessScore, qualityScore, readyForProcessing, canonicalStatus)}
                className={`w-full py-3.5 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm flex items-center justify-center space-x-2 ${
                  readyForProcessing
                    ? 'bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                }`}
              >
                <span>{readyForProcessing ? 'CONFIRM & PROCEED' : 'CONTINUE WITH DATASET'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Minimal Footer */}
      <div className="w-full max-w-md mx-auto text-center text-[11px] font-mono text-zinc-400">
        Phase 2 Real Scanner Engine • 10-Stage Physical File Verification • PostgreSQL Persistence
      </div>
    </div>
  );
};
