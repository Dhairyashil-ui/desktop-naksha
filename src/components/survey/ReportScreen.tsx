import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Download, 
  Eye, 
  Check, 
  Loader2 
} from 'lucide-react';
import { 
  AssignedParcel, 
  SurveyReportData, 
  StrataUnitData,
  fetchRealUnits,
  generateSurveyReport 
} from '../../services/surveyApi';
import { 
  downloadCadastralSurveyReportPdf, 
  ensureCompleteStrataUnits 
} from '../../utils/cadastralPdfGenerator';
import { getParcelBuildingMetrics } from './construction/cadastralPipelineElements';

interface ReportScreenProps {
  parcel: AssignedParcel;
  onSendToBhuNaksha: (report: SurveyReportData) => void;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  parcel,
  onSendToBhuNaksha
}) => {
  const [report, setReport] = useState<SurveyReportData | null>(null);
  const [units, setUnits] = useState<StrataUnitData[]>([]);
  const [showFullView, setShowFullView] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [data, unitList] = await Promise.all([
        generateSurveyReport(parcel),
        fetchRealUnits(parcel)
      ]);
      if (mounted) {
        setReport(data);
        const metrics = getParcelBuildingMetrics(parcel);
        setUnits(ensureCompleteStrataUnits(parcel, unitList, metrics));
      }
    }
    load();
    return () => { mounted = false; };
  }, [parcel]);

  const handleDownloadPdf = () => {
    if (!report) return;
    setPdfGenerating(true);
    try {
      downloadCadastralSurveyReportPdf(parcel, report, units);
      setDownloaded(true);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSendAndDownload = () => {
    if (!report) return;
    // 1. Generate & download official certified government PDF deliverable
    handleDownloadPdf();
    // 2. Dispatch to Bhu-Naksha gateway
    onSendToBhuNaksha(report);
  };

  if (!report) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] w-full bg-white flex items-center justify-center font-mono text-xs text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Generating Cadastral Survey Report...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full bg-white text-zinc-900 flex flex-col justify-between py-12 px-6 font-sans select-none">
      {/* Top Header */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-between text-xs font-mono text-zinc-400">
        <span>CADASTRE CERTIFICATE OF SURVEY</span>
        <span>{report.reportId}</span>
      </div>

      {/* Main Centered Content */}
      <div className="w-full max-w-xl mx-auto my-auto py-6 space-y-8 text-center font-mono">
        <div>
          <div className="text-emerald-600 font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-1 mb-2">
            <Check className="w-4 h-4" />
            <span>REPORT READY</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
            Cadastral Demarcation Summary
          </h1>
        </div>

        {/* Minimal Report Preview Card */}
        <div className="border border-zinc-200 rounded-2xl p-6 bg-zinc-50/50 space-y-4 text-left text-xs">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-200">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase">Parcel Reference</span>
              <div className="font-bold text-zinc-900 text-sm">
                Survey No. {report.surveyNumber}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 uppercase">CRS Datum</span>
              <div className="font-semibold text-zinc-700">
                {report.targetCrs}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-1">
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase">GIS Verified Area</span>
              <span className="font-bold text-zinc-900 text-sm">{report.gisAreaSqm.toFixed(1)} m²</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase">Recorded Title Area</span>
              <span className="font-bold text-zinc-900 text-sm">{report.legalAreaSqm.toFixed(1)} m²</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase">3D Strata Structure</span>
              <span className="font-bold text-zinc-900 text-sm">{report.floorsCount} Floors • {report.unitsCount} Units</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase">Control Accuracy</span>
              <span className="font-bold text-emerald-600 text-sm">±{report.gnssAccuracyM * 100} cm (Tier 1)</span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-200 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Legal Certification:</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {report.validationStatus}
            </span>
          </div>
        </div>

        {/* Buttons: [ VIEW ] and [ DOWNLOAD PDF ] */}
        <div className="flex items-center justify-center space-x-3 max-w-sm mx-auto">
          <button
            onClick={() => setShowFullView(!showFullView)}
            className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-300 hover:border-zinc-900 text-zinc-800 text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-600" />
            <span>[ VIEW DETAILS ]</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="flex-1 py-2.5 px-4 rounded-xl border border-blue-600 hover:bg-blue-50 text-blue-700 text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
          >
            {pdfGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : downloaded ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>[ {downloaded ? 'PDF SAVED' : 'DOWNLOAD PDF'} ]</span>
          </button>
        </div>

        {/* Primary CTA: SEND TO BHU-NAKSHA (Auto-Generates & Downloads Official PDF) */}
        <div className="pt-2 max-w-sm mx-auto space-y-2">
          <button
            onClick={handleSendAndDownload}
            className="w-full py-3.5 px-6 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold tracking-widest uppercase transition-all shadow-md flex items-center justify-center space-x-2 active:scale-98 cursor-pointer"
          >
            <span>[ SEND TO BHU-NAKSHA & GET PDF ]</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <p className="text-[10px] text-zinc-400 font-sans">
            Automatically generates official Government-stamped Cadastral Report PDF before gateway dispatch.
          </p>
        </div>
      </div>

      {/* Official Stamped Report Inspection Modal */}
      {showFullView && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-zinc-200 shadow-2xl font-mono text-xs text-left animate-in zoom-in-95 max-h-[85vh] flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-zinc-900 text-sm">Official Cadastral Survey Certificate</span>
                </div>
                <button onClick={() => setShowFullView(false)} className="text-zinc-400 hover:text-zinc-900 text-base font-bold cursor-pointer">
                  ✕
                </button>
              </div>

              {/* Sub-header banner */}
              <div className="my-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-900 block">Government of Maharashtra • Land Records</span>
                  <span className="text-[11px] text-blue-700">Parcel {parcel.surveyNumber}/{parcel.subDivision} • Base ULPIN: {parcel.baseUlpin}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-blue-900 text-white font-bold px-2 py-0.5 rounded">LADM ISO 19152</span>
                </div>
              </div>

              {/* Strata Owners Schedule */}
              <div className="mt-3 space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                  Strata Property Register — All Apartment Units & Owners ({units.length} Units):
                </span>
                <div className="border border-zinc-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto divide-y divide-zinc-100 text-[10px]">
                  {units.map((u) => (
                    <div key={u.id} className="p-2 flex items-center justify-between hover:bg-zinc-50">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-bold text-blue-700 w-8">F0{u.floor}</span>
                        <span className="font-bold text-zinc-900 w-16">Unit {u.unitNumber}</span>
                        <span className="text-zinc-700 font-medium truncate max-w-[200px]">{u.ownerName}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-zinc-400">{u.carpetAreaSqm.toFixed(1)} m²</span>
                        <span className="text-zinc-500 font-mono text-[9px]">{u.deedNumber}</span>
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded text-[9px]">VALID</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 pt-3 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400">
                Official Government Stamp: SLR-MH-PUN-2026
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownloadPdf}
                  className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Stamped PDF</span>
                </button>
                <button
                  onClick={() => setShowFullView(false)}
                  className="py-2 px-4 rounded-xl border border-zinc-300 hover:border-zinc-800 text-zinc-700 text-xs uppercase font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="w-full max-w-xl mx-auto text-center text-[11px] font-mono text-zinc-400">
        ISO 19152:2012 LADM Cadastral Survey Conforming
      </div>
    </div>
  );
};
