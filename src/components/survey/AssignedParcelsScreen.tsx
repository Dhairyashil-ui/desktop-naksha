import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { AssignedParcel, fetchAssignedParcels } from '../../services/surveyApi';

interface AssignedParcelsScreenProps {
  onOpenParcel: (parcel: AssignedParcel) => void;
}

export const AssignedParcelsScreen: React.FC<AssignedParcelsScreenProps> = ({ onOpenParcel }) => {
  const [parcels, setParcels] = useState<AssignedParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const data = await fetchAssignedParcels();
      if (mounted) {
        setParcels(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const handleOpen = (parcel: AssignedParcel) => {
    onOpenParcel(parcel);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full bg-white text-zinc-900 flex flex-col justify-between py-12 px-6 font-sans select-none">
      {/* Top Header */}
      <div className="w-full max-w-3xl mx-auto flex items-center justify-between text-xs text-zinc-400">
        <span className="font-mono tracking-[0.25em] font-semibold uppercase text-zinc-400">
          FIELD MANDATE
        </span>
        <span className="font-mono text-zinc-400">
          HAW-SURVEY-2026
        </span>
      </div>

      {/* Main Section */}
      <div className="w-full max-w-3xl mx-auto my-auto py-8">
        <div className="mb-8 text-left">
          <h1 className="text-xl font-mono font-bold tracking-tight text-zinc-900 uppercase">
            [ Assigned Parcels ]
          </h1>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Select an assigned survey parcel to begin data ingestion and 3D demarcation.
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            <span className="text-xs font-mono text-zinc-400">Querying cadastral database...</span>
          </div>
        ) : parcels.length === 0 ? (
          <div className="p-8 border border-zinc-200 rounded-xl text-center space-y-2">
            <div className="text-sm font-bold text-zinc-800">No Assigned Parcels Found</div>
            <p className="text-xs text-zinc-400 font-mono">
              All cadastral mandates for this field station have been processed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {parcels.map((parcel) => {
              const isSelected = selectedId === parcel.id;

              return (
                <div
                  key={parcel.id}
                  onClick={() => setSelectedId(parcel.id)}
                  className={`p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-50/70 shadow-xs'
                      : 'border-zinc-200 hover:border-zinc-400 bg-white'
                  }`}
                >
                  {/* Left: Survey No, Location, Area */}
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-mono font-bold text-zinc-900">
                        Survey No. {parcel.surveyNumber}/{parcel.subDivision}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 uppercase">
                        {parcel.status}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-500 font-mono">
                      {parcel.location}
                    </div>

                    <div className="text-xs font-mono text-zinc-400">
                      Area: <span className="font-semibold text-zinc-700">{parcel.legalAreaSqm.toFixed(1)} m²</span> (GIS: {parcel.gisAreaSqm.toFixed(1)} m²)
                    </div>
                  </div>

                  {/* Right: OPEN Button */}
                  <div className="flex items-center sm:justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(parcel);
                      }}
                      className="w-full sm:w-auto py-2.5 px-6 rounded-lg text-xs font-bold font-mono tracking-widest uppercase transition-all bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white shadow-xs flex items-center justify-center space-x-2"
                    >
                      <span>[ OPEN ]</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subtle Footer */}
      <div className="w-full max-w-3xl mx-auto text-center text-[11px] font-mono text-zinc-400">
        Direct PostgreSQL / PostGIS Cadastral Registry Feed
      </div>
    </div>
  );
};
