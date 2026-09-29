import React from 'react';
import { 
  Camera, 
  Cpu, 
  Map, 
  Navigation, 
  Mountain, 
  Building, 
  FileText, 
  Image as ImageIcon, 
  Sliders, 
  FolderArchive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  UploadCloud
} from 'lucide-react';
import { InputChannel } from '../types/naksha';

interface InputCardProps {
  channel: InputChannel;
  onSelect: (channel: InputChannel) => void;
}

export const InputCard: React.FC<InputCardProps> = ({ channel, onSelect }) => {
  // Category-specific iconography
  const getCategoryIcon = (num: number) => {
    switch (num) {
      case 1: return <Camera className="w-5 h-5 text-sky-400" />;
      case 2: return <Cpu className="w-5 h-5 text-indigo-400" />;
      case 3: return <Map className="w-5 h-5 text-emerald-400" />;
      case 4: return <Navigation className="w-5 h-5 text-blue-400" />;
      case 5: return <Mountain className="w-5 h-5 text-teal-400" />;
      case 6: return <Building className="w-5 h-5 text-purple-400" />;
      case 7: return <FileText className="w-5 h-5 text-amber-400" />;
      case 8: return <ImageIcon className="w-5 h-5 text-cyan-400" />;
      case 9: return <Sliders className="w-5 h-5 text-rose-400" />;
      case 10: return <FolderArchive className="w-5 h-5 text-slate-400" />;
      default: return <FileText className="w-5 h-5 text-blue-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (channel.status) {
      case 'READY':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Ready ({channel.readinessScore}%)
          </span>
        );
      case 'READY_WITH_WARNINGS':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            Warnings ({channel.readinessScore}%)
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            Blocked
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60">
            <UploadCloud className="w-3 h-3" />
            Awaiting Data
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect(channel)}
      className="glass-card rounded-xl p-4 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
    >
      {/* Top Header: Channel Number & Icon */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 group-hover:border-blue-500/40 transition-colors">
              {getCategoryIcon(channel.channelNumber)}
            </div>
            <div>
              <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                INPUT TYPE {channel.channelNumber.toString().padStart(2, '0')}
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                {channel.displayName}
              </h3>
            </div>
          </div>

          <div>{getStatusBadge()}</div>
        </div>

        {/* Primary Metric & Summary */}
        <div className="mt-2">
          <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
            <span>{channel.primaryMetric}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
            {channel.summary}
          </p>
        </div>
      </div>

      {/* Footer: Supported Formats & Readiness Progress */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <div className="flex gap-1 overflow-hidden">
          {channel.supportedExtensions.slice(0, 3).map((ext) => (
            <span key={ext} className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/40">
              {ext}
            </span>
          ))}
          {channel.supportedExtensions.length > 3 && (
            <span className="text-slate-600">+{channel.supportedExtensions.length - 3}</span>
          )}
        </div>

        <span className="text-blue-400 group-hover:underline flex items-center gap-1 font-sans font-medium text-[11px]">
          Pre-Flight Specs &rarr;
        </span>
      </div>

      {/* Status Bar Indicator at top */}
      <div 
        className={`absolute top-0 left-0 right-0 h-[2px] ${
          channel.status === 'READY' ? 'bg-emerald-500' :
          channel.status === 'READY_WITH_WARNINGS' ? 'bg-amber-500' :
          channel.status === 'BLOCKED' ? 'bg-rose-500' : 'bg-transparent'
        }`} 
      />
    </div>
  );
};
