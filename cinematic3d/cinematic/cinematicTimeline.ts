import { useSyncExternalStore } from "react";

export type StageDefinition = [string, string, number, string, string, number];

export interface Stage {
    id: string;
    name: string;
    duration: number;
    input: string;
    output: string;
    chapter: number;
    index: number;
    start: number;
    progress?: number;
}

const definitions: StageDefinition[] = [
    // 1. PHOTOGRAMMETRY (Photo-Geometry point cloud creation - Steps 11, 12, 13 first):
    ["photogrammetry", "Photogrammetric Point Cloud Extraction", 4.0, "Multi-view drone images", "Dense true-RGB 3D spatial cloud", 0],

    // 2. LIDAR (Progressive LiDAR point cloud creation - Step 10):
    ["lidar", "Progressive LiDAR Point Cloud Creation", 4.0, "Airborne 150kHz laser scanner", "High-density geometric LiDAR cloud", 1],

    // 3. FUSION (Co-registration and Multi-Sensor Fusion):
    ["fusion", "Multi-Sensor Co-Registration & Fusion", 4.0, "LiDAR geometry + photogrammetry RGB", "Unified XYZ + RGB digital twin cloud", 2],

    // 4. SEGMENTATION (3D AI Semantic Segmentation):
    ["segmentation", "3D AI Semantic Cadastral Segmentation", 4.0, "Point geometry + RGB features", "Classified 3D masks (roof/walls/openings)", 3],

    // 5. TOPOLOGY VALIDATION (Topology Validation & Watertight 3D Solid Model):
    ["topology", "Watertight Surface & Topology Validation", 4.5, "Segmented boundaries + LADM rules", "Certified 3D digital cadastral model", 4]
];

let start = 0;

export const stages: Stage[] = definitions.map(
    ([id, name, duration, input, output, chapter], index) => {
        const stage: Stage = { id, name, duration, input, output, chapter, index, start };
        start += duration;
        return stage;
    }
);

export const END = start;

export const chapters = [
    "PHOTOGRAMMETRY",
    "LIDAR",
    "FUSION",
    "SEGMENTATION",
    "TOPOLOGY VALIDATION"
];

export function stageAt(time: number): Stage & { progress: number } {
    const stage =
        [...stages].reverse().find(item => time >= item.start) || stages[0];

    return {
        ...stage,
        progress: Math.max(0, Math.min(1, (time - stage.start) / stage.duration))
    };
}

export interface TimelineState {
    time: number;
    playing: boolean;
    rate: number;
    camera: "cinematic" | "free";
    isFastForwarding: boolean;
    fastForwardRate: number;
    targetTime: number | null;
}

let state: TimelineState = {
    time: 0,
    playing: true,
    rate: 1,
    camera: "cinematic",
    isFastForwarding: false,
    fastForwardRate: 3,
    targetTime: null
};

let targetSeekTime: number | null = null;
let returnToRate = 1;
let wasPlayingBeforeSeek = true;

let snapshot = { ...state };
const subscribers = new Set<() => void>();

function emit() {
    snapshot = { ...state };
    subscribers.forEach(listener => listener());
}

function update(patch: Partial<TimelineState>) {
    state = { ...state, ...patch };
    emit();
}

