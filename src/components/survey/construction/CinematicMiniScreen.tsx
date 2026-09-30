import React, { useEffect, useState } from 'react';
import SurveySceneView from '../../../../cinematic3d/scene/SurveySceneView';
import {
  startTimeline,
  transport,
  useTimeline,
  END,
  stages
} from '../../../../cinematic3d/cinematic/cinematicTimeline';
import { BuildingOptions } from '../../../../cinematic3d/scene/BuildingModel';
import { PipelineStage, ParcelBuildingMetrics } from './cadastralPipelineElements';

interface CinematicMiniScreenProps {
  activeStage: PipelineStage;
  stageProgress: number;
  isCompleted: boolean;
  surveyNumber: string;
  location: string;
  metrics?: ParcelBuildingMetrics;
  selectedPartId?: number;
  onPartSelected?: (partId: number) => void;
  showMeasurements?: boolean;
}

export const CinematicMiniScreen: React.FC<CinematicMiniScreenProps> = ({
  activeStage,
  stageProgress,
  isCompleted,
  surveyNumber: _surveyNumber,
  location: _location,
  metrics,
  selectedPartId,
  onPartSelected,
  showMeasurements = true
}) => {
  useTimeline();

  const [options, setOptions] = useState<BuildingOptions>({
    selected: 127,
    view: 'photo',
    showCloud: true,
    showMesh: false,
    semantic: false,
    measurements: false,
    coordinates: false,
    isolate: false,
    classFilter: -1
  });

  // Initialize and run the 3D cinematic timeline loop
  useEffect(() => {
    const stop = startTimeline();
    return () => {
      stop();
    };
  }, []);

  // Synchronize 3D timeline time and layer display with the active construction stage
  useEffect(() => {
    if (isCompleted) {
      transport.seek(END);
      transport.setCamera('free');
      setOptions(prev => ({
        ...prev,
        selected: selectedPartId ?? prev.selected ?? 501,
        view: 'model',
        showMesh: true,
        showCloud: false,
        semantic: false,
        measurements: showMeasurements,
        coordinates: false,
        isolate: false,
        classFilter: -1
      }));
      return;
    }

    // Map each of the 5 pipeline stages to timeline stage start times
    const stageTimelineMap: Record<PipelineStage, string> = {
      PHOTOGRAMMETRY: 'photogrammetry',
      LIDAR: 'lidar',
      FUSION: 'fusion',
      SEGMENTATION: 'segmentation',
      TOPOLOGY: 'topology'
    };

    const targetStageId = stageTimelineMap[activeStage] || 'photogrammetry';
    const timelineStage = stages.find(s => s.id === targetStageId);

    if (timelineStage) {
      // Seek smoothly through this stage's duration according to stageProgress
      const stageStart = timelineStage.start;
      const stageOffset = (stageProgress / 100) * timelineStage.duration;
      const targetTime = Math.min(END, stageStart + stageOffset);
      transport.seek(targetTime);
    }

    // Dynamic layer adjustments based on active construction stage
    if (activeStage === 'PHOTOGRAMMETRY') {
      setOptions(prev => ({ ...prev, view: 'photo', showMesh: false, showCloud: true, semantic: false }));
    } else if (activeStage === 'LIDAR') {
      setOptions(prev => ({ ...prev, view: 'lidar', showMesh: false, showCloud: true, semantic: false }));
    } else if (activeStage === 'FUSION') {
      setOptions(prev => ({ ...prev, view: 'fused', showMesh: false, showCloud: true, semantic: false }));
    } else if (activeStage === 'SEGMENTATION') {
      setOptions(prev => ({ ...prev, view: 'fused', showMesh: true, showCloud: true, semantic: true }));
    } else if (activeStage === 'TOPOLOGY') {
      setOptions(prev => ({ ...prev, view: 'model', showMesh: true, showCloud: false, semantic: false }));
    }
  }, [activeStage, stageProgress, isCompleted, selectedPartId, showMeasurements]);

  useEffect(() => {
    if (selectedPartId !== undefined) {
      setOptions(prev => ({
        ...prev,
        selected: selectedPartId,
        measurements: showMeasurements
      }));
    }
  }, [selectedPartId, showMeasurements]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-white select-none">
      <SurveySceneView
        options={options}
        totalFloors={metrics?.totalFloors ?? 4}
        floorHeight={metrics?.floorHeight ?? 3.2}
        onSelect={selected => {
          setOptions(prev => ({ ...prev, selected }));
          if (onPartSelected) {
            onPartSelected(selected);
          }
        }}
      />
    </div>
  );
};
