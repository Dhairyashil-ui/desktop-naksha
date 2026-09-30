import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Check, 
  RefreshCw, 
  Play, 
  RotateCcw, 
  ArrowRight
} from 'lucide-react';

export type JobNodeStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface PipelineNodeItem {
  id: string;
  name: string;
  category: string;
  level: 1 | 2;
  parentCategory?: string;
  dependencies: string[];
  status: JobNodeStatus;
  progress: number;
  duration?: number;
  metric?: string;
}

const INITIAL_PIPELINE_NODES: PipelineNodeItem[] = [
  // 1. Root: Validate Inputs
  {
    id: 'validate_inputs',
    name: 'Validate Inputs',
    category: 'Preflight',
    level: 1,
    dependencies: [],
    status: 'PENDING',
    progress: 0,
    metric: '10 Inputs Verified'
  },

  // 2. Photogrammetry (Branch A)
  {
    id: 'photo_feature_extraction',
    name: 'Feature extraction',
    category: 'Photogrammetry',
    parentCategory: 'Photogrammetry',
    level: 2,
    dependencies: ['validate_inputs'],
    status: 'PENDING',
    progress: 0,
    metric: '1.42M SIFT Keypoints'
  },
  {
    id: 'photo_feature_matching',
    name: 'Feature matching',
    category: 'Photogrammetry',
    parentCategory: 'Photogrammetry',
    level: 2,
    dependencies: ['photo_feature_extraction'],
    status: 'PENDING',
    progress: 0,
    metric: '845k Inliers'
  },
  {
    id: 'photo_camera_reconstruction',
    name: 'Camera reconstruction',
    category: 'Photogrammetry',
    parentCategory: 'Photogrammetry',
    level: 2,
    dependencies: ['photo_feature_matching'],
    status: 'PENDING',
    progress: 0,
    metric: '1,420 Cameras (0.42px RMSE)'
  },
  {
    id: 'photo_dense_reconstruction',
    name: 'Dense reconstruction',
    category: 'Photogrammetry',
    parentCategory: 'Photogrammetry',
    level: 2,
    dependencies: ['photo_camera_reconstruction'],
    status: 'PENDING',
    progress: 0,
    metric: '320 pts/m²'
  },
  {
    id: 'photo_point_cloud',
    name: 'Point cloud',
    category: 'Photogrammetry',
    parentCategory: 'Photogrammetry',
    level: 2,
    dependencies: ['photo_dense_reconstruction'],
    status: 'PENDING',
    progress: 0,
    metric: '38.4M Points (.copc.laz)'
  },

  // 3. LiDAR (Branch B)
  {
    id: 'lidar_read',
    name: 'Read',
    category: 'LiDAR',
    parentCategory: 'LiDAR',
    level: 2,
    dependencies: ['validate_inputs'],
    status: 'PENDING',
    progress: 0,
    metric: '52.1M Raw Points'
  },
  {
    id: 'lidar_coordinate_transform',
    name: 'Coordinate transform',
    category: 'LiDAR',
    parentCategory: 'LiDAR',
    level: 2,
    dependencies: ['lidar_read'],
    status: 'PENDING',
    progress: 0,
    metric: 'EPSG:32643 Target'
  },
  {
    id: 'lidar_noise_filtering',
    name: 'Noise filtering',
    category: 'LiDAR',
    parentCategory: 'LiDAR',
    level: 2,
    dependencies: ['lidar_coordinate_transform'],
    status: 'PENDING',
    progress: 0,
    metric: '142k Outliers Removed'
  },
  {
    id: 'lidar_classification',
    name: 'Classification',
    category: 'LiDAR',
    parentCategory: 'LiDAR',
    level: 2,
    dependencies: ['lidar_noise_filtering'],
    status: 'PENDING',
    progress: 0,
    metric: 'Ground & Building Classes'
  },
  {
    id: 'lidar_point_cloud',
    name: 'Point cloud',
    category: 'LiDAR',
    parentCategory: 'LiDAR',
    level: 2,
    dependencies: ['lidar_classification'],
    status: 'PENDING',
    progress: 0,
    metric: '51.9M Points (.copc.laz)'
  },

  // 4. GNSS (Branch C)
  {
    id: 'gnss_coordinate_processing',
    name: 'Coordinate processing',
    category: 'GNSS',
    parentCategory: 'GNSS',
    level: 2,
    dependencies: ['validate_inputs'],
    status: 'PENDING',
    progress: 0,
    metric: '18 GCPs (RMSE: 0.011m)'
  },

  // 5. GIS (Branch D)
  {
    id: 'gis_parcel_processing',
    name: 'Parcel processing',
    category: 'GIS',
    parentCategory: 'GIS',
    level: 2,
    dependencies: ['validate_inputs'],
    status: 'PENDING',
    progress: 0,
    metric: '120 Valid OGC Parcels'
  },

  // 6. DEM (Branch E)
  {
    id: 'dem_elevation_processing',
    name: 'Elevation processing',
    category: 'DEM',
    parentCategory: 'DEM',
    level: 2,
    dependencies: ['validate_inputs'],
    status: 'PENDING',
    progress: 0,
    metric: '0.5m Hydro Surface'
  },

  // 7. Point Cloud Fusion (Barrier 1)
  {
    id: 'point_cloud_fusion',
    name: 'Point Cloud Fusion',
    category: 'Fusion',
    level: 1,
    dependencies: ['photo_point_cloud', 'lidar_point_cloud', 'gnss_coordinate_processing'],
    status: 'PENDING',
    progress: 0,
    metric: '89.2M Master Co-Registered Cloud'
  },

  // 8. Building Reconstruction
  {
    id: 'building_reconstruction',
    name: 'Building Reconstruction',
    category: '3D Modeling',
    level: 1,
    dependencies: ['point_cloud_fusion', 'dem_elevation_processing'],
    status: 'PENDING',
    progress: 0,
    metric: '42 LoD-2 Meshes (.glb)'
  },

  // 9. AI Segmentation
  {
    id: 'ai_segmentation',
    name: 'AI Segmentation',
    category: 'AI / CV',
    level: 1,
    dependencies: ['building_reconstruction'],
    status: 'PENDING',
    progress: 0,
    metric: 'PointNet++ (94.2% mIoU)'
  },

  // 10. Floor Detection
  {
    id: 'floor_detection',
    name: 'Floor Detection',
    category: 'Vertical Cadastre',
    level: 1,
    dependencies: ['ai_segmentation'],
    status: 'PENDING',
    progress: 0,
    metric: '248 Stories Extracted'
  },

  // 11. Unit Detection
  {
    id: 'unit_detection',
    name: 'Unit Detection',
    category: 'Vertical Cadastre',
    level: 1,
    dependencies: ['floor_detection'],
    status: 'PENDING',
    progress: 0,
    metric: '612 Strata Volumes'
  },

  // 12. Property Boundary Creation
  {
    id: 'property_boundary_creation',
    name: 'Property Boundary Creation',
    category: 'Legal Cadastre',
    level: 1,
    dependencies: ['unit_detection', 'gis_parcel_processing'],
    status: 'PENDING',
    progress: 0,
    metric: '612 3D Cadastral Parcels'
  },

  // 13. Government Record Matching
  {
    id: 'government_record_matching',
    name: 'Government Record Matching',
    category: 'Legal Cadastre',
    level: 1,
    dependencies: ['property_boundary_creation'],
    status: 'PENDING',
    progress: 0,
    metric: '120/120 7/12 RoR Records (100%)'
  },

  // 14. Validation
  {
    id: 'validation',
    name: 'Validation',
    category: 'Audit',
    level: 1,
    dependencies: ['government_record_matching'],
    status: 'PENDING',
    progress: 0,
    metric: '0 Slivers • ISO 19152 Valid'
  },

  // 15. Canonical Model
  {
    id: 'canonical_model',
    name: 'Canonical Model',
    category: 'Publication',
    level: 1,
    dependencies: ['validation'],
    status: 'PENDING',
    progress: 0,
    metric: 'Published 3D Tiles 1.1 + COG + COPC'
  }
];

