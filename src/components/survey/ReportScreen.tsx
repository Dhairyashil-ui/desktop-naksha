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
  generateSurveyReport 
} from '../../services/surveyApi';

interface ReportScreenProps {
  parcel: AssignedParcel;
  onSendToBhuNaksha: (report: SurveyReportData) => void;
}

export const ReportScreen: React.FC<ReportScreenProps> = ({
  parcel,
  onSendToBhuNaksha
}) => {
  const [report, setReport] = useState<SurveyReportData | null>(null);
  const [showFullView, setShowFullView] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const data = await generateSurveyReport(parcel);
      if (mounted) {
        setReport(data);
      }
    }
    load();
    return () => { mounted = false; };
  }, [parcel]);

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NAKSHA_${report.reportId}_CADASTRAL_REPORT.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
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

        {/* Buttons: [ VIEW ] and [ DOWNLOAD ] */}
        <div className="flex items-center justify-center space-x-3 max-w-xs mx-auto">
          <button
            onClick={() => setShowFullView(!showFullView)}
            className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-300 hover:border-zinc-900 text-zinc-800 text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center space-x-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>[ VIEW ]</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-300 hover:border-zinc-900 text-zinc-800 text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>[ {downloaded ? 'SAVED' : 'DOWNLOAD'} ]</span>
          </button>
        </div>

        {/* Primary CTA: SEND TO BHU-NAKSHA */}
        <div className="pt-2 max-w-xs mx-auto">
          <button
            onClick={() => onSendToBhuNaksha(report)}
            className="w-full py-3.5 px-6 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold tracking-widest uppercase transition-all shadow-md flex items-center justify-center space-x-2 active:scale-98"
          >
            <span>[ SEND TO BHU-NAKSHA ]</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Raw Report Inspection Modal */}
      {showFullView && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-zinc-200 shadow-xl font-mono text-xs text-left animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="font-bold text-zinc-900">Certified LADM Payload</span>
              <button onClick={() => setShowFullView(false)} className="text-zinc-400 hover:text-zinc-900">
                ✕
              </button>
            </div>
            <pre className="mt-4 p-3 bg-zinc-50 rounded-lg max-h-60 overflow-y-auto text-[11px] text-zinc-700">
              {JSON.stringify(report, null, 2)}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowFullView(false)}
                className="py-1.5 px-4 rounded bg-zinc-900 text-white text-xs uppercase font-bold"
              >
                Close
              </button>
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
