import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ChevronRight, 
  ChevronDown, 
  Download, 
  CheckCircle2, 
  Layers, 
  Building2, 
  FileText, 
  Globe2, 
  ShieldCheck, 
  Compass, 
  Box,
  Copy,
  Check
} from 'lucide-react';
import { 
  CANONICAL_PUNE_001, 
  getCanonicalTree, 
  CanonicalTreeNode 
} from '../types/canonical';

interface CanonicalModelScreenProps {
  onBack: () => void;
  onOpenProcessing?: () => void;
}

export const CanonicalModelScreen: React.FC<CanonicalModelScreenProps> = ({
  onBack,
  onOpenProcessing
}) => {
  const treeData = getCanonicalTree();
  const [selectedNodeId, setSelectedNodeId] = useState<string>('project_pune_res_001');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set([
      'project_pune_res_001', 
      'bldg_shivaji_heights_a', 
      'branch_units'
    ])
  );
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'TREE' | 'JSON' | 'LADM'>('TREE');

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(CANONICAL_PUNE_001, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleDownloadLadm = () => {
    const ladmPayload = {
      $schema: "https://schemas.iso.org/iso/19152/ladm/v2/cadastre.json",
      standard: "ISO 19152:2012 LADM",
      project_code: CANONICAL_PUNE_001.code,
      title: CANONICAL_PUNE_001.title,
      crs: CANONICAL_PUNE_001.coordinates.target_crs,
      LA_BAUnit: {
        name: `Parcel ${CANONICAL_PUNE_001.parcel.survey_number}/${CANONICAL_PUNE_001.parcel.sub_division}`,
        ulpin: CANONICAL_PUNE_001.parcel.ulpin,
        legal_area_sqm: CANONICAL_PUNE_001.parcel.legal_recorded_area_sqm,
        gis_area_sqm: CANONICAL_PUNE_001.parcel.gis_computed_area_sqm,
        land_use: CANONICAL_PUNE_001.parcel.land_use
      },
      LA_LegalSpaceBuildingUnit: {
        building_code: CANONICAL_PUNE_001.building.building_code,
        name: CANONICAL_PUNE_001.building.name,
        floors_count: CANONICAL_PUNE_001.building.floors.length,
        units_count: CANONICAL_PUNE_001.units.length
      },
      LA_QualityAudit: {
        boundary_verified: CANONICAL_PUNE_001.validation.boundary_audit,
        coordinates_verified: CANONICAL_PUNE_001.validation.coordinates_audit,
        topology_watertight: CANONICAL_PUNE_001.validation.topology_audit,
        records_matched_pct: CANONICAL_PUNE_001.government_records.match_percentage,
        certified: CANONICAL_PUNE_001.validation.overall_certified
      }
    };
    const blob = new Blob([JSON.stringify(ladmPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NAKSHA_${CANONICAL_PUNE_001.code}_ISO19152_LADM.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Node Icon Helper
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'PROJECT': return <Globe2 className="w-4 h-4 text-zinc-900" />;
      case 'PARCEL': return <Layers className="w-4 h-4 text-emerald-600" />;
      case 'BUILDING': return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'FLOOR': return <Box className="w-3.5 h-3.5 text-zinc-500" />;
      case 'UNITS_BRANCH':
      case 'UNIT': return <Box className="w-3.5 h-3.5 text-indigo-500" />;
      case 'GEOMETRY': return <Box className="w-4 h-4 text-cyan-600" />;
      case 'COORDINATES': return <Compass className="w-4 h-4 text-purple-600" />;
      case 'SURVEY_DATA': return <Layers className="w-4 h-4 text-amber-600" />;
      case 'GOVERNMENT_RECORDS': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'VALIDATION': return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      default: return <Box className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  // Render Recursive Tree Node
  const renderTreeNode = (node: CanonicalTreeNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div 
          onClick={() => setSelectedNodeId(node.id)}
          className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-all ${
            isSelected 
              ? 'bg-zinc-900 text-white font-semibold' 
              : 'hover:bg-zinc-100 text-zinc-700'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          <div className="flex items-center space-x-2 truncate">
            {hasChildren ? (
              <button 
                onClick={(e) => toggleExpand(node.id, e)} 
                className="p-0.5 hover:bg-zinc-200/50 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            <span>{getNodeIcon(node.type)}</span>
            <span className="font-mono text-xs truncate tracking-tight">{node.name}</span>
          </div>

          {node.metric && (
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ml-2 shrink-0 ${
              isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-500'
            }`}>
              {node.metric}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-zinc-200 ml-4 my-0.5">
            {node.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen max-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-4 px-8 font-sans select-none overflow-hidden">
      {/* Top Bar: Minimal Navigation & Meta */}
      <div className="w-full flex items-center justify-between text-xs text-zinc-400 mb-4">
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
              Processing 3D →
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <span className="font-mono text-xs font-semibold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded">
            ISO 19152 LADM COMPLIANT
          </span>
          <span className="text-zinc-300">•</span>
          <span className="font-mono tracking-[0.2em] font-semibold text-zinc-400">
            NAKSHA 2.0
          </span>
        </div>
      </div>

      {/* Main Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100">
        <div>
          <div className="text-[11px] font-mono font-semibold tracking-[0.2em] text-zinc-400 uppercase">
            PHASE 15 — THE HEART OF NAKSHA 2.0
          </div>
          <h1 className="text-xl font-bold font-mono tracking-tight text-zinc-900 mt-1">
            Canonical Geospatial Data Model
          </h1>
          <p className="text-xs font-mono text-zinc-500 mt-0.5">
            Unified internal representation linking parcels, buildings, floors, 3D units, coordinates, and legal land records.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Tab Switcher */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-lg text-xs font-mono">
            <button
              onClick={() => setActiveTab('TREE')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeTab === 'TREE' ? 'bg-white text-zinc-900 shadow-sm font-bold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              HIERARCHY
            </button>
            <button
              onClick={() => setActiveTab('JSON')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeTab === 'JSON' ? 'bg-white text-zinc-900 shadow-sm font-bold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              JSON SCHEMA
            </button>
            <button
              onClick={() => setActiveTab('LADM')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                activeTab === 'LADM' ? 'bg-white text-zinc-900 shadow-sm font-bold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              ISO 19152
            </button>
          </div>

          <button
            onClick={handleDownloadLadm}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold rounded-lg shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT LADM</span>
          </button>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="w-full flex-1 flex items-stretch gap-6 overflow-hidden">
        {/* Left Column: Conceptual Hierarchy Tree */}
        <div className="w-1/2 flex flex-col border border-zinc-200/80 rounded-2xl bg-white p-4 overflow-hidden">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
            <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
              PROJECT RECONSTRUCTION HIERARCHY
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              8 Branches • 64 Strata Units
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {renderTreeNode(treeData)}
          </div>
        </div>

        {/* Right Column: Node Inspector & Unified Representation */}
        <div className="w-1/2 flex flex-col border border-zinc-200/80 rounded-2xl bg-zinc-50/50 p-4 overflow-hidden">
          {activeTab === 'TREE' && (
            <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-1">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200/60">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-mono font-bold text-zinc-800 uppercase tracking-wider">
                      CANONICAL ENTITY SUMMARY
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ Verified & Watertight
                  </span>
                </div>

                {/* 10 Architectural Pillars Summary Cards */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono mb-4">
                  <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                    <div className="text-zinc-400 text-[10px] uppercase">Cadastral Parcel</div>
                    <div className="font-bold text-zinc-900 mt-1">Survey No. 142/B</div>
                    <div className="text-zinc-500 text-[11px] mt-0.5">ULPIN: MH-PUN-2026-0942</div>
                    <div className="text-zinc-700 font-semibold text-[11px] mt-1">1,250.00 m² (Δ 0.012%)</div>
                  </div>

                  <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                    <div className="text-zinc-400 text-[10px] uppercase">Building Structure</div>
                    <div className="font-bold text-zinc-900 mt-1">Shivaji Heights Wing A</div>
                    <div className="text-zinc-500 text-[11px] mt-0.5">LoD-2.2 Solid Massing</div>
                    <div className="text-zinc-700 font-semibold text-[11px] mt-1">8 Floors • 12.0m Height</div>
                  </div>

                  <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                    <div className="text-zinc-400 text-[10px] uppercase">3D Strata Units</div>
                    <div className="font-bold text-zinc-900 mt-1">64 Legal Units</div>
                    <div className="text-zinc-500 text-[11px] mt-0.5">8 Units/Floor • UDS 1.56%</div>
                    <div className="text-emerald-600 font-semibold text-[11px] mt-1">100% 7/12 RoR Matched</div>
                  </div>

                  <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                    <div className="text-zinc-400 text-[10px] uppercase">Coordinates & Datum</div>
                    <div className="font-bold text-zinc-900 mt-1">EPSG:32643</div>
                    <div className="text-zinc-500 text-[11px] mt-0.5">WGS 84 / UTM zone 43N</div>
                    <div className="text-purple-600 font-semibold text-[11px] mt-1">18 GCPs (±0.011m)</div>
                  </div>

                  <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                    <div className="text-zinc-400 text-[10px] uppercase">Fused Point Cloud</div>
                    <div className="font-bold text-zinc-900 mt-1">89.2M Points</div>
                    <div className="text-zinc-500 text-[11px] mt-0.5">LiDAR + Photogrammetry</div>
                    <div className="text-blue-600 font-semibold text-[11px] mt-1">RMSE: 1.4 cm Co-Reg</div>
                  </div>

                  <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                    <div className="text-zinc-400 text-[10px] uppercase">Legal Certification</div>
                    <div className="font-bold text-zinc-900 mt-1">ISO 19152 LADM</div>
                    <div className="text-zinc-500 text-[11px] mt-0.5">MahaRERA & MLRC 1966</div>
                    <div className="text-emerald-600 font-semibold text-[11px] mt-1">✓ 4/4 Audits Certified</div>
                  </div>
                </div>

                {/* Conceptual Tree Code Diagram */}
                <div className="bg-zinc-900 text-zinc-100 rounded-xl p-3.5 font-mono text-[11px] overflow-x-auto">
                  <div className="text-zinc-400 text-[10px] mb-2">// NAKSHA 2.0 CANONICAL RECONSTRUCTION PIPELINE</div>
                  <pre className="leading-tight text-zinc-300">
{`PROJECT: Pune_Residential_001
├── Parcel (Survey 142/B • 1,250 m²)
├── Building (Shivaji Heights • 12m)
│     ├── Floor 0 (Ground) .. Floor 7
├── Units (64 Strata Units • Unit 101 .. 808)
├── Geometry (LoD-2.2 GLB • 89.2M Fused Pts)
├── Coordinates (EPSG:32643 • Scale 0.9996024)
├── Survey Data (1,420 Imgs • 52.1M LiDAR Pts)
├── Government Records (64 7/12 RoR Titles)
└── Validation (✓ Boundary ✓ Coords ✓ Topology ✓ Record)`}
                  </pre>
                </div>
              </div>

              {/* Ready Status Bar */}
              <div className="mt-4 pt-3 border-t border-zinc-200/80 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">Internal Model State:</span>
                <span className="text-zinc-900 font-bold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>UNIFIED CANONICAL MODEL READY</span>
                </span>
              </div>
            </div>
          )}

          {activeTab === 'JSON' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-200">
                <span className="text-xs font-mono font-bold text-zinc-700">
                  CANONICAL PROJECT JSON
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center space-x-1 text-xs font-mono text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 px-2 py-1 rounded"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="flex-1 overflow-auto bg-zinc-900 text-zinc-200 p-3 rounded-xl font-mono text-[11px] leading-relaxed">
                {JSON.stringify(CANONICAL_PUNE_001, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'LADM' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-200">
                <span className="text-xs font-mono font-bold text-zinc-700">
                  ISO 19152:2012 LADM SCHEMA (Land Administration Domain Model)
                </span>
                <button
                  onClick={handleDownloadLadm}
                  className="flex items-center space-x-1 text-xs font-mono text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 px-2 py-1 rounded"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
              <pre className="flex-1 overflow-auto bg-zinc-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] leading-relaxed">
{`{
  "$schema": "https://schemas.iso.org/iso/19152/ladm/v2/cadastre.json",
  "standard": "ISO 19152:2012 LADM",
  "project_code": "${CANONICAL_PUNE_001.code}",
  "LA_BAUnit": {
    "name": "Parcel 142/B",
    "ulpin": "MH-PUN-2026-0942",
    "legal_area_sqm": 1250.0,
    "gis_area_sqm": 1249.85
  },
  "LA_LegalSpaceBuildingUnit": {
    "building_code": "BLDG-A",
    "floors_count": 8,
    "units_count": 64
  },
  "LA_RRR": [
    {
      "rrrID": "ror_712_mh_pun_402",
      "unit_number": "402",
      "party": "Rajesh M. Patil",
      "tenure": "FREEHOLD_STRATA",
      "encumbrance": "CLEAR"
    }
    // ... 64 verified strata titles
  ],
  "LA_QualityAudit": {
    "boundary_verified": true,
    "coordinates_verified": true,
    "topology_watertight": true,
    "records_matched_pct": 100.0,
    "certified_for_title_registration": true
  }
}`}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="w-full text-center text-[11px] font-mono text-zinc-400 pt-3">
        Phase 15 • Canonical Geospatial Data Model • Everything becomes one unified internal representation
      </div>
    </div>
  );
};
