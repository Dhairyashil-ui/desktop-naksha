import * as THREE from 'three';

// Color palette optimized for clean white studio background
export const SURVEY_COLORS = {
  DRONE_BODY: 0x1e293b,
  DRONE_ACCENT: 0x0284c7,
  DRONE_ROTOR: 0x0f172a,
  LASER_BEAM: 0x10b981,
  LASER_PULSE: 0x34d399,
  GCP_WHITE: 0xffffff,
  GCP_BLACK: 0x18181b,
  CADASTRAL_LINE: 0x2563eb,
  FRUSTUM_WIRE: 0x0284c7,
  POINT_GROUND: 0x059669,
  POINT_WALL: 0x1d4ed8,
  POINT_WINDOW: 0x06b6d4,
  POINT_ROOF: 0xd97706,
  DIMENSION_LINE: 0xd97706
};

// 1. QUADCOPTER DRONE PLATFORM
export function createDronePlatform() {
  const droneGroup = new THREE.Group();
  const rotors: THREE.Group[] = [];

  // Fuselage body
  const bodyGeo = new THREE.BoxGeometry(1.05, 0.28, 0.74);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: SURVEY_COLORS.DRONE_BODY,
    metalness: 0.7,
    roughness: 0.3
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  droneGroup.add(body);

  // Top avionics pod with high-viz stripe
  const topCapGeo = new THREE.BoxGeometry(0.7, 0.16, 0.48);
  const topCapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });
  const topCap = new THREE.Mesh(topCapGeo, topCapMat);
  topCap.position.y = 0.22;
  droneGroup.add(topCap);

  const stripeGeo = new THREE.BoxGeometry(0.72, 0.04, 0.5);
  const stripeMat = new THREE.MeshBasicMaterial({ color: SURVEY_COLORS.DRONE_ACCENT });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.14;
  droneGroup.add(stripe);

  // GNSS Antenna
  const antennaGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.26, 16);
  const antennaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.3 });
  const antenna = new THREE.Mesh(antennaGeo, antennaMat);
  antenna.position.set(0, 0.38, -0.16);
  droneGroup.add(antenna);

  // Navigation LEDs
  const ledRightGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const ledRightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const ledRight = new THREE.Mesh(ledRightGeo, ledRightMat);
  ledRight.position.set(0.52, 0, 0.36);
  droneGroup.add(ledRight);

  const ledLeftGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const ledLeftMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const ledLeft = new THREE.Mesh(ledLeftGeo, ledLeftMat);
  ledLeft.position.set(-0.52, 0, 0.36);
  droneGroup.add(ledLeft);

  // 4 Carbon Arms & Rotors
  const armOffsets: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];

  armOffsets.forEach(([ax, az]) => {
    const armGroup = new THREE.Group();
    const endX = ax * 1.2;
    const endZ = az * 1.0;

    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(endX * 0.5, 0, endZ * 0.5);
    arm.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(endX, 0, endZ).normalize()
    );
    armGroup.add(arm);

    const motorGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.22, 16);
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.position.set(endX, 0.06, endZ);
    armGroup.add(motor);

    const rotorHub = new THREE.Group();
    rotorHub.position.set(endX, 0.18, endZ);

    for (let r = 0; r < 2; r++) {
      const bladeGeo = new THREE.BoxGeometry(1.25, 0.015, 0.09);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.5, roughness: 0.5 });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.y = (r * Math.PI) / 2;
      rotorHub.add(blade);
    }

    const discGeo = new THREE.CircleGeometry(0.65, 24);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.01;
    rotorHub.add(disc);

    rotors.push(rotorHub);
    armGroup.add(rotorHub);
    droneGroup.add(armGroup);
  });

  // Sensor Gimbal
  const gimbalGroup = new THREE.Group();
  gimbalGroup.position.set(0, -0.22, 0.05);

  const gimbalCylinderGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.26, 16);
  const gimbalCylinderMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
  const gimbalCylinder = new THREE.Mesh(gimbalCylinderGeo, gimbalCylinderMat);
  gimbalGroup.add(gimbalCylinder);

  const lensGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.position.set(0, -0.13, 0.06);
  gimbalGroup.add(lens);

  droneGroup.add(gimbalGroup);

  return { droneGroup, rotors, gimbalGroup };
}

