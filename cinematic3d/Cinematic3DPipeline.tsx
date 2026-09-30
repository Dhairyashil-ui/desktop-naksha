import React, { Component, useEffect, useState, ReactNode } from "react";
import SurveySceneView from "./scene/SurveySceneView";
import {
    stages,
    END,
    transport,
    startTimeline,
    useTimeline,
    formatTime
} from "./cinematic/cinematicTimeline";
import {
    classes,
    classColors,
    metadata,
    engineeringCoordinates
} from "./data/surveyData";
import {
    measureObject
} from "./processing/surveyProcessor";
import { BuildingOptions } from "./scene/BuildingModel";
import "./cinematic3d.css";

interface SceneBoundaryProps {
    children: ReactNode;
}

interface SceneBoundaryState {
    error: Error | null;
}

class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
    state: SceneBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): SceneBoundaryState {
        return { error };
    }

    render() {
        if (this.state.error) {
            return (
                <div className="scene-error">
                    <p>3D WebGL rendering could not be initialized.</p>
                    <small>
                        Use a current WebGL-enabled browser with hardware acceleration.
                    </small>
                    <button onClick={() => location.reload()}>RETRY</button>
                </div>
            );
        }

        return this.props.children;
    }
}


interface InspectorProps {
    options: BuildingOptions;
    setOptions: React.Dispatch<React.SetStateAction<BuildingOptions>>;
}

function Inspector({ options, setOptions }: InspectorProps) {
    const object = measureObject(options.selected);
    const coordinates = object
        ? engineeringCoordinates(object.center)
        : null;

    const update = (patch: Partial<BuildingOptions>) => setOptions(previous => ({ ...previous, ...patch }));

    return (
        <aside className="inspector">
            <div className="inspector-heading">
                <span>INTERACTIVE RECONSTRUCTION</span>
                <span className="live-dot" />
            </div>

            <label className="field-label" htmlFor="representation">
                REPRESENTATION
            </label>

            <select
                id="representation"
                value={options.view}
                onChange={event => update({ view: event.target.value })}
            >
                <option value="model">Final model</option>
                <option value="fused">Fused XYZ + RGB</option>
                <option value="lidar">LiDAR point cloud</option>
                <option value="photo">Photogrammetry geometry</option>
            </select>

            <label className="field-label" htmlFor="class-filter">ISOLATE CLASS</label>

            <select
                id="class-filter"
                value={options.classFilter}
                onChange={event => update({ classFilter: Number(event.target.value) })}
            >
                <option value={-1}>All classes</option>
                {classes.map((name, index) => (
                    <option value={index} key={name}>{name}</option>
                ))}
            </select>

            <div className="inspector-toggles">
                {[
                    ["showCloud", "Point cloud"],
                    ["showMesh", "Mesh"],
                    ["semantic", "Semantic colors"],
                    ["measurements", "Measurements"],
                    ["coordinates", "Coordinates"],
                    ["isolate", "Isolate selected object"]
                ].map(([key, label]) => (
                    <label key={key}>
                        <input
                            type="checkbox"
                            checked={Boolean(options[key as keyof BuildingOptions])}
                            onChange={event => update({ [key]: event.target.checked })}
                        />
                        <span>{label}</span>
                    </label>
                ))}
            </div>

            {object && (
                <div className="object-readout">
                    <span className="field-label">SELECTED INSTANCE</span>

                    <h3>
                        <i style={{ background: classColors[object.classId] }} />
                        {object.class} <span>#{object.instanceId}</span>
                    </h3>

                    <dl>
                        <dt>Points</dt>
                        <dd>{object.pointIds.length.toLocaleString()}</dd>

                        <dt>Width</dt>
                        <dd>{object.width.toFixed(3)} m</dd>

                        <dt>Height</dt>
                        <dd>{object.height.toFixed(3)} m</dd>

                        <dt>Depth</dt>
                        <dd>{object.depth.toFixed(3)} m</dd>

                        <dt>Area</dt>
                        <dd>{object.area.toFixed(3)} m²</dd>

                        <dt>Local elevation</dt>
                        <dd>{object.elevation.toFixed(3)} m</dd>
                    </dl>

                    {options.coordinates && coordinates && (
                        <div className="coordinate-readout">
                            <span>E {coordinates.easting.toFixed(3)}</span>
                            <span>N {coordinates.northing.toFixed(3)}</span>
                            <span>H {coordinates.height.toFixed(3)}</span>
                            <small>Demonstration engineering frame</small>
                        </div>
                    )}

                    <p className="inspector-note">
                        Dimensions calculated from generated XYZ bounds.
                        Class labels are procedural ground truth, not AI inference.
                    </p>
                </div>
            )}

            <p className="viewer-help">
                Drag to orbit · Scroll to zoom<br />
                Right-drag to pan · Click an object to inspect
            </p>
        </aside>
    );
}

