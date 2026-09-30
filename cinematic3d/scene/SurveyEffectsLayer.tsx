import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { normalSegments } from "../processing/surveyProcessor";
import { useTimeline } from "../cinematic/cinematicTimeline";

// High-tech horizontal laser scanning sweep during LiDAR stage
function LaserScanSweep() {
    const { stage } = useTimeline();
    const plane = useRef<THREE.Mesh>(null!);
    const lineGroup = useRef<THREE.Group>(null!);

    useFrame(() => {
        if (!plane.current || stage.id !== "lidar") return;
        const y = 0.2 + stage.progress * 13.5;
        plane.current.position.y = y;
        if (lineGroup.current) lineGroup.current.position.y = y;
    });

    if (stage.id !== "lidar") return null;

    return (
        <group>
            {/* Luminous Horizontal Laser Scanning Plane */}
            <mesh ref={plane} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[28, 18]} />
                <meshBasicMaterial
                    color="#00e5ff"
                    transparent
                    opacity={0.12}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Glowing Scan Perimeter Line */}
            <group ref={lineGroup}>
                <Line
                    points={[
                        [-14, 0, -9],
                        [14, 0, -9],
                        [14, 0, 9],
                        [-14, 0, 9],
                        [-14, 0, -9]
                    ]}
                    color="#00e5ff"
                    lineWidth={1.8}
                    transparent
                    opacity={0.85}
                />
            </group>
        </group>
    );
}

// Multi-sensor co-registration alignment vectors during Fusion stage
function Registration() {
    const { stage } = useTimeline();

    if (stage.id !== "fusion") return null;

    const p = THREE.MathUtils.smoothstep(stage.progress, 0, 0.87);

    return (
        <group>
            {Array.from({ length: 6 }, (_, index) => {
                const x = -15 + index * 6;
                const offset = (1 - p) * 3;

                return (
                    <Line
                        key={index}
                        points={[[x, 7.5, 10], [x + offset, 7.5 + offset * 0.25, 10]]}
                        color="#0284c7"
                        transparent
                        opacity={0.8}
                        lineWidth={1.2}
                    />
                );
            })}
        </group>
    );
}

// Surface normal extraction vectors during Segmentation stage
function SurfaceNormals() {
    const { stage } = useTimeline();
    const array = useMemo(() => normalSegments(), []);

    if (stage.id !== "segmentation") return null;

    const count = Math.max(
        2,
        Math.floor((array.length / 3) * Math.max(0.02, stage.progress) / 2) * 2
    );

    return (
        <lineSegments>
            <bufferGeometry drawRange={{ start: 0, count }}>
                <bufferAttribute
                    attach="attributes-position"
                    args={[array, 3]}
                />
            </bufferGeometry>
            <lineBasicMaterial
                color="#0ea5e9"
                transparent
                opacity={0.5}
            />
        </lineSegments>
    );
}

export default function SurveyEffectsLayer() {
    return (
        <>
            <LaserScanSweep />
            <Registration />
            <SurfaceNormals />
        </>
    );
}
