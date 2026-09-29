import React, { useState } from 'react';
import { 
  ArrowLeft, 
  RotateCcw, 
  Maximize2,
  Minimize2,
  FileCheck2,
  CheckCircle2
} from 'lucide-react';
import { Property3DViewer, PropertyUnit3D } from './Property3DViewer';

interface Property3DLayerScreenProps {
  projectName?: string;
  onBack: () => void;
  onOpenProcessing?: () => void;
  onOpenCanonicalModel?: () => void;
}

// Generate the 64 units across 8 floors with precise georeferenced coordinates
const ALL_UNITS: PropertyUnit3D[] = (() => {
  const result: PropertyUnit3D[] = [];
  const owners = [
    'Rajesh M. Patil', 'Sunita R. Kulkarni', 'Amit V. Deshmukh', 'Pooja S. Joshi',
    'Vikram H. Shinde', 'Anjali N. Pawar', 'Suresh T. Gaikwad', 'Meena K. Bhosale'
  ];

  const baseX = 385430.00;
  const baseY = 2048165.00;
  const baseZ = 542.15;

  for (let f = 1; f <= 8; f++) {
    for (let u = 1; u <= 8; u++) {
      const unitNum = f * 100 + u;
      const ux = (u - 1) % 2;
      const uz = Math.floor((u - 1) / 2);

      // Coordinate calculation
      const x = Number((baseX + (ux - 0.5) * 7.5 + (u === 2 ? 1.67 : 0)).toFixed(2));
      const y = Number((baseY + (uz - 1.5) * 4.2 + (u === 2 ? -1.02 : 0)).toFixed(2));
      const z = Number((baseZ + f * 1.5).toFixed(2));

      // Benchmark Unit 302 exact prompt alignment:
      // Floor: 3, Area: 84.50 m², X: 385435.42, Y: 2048168.18, Z: 546.65
      const finalX = unitNum === 302 ? 385435.42 : x;
      const finalY = unitNum === 302 ? 2048168.18 : y;
      const finalZ = unitNum === 302 ? 546.65 : z;

      const unitLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const uLetter = unitLetters[(u - 1) % unitLetters.length];
      const unitAlias = `Flat ${uLetter}`;
      const clearH = 3.65;
      const volM3 = Number((84.50 * clearH).toFixed(2));

      // 2D Footprint SVG path preview
      const svgPaths: Record<string, string> = {
        'A': 'M 10 10 L 110 10 L 110 65 L 85 65 L 85 90 L 10 90 Z',
        'B': 'M 10 10 L 35 10 L 35 35 L 110 35 L 110 90 L 10 90 Z',
        'C': 'M 10 10 L 85 10 L 110 35 L 110 90 L 10 90 Z',
        'D': 'M 10 10 L 110 10 L 110 70 L 75 70 L 75 90 L 10 90 Z',
      };
      const svgPath = svgPaths[uLetter] || svgPaths['A'];

      result.push({
        id: `UNIT-${unitNum}`,
        unitNumber: `${unitNum}`,
        unitAlias,
        unitName: `Flat ${uLetter} (Unit ${unitNum})`,
        unitType: `${uLetter === 'B' || uLetter === 'D' ? '3BHK Executive' : '2BHK Luxury'} Suite`,
        floor: f,
        areaSqM: 84.50,
        volumeM3: volM3,
        clearHeightM: clearH,
        minZ: finalZ - clearH / 2,
        maxZ: finalZ + clearH / 2,
        x: finalX,
        y: finalY,
        z: finalZ,
        twoDParcel: '142/B (MH-PUN-0942)',
        recordStatus: 'Matched',
        status: 'VERIFIED',
        ownerName: unitNum === 302 ? 'Sunita R. Kulkarni' : owners[(u - 1) % owners.length],
        ctsNumber: `CTS 142/B-${unitNum}`,
        ulpin: `MH-PUN-2026-0942-${unitNum}`,
        undividedLandSharePct: 1.5625,
        structuredIdentity: {
          base_ulpin: '27-07-005-012345',
          floor_id: `F${f < 10 ? '0' + f : f}`,
          unit_id: uLetter,
          volume_id: `VOL_27-07-005-012345_F${f < 10 ? '0' + f : f}_${uLetter}`,
          property_id_3d: `PROP3D_27-07-005-012345_F${f < 10 ? '0' + f : f}_${uLetter}`,
          display_ulpin_3d: `27-07-005-012345-F${f < 10 ? '0' + f : f}-${uLetter}`
        },
        footprint2D: {
          polygon: [[finalX - 3.5, finalY - 2.0], [finalX + 3.5, finalY - 2.0], [finalX + 3.5, finalY + 1.2], [finalX + 2.2, finalY + 1.2], [finalX + 2.2, finalY + 2.0], [finalX - 3.5, finalY + 2.0]],
          perimeter_m: 21.6,
          area_sqm: 84.50,
          svg_path: svgPath
        },
        geometry3D: {
          is_watertight: true,
          volume_m3: volM3,
          vertex_count: 12,
          face_count: 20
        },
        associatedParcel: {
          parcel_id: 'CTS 142/B (Survey No. 48/2)',
          ulpin: `MH-PUN-2026-0942-${unitNum}`,
          village: 'Haveli, Pune Suburban',
          total_parcel_area_sqm: 1600.00,
          undivided_land_share_pct: 1.5625
        },
        associatedGovernmentRecord: {
          document_number: `MH-PUN-HAV-2026-${unitNum}`,
          record_type: 'Index II / 7-12 RoR Extract (MahaRERA)',
          cts_number: `CTS 142/B-${unitNum}`,
          owner_name: unitNum === 302 ? 'Sunita R. Kulkarni' : owners[(u - 1) % owners.length],
          registered_carpet_area_sqm: 84.50,
          registration_date: '2026-04-12',
          encumbrance: 'CLEAR',
          match_status: 'VERIFIED_MATCHED'
        }
      });
    }
  }
  return result;
})();