interface JobGraphScreenProps {
  projectName: string;
  onBack: () => void;
  onOpenWorkspace: () => void;
}

export const JobGraphScreen: React.FC<JobGraphScreenProps> = ({
  projectName,
  onBack,
  onOpenWorkspace
}) => {
  const [nodes, setNodes] = useState<PipelineNodeItem[]>(INITIAL_PIPELINE_NODES);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<any>(null);

  const completedCount = nodes.filter(n => n.status === 'SUCCESS').length;
  const overallProgress = Math.round((completedCount / nodes.length) * 100);

  // Run DAG Pipeline with dependency resolution
  const handleRunGraph = () => {
    setIsRunning(true);
    setIsComplete(false);

    // Reset all nodes to PENDING
    setNodes(prev => prev.map(n => ({ ...n, status: 'PENDING', progress: 0 })));

    let activeNodes = [...INITIAL_PIPELINE_NODES];

    const stepInterval = setInterval(() => {
      // Find all runnable nodes (dependencies all SUCCESS and status is PENDING)
      const successIds = new Set(activeNodes.filter(n => n.status === 'SUCCESS').map(n => n.id));
      
      const newlyRunnable = activeNodes.filter(n => 
        n.status === 'PENDING' && n.dependencies.every(depId => successIds.has(depId))
      );

      // If no runnable and all success -> finished!
      if (newlyRunnable.length === 0 && activeNodes.every(n => n.status === 'SUCCESS')) {
        clearInterval(stepInterval);
        setIsRunning(false);
        setIsComplete(true);
        return;
      }

      // Mark newly runnable nodes as RUNNING
      if (newlyRunnable.length > 0) {
        activeNodes = activeNodes.map(node => {
          if (newlyRunnable.some(r => r.id === node.id)) {
            return { ...node, status: 'RUNNING', progress: 50 };
          }
          return node;
        });
        setNodes([...activeNodes]);
        return;
      }

      // Finish currently running nodes
      const runningNodes = activeNodes.filter(n => n.status === 'RUNNING');
      if (runningNodes.length > 0) {
        activeNodes = activeNodes.map(node => {
          if (node.status === 'RUNNING') {
            return { ...node, status: 'SUCCESS', progress: 100, duration: 0.25 };
          }
          return node;
        });
        setNodes([...activeNodes]);
      }
    }, 280);

    intervalRef.current = stepInterval;
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setIsComplete(false);
    setNodes(INITIAL_PIPELINE_NODES);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-10 px-6 font-sans select-none">
      {/* Top Bar */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between text-xs text-zinc-400">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Data Inputs</span>
        </button>
        <img src="/logo.png" alt="Logo" className="h-4 max-w-[80px] object-contain inline-block" />
      </div>

      {/* Main Job Graph Body */}
      <div className="w-full max-w-2xl mx-auto my-auto py-6">
        {/* Header Block */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-xs bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded">
                JOB 001
              </span>
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                DIRECTED ACYCLIC GRAPH (DAG)
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 mt-1">
              Integrated 3D Cadastre Pipeline
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Project: <span className="font-semibold text-zinc-700">{projectName || 'Pune Residential 001'}</span>
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-zinc-900">
              {overallProgress}%
            </div>
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              {completedCount}/{nodes.length} TASKS
            </div>
          </div>
        </div>

        {/* Tree Header */}
        <div className="flex items-center justify-between text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-2 px-1 border-b border-zinc-100 pb-1">
          <span>JOB GRAPH EXECUTION TREE</span>
          <div className="flex space-x-8 pr-1">
            <span className="w-20 text-right">STATUS</span>
            <span className="w-36 text-right">OUTPUT / METRIC</span>
          </div>
        </div>

        {/* Interactive ASCII-Styled Job Graph Tree */}
        <div className="font-mono text-xs divide-y divide-zinc-50 border-t border-b border-zinc-100 max-h-[500px] overflow-y-auto py-1">
          {nodes.map((node) => {
            const isSubStep = node.level === 2;
            const isRunningNode = node.status === 'RUNNING';
            const isSuccessNode = node.status === 'SUCCESS';

            return (
              <div
                key={node.id}
                className={`py-2 px-1 flex items-center justify-between transition-colors ${
                  isRunningNode 
                    ? 'bg-blue-50/50' 
                    : isSuccessNode 
                    ? 'hover:bg-zinc-50/60' 
                    : 'text-zinc-400'
                }`}
              >
                {/* Left: Tree Indentation & Name */}
                <div className="flex items-center space-x-2">
                  <span className="text-zinc-300 select-none">
                    {isSubStep ? '│   ├──' : '├──'}
                  </span>

                  <span className={`transition-colors ${
                    isSuccessNode 
                      ? 'text-zinc-900 font-medium' 
                      : isRunningNode 
                      ? 'text-blue-600 font-semibold' 
                      : 'text-zinc-500'
                  }`}>
                    {node.name}
                  </span>

                  {/* Branch category label for top-level subheadings */}
                  {node.parentCategory && isSubStep && node.id.endsWith('extraction') && (
                    <span className="text-[9px] text-zinc-400 bg-zinc-100 px-1 rounded ml-1">
                      Branch
                    </span>
                  )}
                </div>

                {/* Right: Status & Metric */}
                <div className="flex items-center space-x-8 pr-1">
                  {/* Status Indicator */}
                  <div className="w-20 text-right flex items-center justify-end space-x-1.5">
                    {isRunningNode ? (
                      <>
                        <RefreshCw className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                        <span className="text-[10px] font-mono text-blue-500 font-medium animate-pulse">
                          RUNNING
                        </span>
                      </>
                    ) : isSuccessNode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">
                          DONE
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono text-zinc-300">
                        PENDING
                      </span>
                    )}
                  </div>

                  {/* Output Metric */}
                  <div className="w-36 text-right truncate text-[11px]">
                    {isSuccessNode ? (
                      <span className="text-zinc-800 font-medium">{node.metric}</span>
                    ) : isRunningNode ? (
                      <span className="text-blue-500 animate-pulse">Processing...</span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Toolbar */}
        <div className="mt-8 flex flex-col items-center space-y-3">
          <div className="flex items-center space-x-3 w-full max-w-sm">
            {!isRunning && !isComplete && (
              <button
                onClick={handleRunGraph}
                className="flex-1 py-3 px-6 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white hover:shadow"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>START JOB GRAPH</span>
              </button>
            )}

            {isRunning && (
              <button
                disabled
                className="flex-1 py-3 px-6 rounded-lg text-xs font-bold font-mono tracking-wider uppercase bg-zinc-100 text-zinc-400 cursor-wait flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>EXECUTING CONCURRENT DAG ({overallProgress}%)</span>
              </button>
            )}

            {isComplete && (
              <button
                onClick={onOpenWorkspace}
                className="flex-1 py-3 px-6 rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white hover:shadow"
              >
                <span>OPEN 3D INSPECTION WORKSPACE</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleReset}
              disabled={isRunning}
              title="Reset graph"
              className="p-3 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="text-[11px] font-mono text-zinc-400 text-center">
            {isComplete 
              ? '✓ All 15 DAG nodes succeeded. Canonical 3D Cadastre package generated.' 
              : isRunning 
              ? 'Executing concurrent branches (Photogrammetry, LiDAR, GNSS, GIS, DEM)...' 
              : 'Directed Acyclic Graph: Parallel branches synchronize at Point Cloud Fusion barrier.'}
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="w-full max-w-2xl mx-auto text-center text-[11px] font-mono text-zinc-400">
        Phase 12 Job Graph Pipeline Engine • Concurrent DAG Orchestration
      </div>
    </div>
  );
};
