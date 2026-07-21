import React, { useState, useEffect } from 'react';
import type { IdentifierType } from '../../types/identifier';
import { useTranslation } from 'react-i18next';

interface IdentifierFormProps {
  onAdd: (type: IdentifierType, value: string) => void;
}

export default function IdentifierForm({ onAdd }: IdentifierFormProps) {
  const { t } = useTranslation();
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
    } else if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmed)) {
      setType('ip');
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
        <h3 className="font-semibold text-slate-200 text-sm mb-1">{t('intake_form.title')}</h3>
        <p className="text-[11px] text-slate-500">
          {t('intake_form.description')}
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
            placeholder={t('intake_form.placeholder')}
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
            <option value="email">{t('case_window.email_address')}</option>
            <option value="phone">{t('case_window.phone_number')}</option>
            <option value="name">{t('case_window.individual_name')}</option>
            <option value="username">{t('case_window.social_username')}</option>
            <option value="domain">{t('case_window.domains')}</option>
            <option value="ip">{t('case_window.ip_address')}</option>
            <option value="wallet">{t('case_window.crypto_wallet')}</option>
            <option value="photo">{t('case_window.photo_url')}</option>
            <option value="other">{t('case_window.other_fallback')}</option>
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold hover:shadow hover:shadow-indigo-500/10 transition-all flex-shrink-0"
        >
          {t('intake_form.add_seed')}
        </button>
      </div>
    </form>
  );
}
