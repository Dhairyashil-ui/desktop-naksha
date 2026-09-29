import React, { useState } from 'react';
import { MapPin, Calendar, ArrowRight, Check } from 'lucide-react';

interface NewProjectScreenProps {
  onCreateProject: (data: { name: string; location: string; date: string }) => void;
}

export const NewProjectScreen: React.FC<NewProjectScreenProps> = ({ onCreateProject }) => {
  const [projectName, setProjectName] = useState('Pune_Residential_001');
  const [location, setLocation] = useState('Pune, Maharashtra (18.5204° N, 73.8567° E)');
  const [surveyDate, setSurveyDate] = useState('29 Sep 2026');
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onCreateProject({
      name: projectName,
      location,
      date: surveyDate
    });
  };

  const sampleLocations = [
    'Pune, Maharashtra (18.5204° N, 73.8567° E)',
    'Haveli Taluka, Pune (18.4575° N, 73.8677° E)',
    'Mulshi, Pune (18.5089° N, 73.5135° E)',
    'Baramati, Pune (18.1517° N, 74.5772° E)'
  ];

  return (
    <div className="min-h-screen w-full bg-white text-zinc-900 flex flex-col justify-between items-center py-16 px-6 font-sans">
      {/* Brand Header */}
      <div className="w-full max-w-sm text-center">
        <div className="text-xs font-mono font-semibold tracking-[0.25em] text-zinc-400 uppercase">
          NAKSHA 2.0
        </div>
      </div>

      {/* Main Minimalist Form */}
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-8 text-left">
          New Project
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Pune_Residential_001"
              required
              className="w-full px-3.5 py-2.5 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white text-zinc-900 text-sm rounded-lg border border-zinc-200 focus:border-zinc-900 focus:outline-none transition-all font-mono"
            />
          </div>

          {/* Location */}
          <div className="relative">
            <label className="block text-xs font-medium text-zinc-500 mb-2">
              Location
            </label>
            <div 
              onClick={() => setIsSelectingLocation(!isSelectingLocation)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 hover:bg-zinc-100/70 text-zinc-900 text-sm rounded-lg border border-zinc-200 cursor-pointer flex items-center justify-between transition-all"
            >
              <div className="flex items-center space-x-2 truncate">
                <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="truncate text-sm">{location || 'Select / Map'}</span>
              </div>
              <span className="text-xs text-zinc-400 shrink-0 font-medium">Select / Map</span>
            </div>

            {/* Quick Location Picker Popover */}
            {isSelectingLocation && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-lg shadow-xl p-2 z-20 space-y-1 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-mono font-medium text-zinc-400 px-2 py-1 uppercase">
                  Survey Jurisdictions
                </div>
                {sampleLocations.map((loc) => (
                  <div
                    key={loc}
                    onClick={() => {
                      setLocation(loc);
                      setIsSelectingLocation(false);
                    }}
                    className="px-2.5 py-1.5 rounded-md hover:bg-zinc-100 text-xs text-zinc-700 cursor-pointer flex items-center justify-between"
                  >
                    <span>{loc}</span>
                    {location === loc && <Check className="w-3.5 h-3.5 text-zinc-900" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Survey Date */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">
              Survey Date
            </label>
            <div className="relative">
              <input
                type="text"
                value={surveyDate}
                onChange={(e) => setSurveyDate(e.target.value)}
                placeholder="29 Sep 2026"
                required
                className="w-full px-3.5 py-2.5 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white text-zinc-900 text-sm rounded-lg border border-zinc-200 focus:border-zinc-900 focus:outline-none transition-all font-mono"
              />
              <Calendar className="w-4 h-4 text-zinc-400 absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white text-xs font-bold tracking-wider uppercase rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center space-x-2"
            >
              <span>CREATE PROJECT</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Minimal Footer */}
      <div className="w-full max-w-sm text-center">
        <span className="text-[11px] text-zinc-400 font-mono">
          Phase 0–5 Specification Conforming
        </span>
      </div>
    </div>
  );
};
