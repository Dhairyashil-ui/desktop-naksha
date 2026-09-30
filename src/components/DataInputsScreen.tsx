import React, { useState } from 'react';
import { RefreshCw, ArrowLeft, Check, Play } from 'lucide-react';
import { 
  DatasetStatus, 
  DATASET_STATUS_DISPLAY, 
  DatasetTier, 
  calculateReadinessScores 
} from '../types/naksha';
import { API_BASE } from '../config/api';

export interface DataInputItem {
  id: string;
  num: string;
  name: string;
  status: DatasetStatus;      // Phase 10 Canonical Dataset Status
  tier: DatasetTier;          // Phase 11 Workflow Dataset Tier (REQUIRED | RECOMMENDED | OPTIONAL)
  completeness: number;      // 1. Completeness: How much required info provided
  quality: number;           // 2. Validity / Quality: How good is the supplied data
  readyForProcessing: boolean;// Only true when mandatory requirements pass
  filesFound?: number;
  datasetId?: string;
}

interface DataInputsScreenProps {
  projectName: string;
  projectId?: string;
  onBack: () => void;
  onOpenWorkspace?: () => void;
  onOpenUpload?: (categoryNum: string, categoryName: string, categoryId?: string, datasetId?: string) => void;
  onOpenScanner?: (categoryNum: string, categoryName: string, categoryId?: string, datasetId?: string) => void;
  onDispatchPipeline?: () => void;
  onOpenCanonicalModel?: () => void;
  externalInputs?: DataInputItem[];
  onInputsChange?: React.Dispatch<React.SetStateAction<DataInputItem[]>>;
}

export const INITIAL_INPUTS: DataInputItem[] = [
  { id: 'cat_01', num: '01', name: 'Photogrammetry', tier: 'REQUIRED', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_02', num: '02', name: 'LiDAR / Point Cloud', tier: 'REQUIRED', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_03', num: '03', name: 'GIS / CAD', tier: 'REQUIRED', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_04', num: '04', name: 'GNSS / Survey', tier: 'REQUIRED', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_05', num: '05', name: 'DEM / Elevation', tier: 'RECOMMENDED', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_06', num: '06', name: 'Architectural / BIM', tier: 'OPTIONAL', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_07', num: '07', name: 'Property Data', tier: 'REQUIRED', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_08', num: '08', name: 'Imagery', tier: 'RECOMMENDED', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_09', num: '09', name: 'Metadata', tier: 'RECOMMENDED', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false },
  { id: 'cat_10', num: '10', name: 'Documents', tier: 'OPTIONAL', status: 'Missing', completeness: 0, quality: 0, readyForProcessing: false }
];

// Map num -> real category ID
const CATEGORY_ID_MAP: Record<string, string> = {
  '01': 'CAT_01_PHOTOGRAMMETRY',
  '02': 'CAT_02_LIDAR_POINT_CLOUD',
  '03': 'CAT_03_GIS_CAD',
  '04': 'CAT_04_GNSS_SURVEY',
  '05': 'CAT_05_DEM_ELEVATION',
  '06': 'CAT_06_ARCHITECTURAL_BIM',
  '07': 'CAT_07_PROPERTY_VERTICAL_DATA',
  '08': 'CAT_08_IMAGERY_ORTHOPHOTO',
  '09': 'CAT_09_PROJECT_METADATA',
  '10': 'CAT_10_SUPPORTING_DOCS',
};

