#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
import re
p='.repair-reliability.mjs'
s=open(p,encoding='utf-8').read()
s=re.sub(r'(?<!\\)\$\{', r'\\${', s)
open(p,'w',encoding='utf-8').write(s)
PY
node .repair-reliability.mjs

python3 - <<'PY'
p='verify-ingestion.mjs'
s=open(p,encoding='utf-8').read().replace("makeProject('JOB-INGEST-INDEPENDENCE')","project('JOB-INGEST-INDEPENDENCE')").replace('promptFor(p,12)','savePrompt(p,12)')
s=s.replace("assert(prepared.validation.issues.some(x=>x.code==='VERIFIER_CONTEXT_REUSE'),'Observable verifier/generator context reuse was not rejected.');","if(!prepared.validation.issues.some(x=>x.code==='VERIFIER_CONTEXT_REUSE'))throw new Error('Observable verifier/generator context reuse was not rejected.');")
s=s.replace("assert(prepared.project.projectData.verification.length===0,'Rejected verifier-context reuse partially mutated canonical verification.');","if(prepared.project.projectData.verification.length!==0)throw new Error('Rejected verifier-context reuse partially mutated canonical verification.');")
open(p,'w',encoding='utf-8').write(s)

p='verify-complete.mjs'
s=open(p,encoding='utf-8').read().replace("assert(engine.applicationTestCapabilities().length===0,'Unexpected application-native executor registration.');","assert(JSON.stringify(engine.applicationTestCapabilities())===JSON.stringify(['CANONICAL_ARTIFACT_BYTE_IDENTITY']),'Application-native executor registry must contain only the exact byte-identity executor.');")
open(p,'w',encoding='utf-8').write(s)

p='workflow-engine.js'
s=open(p,encoding='utf-8').read()
s=s.replace("r.derivedIndependence=independence.determination;r.derivedEvidenceSufficient=evidence.sufficient;return !expectedSet.has(key)||!['APPLICATION_ESTABLISHED','EXTERNALLY_SUPPORTED'].includes(independence.determination)||!evidence.sufficient||!['SATISFIED','VIOLATED','UNDETERMINED'].includes(upper(recordValue(r,'DETERMINATION')));","return !expectedSet.has(key)||!['APPLICATION_ESTABLISHED','EXTERNALLY_SUPPORTED'].includes(independence.determination)||!evidence.sufficient||!['SATISFIED','VIOLATED','UNDETERMINED'].includes(upper(recordValue(r,'DETERMINATION')));")
s=s.replace("if(type==='MEANING'||result&&Object.prototype.hasOwnProperty.call(recordFields(result),'OBSERVED_MEANING'))","if(result&&(Number(result.stage)===23||Object.prototype.hasOwnProperty.call(recordFields(result),'OBSERVED_MEANING')))")
s=s.replace("mode=upper(recordValue(test,'EXECUTION_MODE')),type=upper(recordValue(test,'TEST_TYPE')),descriptor=", "mode=upper(recordValue(test,'EXECUTION_MODE')),type=upper(recordValue(test,'TEST_TYPE')),semanticMeaningRecord=Boolean(result&&(Number(result.stage)===23||Object.prototype.hasOwnProperty.call(recordFields(result),'OBSERVED_MEANING'))),descriptor=")
s=s.replace("if(['EXTERNAL_AGENT_TOOL','EXTERNAL_SYSTEM'].includes(mode)){requiredEvidenceClasses.push('CAPABILITY_EXECUTION_EVIDENCE');", "if(!semanticMeaningRecord&&['EXTERNAL_AGENT_TOOL','EXTERNAL_SYSTEM'].includes(mode)){requiredEvidenceClasses.push('CAPABILITY_EXECUTION_EVIDENCE');")
old="const ctx=byContext.get(verifier),inputs=String(recordValue(ctx,'AUTHORIZED_PROJECT_INPUTS')||'');if(ctx&&contaminatedValue(recordValue(ctx,'CONTAMINATION_STATUS')))reasons.push('Verifier/reviewer context has affirmative contamination.');if(/other verifier|prior verifier|comparison|root cause|proposed correction/i.test(inputs))reasons.push('Verifier/reviewer authorized inputs contain prohibited prior conclusions.');if(reasons.length)return {determination:'VIOLATED',reasons,evidence:[{verifierContextId:verifier,generatorContextId:generator}]};if(ctx&&isActiveRecord(ctx)&&(!recordValue(ctx,'CONTAMINATION_STATUS')||cleanValue(recordValue(ctx,'CONTAMINATION_STATUS'))))return {determination:'APPLICATION_ESTABLISHED',reasons:[],evidence:[{verifierContextId:verifier,generatorContextId:generator}]};"
new="const ctx=byContext.get(verifier),inputs=String(recordValue(ctx,'AUTHORIZED_PROJECT_INPUTS')||''),stageSupport=role==='MEANING_REVIEW'?project.stages?.[23]?.agentData?.EVALUATOR_INDEPENDENT_FROM_GENERATOR:role==='ADVERSARIAL_REVIEW'?project.stages?.[24]?.agentData?.REVIEWER_INDEPENDENT:null;if(ctx&&contaminatedValue(recordValue(ctx,'CONTAMINATION_STATUS')))reasons.push('Verifier/reviewer context has affirmative contamination.');if(/other verifier|prior verifier|comparison|root cause|proposed correction/i.test(inputs))reasons.push('Verifier/reviewer authorized inputs contain prohibited prior conclusions.');if(reasons.length)return {determination:'VIOLATED',reasons,evidence:[{verifierContextId:verifier,generatorContextId:generator}]};if(ctx&&isActiveRecord(ctx)&&(!recordValue(ctx,'CONTAMINATION_STATUS')||cleanValue(recordValue(ctx,'CONTAMINATION_STATUS'))))return {determination:'APPLICATION_ESTABLISHED',reasons:[],evidence:[{verifierContextId:verifier,generatorContextId:generator}]};if(!ctx&&truth(stageSupport))return {determination:'EXTERNALLY_SUPPORTED',reasons:['Reviewer separation is supported by accepted external evidence; the application does not claim observation of the external environment.'],evidence:[{verifierContextId:verifier||'UNOBSERVED',generatorContextId:generator}]};"
if old not in s: raise SystemExit('context independence follow-up target missing')
s=s.replace(old,new)
open(p,'w',encoding='utf-8').write(s)

