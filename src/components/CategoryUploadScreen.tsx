import React, { useState, useRef } from 'react';
import { ArrowLeft, Check, Upload, AlertTriangle, Loader2 } from 'lucide-react';

interface CategoryUploadScreenProps {
  categoryName: string;
  categoryNum: string;
  categoryId: string;
  acceptedFormats: string;
  projectId: string;
  onBack: () => void;
  onDatasetSaved: (categoryNum: string, datasetInfo: any) => void;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'validating' | 'done' | 'error';
  progress: number;   // 0-100
  datasetId?: string;
  datasetName?: string;
  filesUploaded?: number;
  totalBytes?: number;
  validationResult?: any;
  error?: string;
  rejected?: { filename: string; reason: string }[];
}

export const CategoryUploadScreen: React.FC<CategoryUploadScreenProps> = ({
  categoryName = 'Photogrammetry',
  categoryNum = '01',
  categoryId = 'CAT_01_PHOTOGRAMMETRY',
  acceptedFormats = 'JPG • TIFF • PNG • RAW',
  projectId,
  onBack,
  onDatasetSaved,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle', progress: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BACKEND = 'http://127.0.0.1:8000';

  const humanSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const processFiles = (files: FileList | File[]) => {
    setSelectedFiles(Array.from(files));
    setUploadState({ status: 'idle', progress: 0 });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const datasetName = `${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const formData = new FormData();
    formData.append('dataset_name', datasetName);
    selectedFiles.forEach(f => formData.append('files', f));

    setUploadState({ status: 'uploading', progress: 10 });

    try {
      // Upload files
      const uploadUrl = `${BACKEND}/api/v2/projects/${projectId}/datasets/${categoryId}/upload`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ detail: uploadRes.statusText }));
        throw new Error(err.detail || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      setUploadState({
        status: 'validating',
        progress: 60,
        datasetId: uploadData.dataset_id,
        datasetName: uploadData.dataset_name,
        filesUploaded: uploadData.files_saved,
        totalBytes: uploadData.total_bytes,
        rejected: uploadData.rejected || [],
      });

      // Run real file validation
      const validateRes = await fetch(
        `${BACKEND}/api/v2/datasets/${uploadData.dataset_id}/validate`,
        { method: 'POST' }
      );

      let validationResult = null;
      if (validateRes.ok) {
        validationResult = await validateRes.json();
      }

      setUploadState(prev => ({
        ...prev,
        status: 'done',
        progress: 100,
        validationResult,
      }));

    } catch (err: any) {
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        progress: 0,
        error: err.message || 'Upload failed',
      }));
    }
  };

  const handleConfirm = () => {
    if (!uploadState.datasetId) return;
    onDatasetSaved(categoryNum, {
      dataset_id: uploadState.datasetId,
      dataset_name: uploadState.datasetName,
      category_id: categoryId,
      files_saved: uploadState.filesUploaded,
      total_bytes: uploadState.totalBytes,
      validation: uploadState.validationResult,
    });
  };

  const reset = () => {
    setSelectedFiles([]);
    setUploadState({ status: 'idle', progress: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isUploading = uploadState.status === 'uploading' || uploadState.status === 'validating';
  const isDone = uploadState.status === 'done';
  const isError = uploadState.status === 'error';

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between py-12 px-6 font-sans select-none">
      {/* Top Bar */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between text-xs text-zinc-400">
        <button onClick={onBack} className="flex items-center space-x-1.5 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>DATA INPUTS</span>
        </button>
        <span className="font-mono tracking-[0.2em] font-semibold text-zinc-400">NAKSHA 2.0</span>
      </div>

      {/* Main */}
      <div className="w-full max-w-lg mx-auto my-auto py-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 mb-8 uppercase text-left">
          {categoryName}
        </h1>

        {/* Phase: No files selected */}
        {selectedFiles.length === 0 && !isDone && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl py-14 px-6 text-center transition-all ${
              isDragOver ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'
            }`}
          >
            <div className="text-sm font-medium text-zinc-600 mb-4">Drop files here</div>
            <div className="text-xs text-zinc-400 font-mono mb-4">or</div>

            <label className="inline-block cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <span className="py-2.5 px-6 rounded-lg text-xs font-bold font-mono tracking-wider uppercase border border-zinc-900 hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                [ SELECT FILES ]
              </span>
            </label>

            <div className="mt-8 text-xs text-zinc-400">
              <span className="block text-[11px] font-mono uppercase mb-1">Accepted:</span>
              <span className="font-mono text-zinc-600 font-medium">{acceptedFormats}</span>
            </div>
          </div>
        )}

        {/* Phase: Files selected, ready to upload */}
        {selectedFiles.length > 0 && !isUploading && !isDone && (
          <div className="border border-zinc-200 rounded-xl p-6 bg-zinc-50/50 space-y-4">
            <div className="text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase">
              {selectedFiles.length} FILE(S) SELECTED
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {selectedFiles.slice(0, 20).map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-100 text-xs font-mono">
                  <span className="text-zinc-700 truncate max-w-[200px]">{f.name}</span>
                  <span className="text-zinc-400 ml-2 shrink-0">{humanSize(f.size)}</span>
                </div>
              ))}
              {selectedFiles.length > 20 && (
                <div className="text-xs text-zinc-400 font-mono text-center py-1">
                  + {selectedFiles.length - 20} more files
                </div>
              )}
            </div>

            {isError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{uploadState.error}</span>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={reset}
                className="py-2.5 px-4 text-xs font-mono text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                UPLOAD & VALIDATE
              </button>
            </div>
          </div>
        )}

        {/* Phase: Uploading / Validating */}
        {isUploading && (
          <div className="border border-zinc-200 rounded-xl p-8 bg-zinc-50/50 space-y-6 text-center">
            <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mx-auto" />
            <div>
              <div className="text-sm font-bold text-zinc-900 mb-1">
                {uploadState.status === 'uploading' ? 'Uploading files...' : 'Validating dataset...'}
              </div>
              <div className="text-xs text-zinc-400 font-mono">
                {uploadState.status === 'uploading'
                  ? `Sending ${selectedFiles.length} file(s) to backend`
                  : 'Reading file headers, checking CRS, analysing content'
                }
              </div>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-1.5">
              <div
                className="bg-zinc-900 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Phase: Done */}
        {isDone && (
          <div className="border border-zinc-200 rounded-xl p-6 bg-zinc-50/50 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-900">Upload Complete</div>
                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                  {uploadState.filesUploaded} file(s) — {humanSize(uploadState.totalBytes || 0)} stored on server
                </div>
              </div>
            </div>

            {/* Validation Summary */}
            {uploadState.validationResult && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Validation Results
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-zinc-100 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-zinc-900">
                      {uploadState.validationResult.quality_score?.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">Quality</div>
                  </div>
                  <div className="bg-white border border-zinc-100 rounded-lg p-2.5 text-center">
                    <div className={`text-sm font-bold ${uploadState.validationResult.ready_for_processing ? 'text-zinc-900' : 'text-amber-600'}`}>
                      {uploadState.validationResult.ready_for_processing ? 'READY' : 'WARNINGS'}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">Status</div>
                  </div>
                </div>

                {/* CRS / Points detected */}
                {(uploadState.validationResult.crs_detected || uploadState.validationResult.point_count) && (
                  <div className="bg-white border border-zinc-100 rounded-lg p-2.5 text-xs font-mono space-y-1">
                    {uploadState.validationResult.crs_detected && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">CRS detected</span>
                        <span className="text-zinc-900 font-semibold">{uploadState.validationResult.crs_detected}</span>
                      </div>
                    )}
                    {uploadState.validationResult.point_count && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Point count</span>
                        <span className="text-zinc-900 font-semibold">{uploadState.validationResult.point_count.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Validation checks */}
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {uploadState.validationResult.checks?.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-zinc-100 text-xs font-mono">
                      <span className="text-zinc-600">{c.check}</span>
                      <span className={`font-semibold ${
                        c.status === 'pass' ? 'text-zinc-900' :
                        c.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {c.value || c.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Rejected files */}
                {uploadState.rejected && uploadState.rejected.length > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-mono text-amber-800">
                    <div className="font-semibold mb-1">{uploadState.rejected.length} file(s) rejected:</div>
                    {uploadState.rejected.slice(0, 3).map((r, i) => (
                      <div key={i}>• {r.filename}: {r.reason}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center space-x-3 pt-1">
              <button onClick={reset} className="py-2.5 px-4 text-xs font-mono text-zinc-500 hover:text-zinc-900 transition-colors">
                Re-upload
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm"
              >
                CONFIRM DATASET →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-lg mx-auto text-center text-[11px] font-mono text-zinc-400">
        Files are saved to server storage • SHA-256 verified • Phase RF-1
      </div>
    </div>
  );
};
