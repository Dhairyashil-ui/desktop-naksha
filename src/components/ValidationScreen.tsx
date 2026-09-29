import React, { useState } from 'react';
import { 
  ArrowLeft, 
  AlertTriangle, 
  ShieldAlert, 
  Lock, 
  FileDown, 
  Wrench, 
  X, 
  CheckCircle2 
} from 'lucide-react';

interface ValidationScreenProps {
  projectName?: string;
  onBack: () => void;
  onOpenProcessing?: () => void;
  onOpenCanonicalModel?: () => void;
  onProceedToPackages?: () => void;
}

interface ValidationItem {
  id: string;
  label: string;
  isPassed: boolean;
  details: string;
}

export const ValidationScreen: React.FC<ValidationScreenProps> = ({
  projectName = 'Pune Residential 001',
  onBack,
  onOpenProcessing,
  onOpenCanonicalModel,
  onProceedToPackages
}) => {
  // Toggle between 100% Passing and Simulated Failure on Unit 304
  const [hasFailure, setHasFailure] = useState<boolean>(false);
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [packageGenerated, setPackageGenerated] = useState<boolean>(false);

  const checksList: ValidationItem[] = [
    {
      id: 'geom',
      label: 'Geometry',
      isPassed: true,
      details: 'LoD-2.2 watertight architectural solid massing. Zero non-manifold edges.'
    },
    {
      id: 'coord',
      label: 'Coordinates',
      isPassed: true,
      details: 'GNSS survey network triangulation verified within ±0.011m horizontal RMSE.'
    },
    {
      id: 'crs',
      label: 'CRS',
      isPassed: true,
      details: 'EPSG:32643 (WGS 84 / UTM 43N) confirmed with scale factor 0.9996024.'
    },
    {
      id: 'parcel',
      label: 'Parcel Match',
      isPassed: true,
      details: 'Building footprint strictly contained within Survey 142/B boundary polygon.'
    },
    {
      id: 'floor',
      label: 'Floor Mapping',
      isPassed: true,
      details: 'Continuous vertical floor sequence 0 to 7 without gaps or elevation conflicts.'
    },
    {
      id: 'units',
      label: 'Unit Boundaries',
      isPassed: !hasFailure,
      details: hasFailure 
        ? 'Boundary overlap detected: Unit 304 volume intersects Unit 303 by 14 cm.' 
        : 'All 64 strata units have mutually disjoint, watertight 3D solid volumes.'
    },
    {
      id: 'record',
      label: 'Record Match',
      isPassed: true,
      details: '100% correspondence with Mahabhulekh 7/12 RoR records and City Survey CTS sheets.'
    },
    {
      id: 'topo',
      label: 'Topology',
      isPassed: !hasFailure,
      details: hasFailure 
        ? '3D volumetric partitioning violation: shared demising wall conflict on Floor 3.' 
        : 'Zero sliver polygons, zero overlapping boundaries. Clean 3D topological manifold.'
    }
  ];

  const passedCount = checksList.filter(c => c.isPassed).length;
  const isAllPassed = passedCount === checksList.length;
  const progressPct = isAllPassed ? 100 : Math.round((passedCount / checksList.length) * 100);

  const handleAutoResolve = () => {
    setIsResolving(true);
    setTimeout(() => {
      setHasFailure(false);
      setIsResolving(false);
      setShowIssueModal(false);
    }, 700);
  };

  const handleGeneratePackage = () => {
    if (!isAllPassed) return;
    setPackageGenerated(true);
    if (onProceedToPackages) {
      setTimeout(() => {
        onProceedToPackages();
      }, 500);
    } else {
      setTimeout(() => setPackageGenerated(false), 3000);
    }
  };

  return (
    <div className="h-screen max-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-4 px-8 font-sans select-none overflow-hidden">
      {/* Top Bar: Minimal Navigation & Meta */}
      <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-2">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Inputs</span>
          </button>
          <span className="text-zinc-300">•</span>
          {onOpenProcessing && (
            <button
              onClick={onOpenProcessing}
              className="hover:text-zinc-900 transition-colors font-mono"
            >
              Processing 3D &rarr;
            </button>
          )}
          {onOpenCanonicalModel && (
            <>
              <span className="text-zinc-300">•</span>
              <button
                onClick={onOpenCanonicalModel}
                className="hover:text-zinc-900 transition-colors font-mono"
              >
                Canonical Model &rarr;
              </button>
            </>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <span className="font-mono text-zinc-400 text-xs font-medium">
            {projectName}
          </span>
          <span className="text-zinc-300">•</span>
          <span className="font-mono tracking-[0.2em] font-semibold text-zinc-400">
            NAKSHA 2.0
          </span>
        </div>
      </div>

      {/* Main Header & Simulation Toggle */}
      <div className="flex items-center justify-between pb-3 mb-6 border-b border-zinc-100">
        <div>
          <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase">
            PHASE 18 — PRE-OUTPUT GATEKEEPER
          </div>
          <div className="text-xl font-bold font-mono tracking-tight text-zinc-900 mt-0.5">
            FINAL VALIDATION
          </div>
          <div className="text-xs font-mono text-zinc-500 mt-0.5">
            Before outputs are generated • Strict certification barrier
          </div>
        </div>

        {/* Diagnostic Simulator Toggle */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={() => setHasFailure(false)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              !hasFailure
                ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs'
                : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            Clean Audit (100%)
          </button>
          <button
            onClick={() => setHasFailure(true)}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center space-x-1.5 ${
              hasFailure
                ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs'
                : 'bg-zinc-50 text-rose-600 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Simulate Failure (Unit 304)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full flex-1 flex items-center justify-center my-auto">
        <div className="w-full max-w-xl bg-white border border-zinc-200/90 rounded-3xl p-8 shadow-xs">
          {/* Header Title */}
          <div className="text-center mb-6">
            <div className="text-sm font-mono font-bold tracking-[0.2em] text-zinc-400 uppercase">
              FINAL VALIDATION
            </div>
          </div>

          {/* The 8 Canonical Checklist Items */}
          <div className="space-y-3 font-mono text-sm max-w-md mx-auto">
            {checksList.map(item => (
              <div 
                key={item.id}
                className="flex items-center justify-between py-1 border-b border-zinc-100/80"
              >
                <span className="text-zinc-800 tracking-wide font-medium">
                  {item.label}
                </span>

                <span className="w-6 text-right flex items-center justify-end font-bold select-none">
                  {item.isPassed ? (
                    <span className="text-zinc-900 text-base">✓</span>
                  ) : (
                    <span className="text-rose-600 text-base font-bold animate-pulse">✗</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Big Authoritative Percentage Display */}
          <div className="text-center my-8">
            <div className={`text-5xl font-bold font-mono tracking-tight ${
              isAllPassed ? 'text-zinc-900' : 'text-rose-600'
            }`}>
              {progressPct}%
            </div>
          </div>

          {/* ================= IF SOMETHING FAILS BANNER ================= */}
          {hasFailure && (
            <div className="mt-4 p-5 rounded-2xl bg-rose-50 border border-rose-200/80 text-center animate-in fade-in duration-200">
              <div className="text-sm font-mono font-bold tracking-widest text-rose-700 uppercase">
                FAILED
              </div>

              <div className="text-xs font-mono text-rose-950 font-bold mt-2">
                Unit 304
              </div>

              <div className="text-xs font-mono text-rose-800 mt-0.5">
                Boundary overlap detected
              </div>

              <div className="mt-4">
                <button
                  onClick={() => setShowIssueModal(true)}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-xs"
                >
                  [ VIEW ISSUE ]
                </button>
              </div>
            </div>
          )}

          {/* Package Generation Gating Action Button */}
          <div className="mt-8 flex flex-col items-center">
            {isAllPassed ? (
              <button
                onClick={handleGeneratePackage}
                className="w-full max-w-sm py-3.5 px-6 rounded-xl bg-zinc-900 hover:bg-black active:scale-98 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center space-x-2"
              >
                <FileDown className="w-4 h-4" />
                <span>GENERATE FINAL PACKAGE</span>
              </button>
            ) : (
              <div className="w-full max-w-sm py-3 px-4 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-400 font-mono text-xs font-semibold flex items-center justify-center space-x-2 cursor-not-allowed select-none">
                <Lock className="w-4 h-4 text-zinc-400" />
                <span>PACKAGE GENERATION LOCKED</span>
              </div>
            )}

            <div className="text-[11px] font-mono text-zinc-400 mt-2.5 text-center">
              {isAllPassed 
                ? 'All 8 legal & spatial gates passed • Certified for output generation'
                : "Don't allow invalid data to silently enter the final package."}
            </div>

            {packageGenerated && (
              <div className="mt-3 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono rounded-lg flex items-center space-x-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Package generated: NAKSHA_PUNE_001_DELIVERABLES.zip ready for export.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= ISSUE INSPECTION MODAL ================= */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-zinc-200 shadow-xl font-mono text-xs animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center space-x-2 text-rose-600 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span className="uppercase tracking-wider">CADASTRAL ISSUE INSPECTION</span>
              </div>
              <button 
                onClick={() => setShowIssueModal(false)}
                className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="font-bold text-rose-900 text-sm">
                  Unit 304 — Boundary overlap detected
                </div>
                <div className="text-zinc-600 text-xs mt-1">
                  The 3D volumetric partition of Unit 304 overlaps with adjacent Unit 303 along the western demising wall.
                </div>
              </div>

              <div className="space-y-1.5 text-zinc-700">
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-400">Target Entity:</span>
                  <span className="font-semibold text-zinc-900">Unit 304 (Floor 3)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-400">Conflicting Entity:</span>
                  <span className="font-semibold text-zinc-900">Unit 303 (Floor 3)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-400">Overlap Magnitude:</span>
                  <span className="font-semibold text-rose-600">14 cm (0.42 m³ volume)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-400">Coordinates Extent:</span>
                  <span className="font-semibold text-zinc-900">X: 385433.72 - 385433.86</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-400">Regulatory Impact:</span>
                  <span className="font-semibold text-rose-700">Violation of ISO 19152 §5.2 Disjoint Strata Space</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
              <button
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-semibold"
              >
                Close
              </button>

              <button
                onClick={handleAutoResolve}
                disabled={isResolving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center space-x-1.5 shadow-sm transition-all"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isResolving ? 'Resolving Overlap...' : 'AUTO-RESOLVE OVERLAP'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimal Footer */}
      <div className="w-full text-center text-[11px] font-mono text-zinc-400 pt-3">
        Phase 18 • Validation Engine • 8 Pre-flight Quality Audits • Don't allow invalid data to silently enter the final package
      </div>
    </div>
  );
};
