import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { transport, stageAt, END } from "./cinematicTimeline";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const smooth = (value: number) => value * value * (3 - 2 * value);

export default function CinematicCameraController() {
    const { camera } = useThree();
    const look = useRef(v(0, 3.5, 0));
    const initialized = useRef(false);

    useFrame((_, delta) => {
        const state = transport.read();
        if (state.camera !== "cinematic") return;

        const stage = stageAt(state.time);
        const p = stage.progress;

        // Continuous, unbroken orbit & altitude glide throughout the entire showcase
        const normalizedTime = Math.min(1, state.time / (END || 20.5));
        const baseAngle = 0.55 + normalizedTime * Math.PI * 1.7;

        let radius = 34;
        let height = 18;
        let target = v(0, 4.8, 0);

        switch (stage.id) {
            case "photogrammetry":
                // Smooth wide sweeping glide showing multi-view point cloud synthesis
                radius = 35 - p * 3;
                height = 20 - p * 2;
                target = v(0, 4.5, 0);
                break;

            case "lidar":
                // Dynamic upward-tracking angle emphasizing the vertical laser scan sweep
                radius = 31 + Math.sin(p * Math.PI) * 2;
                height = 15 + p * 4;
                target = v(0, 4.2 + p * 1.8, 0);
                break;

            case "fusion":
                // Sweeping mid-angle tracking co-registration and color fusion
                radius = 33 - p * 2;
                height = 17 - Math.sin(p * Math.PI) * 2;
                target = v(1 - p * 2, 4.8, 0);
                break;

            case "segmentation":
                // Detailed angled view showcasing architectural component classification
                radius = 31 + p * 2;
                height = 16 + p * 2;
                target = v(0, 5.0, 0);
                break;

            case "topology":
                // Grand orbit revealing the completed certified 3D solid model
                radius = 33 + smooth(p) * 3;
                height = 17 + Math.sin(p * Math.PI) * 3;
                target = v(0, 5.0, 0);
                break;

            default:
                radius = 34;
                height = 18;
                target = v(0, 4.8, 0);
        }

        const position = v(
            Math.sin(baseAngle) * radius,
            height,
            Math.cos(baseAngle) * radius
        );

        if (!initialized.current) {
            camera.position.copy(position);
            look.current.copy(target);
            initialized.current = true;
        }

        const isFast = state.isFastForwarding || state.rate >= 3;
        const responsiveness = isFast ? 3.8 : 0.9;
        const damping = 1 - Math.exp(-delta * responsiveness);
        camera.position.lerp(position, damping);
        look.current.lerp(target, damping);
        camera.lookAt(look.current);
    });

    return null;
}
