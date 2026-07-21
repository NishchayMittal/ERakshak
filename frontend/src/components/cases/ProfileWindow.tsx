import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardContext } from '../../pages/DashboardContext';

export function ProfileWindow() {
  const { 
    user, 
    profileName, 
    setProfileName, 
    showProfilePassInput, 
    setShowProfilePassInput,
    profilePass,
    setProfilePass,
    profileUpdating,
    handleProfileSubmit,
    pendingApprovals,
    loadingPending,
    handleApprove,
    handleReject
  } = useDashboardContext();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      <div className="border-b border-white/5 pb-2">
        <h3 className="text-[10px] font-bold text-white tracking-widest uppercase">{t('profile.title')}</h3>
        <p className="text-[8px] text-gray-500 font-mono mt-0.5">{t('profile.description')}</p>
      </div>

      <form onSubmit={handleProfileSubmit} className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[8px] text-gray-500 font-bold font-mono">{t('profile.role_label')}</label>
          <input
            type="text"
            value={user?.role || 'Lead Investigator'}
            disabled
            className="bg-black/20 border border-white/5 text-gray-500 text-[9px] px-3 py-1.5 outline-none font-mono cursor-not-allowed uppercase"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[8px] text-gray-500 font-bold font-mono">{t('profile.name_label')}</label>
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            className="bg-black border border-white/10 text-gray-200 text-[9px] px-3 py-1.5 focus:border-[#39ff14] outline-none"
          />
        </div>

        {!showProfilePassInput ? (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setShowProfilePassInput(true)}
              className="px-3 py-1.5 bg-[#39ff14]/15 border border-[#39ff14] hover:bg-[#39ff14]/25 text-[#39ff14] text-[9px] font-bold uppercase tracking-wider transition-all"
            >
              {t('profile.change_passphrase')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[8px] text-gray-500 font-bold font-mono">{t('profile.new_passphrase')}</label>
              <input
                type="password"
                placeholder={t('profile.passphrase_placeholder')}
                value={profilePass}
                onChange={(e) => setProfilePass(e.target.value)}
                className="bg-black border border-white/10 text-gray-200 text-[9px] px-3 py-1.5 focus:border-[#39ff14] outline-none w-full font-mono"
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowProfilePassInput(false);
                  setProfilePass('');
                }}
                className="text-[8px] text-gray-500 hover:text-white uppercase font-bold"
              >
                {t('profile.cancel_password')}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={profileUpdating}
          className="w-full bg-[#a855f7] hover:bg-[#a855f7]/85 text-black disabled:bg-white/5 disabled:text-gray-600 text-[9px] font-bold py-2 uppercase text-center mt-2"
        >
          {profileUpdating ? t('profile.updating') : t('profile.update_config')}
        </button>
      </form>

      {user?.badgeNumber === 'INV-001' && (
        <div className="mt-6 border-t border-white/5 pt-4">
          <div className="border-b border-white/5 pb-2 mb-3">
            <h4 className="text-[9px] font-bold text-[#39ff14] tracking-widest uppercase">{t('profile.pending_title')}</h4>
            <p className="text-[8px] text-gray-500 font-mono mt-0.5">{t('profile.pending_desc')}</p>
          </div>

          <div className="flex flex-col gap-2">
            {loadingPending ? (
              <span className="text-[8px] text-gray-500 font-mono animate-pulse">{t('profile.fetching')}</span>
            ) : pendingApprovals.length === 0 ? (
              <span className="text-[8px] text-gray-600 font-mono italic">{t('profile.no_pending')}</span>
            ) : (
              pendingApprovals.map((req) => (
                <div key={req.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[9px] font-bold text-white truncate font-mono uppercase">{req.full_name}</span>
                    <span className="text-[8px] text-gray-500 font-mono">{t('profile.badge_id')}{req.badge_id}</span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(req.id, req.full_name)}
                      className="px-2 py-1 bg-[#39ff14]/15 border border-[#39ff14] hover:bg-[#39ff14]/25 text-[#39ff14] text-[8px] font-bold uppercase transition-all"
                    >
                      {t('profile.approve')}
                    </button>
                    <button
                      onClick={() => handleReject(req.id, req.full_name)}
                      className="px-2 py-1 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 text-[8px] font-bold uppercase transition-all"
                    >
                      {t('profile.deny')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
