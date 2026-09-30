import React from 'react';
import { ShieldCheck, Cpu, HardDrive, Play, Activity, Plus, ListOrdered, GitBranch, Box, Database, Layers, FileCheck2, Package } from 'lucide-react';
import { ProjectVirtualState } from '../types/naksha';

interface HeaderProps {
  project: ProjectVirtualState;
  onDispatchPipeline: () => void;
  onNewProject: () => void;
  onOpenInputs?: () => void;
  onOpenJobGraph?: () => void;
  onOpenProcessing?: () => void;
  onOpenCanonicalModel?: () => void;
  onOpenPropertyLayer?: () => void;
  onOpenRecordMatching?: () => void;
  onOpenValidation?: () => void;
  onOpenPackages?: () => void;
  onOpenArchitecture?: () => void;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  project, 
  onDispatchPipeline, 
  onNewProject, 
  onOpenInputs, 
  onOpenJobGraph, 
  onOpenProcessing, 
  onOpenCanonicalModel, 
  onOpenPropertyLayer, 
  onOpenRecordMatching, 
  onOpenValidation, 
  onOpenPackages, 
  onOpenArchitecture,
  isProcessing 
}) => {
  return (
    <header className="h-16 px-6 bg-naksha-dark border-b border-naksha-border flex items-center justify-between z-20">
      {/* Brand & Project Identity */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <img 
            src="/logo.png" 
            alt="Naksha 2.0 Logo" 
            className="h-8 max-w-[120px] object-contain rounded" 
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-mono font-medium border border-blue-500/30">DESKTOP</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Land Cadastre & Geospatial Intelligence</div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-700/60" />

        {/* Project Metadata */}
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-200">{project.title}</span>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              {project.projectCode}
            </span>
            {project.status && (
              <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase">
                {project.status}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-3 truncate max-w-md">
            {project.location ? (
              <span className="truncate">{project.location}</span>
            ) : (
              <span>CRS: <strong className="text-slate-300 font-mono">{project.targetCrs}</strong></span>
            )}
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              Tier 1 (Cadastral &le;2cm)
            </span>
          </div>
        </div>
      </div>

      {/* System Status Indicators & Action CTA */}
      <div className="flex items-center space-x-4">
        {/* Runtime Diagnostics */}
        <button
          onClick={onOpenArchitecture}
          title="Inspect PostgreSQL 17 + PostGIS Live Architecture (Phase 21)"
          className="hidden lg:flex items-center space-x-3 text-[11px] font-mono text-slate-400 bg-slate-900/60 hover:bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Core Online</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Celery: 4 Workers</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-slate-200 font-semibold">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span>PostGIS (Live)</span>
          </div>
        </button>

        {/* 10 Inputs Screen Button */}
        {onOpenInputs && (
          <button
            onClick={onOpenInputs}
            title="Open 10 Data Inputs screen"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
          >
            <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
            <span>10 Inputs</span>
          </button>
        )}

        {/* Phase 12 Job Graph Button */}
        {onOpenJobGraph && (
          <button
            onClick={onOpenJobGraph}
            title="Open DAG Job Graph Pipeline"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
          >
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            <span>JOB 001</span>
          </button>
        )}

        {/* Phase 13 Real 3D Processing Button */}
        {onOpenProcessing && (
          <button
            onClick={onOpenProcessing}
            title="Open Real-time 3D Processing Construction"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
          >
            <Box className="w-3.5 h-3.5 text-emerald-400" />
            <span>3D Process</span>
          </button>
        )}

        {/* Phase 15 Canonical Data Model Button */}
        {onOpenCanonicalModel && (
          <button
            onClick={onOpenCanonicalModel}
            title="Open Canonical Geospatial Data Model (Phase 15)"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>Canonical Model</span>
          </button>
        )}

        {/* Phase 16 3D Property Layer Button */}
        {onOpenPropertyLayer && (
          <button
            onClick={onOpenPropertyLayer}
            title="Open 3D Property Layer (Phase 16)"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>3D Property</span>
          </button>
        )}

        {/* Phase 17 Record Matching Button */}
        {onOpenRecordMatching && (
          <button
            onClick={onOpenRecordMatching}
            title="Open Record Matching Engine (Phase 17)"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Record Match</span>
          </button>
        )}

        {/* Phase 18 Final Validation Button */}
        {onOpenValidation && (
          <button
            onClick={onOpenValidation}
            title="Open Final Validation Gatekeeper (Phase 18)"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Validation</span>
          </button>
        )}

        {/* Phase 19 The 4 Deliverable Packages Button */}
        {onOpenPackages && (
          <button
            onClick={onOpenPackages}
            title="Open The 4 Deliverable Packages (Phase 19)"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
          >
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span>Outputs (4)</span>
          </button>
        )}

        {/* New Project Button */}
        <button
          onClick={onNewProject}
          title="Create or switch project"
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 text-slate-300" />
          <span>New Project</span>
        </button>

        {/* Run Pipeline CTA */}
        <button
          onClick={onDispatchPipeline}
          disabled={isProcessing}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-md ${
            isProcessing
              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95'
          }`}
        >
          {isProcessing ? (
            <>
              <Activity className="w-4 h-4 animate-spin text-amber-400" />
              <span>Processing In Background...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Pipeline</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
