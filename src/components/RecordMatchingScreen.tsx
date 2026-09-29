import React, { useState } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Building2, 
  FileText 
} from 'lucide-react';
import { UnitRecordMatchData, AttributeCheckItem } from '../types/record_matching';

interface RecordMatchingScreenProps {
  projectName?: string;
  onBack: () => void;
  onOpenProperty3D?: () => void;
  onOpenCanonicalModel?: () => void;
}

// Seed catalog for 64 units with realistic matching data
const generateCatalog = (): UnitRecordMatchData[] => {
  const list: UnitRecordMatchData[] = [];
  const owners = [
    'Rajesh M. Patil', 'Sunita R. Kulkarni', 'Amit V. Deshmukh', 'Pooja S. Joshi',
    'Vikram H. Shinde', 'Anjali N. Pawar', 'Suresh T. Gaikwad', 'Meena K. Bhosale'
  ];

  for (let f = 1; f <= 8; f++) {
    for (let u = 1; u <= 8; u++) {
      const unitNum = `${f * 100 + u}`;
      const ux = (u - 1) % 2;
      const uz = Math.floor((u - 1) / 2);

      let area = 84.50;
      let recordedArea = 84.50;
      let deedFloor = f;
      const owner = unitNum === '302' ? 'Sunita R. Kulkarni' : owners[(u - 1) % owners.length];

      let isMatched = true;
      let mismatchReason: string | undefined = undefined;

      // Intentional Cadastral Audit Case 1: Unit 504 (Encroachment)
      if (unitNum === '504') {
        area = 98.20; // 3D surveyed area is 98.20m² vs deed 84.50m²
        isMatched = false;
        mismatchReason = '3D Surveyed Area (98.20 m²) exceeds registered deed area (84.50 m²) by +16.2%, violating statutory ±1.0% tolerance.';
      }

      // Intentional Cadastral Audit Case 2: Unit 702 (Deed Floor Discrepancy)
      if (unitNum === '702') {
        deedFloor = 6; // Deed erroneously registered on Floor 6
        isMatched = false;
        mismatchReason = 'Floor level conflict: 3D model geometry sits on Floor 7, but legacy deed is indexed under Floor 6.';
      }

      const x = unitNum === '302' ? 385435.42 : Number((385430 + (ux - 0.5) * 7.5).toFixed(2));
      const y = unitNum === '302' ? 2048168.18 : Number((2048165 + (uz - 1.5) * 4.2).toFixed(2));
      const z = unitNum === '302' ? 546.65 : Number((542.15 + f * 1.5).toFixed(2));

      const areaDelta = area - recordedArea;
      const areaDeltaPct = (Math.abs(areaDelta) / recordedArea) * 100;
      const areaMatch = areaDeltaPct <= 1.0;
      const floorMatch = f === deedFloor;

      const checks: AttributeCheckItem[] = [
        {
          attributeName: 'Floor Level',
          unitValue: `Floor ${f}`,
          recordValue: `Floor ${deedFloor}`,
          isMatch: floorMatch,
          notes: floorMatch ? 'Exact vertical storey correspondence' : 'Storey mismatch in Sub-Registrar deed index'
        },
        {
          attributeName: 'Carpet Area',
          unitValue: `${area.toFixed(2)} m²`,
          recordValue: `${recordedArea.toFixed(2)} m²`,
          isMatch: areaMatch,
          delta: areaDelta === 0 ? '0.00 m² (0.0%)' : `${areaDelta > 0 ? '+' : ''}${areaDelta.toFixed(2)} m² (${areaDeltaPct.toFixed(1)}%)`,
          notes: areaMatch ? 'Within statutory ±1.0% tolerance' : 'Exceeds statutory ±1.0% tolerance (Encroachment flagged)'
        },
        {
          attributeName: '2D Parcel Boundary',
          unitValue: '142/B (MH-PUN-0942)',
          recordValue: 'Survey 142/B',
          isMatch: true,
          notes: 'Unit footprint contained within parcel demarcation'
        },
        {
          attributeName: 'Geodetic Coordinates',
          unitValue: `X:${x}, Y:${y}, Z:${z}`,
          recordValue: 'EPSG:32643 UTM 43N',
          isMatch: true,
          notes: 'Triangulation confirmed within surveyed bounds'
        },
        {
          attributeName: 'Revenue Title Record',
          unitValue: `Unit ${unitNum} Strata Solid`,
          recordValue: `CTS 142/B-${unitNum}`,
          isMatch: true,
          notes: 'Mahabhulekh 7/12 RoR record indexed'
        }
      ];

      list.push({
        unitNumber: unitNum,
        floor: f,
        isMatched,
        statusBadge: isMatched ? '✓ RECORD MATCHED' : '⚠ RECORD MISMATCH',
        unit: {
          unitNumber: unitNum,
          floor: f,
          areaSqM: area,
          x,
          y,
          z,
          geometryType: 'LoD-2.2 Watertight Solid Volume',
          twoDParcel: '142/B (MH-PUN-0942)'
        },
        record: {
          recordId: `ROR_712_MH_PUN_${unitNum}`,
          deedNumber: `MH-PUN-HAV-2026-${String(unitNum).padStart(4, '0')}`,
          ctsNumber: `CTS 142/B-${unitNum}`,
          ulpin: `MH-PUN-2026-0942-${unitNum}`,
          ownerName: owner,
          floor: deedFloor,
          recordedAreaSqM: recordedArea,
          registrationDate: '2026-04-12',
          encumbrance: 'CLEAR',
          parcel: '142/B'
        },
        checks,
        mismatchReason
      });
    }
  }
  return list;
};

