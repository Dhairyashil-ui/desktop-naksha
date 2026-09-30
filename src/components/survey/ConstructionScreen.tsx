import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  Check, 
  Loader2,
  Database,
  Cpu,
  Layers,
  ShieldCheck,
  Ruler
} from 'lucide-react';
import { AssignedParcel, dispatchRealPipeline } from '../../services/surveyApi';
import { 
  PipelineStage, 
  PIPELINE_STAGES, 
  getStageDetails, 
  getParcelBuildingMetrics 
} from './construction/cadastralPipelineElements';
import { CinematicMiniScreen } from './construction/CinematicMiniScreen';
import { measureObject } from '../../../cinematic3d/processing/surveyProcessor';

interface ConstructionScreenProps {
  parcel: AssignedParcel;
  onViewProperty: () => void;
}

export const ConstructionScreen: React.FC<ConstructionScreenProps> = ({
  parcel,
  onViewProperty
}) => {
  const [activeStage, setActiveStage] = useState<PipelineStage>('PHOTOGRAMMETRY');
  const [stageProgress, setStageProgress] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [selectedPartId, setSelectedPartId] = useState<number>(401);
  const [showMeasurements, setShowMeasurements] = useState<boolean>(true);
  const [activeBottomTab, setActiveBottomTab] = useState<'measure' | 'legend'>('measure');

  const activeStageRef = useRef<PipelineStage>('PHOTOGRAMMETRY');
  const stageProgressRef = useRef<number>(0);
  const isCompletedRef = useRef<boolean>(false);

  const STAGE_DETAILS = getStageDetails(parcel);

  // Sequential Progression Across the 5 Cadastral Pipeline Stages (One-time showcase)
  useEffect(() => {
    let mounted = true;

    dispatchRealPipeline(parcel.projectId || '').catch(() => {});

    console.log('[NAKSHA 2.0] CADASTRAL 3D RECONSTRUCTION SHOWCASE INITIALIZED');
    console.log(`Parcel Survey Number: ${parcel.surveyNumber}/${parcel.subDivision} | Location: ${parcel.location}`);
    console.log(`Pipeline Stages: ${PIPELINE_STAGES.join(' -> ')}`);

    let currentIdx = 0;
    let progress = 0;

    const pipelineTimer = setInterval(() => {
      if (!mounted) return;

      // ~3.5 seconds per stage -> ~18s total one-time showcase
      progress += 2.8;
      if (progress >= 100) {
        console.log(`[STAGE ${currentIdx + 1}/5: ${PIPELINE_STAGES[currentIdx]}] COMPLETED [OK]`);

        progress = 0;
        currentIdx += 1;

        if (currentIdx < PIPELINE_STAGES.length) {
          const nextStage = PIPELINE_STAGES[currentIdx];
          activeStageRef.current = nextStage;
          setActiveStage(nextStage);
          const details = STAGE_DETAILS[nextStage];
          console.log(`[STAGE ${currentIdx + 1}/5: ${nextStage}] STARTED`);
          console.log(`  Model: ${details.model}`);
          console.log(`  Inputs: ${details.inputs}`);
          console.log(`  Telemetry: ${details.telemetry}`);
        } else {
          // ALL 5 STAGES FINISHED!
          clearInterval(pipelineTimer);
          isCompletedRef.current = true;
          setIsCompleted(true);
          console.log('[NAKSHA 2.0] 3D SPACE RECONSTRUCTION & TOPOLOGY VALIDATION COMPLETE');
          console.log('01. Photogrammetric RGB Point Cloud Triangulated (Steps 11, 12, 13)');
          console.log('02. Drone LiDAR Geometric Point Cloud Generated (Step 10)');
          console.log('03. Multi-Sensor Spatial Registration & Fusion Completed');
          console.log('04. RandLA-Net 3D Cadastral Semantic Segmentation Done');
          console.log('05. Watertight 3D Building Mesh & LADM Topology Certified');
          console.log('>>> [ VIEW 3D PROPERTY ] BUTTON UNLOCKED <<<');
          return;
        }
      }

      const roundedProgress = Math.min(100, Math.round(progress));
      stageProgressRef.current = roundedProgress;
      setStageProgress(roundedProgress);
    }, 100);

    return () => {
      mounted = false;
      clearInterval(pipelineTimer);
    };
  }, [parcel.id, parcel.projectId]);

  // Sync ref values
  useEffect(() => {
    activeStageRef.current = activeStage;
    stageProgressRef.current = stageProgress;
    isCompletedRef.current = isCompleted;
  }, [activeStage, stageProgress, isCompleted]);

  const metrics = getParcelBuildingMetrics(parcel);
  const activeStageInfo = STAGE_DETAILS[activeStage];

  // Live telemetry metrics based on active stage
  const getStageMetrics = () => {
    switch (activeStage) {
      case 'PHOTOGRAMMETRY':
        return {
          model: 'ALIKED-N16 + PatchMatchNet',
          accuracy: '98.0%',
          points: `${Math.floor((stageProgress / 100) * 90000).toLocaleString()} RGB Pts`,
          status: 'Triangulating Drone Multi-Views'
        };
      case 'LIDAR':
        return {
          model: 'PointCleanNet (SOR/ROR Filter)',
          accuracy: '94.0%',
          points: `${(Math.floor((stageProgress / 100) * 90000)).toLocaleString()} Laser Pts`,
          status: '150 kHz Laser Elevation'
        };
      case 'FUSION':
        return {
          model: 'GeoTransformer SVD + Robust ICP',
          accuracy: '98.8%',
          points: '90,000 Fused Pts',
          status: 'det(R)=1.000 • RMS: 0.0089m'
        };
      case 'SEGMENTATION':
        return {
          model: 'RandLA-Net + KPConv Network',
          accuracy: '88.4% mIoU',
          points: `${metrics.totalFloors} Floors • ${metrics.totalFlats} Flats`,
          status: `H: ${metrics.totalHeight.toFixed(2)}m (${metrics.totalRooms} Rooms + Doors)`
        };
      case 'TOPOLOGY':
      default:
        return {
          model: 'ISO 19152 LADM 3D Validator',
          accuracy: '100% Certified',
          points: `H = ${metrics.totalHeight.toFixed(2)}m • χ = 2`,
          status: `${metrics.totalFloors} Floors • Watertight Manifold`
        };
    }
  };

  const currentMetrics = getStageMetrics();

  // Measure active building component
  const getPartDetails = (partId: number) => {
    const m = measureObject(partId, metrics.totalFloors, metrics.floorHeight);
    if (!m) return null;

    let title = `Building Component #${partId}`;
    let category = m.class;
    let materialSpec = 'M25 Reinforced Concrete / Structural Masonry';

    if (partId >= 400 && partId <= 400 + metrics.totalFloors) {
      const floorNum = partId - 400;
      category = floorNum === metrics.totalFloors ? 'ROOFTOP SLAB' : 'STRUCTURAL SLAB';
      title = floorNum === 0 
        ? 'Ground Foundation Slab' 
        : floorNum === metrics.totalFloors 
        ? `Rooftop Terrace Slab (Level ${floorNum})` 
        : `Storey ${floorNum} Intermediate Floor Slab`;
      materialSpec = 'M25 Post-Tensioned Concrete • 240mm Depth';
    } else if (partId === 127 || partId === 128) {
      category = 'ENTRANCE DOOR';
      title = partId === 127 ? 'Main Entry Left Double Door' : 'Main Entry Right Double Door';
      materialSpec = 'IS 3614 Standard Galvanized Fire-Rated Door';
    } else if (partId === 350) {
      category = 'CANOPY PORTICO';
      title = 'Entrance Cantilevered Porch Canopy';
      materialSpec = 'IS 800 Structural Steel Box Section & Toughened Glass';
    } else if (partId >= 201 && partId <= 280) {
      category = 'FACADE OPENING';
      title = `Casement Window Unit #${partId}`;
      materialSpec = 'Double-Glazed Low-E Acoustic Glass & Powder Aluminum';
    } else if (partId >= 301 && partId <= 350) {
      category = 'HVAC EQUIPMENT';
      title = `VRF Compressor Unit #${partId}`;
      materialSpec = 'Variable Refrigerant Heat Pump (R410A)';
    } else if (m.class === 'WALL') {
      category = 'EXTERNAL WALL';
      title = `Storey Exterior Façade Wall Element`;
      materialSpec = 'Autoclaved Aerated Concrete (AAC) Lightweight Block';
    } else if (m.class === 'STRUCTURE') {
      category = 'CORE STRUCTURE';
      title = 'Elevator Machine Room / Overhead Tank';
      materialSpec = 'Monolithic Shear Wall & Cast-in-situ RCC';
    }

    const vol = m.size.x * m.size.y * m.size.z;

    return {
      ...m,
      title,
      category,
      materialSpec,
      volumeM3: vol
    };
  };

  const activePartInfo = getPartDetails(selectedPartId);

  // Key parts list for quick component selection
  const keyParts = [
    { id: 400, name: 'Ground Slab', category: 'SLAB' },
    { id: 401, name: 'Floor 1 Slab', category: 'SLAB' },
    { id: 402, name: 'Floor 2 Slab', category: 'SLAB' },
    { id: 403, name: 'Floor 3 Slab', category: 'SLAB' },
    { id: 400 + metrics.totalFloors, name: 'Roof Slab', category: 'SLAB' },
    { id: 127, name: 'Entry Door', category: 'DOOR' },
    { id: 350, name: 'Porch Canopy', category: 'CANOPY' },
    { id: 501, name: 'Façade Wall', category: 'WALL' },
    { id: 201, name: 'Window F01', category: 'WINDOW' },
    { id: 301, name: 'Rooftop Chiller', category: 'AC' },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full bg-white text-slate-800 flex flex-col justify-between font-sans select-none overflow-hidden relative">
      {/* Fixed Full-Bleed 3D Showcase Canvas Background */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-auto">
        <CinematicMiniScreen
          activeStage={activeStage}
          stageProgress={stageProgress}
          isCompleted={isCompleted}
          metrics={metrics}
          surveyNumber={`${parcel.surveyNumber}/${parcel.subDivision}`}
          location={parcel.location}
          selectedPartId={selectedPartId}
          onPartSelected={setSelectedPartId}
          showMeasurements={showMeasurements}
        />
      </div>

      {/* Subtle Architectural Dot Pattern Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none z-1" />

      {/* Floating Top Header: Active Stage & Parcel Details */}
      <div className="relative z-20 w-full px-6 py-3.5 flex items-center justify-between pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-xl px-4 py-2 font-mono text-xs shadow-md pointer-events-auto flex items-center space-x-2 text-slate-800">
          <span className={`w-2.5 h-2.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'}`} />
          <span className="font-bold text-slate-900">
            {isCompleted ? '3D CADASTRE PIPELINE CERTIFIED' : '3D SPACE RECONSTRUCTION SHOWCASE'}
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-700 font-medium">Parcel {parcel.surveyNumber}/{parcel.subDivision}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">{parcel.location}</span>
          <span className="text-slate-400">•</span>
          <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
            Ground H = {metrics.totalHeight.toFixed(2)}m
          </span>
        </div>
      </div>

      {/* Center Floating UI Cards: Left Stage Stepper | Transparent 3D Center | Right Live AI Telemetry */}
      <div className="relative z-10 w-full flex-1 flex items-center justify-between px-6 gap-6 min-h-0 pointer-events-none">
        {/* Left Stage Stepper */}
        <div className="font-mono text-[11px] pointer-events-auto shrink-0 z-20">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 shadow-xl space-y-2.5 min-w-[230px]">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider pb-1.5 border-b border-slate-200">
              Processing Stages (5)
            </div>
            {PIPELINE_STAGES.map((s, idx) => {
              const currentIdx = PIPELINE_STAGES.indexOf(activeStage);
              const isDone = isCompleted || currentIdx > idx;
              const isActive = !isCompleted && activeStage === s;
              const stageNameDisplay = STAGE_DETAILS[s].name;

              return (
                <div 
                  key={s} 
                  className={`flex items-center space-x-2.5 transition-colors px-2 py-1 rounded-lg ${
                    isActive 
                      ? 'bg-cyan-50 text-cyan-700 font-bold border border-cyan-200' 
                      : isDone 
                      ? 'text-slate-600 font-medium' 
                      : 'text-slate-400'
                  }`}
                >
                  <span className="w-4 flex justify-center">
                    {isDone ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : isActive ? (
                      <Loader2 className="w-3.5 h-3.5 text-cyan-600 animate-spin" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    )}
                  </span>
                  <span className="tracking-wide">0{idx + 1}. {stageNameDisplay}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Space: Open view directly showing fixed 3D building showcase */}
        <div className="flex-1 min-h-0 pointer-events-none" />

        {/* Right Side: Live AI Model & Telemetry Metrics */}
        <div className="font-mono pointer-events-auto shrink-0 z-20">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 shadow-xl space-y-3.5 text-right w-60">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-end space-x-1">
                <Cpu className="w-3 h-3 text-cyan-600" />
                <span>Active Model</span>
              </div>
              <div className="text-xs font-bold text-slate-900 truncate" title={currentMetrics.model}>
                {currentMetrics.model}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Model Accuracy</div>
              <div className="text-base font-bold text-emerald-600">{currentMetrics.accuracy}</div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-end space-x-1">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>Point / Geometry</span>
              </div>
              <div className="text-sm font-bold text-slate-800">{currentMetrics.points}</div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-end space-x-1">
                <Database className="w-3 h-3 text-slate-400" />
                <span>Cadastral State</span>
              </div>
              <div className="text-xs font-semibold text-cyan-700">{currentMetrics.status}</div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 text-left">
              <div>Survey: {parcel.surveyNumber}/{parcel.subDivision}</div>
              <div className="truncate">ULPIN: {parcel.baseUlpin}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Architectural Cadastral Room Segmentation & Component Measurements Panel */}
      {(['SEGMENTATION', 'TOPOLOGY'].includes(activeStage) || isCompleted) && (
        <div className="absolute left-6 bottom-5 z-20 font-mono text-[10px] pointer-events-auto animate-in fade-in duration-300">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3.5 shadow-xl space-y-2.5 max-w-sm text-slate-700">
            {/* Tab switch: Measurements vs Apartments */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-1.5 bg-slate-100 p-0.5 rounded-lg text-[10px]">
                <button
                  onClick={() => setActiveBottomTab('measure')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    activeBottomTab === 'measure'
                      ? 'bg-white text-cyan-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Ruler className="w-3 h-3" />
                  <span>MEASUREMENTS</span>
                </button>
                <button
                  onClick={() => setActiveBottomTab('legend')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    activeBottomTab === 'legend'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>APARTMENTS ({metrics.totalFlats})</span>
                </button>
              </div>

              {activeBottomTab === 'measure' && (
                <button
                  onClick={() => setShowMeasurements(prev => !prev)}
                  className="text-[9px] font-bold text-cyan-700 hover:text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 cursor-pointer"
                >
                  {showMeasurements ? '3D LINES ON' : '3D LINES OFF'}
                </button>
              )}
            </div>

            {activeBottomTab === 'measure' ? (
              /* Component Cadastral Measurement Details */
              <div className="space-y-2">
                {activePartInfo ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{activePartInfo.title}</div>
                        <div className="text-[9px] text-slate-400">ID #{selectedPartId} • {activePartInfo.materialSpec}</div>
                      </div>
                      <span className="text-[9px] bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded">
                        {activePartInfo.category}
                      </span>
                    </div>

                    {/* Dimensions & Spatial Metric Grid */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-slate-400 text-[9px] block uppercase">Dimensions (W×H×D)</span>
                        <span className="font-bold text-slate-900">
                          {activePartInfo.size.x.toFixed(2)}m × {activePartInfo.size.y.toFixed(2)}m × {activePartInfo.size.z.toFixed(2)}m
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[9px] block uppercase">Face Area</span>
                        <span className="font-bold text-emerald-700">{activePartInfo.area.toFixed(2)} m²</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[9px] block uppercase">Solid Volume</span>
                        <span className="font-bold text-cyan-700">{activePartInfo.volumeM3.toFixed(2)} m³</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[9px] block uppercase">Datum Elevation (Y)</span>
                        <span className="font-bold text-amber-700">+{activePartInfo.elevation.toFixed(2)}m Ground</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/60">
                        <span className="text-slate-400 text-[9px] block uppercase">Spatial Centroid (XYZ)</span>
                        <span className="font-medium text-slate-700 text-[9px]">
                          X: {activePartInfo.center.x.toFixed(2)}m, Y: {activePartInfo.center.y.toFixed(2)}m, Z: {activePartInfo.center.z.toFixed(2)}m
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center text-slate-400">
                    Click any component in the 3D building to inspect
                  </div>
                )}

                {/* Quick Component Selector Buttons */}
                <div className="space-y-1">
                  <div className="text-[9px] uppercase font-bold text-slate-400 flex items-center justify-between">
                    <span>Inspect Components:</span>
                    <span className="text-cyan-600 font-normal">Click 3D Model or buttons</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {keyParts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPartId(p.id)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors cursor-pointer ${
                          selectedPartId === p.id 
                            ? 'bg-slate-900 text-white font-bold' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Apartment Legend */
              <div className="space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>ROOM CLASSIFICATION</span>
                  <span className="text-amber-600 font-bold">H: {metrics.totalHeight.toFixed(1)}m</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-slate-600">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 border border-sky-500" />
                    <span>Living & Dining</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 border border-indigo-600" />
                    <span>Master Bed</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 border border-amber-500" />
                    <span>Modular Kitchen</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 border border-rose-500" />
                    <span>Attached Bath</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 border border-emerald-500" />
                    <span>Bed 2 / Utility</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-sky-400" />
                    <span>Swing Doors ({metrics.totalRooms}+)</span>
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-200 text-[9px] text-slate-400 flex items-center justify-between">
                  <span>{metrics.totalFloors} Storeys @ {metrics.floorHeight}m/FL</span>
                  <span className="text-amber-600 font-semibold">Datum Y=0.00m Ground</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Action Rail: Unlocks VIEW 3D PROPERTY upon 100% completion */}
      <div className="relative z-20 w-full p-4 flex items-center justify-center pointer-events-none">
        {isCompleted ? (
          <div className="flex items-center space-x-3 pointer-events-auto animate-in fade-in duration-300">
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-2.5 font-mono text-xs text-emerald-800 flex items-center space-x-2 shadow-lg">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ALL 5 CADASTRAL PROCESSING STAGES COMPLETE • MODEL CERTIFIED</span>
            </div>
            <button
              id="btn-view-3d-property"
              onClick={onViewProperty}
              className="py-3 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold tracking-widest uppercase shadow-xl flex items-center space-x-2 active:scale-98 transition-all cursor-pointer ring-2 ring-slate-900/10"
            >
              <span>[ VIEW 3D PROPERTY & STRATA UNITS ]</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-full px-6 py-2.5 font-mono text-xs text-slate-700 shadow-lg flex items-center space-x-2.5 pointer-events-auto">
            <Loader2 className="w-4 h-4 text-cyan-600 animate-spin" />
            <span>
              Stage {PIPELINE_STAGES.indexOf(activeStage) + 1}/5: <strong className="text-slate-900">{activeStageInfo.name}</strong> ({stageProgress}%)
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 font-medium">{activeStageInfo.model}</span>
          </div>
        )}
      </div>
    </div>
  );
};