// 2. DYNAMIC LIDAR SCANNING SYSTEM
export function createLaserScanSystem() {
  const laserGroup = new THREE.Group();
  const maxBeams = 8;
  const beamLines: THREE.Line[] = [];
  const hitPuckList: THREE.Mesh[] = [];

  const targets = [
    new THREE.Vector3(0, 11.5, 0),       // Roof center
    new THREE.Vector3(-10, 10.5, 5),     // Roof West
    new THREE.Vector3(10, 10.5, -5),     // Roof East
    new THREE.Vector3(-12.6, 5.0, 0),    // West wall
    new THREE.Vector3(12.6, 5.0, 0),     // East wall
    new THREE.Vector3(0, 1.0, 7.3),      // South entrance
    new THREE.Vector3(-15.0, 0, -10.0),  // Ground survey point
    new THREE.Vector3(15.0, 0, 10.0)     // Ground survey point
  ];

  for (let i = 0; i < maxBeams; i++) {
    const geo = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3)
    );
    const mat = new THREE.LineBasicMaterial({
      color: SURVEY_COLORS.LASER_BEAM,
      transparent: true,
      opacity: 0.75,
      linewidth: 2
    });
    const line = new THREE.Line(geo, mat);
    beamLines.push(line);
    laserGroup.add(line);

    const puckGeo = new THREE.RingGeometry(0.1, 0.42, 16);
    const puckMat = new THREE.MeshBasicMaterial({
      color: SURVEY_COLORS.LASER_PULSE,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const puck = new THREE.Mesh(puckGeo, puckMat);
    puck.rotation.x = -Math.PI / 2;
    puck.visible = false;
    hitPuckList.push(puck);
    laserGroup.add(puck);
  }

  const coneGeo = new THREE.ConeGeometry(8.5, 20, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.visible = false;
  laserGroup.add(cone);

  return {
    laserGroup,
    cone,
    updateLaser: (dronePos: THREE.Vector3, time: number, isLidarActive: boolean, targetCenterX: number = 0) => {
      if (!isLidarActive) {
        laserGroup.visible = false;
        return { range: 0, tofNs: 0, pulseCount: 0 };
      }
      laserGroup.visible = true;

      let primaryDist = 0;
      let primaryTof = 0;

      for (let i = 0; i < maxBeams; i++) {
        const line = beamLines[i];
        const puck = hitPuckList[i];
        const target = targets[i];

        const linePos = line.geometry.attributes.position as THREE.BufferAttribute;
        linePos.setXYZ(0, dronePos.x, dronePos.y - 0.25, dronePos.z);

        const sweepPhase = Math.sin(time * 6 + i * 1.2);
        const hitX = target.x + targetCenterX + sweepPhase * 0.4;
        const hitY = target.y;
        const hitZ = target.z + Math.cos(time * 5 + i) * 0.4;

        linePos.setXYZ(1, hitX, hitY, hitZ);
        linePos.needsUpdate = true;

        puck.visible = true;
        puck.position.set(hitX, hitY + 0.05, hitZ);
        const scale = 0.8 + Math.sin(time * 12 + i) * 0.35;
        puck.scale.set(scale, scale, scale);

        if (i === 0) {
          primaryDist = dronePos.distanceTo(new THREE.Vector3(hitX, hitY, hitZ));
          primaryTof = (2 * primaryDist / 299792458) * 1e9;
        }
      }

      cone.visible = true;
      cone.position.set(dronePos.x, dronePos.y - 10, dronePos.z);

      return {
        range: Number(primaryDist.toFixed(2)),
        tofNs: Number(primaryTof.toFixed(1)),
        pulseCount: Math.floor(150000 + Math.sin(time * 4) * 4500)
      };
    }
  };
}

// 3. GCP GROUND CONTROL POINTS
export function createGcpMarkers() {
  const gcpGroup = new THREE.Group();

  const gcpPositions = [
    { id: 'GCP-01', x: -17, y: 0.02, z: 12 },
    { id: 'GCP-02', x: 17, y: 0.02, z: 11 },
    { id: 'CHK-01', x: 16, y: 0.02, z: -12 },
    { id: 'GCP-03', x: -16, y: 0.02, z: -12 }
  ];

  gcpPositions.forEach(target => {
    const marker = new THREE.Group();
    marker.position.set(target.x, target.y, target.z);

    const quadrants = [
      { x: -0.2, z: -0.2, color: SURVEY_COLORS.GCP_BLACK },
      { x: 0.2, z: -0.2, color: SURVEY_COLORS.GCP_WHITE },
      { x: -0.2, z: 0.2, color: SURVEY_COLORS.GCP_WHITE },
      { x: 0.2, z: 0.2, color: SURVEY_COLORS.GCP_BLACK }
    ];

    quadrants.forEach(q => {
      const qGeo = new THREE.PlaneGeometry(0.4, 0.4);
      const qMat = new THREE.MeshBasicMaterial({ color: q.color, side: THREE.DoubleSide });
      const qMesh = new THREE.Mesh(qGeo, qMat);
      qMesh.rotation.x = -Math.PI / 2;
      qMesh.position.set(q.x, 0.005, q.z);
      marker.add(qMesh);
    });

    const pinGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.y = 0.4;
    marker.add(pin);

    const flagGeo = new THREE.ConeGeometry(0.12, 0.35, 8);
    const flagMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.y = 0.85;
    marker.add(flag);

    gcpGroup.add(marker);
  });

  return { gcpGroup, gcpPositions };
}

// 4. CADASTRAL PARCEL PERIMETER (PARCEL 204/1)
export function createCadastralBoundary() {
  const boundaryGroup = new THREE.Group();

  const corners: [number, number, number][] = [
    [-18.0, 0.08, -14.0],
    [18.0, 0.08, -14.0],
    [18.0, 0.08, 14.0],
    [-18.0, 0.08, 14.0],
    [-18.0, 0.08, -14.0]
  ];

  const points = corners.map(c => new THREE.Vector3(c[0], c[1], c[2]));
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineBasicMaterial({
    color: SURVEY_COLORS.CADASTRAL_LINE,
    linewidth: 2
  });
  const perimeterLine = new THREE.Line(lineGeo, lineMat);
  boundaryGroup.add(perimeterLine);

  corners.slice(0, 4).forEach((c) => {
    const pillarGeo = new THREE.BoxGeometry(0.35, 0.7, 0.35);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(c[0], 0.35, c[2]);
    boundaryGroup.add(pillar);

    const capGeo = new THREE.BoxGeometry(0.36, 0.18, 0.36);
    const capMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(c[0], 0.62, c[2]);
    boundaryGroup.add(cap);
  });

  return boundaryGroup;
}

// 5. PHOTOGRAMMETRY CAMERA FRUSTUMS
export function createCameraFrustums(centerX: number = -14) {
  const frustumGroup = new THREE.Group();
  const cameraCount = 12;
  const radius = 18;

  for (let i = 0; i < cameraCount; i++) {
    const angle = (i / cameraCount) * Math.PI * 2;
    const cx = centerX + Math.sin(angle) * radius;
    const cy = 16 + Math.sin(angle * 3) * 1.6;
    const cz = Math.cos(angle) * radius;

    const camGroup = new THREE.Group();
    camGroup.position.set(cx, cy, cz);
    camGroup.lookAt(centerX, 4.5, 0);

    const camBoxGeo = new THREE.BoxGeometry(0.42, 0.28, 0.26);
    const camBoxMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });
    const camMesh = new THREE.Mesh(camBoxGeo, camBoxMat);
    camGroup.add(camMesh);

    const lensGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.25, 12);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.2;
    camGroup.add(lens);

    const halfW = 1.3;
    const halfH = 0.9;
    const dist = 3.0;

    const frustumCorners = [
      new THREE.Vector3(-halfW, -halfH, dist),
      new THREE.Vector3(halfW, -halfH, dist),
      new THREE.Vector3(halfW, halfH, dist),
      new THREE.Vector3(-halfW, halfH, dist),
      new THREE.Vector3(-halfW, -halfH, dist)
    ];

    const frustumLineGeo = new THREE.BufferGeometry().setFromPoints(frustumCorners);
    const frustumLineMat = new THREE.LineBasicMaterial({
      color: SURVEY_COLORS.FRUSTUM_WIRE,
      transparent: true,
      opacity: 0.75,
      linewidth: 1.5
    });
    camGroup.add(new THREE.Line(frustumLineGeo, frustumLineMat));

    for (let c = 0; c < 4; c++) {
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        frustumCorners[c]
      ]);
      camGroup.add(new THREE.Line(rayGeo, frustumLineMat));
    }

    frustumGroup.add(camGroup);
  }

  return frustumGroup;
}

