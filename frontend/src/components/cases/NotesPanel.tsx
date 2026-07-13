import React, { useState, useEffect } from 'react';
import { useCaseStore } from '../../state/caseStore';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../state/uiStore';

interface NotesPanelProps {
  caseId: string;
}

export default function NotesPanel({ caseId }: NotesPanelProps) {
  const { notes, loadNotes, addCaseNote, activeCase } = useCaseStore();
  const { user } = useAuth();
  const { showToast } = useUIStore();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (caseId) {
      loadNotes(caseId);
    }
  }, [caseId, loadNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    try {
      const authorId = user?.name || 'Leon Lobo';
      await addCaseNote(caseId, authorId, text.trim());
      setText('');
      showToast('Investigative note logged in audit trail', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to write note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/20">
        <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Investigative Audit Notes</h3>
        <p className="text-[10px] text-slate-500 mt-0.5">Logs and observation summaries for this case.</p>
      </div>

      {/* Tags Display */}
      {activeCase && (
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Case Tags:</span>
          {activeCase.tags.map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[350px]">
        {notes.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-600">
            No notes logged yet. Author notes to document the link audit trail.
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="bg-slate-950/50 border border-slate-800/60 rounded p-3 text-xs">
              <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5 font-mono">
                <span className="font-semibold text-indigo-400">{note.authorId}</span>
                <span>{new Date(note.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-slate-300 leading-relaxed break-words">{note.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Write form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-950/20 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[64px] resize-none placeholder:text-slate-700"
          placeholder="Log findings, e.g. Domain registered to privacy proxy..."
          required
        ></textarea>
        
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            Signing as {user?.name || 'Leon Lobo'}
          </span>
          
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded text-[11px] transition-colors"
          >
            {submitting ? 'Logging...' : 'Log Note'}
          </button>
        </div>
      </form>
    </div>
  );
}
