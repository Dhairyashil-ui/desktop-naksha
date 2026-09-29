import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface PropertyUnit3D {
  id: string;
  unitNumber: string;
  unitAlias?: string;
  unitName?: string;
  unitType?: string;
  floor: number;
  floorLabel?: string;
  areaSqM: number;
  volumeM3?: number;
  clearHeightM?: number;
  minZ?: number;
  maxZ?: number;
  x: number;
  y: number;
  z: number;
  twoDParcel: string;
  recordStatus: 'Matched' | 'Pending' | 'Discrepancy';
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  ownerName: string;
  ctsNumber: string;
  ulpin: string;
  undividedLandSharePct: number;
  structuredIdentity?: {
    base_ulpin: string;
    floor_id: string;
    unit_id: string;
    volume_id: string;
    property_id_3d: string;
    display_ulpin_3d: string;
  };
  footprint2D?: {
    polygon: [number, number][];
    perimeter_m: number;
    area_sqm: number;
    svg_path?: string;
  };
  geometry3D?: {
    is_watertight: boolean;
    volume_m3: number;
    vertex_count: number;
    face_count: number;
  };
  associatedParcel?: {
    parcel_id: string;
    ulpin: string;
    village: string;
    total_parcel_area_sqm: number;
    undivided_land_share_pct: number;
  };
  associatedGovernmentRecord?: {
    document_number: string;
    record_type: string;
    cts_number: string;
    owner_name: string;
    registered_carpet_area_sqm: number;
    registration_date: string;
    encumbrance: string;
    match_status: string;
  };
}

interface Property3DViewerProps {
  units: PropertyUnit3D[];
  selectedUnitId: string;
  onSelectUnit: (unit: PropertyUnit3D) => void;
  isolatedFloor: number | null; // null = all floors, 1-8 = isolate specific floor
  isExploded: boolean;
  autoRotate?: boolean;
}

