import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, MapPin, Calendar, Building, Check, X } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ city, age, employer });
    setCity('');
    setAge('');
    setEmployer('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="w-full max-w-md bg-slate-900 border border-rose-500/25 rounded-lg shadow-2xl relative overflow-hidden z-10 cyber-panel"
          >
            {/* Top Warning Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500"></div>

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-3.5 mb-5">
                <div className="p-2.5 bg-rose-950/60 border border-rose-800/40 text-rose-450 rounded shadow-md">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm tracking-wider uppercase font-mono">Disambiguation Anchors</h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal font-sans">
                    The query <span className="font-semibold text-rose-350 font-mono">"{ambiguousName}"</span> matches multiple identities. Please provide demographic constraints.
                  </p>
                </div>
              </div>

              {/* Form fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[9px] uppercase font-bold tracking-widest text-slate-450 font-mono">Anchor City / Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 rounded px-10 py-2.5 text-xs text-slate-200 font-mono outline-none"
                      placeholder="e.g. Ahmedabad, Mumbai"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase font-bold tracking-widest text-slate-450 font-mono">Approx Age</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 rounded px-10 py-2.5 text-xs text-slate-200 font-mono outline-none"
                        placeholder="28"
                        min="0"
                        max="120"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] uppercase font-bold tracking-widest text-slate-450 font-mono">Employer Entity</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={employer}
                        onChange={(e) => setEmployer(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 rounded px-10 py-2.5 text-xs text-slate-200 font-mono outline-none"
                        placeholder="e.g. SVNIT"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-indigo-500/10 flex justify-end gap-2 text-xs font-semibold font-sans">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded border border-slate-750 flex items-center gap-1 uppercase text-[10px]"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded border border-rose-550 shadow-lg hover:shadow-rose-600/10 flex items-center gap-1 uppercase text-[10px]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Inject Anchors</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
