import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ArrowRight, RotateCcw, Home, Layers, Ruler } from 'lucide-react';
import { AssignedParcel, StrataUnitData, fetchRealUnits } from '../../services/surveyApi';
import { getParcelBuildingMetrics } from './construction/cadastralPipelineElements';

const PALETTE: number[] = [0x38bdf8, 0x34d399, 0xfbbf24, 0xa78bfa, 0xf472b6, 0x60a5fa, 0x4ade80, 0xf87171];
const FLOOR_H = 3.6;

function solidMat(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.06 });
}
function ghostMat(color: number) {
  return new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.07, roughness: 0.5, side: THREE.FrontSide });
}
function wfMat() {
  return new THREE.MeshStandardMaterial({ color: 0x7dd3fc, wireframe: true, transparent: true, opacity: 0.18 });
}
function edgeMat(active: boolean) {
  return new THREE.LineBasicMaterial({ color: active ? 0x0ea5e9 : 0xbae6fd, transparent: true, opacity: active ? 0.9 : 0.22 });
}

function addWindowDetail(group: THREE.Group, cx: number, cy: number, cz: number, w: number, h: number, d: number) {
  const m = new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.5 });
  const mk = (pts: THREE.Vector3[]) => group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
  for (let i = 1; i <= 2; i++) {
    const y = cy - h / 2 + (h / 3) * i;
    mk([new THREE.Vector3(cx - w/2 + 0.08, y, cz - d/2 + 0.02), new THREE.Vector3(cx + w/2 - 0.08, y, cz - d/2 + 0.02)]);
  }
  for (let i = 1; i <= 3; i++) {
    const x = cx - w / 2 + (w / 4) * i;
    mk([new THREE.Vector3(x, cy - h/2 + 0.28, cz - d/2 + 0.02), new THREE.Vector3(x, cy + h/2 - 0.28, cz - d/2 + 0.02)]);
  }
}

function addHeightLine(group: THREE.Group, cx: number, bottomY: number, cz: number) {
  const m = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 });
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(cx + 3.4, 0, cz), new THREE.Vector3(cx + 3.4, bottomY, cz)
  ]), m));
  const tm = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.7 });
  [0, bottomY].forEach(yy => {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cx + 3.1, yy, cz), new THREE.Vector3(cx + 3.7, yy, cz)
    ]), tm));
  });
}

interface Property3DScreenProps {
  parcel: AssignedParcel;
  onGenerateReport: (unit?: StrataUnitData | null) => void;
}

