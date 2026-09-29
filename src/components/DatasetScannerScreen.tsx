import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle, X, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import { DatasetStatus } from '../types/naksha';

interface DatasetScannerScreenProps {
  categoryName?: string;
  onFinishScan: (completeness: number, quality: number, readyForProcessing: boolean, status?: DatasetStatus) => void;
  onBack: () => void;
}

const SCAN_STEPS = [
  'Reading files',
  'Checking format',
  'Extracting metadata',
  'Checking CRS',
  'Checking coordinates',
  'Checking completeness',
  'Checking quality'
];

interface QualityItem {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  note?: string;
}

const QUALITY_CHECKS: QualityItem[] = [
  { name: 'Images', status: 'pass' },
  { name: 'GPS', status: 'pass' },
  { name: 'CRS', status: 'pass' },
  { name: 'Image overlap', status: 'warning' },
  { name: 'Blur', status: 'fail' }
];

export const DatasetScannerScreen: React.FC<DatasetScannerScreenProps> = ({
  categoryName = 'PHOTOGRAMMETRY',
  onFinishScan,
  onBack
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isScanningComplete, setIsScanningComplete] = useState<boolean>(false);
  const [autoFilterBlur, setAutoFilterBlur] = useState<boolean>(false);

  // Execute sequential scanning animation
  useEffect(() => {
    if (currentStepIdx < SCAN_STEPS.length) {
      const timer = setTimeout(() => {
        setCompletedSteps(prev => [...prev, currentStepIdx]);
        setCurrentStepIdx(prev => prev + 1);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      const finishTimer = setTimeout(() => {
        setIsScanningComplete(true);
      }, 350);
      return () => clearTimeout(finishTimer);
    }
  }, [currentStepIdx]);

  // Phase 9 Dual Metric Logic:
  // Completeness: 8 of 10 required items provided = 80%
  const completenessScore = 80;

  // Quality: 72% initially. If blurred frames auto-filtered, quality improves to 78% and mandatory passes.
  const qualityScore = autoFilterBlur ? 78 : 72;

  // READY FOR PROCESSING: ONLY when mandatory requirements pass (e.g. blur failure is resolved or bypassed)
  const mandatoryRequirementsPassed = autoFilterBlur;

  const currentQualityChecks = QUALITY_CHECKS.map(item => {
    if (item.name === 'Blur' && autoFilterBlur) {
      return { ...item, status: 'pass' as const, note: 'Filtered 6 blurry frames' };
    }
    return item;
  });

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-12 px-6 font-sans select-none">
      {/* Top Bar */}
      <div className="w-full max-w-sm mx-auto flex items-center justify-between text-xs text-zinc-400">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
        <span className="font-mono tracking-[0.2em] font-semibold text-zinc-400">NAKSHA 2.0</span>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-sm mx-auto my-auto py-6">
        {!isScanningComplete ? (
          /* ================= STEP 1: SCANNING STATE ================= */
          <div className="space-y-8 animate-in fade-in duration-200">
            <div>
              <div className="text-xl font-bold tracking-tight text-zinc-900 flex items-center space-x-2">
                <span>Scanning...</span>
                <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
              </div>
            </div>

            {/* Checklist of 7 Verification Steps */}
            <div className="space-y-3 font-mono text-xs">
              {SCAN_STEPS.map((step, idx) => {
                const isDone = completedSteps.includes(idx);
                const isActive = currentStepIdx === idx && !isDone;

                return (
                  <div 
                    key={step}
                    className={`flex items-center space-x-3 transition-opacity duration-200 ${
                      isDone 
                        ? 'text-zinc-900 font-medium' 
                        : isActive 
                        ? 'text-zinc-600' 
                        : 'text-zinc-300'
                    }`}
                  >
                    <span className="w-4 flex items-center justify-center">
                      {isDone ? (
                        <Check className="w-3.5 h-3.5 text-zinc-900" />
                      ) : isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 animate-pulse" />
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-zinc-200" />
                      )}
                    </span>
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= STEP 2: PHASE 9 DUAL SCORE RESULTS ================= */
          <div className="space-y-7 animate-in fade-in duration-300">
            {/* Category Title */}
            <div>
              <h1 className="text-sm font-mono font-bold tracking-[0.2em] text-zinc-400 uppercase">
                {categoryName}
              </h1>
            </div>

            {/* Dual Score Metric: COMPLETENESS & QUALITY */}
            <div className="space-y-2 border-b border-zinc-100 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
                  COMPLETENESS
                </span>
                <span className="text-2xl font-bold font-mono text-zinc-900">
                  {completenessScore}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold tracking-wider text-zinc-400 uppercase">
                  QUALITY
                </span>
                <span className="text-2xl font-bold font-mono text-zinc-900">
                  {qualityScore}%
                </span>
              </div>
            </div>

            {/* Quality & Validity Checks Breakdown */}
            <div className="space-y-2.5 font-mono text-xs">
              {currentQualityChecks.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center space-x-3">
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
                  {item.note && (
                    <span className="text-[10px] text-zinc-400">{item.note}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Status Section: Phase 10 Canonical Status (READY or PARTIALLY READY) */}
            <div className="pt-3 border-t border-zinc-100">
              <div className="text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-1">
                STATUS
              </div>

              {mandatoryRequirementsPassed ? (
                <div className="text-sm font-bold font-mono text-emerald-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>READY</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-bold font-mono text-amber-500 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>PARTIALLY READY</span>
                  </div>

                  {/* Resolution Option */}
                  <div 
                    onClick={() => setAutoFilterBlur(!autoFilterBlur)}
                    className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg cursor-pointer hover:border-zinc-400 transition-colors"
                  >
                    <div className="flex items-center space-x-2 text-xs font-medium text-zinc-800">
                      <input 
                        type="checkbox" 
                        checked={autoFilterBlur} 
                        onChange={() => {}} 
                        className="rounded border-zinc-300 text-zinc-900"
                      />
                      <span>Auto-filter blurred frames (Pass gate)</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1 font-mono pl-5">
                      Omits 6 motion-blurred frames to elevate status from PARTIALLY READY to READY.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action CTA */}
            <div className="pt-3">
              <button
                onClick={() => onFinishScan(
                  completenessScore, 
                  qualityScore, 
                  mandatoryRequirementsPassed, 
                  mandatoryRequirementsPassed ? 'Valid' : 'Partial'
                )}
                className={`w-full py-3.5 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm flex items-center justify-center space-x-2 ${
                  mandatoryRequirementsPassed
                    ? 'bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white'
                    : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'
                }`}
              >
                <span>{mandatoryRequirementsPassed ? 'CONFIRM & PROCEED' : 'CONTINUE WITH WARNING'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Minimal Footer */}
      <div className="w-full max-w-sm mx-auto text-center text-[11px] font-mono text-zinc-400">
        Dual Score Model: Completeness + Quality • Phase 9
      </div>
    </div>
  );
};
