import React, { useState } from 'react';
import { 
  ArrowLeft, 
  RotateCcw, 
  ShieldCheck, 
  FileCheck 
} from 'lucide-react';
import { Real3DViewer, CadastralUnitInfo } from './Real3DViewer';
import { 
  CANONICAL_PROCESSING_STAGES, 
  ProcessingStageId, 
  ProcessingStageMetadata 
} from '../types/naksha';

interface ProcessingScreenProps {
  projectName?: string;
  onBack: () => void;
  onOpenWorkspace: () => void;
}

interface ProcessingStep {
  name: string;
  status: 'done' | 'active' | 'pending';
}

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({
  projectName = 'Pune Residential 001',
  onBack,
  onOpenWorkspace
}) => {
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(2); // Defaults to Stage 3 FUSION
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(true);
  const [selectedUnit, setSelectedUnit] = useState<CadastralUnitInfo>({
    id: 'UNIT-402',
    floor: 4,
    unitNumber: '402',
    owner: 'Rajesh M. Patil',
    ctsNumber: 'CTS 142/B-402',
    ulpin: 'MH-PUN-2026-0942-8812',
    areaSqM: 84.5,
    status: 'VERIFIED'
  });

  const stageList: ProcessingStageMetadata[] = CANONICAL_PROCESSING_STAGES;
  const currentStageMeta = stageList[currentStageIdx];
  const currentStage: ProcessingStageId = currentStageMeta.id;

  // Dynamic pipeline steps reflecting the active stage
  const getDynamicSteps = (stageIdx: number): ProcessingStep[] => {
    const baseSteps = [
      'Data Validation',
      'Coordinate Alignment',
      'Photogrammetry',
      'LiDAR Processing',
      'Point Cloud Fusion',
      'Building Reconstruction',
      'Property Segmentation',
      'Record Matching',
      'Validation',
      'Package Generation'
    ];

    const activeStepIdx = stageIdx + 2;

    return baseSteps.map((name, i) => {
      if (i < activeStepIdx) {
        return { name, status: 'done' };
      } else if (i === activeStepIdx) {
        return { name, status: 'active' };
      } else {
        return { name, status: 'pending' };
      }
    });
  };

  const currentSteps = getDynamicSteps(currentStageIdx);

  return (
    <div className="h-screen max-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-4 px-8 font-sans select-none overflow-hidden">
      {/* Top Bar: Minimal Navigation & Brand */}
      <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-2">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Pipeline</span>
        </button>

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

      {/* Main Three-Column Layout */}
      <div className="w-full flex-1 flex items-stretch justify-between gap-8 my-auto">
        {/* ================= LEFT COLUMN: PROCESSING ================= */}
        <div className="w-64 flex flex-col justify-between py-2">
          <div>
            <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-6">
              PROCESSING
            </div>

            {/* Checklist of 10 Pipeline Stages */}
            <div className="space-y-3.5 font-mono text-xs">
              {currentSteps.map((step, sIdx) => {
                const isDone = step.status === 'done';
                const isActive = step.status === 'active';
                const targetStageIdx = sIdx - 2;
                const isClickable = targetStageIdx >= 0 && targetStageIdx < stageList.length;

                return (
                  <div 
                    key={step.name} 
                    onClick={() => {
                      if (isClickable) setCurrentStageIdx(targetStageIdx);
                    }}
                    className={`flex items-center space-x-3 transition-colors ${
                      isClickable ? 'cursor-pointer hover:text-zinc-900' : ''
                    } ${
                      isActive 
                        ? 'text-zinc-900 font-semibold' 
                        : isDone 
                        ? 'text-zinc-800' 
                        : 'text-zinc-300'
                    }`}
                  >
                    <span className="w-3.5 text-center flex items-center justify-center">
                      {isDone ? (
                        <span className="text-zinc-900 font-bold select-none">✓</span>
                      ) : isActive ? (
                        <span className="text-blue-500 font-bold animate-pulse select-none text-[10px]">●</span>
                      ) : (
                        <span className="text-zinc-300 font-normal select-none text-[10px]">○</span>
                      )}
                    </span>
                    <span className="tracking-wide">{step.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action button at Stage 7 */}
          {currentStageIdx === 6 && (
            <button
              onClick={onOpenWorkspace}
              className="mt-6 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-sm flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>INSPECT CADASTRE</span>
            </button>
          )}
        </div>

        {/* ================= CENTER COLUMN: REAL 3D VIEWER ================= */}
        <div className="flex-1 flex flex-col items-center justify-between py-1">
          {/* Header Tag */}
          <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase text-center mb-2">
            REAL 3D VIEWER
          </div>

          {/* 7-Stage Horizontal Stepper */}
          <div className="flex items-center justify-center gap-1.5 font-mono text-[11px] mb-3 flex-wrap">
            {stageList.map((st, idx) => {
              const isActive = currentStageIdx === idx;
              const isPast = currentStageIdx > idx;

              return (
                <React.Fragment key={st.id}>
                  <button
                    onClick={() => setCurrentStageIdx(idx)}
                    className={`px-2 py-0.5 rounded transition-all text-[11px] ${
                      isActive
                        ? 'bg-zinc-900 text-white font-bold shadow-sm'
                        : isPast
                        ? 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 font-medium'
                        : 'text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    {st.stageNumber}. {st.name}
                  </button>
                  {idx < stageList.length - 1 && (
                    <span className="text-zinc-300 font-mono text-xs select-none">
                      →
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Active Stage Subtitle Banner */}
          <div className="w-full text-center mb-3">
            <div className="text-xs font-mono font-bold text-zinc-800 tracking-wider">
              {currentStageMeta.title}
            </div>
            <div className="text-[11px] font-mono text-blue-600 mt-0.5">
              {currentStageMeta.subflow}
            </div>
          </div>

          {/* 3D Viewport Window */}
          <div className="w-full flex-1 min-h-[420px] max-h-[540px] rounded-2xl border border-zinc-100 bg-white relative overflow-hidden flex items-center justify-center">
            <Real3DViewer 
              currentStage={currentStage} 
              autoRotate={isAutoRotate}
              selectedUnitId={selectedUnit.id}
              onSelectUnit={(unit) => setSelectedUnit(unit)}
            />

            {/* Stage 6 Callout Overlay: 3D Unit <-> Government Record */}
            {currentStage === 'STAGE_6_RECORD_MATCHING' && (
              <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md border border-blue-200 rounded-xl p-3.5 shadow-lg max-w-xs text-left animate-in fade-in duration-300">
                <div className="flex items-center space-x-1.5 text-blue-600 text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
                  <FileCheck className="w-3 h-3" />
                  <span>3D Unit ↔ Government Record</span>
                </div>
                <div className="text-xs font-bold text-zinc-900">
                  Unit {selectedUnit.unitNumber} (Floor {selectedUnit.floor})
                </div>
                <div className="text-[11px] font-mono text-zinc-600 mt-1 space-y-0.5">
                  <div>Owner: <span className="font-semibold text-zinc-800">{selectedUnit.owner}</span></div>
                  <div>Record: <span className="font-semibold text-zinc-800">{selectedUnit.ctsNumber}</span></div>
                  <div>ULPIN: <span className="font-semibold text-zinc-800">{selectedUnit.ulpin}</span></div>
                  <div>Carpet Area: <span className="font-semibold text-zinc-800">{selectedUnit.areaSqM} m²</span></div>
                </div>
                <div className="mt-2 text-[10px] font-mono text-emerald-600 font-bold flex items-center space-x-1">
                  <span>✓ 100% REVENUE TITLE MATCHED</span>
                </div>
              </div>
            )}

            {/* Stage 7 Callout Overlay: 4 Certified Validation Checks */}
            {currentStage === 'STAGE_7_VALIDATION' && (
              <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md border border-emerald-200 rounded-xl p-3.5 shadow-lg max-w-xs text-left animate-in fade-in duration-300">
                <div className="flex items-center space-x-1.5 text-emerald-700 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>CADASTRAL VALIDATION</span>
                </div>
                <div className="space-y-1 font-mono text-xs">
                  <div className="text-emerald-700 font-semibold flex items-center space-x-1.5">
                    <span>✓</span> <span>Boundary: Confirmed</span>
                  </div>
                  <div className="text-emerald-700 font-semibold flex items-center space-x-1.5">
                    <span>✓</span> <span>Coordinates: EPSG:32643</span>
                  </div>
                  <div className="text-emerald-700 font-semibold flex items-center space-x-1.5">
                    <span>✓</span> <span>Topology: 0 Overlaps</span>
                  </div>
                  <div className="text-emerald-700 font-semibold flex items-center space-x-1.5">
                    <span>✓</span> <span>Record: 7/12 Title Matched</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom 3D Viewport Controls (No video controls) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-zinc-200/80 rounded-full px-4 py-1.5 shadow-sm flex items-center space-x-3 text-xs text-zinc-600">
              <button
                onClick={() => setIsAutoRotate(!isAutoRotate)}
                title="Toggle 360° Auto-Rotate"
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  isAutoRotate ? 'bg-zinc-100 text-zinc-900 font-semibold' : 'text-zinc-400 hover:text-zinc-700'
                }`}
              >
                Auto-Rotate 360°
              </button>

              <div className="h-3 w-px bg-zinc-200" />

              <button
                onClick={() => setIsAutoRotate(false)}
                title="Reset Camera Angle"
                className="hover:text-zinc-900 transition-colors p-1 flex items-center space-x-1 text-[10px] font-mono text-zinc-500"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset View</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: STATUS ================= */}
        <div className="w-64 flex flex-col justify-start py-2 pl-4">
          <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-6">
            STATUS
          </div>

          <div className="space-y-5">
            {/* Point Cloud Metric */}
            <div>
              <div className="text-xs font-mono text-zinc-400">
                Point Cloud
              </div>
              <div className="text-xl font-bold font-mono text-zinc-900 mt-0.5">
                {currentStageMeta.pointsMetric}
              </div>
            </div>

            {/* Buildings Metric */}
            <div>
              <div className="text-xs font-mono text-zinc-400">
                Buildings
              </div>
              <div className="text-xl font-bold font-mono text-zinc-900 mt-0.5">
                {currentStageMeta.buildingsCount}
              </div>
            </div>

            {/* Floors Metric */}
            <div>
              <div className="text-xs font-mono text-zinc-400">
                Floors
              </div>
              <div className="text-xl font-bold font-mono text-zinc-900 mt-0.5">
                {currentStageMeta.floorsCount}
              </div>
            </div>

            {/* Units Metric */}
            <div>
              <div className="text-xs font-mono text-zinc-400">
                Units
              </div>
              <div className="text-xl font-bold font-mono text-zinc-900 mt-0.5">
                {currentStageMeta.unitsCount}
              </div>
            </div>

            {/* Stage 6 & 7: Government Records Matched */}
            {currentStageIdx >= 5 && (
              <div className="pt-2 border-t border-zinc-100">
                <div className="text-xs font-mono text-zinc-400">
                  Government Records
                </div>
                <div className="text-lg font-bold font-mono text-blue-600 mt-0.5">
                  64 / 64 (100%)
                </div>
              </div>
            )}

            {/* Stage 7: Validation Audits */}
            {currentStageIdx === 6 && (
              <div className="pt-2 border-t border-zinc-100">
                <div className="text-xs font-mono text-zinc-400">
                  Validation
                </div>
                <div className="text-xs font-mono font-semibold text-emerald-600 mt-1 space-y-0.5">
                  <div>✓ Boundary</div>
                  <div>✓ Coordinates</div>
                  <div>✓ Topology</div>
                  <div>✓ Record</div>
                </div>
              </div>
            )}

            {/* Progress Metric */}
            <div className="pt-2 border-t border-zinc-100">
              <div className="text-xs font-mono text-zinc-400">
                Progress
              </div>
              <div className="text-3xl font-bold font-mono text-zinc-900 mt-0.5">
                {currentStageMeta.progressPct}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Single-Line Footer */}
      <div className="w-full text-center text-[11px] font-mono text-zinc-400 pt-3">
        Very little text • The 3D model communicates what is happening • Phase 14
      </div>
    </div>
  );
};
