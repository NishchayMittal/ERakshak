import React, { useState, useEffect } from 'react';
import { useUIStore } from '../state/uiStore';
import { uploadSuspectImage, getSuspects, deleteSuspectPhoto } from '../api/endpoints';
import { apiClient } from '../api/client';
import { Plus, Trash2, User, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useUIStore();
  const [suspectName, setSuspectName] = useState('');
  const [suspectUploading, setSuspectUploading] = useState(false);
  const [suspects, setSuspects] = useState<Array<{ name: string; label: string; photos: Array<{ filename: string; url: string }> }>>([]);
  const [addingPhotoForSuspect, setAddingPhotoForSuspect] = useState<string | null>(null);
  const [expandedSuspects, setExpandedSuspects] = useState<Record<string, boolean>>({});

  const toggleExpandSuspect = (name: string) => {
    setExpandedSuspects(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const fetchSuspects = async () => {
    try {
      const res = await getSuspects();
      setSuspects(res);
    } catch (err) {
      console.error("Failed to load suspects", err);
    }
  };

  useEffect(() => {
    fetchSuspects();
  }, []);

  const handleRegisterSuspect = async (file: File) => {
    if (!suspectName.trim()) {
      showToast('Please enter suspect name first', 'error');
      return;
    }
    setSuspectUploading(true);
    try {
      const res = await uploadSuspectImage(suspectName, file);
      showToast(`Registered suspect: ${res.label}`, 'success');
      setSuspectName('');
      fetchSuspects();
    } catch (err) {
      console.error(err);
      showToast('Failed to upload suspect profile', 'error');
    } finally {
      setSuspectUploading(false);
    }
  };

  const handleAddPhotoToSuspect = async (suspectLabel: string, file: File) => {
    setAddingPhotoForSuspect(suspectLabel);
    try {
      const res = await uploadSuspectImage(suspectLabel, file);
      showToast(`Added photo to suspect: ${res.label}`, 'success');
      fetchSuspects();
    } catch (err) {
      console.error(err);
      showToast('Failed to add photo to suspect', 'error');
    } finally {
      setAddingPhotoForSuspect(null);
    }
  };

  const handleDeletePhoto = async (filename: string) => {
    try {
      await deleteSuspectPhoto(filename);
      showToast("Suspect photo deleted", "success");
      fetchSuspects();
    } catch (err) {
      showToast("Failed to delete photo", "error");
    }
  };

  const getBaseURL = () => {
    const base = apiClient.defaults.baseURL || '';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none' }}>
      
      {/* Header Panel */}
      <div className="hud-panel" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            SUSPECT REGISTRY & DATABASE
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-muted)', letterSpacing: '0.08em',
          }}>
            MANAGE OFF-LINE FACIAL RECOGNITION TARGETS AND SUSPECT DOSSIERS
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Left Column: Suspect Registry Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="hud-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
              color: 'var(--accent-label)', letterSpacing: '0.15em', textTransform: 'uppercase',
              borderBottom: '1px solid var(--struct-line)', paddingBottom: 8,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <User className="w-4 h-4" />
              SUSPECT DATABASE REGISTRY
            </div>

            <p style={{
              margin: 0,
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--text-muted)', letterSpacing: '0.05em', lineHeight: '1.4'
            }}>
              UPLOAD AND ENROLL PORTRAIT IMAGES DIRECTLY INTO THE LOCAL RECOGNITION DATABASE (AUTO-DISCOVERED FOR OFF-LINE FACE CORRELATION MATCHING).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>
                  SUSPECT FULL NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={suspectName}
                  onChange={(e) => setSuspectName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--struct-line)',
                    color: 'white',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '8px 10px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label className="cursor-pointer bg-neutral-900 border border-white/10 hover:border-[#39ff14] text-gray-400 hover:text-white px-3 py-2 rounded text-[10px] transition-all flex items-center gap-1.5 font-mono flex-shrink-0">
                  <span>SELECT PORTRAIT FILE</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      handleRegisterSuspect(file);
                    }}
                    className="hidden"
                    disabled={suspectUploading}
                  />
                </label>
                {suspectUploading && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#39ff14' }} className="animate-pulse">
                    ENROLLING PORTRAIT...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Suspect Catalog view */}
        <div className="hud-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 300 }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
            color: 'var(--accent-label)', letterSpacing: '0.15em', textTransform: 'uppercase',
            borderBottom: '1px solid var(--struct-line)', paddingBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <Shield className="w-4 h-4" />
            ENROLLED SUSPECT PROFILES
          </div>

          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '12px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            {suspects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 9 }}>
                NO SUSPECTS CURRENTLY ENROLLED IN THE DATABASE
              </div>
            ) : (
              suspects.map((suspect) => {
                const isExpanded = !!expandedSuspects[suspect.name];
                return (
                  <div key={suspect.name} style={{ border: '1px solid var(--struct-line)', background: 'rgba(0,0,0,0.1)', marginBottom: 4 }}>
                    <div
                      onClick={() => toggleExpandSuspect(suspect.name)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 8 }}>
                          {isExpanded ? '▼' : '►'}
                        </span>
                        <User size={12} style={{ color: 'var(--accent-primary)' }} /> {suspect.label}
                        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 'normal', textTransform: 'lowercase' }}>
                          ({suspect.photos.length} {suspect.photos.length === 1 ? 'photo' : 'photos'})
                        </span>
                      </span>

                      {isExpanded && (
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer bg-white/5 border border-white/10 hover:border-[#39ff14] text-gray-400 hover:text-white px-2 py-0.5 rounded text-[8px] font-mono transition-all flex items-center gap-1"
                        >
                          <Plus size={10} />
                          <span>ADD PHOTO</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              handleAddPhotoToSuspect(suspect.label, file);
                            }}
                            className="hidden"
                            disabled={addingPhotoForSuspect !== null}
                          />
                        </label>
                      )}
                    </div>

                    {isExpanded && (
                      <div style={{ padding: 10, borderTop: '1px solid var(--struct-line)', background: 'rgba(0,0,0,0.15)' }}>
                        {addingPhotoForSuspect === suspect.label && (
                          <div style={{ fontSize: 8, color: '#39ff14', fontFamily: 'var(--font-mono)', marginBottom: 4 }} className="animate-pulse">
                            ADDING PORTRAIT...
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {suspect.photos.map((photo) => (
                            <div key={photo.filename} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--struct-line)', padding: 4, background: 'black' }}>
                              <img
                                src={`${getBaseURL()}${photo.url}`}
                                alt={suspect.label}
                                style={{ width: 48, height: 48, objectFit: 'cover', border: '1px solid var(--struct-line)' }}
                                onError={(e) => {
                                  e.currentTarget.src = photo.url;
                                }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={photo.filename}>
                                  {photo.filename}
                                </span>
                                <button
                                  onClick={() => handleDeletePhoto(photo.filename)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ff3b30', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 'bold' }}
                                >
                                  <Trash2 size={10} />
                                  <span>DELETE</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
