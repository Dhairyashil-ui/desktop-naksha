import React, { useState } from 'react';
import { ArrowLeft, Check, Download, Loader2 } from 'lucide-react';

interface OutputScreenProps {
  onBack?: () => void;
  onOpenValidation?: () => void;
}

export const OutputScreen: React.FC<OutputScreenProps> = ({ onBack }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});
  const [downloadingAll, setDownloadingAll] = useState<boolean>(false);
  const [allDownloaded, setAllDownloaded] = useState<boolean>(false);

  const packages = [
    { id: 'pkg_tbk_photogrammetry', label: 'TBK', format: '.tbk' },
    { id: 'pkg_gib_cadastre', label: 'GIB', format: '.gib' },
    { id: 'pkg_vertical_property_zip', label: 'VERTICAL PROPERTY', format: '.zip' },
    { id: 'pkg_3d_survey_zip', label: '3D SURVEY', format: '.zip' }
  ];

  const handleDownloadSingle = (id: string, label: string) => {
    setDownloadingId(id);
    
    // Trigger download via anchor
    const downloadUrl = `/api/v2/packages/download/${id}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${label.toLowerCase().replace(/\s+/g, '_')}_package.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingId(null);
      setDownloadedMap(prev => ({ ...prev, [id]: true }));
    }, 800);
  };

  const handleDownloadAll = () => {
    setDownloadingAll(true);

    const downloadUrl = `/api/v2/packages/download-all`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `NAKSHA_ALL_DELIVERABLES.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      setDownloadingAll(false);
      setAllDownloaded(true);
      // Mark all individual packages as downloaded
      const map: Record<string, boolean> = {};
      packages.forEach(p => { map[p.id] = true; });
      setDownloadedMap(map);
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-8 px-8 font-sans select-none">
      {/* Minimal Top Return Navigation */}
      <div className="w-full flex items-center justify-between text-xs text-zinc-400">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 text-zinc-400 hover:text-zinc-900 transition-colors font-mono"
            title="Return to Inputs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK</span>
          </button>
        ) : (
          <div />
        )}
        <div className="font-mono text-[11px] text-zinc-400">
          NAKSHA 2.0 • OUTPUT GENERATION
        </div>
      </div>

      {/* Main Centered Content */}
      <div className="w-full flex-1 flex items-center justify-center my-auto">
        <div className="w-full max-w-md text-center">
          
          {/* PROCESS COMPLETE Header */}
          <div className="mb-8">
            <h1 className="text-sm font-mono font-bold tracking-[0.25em] text-zinc-900 uppercase">
              PROCESS COMPLETE
            </h1>
          </div>

          {/* The 3 Core Verification Checklist Items */}
          <div className="space-y-3 font-mono text-sm max-w-xs mx-auto text-left mb-12">
            <div className="flex items-center space-x-3 text-zinc-900">
              <span className="text-emerald-600 font-bold text-base select-none">✓</span>
              <span className="tracking-wider font-medium">3D PROPERTY MODEL</span>
            </div>
            <div className="flex items-center space-x-3 text-zinc-900">
              <span className="text-emerald-600 font-bold text-base select-none">✓</span>
              <span className="tracking-wider font-medium">DATA VALIDATED</span>
            </div>
            <div className="flex items-center space-x-3 text-zinc-900">
              <span className="text-emerald-600 font-bold text-base select-none">✓</span>
              <span className="tracking-wider font-medium">RECORDS MATCHED</span>
            </div>
          </div>

          {/* OUTPUT PACKAGES Section */}
          <div className="mb-6">
            <div className="text-xs font-mono font-bold tracking-[0.25em] text-zinc-400 uppercase">
              OUTPUT PACKAGES
            </div>
          </div>

          {/* The 4 Package Buttons */}
          <div className="space-y-3 max-w-xs mx-auto mb-10">
            {packages.map(pkg => {
              const isDownloading = downloadingId === pkg.id;
              const isDownloaded = downloadedMap[pkg.id];

              return (
                <button
                  key={pkg.id}
                  onClick={() => handleDownloadSingle(pkg.id, pkg.label)}
                  disabled={isDownloading}
                  className={`w-full py-3.5 px-5 rounded-2xl font-mono text-xs font-bold tracking-widest uppercase transition-all border flex items-center justify-between shadow-2xs ${
                    isDownloaded
                      ? 'bg-zinc-50 border-zinc-300 text-zinc-900 hover:border-zinc-900'
                      : 'bg-white border-zinc-200/90 text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50/80 active:scale-99'
                  }`}
                >
                  <span className="text-zinc-400">[</span>
                  <span className="px-2">{pkg.label}</span>
                  <span className="text-zinc-400">]</span>

                  <span className="w-5 flex justify-end">
                    {isDownloading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                    ) : isDownloaded ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-600" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Master CTA: [ DOWNLOAD ALL ] */}
          <div className="max-w-xs mx-auto">
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className={`w-full py-4 px-6 rounded-2xl font-mono text-xs font-bold tracking-widest uppercase transition-all shadow-xs flex items-center justify-center space-x-2 ${
                downloadingAll
                  ? 'bg-zinc-800 text-zinc-300 cursor-wait'
                  : allDownloaded
                  ? 'bg-zinc-900 hover:bg-black text-white active:scale-98'
                  : 'bg-zinc-900 hover:bg-black text-white active:scale-98'
              }`}
            >
              {downloadingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                  <span>PREPARING ARCHIVE...</span>
                </>
              ) : allDownloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>[ DOWNLOAD ALL ]</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span>[ DOWNLOAD ALL ]</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Subtle Minimal Footer Status */}
      <div className="w-full text-center text-[10px] font-mono text-zinc-300">
        4 OF 4 OUTPUT PACKAGES GENERATED • ISO 19152 LADM CERTIFIED
      </div>
    </div>
  );
};