export const Property3DLayerScreen: React.FC<Property3DLayerScreenProps> = ({
  projectName = 'Pune Residential 001',
  onBack,
  onOpenProcessing,
  onOpenCanonicalModel
}) => {
  // Defaults to UNIT 302 as requested in the user prompt!
  const [selectedUnitNum, setSelectedUnitNum] = useState<string>('302');
  const [isolatedFloor, setIsolatedFloor] = useState<number | null>(null);
  const [isExploded, setIsExploded] = useState<boolean>(false);
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(false);

  const selectedUnit = ALL_UNITS.find(u => u.unitNumber === selectedUnitNum) || ALL_UNITS[17]; // Unit 302

  const handleUnitClick = (unitNum: string) => {
    setSelectedUnitNum(unitNum);
  };

  const floorsList = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="h-screen max-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-4 px-8 font-sans select-none overflow-hidden">
      {/* Top Bar: Minimal Navigation & Meta */}
      <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-3">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Inputs</span>
          </button>
          <span className="text-zinc-300">•</span>
          {onOpenProcessing && (
            <button
              onClick={onOpenProcessing}
              className="hover:text-zinc-900 transition-colors font-mono"
            >
              Processing 3D &rarr;
            </button>
          )}
          {onOpenCanonicalModel && (
            <>
              <span className="text-zinc-300">•</span>
              <button
                onClick={onOpenCanonicalModel}
                className="hover:text-zinc-900 transition-colors font-mono"
              >
                Canonical Model &rarr;
              </button>
            </>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <span className="font-mono text-zinc-400 text-xs font-medium">
            {projectName}
          </span>
          <span className="text-zinc-300">•</span>
          <span className="font-mono tracking-[0.2em] font-semibold text-zinc-400">
            NAKSHA 2.0
          </span>
        </div>
      </div>

      {/* Main Three-Column Layout */}
      <div className="w-full flex-1 flex items-stretch justify-between gap-8 my-auto">
        {/* ================= LEFT COLUMN: BUILDING & FLOOR/UNIT HIERARCHY ================= */}
        <div className="w-64 flex flex-col justify-between py-2 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase mb-4">
              BUILDING
            </div>

            {/* Tree View of Floors and Units */}
            <div className="flex-1 overflow-y-auto space-y-4 font-mono text-xs pr-2">
              {floorsList.map(floorNum => {
                const floorUnits = ALL_UNITS.filter(u => u.floor === floorNum);
                const isFloorActive = isolatedFloor === floorNum;

                return (
                  <div key={floorNum} className="space-y-1">
                    {/* Floor Label */}
                    <div 
                      onClick={() => setIsolatedFloor(isolatedFloor === floorNum ? null : floorNum)}
                      className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition-colors ${
                        isFloorActive 
                          ? 'bg-zinc-100 text-zinc-900 font-bold' 
                          : 'text-zinc-700 hover:text-zinc-900 font-semibold'
                      }`}
                    >
                      <span>Floor {floorNum}</span>
                      <span className="text-[10px] text-zinc-400 font-normal">
                        {isFloorActive ? 'Isolated' : '8 units'}
                      </span>
                    </div>

                    {/* Box-drawing Branch Units */}
                    <div className="space-y-0.5 pl-2">
                      {floorUnits.slice(0, 4).map((u, idx) => {
                        const isSelected = selectedUnitNum === u.unitNumber;
                        const isLastInPreview = idx === 3;

                        return (
                          <div
                            key={u.unitNumber}
                            onClick={() => handleUnitClick(u.unitNumber)}
                            className={`flex items-center space-x-1.5 py-0.5 px-2 rounded cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-zinc-900 text-white font-bold'
                                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                            }`}
                          >
                            <span className="text-zinc-400 select-none">
                              {isLastInPreview ? '└──' : '├──'}
                            </span>
                            <span className="tracking-wide">Unit {u.unitNumber}</span>
                          </div>
                        );
                      })}

                      {/* Ellipsis / More units indicator */}
                      <div 
                        onClick={() => handleUnitClick(`${floorNum}05`)}
                        className="flex items-center space-x-1.5 py-0.5 px-2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                      >
                        <span className="select-none">└──</span>
                        <span className="text-[10px] tracking-tight">... +4 more units</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ================= CENTER COLUMN: REAL 3D VIEWPORT ================= */}
        <div className="flex-1 flex flex-col items-center justify-between py-1">
          {/* Header Tag */}
          <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase text-center mb-2">
            REAL 3D PROPERTY LAYER
          </div>

          {/* Subtitle Status */}
          <div className="text-xs font-mono text-zinc-500 mb-3 flex items-center space-x-2">
            <span>64 Cadastral Strata Units</span>
            <span className="text-zinc-300">•</span>
            <span>Watertight 3D Geometry</span>
            <span className="text-zinc-300">•</span>
            <span>Click any unit to inspect</span>
          </div>

          {/* 3D Viewport Window */}
          <div className="w-full flex-1 min-h-[440px] max-h-[560px] rounded-2xl border border-zinc-100 bg-white relative overflow-hidden flex items-center justify-center">
            <Property3DViewer
              units={ALL_UNITS}
              selectedUnitId={selectedUnitNum}
              onSelectUnit={(u) => setSelectedUnitNum(u.unitNumber)}
              isolatedFloor={isolatedFloor}
              isExploded={isExploded}
              autoRotate={isAutoRotate}
            />

            {/* Bottom Floating Control Bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-zinc-200/80 rounded-full px-4 py-1.5 shadow-sm flex items-center space-x-2.5 text-xs text-zinc-600">
              {/* Floor Isolator Dropdown / Pills */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsolatedFloor(null)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                    isolatedFloor === null ? 'bg-zinc-900 text-white font-bold' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  All Floors
                </button>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(f => (
                  <button
                    key={f}
                    onClick={() => setIsolatedFloor(isolatedFloor === f ? null : f)}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                      isolatedFloor === f ? 'bg-zinc-900 text-white font-bold' : 'text-zinc-400 hover:text-zinc-800'
                    }`}
                  >
                    F{f}
                  </button>
                ))}
              </div>

              <div className="h-3 w-px bg-zinc-200" />

              {/* Exploded View Toggle */}
              <button
                onClick={() => setIsExploded(!isExploded)}
                title={isExploded ? 'Collapse Floor Slabs' : 'Explode Floor Slabs Vertically'}
                className={`flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  isExploded ? 'bg-blue-600 text-white font-bold' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {isExploded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                <span>Explode</span>
              </button>

              <div className="h-3 w-px bg-zinc-200" />

              {/* Auto-Rotate Toggle */}
              <button
                onClick={() => setIsAutoRotate(!isAutoRotate)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  isAutoRotate ? 'bg-zinc-100 text-zinc-900 font-semibold' : 'text-zinc-400 hover:text-zinc-700'
                }`}
              >
                360°
              </button>

              <div className="h-3 w-px bg-zinc-200" />

              {/* Reset to Unit 302 */}
              <button
                onClick={() => {
                  setSelectedUnitNum('302');
                  setIsolatedFloor(null);
                  setIsExploded(false);
                }}
                title="Reset to Unit 302"
                className="hover:text-zinc-900 transition-colors p-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: CLICKING A UNIT CARD (STEP 28) ================= */}
        <div className="w-80 flex flex-col justify-start py-1 pl-2 overflow-y-auto max-h-[640px]">
          {/* Exact User Prompt Card Architecture */}
          <div className="p-4 border border-zinc-200/90 rounded-2xl bg-white shadow-xs space-y-3 font-mono text-xs">
            {/* Title: FLAT A / UNIT 302 */}
            <div className="pb-2 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <div className="text-base font-bold tracking-tight text-zinc-900">
                  {selectedUnit.unitAlias?.toUpperCase() || 'FLAT A'} • UNIT {selectedUnit.unitNumber}
                </div>
                <div className="text-[10px] text-zinc-400 font-sans">
                  {selectedUnit.unitType || '2BHK Luxury Suite'}
                </div>
              </div>
              <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0" />
            </div>

            {/* 3D Property Identity (ULPIN-3D) - Step 29 & Step 30 */}
            <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-xl p-2.5 space-y-1">
              <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center justify-between">
                <span>3D PROPERTY IDENTITY</span>
                <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-mono font-bold">ULPIN-3D</span>
              </div>
              <div className="text-xs font-bold font-mono text-blue-950 tracking-tight">
                {selectedUnit.structuredIdentity?.display_ulpin_3d || `27-07-005-012345-F0${selectedUnit.floor}-${selectedUnit.unitAlias?.replace('Flat ', '') || 'A'}`}
              </div>
              <div className="text-[10px] text-blue-800/80 font-mono flex items-center justify-between pt-1 border-t border-blue-200/60">
                <span>Base 2D: <span className="font-semibold text-blue-900">27-07-005-012345</span></span>
                <span>F0{selectedUnit.floor} • {selectedUnit.unitAlias}</span>
              </div>
            </div>

            {/* 1. 2D Footprint Section */}
            <div className="bg-zinc-50 rounded-xl p-2.5 border border-zinc-100 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <span>2D FOOTPRINT</span>
                <span className="text-blue-600 font-semibold">{selectedUnit.areaSqM.toFixed(2)} m²</span>
              </div>
              {/* SVG 2D Footprint Mini-Canvas */}
              <div className="w-full h-20 bg-white rounded-lg border border-zinc-200/80 flex items-center justify-center p-1 relative overflow-hidden">
                <svg viewBox="0 0 120 100" className="w-full h-full stroke-blue-600 fill-blue-50/70 stroke-[2.5]">
                  <path d={selectedUnit.footprint2D?.svg_path || 'M 10 10 L 110 10 L 110 65 L 85 65 L 85 90 L 10 90 Z'} />
                  {/* Dimension labels inside footprint */}
                  <text x="50" y="52" className="text-[9px] fill-zinc-500 font-mono stroke-none text-anchor-middle">
                    {selectedUnit.areaSqM.toFixed(1)} m²
                  </text>
                </svg>
                <div className="absolute bottom-1 right-2 text-[9px] text-zinc-400">
                  Perimeter: {selectedUnit.footprint2D?.perimeter_m || 21.6}m
                </div>
              </div>
            </div>

            {/* 2. 3D Volume Section */}
            <div className="bg-blue-50/40 rounded-xl p-2.5 border border-blue-100/60 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                <span>3D VOLUME</span>
                <span className="font-bold text-blue-900">{selectedUnit.volumeM3 || 308.43} m³</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Clear Height:</span>
                <span className="font-semibold text-zinc-800">{selectedUnit.clearHeightM || 3.65} m</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">Solid B-Rep:</span>
                <span className="font-semibold text-emerald-600">✓ Watertight Mesh</span>
              </div>
            </div>

            {/* 3. Floor & Elevation */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Floor:</span>
                <span className="font-semibold text-zinc-900">Floor {selectedUnit.floor}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Slab Z Range:</span>
                <span className="font-semibold text-zinc-700">
                  {(selectedUnit.minZ || selectedUnit.z - 1.82).toFixed(2)}m .. {(selectedUnit.maxZ || selectedUnit.z + 1.83).toFixed(2)}m
                </span>
              </div>
            </div>

            {/* 4. XYZ Geodetic Coordinates */}
            <div className="pt-2 border-t border-zinc-100 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">XYZ CENTROID (UTM 43N):</div>
              <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold text-zinc-800 bg-zinc-50 p-1.5 rounded-lg text-center">
                <div><span className="text-[9px] text-zinc-400 font-normal">X: </span>{selectedUnit.x.toFixed(1)}</div>
                <div><span className="text-[9px] text-zinc-400 font-normal">Y: </span>{selectedUnit.y.toFixed(1)}</div>
                <div><span className="text-[9px] text-zinc-400 font-normal">Z: </span>{selectedUnit.z.toFixed(2)}</div>
              </div>
            </div>

            {/* 5. Associated Parcel */}
            <div className="pt-2 border-t border-zinc-100 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">ASSOCIATED PARCEL:</div>
              <div className="font-semibold text-zinc-900 text-xs">
                {selectedUnit.associatedParcel?.parcel_id || selectedUnit.twoDParcel}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>ULPIN: {selectedUnit.ulpin}</span>
                <span>Share: {selectedUnit.undividedLandSharePct}%</span>
              </div>
            </div>

            {/* 6. Associated Government Record */}
            <div className="pt-2 border-t border-zinc-100 space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">GOVERNMENT RECORD:</div>
              <div className="text-xs font-semibold text-zinc-800 truncate">
                {selectedUnit.ownerName}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>{selectedUnit.associatedGovernmentRecord?.document_number || `DEED-2026-${selectedUnit.unitNumber}`}</span>
                <span className="font-semibold text-blue-600">{selectedUnit.recordStatus}</span>
              </div>
            </div>

            {/* Status Section */}
            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 uppercase">STATUS</span>
              <div className="flex items-center space-x-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>✓ {selectedUnit.status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="w-full text-center text-[11px] font-mono text-zinc-400 pt-3">
        Phase 16 • 3D Property Layer • Floor & Unit Strata Demarcation • Mahabhulekh 7/12 Title Matched
      </div>
    </div>
  );
};
