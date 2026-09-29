import React from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileCheck
} from 'lucide-react';
import { InputChannel } from '../types/naksha';

interface PreflightModalProps {
  channel: InputChannel | null;
  onClose: () => void;
}

export const PreflightModal: React.FC<PreflightModalProps> = ({ channel, onClose }) => {
  if (!channel) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono font-bold bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
              INPUT TYPE {channel.channelNumber.toString().padStart(2, '0')}
            </span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {channel.displayName}
                <span className="text-xs font-normal text-slate-400">Pre-Flight Requirement Profile</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-mono">READINESS SCORE</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {channel.readinessScore}%
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">Current Payload State</div>
              <p className="text-sm text-blue-300 font-medium mt-0.5">{channel.primaryMetric}</p>
              <p className="text-xs text-slate-400 mt-1">{channel.summary}</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-slate-500">Extensions:</span>
              <div className="flex gap-1 mt-1">
                {channel.supportedExtensions.map(ext => (
                  <span key={ext} className="text-[10px] font-mono bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                    {ext}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Section 1: Required (Hard Blockers) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Required Attributes (Pre-Flight Gate)
              </h3>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                All Passed
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-300">✓ Primary Data Payload (Images / Points / Vectors)</span>
                <span className="text-emerald-400 font-mono text-[11px]">PRESENT</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-300">✓ Coordinate Reference System (CRS) & Projection</span>
                <span className="text-emerald-400 font-mono text-[11px]">EPSG:32643</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-300">✓ Spatial Bounding Box & 3D Extent</span>
                <span className="text-emerald-400 font-mono text-[11px]">VALID</span>
              </div>
            </div>
          </div>

          {/* Section 2: Automated Quality Checks & Quantitative Metrics */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Automated Deep Quality Checks
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">Laplacian Sharpness (Blur)</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">V_lap = 142.4 (Pass &ge;120)</div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Optimal</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">Calculated Overlap</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">82% Forward / 71% Sidelap</div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Optimal</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">Radiometric Saturation</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">Clipping: 0.4% (&le;2.0%)</div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Optimal</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">Ground Sampling Distance (GSD)</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">2.8 cm / pixel</div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Tier 1 OK</span>
              </div>
            </div>
          </div>

          {/* Section 3: Actionable Surveyor Remediation Card (Phase 1) */}
          {channel.status === 'READY_WITH_WARNINGS' && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1">
                <AlertTriangle className="w-4 h-4" />
                Actionable Surveyor Remediation Notice
              </div>
              <p className="text-xs text-slate-300">
                No-data voids detected in elevation raster (0.8%). While pipeline can proceed with interpolation, hydro-flattening breaklines are recommended for legal accuracy.
              </p>
              <div className="mt-2 text-[11px] text-amber-300 font-mono">
                Suggested Action: Drop companion waterbody polyline shapefile onto DEM card.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-500/20"
          >
            <FileCheck className="w-4 h-4" />
            Confirm Pre-Flight Readiness
          </button>
        </div>
      </div>
    </div>
  );
};