// 6. DUAL POINT CLOUD SYSTEM (Photogrammetry RGB on Left + LiDAR Geometry on Right + Fusion at Center)
export interface DualPointCloudSystem {
  cloudGroup: THREE.Group;
  totalPoints: number;
  updateStage: (stage: string, progress: number, isCompleted: boolean) => void;
}

export function createDualPointCloudSystem(): DualPointCloudSystem {
  const cloudGroup = new THREE.Group();
  const pointCount = 18000;

  const photoPositions = new Float32Array(pointCount * 3);
  const photoColors = new Float32Array(pointCount * 3);

  const lidarPositions = new Float32Array(pointCount * 3);
  const lidarColors = new Float32Array(pointCount * 3);

  const semanticColors = new Float32Array(pointCount * 3);

  let p = 0;

  // 1. Ground points (6,000 points)
  for (let i = 0; i < 6000; i++) {
    const rx = (Math.random() - 0.5) * 36;
    const rz = (Math.random() - 0.5) * 26;
    const ry = (Math.random() - 0.5) * 0.08;

    photoPositions[p * 3] = rx + (Math.random() - 0.5) * 0.08;
    photoPositions[p * 3 + 1] = ry;
    photoPositions[p * 3 + 2] = rz + (Math.random() - 0.5) * 0.08;

    lidarPositions[p * 3] = rx;
    lidarPositions[p * 3 + 1] = ry;
    lidarPositions[p * 3 + 2] = rz;

    // Photo RGB: ground grass & asphalt
    photoColors[p * 3] = 0.08 + Math.random() * 0.08;
    photoColors[p * 3 + 1] = 0.55 + Math.random() * 0.12;
    photoColors[p * 3 + 2] = 0.35 + Math.random() * 0.08;

    // LiDAR emerald laser returns
    lidarColors[p * 3] = 0.06;
    lidarColors[p * 3 + 1] = 0.85 + Math.random() * 0.15;
    lidarColors[p * 3 + 2] = 0.55 + Math.random() * 0.25;

    // Semantic GROUND (#7b9181)
    semanticColors[p * 3] = 0.48;
    semanticColors[p * 3 + 1] = 0.57;
    semanticColors[p * 3 + 2] = 0.51;
    p++;
  }

  // 2. Building Facades & Openings (8,000 points)
  for (let i = 0; i < 8000; i++) {
    const wallSide = Math.floor(Math.random() * 4);
    let wx = 0;
    let wz = 0;
    const wy = Math.random() * 10.2;

    if (wallSide === 0) {
      wx = (Math.random() - 0.5) * 25.2;
      wz = -7.0;
    } else if (wallSide === 1) {
      wx = (Math.random() - 0.5) * 25.2;
      wz = 7.0;
    } else if (wallSide === 2) {
      wx = 12.6;
      wz = (Math.random() - 0.5) * 14.0;
    } else {
      wx = -12.6;
      wz = (Math.random() - 0.5) * 14.0;
    }

    photoPositions[p * 3] = wx + (Math.random() - 0.5) * 0.08;
    photoPositions[p * 3 + 1] = wy;
    photoPositions[p * 3 + 2] = wz + (Math.random() - 0.5) * 0.08;

    lidarPositions[p * 3] = wx;
    lidarPositions[p * 3 + 1] = wy;
    lidarPositions[p * 3 + 2] = wz;

    const floorLevel = Math.floor(wy / 3.4);
    const inFloorY = wy % 3.4;
    const isWindow = (inFloorY > 1.0 && inFloorY < 2.5);
    const isDoor = (floorLevel === 0 && wz > 6.8 && Math.abs(wx) < 1.2 && wy < 2.1);

    if (isDoor) {
      // Photo RGB: teak wood
      photoColors[p * 3] = 0.70;
      photoColors[p * 3 + 1] = 0.32;
      photoColors[p * 3 + 2] = 0.05;
      // Semantic DOOR (#e3b574)
      semanticColors[p * 3] = 0.89;
      semanticColors[p * 3 + 1] = 0.71;
      semanticColors[p * 3 + 2] = 0.45;
    } else if (isWindow) {
      // Photo RGB: sky cyan reflection
      photoColors[p * 3] = 0.05;
      photoColors[p * 3 + 1] = 0.65;
      photoColors[p * 3 + 2] = 0.85;
      // Semantic WINDOW (#8ac8b6)
      semanticColors[p * 3] = 0.54;
      semanticColors[p * 3 + 1] = 0.78;
      semanticColors[p * 3 + 2] = 0.71;
    } else {
      // Photo RGB: sandstone alabaster facade
      photoColors[p * 3] = 0.88;
      photoColors[p * 3 + 1] = 0.86;
      photoColors[p * 3 + 2] = 0.80;
      // Semantic WALL (#76b7c5)
      semanticColors[p * 3] = 0.46;
      semanticColors[p * 3 + 1] = 0.72;
      semanticColors[p * 3 + 2] = 0.77;
    }

    // LiDAR intense cyan return
    lidarColors[p * 3] = 0.0;
    lidarColors[p * 3 + 1] = 0.85 + Math.random() * 0.15;
    lidarColors[p * 3 + 2] = 0.95 + Math.random() * 0.05;
    p++;
  }

  // 3. Roof & Mechanical Penthouse (4,000 points)
  for (let i = 0; i < 4000; i++) {
    const rx = (Math.random() - 0.5) * 25.2;
    const rz = (Math.random() - 0.5) * 14.0;
    const ry = 10.2 + (Math.random() - 0.5) * 0.06;

    photoPositions[p * 3] = rx;
    photoPositions[p * 3 + 1] = ry;
    photoPositions[p * 3 + 2] = rz;

    lidarPositions[p * 3] = rx;
    lidarPositions[p * 3 + 1] = ry;
    lidarPositions[p * 3 + 2] = rz;

    // Photo RGB: slate roof
    photoColors[p * 3] = 0.45;
    photoColors[p * 3 + 1] = 0.50;
    photoColors[p * 3 + 2] = 0.55;

    // LiDAR pulse
    lidarColors[p * 3] = 0.1;
    lidarColors[p * 3 + 1] = 0.9;
    lidarColors[p * 3 + 2] = 0.8;

    // Semantic ROOF (#8797cb)
    semanticColors[p * 3] = 0.53;
    semanticColors[p * 3 + 1] = 0.59;
    semanticColors[p * 3 + 2] = 0.80;
    p++;
  }

  // Create Photo Cloud
  const photoGeo = new THREE.BufferGeometry();
  photoGeo.setAttribute('position', new THREE.BufferAttribute(photoPositions, 3));
  photoGeo.setAttribute('color', new THREE.BufferAttribute(photoColors, 3));
  const photoMat = new THREE.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    transparent: true,
    opacity: 0.95
  });
  const photoCloud = new THREE.Points(photoGeo, photoMat);
  photoCloud.position.set(-14, 0, 0);
  cloudGroup.add(photoCloud);

  // Create LiDAR Cloud
  const lidarGeo = new THREE.BufferGeometry();
  lidarGeo.setAttribute('position', new THREE.BufferAttribute(lidarPositions, 3));
  lidarGeo.setAttribute('color', new THREE.BufferAttribute(lidarColors, 3));
  const lidarMat = new THREE.PointsMaterial({
    size: 0.16,
    vertexColors: true,
    transparent: true,
    opacity: 0.95
  });
  const lidarCloud = new THREE.Points(lidarGeo, lidarMat);
  lidarCloud.position.set(14, 0, 0);
  lidarCloud.visible = false;
  cloudGroup.add(lidarCloud);

  let currentColorsMode: 'rgb' | 'semantic' = 'rgb';

  const updateStage = (stage: string, progress: number, isCompleted: boolean) => {
    if (isCompleted || stage === 'FLOORS' || stage === 'PROPERTY') {
      cloudGroup.visible = false;
      return;
    }

    cloudGroup.visible = true;

    if (stage === 'PHOTOGRAMMETRY') {
      photoCloud.visible = true;
      photoCloud.position.set(-14, 0, 0);
      photoGeo.setDrawRange(0, Math.floor((progress / 100) * pointCount));
      photoMat.opacity = 0.95;

      lidarCloud.visible = false;
    } else if (stage === 'LIDAR') {
      photoCloud.visible = true;
      photoCloud.position.set(-14, 0, 0);
      photoGeo.setDrawRange(0, pointCount);
      photoMat.opacity = 0.45;

      lidarCloud.visible = true;
      lidarCloud.position.set(14, 0, 0);
      lidarGeo.setDrawRange(0, Math.floor((progress / 100) * pointCount));
      lidarMat.opacity = 0.95;
    } else if (stage === 'FUSION') {
      photoCloud.visible = true;
      lidarCloud.visible = true;
      photoGeo.setDrawRange(0, pointCount);
      lidarGeo.setDrawRange(0, pointCount);

      const offset = 14 * (1 - Math.min(1, progress / 100));
      photoCloud.position.set(-offset, 0, 0);
      lidarCloud.position.set(offset, 0, 0);

      photoMat.opacity = 0.85;
      lidarMat.opacity = 0.85;
    } else if (stage === 'MESH' || stage === 'BUILDING') {
      photoCloud.position.set(0, 0, 0);
      lidarCloud.position.set(0, 0, 0);
      photoGeo.setDrawRange(0, pointCount);
      lidarGeo.setDrawRange(0, pointCount);

      if (currentColorsMode !== 'semantic') {
        photoGeo.setAttribute('color', new THREE.BufferAttribute(semanticColors, 3));
        photoGeo.attributes.color.needsUpdate = true;
        currentColorsMode = 'semantic';
      }

      photoCloud.visible = true;
      lidarCloud.visible = false;
      photoMat.opacity = Math.max(0.15, 0.85 * (1 - progress / 100));
    }
  };

  return {
    cloudGroup,
    totalPoints: pointCount * 2,
    updateStage
  };
}

