import React, { useState, useEffect, useRef } from 'react';
import { Layers, Box, Compass, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import * as THREE from 'three';

export const Viewport2D3D: React.FC = () => {
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const threeMountRef = useRef<HTMLDivElement>(null);

  // 3D Three.js Point Cloud & Terrain Scene Lifecycle
  useEffect(() => {
    if (viewMode !== '3D' || !threeMountRef.current) return;

    const width = threeMountRef.current.clientWidth;
    const height = threeMountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(40, 35, 50);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    threeMountRef.current.replaceChildren(renderer.domElement);

    // Create 3D Ground Mesh Grid (Digital Elevation Model simulation)
    const gridHelper = new THREE.GridHelper(60, 30, 0x2563eb, 0x1e293b);
    gridHelper.position.y = -2;
    scene.add(gridHelper);

    // Create Simulated LiDAR Point Cloud (15,000 points with elevation gradient)
    const pointCount = 15000;
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);

    for (let i = 0; i < pointCount; i++) {
      const x = (Math.random() - 0.5) * 50;
      const z = (Math.random() - 0.5) * 50;
      const y = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 6 + (Math.random() - 0.5) * 0.8;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color by elevation: blue -> green -> yellow -> red
      const normY = (y + 6) / 12;
      colors[i * 3] = Math.min(1.0, normY * 1.5);
      colors[i * 3 + 1] = Math.max(0.1, 1.0 - Math.abs(normY - 0.5) * 2);
      colors[i * 3 + 2] = Math.max(0.1, 1.0 - normY * 1.5);
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pointMaterial = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    const pointCloud = new THREE.Points(pointGeometry, pointMaterial);
    scene.add(pointCloud);

    // Simulated 3D Building Extrusion (BIM / Cadastre)
    const bldgGeom = new THREE.BoxGeometry(8, 12, 12);
    const bldgMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const bldgMesh = new THREE.Mesh(bldgGeom, bldgMat);
    bldgMesh.position.set(0, 4, 0);
    scene.add(bldgMesh);

    // Animation loop (slow gentle rotation for 3D inspection)
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      scene.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!threeMountRef.current) return;
      const w = threeMountRef.current.clientWidth;
      const h = threeMountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      pointGeometry.dispose();
      pointMaterial.dispose();
    };
  }, [viewMode]);

  return (
    <div className="relative w-full h-full bg-naksha-darkest overflow-hidden border-b border-naksha-border">
      {/* View Mode Toggle Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center bg-slate-900/80 backdrop-blur-md rounded-lg p-1 border border-slate-700/60 shadow-xl">
        <button
          onClick={() => setViewMode('2D')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            viewMode === '2D'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>2D MapLibre Cadastre</span>
        </button>
        <button
          onClick={() => setViewMode('3D')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            viewMode === '3D'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D Three.js Point Cloud & BIM</span>
        </button>
      </div>

      {/* Floating Spatial Toolbar */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2 bg-slate-900/80 backdrop-blur-md rounded-lg p-1.5 border border-slate-700/60 shadow-xl">
        <button title="Orient North" className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800">
          <Compass className="w-4 h-4" />
        </button>
        <button title="Zoom In" className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button title="Zoom Out" className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button title="Fit Bounds" className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* 2D Canvas View (MapLibre vector cadastre representation) */}
      {viewMode === '2D' ? (
        <div className="w-full h-full relative flex items-center justify-center bg-[#090D16]">
          {/* Simulated Vector Cadastral Overlay */}
          <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 1000 600">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Cadastral Parcels with ULPIN Labels */}
            <g stroke="#3B82F6" strokeWidth="1.5" fill="rgba(59, 130, 246, 0.08)">
              {/* Parcel 101 */}
              <polygon points="220,140 440,120 460,260 210,290" />
              <text x="310" y="200" fill="#93C5FD" fontSize="11" fontFamily="monospace" textAnchor="middle">
                ULPIN: 27-24-004-101
              </text>
              <text x="310" y="215" fill="#60A5FA" fontSize="9" fontFamily="sans-serif" textAnchor="middle">
                Survey No. 45/1A • 1.24 Ha
              </text>

              {/* Parcel 102 */}
              <polygon points="440,120 680,110 710,250 460,260" fill="rgba(16, 185, 129, 0.08)" stroke="#10B981" />
              <text x="560" y="180" fill="#6EE7B7" fontSize="11" fontFamily="monospace" textAnchor="middle">
                ULPIN: 27-24-004-102
              </text>
              <text x="560" y="195" fill="#34D399" fontSize="9" fontFamily="sans-serif" textAnchor="middle">
                Survey No. 45/1B • 1.68 Ha
              </text>

              {/* Parcel 103 */}
              <polygon points="210,290 460,260 480,440 180,420" />
              <text x="320" y="350" fill="#93C5FD" fontSize="11" fontFamily="monospace" textAnchor="middle">
                ULPIN: 27-24-004-103
              </text>

              {/* Parcel 104 */}
              <polygon points="460,260 710,250 740,430 480,440" />
              <text x="580" y="340" fill="#93C5FD" fontSize="11" fontFamily="monospace" textAnchor="middle">
                ULPIN: 27-24-004-104
              </text>
            </g>

            {/* Ground Control Points (GCPs) */}
            <g>
              <circle cx="220" cy="140" r="5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
              <text x="230" y="135" fill="#FCA5A5" fontSize="10" fontFamily="monospace">GCP_01</text>

              <circle cx="680" cy="110" r="5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
              <text x="690" y="105" fill="#FCA5A5" fontSize="10" fontFamily="monospace">GCP_02</text>

              <circle cx="480" cy="440" r="5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
              <text x="490" y="455" fill="#FCA5A5" fontSize="10" fontFamily="monospace">GCP_03</text>
            </g>
          </svg>

          {/* Scale & Coordinate HUD */}
          <div className="absolute bottom-4 left-4 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
            N 18°31'24.8" E 73°51'19.2" • Elevation: 564.2m MSL
          </div>
        </div>
      ) : (
        /* 3D WebGL Canvas (Three.js point cloud container) */
        <div ref={threeMountRef} className="w-full h-full relative cursor-grab active:cursor-grabbing">
          {/* HUD Overlay for 3D View */}
          <div className="absolute bottom-4 left-4 z-10 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800 flex items-center space-x-3">
            <span className="text-blue-400 font-bold">15,000 Pts Rendered</span>
            <span>•</span>
            <span>Shading: Elevation (Z)</span>
            <span>•</span>
            <span className="text-emerald-400">60.0 FPS</span>
          </div>
        </div>
      )}
    </div>
  );
};
