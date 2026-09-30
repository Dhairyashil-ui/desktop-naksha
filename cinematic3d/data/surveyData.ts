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

export function generateBuildingParts(
    totalFloors: number = 4,
    floorHeight: number = 3.2
): BuildingPartItem[] {
    const list: BuildingPartItem[] = [];
    let curId = 500;

    const addPart = (
        semanticClass: string,
        position: [number, number, number],
        size: [number, number, number],
        color: string,
        instanceId = curId++,
        parentId = "BUILDING-001"
    ): BuildingPartItem => {
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
        list.push(item);
        return item;
    };

    // Ground platform / terrain
    addPart("GROUND", [0, -0.18, 0], [42, 0.3, 32], "#6c7270", 10);

    // Concrete slabs for each floor + top roof slab
    for (let floor = 0; floor <= totalFloors; floor++) {
        const isRoof = floor === totalFloors;
        addPart(
            isRoof ? "ROOF" : "FLOOR",
            [0, floor * floorHeight, 0],
            isRoof ? [26.2, 0.28, 15.0] : [25.8, 0.24, 14.6],
            isRoof ? "#74817f" : "#a6aaa2",
            400 + floor
        );
    }

    let windowId = 201;

    // Walls, windows, and AC units for each storey
    for (let floor = 0; floor < totalFloors; floor++) {
        const base = floor * floorHeight;

        for (const side of [-1, 1]) {
            const z = side * 7;

            // Continuous horizontal bands above and below the openings
            addPart("WALL", [0, base + 0.45, z], [25.2, 0.9, 0.3], "#b7b5a5");
            addPart("WALL", [0, base + floorHeight - 0.35, z], [25.2, 0.7, 0.3], "#b7b5a5");

            for (let bay = 0; bay < 7; bay++) {
                const x = -10.8 + bay * 3.6;

                addPart("WALL", [x - 1.48, base + floorHeight * 0.52, z], [0.62, floorHeight * 0.48, 0.3], "#b7b5a5");

                const id = windowId++;

                addPart(
                    "WINDOW",
                    [x + 0.2, base + floorHeight * 0.52, z + side * 0.025],
                    [2.55, floorHeight * 0.46, 0.13],
                    "#38545d",
                    id
                );

                addPart(
                    "STRUCTURE",
                    [x + 0.2, base + floorHeight * 0.52, z + side * 0.12],
                    [0.055, floorHeight * 0.47, 0.06],
                    "#929d99"
                );

                if (side === 1 && bay % 3 === 0 && floor > 0) {
                    addPart(
                        "AC",
                        [x + 0.7, base + 0.63, 7.46],
                        [0.86, 0.52, 0.36],
                        "#aeb8b4",
                        301 + floor * 10 + bay
                    );
                }
            }
        }

        // East & West side walls
        for (const x of [-12.6, 12.6]) {
            addPart("WALL", [x, base + floorHeight * 0.5, 0], [0.3, floorHeight - 0.04, 14], "#aaa99c");
        }
    }

    // Entrance doors and porch canopy on Ground Floor
    addPart("DOOR", [-1.1, 1.025, 7.26], [0.92, 2.05, 0.14], "#586c6d", 127);
    addPart("DOOR", [0.1, 1.025, 7.26], [0.92, 2.05, 0.14], "#586c6d", 128);

    addPart("BALCONY", [0, floorHeight, 8.15], [7.8, 0.22, 2.35], "#a3aaa1", 350);
    addPart("STRUCTURE", [-3.6, floorHeight * 0.5, 8.7], [0.24, floorHeight, 0.24], "#a7afa6");
    addPart("STRUCTURE", [3.6, floorHeight * 0.5, 8.7], [0.24, floorHeight, 0.24], "#a7afa6");

    // Rooftop head room / elevator machine room & chiller AC on the roof
    const roofY = totalFloors * floorHeight;
    addPart("STRUCTURE", [0, roofY + 0.75, -1.7], [6.4, 1.5, 4.6], "#999f96");
    addPart("AC", [7.4, roofY + 0.5, -2.4], [2.1, 0.95, 1.5], "#9daaa5", 301);

    return list;
}

export const parts: BuildingPartItem[] = generateBuildingParts(4, 3.2);

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