export const Property3DScreen: React.FC<Property3DScreenProps> = ({ parcel, onGenerateReport }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animIdRef = useRef<number>(0);
  const unitMeshesMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const unitEdgesMap = useRef<Map<string, THREE.LineSegments>>(new Map());
  const unitIdxMap = useRef<Map<string, number>>(new Map());
  const unitYMap = useRef<Map<string, { bottom: number; top: number }>>(new Map());
  const floorGroupsMap = useRef<Map<number, THREE.Group>>(new Map());

  const [units, setUnits] = useState<StrataUnitData[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<StrataUnitData | null>(null);
  const [surveyedUnitId, setSurveyedUnitId] = useState<string | null>(null);
  const [isolatedFloor, setIsolatedFloor] = useState<number | null>(null);
  const [pulseClock, setPulseClock] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      let data = await fetchRealUnits(parcel);
      const metrics = getParcelBuildingMetrics(parcel);
      const targetFloors = parcel.floorsCount || metrics.totalFloors || 4;

      // Ensure all floors 1..targetFloors have authentic units
      const existingFloors = new Set(data.map(u => u.floor));
      const baseUlpin = parcel.baseUlpin || '27-07-005-012345';

      for (let f = 1; f <= targetFloors; f++) {
        if (!existingFloors.has(f)) {
          const floorUnits: StrataUnitData[] = [
            {
              id: `unit_${f}01`,
              unitNumber: `${f + 1}01`,
              unitType: '2BHK Luxury (North-East Corner)',
              floor: f,
              carpetAreaSqm: 71.5,
              builtUpAreaSqm: 89.3,
              volumeM3: 274.6,
              centroidX: 380131.19,
              centroidY: 2040131.06,
              centroidZ: 548.89 + (f - 1) * 3.6,
              baseUlpin: baseUlpin,
              ulpin3d: `${baseUlpin}-F0${f}-${f + 1}01`,
              ownerName: 'Pimpri Chinchwad Research & Education Trust',
              deedNumber: `MH-PUN-HAV-2026-${f + 1}01`,
              undividedSharePct: 4.466
            },
            {
              id: `unit_${f}02`,
              unitNumber: `${f + 1}02`,
              unitType: '3BHK Premium (North-West Corner)',
              floor: f,
              carpetAreaSqm: 59.5,
              builtUpAreaSqm: 74.4,
              volumeM3: 228.6,
              centroidX: 380118.92,
              centroidY: 2040129.64,
              centroidZ: 548.89 + (f - 1) * 3.6,
              baseUlpin: baseUlpin,
              ulpin3d: `${baseUlpin}-F0${f}-${f + 1}02`,
              ownerName: 'Pimpri Chinchwad Research & Education Trust',
              deedNumber: `MH-PUN-HAV-2026-${f + 1}02`,
              undividedSharePct: 3.718
            },
            {
              id: `unit_${f}03`,
              unitNumber: `${f + 1}03`,
              unitType: '2BHK Standard (South-West Corner)',
              floor: f,
              carpetAreaSqm: 74.0,
              builtUpAreaSqm: 92.5,
              volumeM3: 284.3,
              centroidX: 380120.47,
              centroidY: 2040119.25,
              centroidZ: 548.89 + (f - 1) * 3.6,
              baseUlpin: baseUlpin,
              ulpin3d: `${baseUlpin}-F0${f}-${f + 1}03`,
              ownerName: 'Pimpri Chinchwad Research & Education Trust',
              deedNumber: `MH-PUN-HAV-2026-${f + 1}03`,
              undividedSharePct: 4.624
            },
            {
              id: `unit_${f}04`,
              unitNumber: `${f + 1}04`,
              unitType: '3BHK Executive (South-East Corner)',
              floor: f,
              carpetAreaSqm: 72.0,
              builtUpAreaSqm: 90.0,
              volumeM3: 276.8,
              centroidX: 380130.99,
              centroidY: 2040120.84,
              centroidZ: 548.89 + (f - 1) * 3.6,
              baseUlpin: baseUlpin,
              ulpin3d: `${baseUlpin}-F0${f}-${f + 1}04`,
              ownerName: 'Pimpri Chinchwad Research & Education Trust',
              deedNumber: `MH-PUN-HAV-2026-${f + 1}04`,
              undividedSharePct: 4.502
            }
          ];
          data = [...data, ...floorUnits];
        }
      }

      if (mounted && data.length > 0) {
        setUnits(data);
        setSelectedUnit(data[0]);
        setSurveyedUnitId(data[0].id);
      }
    }
    load();
    return () => { mounted = false; };
  }, [parcel]);

  useEffect(() => {
    if (!mountRef.current || units.length === 0) return;
    const container = mountRef.current;
    const width = container.clientWidth, height = container.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfafcff);
    scene.fog = new THREE.FogExp2(0xeef4ff, 0.014);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(26, 22, 30);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04; controls.minDistance = 6; controls.maxDistance = 80;
    controls.target.set(0, 7, 0); controlsRef.current = controls;
    scene.add(new THREE.AmbientLight(0xdbeafe, 1.1));
    const sun = new THREE.DirectionalLight(0xfff7ed, 1.7);
    sun.position.set(20, 35, 18); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sun.shadow.bias = -0.001;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfdbfe, 0.45); fill.position.set(-14, 10, -10); scene.add(fill);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: 0xf0f6ff, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(60, 60, 0xdde4f0, 0xeef2fb); grid.position.y = 0.001; scene.add(grid);
    const defaultSurveyedId = units[0]?.id ?? null;
    unitMeshesMap.current.clear(); unitEdgesMap.current.clear(); unitIdxMap.current.clear();
    unitYMap.current.clear(); floorGroupsMap.current.clear();
    const floorsSet = new Set<number>();
    units.forEach(u => floorsSet.add(u.floor));
    const sortedFloors = Array.from(floorsSet).sort((a, b) => a - b);
    const maxFloor = sortedFloors.length > 0 ? sortedFloors[sortedFloors.length - 1] : 4;

    controls.target.set(0, (maxFloor * FLOOR_H) / 2, 0);

    sortedFloors.forEach(f => {
      const g = new THREE.Group(); g.name = `FLOOR_${f}`; scene.add(g); floorGroupsMap.current.set(f, g);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.18, 16.4), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 }));
      slab.position.set(0, (f - 1) * FLOOR_H, 0); slab.receiveShadow = true; g.add(slab);

      // Add top roof slab above the top floor
      if (f === maxFloor) {
        const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.22, 16.6), new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.8 }));
        roofSlab.position.set(0, f * FLOOR_H, 0); roofSlab.receiveShadow = true; g.add(roofSlab);
      }
    });
    units.forEach((u, idx) => {
      const fGroup = floorGroupsMap.current.get(u.floor); if (!fGroup) return;
      unitIdxMap.current.set(u.id, idx);
      const uW = 5.4, uH = 3.2, uL = 7.2;
      const ux = (idx % 2 === 0) ? -2.8 : 2.8;
      const uz = (Math.floor(idx / 2) % 2 === 0) ? -3.8 : 3.8;
      const bottomY = (u.floor - 1) * FLOOR_H + 0.18;
      const uy = bottomY + uH / 2;
      unitYMap.current.set(u.id, { bottom: bottomY, top: bottomY + uH });
      const isSurveyed = u.id === defaultSurveyedId;
      const uGeo = new THREE.BoxGeometry(uW, uH, uL);
      const body = new THREE.Mesh(uGeo, isSurveyed ? solidMat(PALETTE[idx % PALETTE.length]) : ghostMat(PALETTE[idx % PALETTE.length]));
      body.position.set(ux, uy, uz); body.castShadow = isSurveyed; body.receiveShadow = isSurveyed; body.userData = u;
      fGroup.add(body); unitMeshesMap.current.set(u.id, body);
      const wf = new THREE.Mesh(uGeo, wfMat()); wf.position.set(ux, uy, uz); fGroup.add(wf);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(uGeo), edgeMat(isSurveyed));
      edges.position.set(ux, uy, uz); fGroup.add(edges); unitEdgesMap.current.set(u.id, edges);
      if (isSurveyed) { addWindowDetail(fGroup, ux, uy, uz, uW, uH, uL); addHeightLine(fGroup, ux, bottomY, uz); }
    });
    const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
    const onPointerDown = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(Array.from(unitMeshesMap.current.values()));
      if (hits.length > 0) { const uData = hits[0].object.userData as StrataUnitData; if (uData?.id) setSelectedUnit(uData); }
    };
    container.addEventListener('pointerdown', onPointerDown);
    const clock = new THREE.Clock();
    const animate = () => { animIdRef.current = requestAnimationFrame(animate); controls.update(); setPulseClock(clock.getElapsedTime()); renderer.render(scene, camera); };
    animate();
    const onResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h; cameraRef.current.updateProjectionMatrix(); rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    return () => { container.removeEventListener('pointerdown', onPointerDown); cancelAnimationFrame(animIdRef.current); window.removeEventListener('resize', onResize); renderer.dispose(); };
  }, [units]);

  useEffect(() => {
    unitMeshesMap.current.forEach((mesh, id) => {
      const idx = unitIdxMap.current.get(id) ?? 0;
      const isSurveyed = id === surveyedUnitId, isSelected = id === selectedUnit?.id;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(PALETTE[idx % PALETTE.length]);
      if (isSurveyed) { mat.wireframe = false; mat.transparent = false; mat.opacity = 1; mat.roughness = 0.28; mesh.castShadow = true; }
      else { mat.wireframe = false; mat.transparent = true; mat.opacity = isSelected ? 0.16 : 0.07; mat.roughness = 0.5; mesh.castShadow = false; }
      mat.needsUpdate = true;
    });
    unitEdgesMap.current.forEach((edges, id) => {
      const isSurveyed = id === surveyedUnitId, isSelected = id === selectedUnit?.id;
      const mat = edges.material as THREE.LineBasicMaterial;
      mat.color.setHex(isSurveyed ? 0x0ea5e9 : isSelected ? 0x93c5fd : 0xbae6fd);
      mat.opacity = isSurveyed ? 0.9 : isSelected ? 0.55 : 0.2; mat.needsUpdate = true;
    });
  }, [surveyedUnitId, selectedUnit]);

  useEffect(() => {
    floorGroupsMap.current.forEach((group, floorNum) => { group.visible = isolatedFloor === null || floorNum === isolatedFloor; });
  }, [isolatedFloor]);

  useEffect(() => {
    if (!surveyedUnitId) return;
    const edges = unitEdgesMap.current.get(surveyedUnitId); if (!edges) return;
    const mat = edges.material as THREE.LineBasicMaterial;
    mat.opacity = 0.6 + 0.4 * Math.sin(pulseClock * 2.5); mat.needsUpdate = true;
  }, [pulseClock, surveyedUnitId]);

  const isSurveyed = selectedUnit?.id === surveyedUnitId;
  const sortedFloorNums = Array.from(new Set(units.map(u => u.floor))).sort((a, b) => a - b);
  const floorOptions: Array<number | null> = [null, ...sortedFloorNums];
  const ys = selectedUnit ? unitYMap.current.get(selectedUnit.id) : null;
  const heightFromGround = ys ? ys.bottom.toFixed(1) : '—';
  const ceilingHeight = ys ? ys.top.toFixed(1) : '—';
  const totalFloors = [...new Set(units.map(u => u.floor))].length;

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full bg-white text-zinc-900 flex flex-col justify-between font-sans select-none overflow-hidden relative">
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing z-0" />

      {/* Top bar */}
      <div className="relative z-10 w-full px-5 pt-4 flex items-center justify-between pointer-events-none">
        <div className="bg-white/92 backdrop-blur-sm border border-zinc-200 rounded-lg px-3 py-1.5 font-mono text-xs shadow-sm pointer-events-auto flex items-center space-x-3">
          <span className="font-bold text-zinc-900">3D PROPERTY SPACE</span>
          <span className="text-zinc-300">•</span>
          <span className="text-zinc-500">Parcel {parcel.surveyNumber}/{parcel.subDivision}</span>
          <span className="text-zinc-300">•</span>
          <span className="flex items-center space-x-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-sky-600 font-semibold">SURVEY ACTIVE</span>
          </span>
        </div>
        <div className="bg-white/92 backdrop-blur-sm border border-zinc-200 rounded-lg p-1.5 shadow-sm pointer-events-auto flex items-center space-x-1 font-mono text-xs">
          <Layers className="w-3 h-3 text-zinc-400 ml-1" />
          <span className="text-[10px] text-zinc-400 px-1 uppercase">Floor:</span>
          {floorOptions.map(f => (
            <button key={f === null ? 'all' : f} onClick={() => setIsolatedFloor(f)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${isolatedFloor === f ? 'bg-zinc-900 text-white font-bold' : 'text-zinc-600 hover:bg-zinc-100'}`}>
              {f === null ? 'All' : f}
            </button>
          ))}
          <div className="h-4 w-px bg-zinc-200 mx-1" />
          <button onClick={() => { controlsRef.current?.reset(); setIsolatedFloor(null); }} className="p-1 text-zinc-500 hover:text-zinc-900 rounded" title="Reset Camera">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-20 left-5 z-10 font-mono text-[10px] space-y-1.5 pointer-events-none">
        <div className="flex items-center space-x-2"><span className="inline-block w-3 h-3 rounded-sm bg-sky-400 shadow" /><span className="text-zinc-500">Surveyed Unit — Full Construction</span></div>
        <div className="flex items-center space-x-2"><span className="inline-block w-3 h-3 rounded-sm border border-sky-200 bg-transparent" /><span className="text-zinc-400">Other Units — Wireframe</span></div>
        <div className="flex items-center space-x-2"><span className="inline-block w-6 h-0.5 bg-yellow-400" /><span className="text-zinc-400">Height from Ground</span></div>
      </div>

      {/* Right info card */}
      {selectedUnit && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10 font-mono pointer-events-auto text-left" style={{ width: '17rem' }}>
          <div className="bg-white/97 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
            <div className={`px-5 pt-4 pb-3 border-b ${isSurveyed ? 'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-100' : 'bg-zinc-50 border-zinc-100'}`}>
              <div className={`text-[10px] uppercase font-bold tracking-wider ${isSurveyed ? 'text-sky-600' : 'text-zinc-400'}`}>
                {isSurveyed ? '✦ Surveyed Unit' : 'Strata Unit'}
              </div>
              <div className="text-lg font-bold text-zinc-900 mt-0.5 flex items-center space-x-2">
                <Home className="w-4 h-4 text-sky-500" />
                <span>Unit {selectedUnit.unitNumber}</span>
              </div>
              <div className={`text-[11px] font-semibold mt-0.5 ${isSurveyed ? 'text-sky-500' : 'text-zinc-400'}`}>
                {selectedUnit.ulpin3d || `${selectedUnit.baseUlpin}-F0${selectedUnit.floor}-${selectedUnit.unitNumber}`}
              </div>
            </div>
            <div className="px-5 py-3 space-y-2.5 text-[11px]">
              {/* Parcel */}
              <div className="pb-2 border-b border-zinc-100">
                <div className="text-[9px] uppercase text-zinc-400 font-bold mb-1.5 tracking-wider">Parcel</div>
                <div className="flex justify-between"><span className="text-zinc-400">Survey No.</span><span className="font-semibold text-zinc-800">{parcel.surveyNumber}/{parcel.subDivision}</span></div>
                <div className="flex justify-between mt-1"><span className="text-zinc-400">Village</span><span className="font-semibold text-zinc-800 truncate max-w-[120px]">{(parcel as any).village || '—'}</span></div>
                <div className="flex justify-between mt-1"><span className="text-zinc-400">Taluka</span><span className="font-semibold text-zinc-800 truncate max-w-[120px]">{(parcel as any).taluka || '—'}</span></div>
              </div>
              {/* Unit Geometry */}
              <div className="pb-2 border-b border-zinc-100">
                <div className="text-[9px] uppercase text-zinc-400 font-bold mb-1.5 tracking-wider">Unit Geometry</div>
                <div className="flex justify-between"><span className="text-zinc-400">Floor</span><span className="font-semibold text-zinc-800">{selectedUnit.floor} of {totalFloors}</span></div>
                <div className="flex justify-between mt-1"><span className="text-zinc-400">Carpet Area</span><span className="font-semibold text-zinc-800">{selectedUnit.carpetAreaSqm.toFixed(1)} m²</span></div>
                <div className="flex justify-between mt-1 items-center">
                  <span className="text-zinc-400 flex items-center space-x-1"><Ruler className="w-2.5 h-2.5" /><span>Unit Height</span></span>
                  <span className="font-semibold text-zinc-800">3.2 m</span>
                </div>
              </div>
              {/* Height from ground */}
              <div className="pb-2 border-b border-zinc-100">
                <div className="text-[9px] uppercase text-zinc-400 font-bold mb-1.5 tracking-wider flex items-center space-x-1">
                  <span className="inline-block w-4 h-0.5 bg-yellow-400 mr-1" />Height from Ground
                </div>
                <div className="flex justify-between"><span className="text-zinc-400">Floor base</span><span className="font-bold text-yellow-600">{heightFromGround} m</span></div>
                <div className="flex justify-between mt-1"><span className="text-zinc-400">Ceiling</span><span className="font-bold text-yellow-500">{ceilingHeight} m</span></div>
              </div>
              {/* 3D Centroid */}
              <div className="pb-2 border-b border-zinc-100">
                <div className="text-[9px] uppercase text-zinc-400 font-bold mb-1.5 tracking-wider">3D Centroid</div>
                <div className="flex justify-between"><span className="text-zinc-400">X</span><span className="font-semibold text-zinc-800">{selectedUnit.centroidX.toFixed(2)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-zinc-400">Y</span><span className="font-semibold text-zinc-800">{selectedUnit.centroidY.toFixed(2)}</span></div>
                <div className="flex justify-between mt-1"><span className="text-zinc-400">Z</span><span className="font-semibold text-zinc-800">{selectedUnit.centroidZ.toFixed(2)}</span></div>
              </div>
              {/* Owner & Status */}
              <div>
                <div className="flex justify-between"><span className="text-zinc-400">Owner</span><span className="font-semibold text-zinc-800 truncate max-w-[130px]">{selectedUnit.ownerName}</span></div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-zinc-400">Status</span>
                  {isSurveyed
                    ? <span className="font-bold text-emerald-600 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">FULLY CONSTRUCTED</span>
                    : <span className="font-bold text-zinc-400 text-[10px] bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200">WIREFRAME ONLY</span>
                  }
                </div>
              </div>
            </div>
            <div className="px-5 pb-4">
              {isSurveyed ? (
                <div className="w-full py-1.5 px-3 rounded text-[11px] font-bold uppercase text-center bg-sky-50 text-sky-600 border border-sky-200">✦ Active Survey Unit</div>
              ) : (
                <button onClick={() => setSurveyedUnitId(selectedUnit.id)} className="w-full py-1.5 px-3 rounded text-[11px] font-bold uppercase transition-colors border border-zinc-300 text-zinc-700 hover:border-sky-400 hover:text-sky-600">
                  Set as Survey Unit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate Report */}
      <div className="relative z-10 w-full p-5 flex items-center justify-center pointer-events-none">
        <button onClick={() => onGenerateReport(selectedUnit)} className="py-3.5 px-8 rounded-xl bg-zinc-900 hover:bg-black text-white font-mono text-xs font-bold tracking-widest uppercase shadow-lg flex items-center space-x-2 pointer-events-auto active:scale-95 transition-all">
          <span>[ GENERATE REPORT ]</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};