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
old_cross="effectiveDetermination(project,'deterministicResults',d,controllingTest(project,d))==='SATISFIED'"
new_cross="(effectiveDetermination(project,'deterministicResults',d,controllingTest(project,d))==='SATISFIED'||formalOutcome(claimedDetermination('deterministicResults',d))==='SATISFIED')"
if old_cross not in s: raise RuntimeError('cross-method contradiction anchor missing')
s=s.replace(old_cross,new_cross,1)
# Stage 13 application fields are canonical derivations, not agent comparison assertions.
comparison_tail="function comparisonFacts(project,requirementIdValue,iterationId){\n"
if comparison_tail not in s: raise RuntimeError('comparisonFacts anchor missing')
# Inject derivation helper after semantic block insertion later by appending to semantic raw string before its terminator.
semantic_end="  return {RUN_DETERMINATIONS:runDeterminations,ALL_TEN_SATISFIED:runs.length===10&&values.every(v=>v==='SATISFIED'),ANY_VIOLATION:values.includes('VIOLATED'),ANY_UNDETERMINED:values.includes('UNDETERMINED')};\\n}'''"
if semantic_end not in s: raise RuntimeError('comparisonFacts semantic terminator missing')
derive_code="""  return {RUN_DETERMINATIONS:runDeterminations,ALL_TEN_SATISFIED:runs.length===10&&values.every(v=>v==='SATISFIED'),ANY_VIOLATION:values.includes('VIOLATED'),ANY_UNDETERMINED:values.includes('UNDETERMINED')};\n}\nfunction deriveComparisonRecords(project){for(const record of records(project,'comparisons')){const reqId=String(recordValue(record,'REQ_ID')||record.relationships?.REQ_ID||''),iterationId=String(record.scope?.iterationId||recordValue(latestIteration(project,[10,17,19]),'ITERATION_ID')||'');if(!reqId||!iterationId)continue;const facts=comparisonFacts(project,reqId,iterationId),updates={RUN_DETERMINATIONS:facts.RUN_DETERMINATIONS,ALL_TEN_SATISFIED:facts.ALL_TEN_SATISFIED,ANY_VIOLATION:facts.ANY_VIOLATION,ANY_UNDETERMINED:facts.ANY_UNDETERMINED};record.fields=record.fields&&typeof record.fields==='object'?record.fields:{};for(const [key,value] of Object.entries(updates)){record.fields[key]=value;record[key]=value;}refreshRecordHashes(record,'comparisons');}return project;}'''"""
s=s.replace(semantic_end,derive_code,1)
# Recalculation deterministically refreshes comparison facts before any Stage 13+ gate reads them.
recalc_anchor="function recalculate(project){\\n  ensureShape(project);"
recalc_replacement="function recalculate(project){\\n  ensureShape(project);deriveComparisonRecords(project);"
if recalc_anchor not in s: raise RuntimeError('recalculate patch anchor missing')
s=s.replace(recalc_anchor,recalc_replacement,1)
old="runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']; digest=hashlib.sha256(b''.join(Path(f).read_bytes() for f in runtime)).hexdigest()[:16]"
new="runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']; blob=lambda f: hashlib.sha1((f'blob {len(Path(f).read_bytes())}\\0').encode()+Path(f).read_bytes()).hexdigest(); manifest=''.join(f'{f}:{blob(f)}\\n' for f in runtime); digest='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]"
if old not in s: raise RuntimeError('runtime cache-token patch anchor missing')
s=s.replace(old,new,1)
anchor="# Refresh one shared runtime cache token from exact runtime bytes."
fixture="""# Keep synthetic fixtures structurally explicit under the new semantic contract.\nvip=Path('verify-ingestion.mjs'); vt=vip.read_text(); safe_anchor='function safeValue(name){\\n';\nif safe_anchor not in vt: raise RuntimeError('verify-ingestion safeValue anchor missing')\nvt=vt.replace(safe_anchor,safe_anchor+\"  if(/EXECUTION_OUTCOME/.test(name))return 'REJECTED_INVALID';\\n\",1); vip.write_text(vt)\nvfp=Path('verify-full-cycle.mjs'); vf=vfp.read_text(); old_find=\"FINDINGS:'No material ambiguity'\";\nif old_find not in vf: raise RuntimeError('preflight fixture anchor missing')\nvf=vf.replace(old_find,\"FINDINGS:'NONE'\",1)\nverify_start=vf.find('function verifyBatch(stage,operation,slots){'); verify_end=vf.find('\\nverifyBatch(12',verify_start)\nif verify_start<0 or verify_end<0: raise RuntimeError('verifyBatch fixture anchor missing')\nnew_verify=\"\"\"function verifyBatch(stage,operation,slots){const records=[];for(const {runId} of slots)for(const test of stage6Tests){const currentTestId=engine.recordId(test,'tests'),testType=engine.recordValue(test,'TEST_TYPE'),verifierContext=engine.registerFreshContext(p,{stage,externalContextIdentifier:`VERIFY-${stage}-${runId}-${currentTestId}`,operatorLabel:'FULL_CYCLE'}),verifierContextId=engine.recordId(verifierContext,'freshContexts');records.push(recordProposal(schema,'verification',{tempKey:`verify-${runId}-${currentTestId}`,relationships:{REQ_ID:{recordId:reqId},RUN_ID:{recordId:runId},TEST_ID:{recordId:currentTestId}},overrides:{VERIFIER:'INDEPENDENT_VERIFIER',VERIFIER_CONTEXT_ID:verifierContextId,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:'Canonical run output',PROCEDURE:`Execute ${testType} test`,EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:`Evidence ${runId} ${currentTestId}`,DETERMINATION:'SATISFIED'}}));}data(stage,{operation,records:{verification:records}});}\"\"\"\nvf=vf[:verify_start]+new_verify+vf[verify_end:]; vfp.write_text(vf)\n\n"""
if anchor not in s: raise RuntimeError('runtime refresh anchor missing')
s=s.replace(anchor,fixture+anchor,1)
p.write_text(s)
