import React from 'react';
import AttributeRow from './AttributeRow';
import { useGraphStore } from '../../state/graphStore';
import type { ProfileAttribute } from '../../types/profile';

export default function ProfileCard() {
  const { evidencePack, selectedEntityId, loading } = useGraphStore();

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="w-1/2 h-4 bg-slate-800 rounded"></div>
            <div className="w-1/4 h-3 bg-slate-800 rounded"></div>
          </div>
        </div>
        <div className="h-px bg-slate-800"></div>
        <div className="space-y-3">
          <div className="w-full h-8 bg-slate-800 rounded"></div>
          <div className="w-full h-8 bg-slate-800 rounded"></div>
          <div className="w-full h-8 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!selectedEntityId || !evidencePack) {
    return (
      <div className="bg-slate-900 border border-slate-855 rounded-lg p-5 text-center py-10">
        <svg className="w-10 h-10 text-slate-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <p className="text-xs text-slate-500 font-medium">
          Select any node in the link graph to view consolidated attributes and credentials.
        </p>
      </div>
    );
  }

  // Resolve matching attributes from Evidence Pack
  let displayName = selectedEntityId;
  let attributes: ProfileAttribute[] = [];

  // 1. Direct match on identifier values
  const activeIdentifier = evidencePack.identifiers.find(
    (i) => i.id === selectedEntityId || i.normalizedValue.toLowerCase() === selectedEntityId.toLowerCase()
  );

  if (activeIdentifier) {
    displayName = activeIdentifier.normalizedValue;
    attributes = activeIdentifier.findings.map((f) => ({
      key: f.type,
      value: f.value,
      source: f.connector,
      confidence: f.confidence,
      discoveredAt: f.discoveredAt || new Date().toISOString(),
    }));
  } else {
    // 2. Search inside child findings values
    for (const ident of evidencePack.identifiers) {
      const match = ident.findings.find(
        (f) => f.value.toLowerCase() === selectedEntityId.toLowerCase() || f.id === selectedEntityId
      );
      if (match) {
        displayName = match.value;
        attributes = ident.findings
          .filter((f) => f.value.toLowerCase() === match.value.toLowerCase())
          .map((f) => ({
            key: f.type,
            value: f.value,
            source: f.connector,
            confidence: f.confidence,
            discoveredAt: f.discoveredAt || new Date().toISOString(),
          }));
        break;
      }
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Title */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-900/40 border border-indigo-700/50 flex items-center justify-center text-indigo-400 font-bold font-mono text-sm uppercase">
          {displayName.charAt(0)}
        </div>
        <div>
          <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Entity Profile Dossier</h3>
          <p className="text-[11px] text-slate-400 font-mono font-semibold truncate max-w-[180px]">
            {displayName}
          </p>
        </div>
      </div>

      {/* Attributes scroll block */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[300px]">
        {attributes.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-650 font-mono uppercase">
            No attributes associated with this entity.
          </div>
        ) : (
          attributes.map((attr, idx) => (
            <AttributeRow key={`${attr.key}-${idx}`} attribute={attr} />
          ))
        )}
      </div>
    </div>
  );
}