export const transport = {
    read: (): TimelineState => state,

    play() {
        targetSeekTime = null;
        if (state.time >= END) {
            update({ time: 0, playing: true, camera: "cinematic", isFastForwarding: false, targetTime: null });
        } else {
            update({ playing: !state.playing, isFastForwarding: false, targetTime: null });
        }
    },

    seek(time: number) {
        targetSeekTime = null;
        const bounded = Math.max(0, Math.min(END, time));

        update({
            time: bounded,
            isFastForwarding: false,
            targetTime: null,
            ...(bounded >= END ? { playing: false, camera: "free" } : {})
        });
    },

    // Smooth live speedup forward without cut and go!
    seekLive(target: number, speedMultiplier = 10) {
        const bounded = Math.max(0, Math.min(END, target));
        if (bounded <= state.time) {
            this.seek(bounded);
            return;
        }

        targetSeekTime = bounded;
        wasPlayingBeforeSeek = state.playing;
        update({
            playing: true,
            isFastForwarding: true,
            fastForwardRate: speedMultiplier,
            targetTime: bounded
        });
    },

    // Fast-forward forward by N seconds live without cut!
    forwardLive(seconds = 10, speedMultiplier = 10) {
        const base = targetSeekTime !== null ? targetSeekTime : state.time;
        this.seekLive(base + seconds, speedMultiplier);
    },

    step() {
        this.forwardLive(2, 5);
    },

    skip() {
        const current = stageAt(state.time);
        const nextStage = stages[Math.min(current.index + 1, stages.length - 1)];
        this.seekLive(nextStage.start, 15);
    },

    startHoldingFastForward(multiplier = 10) {
        targetSeekTime = null;
        returnToRate = state.rate;
        update({
            playing: true,
            isFastForwarding: true,
            fastForwardRate: multiplier
        });
    },

    stopHoldingFastForward() {
        update({
            isFastForwarding: false,
            rate: returnToRate,
            targetTime: null
        });
    },

    restart() {
        targetSeekTime = null;
        update({ time: 0, playing: true, rate: 5, camera: "cinematic", isFastForwarding: false, targetTime: null });
    },

    rate(rate: number) {
        targetSeekTime = null;
        update({ rate, isFastForwarding: false, targetTime: null });
    },

    camera() {
        update({ camera: state.camera === "cinematic" ? "free" : "cinematic" });
    },

    setCamera(mode: "cinematic" | "free") {
        update({ camera: mode });
    }
};

export function startTimeline() {
    let frame: number;
    let previous = performance.now();
    let lastEmission = 0;

    function tick(now: number) {
        const delta = Math.min(0.1, (now - previous) / 1000);
        previous = now;

        if (state.playing) {
            if (targetSeekTime !== null) {
                // Live speedup to target time without cut and go
                const remaining = targetSeekTime - state.time;
                if (remaining > 0.05) {
                    // Dynamically calculate speed: completes the forward leap in ~0.35s,
                    // or at least fastForwardRate (10x)
                    const speed = Math.max(state.fastForwardRate, remaining / 0.35);
                    state.time = Math.min(targetSeekTime, state.time + delta * speed);
                } else {
                    state.time = targetSeekTime;
                    targetSeekTime = null;
                    state.isFastForwarding = false;
                    state.targetTime = null;
                    state.playing = wasPlayingBeforeSeek;
                    if (state.time >= END) {
                        state.playing = false;
                        state.camera = "free";
                    }
                }
            } else if (state.isFastForwarding) {
                state.time = Math.min(END, state.time + delta * state.fastForwardRate);
                if (state.time >= END) {
                    state.playing = false;
                    state.camera = "free";
                    state.isFastForwarding = false;
                }
            } else {
                state.time = Math.min(END, state.time + delta * state.rate);
                if (state.time >= END) {
                    state.playing = false;
                    state.camera = "free";
                }
            }
        }

        // Higher emission rate during live acceleration so UI scrubber and HUD glide at 30+ fps
        const emissionInterval = (state.isFastForwarding || targetSeekTime !== null) ? 33 : 80;
        if (now - lastEmission > emissionInterval) {
            emit();
            lastEmission = now;
        }

        frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
}

export function useTimeline(): TimelineState & { stage: Stage & { progress: number } } {
    const value = useSyncExternalStore(
        listener => {
            subscribers.add(listener);
            return () => subscribers.delete(listener);
        },
        () => snapshot,
        () => snapshot
    );

    return { ...value, stage: stageAt(value.time) };
}

export function formatTime(seconds: number): string {
    const whole = Math.floor(seconds);
    return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(
        whole % 60
    ).padStart(2, "0")}`;
}

export function phaseIndex(id: string): number {
    return stages.findIndex(stage => stage.id === id);
}
