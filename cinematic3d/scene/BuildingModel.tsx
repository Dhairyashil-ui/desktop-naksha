import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { parts, BuildingPartItem, CameraImageRecord } from "../data/surveyData";
import { stageAt, transport, phaseIndex } from "../cinematic/cinematicTimeline";

const clamp = THREE.MathUtils.clamp;

export interface BuildingOptions {
    selected: number;
    view: string;
    showCloud: boolean;
    showMesh: boolean;
    semantic: boolean;
    measurements: boolean;
    coordinates: boolean;
    isolate: boolean;
    classFilter: number;
}

interface BuildingProps {
    images: (CameraImageRecord & { texture: THREE.Texture })[];
    options: BuildingOptions;
    onSelect: (instanceId: number) => void;
}

interface BuildingPartProps {
    object: BuildingPartItem;
    index: number;
    images: (CameraImageRecord & { texture: THREE.Texture })[];
    options: BuildingOptions;
    onSelect: (instanceId: number) => void;
}

function BuildingPart({ object, index, images, options, onSelect }: BuildingPartProps) {
    const mesh = useRef<THREE.Mesh>(null!);
    const wire = useRef<THREE.Mesh>(null!);

    const geometry = useMemo(
        () => new THREE.BoxGeometry(...object.size),
        [object]
    );

    const imageIndex = object.position[2] < -3
        ? 6
        : object.position[0] > 10
            ? 3
            : object.position[0] < -10
                ? 9
                : 0;

    const image = images && images.length > imageIndex ? images[imageIndex] : null;

    const material = useMemo(() => {
        const result = new THREE.MeshStandardMaterial({
            color: object.color,
            roughness: object.class === "WINDOW" ? 0.23 : 0.84,
            metalness: object.class === "WINDOW" ? 0.45 : 0.08,
            transparent: true
        });

        const mix = { value: 0 };
        result.userData.projectionMix = mix;

        if (image && image.camera) {
            const projection = new THREE.Matrix4().multiplyMatrices(
                image.camera.projectionMatrix,
                image.camera.matrixWorldInverse
            );

            result.onBeforeCompile = (shader) => {
                shader.uniforms.surveyImage = { value: image.texture };
                shader.uniforms.surveyProjection = { value: projection };
                shader.uniforms.surveyMix = mix;

                shader.vertexShader = `
          varying vec3 vSurveyWorld;
          ${shader.vertexShader}
        `.replace(
                    "#include <begin_vertex>",
                    `#include <begin_vertex>
           vSurveyWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
                );

                shader.fragmentShader = `
          uniform sampler2D surveyImage;
          uniform mat4 surveyProjection;
          uniform float surveyMix;
          varying vec3 vSurveyWorld;
          ${shader.fragmentShader}
        `.replace(
                    "#include <color_fragment>",
                    `#include <color_fragment>
           vec4 projected = surveyProjection * vec4(vSurveyWorld, 1.0);
           vec3 ndc = projected.xyz / projected.w;
           vec2 imageUV = ndc.xy * 0.5 + 0.5;
           float valid =
             step(0.0, imageUV.x) * step(imageUV.x, 1.0) *
             step(0.0, imageUV.y) * step(imageUV.y, 1.0) *
             step(0.0, projected.w);
           vec3 observed = texture2D(surveyImage, imageUV).rgb;
           diffuseColor.rgb = mix(
             diffuseColor.rgb,
             observed,
             surveyMix * valid * 0.72
           );`
                );
            };

            result.customProgramCacheKey = () => "survey-projection-v1";
        }

        return result;
    }, [object, image]);

    useEffect(() => {
        return () => {
            geometry.dispose();
            material.dispose();
        };
    }, [geometry, material]);

    useFrame(() => {
        if (!mesh.current) return;

        const stage = stageAt(transport.read().time);
        const interactive = stage.id === "inspect";

        const selectedClass =
            options.classFilter < 0 || object.classId === options.classFilter;

        const selectedInstance =
            !options.isolate || object.instanceId === options.selected;

        let visible = true;
        let opacity = 1;
        let triangleProgress = 1;

        if (interactive) {
            visible =
                options.showMesh &&
                options.view === "model" &&
                selectedClass &&
                selectedInstance;
        } else if (stage.id !== "topology" && stage.index < phaseIndex("topology")) {
            opacity = 0.04;
            triangleProgress = 1.0;
        } else if (stage.id === "topology") {
            const offset = index / parts.length;
            triangleProgress = clamp(stage.progress * 1.35 - offset * 0.35, 0, 1);
            opacity = 0.15 + stage.progress * 0.85;
        } else {
            opacity = 1.0;
            triangleProgress = 1.0;
        }

        mesh.current.visible = visible;
        material.opacity = opacity;
        material.depthWrite = opacity > 0.5;

        material.emissive.set(
            interactive && object.instanceId === options.selected
                ? "#0284c7"
                : "#000000"
        );

        geometry.setDrawRange(
            0,
            Math.floor(triangleProgress * 12) * 3
        );

        if (wire.current) {
            wire.current.visible = stage.id === "topology";
        }
    });

    return (
        <group position={object.position}>
            <mesh
                ref={mesh}
                geometry={geometry}
                material={material}
                castShadow
                receiveShadow
                onClick={(event) => {
                    if (stageAt(transport.read().time).id !== "inspect") return;
                    event.stopPropagation();
                    onSelect(object.instanceId);
                }}
            />

            <mesh ref={wire} geometry={geometry} visible={false}>
                <meshBasicMaterial
                    color="#0284c7"
                    wireframe
                    transparent
                    opacity={0.35}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}

export default function BuildingModel(props: BuildingProps) {
    const buildingParts = useMemo(
        () => parts.filter((object) => object.class !== "GROUND"),
        []
    );

    return (
        <group>
            {buildingParts.map((object, index) => (
                <BuildingPart
                    key={object.instanceId}
                    object={object}
                    index={index}
                    {...props}
                />
            ))}
        </group>
    );
}
