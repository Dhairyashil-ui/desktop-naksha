import * as THREE from "three";

export const metadata = {
    project: "NAKSHA 2.0 DIGITAL SURVEY",
    mode: "SIMULATION",
    assetSource: "Procedural demonstration building",
    authoritativePPCRCAsset: false,
    units: "metres",
    sceneAxes: { x: "east", y: "up", z: "north" },
    coordinateReferenceSystem: "DEMONSTRATION LOCAL ENGINEERING FRAME",
    engineeringOrigin: { easting: 500000, northing: 2500000, height: 100 }
};

export const classes = [
    "GROUND",
    "WALL",
    "FLOOR",
    "ROOF",
    "WINDOW",
    "DOOR",
    "AC",
    "BALCONY",
    "STRUCTURE"
];

export const classColors = [
    "#7b9181",
    "#76b7c5",
    "#bea879",
    "#8797cb",
    "#8ac8b6",
    "#e3b574",
    "#c995a6",
    "#a9bb83",
    "#a1aeb8"
];

export interface BuildingPartItem {
    class: string;
    classId: number;
    instanceId: number;
    parentId: string;
    position: [number, number, number];
    size: [number, number, number];
    color: string;
    confidence: number;
    provenance: string;
}

export const parts: BuildingPartItem[] = [];

let nextId = 500;

function part(
    semanticClass: string,
    position: [number, number, number],
    size: [number, number, number],
    color: string,
    instanceId = nextId++,
    parentId = "BUILDING-001"
): BuildingPartItem {
    const item: BuildingPartItem = {
        class: semanticClass,
        classId: classes.indexOf(semanticClass),
        instanceId,
        parentId,
        position,
        size,
        color,
        confidence: 1,
        provenance: "procedural-ground-truth"
    };

    parts.push(item);
    return item;
}

// A plausible campus-scale research building.
part("GROUND", [0, -0.18, 0], [42, 0.3, 32], "#6c7270", 10);

for (let floor = 0; floor <= 3; floor++) {
    part(
        floor === 3 ? "ROOF" : "FLOOR",
        [0, floor * 3.4, 0],
        [25.8, 0.24, 14.6],
        floor === 3 ? "#74817f" : "#a6aaa2",
        400 + floor
    );
}

let windowId = 201;

for (let floor = 0; floor < 3; floor++) {
    const base = floor * 3.4;

    for (const side of [-1, 1]) {
        const z = side * 7;

        // Continuous bands above and below the openings.
        part("WALL", [0, base + 0.5, z], [25.2, 0.95, 0.3], "#b7b5a5");
        part("WALL", [0, base + 2.95, z], [25.2, 0.85, 0.3], "#b7b5a5");

        for (let bay = 0; bay < 7; bay++) {
            const x = -10.8 + bay * 3.6;

            part("WALL", [x - 1.48, base + 1.72, z], [0.62, 1.55, 0.3], "#b7b5a5");

            const id = windowId++;

            part(
                "WINDOW",
                [x + 0.2, base + 1.72, z + side * 0.025],
                [2.55, 1.5, 0.13],
                "#38545d",
                id
            );

            part(
                "STRUCTURE",
                [x + 0.2, base + 1.72, z + side * 0.12],
                [0.055, 1.52, 0.06],
                "#929d99"
            );

            if (side === 1 && bay % 3 === 0 && floor > 0) {
                part(
                    "AC",
                    [x + 0.7, base + 0.63, 7.46],
                    [0.86, 0.52, 0.36],
                    "#aeb8b4",
                    301 + floor * 10 + bay
                );
            }
        }
    }

    for (const x of [-12.6, 12.6]) {
        part("WALL", [x, base + 1.7, 0], [0.3, 3.16, 14], "#aaa99c");
    }
}

// Distinct entrance objects with measurable dimensions.
part("DOOR", [-1.1, 1.025, 7.26], [0.92, 2.05, 0.14], "#586c6d", 127);
part("DOOR", [0.1, 1.025, 7.26], [0.92, 2.05, 0.14], "#586c6d", 128);

part("BALCONY", [0, 3.4, 8.15], [7.8, 0.22, 2.35], "#a3aaa1", 350);
part("STRUCTURE", [-3.6, 1.65, 8.7], [0.24, 3.3, 0.24], "#a7afa6");
part("STRUCTURE", [3.6, 1.65, 8.7], [0.24, 3.3, 0.24], "#a7afa6");

part("STRUCTURE", [0, 11, -1.7], [6.4, 1.5, 4.6], "#999f96");
part("AC", [7.4, 10.82, -2.4], [2.1, 0.95, 1.5], "#9daaa5", 301);

export function dronePosition(time: number): THREE.Vector3 {
    const arrival = Math.min(1, Math.max(0, (time - 40) / 40));
    const angle = 0.35 + Math.max(0, time - 75) * 0.012;
    const orbit = new THREE.Vector3(
        Math.sin(angle) * 22,
        18.5 + Math.sin(time * 0.023) * 1.4,
        Math.cos(angle) * 22
    );

    return new THREE.Vector3(65, 32, 65).lerp(
        orbit,
        arrival * arrival * (3 - 2 * arrival)
    );
}

export interface CameraImageRecord {
    imageId: string;
    timestamp: number;
    cameraPosition: [number, number, number];
    cameraRotation: [number, number, number, number];
    focalLength: number;
    sensorWidth: number;
    simulated: boolean;
    camera: THREE.PerspectiveCamera;
}

export const cameraImages: CameraImageRecord[] = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;

    const position = new THREE.Vector3(
        Math.sin(angle) * 28,
        19 + Math.sin(angle * 2) * 2,
        Math.cos(angle) * 28
    );

    const camera = new THREE.PerspectiveCamera(55, 1.5, 0.1, 200);
    camera.position.copy(position);
    camera.lookAt(0, 5, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    return {
        imageId: `IMG_${String(index + 1).padStart(3, "0")}`,
        timestamp: 450 + index * 2.5,
        cameraPosition: position.toArray() as [number, number, number],
        cameraRotation: camera.quaternion.toArray() as [number, number, number, number],
        focalLength: 24,
        sensorWidth: 25,
        simulated: true,
        camera
    };
});

export interface GcpRecord {
    id: string;
    x: number;
    y: number;
    z: number;
    role: "control" | "check";
    simulated: boolean;
}

export const gcpData: GcpRecord[] = [
    { id: "GCP-01", x: -17, y: 0.03, z: 12, role: "control", simulated: true },
    { id: "GCP-02", x: 17, y: 0.03, z: 11, role: "control", simulated: true },
    { id: "CHK-01", x: 16, y: 0.03, z: -12, role: "check", simulated: true }
];

export interface TrajectoryRecord {
    timestamp: number;
    position: [number, number, number];
    orientation: {
        roll: number;
        pitch: number;
        yaw: number;
    };
    source: string;
}

export const trajectory: TrajectoryRecord[] = Array.from({ length: 121 }, (_, index) => {
    const timestamp = 80 + index * 2;
    const position = dronePosition(timestamp);

    return {
        timestamp,
        position: position.toArray() as [number, number, number],
        orientation: {
            roll: Math.sin(timestamp * 0.04) * 0.025,
            pitch: 0.04,
            yaw: 0.35 + (timestamp - 75) * 0.012
        },
        source: "simulated-GNSS-INS"
    };
});

export function engineeringCoordinates(point: { x: number; y: number; z: number }) {
    const origin = metadata.engineeringOrigin;

    return {
        easting: origin.easting + point.x,
        northing: origin.northing + point.z,
        height: origin.height + point.y
    };
}
