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
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="w-full max-w-md bg-[#04080e]/95 border border-[#a855f7] shadow-2xl shadow-[#a855f7]/5 relative overflow-hidden z-10 backdrop-blur-xl"
          >
            {/* Top Warning Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#a855f7] via-[#a855f7]/70 to-[#39ff14]/70"></div>

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-3.5 mb-5">
                <div className="p-2.5 bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#a855f7] rounded shadow-md">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xs tracking-wider uppercase font-mono">Disambiguation Anchors</h3>
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal font-sans">
                    The query <span className="font-semibold text-[#a855f7] font-bold font-mono">"{ambiguousName}"</span> matches multiple identities. Please provide demographic constraints.
                  </p>
                </div>
              </div>

              {/* Form fields */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[8px] uppercase font-bold tracking-widest text-gray-500 font-mono">Anchor City / Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 focus:border-[#39ff14] rounded px-10 py-1.5 text-xs text-gray-200 font-mono outline-none transition-all"
                      placeholder="e.g. Ahmedabad, Mumbai"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[8px] uppercase font-bold tracking-widest text-gray-500 font-mono">Approx Age</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2 w-4 h-4 text-gray-500" />
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 focus:border-[#39ff14] rounded px-10 py-1.5 text-xs text-gray-200 font-mono outline-none transition-all"
                        placeholder="28"
                        min="0"
                        max="120"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[8px] uppercase font-bold tracking-widest text-gray-500 font-mono">Employer Entity</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        value={employer}
                        onChange={(e) => setEmployer(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 focus:border-[#39ff14] rounded px-10 py-1.5 text-xs text-gray-200 font-mono outline-none transition-all"
                        placeholder="e.g. SVNIT"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end gap-2.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[#39ff14]/15 border border-[#39ff14] hover:bg-[#39ff14]/25 text-[#39ff14] rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
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
