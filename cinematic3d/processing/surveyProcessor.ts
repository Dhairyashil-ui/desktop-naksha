import * as THREE from "three";
import { parts, classColors, BuildingPartItem } from "../data/surveyData";

function seededRandom(seed = 42) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        return (seed >>> 0) / 4294967296;
    };
}

const random = seededRandom();

const positions: number[] = [];
const photoPositions: number[] = [];
const rgb: number[] = [];
const semanticColors: number[] = [];
const classIds: number[] = [];
const instanceIds: number[] = [];
const noise: number[] = [];
const intensities: number[] = [];
const timestamps: number[] = [];
const normals: number[] = [];

export interface BoundedObject extends BuildingPartItem {
    pointIds: number[];
    boundingBox: THREE.Box3;
}

const bounds = new Map<number, BoundedObject>();

const scanOrder: Record<string, number> = {
    ROOF: 0,
    STRUCTURE: 1,
    WALL: 2,
    WINDOW: 3,
    DOOR: 4,
    AC: 5,
    BALCONY: 6,
    FLOOR: 7,
    GROUND: 8
};

const orderedParts = [...parts]
    .filter((p) => p.class !== "GROUND")
    .sort((a, b) => (scanOrder[a.class] ?? 99) - (scanOrder[b.class] ?? 99));

function append(
    point: [number, number, number],
    normal: [number, number, number],
    object: { classId: number; instanceId: number; color: string } | BuildingPartItem,
    isNoise = false
) {
    const index = positions.length / 3;

    positions.push(...point);
    normals.push(...normal);

    const displacement = () => (random() - 0.5) * 0.025;

    photoPositions.push(
        point[0] + displacement(),
        point[1] + displacement(),
        point[2] + displacement()
    );

    const base = new THREE.Color(object.color);
    base.multiplyScalar(0.85 + random() * 0.22);

    rgb.push(base.r, base.g, base.b);

    const semantic = new THREE.Color(classColors[object.classId] || "#ffffff");
    semanticColors.push(semantic.r, semantic.g, semantic.b);

    classIds.push(object.classId);
    instanceIds.push(object.instanceId);
    noise.push(isNoise ? 1 : 0);
    intensities.push(0.25 + random() * 0.75);
    timestamps.push(120 + index * 0.00012);

    if (!isNoise) {
        if (!bounds.has(object.instanceId)) {
            bounds.set(object.instanceId, {
                ...(object as BuildingPartItem),
                pointIds: [],
                boundingBox: new THREE.Box3()
            });
        }

        const result = bounds.get(object.instanceId)!;
        result.pointIds.push(index);
        result.boundingBox.expandByPoint(new THREE.Vector3(...point));
    }
}

for (const object of orderedParts) {
    const [sx, sy, sz] = object.size;
    const center = object.position;
    const area = 2 * (sx * sy + sy * sz + sx * sz);

    const count = Math.max(
        110,
        Math.min(object.class === "GROUND" ? 1600 : 2400, Math.floor(area * 28))
    );

    // Exact corners ensure measured extents are derived from actual point data.
    for (const x of [-0.5, 0.5]) {
        for (const y of [-0.5, 0.5]) {
            for (const z of [-0.5, 0.5]) {
                append(
                    [center[0] + sx * x, center[1] + sy * y, center[2] + sz * z],
                    [0, 1, 0],
                    object
                );
            }
        }
    }

    const weights = [sy * sz, sx * sz, sx * sy];
    const total = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < count; i++) {
        let choice = random() * total;
        let axis = 0;

        while (axis < 2 && choice > weights[axis]) {
            choice -= weights[axis++];
        }

        const side = random() > 0.5 ? 1 : -1;
        const p: [number, number, number] = [
            (random() - 0.5) * sx,
            (random() - 0.5) * sy,
            (random() - 0.5) * sz
        ];

        p[axis] = object.size[axis] * 0.5 * side;

        const normal: [number, number, number] = [0, 0, 0];
        normal[axis] = side;

        append(
            p.map((value, coordinate) => value + center[coordinate]) as [number, number, number],
            normal,
            object
        );
    }
}

export const cleanPointCount = positions.length / 3;

// Add synthetic noise points across campus airspace
for (let i = 0; i < 450; i++) {
    append(
        [(random() - 0.5) * 49, 2 + random() * 19, (random() - 0.5) * 37],
        [0, 1, 0],
        {
            classId: 8,
            instanceId: -1,
            color: "#a7bdc7"
        },
        true
    );
}

export interface PointDataSet {
    position: Float32Array;
    photoPosition: Float32Array;
    rgb: Float32Array;
    semantic: Float32Array;
    classId: Float32Array;
    instanceId: Float32Array;
    noise: Float32Array;
    intensity: Float32Array;
    timestamp: Float64Array;
    normal: Float32Array;
    count: number;
    provenance: string;
}

export const pointData: PointDataSet = {
    position: new Float32Array(positions),
    photoPosition: new Float32Array(photoPositions),
    rgb: new Float32Array(rgb),
    semantic: new Float32Array(semanticColors),
    classId: new Float32Array(classIds),
    instanceId: new Float32Array(instanceIds),
    noise: new Float32Array(noise),
    intensity: new Float32Array(intensities),
    timestamp: new Float64Array(timestamps),
    normal: new Float32Array(normals),
    count: positions.length / 3,
    provenance: "simulated"
};

export const objects = bounds;

export interface MeasuredObject extends Omit<BoundedObject, "size"> {
    size: THREE.Vector3;
    center: THREE.Vector3;
    width: number;
    height: number;
    depth: number;
    area: number;
    elevation: number;
    slopeDegrees: number | null;
    source: string;
}

export function measureObject(instanceId: number | string): MeasuredObject | null {
    const object = bounds.get(Number(instanceId));
    if (!object) return null;

    const size = object.boundingBox.getSize(new THREE.Vector3());
    const center = object.boundingBox.getCenter(new THREE.Vector3());

    const horizontalWidth =
        object.class === "WALL" ? Math.max(size.x, size.z) : size.x;

    const depth =
        object.class === "WALL" ? Math.min(size.x, size.z) : size.z;

    let area: number;

    if (["FLOOR", "ROOF", "GROUND", "BALCONY"].includes(object.class)) {
        area = size.x * size.z;
    } else {
        area = horizontalWidth * size.y;
    }

    return {
        ...object,
        size,
        center,
        width: horizontalWidth,
        height: size.y,
        depth,
        area,
        elevation: object.boundingBox.min.y,
        slopeDegrees: object.class === "ROOF" ? 0 : null,
        source: "bounds calculated from generated XYZ points"
    };
}

export function registrationRMSE(): number {
    let sum = 0;

    for (let i = 0; i < cleanPointCount * 3; i++) {
        const delta = pointData.position[i] - pointData.photoPosition[i];
        sum += delta * delta;
    }

    return Math.sqrt(sum / cleanPointCount);
}

export function normalSegments(limit = 700): Float32Array {
    const result: number[] = [];
    const stride = Math.max(1, Math.floor(cleanPointCount / limit));

    for (let index = 0; index < cleanPointCount; index += stride) {
        const offset = index * 3;
        const p = pointData.position.slice(offset, offset + 3);
        const n = pointData.normal.slice(offset, offset + 3);

        result.push(
            p[0], p[1], p[2],
            p[0] + n[0] * 0.42,
            p[1] + n[1] * 0.42,
            p[2] + n[2] * 0.42
        );
    }

    return new Float32Array(result);
}
