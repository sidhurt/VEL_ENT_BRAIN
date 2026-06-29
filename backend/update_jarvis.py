import re

file_path = r"d:\ProjectNecessity\VelEntRun\frontend\src\components\JarvisWorkspace.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

badge_html = """
                                          <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">{artifact.type}</span>
                                              {artifact.status === 'Proposed' && <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">Proposed</span>}
                                              {artifact.status === 'Validated' && <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">{artifact.authority}</span>}
                                              {artifact.status === 'Rejected' && <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">Rejected</span>}
                                          </div>
"""

content = content.replace(
    '<span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">{artifact.type}</span>',
    badge_html
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated JarvisWorkspace.tsx")
