import React, { useEffect, useState } from 'react';

const FEED_EVENTS = [
  'NODE_4471 CROSS-MATCHED :: CONFIDENCE 94%',
  'NEW BREACH RECORD INDEXED :: SOURCE:HIBP',
  'WHOIS_RDAP CONNECTOR :: domain resolv.io COMPLETED',
  'PIVOT_LOOP :: NEW IDENTIFIER DISCOVERED — email: j.doe@resolv.io',
  'LINK CONFIRMED BY ANALYST // edge_7f3c12',
  'XGBOOST INFERENCE :: 3 NEW EDGES SCORED',
  'CONNECTOR:USERNAME_ENUM :: 6 PLATFORMS MATCHED',
  'CERT_TRANSPARENCY :: 14 SUBDOMAINS FOUND FOR target-corp.io',
  'SHAP EXPLANATION COMPUTED :: TOP_FEATURE: email_domain_match',
  'RISK SCORE UPDATED :: ENTITY_0029 :: 87% ▲',
  'AUDIT LOG :: ACCESS GRANTED — BADGE L5-4471',
  'CANONICAL HASH VERIFIED :: NODE_0091 :: PASS',
  'FACE MATCH MODULE :: SIMILARITY 0.91 — FLAGGED',
  'CRT_SH CONNECTOR :: 2 NEW CERT RECORDS INDEXED',
  'LINK_GRAPH :: 312 ACTIVE NODES / 88 EDGES',
];

export default function StatusBar() {
  const [events, setEvents] = useState<string[]>([...FEED_EVENTS, ...FEED_EVENTS]);
  const [ts, setTs] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTs(now.toISOString().replace('T', ' ').slice(0, 19));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Occasionally inject new "live" events
  useEffect(() => {
    const id = setInterval(() => {
      const msg = FEED_EVENTS[Math.floor(Math.random() * FEED_EVENTS.length)];
      setEvents((prev) => {
        const updated = [...prev, `[${new Date().toISOString().slice(11, 19)}] ${msg}`];
        // Keep list at max 40 entries
        return updated.length > 40 ? updated.slice(updated.length - 40) : updated;
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        height: 32,
        background: '#030609',
        borderTop: '1px solid var(--struct-line)',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Left static label */}
      <div style={{
        padding: '0 12px',
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--accent-primary)', letterSpacing: '0.15em',
        borderRight: '1px solid var(--struct-line)',
        whiteSpace: 'nowrap', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--accent-primary)',
          animation: 'blink 2s step-start infinite',
          display: 'inline-block',
        }} />
        SYS_FEED
      </div>

      {/* Scrolling feed */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className="status-ticker" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {events.map((ev, i) => (
            <span key={i} style={{ marginRight: 48 }}>
              <span style={{ color: 'var(--accent-primary)', marginRight: 6 }}>▶</span>
              {ev}
            </span>
          ))}
        </div>
      </div>

      {/* Right: timestamp */}
      <div style={{
        padding: '0 12px',
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--text-muted)', letterSpacing: '0.08em',
        borderLeft: '1px solid var(--struct-line)',
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {ts} UTC
      </div>
    </div>
  );
}
