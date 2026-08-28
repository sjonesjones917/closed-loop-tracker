from pathlib import Path
p=Path('.semantic-adjudication-patch.py')
s=p.read_text()
start=s.index('def replace_function(')
end=s.index("\np=Path('workflow-engine.js')", start)
replacement='''def replace_function(text, name, replacement):\n    marker=f"function {name}("\n    start=text.find(marker)\n    if start<0: raise RuntimeError(f'missing function {name}')\n    paren=text.find('(',start)\n    depth=0; quote=None; esc=False; close=None\n    for i in range(paren,len(text)):\n        ch=text[i]\n        if quote:\n            if esc: esc=False\n            elif ch=='\\\\': esc=True\n            elif ch==quote: quote=None\n            continue\n        if ch in "'\\\"`": quote=ch\n        elif ch=='(': depth+=1\n        elif ch==')':\n            depth-=1\n            if depth==0:\n                close=i\n                break\n    if close is None: raise RuntimeError(f'unclosed parameters for {name}')\n    brace=text.find('{',close)\n    if brace<0: raise RuntimeError(f'missing body for {name}')\n    depth=0; quote=None; esc=False; i=brace\n    while i<len(text):\n        ch=text[i]\n        if quote:\n            if esc: esc=False\n            elif ch=='\\\\': esc=True\n            elif ch==quote: quote=None\n        else:\n            if ch in "'\\\"`": quote=ch\n            elif ch=='{': depth+=1\n            elif ch=='}':\n                depth-=1\n                if depth==0:\n                    return text[:start]+replacement+text[i+1:]\n        i+=1\n    raise RuntimeError(f'unclosed function {name}')\n'''
s=s[:start]+replacement+s[end:]
block_start=s.index('# Replace evidence function while preserving a single evidenceReferences declaration.')
block_end=s.index("\nverification=r'''", block_start)
fixed="""# Replace evidence helpers using the function-aware parser. Default destructuring in parameters is not a function body.\ns=replace_function(s,'evaluateEvidenceSufficiency','')\ns=replace_function(s,'evidenceReferences','')\nanchor=s.find('function evidenceChainExplanation')\nif anchor<0: raise RuntimeError('evidenceChainExplanation anchor missing')\ns=s[:anchor]+semantic+'\\n'+s[anchor:]\n"""
s=s[:block_start]+fixed+s[block_end:]
old_artifacts="const artifacts=recordsForCurrentScope(project,'artifacts')"
new_artifacts="const artifacts=records(project,'artifacts').filter(isActiveRecord)"
if old_artifacts not in s: raise RuntimeError('evidence artifact selector anchor missing')
s=s.replace(old_artifacts,new_artifacts,1)
old="runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']; digest=hashlib.sha256(b''.join(Path(f).read_bytes() for f in runtime)).hexdigest()[:16]"
new="runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']; blob=lambda f: hashlib.sha1((f'blob {len(Path(f).read_bytes())}\\0').encode()+Path(f).read_bytes()).hexdigest(); manifest=''.join(f'{f}:{blob(f)}\\n' for f in runtime); digest='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]"
if old not in s: raise RuntimeError('runtime cache-token patch anchor missing')
s=s.replace(old,new,1)
anchor="# Refresh one shared runtime cache token from exact runtime bytes."
fixture="""# Keep the generic ingestion fixture valid under the new Stage 7 controlled enum.\nvip=Path('verify-ingestion.mjs'); vt=vip.read_text(); safe_anchor='function safeValue(name){\\n';\nif safe_anchor not in vt: raise RuntimeError('verify-ingestion safeValue anchor missing')\nvt=vt.replace(safe_anchor,safe_anchor+\"  if(/EXECUTION_OUTCOME/.test(name))return 'REJECTED_INVALID';\\n\",1); vip.write_text(vt)\n\n"""
if anchor not in s: raise RuntimeError('runtime refresh anchor missing')
s=s.replace(anchor,fixture+anchor,1)
p.write_text(s)