export function createClassifiedPointCloud() {
  return createDualPointCloudSystem();
}

// 7. EXACT PROCEDURAL RESEARCH BUILDING MODEL (From D:\surveynaksha\cinematic3d\data\surveyData.ts)
// With step-by-step construction controller matching cinematic3d
export interface BuildingPartNode {
  mesh: THREE.Mesh;
  wire: THREE.LineSegments;
  targetY: number;
  defaultOpacity: number;
  semanticClass: string;
  floor: number;
  index: number;
}

export interface BimModelSystem {
  bimGroup: THREE.Group;
  wireframeGroup: THREE.Group;
  dimensionGroup: THREE.Group;
  updateStage: (stage: string, stageProgress: number, isCompleted: boolean) => void;
  partsCount: number;
}

export function createBimModelAndDimensions(): BimModelSystem {
  const bimGroup = new THREE.Group();
  const wireframeGroup = new THREE.Group();
  const dimensionGroup = new THREE.Group();

  interface PartDef {
    semanticClass: string;
    position: [number, number, number];
    size: [number, number, number];
    color: number;
    floor: number;
    opacity: number;
    metalness?: number;
    roughness?: number;
  }

  const rawParts: PartDef[] = [];

  // Ground base plate [0, -0.18, 0], [42, 0.3, 32], "#6c7270"
  rawParts.push({
    semanticClass: 'GROUND',
    position: [0, -0.18, 0],
    size: [42, 0.3, 32],
    color: 0x6c7270,
    floor: -1,
    opacity: 0.95,
    roughness: 0.8
  });

  // 4 Floor Slabs: [25.8, 0.24, 14.6] at Y = floor * 3.4
  for (let floor = 0; floor <= 3; floor++) {
    const isRoof = floor === 3;
    rawParts.push({
      semanticClass: isRoof ? 'ROOF' : 'FLOOR',
      position: [0, floor * 3.4, 0],
      size: [25.8, 0.24, 14.6],
      color: isRoof ? 0x74817f : 0xa6aaa2,
      floor: floor,
      opacity: 0.95,
      metalness: 0.15,
      roughness: 0.5
    });
  }

  // Occupied floors (Floor 0, 1, 2)
  for (let floor = 0; floor < 3; floor++) {
    const base = floor * 3.4;

    for (const side of [-1, 1]) {
      const z = side * 7;

      // Continuous wall bands above and below window openings
      rawParts.push({
        semanticClass: 'WALL',
        position: [0, base + 0.5, z],
        size: [25.2, 0.95, 0.3],
        color: 0xb7b5a5,
        floor: floor,
        opacity: 0.95,
        roughness: 0.65
      });

      rawParts.push({
        semanticClass: 'WALL',
        position: [0, base + 2.95, z],
        size: [25.2, 0.85, 0.3],
        color: 0xb7b5a5,
        floor: floor,
        opacity: 0.95,
        roughness: 0.65
      });

      // 7 Window Bays per side
      for (let bay = 0; bay < 7; bay++) {
        const x = -10.8 + bay * 3.6;

        // Wall pier between windows
        rawParts.push({
          semanticClass: 'WALL',
          position: [x - 1.48, base + 1.72, z],
          size: [0.62, 1.55, 0.3],
          color: 0xb7b5a5,
          floor: floor,
          opacity: 0.95,
          roughness: 0.65
        });

        // Window Glazing: [2.55, 1.5, 0.13]
        rawParts.push({
          semanticClass: 'WINDOW',
          position: [x + 0.2, base + 1.72, z + side * 0.025],
          size: [2.55, 1.5, 0.13],
          color: 0x38545d,
          floor: floor,
          opacity: 0.68,
          metalness: 0.75,
          roughness: 0.15
        });

        // Window mullion structural frame
        rawParts.push({
          semanticClass: 'STRUCTURE',
          position: [x + 0.2, base + 1.72, z + side * 0.12],
          size: [0.055, 1.52, 0.06],
          color: 0x929d99,
          floor: floor,
          opacity: 0.95,
          metalness: 0.6,
          roughness: 0.35
        });

        // Exterior AC units
        if (side === 1 && bay % 3 === 0 && floor > 0) {
          rawParts.push({
            semanticClass: 'AC',
            position: [x + 0.7, base + 0.63, 7.46],
            size: [0.86, 0.52, 0.36],
            color: 0xaeb8b4,
            floor: floor,
            opacity: 0.95,
            metalness: 0.5,
            roughness: 0.3
          });
        }
      }
    }

    // East and West End Walls: [0.3, 3.16, 14] at X = -12.6, 12.6
    for (const x of [-12.6, 12.6]) {
      rawParts.push({
        semanticClass: 'WALL',
        position: [x, base + 1.7, 0],
        size: [0.3, 3.16, 14.0],
        color: 0xaaa99c,
        floor: floor,
        opacity: 0.95,
        roughness: 0.65
      });
    }
  }

  // Ground floor entrance doors (#127, #128) on south facade
  rawParts.push({
    semanticClass: 'DOOR',
    position: [-1.1, 1.025, 7.26],
    size: [0.92, 2.05, 0.14],
    color: 0x586c6d,
    floor: 0,
    opacity: 0.95,
    roughness: 0.35
  });

  rawParts.push({
    semanticClass: 'DOOR',
    position: [0.1, 1.025, 7.26],
    size: [0.92, 2.05, 0.14],
    color: 0x586c6d,
    floor: 0,
    opacity: 0.95,
    roughness: 0.35
  });

  // 1st Floor Balcony: [7.8, 0.22, 2.35] at [0, 3.4, 8.15]
  rawParts.push({
    semanticClass: 'BALCONY',
    position: [0, 3.4, 8.15],
    size: [7.8, 0.22, 2.35],
    color: 0xa3aaa1,
    floor: 1,
    opacity: 0.95,
    roughness: 0.5
  });

  // Balcony perimeter safety railing
  rawParts.push({
    semanticClass: 'STRUCTURE',
    position: [0, 3.82, 9.3],
    size: [7.8, 0.8, 0.05],
    color: 0x334155,
    floor: 1,
    opacity: 0.95,
    metalness: 0.7,
    roughness: 0.3
  });

  // Ground level support columns under balcony: [-3.6, 1.65, 8.7] and [3.6, 1.65, 8.7]
  rawParts.push({
    semanticClass: 'STRUCTURE',
    position: [-3.6, 1.65, 8.7],
    size: [0.24, 3.3, 0.24],
    color: 0xa7afa6,
    floor: 0,
    opacity: 0.95,
    metalness: 0.5,
    roughness: 0.4
  });

  rawParts.push({
    semanticClass: 'STRUCTURE',
    position: [3.6, 1.65, 8.7],
    size: [0.24, 3.3, 0.24],
    color: 0xa7afa6,
    floor: 0,
    opacity: 0.95,
    metalness: 0.5,
    roughness: 0.4
  });

  // Rooftop structure & AC chiller
  rawParts.push({
    semanticClass: 'STRUCTURE',
    position: [0, 11, -1.7],
    size: [6.4, 1.5, 4.6],
    color: 0x999f96,
    floor: 3,
    opacity: 0.95,
    roughness: 0.6
  });

  rawParts.push({
    semanticClass: 'AC',
    position: [7.4, 10.82, -2.4],
    size: [2.1, 0.95, 1.5],
    color: 0x9daaa5,
    floor: 3,
    opacity: 0.95,
    metalness: 0.6,
    roughness: 0.35
  });

  // Sort parts for natural step-by-step vertical construction sequence:
  // Foundation pad -> Floor 0 slab & walls -> Balcony & Floor 1 -> Floor 2 -> Roof
  const classOrder: Record<string, number> = {
    GROUND: 0,
    FLOOR: 1,
    STRUCTURE: 2,
    WALL: 3,
    WINDOW: 4,
    DOOR: 5,
    BALCONY: 6,
    ROOF: 7,
    AC: 8
  };

  rawParts.sort((a, b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    const ca = classOrder[a.semanticClass] ?? 9;
    const cb = classOrder[b.semanticClass] ?? 9;
    if (ca !== cb) return ca - cb;
    return a.position[1] - b.position[1];
  });

  // Build Three.js nodes
  const partNodes: BuildingPartNode[] = [];

  rawParts.forEach((p, idx) => {
    const geo = new THREE.BoxGeometry(...p.size);
    const isWindow = p.semanticClass === 'WINDOW';
    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      roughness: p.roughness ?? (isWindow ? 0.15 : 0.65),
      metalness: p.metalness ?? (isWindow ? 0.75 : 0.1),
      transparent: true,
      opacity: p.opacity
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.position[0], p.position[1], p.position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bimGroup.add(mesh);

    const edges = new THREE.EdgesGeometry(geo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35
    });
    const wire = new THREE.LineSegments(edges, wireMat);
    wire.position.set(p.position[0], p.position[1], p.position[2]);
    wireframeGroup.add(wire);

    partNodes.push({
      mesh,
      wire,
      targetY: p.position[1],
      defaultOpacity: p.opacity,
      semanticClass: p.semanticClass,
      floor: p.floor,
      index: idx
    });
  });

  // 3D Architectural Dimensions (Front Width: 25.80m, Depth: 14.60m, Height: 11.00m)
  function addDimensionLine(from: THREE.Vector3, to: THREE.Vector3) {
    const dimSub = new THREE.Group();
    const lineGeo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const lineMat = new THREE.LineBasicMaterial({ color: SURVEY_COLORS.DIMENSION_LINE, linewidth: 2 });
    dimSub.add(new THREE.Line(lineGeo, lineMat));

    const tickDir = new THREE.Vector3(0, 0.28, 0);
    [from, to].forEach(pt => {
      const tickGeo = new THREE.BufferGeometry().setFromPoints([
        pt.clone().sub(tickDir),
        pt.clone().add(tickDir)
      ]);
      dimSub.add(new THREE.Line(tickGeo, lineMat));
    });

    dimensionGroup.add(dimSub);
  }

  // Front Width (25.80 m)
  addDimensionLine(
    new THREE.Vector3(-12.9, 0.3, 8.5),
    new THREE.Vector3(12.9, 0.3, 8.5)
  );

  // Depth (14.60 m)
  addDimensionLine(
    new THREE.Vector3(13.8, 0.3, -7.3),
    new THREE.Vector3(13.8, 0.3, 7.3)
  );

  // Building Height (11.00 m)
  addDimensionLine(
    new THREE.Vector3(13.8, 0, 8.5),
    new THREE.Vector3(13.8, 11.0, 8.5)
  );

  dimensionGroup.visible = false;

  // Step-by-step stage controller
  const updateStage = (stage: string, stageProgress: number, isCompleted: boolean) => {
    if (isCompleted || stage === 'PROPERTY') {
      // Stage 7 / Finished: Full completed architectural building
      bimGroup.visible = true;
      partNodes.forEach(node => {
        node.mesh.visible = true;
        node.wire.visible = false;
        node.mesh.position.y = node.targetY;
        node.mesh.scale.set(1, 1, 1);
        (node.mesh.material as THREE.MeshStandardMaterial).opacity = node.defaultOpacity;
        (node.mesh.material as THREE.MeshStandardMaterial).depthWrite = true;
      });
      dimensionGroup.visible = true;
      return;
    }

    if (stage === 'PHOTOGRAMMETRY' || stage === 'LIDAR') {
      // Stage 1 & 2: At start nothing of the building!
      // Only the point clouds forming on left and right side with the drone!
      bimGroup.visible = false;
      dimensionGroup.visible = false;
      return;
    }

    bimGroup.visible = true;

    if (stage === 'FUSION') {
      // Stage 3: FUSION
      // As left RGB cloud and right LiDAR cloud fuse into center,
      // a subtle unified reference blueprint silhouette begins to form at center
      const ghostOpacity = 0.04 + (stageProgress / 100) * 0.08;
      partNodes.forEach(node => {
        node.mesh.visible = true;
        node.wire.visible = false;
        node.mesh.position.y = node.targetY;
        node.mesh.scale.set(1, 1, 1);
        (node.mesh.material as THREE.MeshStandardMaterial).opacity = ghostOpacity;
        (node.mesh.material as THREE.MeshStandardMaterial).depthWrite = false;
      });
      dimensionGroup.visible = false;
    } else if (stage === 'MESH' || stage === 'BUILDING') {
      // Stage 4 / 5: 3D SEMANTIC SEGMENTATION PROCESS
      // Display parts in distinct semantic class colors with structural wireframes
      const semanticColorMap: Record<string, number> = {
        GROUND: 0x7b9181,
        WALL: 0x76b7c5,
        FLOOR: 0xbea879,
        ROOF: 0x8797cb,
        WINDOW: 0x8ac8b6,
        DOOR: 0xe3b574,
        AC: 0xc995a6,
        BALCONY: 0xa9bb83,
        STRUCTURE: 0xa1aeb8
      };

      const p = stageProgress / 100;
      partNodes.forEach((node, idx) => {
        const offset = idx / partNodes.length;
        const partProgress = THREE.MathUtils.clamp(p * 1.35 - offset * 0.35, 0, 1);

        node.mesh.visible = true;
        node.wire.visible = true;

        const semColor = semanticColorMap[node.semanticClass] ?? 0x76b7c5;
        (node.mesh.material as THREE.MeshStandardMaterial).color.setHex(semColor);

        if (partProgress <= 0) {
          node.mesh.position.y = node.targetY;
          node.wire.position.y = node.targetY;
          node.mesh.scale.set(1, 1, 1);
          (node.mesh.material as THREE.MeshStandardMaterial).opacity = 0.12;
          (node.mesh.material as THREE.MeshStandardMaterial).depthWrite = false;
        } else if (partProgress < 1) {
          const rise = (1 - partProgress) * 0.45;
          node.mesh.position.y = node.targetY - rise;
          node.wire.position.y = node.targetY - rise;
          const scaleY = 0.3 + partProgress * 0.7;
          node.mesh.scale.set(1, scaleY, 1);
          (node.mesh.material as THREE.MeshStandardMaterial).opacity = 0.25 + partProgress * 0.65;
          (node.mesh.material as THREE.MeshStandardMaterial).depthWrite = true;
        } else {
          node.mesh.position.y = node.targetY;
          node.wire.position.y = node.targetY;
          node.mesh.scale.set(1, 1, 1);
          (node.mesh.material as THREE.MeshStandardMaterial).opacity = 0.90;
          (node.mesh.material as THREE.MeshStandardMaterial).depthWrite = true;
        }
      });
      dimensionGroup.visible = false;
    } else if (stage === 'FLOORS') {
      // Stage 6: FLOOR-BY-FLOOR PART SEPARATION
      // Show parts separated level by level after segmentation
      partNodes.forEach(node => {
        node.mesh.visible = true;
        node.wire.visible = false;
        node.mesh.position.y = node.targetY;
        node.wire.position.y = node.targetY;
        node.mesh.scale.set(1, 1, 1);
        (node.mesh.material as THREE.MeshStandardMaterial).opacity = node.defaultOpacity;
        (node.mesh.material as THREE.MeshStandardMaterial).depthWrite = true;
      });
      dimensionGroup.visible = true;
    }
  };

  return {
    bimGroup,
    wireframeGroup,
    dimensionGroup,
    updateStage,
    partsCount: partNodes.length
  };
}

