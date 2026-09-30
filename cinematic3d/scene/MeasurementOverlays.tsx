import { Line } from "@react-three/drei";
import * as THREE from "three";
import { measureObject } from "../processing/surveyProcessor";
import { useTimeline } from "../cinematic/cinematicTimeline";
import { BuildingOptions } from "./BuildingModel";

interface DimensionProps {
    from: THREE.Vector3;
    to: THREE.Vector3;
    label?: string;
    color?: string;
}

function Dimension({ from, to, color = "#e9c38e" }: DimensionProps) {
    const vertical = Math.abs(to.y - from.y) > Math.abs(to.x - from.x);

    const tick = vertical
        ? new THREE.Vector3(0.1, 0, 0)
        : new THREE.Vector3(0, 0.1, 0);

    return (
        <group>
            <Line points={[from, to]} color={color} lineWidth={1.2} />

            {[from, to].map((point, index) => (
                <Line
                    key={index}
                    points={[point.clone().sub(tick), point.clone().add(tick)]}
                    color={color}
                    lineWidth={1}
                />
            ))}
        </group>
    );
}

interface MeasurementOverlaysProps {
    options: BuildingOptions;
}

export default function MeasurementOverlays({ options }: MeasurementOverlaysProps) {
    const { stage } = useTimeline();

    let id: number | string = 127;
    let visible = ["door", "measure", "other"].includes(stage.id);

    if (stage.id === "other") {
        const ids = [201, 301, 401, 403];
        id = ids[Math.min(ids.length - 1, Math.floor(stage.progress * ids.length))];
    }

    if (stage.id === "inspect") {
        id = options.selected;
        visible = options.measurements;
    }

    const object = measureObject(id);
    if (!visible || !object) return null;

    const { min, max } = object.boundingBox;
    const size = object.size;
    const center = object.center;

    const z = max.z + 0.2;
    const x = max.x + Math.max(0.28, size.x * 0.08);

    const showDimensions = stage.id !== "door" || stage.progress > 0.55;

    return (
        <group>
            <mesh position={center}>
                <boxGeometry args={[size.x + 0.025, size.y + 0.025, size.z + 0.025]} />
                <meshBasicMaterial
                    color="#e8be84"
                    wireframe
                    transparent
                    opacity={0.72}
                    depthTest={false}
                />
            </mesh>

            {showDimensions && (
                <>
                    <Dimension
                        from={new THREE.Vector3(min.x, min.y - 0.2, z)}
                        to={new THREE.Vector3(max.x, min.y - 0.2, z)}
                        label={`${size.x.toFixed(2)} m`}
                    />

                    <Dimension
                        from={new THREE.Vector3(x, min.y, z)}
                        to={new THREE.Vector3(x, max.y, z)}
                        label={`${size.y.toFixed(2)} m`}
                    />

                    <Dimension
                        from={new THREE.Vector3(x, min.y, min.z)}
                        to={new THREE.Vector3(x, min.y, max.z)}
                        label={`${size.z.toFixed(2)} m`}
                    />
                </>
            )}
        </group>
    );
}
