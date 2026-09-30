import React, { useState } from 'react';
import { Check, ChevronRight, Server } from 'lucide-react';
import { AssignedParcel } from '../../services/surveyApi';
import { BACKEND_URL } from '../../config/api';
import { BackendConfigModal } from '../BackendConfigModal';

export type SurveyStep = 
  | 'PARCEL'
  | 'INPUTS'
  | 'VALIDATION'
  | 'CONSTRUCTION'
  | 'PROPERTY'
  | 'REPORT'
  | 'ULPIN'
  | 'PROPERTY_CARD'
  | 'COMPLETE';

interface SurveyHeaderProps {
  currentStep: SurveyStep;
  activeParcel: AssignedParcel | null;
  onNavigateToStep?: (step: SurveyStep) => void;
  onResetToParcels: () => void;
}

const STEPS: { id: SurveyStep; label: string; num: number }[] = [
  { id: 'PARCEL', label: 'PARCEL', num: 1 },
  { id: 'INPUTS', label: 'INPUTS', num: 2 },
  { id: 'VALIDATION', label: 'VALIDATION', num: 3 },
  { id: 'CONSTRUCTION', label: '3D CONSTRUCTION', num: 4 },
  { id: 'PROPERTY', label: '3D PROPERTY', num: 5 },
  { id: 'REPORT', label: 'REPORT', num: 6 },
  { id: 'ULPIN', label: 'ULPIN', num: 7 },
  { id: 'PROPERTY_CARD', label: 'PROPERTY CARD', num: 8 },
  { id: 'COMPLETE', label: 'COMPLETE', num: 9 },
];

export const SurveyHeader: React.FC<SurveyHeaderProps> = ({
  currentStep,
  activeParcel,
  onResetToParcels
}) => {
  const currentStepIdx = STEPS.findIndex(s => s.id === currentStep);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const isLocal = BACKEND_URL.includes('127.0.0.1') || BACKEND_URL.includes('localhost');

  return (
    <header className="h-14 px-6 bg-white border-b border-zinc-200/90 flex items-center justify-between z-30 select-none">
      {/* Brand Identity */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onResetToParcels}
          className="flex items-center space-x-2 text-zinc-900 hover:opacity-80 transition-opacity"
          title="Return to Assigned Parcels"
        >
          <img 
            src="/logo.png" 
            alt="Naksha 2.0" 
            className="h-8 max-w-[150px] object-contain" 
            onError={(e) => {
              // Graceful fallback if image is not loaded
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </button>

        {activeParcel && (
          <div className="hidden md:flex items-center space-x-2 pl-3 border-l border-zinc-200">
            <span className="text-[10px] font-mono font-medium text-zinc-400 uppercase">
              PARCEL
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
              {activeParcel.surveyNumber}/{activeParcel.subDivision}
            </span>
            <span className="text-[11px] text-zinc-400 truncate max-w-xs">
              {activeParcel.location}
            </span>
          </div>
        )}
      </div>

      {/* 9-Step Linear Progress Rail */}
      <nav aria-label="Survey Workflow Stepper" className="hidden lg:flex items-center space-x-1">
        {STEPS.map((s, idx) => {
          const isActive = currentStep === s.id;
          const isPassed = currentStepIdx > idx;

          return (
            <React.Fragment key={s.id}>
              <div 
                className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  isActive 
                    ? 'font-bold text-zinc-900 bg-zinc-100' 
                    : isPassed 
                    ? 'text-zinc-600' 
                    : 'text-zinc-300'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isActive 
                    ? 'bg-zinc-900 text-white' 
                    : isPassed 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-zinc-100 text-zinc-400'
                }`}>
                  {isPassed ? <Check className="w-2.5 h-2.5" /> : s.num}
                </span>
                <span>{s.label}</span>
              </div>

              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-3 h-3 text-zinc-300 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Step Indicator on small screens */}
      <div className="flex lg:hidden items-center space-x-2 text-xs font-mono text-zinc-500">
        <span className="font-bold text-zinc-900">STEP {currentStepIdx + 1}</span>
        <span>OF 9</span>
      </div>

      {/* Right Controls: Backend Cloud Status & Authority Stamp */}
      <div className="flex items-center space-x-3 text-[11px] font-mono">
        <button
          onClick={() => setIsConfigOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md border border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100 transition-colors text-[11px] text-zinc-700"
          title="Server Connection & Cloud Settings"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">{isLocal ? 'LOCAL ENGINE' : 'RENDER CLOUD'}</span>
          <Server className="w-3 h-3 text-zinc-400 ml-0.5" />
        </button>

        <span className="hidden sm:inline text-zinc-400">SURVEY TEAM WORKFLOW</span>
      </div>

      <BackendConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
      />
    </header>
  );
};