// 8. 10 STRATA VOLUMETRIC UNITS (Fitting INSIDE the 3 building floors — None on the roof!)
export function createStrataPropertyUnits() {
  const strataGroup = new THREE.Group();

  const unitDefs = [
    // Floor 0 (Ground Level: Y = 1.7m, 3 Units)
    { id: 'Unit 001', floor: 0, x: -8.2, z: 0, w: 8.0, h: 2.95, d: 13.5, color: 0x0284c7 },
    { id: 'Unit 002', floor: 0, x: 0, z: 0, w: 7.6, h: 2.95, d: 13.5, color: 0x059669 },
    { id: 'Unit 003', floor: 0, x: 8.2, z: 0, w: 8.0, h: 2.95, d: 13.5, color: 0xd97706 },

    // Floor 1 (First Floor: Y = 5.1m, 4 Units)
    { id: 'Unit 101', floor: 1, x: -6.2, z: -3.4, w: 12.0, h: 2.95, d: 6.5, color: 0x7c3aed },
    { id: 'Unit 102', floor: 1, x: -6.2, z: 3.4, w: 12.0, h: 2.95, d: 6.5, color: 0xe11d48 },
    { id: 'Unit 103', floor: 1, x: 6.2, z: -3.4, w: 12.0, h: 2.95, d: 6.5, color: 0x2563eb },
    { id: 'Unit 104', floor: 1, x: 6.2, z: 3.4, w: 12.0, h: 2.95, d: 6.5, color: 0x16a34a },

    // Floor 2 (Second Floor: Y = 8.5m, 3 Units)
    { id: 'Unit 201', floor: 2, x: -8.2, z: 0, w: 8.0, h: 2.95, d: 13.5, color: 0xdc2626 },
    { id: 'Unit 202', floor: 2, x: 0, z: 0, w: 7.6, h: 2.95, d: 13.5, color: 0x0d9488 },
    { id: 'Unit 203', floor: 2, x: 8.2, z: 0, w: 8.0, h: 2.95, d: 13.5, color: 0x9333ea }
  ];

  unitDefs.forEach((u) => {
    const uGroup = new THREE.Group();
    const posY = u.floor * 3.4 + 1.7;

    const uGeo = new THREE.BoxGeometry(u.w, u.h, u.d);
    const uMat = new THREE.MeshStandardMaterial({
      color: u.color,
      transparent: true,
      opacity: 0.55,
      metalness: 0.2,
      roughness: 0.2
    });
    const uMesh = new THREE.Mesh(uGeo, uMat);
    uMesh.position.set(u.x, posY, u.z);
    uMesh.castShadow = true;
    uGroup.add(uMesh);

    const edgesGeo = new THREE.EdgesGeometry(uGeo);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1.5 });
    const edgesLine = new THREE.LineSegments(edgesGeo, edgesMat);
    edgesLine.position.set(u.x, posY, u.z);
    uGroup.add(edgesLine);

    // Floating white 3D centroid marker
    const centGeo = new THREE.OctahedronGeometry(0.24);
    const centMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const centMesh = new THREE.Mesh(centGeo, centMat);
    centMesh.position.set(u.x, posY, u.z);
    uGroup.add(centMesh);

    strataGroup.add(uGroup);
  });

  return { strataGroup, totalUnits: unitDefs.length, units: unitDefs };
}