p='verify-full-cycle.mjs'
s=open(p,encoding='utf-8').read()
s=s.replace("data(23,{records:{meaningResults:","data(23,{stageData:{EVALUATOR_INDEPENDENT_FROM_GENERATOR:true},records:{meaningResults:")
s=s.replace("data(24,{records:{adversarialResults:","data(24,{stageData:{REVIEWER_INDEPENDENT:true},records:{adversarialResults:")
open(p,'w',encoding='utf-8').write(s)
PY

rm -f .repair-reliability.mjs .trigger-reliability-hardening .github/workflows/reliability-hardening.yml

node - <<'NODE'
const fs=require('fs'),{createHash}=require('crypto');
const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const token=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');
for(const file of runtimeFiles)html=html.replace(new RegExp(`${file.replace('.','\\.')}\\?v=runtime-[a-f0-9]+`,'g'),`${file}?v=${token}`);
fs.writeFileSync('index.html',html);
console.log(token);
NODE

for file in app-core.js hash.js workflow-schema.js workflow-engine.js prompt-engine.js response-ingestion.js project-store.js workbook.js test-fixtures.mjs verify-hash.mjs verify.mjs verify-ingestion.mjs verify-complete.mjs verify-full-cycle.mjs verify-prompt-semantics.mjs verify-live.mjs verify-browser.mjs verify-browser-extra.mjs; do node --check "$file"; done

node build-test-project.mjs
node verify-hash.mjs
node verify.mjs
node verify-ingestion.mjs
node verify-complete.mjs
node verify-full-cycle.mjs
node verify-prompt-semantics.mjs

test "$(find . -maxdepth 1 -type f -name '*.html' | wc -l)" -eq 1
test ! -f authority-guard.js
test ! -f integrity-guard.js
test ! -f storage-reliability.js
test ! -f prompt-display.js
test ! -f experience.js
test ! -f usability.js
test ! -f app.js
! grep -R "document.write" --include='*.js' --include='*.html' .
! grep -R "MutationObserver" --include='*.js' --include='*.html' .

export BROWSER="$(command -v google-chrome || command -v chromium || command -v chrome || true)"
test -n "$BROWSER"
python3 -m http.server 4173 >/tmp/closed-loop-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
node verify-browser.mjs
node verify-browser-extra.mjs
kill "$SERVER_PID" 2>/dev/null || true
trap - EXIT

rm -f .harden-runner.sh .github/workflows/reliability-runner.yml

git config user.name github-actions[bot]
git config user.email 41898282+github-actions[bot]@users.noreply.github.com
git add workflow-engine.js prompt-engine.js response-ingestion.js app-core.js index.html verify-complete.mjs verify-ingestion.mjs verify-prompt-semantics.mjs verify-full-cycle.mjs verify-browser.mjs verify-browser-extra.mjs
git add -u .repair-reliability.mjs .trigger-reliability-hardening .github/workflows/reliability-hardening.yml .harden-runner.sh .github/workflows/reliability-runner.yml
git diff --cached --check
git commit -m "Harden execution evidence and operator guidance"
git push origin HEAD:reliability-evidence-hardening
