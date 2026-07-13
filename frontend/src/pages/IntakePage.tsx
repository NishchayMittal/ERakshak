import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import IdentifierForm from '../components/intake/IdentifierForm';
import IdentifierChip from '../components/intake/IdentifierChip';
import DisambiguationModal from '../components/intake/DisambiguationModal';
import { useCaseStore } from '../state/caseStore';
import { useUIStore } from '../state/uiStore';
import { submitIdentifiers } from '../api/endpoints';
import type { IdentifierType } from '../types/identifier';

interface SeedItem {
  id: string;
  type: IdentifierType;
  value: string;
}

export default function IntakePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { activeCase, selectCase } = useCaseStore();
  const { showToast } = useUIStore();

  const [seeds, setSeeds] = useState<SeedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDisambiguateOpen, setIsDisambiguateOpen] = useState(false);
  const [ambiguousName, setAmbiguousName] = useState('');

  // Hydrate active case context if direct loaded
  useEffect(() => {
    if (caseId) {
      selectCase(caseId);
    }
  }, [caseId, selectCase]);

  const handleAddSeed = (type: IdentifierType, value: string) => {
    // Prevent duplicates
    if (seeds.some(s => s.type === type && s.value.toLowerCase() === value.toLowerCase())) {
      showToast('Identifier already added to pending list', 'info');
      return;
    }

    const newSeed: SeedItem = {
      id: `seed-${Date.now()}`,
      type,
      value
    };
    
    setSeeds([...seeds, newSeed]);
    showToast(`Added ${type} seed to analyze`, 'success');
  };

  const handleDeleteSeed = (id: string) => {
    setSeeds(seeds.filter(s => s.id !== id));
  };

  const handleRunAnalysis = async () => {
    if (seeds.length === 0) {
      showToast('Please add at least one seed identifier first', 'error');
      return;
    }

    if (!caseId) return;

    setSubmitting(true);
    try {
      // Structure seeds for the API schema
      const payload = seeds.map(s => ({
        type: s.type,
        rawValue: s.value,
      }));

      const res = await submitIdentifiers(caseId, payload);
      
      if (res.ambiguous) {
        // Find the first name seed to disambiguate
        const nameSeed = seeds.find(s => s.type === 'name');
        setAmbiguousName(nameSeed ? nameSeed.value : 'submitted name');
        setIsDisambiguateOpen(true);
      } else {
        showToast('OSINT source connectors triggered successfully', 'success');
        // Navigate to the main visualization screen
        navigate(`/cases/${caseId}/entities/n1`);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to trigger ingestion pipeline', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisambiguationSubmit = (anchors: { city: string; age: string; employer: string }) => {
    setIsDisambiguateOpen(false);
    showToast(`Anchors registered: [${anchors.city}, ${anchors.employer}]. Correlation pipeline active.`, 'success');
    // Navigate to visualization graph
    if (caseId) {
      navigate(`/cases/${caseId}/entities/n1`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/cases" className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 mb-1 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Case Dossiers
          </Link>
          <h1 className="text-xl font-bold tracking-wide text-slate-100">Seed Identifier Intake</h1>
          <p className="text-xs text-slate-400 mt-1">
            Feed seeds into the router. Connectors query whois, crt.sh, wayback, Sherlock, and breaches in parallel.
          </p>
        </div>
      </div>

      {/* Input form */}
      <IdentifierForm onAdd={handleAddSeed} />

      {/* Ingestion Board */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="font-semibold text-slate-200 text-sm mb-3">Pending Seeds to Analyze ({seeds.length})</h3>
        
        {seeds.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-600 border border-dashed border-slate-800 rounded-lg">
            No active seeds. Add identifiers using the form above to initialize analysis.
          </div>
        ) : (
          <div className="space-y-6">
            {/* List of Chips */}
            <div className="flex flex-wrap gap-2.5">
              {seeds.map((s) => (
                <IdentifierChip 
                  key={s.id} 
                  id={s.id} 
                  type={s.type} 
                  rawValue={s.value} 
                  onDelete={handleDeleteSeed} 
                />
              ))}
            </div>

            {/* Run Button */}
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={submitting}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow hover:shadow-indigo-500/10 transition-all flex items-center gap-2 border border-indigo-500/30 disabled:opacity-55"
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Triggering Connectors...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Execute Intake Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Disambiguation Modal Popup */}
      <DisambiguationModal
        isOpen={isDisambiguateOpen}
        onClose={() => setIsDisambiguateOpen(false)}
        onSubmit={handleDisambiguationSubmit}
        ambiguousName={ambiguousName}
      />
    </div>
  );
}
