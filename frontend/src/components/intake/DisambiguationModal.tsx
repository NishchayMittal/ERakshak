import React, { useState } from 'react';

interface DisambiguationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (anchors: { city: string; age: string; employer: string }) => void;
  ambiguousName: string;
}

export default function DisambiguationModal({ isOpen, onClose, onSubmit, ambiguousName }: DisambiguationModalProps) {
  const [city, setCity] = useState('');
  const [age, setAge] = useState('');
  const [employer, setEmployer] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ city, age, employer });
    // Reset form states
    setCity('');
    setAge('');
    setEmployer('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-rose-900/50 rounded-xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Red accent line for warnings */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500"></div>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-3.5 mb-4">
            <div className="p-2 bg-rose-950/60 border border-rose-800 text-rose-400 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Anchor Disambiguation Required</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                The name <span className="font-semibold text-rose-300 font-mono">"{ambiguousName}"</span> has high collision risk. Please supply demographic anchors.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">City / Current Location</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                placeholder="e.g. Ahmedabad, Delhi, Hinglish alias location"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Approximate Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                  placeholder="e.g. 28"
                  min="0"
                  max="120"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Employer / Organization</label>
                <input
                  type="text"
                  value={employer}
                  onChange={(e) => setEmployer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                  placeholder="e.g. Reliance, SVNIT"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-xs shadow hover:shadow-rose-500/10 transition-all border border-rose-500/30"
              >
                Submit Anchors
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
