import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { pointData } from "../processing/surveyProcessor";
import { stageAt, transport, phaseIndex, Stage } from "../cinematic/cinematicTimeline";
import { BuildingOptions } from "./BuildingModel";

const vertexShader = `
  attribute vec3 rgb;
  attribute vec3 semantic;
  attribute float classId;
  attribute float instanceId;
  attribute float noise;

  uniform float uRGB;
  uniform float uSemantic;
  uniform float uClean;
  uniform float uSelected;
  uniform float uIsolation;
  uniform float uClass;
  uniform float uExplode;
  uniform float uOpacity;
  uniform float uSize;
  uniform vec3 uBase;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    p += vec3(
      sin(instanceId * 1.7),
      0.3 + classId * 0.12,
      cos(instanceId * 1.7)
    ) * uExplode;

    float classified = step((classId + 1.0) / 9.0, uSemantic);

    vColor = mix(uBase, rgb, uRGB);
    vColor = mix(vColor, semantic, classified);

    float chosen = 1.0 - step(0.5, abs(instanceId - uSelected));
    float selectedActive = step(0.0, uSelected);

    vColor = mix(
      vColor,
      vec3(1.0, 0.75, 0.4),
      chosen * selectedActive * 0.75
    );

    vAlpha = uOpacity;
    vAlpha *= 1.0 - noise * uClean;
    vAlpha *= mix(
      1.0,
      mix(0.07, 1.0, chosen),
      uIsolation * selectedActive
    );

    if (uClass >= 0.0 && abs(classId - uClass) > 0.5) vAlpha = 0.0;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(uSize * 85.0 / -mvPosition.z, 1.0, 5.0);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float radius = length(gl_PointCoord - 0.5);
    if (radius > 0.5 || vAlpha < 0.01) discard;

    float falloff = 1.0 - smoothstep(0.2, 0.5, radius);
    gl_FragColor = vec4(vColor, vAlpha * falloff);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const clamp = THREE.MathUtils.clamp;
const smooth = (p: number) => p * p * (3 - 2 * p);

function selectedDuringStage(stage: Stage & { progress: number }, options: BuildingOptions) {
    if (["door", "measure"].includes(stage.id)) return 127;

    if (stage.id === "other") {
        const ids = [201, 301, 401, 403];
        return ids[Math.min(ids.length - 1, Math.floor(stage.progress * ids.length))];
    }

    return stage.id === "inspect" ? options.selected : -1;
}

interface PointCloudProps {
    source: "lidar" | "photo";
    options: BuildingOptions;
    onSelect: (instanceId: number) => void;
}

export default function PointCloudLayer({ source, options, onSelect }: PointCloudProps) {
    const group = useRef<THREE.Group>(null!);
    const photo = source === "photo";

    const geometry = useMemo(() => {
        const result = new THREE.BufferGeometry();

        result.setAttribute(
            "position",
            new THREE.BufferAttribute(
                photo ? pointData.photoPosition : pointData.position,
                3
            )
        );

        const attributes: [keyof typeof pointData, number][] = [
            ["rgb", 3],
            ["semantic", 3],
            ["classId", 1],
            ["instanceId", 1],
            ["noise", 1]
        ];

        for (const [name, size] of attributes) {
            result.setAttribute(
                name,
                new THREE.BufferAttribute(pointData[name] as Float32Array, size)
            );
        }

        result.computeBoundingSphere();
        return result;
    }, [photo]);

    const material = useMemo(
        () => new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            uniforms: {
                uRGB: { value: 0 },
                uSemantic: { value: 0 },
                uClean: { value: 0 },
                uSelected: { value: -1 },
                uIsolation: { value: 0 },
                uClass: { value: -1 },
                uExplode: { value: 0 },
                uOpacity: { value: 0.9 },
                uSize: { value: 1.6 },
                uBase: {
                    value: new THREE.Color(photo ? "#d5b383" : "#85c9ce")
                }
            }
        }),
        [photo]
    );

    useEffect(() => () => {
        geometry.dispose();
        material.dispose();
    }, [geometry, material]);

    useFrame(() => {
        if (!group.current) return;
        const stage = stageAt(transport.read().time);
        const index = stage.index;
        const p = stage.progress;
        const u = material.uniforms;

        let count = pointData.count;
        let visible = true;
        let opacity = 0.88;
        let rgb = photo ? 0.85 : 0;

        group.current.position.set(0, 0, 0);
        group.current.rotation.set(0, 0, 0);
        group.current.scale.setScalar(1);

        if (!photo) {
            // LiDAR Point Cloud Layer (Geometry-First)
            if (stage.id === "photogrammetry") {
                visible = false;
                count = 0;
            } else if (stage.id === "lidar") {
                visible = true;
                count = Math.floor((0.2 + 0.8 * p) * pointData.count);
                opacity = 0.95;
                rgb = 0;
            } else if (stage.id === "fusion") {
                visible = true;
                count = pointData.count;
                opacity = 0.92;
                rgb = p; // Progressively colorize with photogrammetry RGB
            } else if (stage.id === "segmentation") {
                visible = true;
                count = pointData.count;
                opacity = 0.95;
                rgb = 0.5;
            } else if (stage.id === "topology") {
                visible = true;
                count = pointData.count;
                opacity = 0.9 * (1 - p); // Dissolve smoothly into solid surface mesh
            } else {
                visible = false;
            }
        } else {
            // Photogrammetry Point Cloud Layer (Photo-Geometry RGB)
            if (stage.id === "photogrammetry") {
                visible = true;
                count = Math.floor((0.2 + 0.8 * p) * pointData.count);
                opacity = 0.92;
                rgb = 1.0;
            } else if (stage.id === "lidar") {
                // Ghosted backdrop while LiDAR scans
                visible = true;
                count = pointData.count;
                opacity = 0.22;
                rgb = 1.0;
            } else if (stage.id === "fusion") {
                visible = true;
                count = pointData.count;
                opacity = 0.85 * (1 - p * 0.7);
                rgb = 1.0;
            } else {
                // Fused into LiDAR geometry
                visible = false;
            }
        }

        // Dynamic spatial convergence during fusion stage
        if (stage.id === "fusion") {
            const residual = 1 - smooth(clamp(p / 0.85, 0, 1));
            group.current.position.set(
                (photo ? 6 : -6) * residual,
                photo ? residual * 0.5 : 0,
                0
            );
        }

        let semantic = 0;
        if (stage.id === "segmentation") {
            semantic = p;
        } else if (index > phaseIndex("segmentation")) {
            semantic = 1;
        }

        const selected = selectedDuringStage(stage, options);
        let isolation = 0;

        if (stage.id === "inspect") {
            visible =
                options.showCloud &&
                (
                    (photo && options.view === "photo") ||
                    (!photo && options.view !== "photo")
                );

            rgb = options.view === "lidar" ? 0 : 1;
            semantic = options.semantic ? 1 : 0;
            isolation = options.isolate ? 1 : 0;
            opacity = options.view === "model" ? 0.35 : 0.95;
        }

        u.uRGB.value = rgb;
        u.uOpacity.value = opacity;
        u.uSemantic.value = semantic;
        u.uSelected.value = selected;
        u.uIsolation.value = isolation;
        u.uClass.value = stage.id === "inspect" ? options.classFilter : -1;
        u.uExplode.value = stage.id === "segmentation" ? Math.sin(p * Math.PI) * 0.22 : 0;
        u.uClean.value = 1;

        group.current.visible = visible;
        geometry.setDrawRange(0, count);
    });

    return (
        <group ref={group}>
            <points
                geometry={geometry}
                material={material}
                frustumCulled={false}
                onClick={(event) => {
                    if (stageAt(transport.read().time).id !== "inspect") return;
                    if (event.index == null) return;

                    const id = pointData.instanceId[event.index];
                    if (id < 0) return;

                    event.stopPropagation();
                    onSelect(id);
                }}
            />
        </group>
    );
}
