import React from 'react';
import { useTranslation } from 'react-i18next';

interface DashboardModalsProps {
  renameCaseState: { id: string; title: string; newTitle: string } | null;
  setRenameCaseState: (val: { id: string; title: string; newTitle: string } | null) => void;
  handleSaveRename: () => void;

  deleteConfirmCase: { id: string; title: string } | null;
  setDeleteConfirmCase: (val: { id: string; title: string } | null) => void;
  handleConfirmDelete: () => void;

  showLogoutConfirm: boolean;
  setShowLogoutConfirm: (val: boolean) => void;
  logout: () => void;
}

export default function DashboardModals({
  renameCaseState,
  setRenameCaseState,
  handleSaveRename,
  deleteConfirmCase,
  setDeleteConfirmCase,
  handleConfirmDelete,
  showLogoutConfirm,
  setShowLogoutConfirm,
  logout
}: DashboardModalsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Rename Case Modal */}
      {renameCaseState && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-[#39ff14] p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-[#39ff14]/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-[#39ff14] tracking-widest uppercase pb-2 border-b border-white/5">
              {t('modals.rename_title')}
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[8px] text-gray-500 uppercase tracking-wider">{t('modals.new_title_label')}</span>
              <input
                type="text"
                value={renameCaseState.newTitle}
                onChange={(e) => setRenameCaseState({ ...renameCaseState, newTitle: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setRenameCaseState(null);
                }}
                className="bg-black/40 border border-white/10 text-gray-100 text-xs px-3 py-2 rounded focus:border-[#39ff14] outline-none font-mono w-full transition-all"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5 mt-2">
              <button
                onClick={() => setRenameCaseState(null)}
                className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent"
                style={{ cursor: 'pointer' }}
              >
                {t('modals.cancel')}
              </button>
              <button
                onClick={handleSaveRename}
                className="px-3.5 py-1.5 bg-[#39ff14]/15 border border-[#39ff14] hover:bg-[#39ff14]/25 text-[#39ff14] rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
                style={{ cursor: 'pointer' }}
              >
                {t('modals.save_changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete/Archive Confirm Case Modal */}
      {deleteConfirmCase && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-red-500 p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-red-500/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-red-500 tracking-widest uppercase pb-2 border-b border-white/5">
              {deleteConfirmCase.id === 'multiple' ? t('modals.confirm_delete_multiple_title', 'DELETE MULTIPLE DOSSIERS') : t('modals.confirm_delete_title')}
            </div>
            <div className="font-mono text-[10px] text-gray-400 leading-relaxed">
              {deleteConfirmCase.id === 'multiple' ? t('modals.confirm_delete_multiple_body', 'Are you sure you want to permanently delete the selected dossiers?') : (
                <>
                  {t('modals.confirm_delete_body')} <span className="text-white font-bold">"{deleteConfirmCase.title}"</span>?
                </>
              )}
              <br /><br />
              {t('modals.confirm_delete_warning')}
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5 mt-2">
              <button
                onClick={() => setDeleteConfirmCase(null)}
                className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent"
                style={{ cursor: 'pointer' }}
              >
                {t('modals.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
                style={{ cursor: 'pointer' }}
              >
                {deleteConfirmCase.id === 'multiple' ? t('modals.delete_selected', 'DELETE SELECTED') : t('modals.delete_dossier')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-red-500 p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-red-500/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-red-500 tracking-widest uppercase pb-2 border-b border-white/5">
              {t('modals.confirm_disconnect_title')}
            </div>
            <div className="font-mono text-[10px] text-gray-400 leading-relaxed">
              {t('modals.confirm_disconnect_body')}
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5 mt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent"
                style={{ cursor: 'pointer' }}
              >
                {t('modals.cancel')}
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                  window.location.href = '/';
                }}
                className="px-3.5 py-1.5 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
                style={{ cursor: 'pointer' }}
              >
                {t('modals.disconnect')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