export const RecordMatchingScreen: React.FC<RecordMatchingScreenProps> = ({
  projectName = 'Pune Residential 001',
  onBack,
  onOpenProperty3D,
  onOpenCanonicalModel
}) => {
  const catalog = generateCatalog();
  const [selectedUnitNum, setSelectedUnitNum] = useState<string>('302');
  const [filterMode, setFilterMode] = useState<'ALL' | 'MATCHED' | 'MISMATCH'>('ALL');

  const filteredUnits = catalog.filter(u => {
    if (filterMode === 'MATCHED') return u.isMatched;
    if (filterMode === 'MISMATCH') return !u.isMatched;
    return true;
  });

  const selectedData = catalog.find(u => u.unitNumber === selectedUnitNum) || catalog[17]; // Unit 302
  const matchedCount = catalog.filter(u => u.isMatched).length;
  const mismatchCount = catalog.length - matchedCount;

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
          {onOpenProperty3D && (
            <button
              onClick={onOpenProperty3D}
              className="hover:text-zinc-900 transition-colors font-mono"
            >
              3D Property Layer &rarr;
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

      {/* Main Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
        <div>
          <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase">
            PHASE 17 — CADASTRAL RECONCILIATION
          </div>
          <h1 className="text-xl font-bold font-mono tracking-tight text-zinc-900 mt-0.5">
            Record Matching Engine
          </h1>
          <p className="text-xs font-mono text-zinc-500 mt-0.5">
            Deterministic attribute-by-attribute reconciliation between 3D spatial units and government land revenue records.
          </p>
        </div>

        {/* Global Statistics Badges */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              filterMode === 'ALL'
                ? 'bg-zinc-900 text-white font-bold border-zinc-900'
                : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            All Units ({catalog.length})
          </button>
          <button
            onClick={() => setFilterMode('MATCHED')}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center space-x-1.5 ${
              filterMode === 'MATCHED'
                ? 'bg-emerald-600 text-white font-bold border-emerald-600'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Matched ({matchedCount})</span>
          </button>
          <button
            onClick={() => setFilterMode('MISMATCH')}
            className={`px-3 py-1.5 rounded-lg border transition-all flex items-center space-x-1.5 ${
              filterMode === 'MISMATCH'
                ? 'bg-rose-600 text-white font-bold border-rose-600'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Mismatches ({mismatchCount})</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left Selector + Center/Right Matching Dashboard */}
      <div className="w-full flex-1 flex items-stretch gap-6 overflow-hidden">
        {/* Left Column: Quick Unit Selector */}
        <div className="w-64 flex flex-col border border-zinc-200/80 rounded-2xl bg-white p-3.5 overflow-hidden">
          <div className="text-[11px] font-mono font-semibold tracking-wider text-zinc-400 uppercase mb-3 px-1">
            SELECT 3D UNIT
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
            {filteredUnits.map(item => {
              const isSelected = selectedUnitNum === item.unitNumber;

              return (
                <div
                  key={item.unitNumber}
                  onClick={() => setSelectedUnitNum(item.unitNumber)}
                  className={`flex items-center justify-between py-2 px-2.5 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-900 text-white font-bold shadow-sm'
                      : 'hover:bg-zinc-100 text-zinc-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="tracking-tight">Unit {item.unitNumber}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
                      (F{item.floor})
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold ${
                    item.isMatched 
                      ? isSelected ? 'text-emerald-300' : 'text-emerald-600'
                      : isSelected ? 'text-rose-300' : 'text-rose-600'
                  }`}>
                    {item.isMatched ? '✓ MATCH' : '⚠ MISMATCH'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Area: The Conceptual Flow & Reconciliation Card */}
        <div className="flex-1 flex flex-col border border-zinc-200/80 rounded-2xl bg-zinc-50/50 p-5 overflow-y-auto">
          {/* ================= EXACT PROMPT CONCEPTUAL FLOW ================= */}
          <div className="w-full bg-white border border-zinc-200 rounded-2xl p-5 mb-5 shadow-xs">
            <div className="text-[10px] font-mono font-bold tracking-[0.2em] text-zinc-400 uppercase mb-4 text-center">
              AUTOMATED MATCHING PIPELINE
            </div>

            <div className="grid grid-cols-2 gap-8 items-start relative">
              {/* Left Box: 3D UNIT */}
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 font-mono text-xs">
                <div className="flex items-center space-x-2 text-zinc-900 font-bold text-sm mb-3 pb-2 border-b border-zinc-200">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>3D UNIT ({selectedData.unitNumber})</span>
                </div>

                <div className="space-y-2 text-zinc-600">
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400">├──</span>
                    <span className="text-zinc-400">Geometry:</span>
                    <span className="font-semibold text-zinc-900">LoD-2.2 Solid Mesh</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400">├──</span>
                    <span className="text-zinc-400">X/Y/Z:</span>
                    <span className="font-semibold text-zinc-900">
                      {selectedData.unit.x} / {selectedData.unit.y} / {selectedData.unit.z}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400">├──</span>
                    <span className="text-zinc-400">Floor:</span>
                    <span className="font-semibold text-zinc-900">Floor {selectedData.unit.floor}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400">└──</span>
                    <span className="text-zinc-400">Area:</span>
                    <span className={`font-semibold ${!selectedData.isMatched && selectedData.unitNumber === '504' ? 'text-rose-600 underline font-bold' : 'text-zinc-900'}`}>
                      {selectedData.unit.areaSqM.toFixed(2)} m²
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Box: GOVERNMENT RECORD */}
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 font-mono text-xs">
                <div className="flex items-center space-x-2 text-zinc-900 font-bold text-sm mb-3 pb-2 border-b border-zinc-200">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>GOVERNMENT RECORD</span>
                </div>

                <div className="space-y-2 text-zinc-600">
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400">├──</span>
                    <span className="text-zinc-400">Deed No:</span>
                    <span className="font-semibold text-zinc-900 truncate">{selectedData.record.deedNumber}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400">├──</span>
                    <span className="text-zinc-400">CTS No:</span>
                    <span className="font-semibold text-zinc-900">{selectedData.record.ctsNumber}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400">├──</span>
                    <span className="text-zinc-400">Floor:</span>
                    <span className={`font-semibold ${!selectedData.isMatched && selectedData.unitNumber === '702' ? 'text-rose-600 underline font-bold' : 'text-zinc-900'}`}>
                      Floor {selectedData.record.floor}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-zinc-400">└──</span>
                    <span className="text-zinc-400">Area:</span>
                    <span className="font-semibold text-zinc-900">
                      {selectedData.record.recordedAreaSqM.toFixed(2)} m²
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Convergence Match Arrow & Result Banner */}
            <div className="flex flex-col items-center justify-center mt-4 pt-3 border-t border-zinc-100">
              <div className="text-zinc-300 font-mono text-sm mb-1">
                ▼ MATCH CONVERGENCE
              </div>

              {selectedData.isMatched ? (
                <div className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-mono font-bold text-sm shadow-sm tracking-wide">
                  <ShieldCheck className="w-5 h-5 text-white" />
                  <span>✓ RECORD MATCHED</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-rose-600 text-white font-mono font-bold text-sm shadow-sm tracking-wide animate-pulse">
                  <ShieldAlert className="w-5 h-5 text-white" />
                  <span>⚠ RECORD MISMATCH</span>
                </div>
              )}

              {selectedData.mismatchReason && (
                <div className="mt-2.5 max-w-lg text-center text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-lg">
                  {selectedData.mismatchReason}
                </div>
              )}
            </div>
          </div>

          {/* ================= ATTRIBUTE COMPARISON TABLE ================= */}
          <div className="w-full bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
            <div className="text-xs font-mono font-bold text-zinc-800 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-100 flex items-center justify-between">
              <span>ATTRIBUTE-BY-ATTRIBUTE AUDIT</span>
              <span className="text-[11px] font-normal text-zinc-400">
                Statutory Tolerance: Area ±1.0% • Floor Exact (0)
              </span>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              {selectedData.checks.map(check => (
                <div 
                  key={check.attributeName} 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    check.isMatch 
                      ? 'bg-zinc-50/50 border-zinc-200/70' 
                      : 'bg-rose-50/60 border-rose-200'
                  }`}
                >
                  <div className="w-1/4 font-semibold text-zinc-800">
                    {check.attributeName}
                  </div>

                  <div className="w-1/4 text-zinc-600">
                    <span className="text-[10px] text-zinc-400 block uppercase">3D Unit</span>
                    <span className={`font-semibold ${!check.isMatch ? 'text-rose-700' : 'text-zinc-900'}`}>
                      {check.unitValue}
                    </span>
                  </div>

                  <div className="w-1/4 text-zinc-600">
                    <span className="text-[10px] text-zinc-400 block uppercase">Gov Record</span>
                    <span className="font-semibold text-zinc-900">
                      {check.recordValue}
                    </span>
                  </div>

                  <div className="w-1/4 flex flex-col items-end">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      check.isMatch 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {check.isMatch ? '✓ MATCH' : '⚠ MISMATCH'}
                    </span>
                    {check.delta && (
                      <span className="text-[10px] text-zinc-500 mt-0.5">
                        Δ {check.delta}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="w-full text-center text-[11px] font-mono text-zinc-400 pt-3">
        Phase 17 • Record Matching Engine • 3D Unit ↔ Government Record • Maharashtra Land Revenue Code 1966
      </div>
    </div>
  );
};
