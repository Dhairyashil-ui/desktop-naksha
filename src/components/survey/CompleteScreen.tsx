import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Check, ArrowRight, Eye } from 'lucide-react';
import { AssignedParcel } from '../../services/surveyApi';

interface CompleteScreenProps {
  parcel: AssignedParcel;
  baseUlpin: string;
  ulpin3d: string;
  onViewPropertyCard: () => void;
  onDone: () => void;
}

export const CompleteScreen: React.FC<CompleteScreenProps> = ({
  parcel,
  baseUlpin,
  ulpin3d,
  onViewPropertyCard,
  onDone
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Subtle 3D Apartment / Building wireframe background
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(24, 18, 28);
    camera.lookAt(0, 5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.replaceChildren(renderer.domElement);

    // Subtle Ground Grid
    const grid = new THREE.GridHelper(30, 30, 0xf4f4f5, 0xfafafa);
    scene.add(grid);

    // Subtle 3D Strata Unit Volume
    const bldgBox = new THREE.BoxGeometry(10, 14, 12);
    const bldgMesh = new THREE.Mesh(
      bldgBox,
      new THREE.MeshBasicMaterial({ color: 0xf4f4f5, transparent: true, opacity: 0.5, wireframe: true })
    );
    bldgMesh.position.y = 7;
    scene.add(bldgMesh);

    // Highlighted Unit Volume (Unit 302)
    const unitBox = new THREE.BoxGeometry(4.8, 3.2, 5.8);
    const unitMesh = new THREE.Mesh(
      unitBox,
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.15 })
    );
    unitMesh.position.set(-2.5, 9, -2.8);
    scene.add(unitMesh);

    const unitEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(unitBox),
      new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 1.5 })
    );
    unitEdges.position.set(-2.5, 9, -2.8);
    scene.add(unitEdges);

    // Ambient light
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));

    // Slow architectural auto-rotation
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      scene.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full bg-white text-zinc-900 flex flex-col justify-between font-sans select-none overflow-hidden relative">
      {/* Background Subtle 3D Canvas */}
      <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 w-full p-8 flex items-center justify-between text-xs font-mono text-zinc-400">
        <span>CADASTRAL SURVEY COMPLETED</span>
        <span>SURVEY NO. {parcel.surveyNumber}/{parcel.subDivision}</span>
      </div>

      {/* Main Centered Box */}
      <div className="relative z-10 w-full max-w-md mx-auto my-auto py-8 text-center font-mono space-y-8 bg-white/80 backdrop-blur-xs p-8 rounded-3xl border border-zinc-200/80 shadow-lg">
        {/* Verification Checkmark */}
        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-white shadow-sm">
          <Check className="w-6 h-6" />
        </div>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 uppercase">
            PROJECT COMPLETE
          </h1>
          <p className="text-xs text-zinc-500">
            3D Cadastral Demarcation successfully finalized and persisted.
          </p>
        </div>

        {/* ULPIN Identifiers */}
        <div className="space-y-3 text-left">
          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">2D ULPIN</span>
              <span className="font-bold text-zinc-900 text-sm">{baseUlpin}</span>
            </div>
            <span className="text-[10px] bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded font-bold uppercase">
              Parcel
            </span>
          </div>

          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">3D ULPIN</span>
              <span className="font-bold text-blue-600 text-sm">{ulpin3d}</span>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase">
              Strata Space
            </span>
          </div>
        </div>

        {/* Buttons: [ VIEW PROPERTY CARD ] and [ DONE ] */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onViewPropertyCard}
            className="w-full py-3 px-5 rounded-xl border border-zinc-300 hover:border-zinc-900 text-zinc-800 text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center space-x-2"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>[ VIEW PROPERTY CARD ]</span>
          </button>

          <button
            onClick={onDone}
            className="w-full py-3.5 px-6 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold tracking-widest uppercase transition-all shadow-md flex items-center justify-center space-x-2 active:scale-98"
          >
            <span>[ DONE ]</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 w-full text-center text-[11px] font-mono text-zinc-400 p-4">
        Ready for Next Survey Task • ISO 19152 Cadastral Authority Registered
      </div>
    </div>
  );
};
