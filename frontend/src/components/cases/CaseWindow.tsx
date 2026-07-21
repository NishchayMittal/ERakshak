import React from 'react';
import { Download, FileText } from 'lucide-react';
import { useDashboardContext } from '../../pages/DashboardContext';
import { useCaseWebSocket } from '../../hooks/useCaseWebSocket';

export function CaseWindow({ win }: { win: any }) {
  useCaseWebSocket(win.caseId);
  const {
    activeEntityPerCase,
    setActiveEntityPerCase,
    nodePositionsPerCase,
    setNodePositionsPerCase,
    caseSeedsInput,
    setCaseSeedsInput,
    casePendingSeeds,
    caseIngestProgress,
    caseIngestLogs,
    caseReportNarrative,
    caseZoom,
    casePan,
    graphDataPerCase,
    graphData,
    dossierSearchQuery,
    setDossierSearchQuery,
    handleNodeDrag,
    handleZoom,
    handleSvgMouseDown,
    addCaseSeed,
    removeCaseSeed,
    runIngestPipeline,
    fetchNarrativeReport,
    triggerExport,
    handleGoToNode,
    loadGraphForCase,
    getNodeAbbreviation,
    setWindows
  } = useDashboardContext();

  const caseId = win.caseId;
  const tab = win.activeTab || 'intake';
  const activeEntity = activeEntityPerCase[caseId] || 'n1';
  const zoom = caseZoom[caseId] || 1.0;
  const pan = casePan[caseId] || { x: 0, y: 0 };
  const currentGraph = graphData;

  const detectSeedType = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed) return 'email';
    if (trimmed.includes('@')) return 'email';
    else if (/^\+?\d[\d-\s()]{7,}\d$/.test(trimmed)) return 'phone';
    else if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmed)) return 'ip';
    else if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(trimmed) || (trimmed.includes('.') && !trimmed.includes(' '))) return 'domain';
    else if (/^(0x)?[0-9a-fA-F]{40}$/.test(trimmed) || /^[139][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) return 'wallet';
    else if (trimmed.includes(' ') && trimmed.length > 3) return 'name';
    else if (trimmed.length > 2) return 'username';
    return 'email';
  };

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
                            setWindows((prev: any) => prev.map((w: any) => w.id === win.id ? { ...w, activeTab: t.id as any } : w));
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
                                  onChange={(e) => setCaseSeedsInput((prev: any) => ({
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
                                      setCaseSeedsInput((prev: any) => ({
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
                                return (
                                  <div className="flex-1 flex flex-col items-center justify-center text-[9px] text-[#39ff14]/60 font-mono tracking-widest gap-2">
                                    <span className="animate-pulse">AWAITING CORRELATION SEED INPUT IN CMD_INTAKE...</span>
                                  </div>
                                );
                              }
                              return (
                                <svg
                                  className="w-full h-full cursor-grab active:cursor-grabbing"
                                  onWheel={(e) => handleZoom(e, caseId)}
                                  onMouseDown={(e) => handleSvgMouseDown(e, caseId)}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  <defs>
                                    <filter id="glow-violet" x="-20%" y="-20%" width="140%" height="140%">
                                      <feGaussianBlur stdDeviation="4" result="blur" />
                                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                    <pattern id={`matrix-grid-${caseId}`} width="25" height="25" patternUnits="userSpaceOnUse">
                                      <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(57, 255, 20, 0.04)" strokeWidth="0.5" />
                                    </pattern>
                                  </defs>
                                  <rect width="100%" height="100%" fill={`url(#matrix-grid-${caseId})`} />
                                  <g transform={`translate(${350 * (1 - zoom) + pan.x}, ${200 * (1 - zoom) + pan.y}) scale(${zoom})`}>
                                    {/* Draw edges */}
                                    {caseGraph.edges && caseGraph.edges.map((e: any, idx: number) => {
                                      const posSource = nodePositionsPerCase[caseId]?.[e.source] || { x: 200, y: 150 };
                                      const posTarget = nodePositionsPerCase[caseId]?.[e.target] || { x: 400, y: 150 };

                                      return (
                                        <g key={idx}>
                                          <line
                                            x1={posSource.x}
                                            y1={posSource.y}
                                            x2={posTarget.x}
                                            y2={posTarget.y}
                                            stroke={activeEntity === e.source || activeEntity === e.target ? '#39ff14' : '#a855f7'}
                                            strokeWidth={e.confidence * 2 + 1}
                                            opacity={0.35}
                                            strokeDasharray={e.confidence < 0.6 ? '4 4' : 'none'}
                                          />
                                          <text
                                            x={(posSource.x + posTarget.x) / 2}
                                            y={(posSource.y + posTarget.y) / 2 - 4}
                                            fill="#8295B4"
                                            fontSize="7"
                                            textAnchor="middle"
                                            fontFamily="monospace"
                                          >
                                            {e.relationType} ({(e.confidence * 100).toFixed(0)}%)
                                          </text>
                                        </g>
                                      );
                                    })}

                                    {/* Draw nodes */}
                                    {caseGraph.nodes && caseGraph.nodes.map((n: any) => {
                                      const pos = nodePositionsPerCase[caseId]?.[n.id] || { x: 300, y: 180 };
                                      const isActive = activeEntity === n.id;
                                      const isSeed = n.type === 'email' || n.type === 'phone' || n.type === 'username';
                                      const nodeNumber = getNodeAbbreviation(caseId, n.id);

                                      return (
                                        <g
                                          key={n.id}
                                          onMouseDown={(e) => handleNodeDrag(e, caseId, n.id)}
                                          onClick={() => {
                                            setActiveEntityPerCase((prev: any) => ({
                                              ...prev,
                                              [caseId]: n.id
                                            }));
                                          }}
                                          onDoubleClick={() => {
                                            // Open dossier tab and load node info
                                            loadGraphForCase(caseId, n.id);
                                            setWindows((prev: any) => prev.map((w: any) => w.id === `workspace-${caseId}` ? { ...w, activeTab: 'dossier' } : w));
                                          }}
                                          className="cursor-pointer select-none"
                                        >
                                          <circle
                                            cx={pos.x}
                                            cy={pos.y}
                                            r={isActive ? 14 : 11}
                                            fill={isActive ? '#39ff14' : isSeed ? '#a855f7' : '#09152b'}
                                            stroke={isActive ? '#ffffff' : '#39ff14'}
                                            strokeWidth={isActive ? 2 : 1.2}
                                            filter="none"
                                          />
                                          <text
                                            x={pos.x}
                                            y={pos.y + 3}
                                            fill={isActive ? '#000000' : '#ffffff'}
                                            fontSize="7.5"
                                            fontWeight="bold"
                                            textAnchor="middle"
                                            fontFamily="monospace"
                                          >
                                            {nodeNumber}
                                          </text>
                                        </g>
                                      );
                                    })}
                                  </g>
                                </svg>
                              );
                            })()}
                          </div>

                          {/* Mini side action node menu */}
                          <div className="w-64 bg-black/35 border border-white/5 rounded-xl ml-3 p-3 flex flex-col gap-3">
                            <span className="text-[8.5px] text-gray-500 font-bold border-b border-white/5 pb-1 uppercase tracking-wider">Node Details</span>
                            {(() => {
                              const caseGraph = graphDataPerCase[caseId] || graphData;
                              const nodeInfo = caseGraph?.nodes?.find((n: any) => n.id === activeEntity);
                              if (!nodeInfo) {
                                return (
                                  <div className="text-[8px] text-gray-500 italic">No node selected. Click a node in the graph matrix to explore its details.</div>
                                );
                              }
                              return (
                                <div className="flex flex-col gap-2.5 text-[8px] flex-1">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-mono font-semibold">NODE ID</span>
                                    <span className="text-[9px] font-bold text-[#39ff14] truncate font-mono uppercase bg-white/5 p-1">{getNodeAbbreviation(caseId, nodeInfo.id)}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-mono font-semibold">VALUE / DETAIL</span>
                                    <span className="text-gray-200 font-mono break-all bg-white/5 p-1 select-text">{nodeInfo.label}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-mono font-semibold">IDENTIFIER TYPE</span>
                                    <span className="text-gray-200 font-mono uppercase bg-white/5 p-1">{nodeInfo.type}</span>
                                  </div>
                                  {nodeInfo.profile_url && (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-gray-500 font-mono font-semibold">PROFILE URL</span>
                                      <a
                                        href={nodeInfo.profile_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#39ff14] underline font-mono break-all bg-[#39ff14]/10 p-1 hover:text-white transition-colors"
                                      >
                                        {nodeInfo.profile_url}
                                      </a>
                                    </div>
                                  )}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-mono font-semibold">CONFIDENCE VALUE</span>
                                    <div className="flex items-center gap-2 bg-white/5 p-1">
                                      <span className="text-[#39ff14] font-bold">{(nodeInfo.confidence * 100).toFixed(0)}%</span>
                                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#39ff14]" style={{ width: `${nodeInfo.confidence * 100}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Telemetry Dossier Tab */}
                      {tab === 'dossier' && (
                        <div className="flex flex-grow overflow-hidden relative min-h-0">
                          {/* Left column case summary profile feeds */}
                          <div className="w-64 bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2.5 overflow-y-auto pr-1 flex-shrink-0">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 pb-1 flex-shrink-0">TRACE MATRICES</span>

                            {/* Search box */}
                            <div className="mb-2 flex-shrink-0">
                              <input
                                type="text"
                                placeholder="Filter nodes / details..."
                                value={dossierSearchQuery[caseId] || ''}
                                onChange={(e) => setDossierSearchQuery((prev: any) => ({
                                  ...prev,
                                  [caseId]: e.target.value
                                }))}
                                className="w-full bg-black/60 border border-white/10 text-gray-200 text-[9px] px-2 py-1.5 focus:border-[#39ff14] outline-none font-mono"
                              />
                            </div>

                            {(() => {
                              const caseGraph = graphDataPerCase[caseId] || graphData;
                              const query = (dossierSearchQuery[caseId] || '').toLowerCase().trim();
                              const filteredNodes = caseGraph?.nodes?.filter((n: any) =>
                                n.label.toLowerCase().includes(query) ||
                                n.id.toLowerCase().includes(query) ||
                                n.type.toLowerCase().includes(query) ||
                                getNodeAbbreviation(caseId, n.id).toLowerCase().includes(query)
                              ) || [];

                              if (filteredNodes.length === 0) {
                                return <span className="text-[8px] text-gray-600 font-mono italic">No matching traces found.</span>;
                              }

                              return filteredNodes.map((n: any) => (
                                <div
                                  key={n.id}
                                  onClick={() => loadGraphForCase(caseId, n.id)}
                                  className={`p-2.5 rounded border transition-colors cursor-pointer flex flex-col gap-1.5 ${activeEntity === n.id ? 'bg-[#39ff14]/10 border-[#39ff14]/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
                                    <span className="text-[8px] font-bold text-white truncate font-mono uppercase">
                                      {getNodeAbbreviation(caseId, n.id)}: {n.label}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[7.5px] font-mono">
                                    <span className="text-gray-500 uppercase">{n.type}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleGoToNode(caseId, n.id);
                                      }}
                                      className="text-[#39ff14] hover:text-white px-1.5 py-0.5 border border-[#39ff14]/30 hover:border-[#39ff14] bg-[#39ff14]/5 transition uppercase font-bold"
                                    >
                                      Go to Node
                                    </button>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>

                          {/* Right column dossier detailed profile telemetry card */}
                          <div className="flex-1 bg-black/40 border border-white/5 rounded-xl ml-3 p-4 flex flex-col gap-3 overflow-y-auto pr-1">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <div className="flex flex-col">
                                <h3 className="text-[10px] font-bold text-white tracking-widest uppercase font-mono">OSINT TELEMETRY DOSSIER</h3>
                                <span className="text-[8px] text-gray-500 font-mono mt-0.5">IDENTIFIER CODE: {activeEntity}</span>
                              </div>
                              <span className="text-[9px] font-bold border border-[#39ff14]/40 bg-[#39ff14]/5 text-[#39ff14] px-2 py-0.5 rounded font-mono uppercase">VERIFIED SECURE</span>
                            </div>

                            {/* Dossier contents list */}
                            <div className="flex flex-col gap-3">
                              {/* Simple loop for findings/dossier attributes */}
                              {currentGraph && currentGraph.nodes && currentGraph.nodes.find((n: any) => n.id === activeEntity) ? (
                                <div className="flex flex-col gap-3">
                                  <div className="grid grid-cols-2 gap-3 text-[8.5px]">
                                    <div className="bg-white/5 border border-white/5 p-2.5 rounded flex flex-col gap-1">
                                      <span className="text-gray-500 font-bold uppercase">CORRELATION PRIOR</span>
                                      <span className="text-white font-mono uppercase">0.9888 matching confidence</span>
                                    </div>
                                    <div className="bg-white/5 border border-white/5 p-2.5 rounded flex flex-col gap-1">
                                      <span className="text-gray-500 font-bold uppercase">LEAK EXPOSURES</span>
                                      <span className="text-red-400 font-mono uppercase">Canva, Wattpad Leaks flagged</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-wide">INGESTED CRAWLER PAYLOADS</span>
                                    <div className="flex flex-col gap-1.5 font-mono text-[8px] text-gray-300">
                                      <div className="p-2 bg-black border border-white/5 rounded flex justify-between">
                                        <span>WHOIS Registrant: securehost@mail.com</span>
                                        <span className="text-[#39ff14]">100% CONFIDENCE</span>
                                      </div>
                                      <div className="p-2 bg-black border border-white/5 rounded flex justify-between">
                                        <span>Social footprints: target_dev handle detected</span>
                                        <span className="text-[#a855f7]">94% CONFIDENCE</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[9px] font-mono text-gray-500 italic">No dossiers compiled. Launch ingestion scan in Intake tab.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Syn Report Tab */}
                      {tab === 'report' && (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black/40 border border-white/5 rounded-xl p-4 gap-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
                              <FileText size={13} className="text-[#39ff14]" /> Dynamic AI Intelligence Summary
                            </span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => triggerExport(caseId, 'json')} className="border border-[#39ff14] hover:bg-[#39ff14]/10 text-[#39ff14] text-[8px] font-bold px-2 py-1 flex items-center gap-1 uppercase">
                                <Download size={9} /> JSON
                              </button>
                              <button onClick={() => triggerExport(caseId, 'csv')} className="border border-[#39ff14] hover:bg-[#39ff14]/10 text-[#39ff14] text-[8px] font-bold px-2 py-1 flex items-center gap-1 uppercase">
                                <Download size={9} /> CSV
                              </button>
                              <button onClick={() => triggerExport(caseId, 'pdf')} className="bg-[#39ff14] text-black text-[8px] font-bold px-2 py-1 flex items-center gap-1 uppercase">
                                <Download size={9} /> PDF Report
                              </button>
                            </div>
                          </div>

                          <div className="flex-grow overflow-y-auto font-mono text-[9px] text-gray-300 pr-1 select-text bg-black/25 p-3 border border-white/5 whitespace-pre-wrap leading-relaxed">
                            {caseReportNarrative[caseId] || 'Synthesizing report...'}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
  );
}
