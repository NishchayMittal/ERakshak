import React, { useState } from 'react';
import { Link } from 'react-router';
import { Edit2, Trash2, Check, X, Eye } from 'lucide-react';
import type { CaseSummary } from '../../types/case';
import { toggleCaseWatch } from '../../api/endpoints';
import { useCaseStore } from '../../state/caseStore';
import { useUIStore } from '../../state/uiStore';
import { Transliterate } from '../ui/Transliterate';

interface CaseCardProps {
  caseItem: CaseSummary;
  onSelect: (caseId: string) => void;
}

export default function CaseCard({ caseItem, onSelect }: CaseCardProps) {
  const isClosed = caseItem.status === 'closed';
  const { renameCase, deleteCase } = useCaseStore();
  const { showToast } = useUIStore();

  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(caseItem.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isWatched, setIsWatched] = useState(caseItem.is_watched || false);

  const handleWatchToggle = async () => {
    try {
      const res = await toggleCaseWatch(caseItem.caseId);
      setIsWatched(res.is_watched);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRename = async () => {
    if (!newTitle.trim()) return;
    try {
      await renameCase(caseItem.caseId, newTitle.trim());
      setIsEditing(false);
      showToast('CASE RENAMED', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to rename case', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCase(caseItem.caseId);
      showToast('CASE DELETED', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete case', 'error');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between hover:border-indigo-500/50 hover:glow-shadow transition-all group relative">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-800 group-hover:bg-indigo-500 transition-colors rounded-t-lg"></div>
      
      <div>
        <div className="flex justify-between items-start gap-2 mb-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{caseItem.caseId}</span>
          <div className="flex items-center gap-1.5 relative z-10">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
              isClosed 
                ? 'bg-slate-950 border-slate-700 text-slate-400' 
                : 'bg-indigo-950/40 border-indigo-500/20 text-indigo-400'
            }`}>
              {caseItem.status}
            </span>
            <button
              onClick={handleWatchToggle}
              className={`p-0.5 transition-all ${isWatched ? 'text-[var(--accent-primary)]' : 'text-slate-500 hover:text-slate-300'}`}
              style={isWatched ? { textShadow: '0 0 8px rgba(0,255,194,0.6)' } : {}}
              title={isWatched ? 'Unwatch Case' : 'Watch Case'}
            >
              <Eye size={13} />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-slate-500 hover:text-rose-500 p-0.5 transition-colors"
              title="Delete Case dossier"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1.5 mb-2 relative z-10">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setNewTitle(caseItem.title);
                }
              }}
              className="bg-slate-950 border border-indigo-500/30 text-white text-xs px-2 py-1 rounded w-full font-mono outline-none focus:border-indigo-500"
              autoFocus
            />
            <button
              onClick={handleRename}
              className="p-1 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded"
              title="Save Name"
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setNewTitle(caseItem.title);
              }}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-300 rounded"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-start justify-between group/title mb-2">
            <h3 
              onDoubleClick={() => setIsEditing(true)}
              className="font-bold text-slate-200 text-base leading-snug group-hover:text-white transition-colors cursor-pointer select-none"
            >
              <Transliterate>{caseItem.title}</Transliterate>
            </h3>
            <button
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover/title:opacity-100 hover:text-indigo-400 text-slate-500 p-0.5 transition-all relative z-10"
              title="Rename Case"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {(caseItem.tags ?? []).map((tag) => (
            <span 
              key={tag} 
              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between mt-auto">
        <div className="text-xs text-slate-500">
          <div className="font-semibold text-slate-400">{caseItem.entityCount} Entities</div>
          <div className="text-[10px]">Active {new Date(caseItem.lastActivity).toLocaleDateString()}</div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/cases/${caseItem.caseId}/intake`}
            onClick={() => onSelect(caseItem.caseId)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded text-xs transition-colors border border-slate-700 relative z-10"
          >
            Intake
          </Link>
          <Link
            to={`/cases/${caseItem.caseId}/entities/n1`}
            onClick={() => onSelect(caseItem.caseId)}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs transition-colors font-medium relative z-10"
          >
            Investigate
          </Link>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(4, 8, 14, 0.95)', border: '1px solid #ff3b30',
            padding: 24, width: 345, display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 0 24px rgba(255,59,48,0.15)',
            backdropFilter: 'blur(12px)',
          }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, color: '#ff3b30', letterSpacing: '0.15em' }}>
              CONFIRM DOSSIER DELETION
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#9ca3af', lineHeight: '1.4' }}>
              ARE YOU SURE YOU WANT TO PERMANENTLY DELETE CASE <span style={{ color: '#ffffff', fontWeight: 'bold' }}>"<Transliterate>{caseItem.title}</Transliterate>"</span>?
              <br/><br/>
              THIS WILL IRREVERSIBLY ERASE ALL INGESTED IDENTIFIERS, CORRELATED SUSPECT PROFILES, AND NOTES.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--struct-line)', paddingTop: 12 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#9ca3af', fontFamily: 'var(--font-mono)',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDelete();
                }}
                style={{
                  background: 'rgba(255,59,48,0.1)', border: '1px solid #ff3b30',
                  color: '#fca5a5', fontFamily: 'var(--font-mono)',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase',
                }}
              >
                DELETE DOSSIER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
