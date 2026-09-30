import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { dronePosition } from "../data/surveyData";
import { transport, useTimeline } from "../cinematic/cinematicTimeline";

interface RotorProps {
    position: [number, number, number];
    direction: number;
}

function Rotor({ position, direction }: RotorProps) {
    const rotor = useRef<THREE.Group>(null!);

    useFrame((_, delta) => {
        if (transport.read().playing && rotor.current) {
            rotor.current.rotation.y += delta * 75 * direction;
        }
    });

    return (
        <group position={position}>
            <mesh>
                <cylinderGeometry args={[0.1, 0.12, 0.2, 12]} />
                <meshStandardMaterial color="#364148" metalness={0.7} roughness={0.3} />
            </mesh>

            <group ref={rotor} position={[0, 0.14, 0]}>
                {[0, Math.PI / 2].map((rotation) => (
                    <mesh key={rotation} rotation={[0, rotation, 0]}>
                        <boxGeometry args={[1.08, 0.018, 0.075]} />
                        <meshStandardMaterial color="#161d23" metalness={0.5} />
                    </mesh>
                ))}
            </group>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.145, 0]}>
                <circleGeometry args={[0.58, 40]} />
                <meshBasicMaterial
                    color="#a6b8bc"
                    transparent
                    opacity={0.075}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}

export default function DronePlatform() {
    const root = useRef<THREE.Group>(null!);
    const sensor = useRef<THREE.Group>(null!);
    const { stage } = useTimeline();

    useFrame(() => {
        if (!root.current || !sensor.current) return;
        const state = transport.read();
        root.current.position.copy(dronePosition(state.time));
        root.current.rotation.y = state.time * 0.012 + Math.PI;
        root.current.rotation.z = Math.sin(state.time * 0.2) * 0.035;
        sensor.current.rotation.y = state.time * 2.6;
    });

    return (
        <group ref={root} visible={stage.index >= 1 && stage.index <= 14}>
            <mesh castShadow>
                <boxGeometry args={[0.95, 0.28, 0.68]} />
                <meshStandardMaterial color="#aeb9b7" metalness={0.5} roughness={0.38} />
            </mesh>

            <mesh position={[0, 0.2, 0]}>
                <boxGeometry args={[0.6, 0.14, 0.47]} />
                <meshStandardMaterial color="#252e35" />
            </mesh>

            {[-1, 1].flatMap((x) =>
                [-1, 1].map((z) => {
                    const end: [number, number, number] = [x * 0.95, 0.02, z * 0.82];

                    return (
                        <group key={`${x}-${z}`}>
                            <Line
                                points={[[x * 0.2, 0, z * 0.2], end]}
                                color="#83918f"
                                lineWidth={5}
                            />
                            <Rotor position={end} direction={x * z} />
                        </group>
                    );
                })
            )}

            <mesh position={[0, 0.43, 0.1]}>
                <cylinderGeometry args={[0.025, 0.025, 0.32, 8]} />
                <meshStandardMaterial color="#929f9c" />
            </mesh>

            <mesh position={[0, 0.62, 0.1]}>
                <cylinderGeometry args={[0.17, 0.17, 0.08, 24]} />
                <meshStandardMaterial color="#d0d5ca" />
            </mesh>

            <mesh position={[0, -0.26, 0]}>
                <boxGeometry args={[0.3, 0.25, 0.26]} />
                <meshStandardMaterial color="#4a575b" metalness={0.5} />
            </mesh>

            <group ref={sensor} position={[0, -0.52, 0]}>
                <mesh>
                    <cylinderGeometry args={[0.22, 0.22, 0.28, 32]} />
                    <meshStandardMaterial color="#b4c2b9" metalness={0.72} roughness={0.28} />
                </mesh>

                <mesh>
                    <cylinderGeometry args={[0.228, 0.228, 0.075, 32]} />
                    <meshStandardMaterial
                        color="#193a39"
                        emissive="#3f9080"
                        emissiveIntensity={0.45}
                    />
                </mesh>
            </group>

            <group position={[0, -0.34, 0.4]}>
                <mesh>
                    <boxGeometry args={[0.31, 0.22, 0.2]} />
                    <meshStandardMaterial color="#202c31" />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.04, 0.13]}>
                    <cylinderGeometry args={[0.085, 0.085, 0.14, 24]} />
                    <meshStandardMaterial color="#152932" metalness={0.7} roughness={0.15} />
                </mesh>
            </group>

            {[-0.5, 0.5].map((x) => (
                <Line
                    key={x}
                    points={[
                        [x, -0.05, -0.3],
                        [x * 1.25, -0.8, -0.3],
                        [x * 1.25, -0.8, 0.55]
                    ]}
                    color="#52615f"
                    lineWidth={3}
                />
            ))}

            {stage.id === "xyz" && <primitive object={new THREE.AxesHelper(2.2)} />}
        </group>
    );
}