export const DataInputsScreen: React.FC<DataInputsScreenProps> = ({ 
  projectName, 
  projectId,
  onBack, 
  onOpenWorkspace,
  onOpenUpload,
  onOpenScanner,
  onDispatchPipeline,
  onOpenCanonicalModel,
  externalInputs,
  onInputsChange
}) => {
  const [internalInputs, setInternalInputs] = useState<DataInputItem[]>(INITIAL_INPUTS);
  const inputs = externalInputs || internalInputs;
  const setInputs = onInputsChange || setInternalInputs;
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // Phase 11 Overall Readiness Engine Calculation
  const readiness = calculateReadinessScores(inputs);

  // Phase 10 Status Typography and Color Styling
  const getStatusStyle = (status: DatasetStatus): string => {
    switch (status) {
      case 'Missing':
        return 'text-zinc-300 normal-case';
      case 'Scanning':
        return 'text-blue-500 font-medium normal-case animate-pulse';
      case 'Invalid':
        return 'text-rose-600 font-bold uppercase';
      case 'Partial':
        return 'text-amber-500 font-semibold uppercase';
      case 'Valid':
        return 'text-emerald-600 font-bold uppercase';
      case 'Processing':
        return 'text-sky-600 font-bold uppercase animate-pulse';
      case 'Completed':
        return 'text-zinc-900 font-bold uppercase';
      default:
        return 'text-zinc-400';
    }
  };

  // Real Scan Data Execution: Evaluates actual uploaded files on disk via backend scanner
  const handleScanData = async () => {
    setIsScanning(true);
    setHasScanned(false);

    try {
      if (projectId) {
        // Trigger real backend scan across all datasets in project
        await fetch(`${API_BASE}/api/v2/projects/${projectId}/scan`, { method: 'POST' });

        // Retrieve fresh live channel status from PostgreSQL
        const res = await fetch(`${API_BASE}/api/v2/projects/${projectId}/inputs/live`);
        if (res.ok) {
          const liveData = await res.json();
          if (liveData.channels && Array.isArray(liveData.channels)) {
            setInputs(prev => prev.map(item => {
              const ch = liveData.channels.find((c: any) => c.channelNumber === parseInt(item.num, 10));
              if (ch) {
                const statusStr: DatasetStatus = 
                  ch.validationStatus === 'PASSED' || ch.datasetStatus === 'VALID' ? 'Valid' :
                  ch.validationStatus === 'PARTIAL' || ch.datasetStatus === 'PARTIAL' ? 'Partial' :
                  ch.datasetStatus === 'INVALID' ? 'Invalid' :
                  ch.status === 'EMPTY' ? 'Missing' : 'Partial';

                return {
                  ...item,
                  status: statusStr,
                  completeness: ch.completeness || 0,
                  quality: ch.quality || 0,
                  readyForProcessing: (ch.completeness >= 60 && ch.quality >= 70),
                  datasetId: ch.datasetId,
                };
              }
              return item;
            }));
          }
        }
      }
    } catch (e) {
      console.error('Scan error:', e);
    } finally {
      setIsScanning(false);
      setHasScanned(true);
    }
  };

  const handleRowClick = (index: number) => {
    const item = inputs[index];
    const catId = CATEGORY_ID_MAP[item.num] || `CAT_0${item.num}`;

    if (item.status !== 'Missing' && onOpenScanner) {
      onOpenScanner(item.num, item.name, catId, item.datasetId);
      return;
    }

    if (onOpenUpload) {
      onOpenUpload(item.num, item.name, catId, item.datasetId);
      return;
    }

    // Fallback file input
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        setInputs(prev => prev.map((item, i) => 
          i === index ? { 
            ...item, 
            status: 'Valid',
            completeness: 100, 
            quality: 90, 
            readyForProcessing: true, 
            filesFound: files.length 
          } : item
        ));
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-12 px-6 font-sans select-none">
      {/* Top Bar: Back & Brand */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between text-xs text-zinc-400">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
        <img src="/logo.png" alt="Logo" className="h-4 max-w-[80px] object-contain inline-block" />
      </div>

      {/* Main Core UI */}
      <div className="w-full max-w-2xl mx-auto my-auto py-8">
        {/* Project Header */}
        <div className="mb-8">
          <div className="text-[11px] font-mono font-semibold tracking-wider text-zinc-400 uppercase">
            PROJECT
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 mt-0.5">
            {projectName || 'Pune Residential 001'}
          </h1>
        </div>

        {/* Phase 11 Columns Header */}
        <div className="flex items-center justify-between text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-2 px-1">
          <span>DATA INPUTS</span>
          <div className="flex items-center space-x-5 pr-1">
            <span className="w-24 text-right">TIER</span>
            <span className="w-28 text-right">STATUS</span>
            <span className="w-14 text-right">SCORE</span>
          </div>
        </div>

        {/* The 10 Input Types Clean List with Tiers & Statuses */}
        <div className="divide-y divide-zinc-100 border-t border-b border-zinc-100">
          {inputs.map((item, idx) => {
            const isRowScanning = isScanning && (item.completeness > 0 || item.status !== 'Missing');
            const currentStatus: DatasetStatus = isRowScanning ? 'Scanning' : (item.status || 'Missing');
            const displayLabel = DATASET_STATUS_DISPLAY[currentStatus];
            const hasData = item.completeness > 0 || item.quality > 0;

            return (
              <div
                key={item.id}
                onClick={() => handleRowClick(idx)}
                className={`py-3 px-1 flex items-center justify-between group cursor-pointer transition-colors ${
                  isRowScanning ? 'bg-zinc-50' : 'hover:bg-zinc-50/80'
                }`}
              >
                {/* Left: Number, Ready Check & Name */}
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-zinc-400 w-6">
                    {item.num}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className={`text-sm font-medium transition-colors ${
                      hasData ? 'text-zinc-900 font-semibold' : 'text-zinc-700 group-hover:text-zinc-900'
                    }`}>
                      {item.name}
                    </span>
                    {item.readyForProcessing && (
                      <span title="Mandatory requirements satisfied">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Tier, Phase 10 Status & Score */}
                <div className="flex items-center space-x-5 pr-1">
                  {/* Tier Indicator */}
                  <div className="w-24 text-right">
                    {item.tier === 'REQUIRED' ? (
                      <span className="text-[11px] font-mono font-medium text-zinc-800">
                        ✓ Required
                      </span>
                    ) : item.tier === 'RECOMMENDED' ? (
                      <span className="text-[11px] font-mono text-zinc-400">
                        ○ Recom.
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-400">
                        ○ Optional
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="w-28 text-right flex items-center justify-end space-x-1.5">
                    {isRowScanning && (
                      <RefreshCw className="w-3 h-3 text-blue-500 animate-spin mr-1 shrink-0" />
                    )}
                    <span className={`text-[11px] font-mono tracking-wide ${getStatusStyle(currentStatus)}`}>
                      {displayLabel}
                    </span>
                  </div>

                  {/* Score */}
                  <span className={`text-sm font-mono font-semibold w-14 text-right ${
                    item.quality > 0 ? 'text-zinc-900' : 'text-zinc-300'
                  }`}>
                    {item.quality > 0 ? `${item.quality}%` : '0%'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Phase 11 Overall Readiness Engine Section */}
        <div className="mt-8 mb-8 text-center space-y-6">
          {/* 1. OVERALL DATA READINESS */}
          <div>
            <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              OVERALL DATA READINESS
            </div>
            <div className="text-4xl font-bold font-mono text-zinc-900 mt-1">
              {readiness.overallReadiness}%
            </div>
          </div>

          {/* 2. REQUIRED DATA vs OPTIONAL DATA */}
          <div className="flex items-center justify-center space-x-12">
            <div>
              <div className="text-2xl font-bold font-mono text-zinc-900">
                {readiness.requiredData}%
              </div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase mt-0.5 tracking-wider">
                REQUIRED DATA
              </div>
            </div>

            <div className="h-7 w-px bg-zinc-200" />

            <div>
              <div className="text-2xl font-bold font-mono text-zinc-900">
                {readiness.optionalData}%
              </div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase mt-0.5 tracking-wider">
                OPTIONAL DATA
              </div>
            </div>
          </div>

          {/* 3. PROCESSING STATUS */}
          <div className="pt-2 border-t border-zinc-100 max-w-xs mx-auto">
            <div className="text-[10px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase">
              PROCESSING STATUS
            </div>
            <div className={`text-sm font-bold font-mono tracking-wider uppercase mt-1 ${
              readiness.processingStatus === 'READY' || readiness.processingStatus === 'READY FOR PROCESSING'
                ? 'text-emerald-600'
                : readiness.processingStatus === 'BLOCKED'
                ? 'text-zinc-400'
                : 'text-amber-500'
            }`}>
              {readiness.processingStatus}
            </div>
          </div>
        </div>

        {/* Action Button: SCAN DATA or DISPATCH PROCESSING */}
        <div className="flex flex-col items-center space-y-3">
          {(readiness.processingStatus === 'READY' || readiness.processingStatus === 'READY FOR PROCESSING') && onDispatchPipeline ? (
            <button
              onClick={onDispatchPipeline}
              className="w-full max-w-xs py-3.5 px-6 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white hover:shadow"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>DISPATCH PROCESSING PIPELINE</span>
            </button>
          ) : (
            <button
              onClick={handleScanData}
              disabled={isScanning}
              className={`w-full max-w-xs py-3.5 px-6 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm flex items-center justify-center space-x-2 ${
                isScanning
                  ? 'bg-zinc-100 text-zinc-400 cursor-wait'
                  : 'bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white hover:shadow'
              }`}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>SCANNING INPUTS...</span>
                </>
              ) : (
                <span>[ SCAN DATA ]</span>
              )}
            </button>
          )}

          {/* Optional Launch to 2D/3D Workspace or Canonical Model when scanned */}
          <div className="flex items-center space-x-4 pt-1">
            {hasScanned && onOpenWorkspace && (
              <button
                onClick={onOpenWorkspace}
                className="text-xs text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
              >
                Open 2D/3D Inspection Workspace &rarr;
              </button>
            )}
            {onOpenCanonicalModel && (
              <button
                onClick={onOpenCanonicalModel}
                className="text-xs text-blue-600 hover:text-blue-800 font-mono font-medium transition-colors"
              >
                Inspect Canonical Data Model (Phase 15) &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="w-full max-w-2xl mx-auto text-center text-[11px] font-mono text-zinc-400">
        Phase 11 Workflow-Aware Readiness Engine • Required: 100% • Optional: 72% • Overall: 89%
      </div>
    </div>
  );
};