function About({ close }: { close: () => void }) {
    return (
        <div className="modal-backdrop" onClick={close}>
            <section
                className="about"
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-title"
                onClick={event => event.stopPropagation()}
            >
                <button className="close-button" onClick={close} aria-label="Close">
                    ×
                </button>

                <span className="eyebrow">DATA PROVENANCE</span>
                <h2 id="about-title">A visible process. An honest simulation.</h2>

                <p>
                    This is a digital survey demonstration using a procedural campus
                    building. An authoritative PPCRC model and actual survey observations
                    have not been supplied.
                </p>

                <p>
                    Laser propagation is intentionally slowed. GNSS/INS positions the
                    sensor trajectory; it does not independently observe each LiDAR point.
                    GCPs represent control or validation references.
                </p>

                <p>
                    Camera images are rendered from virtual cameras. Registration,
                    photogrammetry, and segmentation are staged visual simulations.
                    Displayed object bounds are computed from generated point coordinates.
                </p>

                <p>
                    Real LiDAR decoding, trajectory processing, SfM/MVS, registration,
                    inference, and texture baking belong behind the processing adapters.
                </p>

                <button onClick={close}>RETURN TO SURVEY</button>
            </section>
        </div>
    );
}

export interface Cinematic3DPipelineProps {
    onComplete?: () => void;
    onExit?: () => void;
}