export const Property3DViewer: React.FC<Property3DViewerProps> = ({
  units,
  selectedUnitId,
  onSelectUnit,
  isolatedFloor,
  isExploded,
  autoRotate = false
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Mesh and group references
  const unitMeshesMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const floorGroupsMap = useRef<Map<number, THREE.Group>>(new Map());
  const highlightBoxRef = useRef<THREE.BoxHelper | null>(null);
  const markerSpriteRef = useRef<THREE.Sprite | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene with Pure White Background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // 2. Camera Setup (Architectural axonometric perspective)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(22, 18, 26);
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
    controls.minDistance = 8;
    controls.maxDistance = 75;
    controls.target.set(0, 6, 0);
    controlsRef.current = controls;

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(20, 35, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xf1f5f9, 0.45);
    fillLight.position.set(-18, 14, -18);
    scene.add(fillLight);

    // 6. Ground Grid & Cadastral Boundary Line
    const gridHelper = new THREE.GridHelper(34, 34, 0xd4d4d8, 0xf4f4f5);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // 2D Parcel Boundary on Ground
    const parcelPts = [
      new THREE.Vector3(-6.5, 0.02, -7.5),
      new THREE.Vector3(6.5, 0.02, -7.5),
      new THREE.Vector3(6.5, 0.02, 7.5),
      new THREE.Vector3(-6.5, 0.02, 7.5),
      new THREE.Vector3(-6.5, 0.02, -7.5)
    ];
    const parcelGeo = new THREE.BufferGeometry().setFromPoints(parcelPts);
    const parcelMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 });
    const parcelLine = new THREE.Line(parcelGeo, parcelMat);
    scene.add(parcelLine);

    // Ground Shadow Receiver
    const groundGeo = new THREE.PlaneGeometry(38, 38);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.05 });
    const groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.01;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    // Building Envelope Wireframe Ghost
    const bldgBoxGeo = new THREE.BoxGeometry(8, 12, 10);
    const bldgEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(bldgBoxGeo),
      new THREE.LineBasicMaterial({ color: 0xd4d4d8, linewidth: 1 })
    );
    bldgEdges.position.y = 6;
    scene.add(bldgEdges);

    // Build Floors and Units Groups
    unitMeshesMap.current.clear();
    floorGroupsMap.current.clear();

    const floorCount = 8;
    const floorHeight = 12 / floorCount; // 1.5m
    const floorThickness = 0.16;

    const unitPalette = [
      0x38bdf8, 0x34d399, 0xfbbf24, 0xa78bfa,
      0xf472b6, 0x60a5fa, 0x4ade80, 0xf87171
    ];
    const uWidth = 8 / 2 - 0.12;  // 2 units along X
    const uLength = 10 / 4 - 0.12; // 4 units along Z
    const uHeight = floorHeight - 0.16;

    for (let f = 1; f <= floorCount; f++) {
      const floorGroup = new THREE.Group();
      floorGroup.name = `FLOOR_GROUP_${f}`;
      scene.add(floorGroup);
      floorGroupsMap.current.set(f, floorGroup);

      // Floor Slab
      const slabGeo = new THREE.BoxGeometry(8.1, floorThickness, 10.1);
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.45
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.y = (f - 1) * floorHeight;
      slabMesh.receiveShadow = true;
      floorGroup.add(slabMesh);

      const slabEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(slabGeo),
        new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 1.2 })
      );
      slabEdges.position.y = (f - 1) * floorHeight;
      floorGroup.add(slabEdges);

      // 8 Strata Units on this floor (2 x 4 layout)
      for (let ux = 0; ux < 2; ux++) {
        for (let uz = 0; uz < 4; uz++) {
          const unitIdx = (f - 1) * 8 + ux * 4 + uz;
          const unitNum = f * 100 + (ux * 4 + uz + 1);
          const unitData = units.find(u => u.unitNumber === `${unitNum}`) || {
            id: `UNIT-${unitNum}`,
            unitNumber: `${unitNum}`,
            floor: f,
            areaSqM: 84.50,
            x: 385430 + (ux - 0.5) * 4.0,
            y: 2048165 + (uz - 1.5) * 2.5,
            z: 542.15 + f * 1.5,
            twoDParcel: '142/B (MH-PUN-0942)',
            recordStatus: 'Matched' as const,
            status: 'VERIFIED' as const,
            ownerName: 'Owner-' + unitNum,
            ctsNumber: `CTS 142/B-${unitNum}`,
            ulpin: `MH-PUN-2026-0942-${unitNum}`,
            undividedLandSharePct: 1.5625
          };

          const color = unitPalette[unitIdx % unitPalette.length];

          // Authentic non-box architectural polygonal footprint (Step 27)
          const shape = new THREE.Shape();
          const halfW = uWidth / 2;
          const halfL = uLength / 2;
          const shapeIdx = (ux * 4 + uz) % 4;

          if (shapeIdx === 0) {
            // Flat A (L-shaped with balcony alcove)
            shape.moveTo(-halfW, -halfL);
            shape.lineTo(halfW, -halfL);
            shape.lineTo(halfW, halfL - 0.55);
            shape.lineTo(halfW - 0.45, halfL - 0.55);
            shape.lineTo(halfW - 0.45, halfL);
            shape.lineTo(-halfW, halfL);
            shape.closePath();
          } else if (shapeIdx === 1) {
            // Flat B (Foyer recess & corridor setback)
            shape.moveTo(-halfW, -halfL);
            shape.lineTo(-halfW + 0.45, -halfL);
            shape.lineTo(-halfW + 0.45, -halfL + 0.5);
            shape.lineTo(halfW, -halfL + 0.5);
            shape.lineTo(halfW, halfL);
            shape.lineTo(-halfW, halfL);
            shape.closePath();
          } else if (shapeIdx === 2) {
            // Flat C (Chamfered corner bay window facade)
            shape.moveTo(-halfW, -halfL);
            shape.lineTo(halfW - 0.6, -halfL);
            shape.lineTo(halfW, -halfL + 0.6);
            shape.lineTo(halfW, halfL);
            shape.lineTo(-halfW, halfL);
            shape.closePath();
          } else {
            // Flat D (Terrace indent suite)
            shape.moveTo(-halfW, -halfL);
            shape.lineTo(halfW, -halfL);
            shape.lineTo(halfW, halfL - 0.65);
            shape.lineTo(halfW - 0.55, halfL - 0.65);
            shape.lineTo(halfW - 0.55, halfL);
            shape.lineTo(-halfW, halfL);
            shape.closePath();
          }

          // Extrude into authentic 3D solid volume between floor and ceiling slab
          const uGeo = new THREE.ExtrudeGeometry(shape, {
            depth: uHeight,
            bevelEnabled: false
          });
          uGeo.rotateX(-Math.PI / 2);

          const uMat = new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.75,
            roughness: 0.25
          });
          const uMesh = new THREE.Mesh(uGeo, uMat);

          const posX = (ux - 0.5) * (uWidth + 0.12);
          const posZ = (uz - 1.5) * (uLength + 0.12);
          const posY = (f - 1) * floorHeight + 0.08;

          uMesh.position.set(posX, posY, posZ);
          uMesh.name = `UNIT_${unitNum}`;
          uMesh.userData = unitData;
          uMesh.castShadow = true;
          uMesh.receiveShadow = true;

          floorGroup.add(uMesh);
          unitMeshesMap.current.set(`${unitNum}`, uMesh);

          // Unit Boundary Lines
          const uEdge = new THREE.LineSegments(
            new THREE.EdgesGeometry(uGeo),
            new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1.2 })
          );
          uEdge.position.set(posX, posY, posZ);
          floorGroup.add(uEdge);
        }
      }
    }

    // Active Selection Highlight Helper
    const dummyObj = new THREE.Object3D();
    scene.add(dummyObj);
    const selBox = new THREE.BoxHelper(dummyObj, 0x2563eb);
    selBox.visible = false;
    scene.add(selBox);
    highlightBoxRef.current = selBox;

    // 3D Callout Billboard Marker
    const markerCanvas = document.createElement('canvas');
    markerCanvas.width = 256;
    markerCanvas.height = 128;
    const mCtx = markerCanvas.getContext('2d');
    if (mCtx) {
      mCtx.fillStyle = '#2563eb';
      mCtx.roundRect(8, 8, 240, 112, 16);
      mCtx.fill();
      mCtx.fillStyle = '#ffffff';
      mCtx.font = 'bold 32px "Courier New", monospace';
      mCtx.fillText('UNIT 302', 36, 56);
      mCtx.font = '22px sans-serif';
      mCtx.fillText('✓ VERIFIED', 36, 92);
    }
    const markerTex = new THREE.CanvasTexture(markerCanvas);
    const markerSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex, transparent: true }));
    markerSprite.scale.set(3.2, 1.6, 1);
    markerSprite.visible = false;
    scene.add(markerSprite);
    markerSpriteRef.current = markerSprite;

    // Raycaster for unit clicking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Collect all unit meshes across all floors
      const candidateMeshes: THREE.Mesh[] = [];
      unitMeshesMap.current.forEach(m => candidateMeshes.push(m));

      const intersects = raycaster.intersectObjects(candidateMeshes, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        if (hit.userData && hit.userData.unitNumber) {
          onSelectUnit(hit.userData as PropertyUnit3D);
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
        controlsRef.current.autoRotateSpeed = 0.8;
      } else if (controlsRef.current) {
        controlsRef.current.autoRotate = false;
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
  }, [units, onSelectUnit]);

  // Effect for Floor Isolation & Explosion
  useEffect(() => {
    const floorCount = 8;
    const explodeGap = isExploded ? 1.4 : 0; // vertical offset factor per floor

    for (let f = 1; f <= floorCount; f++) {
      const group = floorGroupsMap.current.get(f);
      if (!group) continue;

      // Handle Explosion Offset
      group.position.y = (f - 1) * explodeGap;

      // Handle Floor Isolation Opacity
      const isFloorActive = isolatedFloor === null || isolatedFloor === f;

      group.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (isFloorActive) {
            mat.opacity = 0.72;
            child.visible = true;
          } else {
            mat.opacity = 0.08;
            child.visible = true;
          }
        }
      });
    }
  }, [isolatedFloor, isExploded]);

  // Effect for Selected Unit Highlight & Callout
  useEffect(() => {
    if (!selectedUnitId) return;

    // Reset all unit mesh highlights
    unitMeshesMap.current.forEach((mesh, unitNum) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (unitNum === selectedUnitId) {
        mat.emissive.setHex(0x2563eb);
        mat.emissiveIntensity = 0.6;
        mat.opacity = 0.95;

        // Position 3D highlight outline box
        if (highlightBoxRef.current) {
          highlightBoxRef.current.setFromObject(mesh);
          highlightBoxRef.current.visible = true;
        }

        // Position Callout Marker Sprite
        if (markerSpriteRef.current) {
          const worldPos = new THREE.Vector3();
          mesh.getWorldPosition(worldPos);
          markerSpriteRef.current.position.set(worldPos.x, worldPos.y + 1.8, worldPos.z);
          markerSpriteRef.current.visible = true;
        }
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.opacity = isolatedFloor === null || mesh.userData.floor === isolatedFloor ? 0.72 : 0.08;
      }
    });
  }, [selectedUnitId, isolatedFloor]);

  return (
    <div className="w-full h-full relative overflow-hidden select-none">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
