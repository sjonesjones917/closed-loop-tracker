from pathlib import Path
p=Path('index.html'); s=p.read_text()
s=s.replace('.expandable-prompt{max-height:80vh}.expandable-prompt.expanded{max-height:none}', '.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}')
p.write_text(s)
p=Path('verify-all-stage-prompts.mjs'); s=p.read_text()
s=s.replace("import vm from 'node:vm';\nfor(const file of", "import vm from 'node:vm';\nglobalThis.dispatchEvent=()=>{};globalThis.Event=class{constructor(type){this.type=type}};\nfor(const file of",1)
s=s.replace("assert(html.includes('.expandable-prompt{max-height:80vh}.expandable-prompt.expanded{max-height:none}'),'Collapsed prompt preview no longer uses established prompt height ceiling');", "assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'),'Collapsed prompt preview dimensions changed from the established visual');")
p.write_text(s)
