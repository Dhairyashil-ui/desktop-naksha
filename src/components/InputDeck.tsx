import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { InputChannel } from '../types/naksha';
import { InputCard } from './InputCard';

interface InputDeckProps {
  channels: InputChannel[];
  onSelectChannel: (channel: InputChannel) => void;
  onFilesDropped: (files: FileList) => void;
}

export const InputDeck: React.FC<InputDeckProps> = ({ channels, onSelectChannel, onFilesDropped }) => {
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'WARNINGS' | 'EMPTY'>('ALL');
  const [isDragOver, setIsDragOver] = useState(false);

  const filteredChannels = channels.filter(ch => {
    if (filter === 'READY') return ch.status === 'READY';
    if (filter === 'WARNINGS') return ch.status === 'READY_WITH_WARNINGS' || ch.status === 'BLOCKED';
    if (filter === 'EMPTY') return ch.status === 'EMPTY';
    return true;
  });

  const readyCount = channels.filter(c => c.status === 'READY').length;
  const warnCount = channels.filter(c => c.status === 'READY_WITH_WARNINGS' || c.status === 'BLOCKED').length;
  const emptyCount = channels.filter(c => c.status === 'EMPTY').length;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesDropped(e.dataTransfer.files);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="p-6 bg-naksha-darkest overflow-y-auto max-h-[480px] relative transition-colors"
    >
      {/* Drag and Drop Active Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-400 z-30 flex flex-col items-center justify-center pointer-events-none">
          <UploadCloud className="w-12 h-12 text-blue-400 animate-bounce mb-2" />
          <h2 className="text-lg font-bold text-white">Drop Survey Files or Folders Here</h2>
          <p className="text-xs text-blue-200 mt-1">
            Naksha 2.0 Ingestion Router will automatically correlate and place into the 10 Input Types.
          </p>
        </div>
      )}

      {/* Deck Controls & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2 tracking-wide uppercase">
            <Layers className="w-4 h-4 text-blue-400" />
            10 INPUT TYPES
            <span className="text-[11px] font-mono font-normal text-slate-400">
              (All Datasets Correlated)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any channel to audit its Pre-Flight Requirements, point densities, and quality scores.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-md transition-all ${
              filter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All (10)
          </button>
          <button
            onClick={() => setFilter('READY')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
              filter === 'READY' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Ready ({readyCount})
          </button>
          <button
            onClick={() => setFilter('WARNINGS')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-all ${
              filter === 'WARNINGS' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Needs Attention ({warnCount})
          </button>
          <button
            onClick={() => setFilter('EMPTY')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              filter === 'EMPTY' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Empty ({emptyCount})
          </button>
        </div>
      </div>

      {/* Grid of the 10 Input Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {filteredChannels.map((channel) => (
          <InputCard
            key={channel.categoryId}
            channel={channel}
            onSelect={onSelectChannel}
          />
        ))}
      </div>
    </div>
  );
};
