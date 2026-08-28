from pathlib import Path
import hashlib,re

# Integration repair for the generated patch. The guarded runner applies this after the main transform and before every acceptance test.
p=Path('workflow-engine.js'); s=p.read_text()
old="return {total:items.length,counts,incompleteTestIds,unavailableTestIds,unsupportedApplicationTestIds,missingArtifactTestIds,items,handoff:executionHandoff(project,{stage:Number(project.activeStage||0)})};"
new="return {total:items.length,counts,incompleteTestIds,unavailableTestIds,unsupportedApplicationTestIds,missingArtifactTestIds,items};"
if old not in s: raise RuntimeError('testExecutionPlan recursion anchor missing')
s=s.replace(old,new,1)
old_ctx="if(ctx&&!['NONE','FALSE','CLEAN','NOT CONTAMINATED',''].includes(upper(recordValue(ctx,'CONTAMINATION_STATUS'))))reasons.push(cid+' context contamination is affirmative.');"
new_ctx="if(ctx&&['TRUE','YES','CONTAMINATED','DETECTED','POSITIVE'].includes(upper(recordValue(ctx,'CONTAMINATION_STATUS'))))reasons.push(cid+' context contamination is affirmative.');"
if old_ctx not in s: raise RuntimeError('context contamination epistemic anchor missing')
s=s.replace(old_ctx,new_ctx,1)
old_meaning="if(type==='MEANING'||result&&Object.prototype.hasOwnProperty.call(recordFields(result),'OBSERVED_MEANING')){"
new_meaning="if(Number(result?.stage)===23||result&&Object.prototype.hasOwnProperty.call(recordFields(result),'OBSERVED_MEANING')){"
if old_meaning not in s: raise RuntimeError('meaning evidence scope anchor missing')
s=s.replace(old_meaning,new_meaning,1);p.write_text(s)

p=Path('app-core.js'); s=p.read_text()
s=s.replace('<h2 class=\"section-title\">What happens next</h2><p class=\"section-intro\">The application derives executor, capability, exact file custody, and required return evidence from the accepted test definitions. You do not need to interpret execution modes manually.</p>', '<h2 class=\"section-title\">Verification execution — what happens next</h2><p class=\"section-intro\">The application derives executor, capability, exact file custody, and required return evidence from the accepted test definitions. You do not need to interpret execution modes manually. A filename, hash claim, or code block is not file possession. Tests requiring exact artifact bytes that are missing or unverified remain blocked; browser storage alone does not give an external executor access to those bytes.</p>',1)
s=s.replace("details('Exact execution routes',actionRows,true)","details('Who performs the current tests',actionRows,true)",1)
anchor="${blocked.length?`<div class=\"notice warn\"><strong>Execution is blocked.</strong><br>${blocked.map(x=>`${esc(x.testId)}: ${esc(x.blockingReason||'Execution cannot proceed.')}`).join('<br>')}</div>`:''}"
replacement="${plan.unsupportedApplicationTestIds.length?`<div class=\"notice danger\"><strong>Invalid application executor claim.</strong><br>No registered application-native executor exists for ${esc(plan.unsupportedApplicationTestIds.join(', '))}. Request a corrected Stage 6 test definition; do not substitute or fabricate native execution.</div>`:''}${blocked.length?`<div class=\"notice warn\"><strong>Execution is blocked.</strong><br>${blocked.map(x=>`${esc(x.testId)}: ${esc(x.blockingReason||'Execution cannot proceed.')}`).join('<br>')}</div>`:''}"
if anchor not in s: raise RuntimeError('unsupported executor UI anchor missing')
s=s.replace(anchor,replacement,1);p.write_text(s)

p=Path('verify-complete.mjs'); s=p.read_text()
old="const scope={requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001'};"
new="const scope=engine.currentScope(p);"
if old not in s: raise RuntimeError('reliability routing fixture scope anchor missing')
s=s.replace(old,new,1)
old_art="{FILENAME:'candidate.bin',TYPE:'application/octet-stream',BYTE_SIZE:1,SHA256:'a'.repeat(64),AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}"
new_art="{FILENAME:'candidate.bin',TYPE:'application/octet-stream',BYTE_SIZE:1,SHA256:'a'.repeat(64),STORAGE_REFERENCE:'indexeddb:ART-V2',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}"
if old_art not in s: raise RuntimeError('independence fixture artifact anchor missing')
s=s.replace(old_art,new_art,1)
prefix="ctx.fields.EXTERNAL_CONTEXT_IDENTIFIER='external-'+i;ctx.EXTERNAL_CONTEXT_IDENTIFIER='external-'+i;const run=engine.records(p,'runs')"
replacement_prefix="ctx.fields.EXTERNAL_CONTEXT_IDENTIFIER='external-'+i;ctx.EXTERNAL_CONTEXT_IDENTIFIER='external-'+i;ctx.fields.CONTAMINATION_STATUS='NONE';ctx.CONTAMINATION_STATUS='NONE';ctx.fields.AUTHORIZED_PROJECT_INPUTS=[];ctx.AUTHORIZED_PROJECT_INPUTS=[];const run=engine.records(p,'runs')"
if prefix not in s: raise RuntimeError('independence context fixture anchor missing')
s=s.replace(prefix,replacement_prefix,1)
contradiction_anchor="const scope={requirementsVersion:'R1',testSuiteVersion:'T1'};const d=record('deterministicResults',22,{REQ_ID:'REQ-C',TEST_ID:'TEST-C',DETERMINATION:'SATISFIED'},'DET-C')"
contradiction_replacement="const scope=engine.currentScope(p);const t=record('tests',6,{REQ_ID:'REQ-C',TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:'EXTERNAL_AGENT_TOOL',REQUIRED_CAPABILITY:'TEST_TOOL',ARTIFACT_REQUIREMENTS:'NONE',STATUS:'READY'},'TEST-C');t.scope={...scope};p.projectData.tests.push(t);const d=record('deterministicResults',22,{REQ_ID:'REQ-C',TEST_ID:'TEST-C',DETERMINATION:'SATISFIED'},'DET-C')"
if contradiction_anchor not in s: raise RuntimeError('contradiction fixture link anchor missing')
s=s.replace(contradiction_anchor,contradiction_replacement,1);p.write_text(s)

# Update the one shared runtime cache token from the exact post-patch runtime bytes.
runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes();return hashlib.sha1((f'blob {len(data)}\0').encode()+data).hexdigest()
manifest=''.join(f'{f}:{git_blob_sha(f)}\n' for f in runtime_files)
token='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
p=Path('index.html'); html=p.read_text();html=re.sub(r'(<script\s+defer\s+src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]+',lambda m:m.group(1)+token,html);p.write_text(html)
