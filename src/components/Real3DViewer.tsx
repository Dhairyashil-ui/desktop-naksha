import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ProcessingStageId } from '../types/naksha';

export interface CadastralUnitInfo {
  id: string;
  floor: number;
  unitNumber: string;
  owner: string;
  ctsNumber: string;
  ulpin: string;
  areaSqM: number;
  status: string;
}

interface Real3DViewerProps {
  currentStage: ProcessingStageId;
  autoRotate?: boolean;
  selectedUnitId?: string;
  onSelectUnit?: (unit: CadastralUnitInfo) => void;
}

export const Real3DViewer: React.FC<Real3DViewerProps> = ({
  currentStage,
  autoRotate = true,
  selectedUnitId = 'UNIT-402',
  onSelectUnit
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Group references for the 7 stages
  const stage1PhotoGroup = useRef<THREE.Group>(new THREE.Group());
  const stage2LidarGroup = useRef<THREE.Group>(new THREE.Group());
  const stage3FusionGroup = useRef<THREE.Group>(new THREE.Group());
  const stage4BuildingGroup = useRef<THREE.Group>(new THREE.Group());
  const stage5PropertyGroup = useRef<THREE.Group>(new THREE.Group());
  const stage6RecordGroup = useRef<THREE.Group>(new THREE.Group());
  const stage7ValidationGroup = useRef<THREE.Group>(new THREE.Group());

  // Interactive unit mesh map for raycasting & selection
  const unitMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const laserBeamRef = useRef<THREE.Mesh | null>(null);
  const sweepAngleRef = useRef<number>(0);
  const recordLinkLineRef = useRef<THREE.Line | null>(null);
  const recordCalloutSpriteRef = useRef<THREE.Sprite | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Pure White Background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // 2. Camera Setup (Architectural isometric view)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(24, 20, 28);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 10;
    controls.maxDistance = 85;
    controls.target.set(0, 5.5, 0);
    controlsRef.current = controls;

    // 5. Lighting (Crisp Soft Studio Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(22, 38, 22);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xf1f5f9, 0.45);
    fillLight.position.set(-20, 16, -20);
    scene.add(fillLight);

    // 6. Subtle Ground Grid & Datum
    const gridHelper = new THREE.GridHelper(36, 36, 0xd4d4d8, 0xf4f4f5);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Ground Shadow Receiver
    const groundGeo = new THREE.PlaneGeometry(42, 42);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.05 });
    const groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.01;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    // Add all 7 Stage Groups to Scene
    scene.add(stage1PhotoGroup.current);
    scene.add(stage2LidarGroup.current);
    scene.add(stage3FusionGroup.current);
    scene.add(stage4BuildingGroup.current);
    scene.add(stage5PropertyGroup.current);
    scene.add(stage6RecordGroup.current);
    scene.add(stage7ValidationGroup.current);

    // Clear unit meshes map
    unitMeshesRef.current.clear();

    // =========================================================================
    // STAGE 1: PHOTOGRAMMETRY (Images → Reconstruction → Point Cloud)
    // =========================================================================
    // Drone flight path spline
    const flightCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-14, 16, -12),
      new THREE.Vector3(-6, 17.5, 12),
      new THREE.Vector3(6, 17, -12),
      new THREE.Vector3(14, 18, 12)
    ]);
    const flightGeo = new THREE.BufferGeometry().setFromPoints(flightCurve.getPoints(60));
    const flightMat = new THREE.LineDashedMaterial({ color: 0x8b5cf6, dashSize: 0.6, gapSize: 0.3 });
    const flightLine = new THREE.Line(flightGeo, flightMat);
    flightLine.computeLineDistances();
    stage1PhotoGroup.current.add(flightLine);

    // Drone Camera Frustums along trajectory
    const camMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.3 });
    const rayMat = new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.35 });
    const samplePoints = flightCurve.getPoints(8);

    samplePoints.forEach((pt, idx) => {
      // Camera station cone
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), camMat);
      cone.position.copy(pt);
      cone.rotation.x = Math.PI; // pointing downwards
      stage1PhotoGroup.current.add(cone);

      // Camera projection rays to facade
      const targetPoint = new THREE.Vector3(
        (idx % 2 === 0 ? -3 : 3) + (Math.random() - 0.5) * 2,
        Math.random() * 10,
        (idx % 3 === 0 ? -4 : 4) + (Math.random() - 0.5) * 2
      );
      const rayGeo = new THREE.BufferGeometry().setFromPoints([pt, targetPoint]);
      const rayLine = new THREE.Line(rayGeo, rayMat);
      stage1PhotoGroup.current.add(rayLine);
    });

    // Photogrammetry RGB Dense Point Cloud
    const photoPointCount = 14000;
    const photoPos = new Float32Array(photoPointCount * 3);
    const photoCol = new Float32Array(photoPointCount * 3);

    for (let i = 0; i < photoPointCount; i++) {
      let x, y, z;
      const isBuilding = i < 10000;
      if (isBuilding) {
        const wall = Math.floor(Math.random() * 4);
        const h = Math.random() * 12;
        if (wall === 0) { x = -4; z = (Math.random() - 0.5) * 10; }
        else if (wall === 1) { x = 4; z = (Math.random() - 0.5) * 10; }
        else if (wall === 2) { z = -5; x = (Math.random() - 0.5) * 8; }
        else { z = 5; x = (Math.random() - 0.5) * 8; }

        x += (Math.random() - 0.5) * 0.18;
        z += (Math.random() - 0.5) * 0.18;
        y = h + (Math.random() - 0.5) * 0.12;

        // Realistic natural RGB tones (terracotta, sandstone, window azure)
        const isWindow = Math.random() > 0.65;
        if (isWindow) {
          photoCol[i * 3] = 0.35;
          photoCol[i * 3 + 1] = 0.55;
          photoCol[i * 3 + 2] = 0.75;
        } else {
          photoCol[i * 3] = 0.88;
          photoCol[i * 3 + 1] = 0.68;
          photoCol[i * 3 + 2] = 0.52;
        }
      } else {
        // Ground surrounding terrain points
        x = (Math.random() - 0.5) * 26;
        z = (Math.random() - 0.5) * 26;
        y = (Math.random() - 0.5) * 0.15;
        photoCol[i * 3] = 0.72;
        photoCol[i * 3 + 1] = 0.78;
        photoCol[i * 3 + 2] = 0.68;
      }
      photoPos[i * 3] = x;
      photoPos[i * 3 + 1] = y;
      photoPos[i * 3 + 2] = z;
    }
    const photoPtsGeo = new THREE.BufferGeometry();
    photoPtsGeo.setAttribute('position', new THREE.BufferAttribute(photoPos, 3));
    photoPtsGeo.setAttribute('color', new THREE.BufferAttribute(photoCol, 3));
    const photoPtsMat = new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, opacity: 0.88 });
    const photoCloud = new THREE.Points(photoPtsGeo, photoPtsMat);
    stage1PhotoGroup.current.add(photoCloud);

    // =========================================================================
    // STAGE 2: LiDAR (Scan → Clean → Register)
    // =========================================================================
    // Terrestrial/Mobile LiDAR Scanner Base Station at survey origin
    const scannerBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.45, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
    );
    scannerBase.position.set(-11, 0.6, -11);
    stage2LidarGroup.current.add(scannerBase);

    // Rotating Laser Sweep Fan Beam
    const sweepGeo = new THREE.ConeGeometry(18, 0.1, 32, 1, true, 0, Math.PI / 4);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide
    });
    const laserBeam = new THREE.Mesh(sweepGeo, sweepMat);
    laserBeam.position.set(-11, 1.2, -11);
    laserBeam.rotation.x = -Math.PI / 2;
    laserBeamRef.current = laserBeam;
    stage2LidarGroup.current.add(laserBeam);

    // LiDAR Clean Classified Point Cloud + Outliers (Noise)
    const lidarPointCount = 15000;
    const lidarPos = new Float32Array(lidarPointCount * 3);
    const lidarCol = new Float32Array(lidarPointCount * 3);

    for (let i = 0; i < lidarPointCount; i++) {
      let x, y, z;
      const isNoise = i < 400; // Statistical Outliers to be filtered
      const isBuilding = i >= 400 && i < 11000;

      if (isNoise) {
        // Red noise points hovering in sky/dust
        x = (Math.random() - 0.5) * 14;
        z = (Math.random() - 0.5) * 14;
        y = 13 + Math.random() * 6;
        lidarCol[i * 3] = 0.94; // Bright Red SOR Outlier
        lidarCol[i * 3 + 1] = 0.22;
        lidarCol[i * 3 + 2] = 0.22;
      } else if (isBuilding) {
        const wall = Math.floor(Math.random() * 4);
        const h = Math.random() * 12;
        if (wall === 0) { x = -4; z = (Math.random() - 0.5) * 10; }
        else if (wall === 1) { x = 4; z = (Math.random() - 0.5) * 10; }
        else if (wall === 2) { z = -5; x = (Math.random() - 0.5) * 8; }
        else { z = 5; x = (Math.random() - 0.5) * 8; }

        y = h;
        // Electric Cyan LiDAR Elevation/Intensity Return
        const normY = y / 12;
        lidarCol[i * 3] = 0.05 + normY * 0.15;
        lidarCol[i * 3 + 1] = 0.65 + normY * 0.35;
        lidarCol[i * 3 + 2] = 0.95;
      } else {
        // Ground Classified (Brown / Dark Slate)
        x = (Math.random() - 0.5) * 26;
        z = (Math.random() - 0.5) * 26;
        y = (Math.random() - 0.5) * 0.08;
        lidarCol[i * 3] = 0.35;
        lidarCol[i * 3 + 1] = 0.45;
        lidarCol[i * 3 + 2] = 0.55;
      }

      lidarPos[i * 3] = x;
      lidarPos[i * 3 + 1] = y;
      lidarPos[i * 3 + 2] = z;
    }
    const lidarPtsGeo = new THREE.BufferGeometry();
    lidarPtsGeo.setAttribute('position', new THREE.BufferAttribute(lidarPos, 3));
    lidarPtsGeo.setAttribute('color', new THREE.BufferAttribute(lidarCol, 3));
    const lidarPtsMat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.88 });
    const lidarCloud = new THREE.Points(lidarPtsGeo, lidarPtsMat);
    stage2LidarGroup.current.add(lidarCloud);

    // =========================================================================
    // STAGE 3: FUSION (LiDAR + Photogrammetry: Two datasets become one)
    // =========================================================================
    // Co-Registration Grid Box
    const regBoxGeo = new THREE.BoxGeometry(9.2, 13.2, 11.2);
    const regBoxEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(regBoxGeo),
      new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.55 })
    );
    regBoxEdges.position.y = 6;
    stage3FusionGroup.current.add(regBoxEdges);

    // Concentric Fusion Alignment Ring on Ground
    const ringGeo = new THREE.RingGeometry(8, 8.2, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2563eb, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    stage3FusionGroup.current.add(ringMesh);

    // Fused Dense Master Point Cloud (16,000 merged points)
    const fusedCount = 16000;
    const fusedPos = new Float32Array(fusedCount * 3);
    const fusedCol = new Float32Array(fusedCount * 3);

    for (let i = 0; i < fusedCount; i++) {
      let x, y, z;
      const isBuilding = i < 12000;
      if (isBuilding) {
        const wall = Math.floor(Math.random() * 4);
        const h = Math.random() * 12;
        if (wall === 0) { x = -4; z = (Math.random() - 0.5) * 10; }
        else if (wall === 1) { x = 4; z = (Math.random() - 0.5) * 10; }
        else if (wall === 2) { z = -5; x = (Math.random() - 0.5) * 8; }
        else { z = 5; x = (Math.random() - 0.5) * 8; }

        x += (Math.random() - 0.5) * 0.1;
        z += (Math.random() - 0.5) * 0.1;
        y = h + (Math.random() - 0.5) * 0.08;

        // Smooth harmonious fusion palette: Deep Indigo to Cyan
        const normY = y / 12;
        fusedCol[i * 3] = 0.15 + normY * 0.4;
        fusedCol[i * 3 + 1] = 0.45 + normY * 0.45;
        fusedCol[i * 3 + 2] = 0.92;
      } else {
        x = (Math.random() - 0.5) * 26;
        z = (Math.random() - 0.5) * 26;
        y = (Math.random() - 0.5) * 0.1;
        fusedCol[i * 3] = 0.8;
        fusedCol[i * 3 + 1] = 0.82;
        fusedCol[i * 3 + 2] = 0.86;
      }
      fusedPos[i * 3] = x;
      fusedPos[i * 3 + 1] = y;
      fusedPos[i * 3 + 2] = z;
    }
    const fusedPtsGeo = new THREE.BufferGeometry();
    fusedPtsGeo.setAttribute('position', new THREE.BufferAttribute(fusedPos, 3));
    fusedPtsGeo.setAttribute('color', new THREE.BufferAttribute(fusedCol, 3));
    const fusedPtsMat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.9 });
    const fusedCloud = new THREE.Points(fusedPtsGeo, fusedPtsMat);
    stage3FusionGroup.current.add(fusedCloud);

    // =========================================================================
    // STAGE 4: BUILDING (Point Cloud → 3D Model)
    // =========================================================================
    // LoD-2 Solid Massing Box Shell (8m x 10m footprint, 12m height)
    const bldgGeo = new THREE.BoxGeometry(8, 12, 10);
    const bldgMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.4,
      roughness: 0.15,
      metalness: 0.05
    });
    const bldgMesh = new THREE.Mesh(bldgGeo, bldgMat);
    bldgMesh.position.y = 6;
    bldgMesh.castShadow = true;
    stage4BuildingGroup.current.add(bldgMesh);

    // Crisp Architectural Wireframe Edges
    const bldgEdgesGeo = new THREE.EdgesGeometry(bldgGeo);
    const bldgEdgesMat = new THREE.LineBasicMaterial({ color: 0x09090b, linewidth: 1.5 });
    const bldgEdges = new THREE.LineSegments(bldgEdgesGeo, bldgEdgesMat);
    bldgEdges.position.y = 6;
    stage4BuildingGroup.current.add(bldgEdges);

    // Retain a subtle ghosted point cloud background in Stage 4 to show derivation
    const ghostPtsMat = new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.35 });
    const ghostCloud = new THREE.Points(fusedPtsGeo, ghostPtsMat);
    stage4BuildingGroup.current.add(ghostCloud);

    // =========================================================================
    // STAGE 5: PROPERTY (Building → Floors → Units)
    // =========================================================================
    const floorCount = 8;
    const floorHeight = 12 / floorCount; // 1.5m
    const floorThickness = 0.16;

    // 8 Slabs
    for (let f = 0; f < floorCount; f++) {
      const slabGeo = new THREE.BoxGeometry(8.1, floorThickness, 10.1);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.y = f * floorHeight;
      stage5PropertyGroup.current.add(slabMesh);

      const slabEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(slabGeo),
        new THREE.LineBasicMaterial({ color: 0x64748b })
      );
      slabEdges.position.y = f * floorHeight;
      stage5PropertyGroup.current.add(slabEdges);
    }

    // 64 Cadastral Strata Units (8 floors × 8 units per floor = 64 Units)
    const unitPalette = [
      0x38bdf8, 0x34d399, 0xfbbf24, 0xa78bfa,
      0xf472b6, 0x60a5fa, 0x4ade80, 0xf87171
    ];
    const uWidth = 8 / 2 - 0.12;  // 2 units along X
    const uLength = 10 / 4 - 0.12; // 4 units along Z
    const uHeight = floorHeight - 0.16;

    for (let f = 0; f < floorCount; f++) {
      for (let ux = 0; ux < 2; ux++) {
        for (let uz = 0; uz < 4; uz++) {
          const unitIdx = f * 8 + ux * 4 + uz;
          const unitNum = (f + 1) * 100 + (ux * 4 + uz + 1);
          const unitId = `UNIT-${unitNum}`;
          const color = unitPalette[unitIdx % unitPalette.length];

          const uGeo = new THREE.BoxGeometry(uWidth, uHeight, uLength);
          const uMat = new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.68,
            roughness: 0.25
          });
          const uMesh = new THREE.Mesh(uGeo, uMat);

          const posX = (ux - 0.5) * (uWidth + 0.12);
          const posZ = (uz - 1.5) * (uLength + 0.12);
          const posY = f * floorHeight + uHeight / 2 + 0.08;

          uMesh.position.set(posX, posY, posZ);
          uMesh.name = unitId;
          uMesh.userData = {
            id: unitId,
            floor: f + 1,
            unitNumber: `${unitNum}`,
            owner: f === 3 && ux === 0 && uz === 1 ? 'Rajesh M. Patil' : `Owner-${unitNum}`,
            ctsNumber: `CTS 142/B-${unitNum}`,
            ulpin: `MH-PUN-2026-0942-${unitNum}`,
            areaSqM: 84.5,
            status: 'VERIFIED'
          };

          stage5PropertyGroup.current.add(uMesh);
          unitMeshesRef.current.set(unitId, uMesh);

          const uEdge = new THREE.LineSegments(
            new THREE.EdgesGeometry(uGeo),
            new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1.2 })
          );
          uEdge.position.set(posX, posY, posZ);
          stage5PropertyGroup.current.add(uEdge);
        }
      }
    }

    // =========================================================================
    // STAGE 6: RECORD MATCHING (3D Unit ↔ Government Record)
    // =========================================================================
    // Re-use stage 5 property units inside Stage 6 with leader connection lines
    // Target highlighted unit: Unit 402 (Floor 4, Unit 2)
    const targetUnitPos = new THREE.Vector3(-1.94, 5.25, -1.2);
    const calloutPos = new THREE.Vector3(-4.5, 9.5, -4.5);

    // Glowing connection line between 3D unit and Government Record badge
    const linkCurve = new THREE.CatmullRomCurve3([
      targetUnitPos,
      new THREE.Vector3(-3.2, 7.5, -2.8),
      calloutPos
    ]);
    const linkGeo = new THREE.BufferGeometry().setFromPoints(linkCurve.getPoints(30));
    const linkMat = new THREE.LineDashedMaterial({
      color: 0x2563eb,
      dashSize: 0.4,
      gapSize: 0.2
    });
    const linkLine = new THREE.Line(linkGeo, linkMat);
    linkLine.computeLineDistances();
    recordLinkLineRef.current = linkLine;
    stage6RecordGroup.current.add(linkLine);

    // Marker sphere at the connected unit
    const beaconGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 0.6
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.copy(targetUnitPos);
    stage6RecordGroup.current.add(beaconMesh);

    // Floating Canvas Sprite for Government Record Match in 3D
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.roundRect(8, 8, 496, 240, 20);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#2563eb';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.fillText('3D UNIT ↔ 7/12 RoR RECORD', 30, 48);

      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('UNIT 402 • MATCHED ✓', 30, 95);

      ctx.fillStyle = '#475569';
      ctx.font = '22px "Courier New", monospace';
      ctx.fillText('Owner: Rajesh M. Patil', 30, 138);
      ctx.fillText('CTS 142/B-402 | ULPIN MH-PUN-0942', 30, 172);
      ctx.fillText('Carpet Area: 84.50 sq.m (Verified)', 30, 206);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(calloutPos);
    sprite.scale.set(7.5, 3.75, 1);
    recordCalloutSpriteRef.current = sprite;
    stage6RecordGroup.current.add(sprite);

    // =========================================================================
    // STAGE 7: VALIDATION (✓ Boundary, ✓ Coordinates, ✓ Topology, ✓ Record)
    // =========================================================================
    // 1. Cadastral Boundary: Glowing Emerald Polygon around parcel perimeter
    const boundaryPts = [
      new THREE.Vector3(-7, 0.05, -8),
      new THREE.Vector3(7, 0.05, -8),
      new THREE.Vector3(7, 0.05, 8),
      new THREE.Vector3(-7, 0.05, 8),
      new THREE.Vector3(-7, 0.05, -8)
    ];
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPts);
    const boundaryMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
    const boundaryLine = new THREE.Line(boundaryGeo, boundaryMat);
    stage7ValidationGroup.current.add(boundaryLine);

    // Boundary corner beacon pillars
    const cornerMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.2,
      emissive: 0x059669,
      emissiveIntensity: 0.4
    });
    [[-7, -8], [7, -8], [7, 8], [-7, 8]].forEach(([cx, cz]) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.2, 8), cornerMat);
      pillar.position.set(cx, 0.6, cz);
      stage7ValidationGroup.current.add(pillar);
    });

    // 2. Geodetic Coordinate Triad (EPSG:32643) at survey datum
    const axes = new THREE.AxesHelper(4);
    axes.position.set(-10, 0.05, -10);
    stage7ValidationGroup.current.add(axes);

    // 3. Topology Watertight Audit Mesh Wireframe (Emerald pulse)
    const topoGeo = new THREE.BoxGeometry(8.15, 12.15, 10.15);
    const topoEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(topoGeo),
      new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
    );
    topoEdges.position.y = 6;
    stage7ValidationGroup.current.add(topoEdges);

    // 4. Verification Seal Billboard
    const sealCanvas = document.createElement('canvas');
    sealCanvas.width = 512;
    sealCanvas.height = 256;
    const sCtx = sealCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      sCtx.roundRect(8, 8, 496, 240, 20);
      sCtx.fill();
      sCtx.lineWidth = 4;
      sCtx.strokeStyle = '#10b981';
      sCtx.stroke();

      sCtx.fillStyle = '#065f46';
      sCtx.font = 'bold 26px "Courier New", monospace';
      sCtx.fillText('CADASTRAL AUDIT CERTIFIED', 30, 48);

      sCtx.fillStyle = '#10b981';
      sCtx.font = 'bold 28px sans-serif';
      sCtx.fillText('✓ 4/4 CHECKS PASSED', 30, 95);

      sCtx.fillStyle = '#0f172a';
      sCtx.font = '20px "Courier New", monospace';
      sCtx.fillText('✓ Boundary     : Confirmed ±0.01m', 30, 138);
      sCtx.fillText('✓ Coordinates  : EPSG:32643 Valid', 30, 168);
      sCtx.fillText('✓ Topology     : 0 Gaps / 0 Overlaps', 30, 198);
      sCtx.fillText('✓ Record       : 100% 7/12 Title Match', 30, 228);
    }
    const sealTex = new THREE.CanvasTexture(sealCanvas);
    const sealSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sealTex, transparent: true }));
    sealSprite.position.set(0, 14.5, 0);
    sealSprite.scale.set(7.5, 3.75, 1);
    stage7ValidationGroup.current.add(sealSprite);

    // Raycasting for interactive unit selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(stage5PropertyGroup.current.children, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        if (hit.userData && hit.userData.id && onSelectUnit) {
          onSelectUnit(hit.userData as CadastralUnitInfo);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (autoRotate && controlsRef.current) {
        controlsRef.current.autoRotate = true;
        controlsRef.current.autoRotateSpeed = 0.75;
      } else if (controlsRef.current) {
        controlsRef.current.autoRotate = false;
      }

      // Rotate LiDAR scanner beam in Stage 2
      if (laserBeamRef.current) {
        sweepAngleRef.current += 0.035;
        laserBeamRef.current.rotation.z = Math.sin(sweepAngleRef.current) * 0.45;
      }

      controlsRef.current?.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.dispose();
      container.replaceChildren();
    };
  }, [onSelectUnit]);

  // Update visibility according to current 7 stages
  useEffect(() => {
    // 1. PHOTOGRAMMETRY: Images, flight path, RGB point cloud appearing
    stage1PhotoGroup.current.visible = currentStage === 'STAGE_1_PHOTOGRAMMETRY';

    // 2. LiDAR: Scanner sweep, classified LiDAR point cloud & outlier filtering
    stage2LidarGroup.current.visible = currentStage === 'STAGE_2_LIDAR';

    // 3. FUSION: Co-registration bounding box, LiDAR + Photo master point cloud
    stage3FusionGroup.current.visible = currentStage === 'STAGE_3_FUSION';

    // 4. BUILDING: Point cloud downsampled + solid LoD-2 architectural shell
    stage4BuildingGroup.current.visible = currentStage === 'STAGE_4_BUILDING';

    // 5. PROPERTY: Floor slabs + 64 colored strata units
    stage5PropertyGroup.current.visible = 
      currentStage === 'STAGE_5_PROPERTY' || 
      currentStage === 'STAGE_6_RECORD_MATCHING' || 
      currentStage === 'STAGE_7_VALIDATION';

    // 6. RECORD MATCHING: Connection line to 7/12 RoR government record
    stage6RecordGroup.current.visible = currentStage === 'STAGE_6_RECORD_MATCHING';

    // 7. VALIDATION: Cadastral boundary, geodetic coordinates, topology audit, 4/4 certified
    stage7ValidationGroup.current.visible = currentStage === 'STAGE_7_VALIDATION';
  }, [currentStage]);

  // Highlight selected 3D unit reactively
  useEffect(() => {
    if (!selectedUnitId) return;
    unitMeshesRef.current.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (id === selectedUnitId) {
        mat.emissive.setHex(0x2563eb);
        mat.emissiveIntensity = 0.55;
        mat.opacity = 0.95;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.opacity = 0.68;
      }
    });
  }, [selectedUnitId]);


  return (
    <div className="w-full h-full relative overflow-hidden select-none">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
