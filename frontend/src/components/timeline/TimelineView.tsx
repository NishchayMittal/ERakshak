import React from 'react';
import { useGraphStore } from '../../state/graphStore';

export default function TimelineView() {
  const { evidencePack, selectedEntityId, loading } = useGraphStore();

  if (loading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 36, background: 'var(--bg-1)', border: '1px solid var(--struct-line)', animation: 'blink 1.5s step-start infinite' }} />
        ))}
      </div>
    );
  }

  if (!selectedEntityId || !evidencePack) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 12, padding: 24,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '1px solid var(--struct-line)', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--struct-line)' }} />
        </div>
        SELECT A NODE TO<br/>LOAD TIMELINE EVENTS
      </div>
    );
  }

  // Compile timeline events from evidencePack findings
  let events: Array<{ id: string; date: string; label: string; source: string; entityId: string }> = [];

  const activeIdentifier = evidencePack.identifiers.find(
    (i) => i.id === selectedEntityId || i.normalizedValue.toLowerCase() === selectedEntityId.toLowerCase()
  );

  if (activeIdentifier) {
    events = activeIdentifier.findings
      .filter((f) => f.discoveredAt)
      .map((f) => ({
        id: f.id,
        date: f.discoveredAt ? f.discoveredAt.split('T')[0] : new Date().toISOString().split('T')[0],
        label: f.rawPayload?.label || `${f.connector.toUpperCase()} — Detected ${f.type.replace(/_/g, ' ')}: ${f.value}`,
        source: f.connector,
        entityId: selectedEntityId,
      }));
  } else {
    for (const ident of evidencePack.identifiers) {
      const match = ident.findings.find(
        (f) => f.value.toLowerCase() === selectedEntityId.toLowerCase() || f.id === selectedEntityId
      );
      if (match) {
        events = ident.findings
          .filter((f) => f.value.toLowerCase() === match.value.toLowerCase() && f.discoveredAt)
          .map((f) => ({
            id: f.id,
            date: f.discoveredAt ? f.discoveredAt.split('T')[0] : new Date().toISOString().split('T')[0],
            label: f.rawPayload?.label || `${f.connector.toUpperCase()} — Detected ${f.type.replace(/_/g, ' ')}: ${f.value}`,
            source: f.connector,
            entityId: selectedEntityId,
          }));
        break;
      }
    }
  }

  if (events.length === 0) {
    return (
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--text-muted)', padding: '24px', textAlign: 'center',
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        NO CHRONOLOGICAL EVENTS LOGGED
      </div>
    );
  }

  // Sort chronological ascending
  const sortedData = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
          fontFamily: 'var(--font-heading)', fontSize: 10,
          color: 'var(--accent-primary)', letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14, color: 'var(--accent-primary)', lineHeight: 1 }}>⌐</span>
          EVENT TIMELINE
          <span style={{ fontSize: 14, color: 'var(--accent-primary)', lineHeight: 1, transform: 'scaleX(-1)', display: 'inline-block' }}>⌐</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8,
          color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.08em',
        }}>
          CHRONOLOGICAL AUDIT FOOTPRINTS COLLECTED IN REALTIME
        </div>
      </div>

      {/* Timeline track container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        <div style={{ position: 'relative', paddingLeft: 20, borderLeft: '1px solid var(--struct-line)' }}>
          {sortedData.map((event) => (
            <div key={event.id} style={{ position: 'relative', marginBottom: 20 }}>
              {/* Event node dot indicator */}
              <span style={{
                position: 'absolute', left: -25, top: 4,
                width: 9, height: 9, borderRadius: '50%',
                background: 'var(--bg-0)',
                border: '2px solid var(--accent-primary)',
                boxShadow: '0 0 4px var(--accent-primary)',
              }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                  color: 'var(--accent-primary)',
                  background: 'rgba(0,255,194,0.05)',
                  border: '1px solid rgba(0,255,194,0.15)',
                  padding: '2px 6px',
                }}>
                  {event.date}
                </span>
                
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {event.source}
                </span>
              </div>

              <p style={{
                margin: 0,
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--text-primary)',
                lineHeight: '1.4',
                wordBreak: 'break-all',
              }}>
                {event.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
