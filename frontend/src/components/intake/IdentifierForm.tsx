import React, { useState } from 'react';
import type { IdentifierType } from '../../types/identifier';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';

export function validateSeed(type: string, value: string): boolean {
  const trimmed = value.trim();
  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    case 'ip':
      return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmed);
    case 'domain':
      return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(trimmed) || (trimmed.includes('.') && !trimmed.includes(' '));
    case 'name':
      return trimmed.includes(' ') && trimmed.length >= 3;
    case 'username':
      return trimmed.length >= 3 && !trimmed.includes(' ');
    case 'photo':
      return trimmed.length > 0;
    case 'other':
      return trimmed.length > 0;
    default:
      return false;
  }
}

interface IdentifierFormProps {
  onAdd: (type: IdentifierType, value: string) => void;
}

function detectType(trimmed: string): IdentifierType {
  if (!trimmed) return 'email';
  if (trimmed.includes('@')) return 'email';
  if (/\.(png|jpg|jpeg|webp|gif|bmp)(?:\?.*)?$/i.test(trimmed)) return 'photo';
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmed)) return 'ip';
  if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(trimmed) || (trimmed.includes('.') && !trimmed.includes(' '))) return 'domain';
  if (trimmed.includes(' ') && trimmed.length > 3) return 'name';
  if (trimmed.length > 2) return 'username';
  return 'email';
}

export default function IdentifierForm({ onAdd }: IdentifierFormProps) {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [value, setValue] = useState('');
  const [type, setType] = useState<IdentifierType>('email');
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    if (!validateSeed(type, trimmed)) {
      showToast('Invalid input for the selected identifier type.', 'error');
      return;
    }

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
        <div className="flex-grow flex gap-2 items-center">
          {type === 'photo' ? (
            <div className="flex gap-2 w-full items-center">
              <input
                type="text"
                value={(() => {
                  if (value.startsWith('http://') || value.startsWith('https://')) {
                    return value;
                  }
                  if (value.includes('/')) {
                    return value.split('/').pop() || value;
                  }
                  return value;
                })()}
                onChange={(e) => { const v = e.target.value; setValue(v); if (v.trim()) setType(detectType(v.trim())); }}
                className="flex-grow bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-600"
                placeholder={isUploading ? "Uploading file..." : "Paste face URL or select file →"}
                disabled={isUploading}
                required
              />
              <label className="cursor-pointer bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white px-3 py-2 rounded text-xs transition-all flex items-center gap-1.5 flex-shrink-0 font-mono">
                <span>SELECT FILE</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploading(true);
                    try {
                      const res = await uploadImage(file);
                      setValue(res.filename);
                    } catch (err) {
                      console.error("Upload failed", err);
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => { const v = e.target.value; setValue(v); if (v.trim()) setType(detectType(v.trim())); }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder:text-slate-600"
              placeholder={t('intake_form.placeholder')}
              required
            />
          )}
        </div>

        {/* Type Selector */}
        <div className="w-full md:w-48">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IdentifierType)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
          >
            <option value="email">{t('case_window.email_address')}</option>
            <option value="name">{t('case_window.individual_name')}</option>
            <option value="username">{t('case_window.social_username')}</option>
            <option value="domain">{t('case_window.domains')}</option>
            <option value="ip">{t('case_window.ip_address')}</option>
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