export const Cinematic3DPipeline: React.FC<Cinematic3DPipelineProps> = ({
    onComplete,
    onExit
}) => {
    const timeline = useTimeline();
    const { time, stage, playing, rate, camera } = timeline;

    const [about, setAbout] = useState(false);

    const [options, setOptions] = useState<BuildingOptions>({
        selected: 127,
        view: "model",
        showCloud: true,
        showMesh: true,
        semantic: false,
        measurements: true,
        coordinates: false,
        isolate: false,
        classFilter: -1
    });

    useEffect(() => startTimeline(), []);

    // Reduced motion accessibility preference
    useEffect(() => {
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");

        function applyPreference() {
            if (!preference.matches) return;

            if (transport.read().playing) {
                transport.play();
            }

            transport.seek(14);

            if (transport.read().camera === "cinematic") {
                transport.camera();
            }
        }

        applyPreference();

        preference.addEventListener("change", applyPreference);
        return () => {
            preference.removeEventListener("change", applyPreference);
        };
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            const tag = (event.target as HTMLElement)?.tagName;

            if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;

            if (event.code === "Space") {
                event.preventDefault();
                transport.play();
            }

            if (event.code === "ArrowRight") {
                event.preventDefault();
                transport.forwardLive(10, 10);
            }

            if (event.code === "ArrowLeft") {
                event.preventDefault();
                transport.seek(Math.max(0, transport.read().time - 10));
            }

            if (event.code === "Escape") setAbout(false);
        }

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const interactive = stage.id === "inspect";
    const interfaceVisible = true;

    return (
        <main className="experience">
            <div className="scene">
                <SceneBoundary>
                    <SurveySceneView
                        options={options}
                        onSelect={selected => {
                            setOptions(previous => ({ ...previous, selected }));
                        }}
                    />
                </SceneBoundary>
            </div>

            <div className="film-grain" aria-hidden="true" />
            <div className="top-shade" aria-hidden="true" />
            <div className="bottom-shade" aria-hidden="true" />

            {timeline.isFastForwarding && (
                <div className="live-fast-forward-badge" role="status">
                    <span className="live-ff-icon">⏩</span>
                    <div className="live-ff-content">
                        <strong>FAST-FORWARD {timeline.fastForwardRate || 10}×</strong>
                    </div>
                </div>
            )}

            <div className={`interface ${interfaceVisible ? "visible" : ""}`}>
                <header className="masthead video-masthead">
                    <div>
                        {onExit && (
                            <button 
                                onClick={onExit}
                                style={{
                                    border: '1px solid rgba(182, 213, 171, 0.4)',
                                    padding: '7px 16px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontFamily: 'var(--mono)',
                                    color: '#d1fae5',
                                    background: 'rgba(7, 18, 22, 0.85)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer',
                                    backdropFilter: 'blur(8px)'
                                }}
                            >
                                ← Exit to Surveyor
                            </button>
                        )}
                    </div>

                    {onComplete && (
                        <button 
                            onClick={onComplete}
                            style={{
                                border: '1px solid #16a34a',
                                background: '#16a34a',
                                padding: '7px 16px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--mono)',
                                color: '#ffffff',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.4)'
                            }}
                        >
                            Inspect 3D Model →
                        </button>
                    )}
                </header>

                {interactive && (
                    <Inspector options={options} setOptions={setOptions} />
                )}

                <footer className="transport">
                    <div className="scrubber">
                        <div className="timeline-track">
                            <div
                                className="timeline-filled"
                                style={{ width: `${(time / END) * 100}%` }}
                            />

                            {stages.slice(1, -1).map(item => (
                                <i
                                    key={item.id}
                                    style={{ left: `${(item.start / END) * 100}%` }}
                                />
                            ))}
                        </div>

                        <input
                            type="range"
                            min={0}
                            max={END}
                            step={0.1}
                            value={time}
                            onChange={event => {
                                const val = Number(event.target.value);
                                transport.seek(val);
                            }}
                            aria-label="Reconstruction timeline"
                            aria-valuetext={`${formatTime(time)}, ${stage.name}`}
                        />
                    </div>

                    <div className="transport-row">
                        <div className="playback-controls">
                            <button className="play-button" onClick={() => transport.play()} title={playing ? "Pause" : "Play"}>
                                <span>{playing ? "❚❚" : "▶"}</span>
                                {playing ? "PAUSE" : "PLAY"}
                            </button>

                            <button
                                className={rate === 0.35 ? "selected" : ""}
                                onClick={() => transport.rate(0.35)}
                                aria-pressed={rate === 0.35}
                                title="Slow motion (0.35×)"
                            >
                                0.35×
                            </button>

                            <button
                                className={rate === 1 && !timeline.isFastForwarding ? "selected" : ""}
                                onClick={() => transport.rate(1)}
                                aria-pressed={rate === 1}
                                title="Normal speed (1×)"
                            >
                                1×
                            </button>

                            <button
                                className={rate === 5 && !timeline.isFastForwarding ? "selected" : ""}
                                onClick={() => transport.rate(5)}
                                aria-pressed={rate === 5}
                                title="5× Fast Forward Playback"
                            >
                                5×
                            </button>

                            <span className="control-divider" />

                            <button
                                className={timeline.isFastForwarding ? "selected ff-active" : ""}
                                onMouseDown={() => transport.startHoldingFastForward(10)}
                                onMouseUp={() => transport.stopHoldingFastForward()}
                                onMouseLeave={() => transport.stopHoldingFastForward()}
                                onTouchStart={() => transport.startHoldingFastForward(10)}
                                onTouchEnd={() => transport.stopHoldingFastForward()}
                                onClick={() => transport.forwardLive(10, 10)}
                                title="Fast Forward 10× (Click for +10s, or hold for continuous 10× speed)"
                            >
                                <span>⏩</span> 10× FAST FWD
                            </button>

                            <button
                                onClick={() => transport.forwardLive(10, 10)}
                                title="Jump forward 10 seconds"
                            >
                                +10s ⏩
                            </button>

                            <button onClick={() => transport.skip()} title="Fast-forward live to next stage">
                                ⏭ SKIP
                            </button>
                        </div>

                        <div className="timecode">
                            {formatTime(time)} <span>/ {formatTime(END)}</span>
                        </div>

                        <div className="secondary-controls">
                            <button onClick={() => transport.restart()} title="Restart from beginning">
                                ↺ RESTART
                            </button>
                            <button onClick={() => transport.camera()} title="Toggle camera angle">
                                🎥 {camera === "cinematic" ? "DIRECTED" : "FREE"}
                            </button>
                        </div>
                    </div>
                </footer>
            </div>

            {about && <About close={() => setAbout(false)} />}

            <span className="sr-only">{metadata.mode}</span>
        </main>
    );
};

export default Cinematic3DPipeline;
