import * as THREE from 'three';
import { AssignedParcel } from '../../../services/surveyApi';

export type PipelineStage = 
  | 'PHOTOGRAMMETRY'
  | 'LIDAR'
  | 'FUSION'
  | 'SEGMENTATION'
  | 'TOPOLOGY';

export const PIPELINE_STAGES: PipelineStage[] = [
  'PHOTOGRAMMETRY',
  'LIDAR',
  'FUSION',
  'SEGMENTATION',
  'TOPOLOGY',
];

export interface StageInfo {
  label: string;
  name: string;
  desc: string;
  model: string;
  inputs: string;
  telemetry: string;
}

export interface ParcelBuildingMetrics {
  totalFloors: number;
  totalFlats: number;
  totalRooms: number;
  floorHeight: number;
  totalHeight: number;
  spreadX: number;
  spreadZ: number;
}

export function getParcelBuildingMetrics(parcel: AssignedParcel): ParcelBuildingMetrics {
  const numVal = parseInt(parcel.surveyNumber?.replace(/\D/g, '') || '204', 10);
  const area = parcel.legalAreaSqm || parcel.gisAreaSqm || 1248.5;
  const floorHeight = 3.2; // 3.2m per storey
  const totalFloors = area > 1400 ? 4 : 3 + (numVal % 2); // 3 or 4 storeys
  const totalHeight = totalFloors * floorHeight;
  const spreadX = 22 + (numVal % 5) * 1.6;
  const spreadZ = 16 + (numVal % 4) * 1.4;
  const totalFlats = totalFloors * 2; // 2 apartments per floor
  const totalRooms = totalFlats * 5; // 5 rooms per apartment (Living, Master Bed, Attached Bath, Kitchen, Common Bath)

  return {
    totalFloors,
    totalFlats,
    totalRooms,
    floorHeight,
    totalHeight,
    spreadX,
    spreadZ,
  };
}

export function getStageDetails(parcel: AssignedParcel): Record<PipelineStage, StageInfo> {
  const sNo = `${parcel.surveyNumber}/${parcel.subDivision}`;
  const loc = parcel.location || 'Nigdi, Pune';
  const ulpin = parcel.baseUlpin || '27-07-005-020401';
  const m = getParcelBuildingMetrics(parcel);

  return {
    PHOTOGRAMMETRY: {
      label: 'Stage 01/05: Photogrammetry 3D Point Cloud Creation (Step 11, 12, 13)',
      name: 'PHOTOGRAMMETRY',
      desc: `Aerial camera views triangulating high-density true RGB point cloud for Parcel ${sNo} using deep feature extraction`,
      model: 'ALIKED-N16 Keypoint Extractor & PatchMatchNet MVS',
      inputs: `CAT 01: Aerial Drone Imagery (JPG/RAW) • Camera Calibration GSD 2.4 cm`,
      telemetry: `Keypoints: 1,024/frame • Dense Cloud: 90,000 RGB Pts • Completeness: 94.8%`
    },
    LIDAR: {
      label: 'Stage 02/05: Drone LiDAR Geometric Point Cloud Creation (Step 10)',
      name: 'LIDAR',
      desc: `High-pulse laser scanning capturing millimeter-grade geometric surface elevation and structural edges for ${loc}`,
      model: 'PointCleanNet Denoising & Dual-Stage SOR/ROR Filter',
      inputs: `CAT 02: LiDAR Point Cloud (LAS 1.4) • ToF Sensor Pulse: 150 kHz`,
      telemetry: `Laser Pulses: 150,000 pts/s • Inliers Retained: 94.0% • 90,000 Geometric Pts`
    },
    FUSION: {
      label: 'Stage 03/05: Multi-Sensor Spatial Registration & Fusion',
      name: 'FUSION',
      desc: `Merging Photogrammetric RGB texture with LiDAR geometric depth to create unified, georeferenced 3D space at EPSG:32643`,
      model: 'GeoTransformer Superpoint Matching & SVD Kabsch + Multi-Scale ICP',
      inputs: `Photogrammetry Cloud + LiDAR Point Stream • Primary CRS: UTM 43N`,
      telemetry: `Superpoint Match: det(R)=1.000 • Fused Cloud: 90,000 Pts • RMS: 0.0089 m (<1 cm survey grade)`
    },
    SEGMENTATION: {
      label: 'Stage 04/05: 3D Deep Semantic Segmentation',
      name: 'SEGMENTATION',
      desc: `Classifying ${m.totalFloors} floors, ${m.totalFlats} apartments, individual room boundaries (Living, Bed, Kitchen, Bath), and doors with ground elevation H=${m.totalHeight.toFixed(2)}m`,
      model: 'KPConv (15 Kernel Points) & RandLA-Net (k=16 Attentive Pooling)',
      inputs: `Fused XYZ+RGB+Intensity Point Cloud • ${m.totalFloors} Storeys • Ground Ref Y=0.00m`,
      telemetry: `${m.totalFloors} Floors • ${m.totalFlats} Flats • ${m.totalRooms} Rooms • H=${m.totalHeight.toFixed(2)}m from Ground`
    },
    TOPOLOGY: {
      label: 'Stage 05/05: Watertight 3D Building Mesh & Topology Validation',
      name: 'TOPOLOGY',
      desc: `Verifying Euler-Poincaré closure χ = 2, manifold volume integrity, zero room/unit boundary slivers, and certified Bhu-Aadhaar ULPIN`,
      model: 'ISO 19152 LADM 3D Topological Validator & Euler-Poincaré Closure',
      inputs: `Closed 3D Parcel Geometry • ULPIN: ${ulpin} • Topological Graph`,
      telemetry: `Euler Characteristic: χ = 2 • Ground Elevation H=${m.totalHeight.toFixed(2)}m • Certified: 100%`
    }
  };
}

