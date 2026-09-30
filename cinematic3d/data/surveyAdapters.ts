export const supportedExtensions = {
    lidar: [".las", ".laz"],
    imagery: [".jpg", ".jpeg", ".tiff", ".tif"],
    trajectory: [".csv", ".txt", ".pos", ".nmea"],
    control: [".csv", ".txt"],
    metadata: [".json", ".csv"]
};

export interface SurveyPoint {
    x: number;
    y: number;
    z: number;
    intensity?: number;
    timestamp?: number;
    id?: string;
}

export interface SurveyDataset {
    points?: SurveyPoint[];
    gcps?: (SurveyPoint & { id: string })[];
    metadata?: Record<string, unknown>;
}

export interface ProcessingBackend {
    processTrajectory: (data: unknown) => Promise<unknown>;
    processLidar: (data: unknown) => Promise<unknown>;
    photogrammetry: (data: unknown) => Promise<unknown>;
    registerClouds: (data: unknown) => Promise<unknown>;
    segment: (data: unknown) => Promise<unknown>;
    reconstructMesh: (data: unknown) => Promise<unknown>;
    [key: string]: unknown;
}

type FileReaderFn = (file: File, options?: { signal?: AbortSignal }) => Promise<unknown>;

const readers = new Map<string, FileReaderFn>();

export function registerReader(extension: string, reader: FileReaderFn) {
    readers.set(extension.toLowerCase(), reader);
}

export function registerProcessingBackend(backend: ProcessingBackend) {
    const required = [
        "processTrajectory",
        "processLidar",
        "photogrammetry",
        "registerClouds",
        "segment",
        "reconstructMesh"
    ] as const;

    for (const method of required) {
        if (typeof backend[method] !== "function") {
            throw new Error(`Processing backend is missing ${method}().`);
        }
    }

    return backend;
}

export function validatePoint(point: Record<string, unknown>, index = 0) {
    for (const key of ["x", "y", "z"]) {
        if (!Number.isFinite(point[key])) {
            throw new Error(`Point ${index}: ${key} must be a finite number.`);
        }
    }

    for (const optional of ["intensity", "timestamp"]) {
        if (point[optional] != null && !Number.isFinite(point[optional])) {
            throw new Error(`Point ${index}: invalid optional ${optional}.`);
        }
    }

    return point;
}

export function validateDataset(dataset: unknown): SurveyDataset {
    if (!dataset || typeof dataset !== "object") {
        throw new Error("Dataset must be an object.");
    }

    const typedDataset = dataset as SurveyDataset;

    if (typedDataset.points != null) {
        if (!Array.isArray(typedDataset.points)) {
            throw new Error("points must be an array.");
        }

        typedDataset.points.forEach((p, i) => validatePoint(p as unknown as Record<string, unknown>, i));
    }

    if (typedDataset.gcps != null) {
        typedDataset.gcps.forEach((gcp, index) => {
            if (!gcp.id) throw new Error(`GCP ${index} requires an ID.`);
            validatePoint(gcp as unknown as Record<string, unknown>, index);
        });
    }

    return typedDataset;
}

registerReader(".json", async (file: File) => {
    return validateDataset(JSON.parse(await file.text()));
});

export async function readSurveyFile(file: File, { signal }: { signal?: AbortSignal } = {}) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    const reader = readers.get(extension);

    if (!reader) {
        throw new Error(
            `No ${extension} decoder has been installed. ` +
            "Register a worker-backed decoder or a backend ingestion adapter."
        );
    }

    return reader(file, { signal });
}
