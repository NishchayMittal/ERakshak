import React, { useState, useEffect } from 'react';
import { useCaseStore } from '../../state/caseStore';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../state/uiStore';
import { useTranslation } from 'react-i18next';

interface NotesPanelProps {
  caseId: string;
}

export default function NotesPanel({ caseId }: NotesPanelProps) {
  const { notes, loadNotes, addCaseNote, activeCase } = useCaseStore();
  const { user } = useAuth();
  const { showToast } = useUIStore();
  const { t } = useTranslation();
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
      showToast(t('notes.note_logged'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('notes.note_failed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '0 0 12px 0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--struct-line)',
        background: '#030609',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: "calc(10px * var(--font-scale))",
          color: 'var(--accent-primary)', letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: "calc(14px * var(--font-scale))", color: 'var(--accent-primary)', lineHeight: 1 }}>⌐</span>
          {t('notes.title')}
          <span style={{ fontSize: "calc(14px * var(--font-scale))", color: 'var(--accent-primary)', lineHeight: 1, transform: 'scaleX(-1)', display: 'inline-block' }}>⌐</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: "calc(8px * var(--font-scale))",
          color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.08em',
        }}>
          {t('notes.subtitle')}
        </div>
      </div>

      {/* Case Tags */}
      {activeCase && (
        <div style={{
          padding: '8px 14px',
          background: 'rgba(0,0,0,0.15)',
          borderBottom: '1px solid var(--struct-line)',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(8px * var(--font-scale))", color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('notes.tags')}</span>
          {activeCase.tags.map((t) => (
            <span key={t} style={{
              fontFamily: 'var(--font-mono)', fontSize: "calc(8px * var(--font-scale))", color: 'var(--accent-primary)',
              background: 'rgba(0,255,194,0.05)', border: '1px solid rgba(0,255,194,0.15)',
              padding: '2px 6px',
            }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Notes List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {notes.length === 0 ? (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: "calc(9px * var(--font-scale))",
            color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center',
            letterSpacing: '0.1em',
          }}>
            {t('notes.no_notes')}
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} style={{
              background: '#0D1117',
              border: '1px solid var(--struct-line)',
              padding: '10px',
              marginBottom: '10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontFamily: 'var(--font-mono)', fontSize: "calc(8px * var(--font-scale))" }}>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{note.authorId}</span>
                <span style={{ color: 'var(--text-muted)' }}>{new Date(note.createdAt).toLocaleTimeString()}</span>
              </div>
              <p style={{
                margin: 0,
                fontFamily: 'var(--font-mono)', fontSize: "calc(9px * var(--font-scale))",
                color: 'var(--text-primary)',
                lineHeight: '1.4',
                wordBreak: 'break-all',
              }}>
                {note.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Write Form */}
      <form onSubmit={handleSubmit} style={{ padding: '8px 14px 0 14px', borderTop: '1px solid var(--struct-line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            width: '100%',
            background: '#0D1117',
            border: '1px solid var(--struct-line)',
            color: 'var(--text-primary)',
            padding: 8,
            fontSize: "calc(9px * var(--font-scale))",
            fontFamily: 'var(--font-mono)',
            outline: 'none',
            resize: 'none',
            minHeight: 50,
          }}
          placeholder={t('notes.placeholder')}
          required
        />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(8px * var(--font-scale))", color: 'var(--text-muted)' }}>
            {t('notes.signing_as')} <span style={{ color: 'var(--text-primary)' }}>{user?.name || 'Leon Lobo'}</span>
          </span>
          
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: 'none',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              fontFamily: 'var(--font-heading)', fontSize: "calc(9px * var(--font-scale))",
              fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '6px 12px', cursor: 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? t('notes.logging') : t('notes.log_note')}
          </button>
        </div>
      </form>
    </div>
  );
}
