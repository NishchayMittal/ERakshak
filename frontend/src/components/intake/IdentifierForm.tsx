import React, { useState, useEffect } from 'react';
import type { IdentifierType } from '../../types/identifier';

interface IdentifierFormProps {
  onAdd: (type: IdentifierType, value: string) => void;
}

export default function IdentifierForm({ onAdd }: IdentifierFormProps) {
  const [value, setValue] = useState('');
  const [type, setType] = useState<IdentifierType>('email');

  // Simple heuristic router for auto-detecting identifier types
  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (trimmed.includes('@')) {
      setType('email');
    } else if (/^\+?\d[\d-\s()]{7,}\d$/.test(trimmed)) {
      setType('phone');
    } else if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(trimmed) || trimmed.includes('.') && !trimmed.includes(' ')) {
      setType('domain');
    } else if (/^(0x)?[0-9a-fA-F]{40}$/.test(trimmed) || /^[139][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) {
      setType('wallet');
    } else if (trimmed.includes(' ') && trimmed.length > 3) {
      setType('name');
    } else if (trimmed.length > 2) {
      setType('username');
    }
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    onAdd(type, trimmed);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-200 text-sm mb-1">Add Seed Identifier</h3>
        <p className="text-[11px] text-slate-500">
          Enter a seed value. The system will auto-detect the type but you can override it manually.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {/* Value Input */}
        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-600"
            placeholder="e.g. suspect@domain.com, +91-9876543210, John Patel"
            required
          />
        </div>

        {/* Type Selector */}
        <div className="w-full md:w-48">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IdentifierType)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
          >
            <option value="email">Email Address</option>
            <option value="phone">Phone Number</option>
            <option value="name">Individual Name</option>
            <option value="username">Username / Alias</option>
            <option value="domain">Domain Name / URL</option>
            <option value="wallet">Crypto Wallet Address</option>
            <option value="photo">Photo / Face URL</option>
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold hover:shadow hover:shadow-indigo-500/10 transition-all flex-shrink-0"
        >
          Add Seed
        </button>
      </div>
    </form>
  );
}
