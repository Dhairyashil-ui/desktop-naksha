import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { parts, cameraImages, CameraImageRecord } from "../data/surveyData";
import { useTimeline, Stage } from "../cinematic/cinematicTimeline";

export const commonFeature = new THREE.Vector3(7.4, 8.52, 7.15);

export interface RenderedSurveyImage extends CameraImageRecord {
    texture: THREE.Texture;
    target: THREE.WebGLRenderTarget;
}

export function useSurveyImages(): RenderedSurveyImage[] {
    const { gl } = useThree();
    const [images, setImages] = useState<RenderedSurveyImage[]>([]);

    useEffect(() => {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#ffffff");
        scene.add(new THREE.HemisphereLight("#d8e6e4", "#535348", 2.2));

        const light = new THREE.DirectionalLight("#fff0d3", 3);
        light.position.set(20, 40, 20);
        scene.add(light);

        const disposables: { dispose: () => void }[] = [];

        for (const object of parts) {
            const geometry = new THREE.BoxGeometry(...object.size);
            const material = new THREE.MeshStandardMaterial({
                color: object.color,
                roughness: 0.8
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(...object.position);
            scene.add(mesh);

            disposables.push(geometry, material);
        }

        const previousTarget = gl.getRenderTarget();

        const results: RenderedSurveyImage[] = cameraImages.map((image) => {
            const target = new THREE.WebGLRenderTarget(384, 256, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter
            });

            gl.setRenderTarget(target);
            gl.clear();
            gl.render(scene, image.camera);

            return { ...image, texture: target.texture, target };
        });

        gl.setRenderTarget(previousTarget);
        setImages(results);

        return () => {
            results.forEach((result) => result.target.dispose());
            disposables.forEach((item) => item.dispose());
        };
    }, [gl]);

    return images;
}

interface ImageCameraProps {
    image: RenderedSurveyImage;
    index: number;
    stage: Stage & { progress: number };
}

function ImageCamera({ image, index, stage }: ImageCameraProps) {
    const planeDistance = 3;
    const halfHeight =
        Math.tan(THREE.MathUtils.degToRad(55 / 2)) * planeDistance;
    const halfWidth = halfHeight * 1.5;

    const corners: [number, number, number][] = [
        [-halfWidth, -halfHeight, -planeDistance],
        [halfWidth, -halfHeight, -planeDistance],
        [halfWidth, halfHeight, -planeDistance],
        [-halfWidth, halfHeight, -planeDistance]
    ];

    const projected = commonFeature.clone().project(image.camera);

    const featureVisible =
        Math.abs(projected.x) <= 1 &&
        Math.abs(projected.y) <= 1 &&
        projected.z > -1 &&
        projected.z < 1;

    const featureOnPlane: [number, number, number] = [
        projected.x * halfWidth,
        projected.y * halfHeight,
        -planeDistance + 0.015
    ];

    const poseProgress =
        stage.id === "sfm"
            ? THREE.MathUtils.smoothstep(stage.progress, 0, 0.8)
            : 1;

    const position = new THREE.Vector3(...image.cameraPosition);

    if (stage.id === "sfm") {
        position.add(
            new THREE.Vector3(
                Math.sin(index * 7) * 5,
                Math.cos(index * 3) * 3,
                Math.cos(index * 5) * 5
            ).multiplyScalar(1 - poseProgress)
        );
    }

    return (
        <group
            position={position}
            quaternion={new THREE.Quaternion(...image.cameraRotation)}
        >
            <mesh>
                <boxGeometry args={[0.32, 0.22, 0.2]} />
                <meshStandardMaterial color="#a7b9b5" />
            </mesh>

            <Line
                points={[...corners, corners[0]]}
                color="#97c9c4"
                lineWidth={0.7}
                transparent
                opacity={0.55}
            />

            {corners.map((corner, cornerIndex) => (
                <Line
                    key={cornerIndex}
                    points={[[0, 0, 0], corner]}
                    color="#97c9c4"
                    lineWidth={0.6}
                    transparent
                    opacity={0.3}
                />
            ))}

            <mesh position={[0, 0, -planeDistance]}>
                <planeGeometry args={[halfWidth * 2, halfHeight * 2]} />
                <meshBasicMaterial
                    map={image.texture}
                    transparent
                    opacity={0.72}
                    side={THREE.DoubleSide}
                    toneMapped={false}
                />
            </mesh>

            {featureVisible && stage.id !== "capture" && (
                <mesh position={featureOnPlane}>
                    <sphereGeometry args={[0.065, 12, 12]} />
                    <meshBasicMaterial color="#f0bd75" />
                </mesh>
            )}

            {stage.id === "sfm" && <primitive object={new THREE.AxesHelper(0.7)} />}
        </group>
    );
}

interface AcquisitionProps {
    images: RenderedSurveyImage[];
}

export default function AcquisitionSystem({ images }: AcquisitionProps) {
    const { stage } = useTimeline();

    const visible = [
        "capture",
        "matching",
        "sfm",
        "triangulation",
        "mvs",
        "projection",
        "texture"
    ].includes(stage.id);

    if (!visible || !images.length) return null;

    let count = images.length;

    if (stage.id === "capture") {
        count = Math.max(1, Math.ceil(stage.progress * images.length));
    }

    const chosen =
        ["matching", "triangulation", "projection", "texture"].includes(stage.id)
            ? images.filter((_, index) => [0, 1, 2].includes(index))
            : images.slice(0, count);

    const triangulating = ["matching", "triangulation", "projection", "texture"]
        .includes(stage.id);

    return (
        <group>
            {chosen.map((image, index) => (
                <ImageCamera
                    key={image.imageId}
                    image={image}
                    index={index}
                    stage={stage}
                />
            ))}

            {triangulating && chosen.map((image, index) => {
                const origin = new THREE.Vector3(...image.cameraPosition);

                const progress =
                    stage.id === "triangulation"
                        ? THREE.MathUtils.clamp(stage.progress * 2 - index * 0.18, 0, 1)
                        : 1;

                const end = origin.clone().lerp(commonFeature, progress);

                return (
                    <Line
                        key={image.imageId}
                        points={[origin, end]}
                        color={stage.id === "projection" ? "#e5bc7f" : "#9dd8ce"}
                        lineWidth={1.1}
                        transparent
                        opacity={0.7}
                    />
                );
            })}

            {triangulating && (
                <>
                    <mesh position={commonFeature}>
                        <sphereGeometry args={[0.13, 16, 16]} />
                        <meshBasicMaterial color="#f4cc8f" />
                    </mesh>
                </>
            )}
        </group>
    );
}
