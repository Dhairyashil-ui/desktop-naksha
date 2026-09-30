import React, { useState, useEffect } from 'react';
import { 
  Check, 
  ArrowRight, 
  Loader2, 
  Copy,
  Layers,
  Download
} from 'lucide-react';
import { 
  AssignedParcel, 
  SurveyReportData, 
  BhuNakshaResult, 
  StrataUnitData,
  fetchRealUnits,
  sendToBhuNaksha 
} from '../../services/surveyApi';
import { 
  downloadBhuNakshaSanadPdf, 
  ensureCompleteStrataUnits 
} from '../../utils/cadastralPdfGenerator';

interface UlpinScreenProps {
  parcel: AssignedParcel;
  report: SurveyReportData;
  initialUnit?: StrataUnitData | null;
  onCreatePropertyCard: (ulpinData: { baseUlpin: string; ulpin3d: string; unitId?: string }) => void;
}

export const UlpinScreen: React.FC<UlpinScreenProps> = ({
  parcel,
  report,
  initialUnit,
  onCreatePropertyCard
}) => {
  const [isSending, setIsSending] = useState(true);
  const [result, setResult] = useState<BhuNakshaResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [units, setUnits] = useState<StrataUnitData[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(initialUnit?.id || null);

  const [downloadedCert, setDownloadedCert] = useState(false);

  const executeTransmission = async () => {
    setIsSending(true);
    setResult(null);

    // Load registered units for this parcel and ensure all floors are covered
    const unitList = await fetchRealUnits(parcel);
    const fullUnits = ensureCompleteStrataUnits(parcel, unitList);
    setUnits(fullUnits);
    if (!selectedUnitId && fullUnits.length > 0) {
      setSelectedUnitId(fullUnits[0].id);
    }

    // Real HTTP call to Bhu-Naksha / 3D identity generation endpoint
    const res = await sendToBhuNaksha(report, parcel);
    setResult(res);
    setIsSending(false);
  };

  const handleDownloadCertificatePdf = () => {
    downloadBhuNakshaSanadPdf(parcel, report, units, baseUlpin, result?.transactionId);
    setDownloadedCert(true);
  };

  useEffect(() => {
    executeTransmission();
  }, [parcel, report]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const baseUlpin = result?.baseUlpin || parcel.baseUlpin || '27-07-005-020401';
  const activeUnit = units.find(u => u.id === selectedUnitId) || units[0] || initialUnit || null;
  const current3dUlpin = activeUnit?.ulpin3d || result?.ulpin3d || `${baseUlpin}-F00-001`;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full bg-white text-zinc-900 flex flex-col justify-between py-8 px-6 font-sans select-none">
      {/* Top Header */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between text-xs font-mono text-zinc-400">
        <span>BHU-NAKSHA INTEGRATION GATEWAY</span>
        <span>NIC PROTOCOL V2 • LADM ISO 19152</span>
      </div>

      {/* Main Centered Content */}
      <div className="w-full max-w-2xl mx-auto my-auto py-4 font-mono text-center space-y-6">
        {isSending ? (
          /* SENDING State */
          <div className="py-16 space-y-4">
            <Loader2 className="w-8 h-8 text-zinc-900 animate-spin mx-auto" />
            <div className="text-base font-bold tracking-wider text-zinc-900 uppercase">
              TRANSMITTING TO BHU-NAKSHA...
            </div>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Transmitting certified 3D cadastral boundary, parcel geometry, and LADM vertical property record to National Informatics Centre (NIC) gateway...
            </p>
          </div>
        ) : (
          /* SUCCESS: ULPIN GENERATED & STRATA REGISTRY */
          <div className="space-y-6 animate-in fade-in zoom-in-95">
            {/* Clean Notification */}
            <div className="inline-flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
              <Check className="w-4 h-4" />
              <span>OFFICIAL CADASTRAL ULPIN ASSIGNED</span>
            </div>

            <div className="space-y-4 text-left">
              {/* 2D Base Cadastral ULPIN Card */}
              <div className="border border-zinc-200 rounded-xl p-5 bg-zinc-50/50 space-y-1 relative group">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                  2D Cadastral Base ULPIN (Parcel Land Boundary)
                </span>
                <div className="text-xl font-bold font-mono text-zinc-900">
                  {baseUlpin}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Survey No. {parcel.surveyNumber}/{parcel.subDivision} • {parcel.location} • Area: {parcel.legalAreaSqm.toFixed(1)} m²
                </div>
                <button
                  onClick={() => copyToClipboard(baseUlpin, '2D')}
                  className="absolute right-4 top-4 p-1.5 rounded-md hover:bg-zinc-200 text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer"
                  title="Copy 2D ULPIN"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 3D Volumetric Property ULPIN Registry */}
              <div className="border border-zinc-900 rounded-xl p-5 bg-white space-y-3 relative group shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-zinc-900" />
                    <span className="text-xs text-zinc-900 uppercase font-bold">
                      3D Volumetric Property ULPIN Registry ({units.length} Units)
                    </span>
                  </div>
                  <span className="text-[9px] bg-zinc-900 text-white px-2 py-0.5 rounded font-bold uppercase">
                    CERTIFIED LADM V2
                  </span>
                </div>

                <p className="text-[11px] text-zinc-500 font-sans">
                  Each stratified property unit holds its own authoritative 3D ULPIN derived from geodetic coordinates, level, and floor space:
                </p>

                {/* Table of distinct units and their unique ULPINs */}
                <div className="border border-zinc-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-zinc-100 text-[11px]">
                  {units.map((u) => {
                    const isSelected = activeUnit?.id === u.id;
                    const uUlpin = u.ulpin3d || `${baseUlpin}-F0${u.floor}-${u.unitNumber}`;

                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUnitId(u.id)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-zinc-100/90 font-semibold'
                            : 'hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-zinc-400 text-[10px] w-6">F0{u.floor}</span>
                          <span className="font-bold text-zinc-900 w-16">Unit {u.unitNumber}</span>
                          <span className="text-zinc-500 truncate max-w-[200px]">{u.unitType || 'Strata Property'}</span>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="text-zinc-400">{u.carpetAreaSqm.toFixed(1)} m²</span>
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {uUlpin}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Unit Active Callout */}
                {activeUnit && (
                  <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-zinc-400 text-[10px] uppercase block font-semibold">Active Selected Property</span>
                      <span className="font-bold text-zinc-900">
                        Floor {activeUnit.floor}, Unit {activeUnit.unitNumber} • {activeUnit.unitType}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-400 text-[10px] uppercase block font-semibold">3D ULPIN</span>
                      <span className="font-mono font-bold text-blue-600">{current3dUlpin}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {copied && (
              <div className="text-[10px] text-emerald-600 font-bold uppercase">
                ✓ Copied {copied} ULPIN to clipboard
              </div>
            )}

            {/* Action CTA: DOWNLOAD OFFICIAL BHU-NAKSHA SANAD PDF & CREATE PROPERTY CARD */}
            <div className="pt-2 max-w-md mx-auto space-y-2.5">
              <button
                onClick={handleDownloadCertificatePdf}
                className="w-full py-3 px-6 rounded-xl border-2 border-blue-600 bg-blue-50/70 hover:bg-blue-100 text-blue-800 text-xs font-bold tracking-wider uppercase transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                {downloadedCert ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Download className="w-4 h-4 text-blue-600" />
                )}
                <span>
                  {downloadedCert
                    ? 'BHU-NAKSHA 3D CERTIFICATE SAVED'
                    : '[ DOWNLOAD BHU-NAKSHA 3D SANAD (PDF) ]'}
                </span>
              </button>

              <button
                onClick={() => onCreatePropertyCard({ 
                  baseUlpin, 
                  ulpin3d: current3dUlpin,
                  unitId: activeUnit?.id
                })}
                className="w-full py-3.5 px-6 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold tracking-widest uppercase transition-all shadow-md flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
              >
                <span>[ CREATE PROPERTY CARD ]</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-2xl mx-auto text-center text-[11px] font-mono text-zinc-400">
        Bhu-Naksha NIC Registry Integration • Sovereign Land Cadastre Gateway
      </div>
    </div>
  );
};