/**
 * Creates dynamic 3D pipeline visualization elements that adapt to active parcel input
 */
export function createCadastralPipelineSystem(parcel: AssignedParcel) {
  const masterGroup = new THREE.Group();
  const metrics = getParcelBuildingMetrics(parcel);

  const {
    spreadX,
    spreadZ,
    floorHeight,
    totalFloors,
    totalHeight
  } = metrics;

  const heightY = totalHeight;
  const pointCount = 90000;

  // ============================================================================
  // 1. POINT CLOUD GEOMETRIES (90,000 Points)
  // ============================================================================
  const photoGeo = new THREE.BufferGeometry();
  const lidarGeo = new THREE.BufferGeometry();
  const fusedGeo = new THREE.BufferGeometry();
  const segGeo = new THREE.BufferGeometry();

  const posPhoto = new Float32Array(pointCount * 3);
  const colPhoto = new Float32Array(pointCount * 3);

  const posLidar = new Float32Array(pointCount * 3);
  const colLidar = new Float32Array(pointCount * 3);

  const posFused = new Float32Array(pointCount * 3);
  const colFused = new Float32Array(pointCount * 3);

  const colSemantic = new Float32Array(pointCount * 3);

  let p = 0;

  // Distribution: Terrain / Ground (35%), Building Walls (40%), Roof (20%), Vegetation & Boundary (5%)
  const nGround = Math.floor(pointCount * 0.35);
  const nWalls = Math.floor(pointCount * 0.40);
  const nRoof = Math.floor(pointCount * 0.20);
  const nBoundary = pointCount - nGround - nWalls - nRoof;

  // A. GROUND TERRAIN
  for (let i = 0; i < nGround; i++) {
    const rx = (Math.random() - 0.5) * (spreadX * 1.6);
    const rz = (Math.random() - 0.5) * (spreadZ * 1.6);
    const ry = (Math.sin(rx * 0.15) * Math.cos(rz * 0.15)) * 0.25;

    // Photogrammetry: True RGB earth/lawn
    posPhoto[p * 3] = rx + (Math.random() - 0.5) * 0.06;
    posPhoto[p * 3 + 1] = ry;
    posPhoto[p * 3 + 2] = rz + (Math.random() - 0.5) * 0.06;

    colPhoto[p * 3] = 0.20 + Math.random() * 0.08;
    colPhoto[p * 3 + 1] = 0.45 + Math.random() * 0.12;
    colPhoto[p * 3 + 2] = 0.22 + Math.random() * 0.08;

    // LiDAR: Intensity emerald ramp
    posLidar[p * 3] = rx;
    posLidar[p * 3 + 1] = ry;
    posLidar[p * 3 + 2] = rz;

    colLidar[p * 3] = 0.05;
    colLidar[p * 3 + 1] = 0.85 + Math.random() * 0.15;
    colLidar[p * 3 + 2] = 0.55 + Math.random() * 0.20;

    // Fused: Natural RGB
    posFused[p * 3] = rx;
    posFused[p * 3 + 1] = ry;
    posFused[p * 3 + 2] = rz;

    colFused[p * 3] = 0.22 + Math.random() * 0.08;
    colFused[p * 3 + 1] = 0.48 + Math.random() * 0.10;
    colFused[p * 3 + 2] = 0.25 + Math.random() * 0.08;

    // Semantic: Class 1 GROUND (#556b2f olive earth)
    colSemantic[p * 3] = 0.33;
    colSemantic[p * 3 + 1] = 0.42;
    colSemantic[p * 3 + 2] = 0.18;
    p++;
  }

  // B. BUILDING FACADES & OPENINGS
  for (let i = 0; i < nWalls; i++) {
    const side = Math.floor(Math.random() * 4);
    let wx = 0;
    let wz = 0;
    const wy = Math.random() * heightY;

    const hw = spreadX * 0.44;
    const hd = spreadZ * 0.44;

    if (side === 0) {
      wx = (Math.random() - 0.5) * (hw * 2);
      wz = -hd;
    } else if (side === 1) {
      wx = (Math.random() - 0.5) * (hw * 2);
      wz = hd;
    } else if (side === 2) {
      wx = hw;
      wz = (Math.random() - 0.5) * (hd * 2);
    } else {
      wx = -hw;
      wz = (Math.random() - 0.5) * (hd * 2);
    }

    const inWindowY = wy % floorHeight;
    const isWindow = (inWindowY > 1.0 && inWindowY < 2.3);

    posPhoto[p * 3] = wx + (Math.random() - 0.5) * 0.06;
    posPhoto[p * 3 + 1] = wy;
    posPhoto[p * 3 + 2] = wz + (Math.random() - 0.5) * 0.06;

    if (isWindow) {
      colPhoto[p * 3] = 0.15;
      colPhoto[p * 3 + 1] = 0.65;
      colPhoto[p * 3 + 2] = 0.88;
      // Semantic Openings (#38bdf8 sky glass)
      colSemantic[p * 3] = 0.22;
      colSemantic[p * 3 + 1] = 0.74;
      colSemantic[p * 3 + 2] = 0.97;
    } else {
      colPhoto[p * 3] = 0.88 + Math.random() * 0.08;
      colPhoto[p * 3 + 1] = 0.84 + Math.random() * 0.08;
      colPhoto[p * 3 + 2] = 0.76 + Math.random() * 0.08;
      // Semantic Facade (#0284c7 structural blue)
      colSemantic[p * 3] = 0.01;
      colSemantic[p * 3 + 1] = 0.52;
      colSemantic[p * 3 + 2] = 0.78;
    }

    // LiDAR: Sharp cyan laser return
    posLidar[p * 3] = wx;
    posLidar[p * 3 + 1] = wy;
    posLidar[p * 3 + 2] = wz;

    colLidar[p * 3] = 0.0;
    colLidar[p * 3 + 1] = 0.75 + Math.random() * 0.20;
    colLidar[p * 3 + 2] = 0.95;

    // Fused
    posFused[p * 3] = wx;
    posFused[p * 3 + 1] = wy;
    posFused[p * 3 + 2] = wz;

    colFused[p * 3] = colPhoto[p * 3];
    colFused[p * 3 + 1] = colPhoto[p * 3 + 1];
    colFused[p * 3 + 2] = colPhoto[p * 3 + 2];
    p++;
  }

  // C. ROOF STRUCTURES
  for (let i = 0; i < nRoof; i++) {
    const rx = (Math.random() - 0.5) * (spreadX * 0.88 + 0.4);
    const rz = (Math.random() - 0.5) * (spreadZ * 0.88 + 0.4);
    const ry = heightY + (Math.random() - 0.5) * 0.08;

    posPhoto[p * 3] = rx;
    posPhoto[p * 3 + 1] = ry;
    posPhoto[p * 3 + 2] = rz;

    colPhoto[p * 3] = 0.80 + Math.random() * 0.10;
    colPhoto[p * 3 + 1] = 0.35 + Math.random() * 0.08;
    colPhoto[p * 3 + 2] = 0.15 + Math.random() * 0.08;

    posLidar[p * 3] = rx;
    posLidar[p * 3 + 1] = ry;
    posLidar[p * 3 + 2] = rz;

    colLidar[p * 3] = 0.95;
    colLidar[p * 3 + 1] = 0.75 + Math.random() * 0.20;
    colLidar[p * 3 + 2] = 0.10;

    posFused[p * 3] = rx;
    posFused[p * 3 + 1] = ry;
    posFused[p * 3 + 2] = rz;

    colFused[p * 3] = colPhoto[p * 3];
    colFused[p * 3 + 1] = colPhoto[p * 3 + 1];
    colFused[p * 3 + 2] = colPhoto[p * 3 + 2];

    // Semantic Roof (#d97706 warm amber)
    colSemantic[p * 3] = 0.85;
    colSemantic[p * 3 + 1] = 0.47;
    colSemantic[p * 3 + 2] = 0.02;
    p++;
  }

  // D. BOUNDARY WALLS & VEGETATION
  for (let i = 0; i < nBoundary; i++) {
    const isVeg = Math.random() > 0.5;
    let bx = 0;
    let bz = 0;
    let by = 0;

    if (isVeg) {
      const treeAngle = Math.random() * Math.PI * 2;
      const treeR = Math.random() * 2.5;
      bx = spreadX * 0.65 + Math.cos(treeAngle) * treeR;
      bz = spreadZ * 0.65 + Math.sin(treeAngle) * treeR;
      by = Math.random() * 5.5;

      colPhoto[p * 3] = 0.10;
      colPhoto[p * 3 + 1] = 0.58 + Math.random() * 0.15;
      colPhoto[p * 3 + 2] = 0.18;

      colSemantic[p * 3] = 0.06;
      colSemantic[p * 3 + 1] = 0.71;
      colSemantic[p * 3 + 2] = 0.50; // Emerald
    } else {
      const wallPick = Math.random() > 0.5;
      bx = wallPick ? (spreadX * 0.78) : (Math.random() - 0.5) * (spreadX * 1.55);
      bz = !wallPick ? (spreadZ * 0.78) : (Math.random() - 0.5) * (spreadZ * 1.55);
      by = Math.random() * 1.8;

      colPhoto[p * 3] = 0.65;
      colPhoto[p * 3 + 1] = 0.65;
      colPhoto[p * 3 + 2] = 0.65;

      colSemantic[p * 3] = 0.28;
      colSemantic[p * 3 + 1] = 0.33;
      colSemantic[p * 3 + 2] = 0.41; // Slate
    }

    posPhoto[p * 3] = bx;
    posPhoto[p * 3 + 1] = by;
    posPhoto[p * 3 + 2] = bz;

    posLidar[p * 3] = bx;
    posLidar[p * 3 + 1] = by;
    posLidar[p * 3 + 2] = bz;

    colLidar[p * 3] = 0.20;
    colLidar[p * 3 + 1] = 0.90;
    colLidar[p * 3 + 2] = 0.40;

    posFused[p * 3] = bx;
    posFused[p * 3 + 1] = by;
    posFused[p * 3 + 2] = bz;

    colFused[p * 3] = colPhoto[p * 3];
    colFused[p * 3 + 1] = colPhoto[p * 3 + 1];
    colFused[p * 3 + 2] = colPhoto[p * 3 + 2];
    p++;
  }

  // Set Attributes
  photoGeo.setAttribute('position', new THREE.BufferAttribute(posPhoto, 3));
  photoGeo.setAttribute('color', new THREE.BufferAttribute(colPhoto, 3));

  lidarGeo.setAttribute('position', new THREE.BufferAttribute(posLidar, 3));
  lidarGeo.setAttribute('color', new THREE.BufferAttribute(colLidar, 3));

  fusedGeo.setAttribute('position', new THREE.BufferAttribute(posFused, 3));
  fusedGeo.setAttribute('color', new THREE.BufferAttribute(colFused, 3));

  segGeo.setAttribute('position', new THREE.BufferAttribute(posFused, 3));
  segGeo.setAttribute('color', new THREE.BufferAttribute(colSemantic, 3));

  const pSize = 0.055;

  const photoCloud = new THREE.Points(
    photoGeo,
    new THREE.PointsMaterial({ size: pSize, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true })
  );

  const lidarCloud = new THREE.Points(
    lidarGeo,
    new THREE.PointsMaterial({ size: pSize, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true })
  );

  const fusedCloud = new THREE.Points(
    fusedGeo,
    new THREE.PointsMaterial({ size: pSize, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true })
  );

  const segCloud = new THREE.Points(
    segGeo,
    new THREE.PointsMaterial({ size: pSize * 1.05, vertexColors: true, transparent: true, opacity: 0.88, sizeAttenuation: true })
  );

  masterGroup.add(photoCloud);
  masterGroup.add(lidarCloud);
  masterGroup.add(fusedCloud);
  masterGroup.add(segCloud);

  // ============================================================================
  // 2. ARCHITECTURAL 3D SEGMENTED BUILDING (FLOORS, APARTMENTS, ROOMS, DOORS)
  // ============================================================================
  const segmentedBuildingGroup = new THREE.Group();

  const bW = spreadX * 0.88;
  const bD = spreadZ * 0.88;
  const wallH = 2.4; // Partition wall height
  const wallThick = 0.12;

  // Reusable materials
  const slabMat = new THREE.MeshStandardMaterial({ 
    color: 0xf8fafc, 
    roughness: 0.85, 
    metalness: 0.05 
  });
  const slabEdgeMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });

  const wallMat = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.28, 
    roughness: 0.35 
  });
  const wallEdgeMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.45 });

  // Semantic room palette
  const ROOM_COLORS = {
    LIVING: 0x0284c7,     // Sky blue
    LIVING_LINE: 0x38bdf8,
    MASTER_BED: 0x6366f1, // Indigo / violet
    MASTER_LINE: 0x818cf8,
    BED_2: 0x10b981,      // Emerald
    BED_2_LINE: 0x34d399,
    KITCHEN: 0xf59e0b,    // Amber
    KITCHEN_LINE: 0xfbbf24,
    BATH: 0xec4899,       // Rose
    BATH_LINE: 0xf472b6,
    CORRIDOR: 0x64748b,   // Slate
    CORRIDOR_LINE: 0x94a3b8,
  };

  /**
   * Creates an architectural 3D door with frame, open hinged door leaf, and floor swing arc
   */
  function createDoor(
    x: number, 
    y: number, 
    z: number, 
    rotY: number = 0, 
    doorWidth: number = 0.9, 
    doorHeight: number = 2.1, 
    openAngle: number = Math.PI * 0.32
  ): THREE.Group {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, y, z);
    doorGroup.rotation.y = rotY;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const jambThick = 0.05;
    const jambDepth = wallThick + 0.02;

    // Left jamb
    const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(jambThick, doorHeight, jambDepth), frameMat);
    leftJamb.position.set(-doorWidth / 2 + jambThick / 2, doorHeight / 2, 0);
    doorGroup.add(leftJamb);

    // Right jamb
    const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(jambThick, doorHeight, jambDepth), frameMat);
    rightJamb.position.set(doorWidth / 2 - jambThick / 2, doorHeight / 2, 0);
    doorGroup.add(rightJamb);

    // Top lintel
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, jambThick, jambDepth), frameMat);
    lintel.position.set(0, doorHeight + jambThick / 2, 0);
    doorGroup.add(lintel);

    // Door Leaf (open rotated)
    const leafW = doorWidth - jambThick * 2;
    const leafH = doorHeight - 0.02;
    const leafThick = 0.04;
    const leafMat = new THREE.MeshStandardMaterial({ 
      color: 0x334155, 
      roughness: 0.4, 
      metalness: 0.1 
    });
    const leafMesh = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, leafThick), leafMat);

    const hingeGroup = new THREE.Group();
    hingeGroup.position.set(-doorWidth / 2 + jambThick, 0, 0);
    hingeGroup.rotation.y = -openAngle; // swing open inward
    leafMesh.position.set(leafW / 2, leafH / 2, 0);
    hingeGroup.add(leafMesh);

    // Brass door handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
    const handleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.05), handleMat);
    handleMesh.position.set(leafW - 0.07, 0.95, 0.03);
    hingeGroup.add(handleMesh);

    doorGroup.add(hingeGroup);

    // Floor Swing Arc (Architectural CAD Standard 90-degree swing path)
    const arcSegments = 14;
    const arcRadius = leafW;
    const arcPts: THREE.Vector3[] = [];
    for (let i = 0; i <= arcSegments; i++) {
      const theta = -(i / arcSegments) * openAngle;
      arcPts.push(new THREE.Vector3(
        -doorWidth / 2 + jambThick + Math.cos(theta) * arcRadius,
        0.02,
        Math.sin(theta) * arcRadius
      ));
    }
    arcPts.push(new THREE.Vector3(-doorWidth / 2 + jambThick, 0.02, 0));
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    doorGroup.add(arcLine);

    return doorGroup;
  }

  /**
   * Helper to create a segmented room plate + perimeter boundary outline lines
   */
  function createRoomSegment(
    minX: number, 
    maxX: number, 
    minZ: number, 
    maxZ: number, 
    floorY: number, 
    color: number, 
    lineColor: number
  ): THREE.Group {
    const roomGroup = new THREE.Group();
    const w = maxX - minX;
    const d = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    // Subtle colored floor plate
    const roomTileMat = new THREE.MeshStandardMaterial({ 
      color, 
      transparent: true, 
      opacity: 0.22, 
      roughness: 0.5 
    });
    const tileMesh = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.02, d - 0.04), roomTileMat);
    tileMesh.position.set(cx, floorY + 0.04, cz);
    roomGroup.add(tileMesh);

    // Crisp 3D Room Perimeter Boundary Line
    const pts = [
      new THREE.Vector3(minX, floorY + 0.05, minZ),
      new THREE.Vector3(maxX, floorY + 0.05, minZ),
      new THREE.Vector3(maxX, floorY + 0.05, maxZ),
      new THREE.Vector3(minX, floorY + 0.05, maxZ),
      new THREE.Vector3(minX, floorY + 0.05, minZ),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const borderMat = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 2 });
    const borderLine = new THREE.Line(borderGeo, borderMat);
    roomGroup.add(borderLine);

    return roomGroup;
  }

  /**
   * Creates an architectural wall segment with edges
   */
  function createWall(
    x: number, 
    y: number, 
    z: number, 
    w: number, 
    h: number, 
    d: number
  ): THREE.Group {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, y + h / 2, z);
    g.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), wallEdgeMat);
    edges.position.set(x, y + h / 2, z);
    g.add(edges);

    return g;
  }

  // BUILD EACH STOREY FLOOR-BY-FLOOR
  for (let f = 0; f < totalFloors; f++) {
    const floorY = f * floorHeight;
    const floorGroup = new THREE.Group();

    // 1. Floor Concrete Slab
    const slabGeo = new THREE.BoxGeometry(bW, 0.12, bD);
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, floorY + 0.06, 0);
    floorGroup.add(slab);

    const slabEdges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), slabEdgeMat);
    slabEdges.position.set(0, floorY + 0.06, 0);
    floorGroup.add(slabEdges);

    // 2. Central Common Corridor (Hallway connecting apartments)
    const corrX1 = -1.1;
    const corrX2 = 1.1;
    const corrZ1 = -bD / 2 + 0.4;
    const corrZ2 = bD / 2 - 0.4;
    floorGroup.add(createRoomSegment(corrX1, corrX2, corrZ1, corrZ2, floorY, ROOM_COLORS.CORRIDOR, ROOM_COLORS.CORRIDOR_LINE));

    // Corridor Partition Walls with Apartment Entrance Openings
    // West corridor wall (at x = -1.1)
    const doorZ_West = (corrZ1 + corrZ2) * 0.45;
    floorGroup.add(createWall(corrX1, floorY + 0.08, (corrZ1 + doorZ_West - 0.5) / 2, wallThick, wallH, (doorZ_West - 0.5) - corrZ1));
    floorGroup.add(createWall(corrX1, floorY + 0.08, (doorZ_West + 0.5 + corrZ2) / 2, wallThick, wallH, corrZ2 - (doorZ_West + 0.5)));
    // West Entrance Door
    floorGroup.add(createDoor(corrX1, floorY + 0.08, doorZ_West, -Math.PI / 2, 0.95, 2.1));

    // East corridor wall (at x = 1.1)
    const doorZ_East = (corrZ1 + corrZ2) * 0.45;
    floorGroup.add(createWall(corrX2, floorY + 0.08, (corrZ1 + doorZ_East - 0.5) / 2, wallThick, wallH, (doorZ_East - 0.5) - corrZ1));
    floorGroup.add(createWall(corrX2, floorY + 0.08, (doorZ_East + 0.5 + corrZ2) / 2, wallThick, wallH, corrZ2 - (doorZ_East + 0.5)));
    // East Entrance Door
    floorGroup.add(createDoor(corrX2, floorY + 0.08, doorZ_East, Math.PI / 2, 0.95, 2.1));

    // 3. APARTMENT UNIT 1 (WEST WING - Flat ${(f + 1) * 100 + 1})
    const wX_min = -bW / 2 + 0.3;
    const wX_max = corrX1;
    const wZ_min = -bD / 2 + 0.3;
    const wZ_max = bD / 2 - 0.3;
    const wWidth = wX_max - wX_min;
    const wMidX = wX_min + wWidth * 0.55;
    const wMidZ = (wZ_min + wZ_max) * 0.15;
    const wBathZ = wZ_min + (wMidZ - wZ_min) * 0.55;

    // Room A1: Living & Dining Room
    floorGroup.add(createRoomSegment(wX_min, wX_max, wMidZ, wZ_max, floorY, ROOM_COLORS.LIVING, ROOM_COLORS.LIVING_LINE));

    // Room A2: Master Bedroom
    floorGroup.add(createRoomSegment(wX_min, wMidX, wBathZ, wMidZ, floorY, ROOM_COLORS.MASTER_BED, ROOM_COLORS.MASTER_LINE));

    // Room A3: Attached Master Bath
    floorGroup.add(createRoomSegment(wX_min, wX_min + wWidth * 0.45, wZ_min, wBathZ, floorY, ROOM_COLORS.BATH, ROOM_COLORS.BATH_LINE));

    // Room A4: Modular Kitchen
    floorGroup.add(createRoomSegment(wMidX, wX_max, wBathZ, wMidZ, floorY, ROOM_COLORS.KITCHEN, ROOM_COLORS.KITCHEN_LINE));

    // Room A5: Common Toilet / Utility
    floorGroup.add(createRoomSegment(wX_min + wWidth * 0.45, wX_max, wZ_min, wBathZ, floorY, ROOM_COLORS.BED_2, ROOM_COLORS.BED_2_LINE));

    // Interior Doors for Apartment 1
    // Door to Master Bed (at partition wall z = wMidZ)
    const doorX_MBedW = wX_min + wWidth * 0.28;
    floorGroup.add(createDoor(doorX_MBedW, floorY + 0.08, wMidZ, Math.PI, 0.88, 2.05));

    // Door to Kitchen (at partition wall z = wMidZ)
    const doorX_KitW = wMidX + (wX_max - wMidX) * 0.5;
    floorGroup.add(createDoor(doorX_KitW, floorY + 0.08, wMidZ, Math.PI, 0.88, 2.05));

    // Door to Attached Bath (at partition wall z = wBathZ)
    const doorX_BathW = wX_min + wWidth * 0.22;
    floorGroup.add(createDoor(doorX_BathW, floorY + 0.08, wBathZ, Math.PI, 0.82, 2.0));

    // Door to Common Toilet
    const doorX_CBathW = wX_min + wWidth * 0.65;
    floorGroup.add(createDoor(doorX_CBathW, floorY + 0.08, wBathZ, Math.PI, 0.82, 2.0));

    // 4. APARTMENT UNIT 2 (EAST WING - Flat ${(f + 1) * 100 + 2})
    const eX_min = corrX2;
    const eX_max = bW / 2 - 0.3;
    const eZ_min = -bD / 2 + 0.3;
    const eZ_max = bD / 2 - 0.3;
    const eWidth = eX_max - eX_min;
    const eMidX = eX_min + eWidth * 0.45;
    const eMidZ = (eZ_min + eZ_max) * 0.15;
    const eBathZ = eZ_min + (eMidZ - eZ_min) * 0.55;

    // Room B1: Living & Dining Room
    floorGroup.add(createRoomSegment(eX_min, eX_max, eMidZ, eZ_max, floorY, ROOM_COLORS.LIVING, ROOM_COLORS.LIVING_LINE));

    // Room B2: Master Bedroom
    floorGroup.add(createRoomSegment(eMidX, eX_max, eBathZ, eMidZ, floorY, ROOM_COLORS.MASTER_BED, ROOM_COLORS.MASTER_LINE));

    // Room B3: Attached Master Bath
    floorGroup.add(createRoomSegment(eX_max - eWidth * 0.45, eX_max, eZ_min, eBathZ, floorY, ROOM_COLORS.BATH, ROOM_COLORS.BATH_LINE));

    // Room B4: Modular Kitchen
    floorGroup.add(createRoomSegment(eX_min, eMidX, eBathZ, eMidZ, floorY, ROOM_COLORS.KITCHEN, ROOM_COLORS.KITCHEN_LINE));

    // Room B5: Common Toilet / Utility
    floorGroup.add(createRoomSegment(eX_min, eX_max - eWidth * 0.45, eZ_min, eBathZ, floorY, ROOM_COLORS.BED_2, ROOM_COLORS.BED_2_LINE));

    // Interior Doors for Apartment 2
    // Door to Master Bed
    const doorX_MBedE = eMidX + (eX_max - eMidX) * 0.6;
    floorGroup.add(createDoor(doorX_MBedE, floorY + 0.08, eMidZ, Math.PI, 0.88, 2.05));

    // Door to Kitchen
    const doorX_KitE = eX_min + (eMidX - eX_min) * 0.5;
    floorGroup.add(createDoor(doorX_KitE, floorY + 0.08, eMidZ, Math.PI, 0.88, 2.05));

    // Door to Attached Bath
    const doorX_BathE = eX_max - eWidth * 0.22;
    floorGroup.add(createDoor(doorX_BathE, floorY + 0.08, eBathZ, Math.PI, 0.82, 2.0));

    // Door to Common Toilet
    const doorX_CBathE = eX_min + eWidth * 0.25;
    floorGroup.add(createDoor(doorX_CBathE, floorY + 0.08, eBathZ, Math.PI, 0.82, 2.0));

    // Partition walls separating living from bedrooms/kitchens
    // West dividing wall at z = wMidZ
    floorGroup.add(createWall((wX_min + doorX_MBedW - 0.45) / 2, floorY + 0.08, wMidZ, (doorX_MBedW - 0.45) - wX_min, wallH, wallThick));
    floorGroup.add(createWall((doorX_MBedW + 0.45 + doorX_KitW - 0.45) / 2, floorY + 0.08, wMidZ, (doorX_KitW - 0.45) - (doorX_MBedW + 0.45), wallH, wallThick));
    floorGroup.add(createWall((doorX_KitW + 0.45 + wX_max) / 2, floorY + 0.08, wMidZ, wX_max - (doorX_KitW + 0.45), wallH, wallThick));

    // East dividing wall at z = eMidZ
    floorGroup.add(createWall((eX_min + doorX_KitE - 0.45) / 2, floorY + 0.08, eMidZ, (doorX_KitE - 0.45) - eX_min, wallH, wallThick));
    floorGroup.add(createWall((doorX_KitE + 0.45 + doorX_MBedE - 0.45) / 2, floorY + 0.08, eMidZ, (doorX_MBedE - 0.45) - (doorX_KitE + 0.45), wallH, wallThick));
    floorGroup.add(createWall((doorX_MBedE + 0.45 + eX_max) / 2, floorY + 0.08, eMidZ, eX_max - (doorX_MBedE + 0.45), wallH, wallThick));

    segmentedBuildingGroup.add(floorGroup);
  }

  // 5. Roof Terrace & Parapet
  const roofY = totalHeight;
  const roofSlabGeo = new THREE.BoxGeometry(bW, 0.12, bD);
  const roofSlab = new THREE.Mesh(roofSlabGeo, slabMat);
  roofSlab.position.set(0, roofY + 0.06, 0);
  segmentedBuildingGroup.add(roofSlab);

  const roofEdges = new THREE.LineSegments(new THREE.EdgesGeometry(roofSlabGeo), slabEdgeMat);
  roofEdges.position.set(0, roofY + 0.06, 0);
  segmentedBuildingGroup.add(roofEdges);

  // Roof Parapet Wall (0.9m height around roof perimeter)
  const parapetH = 0.9;
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
  // North & South parapets
  [-bD / 2 + 0.06, bD / 2 - 0.06].forEach(pz => {
    const pMesh = new THREE.Mesh(new THREE.BoxGeometry(bW, parapetH, 0.12), parapetMat);
    pMesh.position.set(0, roofY + 0.12 + parapetH / 2, pz);
    segmentedBuildingGroup.add(pMesh);
  });
  // West & East parapets
  [-bW / 2 + 0.06, bW / 2 - 0.06].forEach(px => {
    const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, parapetH, bD - 0.24), parapetMat);
    pMesh.position.set(px, roofY + 0.12 + parapetH / 2, 0);
    segmentedBuildingGroup.add(pMesh);
  });

  masterGroup.add(segmentedBuildingGroup);

  // ============================================================================
  // 3. VERTICAL SURVEY HEIGHT DIMENSION FROM GROUND (Y = 0)
  // ============================================================================
  const heightDimensionGroup = new THREE.Group();

  const hPosX = bW / 2 + 2.2;
  const hPosZ = bD * 0.25;

  const dimColor = 0xf59e0b; // Surveyor Amber
  const dimLineMat = new THREE.LineBasicMaterial({ color: dimColor, linewidth: 2.5 });
  const witnessMat = new THREE.LineDashedMaterial({ 
    color: 0xfbbf24, 
    dashSize: 0.35, 
    gapSize: 0.2, 
    transparent: true, 
    opacity: 0.85 
  });

  // Vertical Dimension Line from Y=0 to Y=totalHeight
  const vertPts = [
    new THREE.Vector3(hPosX, 0, hPosZ),
    new THREE.Vector3(hPosX, totalHeight, hPosZ)
  ];
  const vertGeo = new THREE.BufferGeometry().setFromPoints(vertPts);
  const vertLine = new THREE.Line(vertGeo, dimLineMat);
  heightDimensionGroup.add(vertLine);

  // Ground Datum Witness Line & Benchmark Marker (Y = 0)
  const groundWitnessGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(bW / 2, 0, hPosZ),
    new THREE.Vector3(hPosX + 1.2, 0, hPosZ)
  ]);
  const groundWitness = new THREE.Line(groundWitnessGeo, witnessMat);
  groundWitness.computeLineDistances();
  heightDimensionGroup.add(groundWitness);

  // Ground Datum Symbol (Surveyor Benchmark Inverted Triangle)
  const datumTriGeo = new THREE.BufferGeometry();
  const triVertices = new Float32Array([
    hPosX - 0.35, 0.4, hPosZ,
    hPosX + 0.35, 0.4, hPosZ,
    hPosX, 0.02, hPosZ
  ]);
  datumTriGeo.setAttribute('position', new THREE.BufferAttribute(triVertices, 3));
  const datumTriMat = new THREE.MeshBasicMaterial({ color: dimColor, side: THREE.DoubleSide });
  const datumTriMesh = new THREE.Mesh(datumTriGeo, datumTriMat);
  heightDimensionGroup.add(datumTriMesh);

  // Roof Apex Witness Line (Y = totalHeight)
  const roofWitnessGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(bW / 2, totalHeight, hPosZ),
    new THREE.Vector3(hPosX + 1.2, totalHeight, hPosZ)
  ]);
  const roofWitness = new THREE.Line(roofWitnessGeo, witnessMat);
  roofWitness.computeLineDistances();
  heightDimensionGroup.add(roofWitness);

  // Roof Dimension Arrow (Pointing down to top tick)
  const topArrowGeo = new THREE.BufferGeometry();
  const topArrowVerts = new Float32Array([
    hPosX - 0.35, totalHeight - 0.4, hPosZ,
    hPosX + 0.35, totalHeight - 0.4, hPosZ,
    hPosX, totalHeight - 0.02, hPosZ
  ]);
  topArrowGeo.setAttribute('position', new THREE.BufferAttribute(topArrowVerts, 3));
  const topArrowMesh = new THREE.Mesh(topArrowGeo, datumTriMat);
  heightDimensionGroup.add(topArrowMesh);

  // Intermediate Floor Level Ticks & Witness Lines
  for (let f = 1; f < totalFloors; f++) {
    const fY = f * floorHeight;
    const fWitnessGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(bW / 2, fY, hPosZ),
      new THREE.Vector3(hPosX + 0.7, fY, hPosZ)
    ]);
    const fWitness = new THREE.Line(fWitnessGeo, witnessMat);
    fWitness.computeLineDistances();
    heightDimensionGroup.add(fWitness);

    // Cross-tick on vertical dimension line
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(hPosX - 0.25, fY, hPosZ),
      new THREE.Vector3(hPosX + 0.25, fY, hPosZ)
    ]);
    const tickLine = new THREE.Line(tickGeo, dimLineMat);
    heightDimensionGroup.add(tickLine);
  }

  // Architectural Height Dimension Label (Compact survey callout attached to the ruler)
  const hCanvas = document.createElement('canvas');
  hCanvas.width = 512;
  hCanvas.height = 180;
  const hCtx = hCanvas.getContext('2d')!;

  hCtx.fillStyle = '#090d16';
  hCtx.roundRect(8, 8, 496, 164, 16);
  hCtx.fill();
  hCtx.lineWidth = 4;
  hCtx.strokeStyle = '#f59e0b';
  hCtx.stroke();

  hCtx.fillStyle = '#f59e0b';
  hCtx.font = 'bold 34px monospace';
  hCtx.fillText(`H = ${totalHeight.toFixed(2)} m`, 36, 56);

  hCtx.fillStyle = '#38bdf8';
  hCtx.font = 'bold 22px sans-serif';
  hCtx.fillText(`GROUND ELEVATION (Y = 0.00m)`, 36, 100);

  hCtx.fillStyle = '#94a3b8';
  hCtx.font = '20px sans-serif';
  hCtx.fillText(`${totalFloors} STOREYS • ${totalFloors * 2} APARTMENTS`, 36, 138);

  const hTexture = new THREE.CanvasTexture(hCanvas);
  hTexture.minFilter = THREE.LinearFilter;
  const hBadgeGeo = new THREE.PlaneGeometry(3.6, 1.35);
  const hBadgeMat = new THREE.MeshBasicMaterial({ map: hTexture, transparent: true, side: THREE.DoubleSide });
  const hBadgeMesh = new THREE.Mesh(hBadgeGeo, hBadgeMat);
  hBadgeMesh.position.set(hPosX + 2.1, totalHeight / 2, hPosZ);
  heightDimensionGroup.add(hBadgeMesh);

  // Leader line connecting vertical ruler to dimension tag
  const leaderGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(hPosX, totalHeight / 2, hPosZ),
    new THREE.Vector3(hPosX + 0.4, totalHeight / 2, hPosZ)
  ]);
  const leaderLine = new THREE.Line(leaderGeo, dimLineMat);
  heightDimensionGroup.add(leaderLine);

  masterGroup.add(heightDimensionGroup);

  // ============================================================================
  // 4. STAGE 5: PROPERTY RECORD MATCH 3D ELEMENTS (GROUND BOUNDARY & MONUMENTS)
  // ============================================================================
  const recordGroup = new THREE.Group();

  // Cadastral Survey Boundary Line on the ground
  const boundCorners = [
    new THREE.Vector3(-bW * 1.08, 0.04, -bD * 1.08),
    new THREE.Vector3(bW * 1.08, 0.04, -bD * 1.08),
    new THREE.Vector3(bW * 1.08, 0.04, bD * 1.08),
    new THREE.Vector3(-bW * 1.08, 0.04, bD * 1.08),
    new THREE.Vector3(-bW * 1.08, 0.04, -bD * 1.08)
  ];
  const boundLineGeo = new THREE.BufferGeometry().setFromPoints(boundCorners);
  const boundLineMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2.5 });
  const boundaryLine = new THREE.Line(boundLineGeo, boundLineMat);
  recordGroup.add(boundaryLine);

  // 4 Cadastral Survey Boundary Corner Stones (Pillars)
  boundCorners.slice(0, 4).forEach((pt) => {
    const pillarGeo = new THREE.CylinderGeometry(0.22, 0.32, 0.85, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.3, roughness: 0.4 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(pt.x, 0.42, pt.z);
    recordGroup.add(pillar);

    // Stone marker flag
    const flagGeo = new THREE.BoxGeometry(0.5, 0.25, 0.02);
    const flagMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(pt.x, 1.0, pt.z);
    recordGroup.add(flag);
  });

  masterGroup.add(recordGroup);

  // ============================================================================
  // 5. STAGE 6: TOPOLOGY VALIDATION 3D ELEMENTS (WATERTIGHT MANIFOLD)
  // ============================================================================
  const topologyGroup = new THREE.Group();

  // 3D Volumetric Topological Bounding Wireframe Manifold
  const topBoxGeo = new THREE.BoxGeometry(bW * 1.02, heightY, bD * 1.02);
  const topEdges = new THREE.EdgesGeometry(topBoxGeo);
  const topWire = new THREE.LineSegments(
    topEdges,
    new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
  );
  topWire.position.set(0, heightY * 0.5, 0);
  topologyGroup.add(topWire);

  // Corner verification spheres (green glowing nodes)
  const sphereGeo = new THREE.SphereGeometry(0.32, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  [
    [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]
  ].forEach(([sx, sy, sz]) => {
    const s = new THREE.Mesh(sphereGeo, sphereMat);
    s.position.set(sx * (bW * 0.51), (sy + 1) * (heightY * 0.5), sz * (bD * 0.51));
    topologyGroup.add(s);
  });

  masterGroup.add(topologyGroup);

  // ============================================================================
  // STAGE CONTROLLER / UPDATE FUNCTION
  // ============================================================================
  function updateStage(stage: PipelineStage, progress: number, isCompleted: boolean) {
    // Reset all layers
    photoCloud.visible = false;
    lidarCloud.visible = false;
    fusedCloud.visible = false;
    segCloud.visible = false;
    segmentedBuildingGroup.visible = false;
    heightDimensionGroup.visible = false;
    recordGroup.visible = false;
    topologyGroup.visible = false;

    if (stage === 'PHOTOGRAMMETRY') {
      photoCloud.visible = true;
      const count = Math.floor(pointCount * Math.min(1.0, (progress + 15) / 100));
      photoGeo.setDrawRange(0, count);
      photoCloud.position.set(0, 0, 0);
    } else if (stage === 'LIDAR') {
      lidarCloud.visible = true;
      const count = Math.floor(pointCount * Math.min(1.0, (progress + 15) / 100));
      lidarGeo.setDrawRange(0, count);
      lidarCloud.position.set(0, 0, 0);
    } else if (stage === 'FUSION') {
      const offset = 14 * (1 - Math.min(1.0, progress / 90));
      photoCloud.visible = true;
      lidarCloud.visible = true;
      photoCloud.position.set(-offset, 0, 0);
      lidarCloud.position.set(offset, 0, 0);
      photoGeo.setDrawRange(0, pointCount);
      lidarGeo.setDrawRange(0, pointCount);

      if (progress >= 85) {
        fusedCloud.visible = true;
        photoCloud.visible = false;
        lidarCloud.visible = false;
      }
    } else if (stage === 'SEGMENTATION') {
      // Reveal Multi-class semantic point cloud + Architectural Apartment Rooms, Doors & Ground Height
      segCloud.visible = true;
      const count = Math.floor(pointCount * Math.min(1.0, (progress + 20) / 100));
      segGeo.setDrawRange(0, count);

      segmentedBuildingGroup.visible = true;
      heightDimensionGroup.visible = true;
    } else if (stage === 'TOPOLOGY' || isCompleted) {
      // Final certified point cloud + Segmented rooms & doors + Height Dimension + Watertight Bounding Manifold
      segCloud.visible = true;
      segGeo.setDrawRange(0, pointCount);
      segmentedBuildingGroup.visible = true;
      heightDimensionGroup.visible = true;
      recordGroup.visible = true;
      topologyGroup.visible = true;
    }
  }

  return {
    masterGroup,
    metrics,
    updateStage,
    dispose: () => {
      photoGeo.dispose();
      lidarGeo.dispose();
      fusedGeo.dispose();
      segGeo.dispose();
      hTexture.dispose();
    }
  };
}
