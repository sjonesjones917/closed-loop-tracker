from pathlib import Path
import hashlib
import re

engine = Path('workflow-engine.js')
text = engine.read_text()

def replace_one(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one target, found {count}')
    text = text.replace(old, new, 1)

replace_one(
    "const authority=String(recordValue(e,'AUTHORITY_TYPE')||'').trim();if((!authority||upper(authority)==='UNKNOWN')&&!result.rawResponseId&&!result.sourceProposalId)reasons.push(`${recordId(e,'evidenceRecords')}: evidence authority is not structurally attributable.`);",
    "const authority=String(recordValue(e,'AUTHORITY_TYPE')||'').trim(),attachmentId=String(recordValue(e,'ATTACHMENT_ID')||e.relationships?.ATTACHMENT_ID||'').trim(),applicationVerifiedAttachment=Boolean(attachmentId&&records(project,'artifacts').some(a=>recordId(a,'artifacts')===attachmentId&&upper(recordValue(a,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED'&&/^[a-f0-9]{64}$/i.test(String(recordValue(a,'SHA256')||''))&&Number.isInteger(Number(recordValue(a,'BYTE_SIZE')))&&Number(recordValue(a,'BYTE_SIZE'))>=0));if((!authority||upper(authority)==='UNKNOWN')&&!result.rawResponseId&&!result.sourceProposalId&&!applicationVerifiedAttachment)reasons.push(`${recordId(e,'evidenceRecords')}: evidence authority is not structurally attributable.`);",
    'verified attachment evidence attribution',
)

replace_one(
    "if(mode!=='INITIAL')for(const reg of activeRegressions(project)){const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id),latest=xs.at(-1),evidence=latest?evaluateEvidenceSufficiency(project,{result:latest}):{sufficient:false};if(xs.length!==1||!['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(latest,'RESULT')))||!evidence.sufficient)regFailures.push(id);}",
    "if(mode!=='INITIAL')for(const reg of activeRegressions(project)){const id=recordId(reg,'regressions'),xs=regExec.filter(x=>String(recordValue(x,'REG_ID')||x.relationships?.REG_ID||'')===id),latest=xs.at(-1),evidence=latest?evaluateEvidenceSufficiency(project,{result:latest}):{sufficient:false};if(xs.length!==1||effectiveDetermination('regressionExecutions',latest,null,project)!==EFFECTIVE_SATISFIED||!evidence.sufficient)regFailures.push(id);}",
    'iteration regression effective determination',
)

replace_one(
    "if(runs.length!==10)reasons.push('Exactly ten current runs are required.');if(!['APPLICATION_ESTABLISHED','EXTERNALLY_SUPPORTED'].includes(independence.determination))reasons.push(...(independence.reasons.length?independence.reasons:['Ten current runs are not independently established.']));",
    "if(runs.length!==10)reasons.push('Exactly ten current runs are required.');if(independence.determination!=='APPLICATION_ESTABLISHED')reasons.push(...(independence.reasons.length?independence.reasons:['Ten current runs are not independently established by canonical context records.']));",
    'run-batch independence authority',
)

replace_one(
    "const groups=new Map();for(const r of recordsForCurrentScope(project,'verification')){const key=verificationKey(r),d=effectiveDetermination('verification',r,collectionTest(project,r),project);if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(d);}for(const [key,ds] of groups)if(ds.size>1)push('VERIFICATION_DETERMINATION_CONFLICT',key,[...ds]);",
    "const groups=new Map(),claimGroups=new Map(),claimOf=r=>upper(recordValue(r,'DETERMINATION')||recordValue(r,'RESULT')||''),claimConflict=ds=>[...ds].some(x=>['SATISFIED','PASSED','SUCCESS','ACCEPTED'].includes(x))&&[...ds].some(x=>['VIOLATED','FAILED','FAIL','REJECTED'].includes(x));for(const r of recordsForCurrentScope(project,'verification')){const key=verificationKey(r),d=effectiveDetermination('verification',r,collectionTest(project,r),project),claim=claimOf(r);if(!groups.has(key))groups.set(key,new Set());groups.get(key).add(d);if(!claimGroups.has(key))claimGroups.set(key,new Set());if(claim)claimGroups.get(key).add(claim);}for(const [key,ds] of groups){const claims=claimGroups.get(key)||new Set();if(ds.size>1||claimConflict(claims))push('VERIFICATION_DETERMINATION_CONFLICT',key,{effective:[...ds],claimed:[...claims]});}",
    'verification contradiction claims',
)

replace_one(
    "for(const m of meaning){const req=resultRequirementId(project,m),md=effectiveDetermination('meaningResults',m,collectionTest(project,m),project);if(md===EFFECTIVE_VIOLATED&&det.some(d=>resultRequirementId(project,d)===req&&effectiveDetermination('deterministicResults',d,collectionTest(project,d),project)===EFFECTIVE_SATISFIED))push('DETERMINISTIC_MEANING_CONFLICT',req,['DETERMINISTIC SATISFIED','MEANING VIOLATED']);if(md===EFFECTIVE_SATISFIED&&adv.some(a=>resultRequirementId(project,a)===req&&effectiveDetermination('adversarialResults',a,collectionTest(project,a),project)===EFFECTIVE_VIOLATED))push('MEANING_ADVERSARIAL_CONFLICT',req,['MEANING SATISFIED','ADVERSARIAL VIOLATION']);}",
    "for(const m of meaning){const req=resultRequirementId(project,m),md=effectiveDetermination('meaningResults',m,collectionTest(project,m),project),mc=claimOf(m),detConflict=det.some(d=>resultRequirementId(project,d)===req&&((effectiveDetermination('deterministicResults',d,collectionTest(project,d),project)===EFFECTIVE_SATISFIED&&md===EFFECTIVE_VIOLATED)||(['SATISFIED','PASSED','SUCCESS'].includes(claimOf(d))&&['VIOLATED','FAILED','FAIL','REJECTED'].includes(mc)))),advConflict=adv.some(a=>resultRequirementId(project,a)===req&&((md===EFFECTIVE_SATISFIED&&effectiveDetermination('adversarialResults',a,collectionTest(project,a),project)===EFFECTIVE_VIOLATED)||(['SATISFIED','PASSED','SUCCESS'].includes(mc)&&['VIOLATED','FAILED','FAIL','REJECTED'].includes(claimOf(a)))));if(detConflict)push('DETERMINISTIC_MEANING_CONFLICT',req,['Current deterministic and meaning conclusions conflict; claimed conclusions remain non-authoritative.']);if(advConflict)push('MEANING_ADVERSARIAL_CONFLICT',req,['Current meaning and adversarial conclusions conflict; claimed conclusions remain non-authoritative.']);}",
    'cross-method contradictions',
)

replace_one(
    "conclusionCollections=['preflightRecords','verification','regressionExecutions','confirmationRecords','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits']",
    "conclusionCollections=['preflightRecords','failureTests','verification','regressionExecutions','confirmationRecords','products','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits']",
    'conclusion-bearing contradiction coverage',
)

memoized = [
    'evaluateEvidenceContract',
    'evaluateEvidenceSufficiency',
    'evaluateResultConsistency',
    'verificationMatrix',
    'evaluateIteration',
    'coverageMetrics',
    'convergenceMetrics',
    'defectResolvedByRegression',
    'detectCurrentContradictions',
    'releaseMetrics',
]
for name in memoized:
    declaration = f'function {name}('
    count = text.count(declaration)
    if count != 1:
        raise SystemExit(f'{name} declaration mismatch: {count}')
    text = text.replace(declaration, f'function {name}Uncached(', 1)

if text.count('function recalculate(') != 1:
    raise SystemExit(f"recalculate declaration mismatch: {text.count('function recalculate(')}")
text = text.replace('function recalculate(', 'function recalculateUncached(', 1)

marker = 'function recalculateUncached(project){'
if marker not in text:
    raise SystemExit('recalculate insertion marker missing')
wrappers = r'''
let recalculationMemo=null;
function memoDuringRecalculation(key,compute){if(!recalculationMemo)return compute();if(recalculationMemo.has(key))return recalculationMemo.get(key);const value=compute();recalculationMemo.set(key,value);return value;}
function memoRecordIdentity(collection,record){return record?String(recordId(record,collection)||record.id||record.recordId||record.contentSha256||record.recordSha256||'ANONYMOUS'):'NONE';}
function evaluateEvidenceContract(project,args={}){const result=args?.result,test=args?.test;return memoDuringRecalculation(`evidence-contract|${memoRecordIdentity('evidenceTarget',result)}|${memoRecordIdentity('tests',test)}`,()=>evaluateEvidenceContractUncached(project,args));}
function evaluateEvidenceSufficiency(project,args={}){const result=args?.result,test=args?.test;return memoDuringRecalculation(`evidence-sufficiency|${memoRecordIdentity('evidenceTarget',result)}|${memoRecordIdentity('tests',test)}`,()=>evaluateEvidenceSufficiencyUncached(project,args));}
function evaluateResultConsistency(project,args={}){const collection=String(args?.collection||''),record=args?.record,test=args?.test,critical=args?.releaseCritical?'1':'0';return memoDuringRecalculation(`result|${collection}|${memoRecordIdentity(collection,record)}|${memoRecordIdentity('tests',test)}|${critical}`,()=>evaluateResultConsistencyUncached(project,args));}
function verificationMatrix(project,iterationId){return memoDuringRecalculation(`verification-matrix|${String(iterationId||'CURRENT')}`,()=>verificationMatrixUncached(project,iterationId));}
function evaluateIteration(project,iterationId,mode='INITIAL'){return memoDuringRecalculation(`iteration|${String(iterationId||'')}|${String(mode)}`,()=>evaluateIterationUncached(project,iterationId,mode));}
function coverageMetrics(project,iterationIdOverride=null){return memoDuringRecalculation(`coverage|${String(iterationIdOverride||'CURRENT')}`,()=>coverageMetricsUncached(project,iterationIdOverride));}
function convergenceMetrics(project){return memoDuringRecalculation('convergence-metrics',()=>convergenceMetricsUncached(project));}
function defectResolvedByRegression(project,defect){return memoDuringRecalculation(`defect-regression|${memoRecordIdentity('defects',defect)}`,()=>defectResolvedByRegressionUncached(project,defect));}
function detectCurrentContradictions(project){return memoDuringRecalculation('current-contradictions',()=>detectCurrentContradictionsUncached(project));}
function releaseMetrics(project){return memoDuringRecalculation('release-metrics',()=>releaseMetricsUncached(project));}
function recalculate(project){const previous=recalculationMemo;recalculationMemo=new Map();try{return recalculateUncached(project);}finally{recalculationMemo=previous;}}
'''
text = text.replace(marker, wrappers + '\n' + marker, 1)
engine.write_text(text)

fixture = Path('test-fixtures.mjs')
ftext = fixture.read_text()
old = "  if(String(name).toUpperCase()==='EXECUTION_MODE')return 'EXTERNAL_AGENT_TOOL';\n"
new = "  const controlled=String(name).toUpperCase();\n  if(controlled==='EXECUTION_MODE')return 'EXTERNAL_AGENT_TOOL';\n  if(controlled==='EXECUTION_OUTCOME')return 'REJECTED_INVALID';\n  if(controlled==='PREFLIGHT_OBSERVATION')return 'NO_MATERIAL_DEFECT';\n  if(controlled==='OBSERVATION_OUTCOME')return 'SATISFIED';\n"
if ftext.count(old) != 1:
    raise SystemExit(f'test fixture controlled outcome target mismatch: {ftext.count(old)}')
fixture.write_text(ftext.replace(old, new, 1))

runtime_files = [
    'workbook.js',
    'hash.js',
    'workflow-schema.js',
    'workflow-engine.js',
    'prompt-engine.js',
    'response-ingestion.js',
    'project-store.js',
    'app-core.js',
]
def git_blob_sha(path: str) -> str:
    data = Path(path).read_bytes()
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
manifest = ''.join(f'{path}:{git_blob_sha(path)}\n' for path in runtime_files).encode()
identity = 'runtime-' + hashlib.sha256(manifest).hexdigest()[:16]
html_path = Path('index.html')
html = html_path.read_text()
for runtime_file in runtime_files:
    html = re.sub(re.escape(runtime_file) + r'(?:\?v=runtime-[a-f0-9]+)?', f'{runtime_file}?v={identity}', html)
html_path.write_text(html)
print(identity)
