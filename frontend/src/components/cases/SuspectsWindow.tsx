import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../state/uiStore';
import { uploadSuspectImage, getSuspects, deleteSuspectPhoto } from '../../api/endpoints';
import { apiClient } from '../../api/client';
import { Plus, Trash2, User } from 'lucide-react';

export function SuspectsWindow() {
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
    setSuspectName('');
    setSuspectUploading(true);
    try {
      const res = await uploadSuspectImage(suspectName, file);
      showToast(`Registered suspect: ${res.label}`, 'success');
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
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      <div className="border-b border-white/5 pb-2">
        <h3 className="text-[10px] font-bold text-white tracking-widest uppercase">{t('suspects.title')}</h3>
        <p className="text-[8px] text-gray-500 font-mono mt-0.5">{t('suspects.description')}</p>
      </div>

      {/* Suspect Database Registry card */}
      <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
        <h4 className="text-[9px] font-bold text-[#39ff14] uppercase">SUSPECT DATABASE REGISTRY</h4>
        <p className="text-[8px] text-gray-500 font-mono mt-0.5">
          UPLOAD AND ENROLL PORTRAIT IMAGES DIRECTLY INTO THE LOCAL RECOGNITION DATABASE (AUTO-DISCOVERED FOR OFF-LINE FACE CORRELATION MATCHING).
        </p>

        <div className="flex flex-col gap-2">
          <div>
            <label className="block text-[8px] font-bold text-gray-400 uppercase mb-1 font-mono">
              SUSPECT FULL NAME
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={suspectName}
              onChange={(e) => setSuspectName(e.target.value)}
              className="w-full bg-black border border-white/10 text-gray-300 text-[10px] px-3 py-1.5 focus:border-[#39ff14] outline-none font-mono"
            />
          </div>

          <div className="flex gap-2 items-center">
            <label className="cursor-pointer bg-neutral-900 border border-white/10 hover:border-[#39ff14] text-gray-400 hover:text-white px-3 py-1.5 rounded text-[9px] transition-all flex items-center gap-1.5 font-mono flex-shrink-0">
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
              <span className="font-mono text-[8px] text-[#39ff14] animate-pulse">
                ENROLLING IMAGE INTO INDEX...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Suspects Catalog list */}
      <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-3 flex-1 min-h-[250px]">
        <h4 className="text-[9px] font-bold text-[#39ff14] uppercase">ENROLLED SUSPECT PROFILES</h4>

        <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-1">
          {suspects.length === 0 ? (
            <div className="text-gray-600 italic text-[9px] font-mono p-4 text-center">
              NO SUSPECTS CURRENTLY ENROLLED IN THE DATABASE
            </div>
          ) : (
            suspects.map((suspect) => {
              const isExpanded = !!expandedSuspects[suspect.name];
              return (
                <div key={suspect.name} className="border border-white/5 bg-black/20">
                  <div
                    onClick={() => toggleExpandSuspect(suspect.name)}
                    className="flex justify-between items-center p-2.5 cursor-pointer hover:bg-white/5 transition-colors select-none"
                  >
                    <span className="text-[10px] font-bold text-white tracking-wider flex items-center gap-2 uppercase font-mono">
                      <span className="text-gray-500 text-[8px] font-mono">
                        {isExpanded ? '▼' : '►'}
                      </span>
                      <User size={11} className="text-[#a855f7]" />
                      <span>{suspect.label}</span>
                      <span className="text-[8px] text-gray-500 font-normal font-mono lowercase">
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
                    <div className="p-2.5 pt-0 border-t border-white/5 flex flex-col gap-2 bg-black/10">
                      {addingPhotoForSuspect === suspect.label && (
                        <div className="text-[8px] text-[#39ff14] font-mono animate-pulse mt-2">
                          ADDING PORTRAIT TO PROFILE...
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mt-2">
                        {suspect.photos.map((photo) => (
                          <div key={photo.filename} className="relative group border border-white/10 bg-black p-1 flex items-center gap-1.5">
                            <img
                              src={`${getBaseURL()}${photo.url}`}
                              alt={suspect.label}
                              className="w-12 h-12 object-cover border border-white/5"
                              onError={(e) => {
                                e.currentTarget.src = photo.url;
                              }}
                            />
                            <div className="flex flex-col gap-1 pr-1.5">
                              <span className="text-[7.5px] text-gray-500 font-mono max-w-[80px] truncate" title={photo.filename}>
                                {photo.filename}
                              </span>
                              <button
                                onClick={() => handleDeletePhoto(photo.filename)}
                                className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-0.5 text-[8px] font-mono font-bold"
                                title="Delete photo"
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
  );
}
