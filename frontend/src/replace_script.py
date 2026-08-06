import sys

with open('components/cases/CaseWindow.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-48 min-h-24">
                                {existingSeeds.length === 0 ? (
                                  <span className="text-[8px] text-gray-600 font-mono italic">No seeds added yet.</span>
                                ) : (
                                  existingSeeds.map((s, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 px-2.5 py-1 rounded">
                                      <span className="text-[8px] uppercase font-bold text-gray-300">
                                        <span className="text-[#a855f7] mr-1.5">[{s.type}]</span> {s.type === 'photo' ? (s.raw_value || '').split(/[/\\]/).pop() : (s.raw_value || '')}
                                      </span>
                                      <button onClick={() => removeExistingSeed(s.id)} className="text-gray-500 hover:text-red-400 text-[8px] font-bold border border-transparent hover:border-red-400 px-1 rounded transition-colors">REMOVE</button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>"""

replacement = """                              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-48 min-h-24">
                                {existingSeeds.length === 0 ? (
                                  <span className="text-[8px] text-gray-600 font-mono italic">No seeds added yet.</span>
                                ) : (
                                  existingSeeds.map((s, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 px-2.5 py-1 rounded">
                                      <span className="text-[8px] uppercase font-bold text-gray-300">
                                        <span className="text-[#a855f7] mr-1.5">[{s.type}]</span> {s.type === 'photo' ? (s.raw_value || '').split(/[/\\]/).pop() : (s.raw_value || '')}
                                      </span>
                                      <button onClick={() => removeExistingSeed(s.id)} className="text-gray-500 hover:text-red-400 text-[8px] font-bold border border-transparent hover:border-red-400 px-1 rounded transition-colors">REMOVE</button>
                                    </div>
                                  ))
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  const mappedSeeds = existingSeeds.map(s => ({ type: s.type, value: s.raw_value || '' }));
                                  await runIngestPipeline(caseId, mappedSeeds);
                                  setTimeout(fetchExistingSeeds, 2000);
                                }}
                                disabled={existingSeeds.length === 0 || (caseIngestProgress[caseId] !== undefined && caseIngestProgress[caseId] !== null)}
                                className="w-full bg-[#39ff14]/20 hover:bg-[#39ff14]/30 border border-[#39ff14]/50 disabled:bg-white/5 disabled:border-transparent disabled:text-gray-600 text-[#39ff14] text-[9px] font-bold py-2 tracking-widest text-center uppercase mt-2"
                              >
                                RERUN SCAN ON EXISTING
                              </button>
                            </div>"""

# Normalize newlines
target = target.replace('\r\n', '\n')
replacement = replacement.replace('\r\n', '\n')
content = content.replace('\r\n', '\n')

if target in content:
    content = content.replace(target, replacement)
    with open('components/cases/CaseWindow.tsx', 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('Target not found')
