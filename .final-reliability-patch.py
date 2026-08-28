from pathlib import Path
import hashlib,re

p=Path('workflow-engine.js');s=p.read_text()
old="if(mismatched.length)reasons.push('A meaning-review requirement identity does not match its controlling Stage 6 test.');if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A meaning verification is violated or undetermined.');break;"
new="if(mismatched.length)reasons.push('A meaning-review requirement identity does not match its controlling Stage 6 test.');if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A meaning verification is violated or undetermined.');for(const result of results){const test=expectedById.get(String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||''));if(test&&!evaluateEvidenceSufficiency(project,{test,result}).sufficient)reasons.push('Meaning review '+recordId(result,'meaningResults')+' has evidence insufficient for the proposition.');}break;"
if old not in s: raise RuntimeError('stage23 anchor missing')
s=s.replace(old,new,1)
old="if(unexpected.length)reasons.push('Unexpected adversarial results exist outside the current required adversarial/regression set.');if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('Adversarial verification found a violated, failed, or undetermined result.');break;"
new="if(unexpected.length)reasons.push('Unexpected adversarial results exist outside the current required adversarial/regression set.');if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('Adversarial verification found a violated, failed, or undetermined result.');for(const result of results){const testId=String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||''),test=expectedTests.find(t=>recordId(t,'tests')===testId);if(!evaluateEvidenceSufficiency(project,{test,result}).sufficient)reasons.push('Adversarial result '+recordId(result,'adversarialResults')+' has insufficient evidence.');}break;"
if old not in s: raise RuntimeError('stage24 anchor missing')
s=s.replace(old,new,1)
old="if(unexpected.length)reasons.push('Unexpected representation inspections exist outside the current product artifact set.');if(inspections.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A final representation inspection is violated or undetermined.');break;"
new="if(unexpected.length)reasons.push('Unexpected representation inspections exist outside the current product artifact set.');if(inspections.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A final representation inspection is violated or undetermined.');for(const inspection of inspections)if(!evaluateEvidenceSufficiency(project,{result:inspection}).sufficient)reasons.push('Representation inspection '+recordId(inspection,'representationInspections')+' has insufficient evidence.');break;"
if old not in s: raise RuntimeError('stage25 anchor missing')
s=s.replace(old,new,1)
old="if(collection('productAudits').some(record=>upper(recordValue(record,'PRODUCT_DETERMINATION'))!=='SATISFIED'))reasons.push('Product audit is not SATISFIED.');"
new="if(collection('productAudits').some(record=>upper(recordValue(record,'PRODUCT_DETERMINATION'))!=='SATISFIED'))reasons.push('Product audit is not SATISFIED.');for(const audit of [...collection('processAudits'),...collection('productAudits')])if(!evaluateEvidenceSufficiency(project,{result:audit}).sufficient)reasons.push('Stage 26 audit '+String(audit.id||audit.recordId||'UNKNOWN')+' has insufficient evidence.');const stage26Contradictions=detectCurrentContradictions(project);if(stage26Contradictions.length)reasons.push('Current process/product evidence contains unresolved contradictions: '+stage26Contradictions.map(x=>x.type+':'+x.key).join(', ')+'.');"
if old not in s: raise RuntimeError('stage26 anchor missing')
s=s.replace(old,new,1);p.write_text(s)

p=Path('app-core.js');s=p.read_text()
old="function overview(){const currentStage=Math.max(1,Math.min(30,Number(String(current.job.CURRENT_STAGE||'').match(/\\d+/)?.[0]||1))),done=completion(),blockers=engine.openBlockers(current).length;return `"
new="function overview(){const currentStage=Math.max(1,Math.min(30,Number(String(current.job.CURRENT_STAGE||'').match(/\\d+/)?.[0]||1))),done=completion(),blockers=engine.openBlockers(current).length,reliability=engine.operationalMetrics(current),measured=reliability.materiallyIndependentAcceptedOperations>0,reliabilityMarkup=measured?`<div class=\\\"panel\\\"><h2 class=\\\"section-title\\\">Observed reliability — this project only</h2><p class=\\\"section-intro\\\">Operational measurement is reported separately from deterministic conformance. Browser-local project history is not a population-wide reliability claim.</p><div class=\\\"stage-action-strip\\\"><span>Materially independent accepted operations: <strong>${reliability.materiallyIndependentAcceptedOperations}</strong></span><span>Observed silent failures: <strong>${reliability.observedSilentFailures}</strong></span><span>Artifact identity mismatches: <strong>${reliability.artifactIdentityMismatches}</strong></span><span>Regression recurrences: <strong>${reliability.regressionRecurrences}</strong></span></div>${reliability.zeroFailure95PercentUpperBound!==null?`<div class=\\\"notice\\\">Zero silent failures observed across ${reliability.materiallyIndependentAcceptedOperations} materially independent accepted operations. Approximate 95% upper bound: ${(reliability.zeroFailure95PercentUpperBound*100).toFixed(2)}%. This is an observed project-local bound, not a guarantee.</div>`:''}</div>`:'';return `"
if old not in s: raise RuntimeError('overview function anchor missing')
s=s.replace(old,new,1)
old="${blockers?`<div class=\"notice warn\">${blockers} open mandatory blocker${blockers===1?'':'s'} affect progression.</div>`:''}<div class=\"panel completed-work-panel\">"
new="${blockers?`<div class=\"notice warn\">${blockers} open mandatory blocker${blockers===1?'':'s'} affect progression.</div>`:''}${reliabilityMarkup}<div class=\"panel completed-work-panel\">"
if old not in s: raise RuntimeError('overview reliability insertion anchor missing')
s=s.replace(old,new,1);p.write_text(s)

p=Path('verify-complete.mjs');s=p.read_text();s += r'''

// reliability-v2-final: result-consuming gates reject epistemically insufficient evidence at the earliest responsible stage.
{
 const source=fs.readFileSync('workflow-engine.js','utf8');for(const token of ['Meaning review \'','Adversarial result \'','Representation inspection \'','Stage 26 audit \'','Current process/product evidence contains unresolved contradictions'])assert(source.includes(token),'Missing local evidence/contradiction gate: '+token);
}
''';p.write_text(s)
p=Path('verify-browser-extra.mjs');s=p.read_text();s += r'''
{
 const source=fs.readFileSync('app-core.js','utf8');for(const token of ['Observed reliability — this project only','Materially independent accepted operations','Observed silent failures','Approximate 95% upper bound','not a guarantee'])if(!source.includes(token))throw new Error('Missing project-local reliability presentation: '+token);
}
''';p.write_text(s)

runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def blob(path):
 data=Path(path).read_bytes();return hashlib.sha1((f'blob {len(data)}\0').encode()+data).hexdigest()
manifest=''.join(f'{f}:{blob(f)}\n' for f in runtime);token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p=Path('index.html');html=p.read_text();html=re.sub(r'(<script\s+defer\s+src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]+',lambda m:m.group(1)+token,html);p.write_text(html)
