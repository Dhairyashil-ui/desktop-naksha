import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
    OrbitControls,
    PerspectiveCamera
} from "@react-three/drei";
import {
    EffectComposer,
    Bloom
} from "@react-three/postprocessing";
import * as THREE from "three";

import CinematicCameraController from "../cinematic/CinematicCameraController";
import { useTimeline } from "../cinematic/cinematicTimeline";
import BuildingModel, { BuildingOptions } from "./BuildingModel";
import PointCloudLayer from "./PointCloudLayer";
import SurveyEffectsLayer from "./SurveyEffectsLayer";
import MeasurementOverlays from "./MeasurementOverlays";

interface WorldProps {
    options: BuildingOptions;
    onSelect: (instanceId: number) => void;
    totalFloors?: number;
    floorHeight?: number;
}

function World({ options, onSelect, totalFloors, floorHeight }: WorldProps) {
    const { camera: cameraMode } = useTimeline();

    return (
        <>
            {/* Pure White Background & Architectural Fog */}
            <color attach="background" args={["#ffffff"]} />
            <fogExp2 attach="fog" args={["#ffffff", 0.002]} />

            <PerspectiveCamera
                makeDefault
                position={[105, 68, 100]}
                fov={43}
                near={0.08}
                far={650}
            />

            {/* Clean Architectural Daylight Lighting */}
            <hemisphereLight args={["#ffffff", "#f8fafc", 1.4]} />
            <ambientLight intensity={0.7} />

            <directionalLight
                position={[-35, 65, 30]}
                color="#ffffff"
                intensity={2.4}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-70}
                shadow-camera-right={70}
                shadow-camera-top={70}
                shadow-camera-bottom={-70}
                shadow-camera-near={1}
                shadow-camera-far={180}
                shadow-normalBias={0.04}
            />

            <directionalLight
                position={[25, 20, -35]}
                color="#e2e8f0"
                intensity={0.5}
            />

            {/* Clean building and reconstruction layers, scaled prominently without drone/camera clutter */}
            <group scale={[0.92, 0.92, 0.92]} position={[0, 0, 0]}>
                <BuildingModel images={[]} options={options} onSelect={onSelect} totalFloors={totalFloors} floorHeight={floorHeight} />
                <PointCloudLayer source="lidar" options={options} onSelect={onSelect} />
                <PointCloudLayer source="photo" options={options} onSelect={onSelect} />
                <SurveyEffectsLayer />
                <MeasurementOverlays options={options} />
            </group>

            <CinematicCameraController />

            {cameraMode === "free" && (
                <OrbitControls
                    makeDefault
                    target={[0, 4, 0]}
                    enableDamping
                    dampingFactor={0.06}
                    minDistance={1.2}
                    maxDistance={160}
                    maxPolarAngle={Math.PI * 0.49}
                    panSpeed={0.55}
                    rotateSpeed={0.45}
                    zoomSpeed={0.6}
                />
            )}

            <EffectComposer multisampling={0}>
                <Bloom
                    intensity={0.12}
                    luminanceThreshold={0.92}
                    luminanceSmoothing={0.35}
                    mipmapBlur
                />
            </EffectComposer>
        </>
    );
}

interface SurveySceneViewProps {
    options: BuildingOptions;
    onSelect: (instanceId: number) => void;
    totalFloors?: number;
    floorHeight?: number;
}

export default function SurveySceneView(props: SurveySceneViewProps) {
    return (
        <Canvas
            shadows
            dpr={[1, 1.6]}
            gl={{
                antialias: true,
                alpha: false,
                powerPreference: "high-performance",
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.05
            }}
            raycaster={{ params: { Points: { threshold: 0.14 } } as unknown as THREE.RaycasterParameters }}
        >
            <Suspense fallback={null}>
                <World {...props} />
            </Suspense>
        </Canvas>
    );
}
