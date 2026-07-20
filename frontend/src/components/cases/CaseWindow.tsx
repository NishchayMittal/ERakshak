import React from 'react';
import { Download, FileText, Network, Folder, CheckCircle } from 'lucide-react';
import { useCaseViewStore } from '../../state/caseViewState';
import { useCaseStore } from '../../state/caseStore';
import { useDesktopStore } from '../../state/desktopStore';

export const CaseWindow: React.FC<{ win: any }> = ({ win }) => {
  const { cases } = useCaseStore();
  const caseId = win.caseId!;
  const setWindows = useDesktopStore(s => s.updateWindow);
  
  // Connect to Zustand store
  const {
    activeEntityPerCase, setActiveEntity,
    nodePositionsPerCase, setNodePositions,
    caseSeedsInput, setSeedInput,
    casePendingSeeds, setPendingSeeds,
    caseIngestProgress, setIngestProgress,
    caseIngestLogs, addIngestLog,
    caseReportNarrative, setReportNarrative,
    caseZoom, setZoom,
    casePan, setPan,
    graphDataPerCase, setGraphData,
    dossierSearchQuery, setDossierSearchQuery,
  } = useCaseViewStore();

  const tab = win.activeTab || 'intake';
  const activeEntity = activeEntityPerCase[caseId] || 'n1';
  const zoom = caseZoom[caseId] || 1.0;
  const pan = casePan[caseId] || { x: 0, y: 0 };
  const graphData = graphDataPerCase[caseId] || {};
  const currentGraph = graphData;

  // Placeholder methods for now to ensure compilation
  const fetchNarrativeReport = (c: string) => {};
  const detectSeedType = (v: string) => 'email';
  const addCaseSeed = (c: string) => {};
  const removeCaseSeed = (c: string, idx: number) => {};
  const runIngestPipeline = (c: string) => {};
  const handleZoom = (e: any, c: string) => {};
  const handleSvgMouseDown = (e: any, c: string) => {};
  const getNodeAbbreviation = (c: string, nId: string) => nId;
  const handleNodeDrag = (e: any, c: string, nId: string) => {};
  const loadGraphForCase = (c: string, nId: string) => {};
  const handleGoToNode = (c: string, nId: string) => {};
  const triggerExport = (c: string, type: string) => {};
  
  return (
<div className="flex flex-col flex-1 min-height-0 overflow-hidden">
                    {/* Retro workspace tab headers */}
                    <div className="flex gap-2 border-b border-white/10 pb-2 mb-3 flex-shrink-0 text-[9px] font-bold">
                      {[
                        { id: 'intake', label: '[01 CMD_INTAKE]' },
                        { id: 'graph', label: '[02 NET_MATRIX]' },
                        { id: 'dossier', label: '[03 TEL_DOSSIER]' },
                        { id: 'report', label: '[04 AI_REPORT]' }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setWindows(prev => prev.map(w => w.id === win.id ? { ...w, activeTab: t.id as any } : w));
                            if (t.id === 'report') fetchNarrativeReport(caseId);
                          }}
                          className={`px-3 py-1.5 border transition ${tab === t.id ? 'bg-[#39ff14]/15 border-[#39ff14] text-[#39ff14]' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab contents */}
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">

                      {/* Intake Tab */}
                      {tab === 'intake' && (
                        <div className="flex flex-col gap-4 flex-grow overflow-y-auto pr-1">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Input Form */}
                            <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                              <h4 className="text-[10px] font-bold text-[#39ff14] border-b border-white/5 pb-1">INJECT SEARCH SEEDS</h4>

                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-gray-500 font-bold">IDENTIFIER VECTOR TYPE</span>
                                <select
                                  value={caseSeedsInput[caseId]?.type || 'email'}
                                  onChange={(e) => setCaseSeedsInput(prev => ({
                                    ...prev,
                                    [caseId]: { ...(prev[caseId] || { value: '' }), type: e.target.value }
                                  }))}
                                  className="bg-black border border-white/10 text-gray-300 text-[9px] p-1.5 focus:border-[#39ff14] outline-none"
                                >
                                  <option value="email">EMAIL ADDRESS</option>
                                  <option value="phone">PHONE NUMBER</option>
                                  <option value="name">INDIVIDUAL NAME</option>
                                  <option value="username">SOCIAL USERNAME</option>
                                  <option value="domain">DOMAINS</option>
                                  <option value="ip">IP ADDRESS</option>
                                  <option value="wallet">CRYPTO WALLET</option>
                                  <option value="photo">PHOTO / FACE URL</option>
                                  <option value="other">OTHER / FALLBACK</option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-gray-500 font-bold font-mono">VECTOR VALUE</span>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Enter target detail..."
                                    value={caseSeedsInput[caseId]?.value || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const autoType = detectSeedType(val);
                                      setCaseSeedsInput(prev => ({
                                        ...prev,
                                        [caseId]: {
                                          type: autoType,
                                          value: val
                                        }
                                      }));
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && addCaseSeed(caseId)}
                                    className="flex-1 bg-black border border-white/10 text-gray-200 text-[9px] px-2.5 py-1.5 focus:border-[#39ff14] outline-none"
                                  />
                                  <button
                                    onClick={() => addCaseSeed(caseId)}
                                    className="bg-[#39ff14] hover:bg-[#39ff14]/80 text-black text-[9px] font-bold px-3 py-1.5"
                                  >
                                    ADD SEED
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Ingest queue */}
                            <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                              <h4 className="text-[10px] font-bold text-gray-300 border-b border-white/5 pb-1">INGEST QUEUE LIST</h4>
                              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-32 min-h-24">
                                {(casePendingSeeds[caseId] || []).length === 0 ? (
                                  <span className="text-[8px] text-gray-600 font-mono italic">No pending vector seeds...</span>
                                ) : (
                                  (casePendingSeeds[caseId] || []).map((s, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 px-2.5 py-1 rounded">
                                      <span className="text-[8px] uppercase font-bold text-gray-300">
                                        <span className="text-[#a855f7] mr-1.5">[{s.type}]</span> {s.value}
                                      </span>
                                      <button onClick={() => removeCaseSeed(caseId, idx)} className="text-gray-500 hover:text-red-400 text-[8px] font-bold">X</button>
                                    </div>
                                  ))
                                )}
                              </div>
                              <button
                                onClick={() => runIngestPipeline(caseId)}
                                disabled={(casePendingSeeds[caseId] || []).length === 0 || caseIngestProgress[caseId] !== undefined}
                                className="w-full bg-[#a855f7] hover:bg-[#a855f7]/85 disabled:bg-white/5 disabled:text-gray-600 text-black text-[9px] font-bold py-2 tracking-widest text-center uppercase"
                              >
                                RUN CORRELATION SCAN
                              </button>
                            </div>
                          </div>

                          {/* Scanner loader console */}
                          {caseIngestProgress[caseId] !== undefined && caseIngestProgress[caseId] !== null && (
                            <div className="w-full bg-black/45 border border-[#39ff14]/30 p-4 rounded-xl flex flex-col gap-2">
                              <div className="flex justify-between text-[9px] font-bold text-[#39ff14]">
                                <span className="animate-pulse">CRAWLER PIPELINE CARRYING SCAN...</span>
                                <span>{caseIngestProgress[caseId]}%</span>
                              </div>
                              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden relative">
                                <div className="h-full bg-[#39ff14]" style={{ width: `${caseIngestProgress[caseId]}%` }} />
                                {/* Cyber scanning line */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#39ff14]/30 to-transparent w-20 animate-loading-scan" />
                              </div>
                              <div className="flex-1 max-h-24 overflow-y-auto font-mono text-[7.5px] text-gray-500 flex flex-col gap-0.5 mt-2">
                                {(caseIngestLogs[caseId] || []).map((l, i) => (
                                  <div key={i} className="truncate"><span className="text-[#39ff14] mr-1.5">&gt;</span>{l}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Network Matrix drag and drop tab */}
                      {tab === 'graph' && (
                        <div className="flex flex-1 min-height-0 overflow-hidden relative">
                          <div className="flex-grow bg-[#0c1220] border border-[#39ff14]/30 rounded-xl relative overflow-hidden shadow-inner flex flex-col">

                            {/* Drag instructions overlay */}
                            <div className="absolute top-2 left-2 pointer-events-none text-[7px] text-[#39ff14] font-mono uppercase bg-black/85 px-2 py-1 border border-[#39ff14]/20 z-10 tracking-wider">
                              DRAG NODES TO REORGANIZE | DOUBLE-CLICK TO VIEW PROFILE DOSSIER | PAN NETWORK CANVAS BY DRAGGING WITH RIGHT CLICK
                            </div>

                            {/* Network Canvas */}
                            {(() => {
                              const caseGraph = graphDataPerCase[caseId] || graphData;
                              if (!caseGraph || !caseGraph.nodes || caseGraph.nodes.length === 0) {
  );
};
