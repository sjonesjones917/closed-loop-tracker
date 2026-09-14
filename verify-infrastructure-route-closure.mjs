// Repository-only aggregation of executed infrastructure component cases.
// These suites do not establish every route, stage, or operator journey.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
function execute(file,caseProperty){
  const location=new URL(`./${file}`,import.meta.url);
  const stdout=execFileSync(process.execPath,[location.pathname],{encoding:'utf8',maxBuffer:64*1024*1024});
  const reports=stdout.trim().split(/\n(?=\{)/).map(value=>JSON.parse(value));
  const report=reports.findLast(value=>Array.isArray(value[caseProperty]));
  assert.ok(report,`${file}: missing identified executed cases.`);
  const cases=report[caseProperty];
  assert.ok(cases.length>0,`${file}: empty execution report.`);
  const ids=cases.map(item=>item.id||item.caseId);
  assert.ok(ids.every(id=>typeof id==='string'&&id.length));
  assert.equal(new Set(ids).size,ids.length,`${file}: duplicate case identity.`);
  assert.ok(cases.every(item=>item.result==='PASS'),`${file}: a component case failed.`);
  return {file,sourceSha256:digest(fs.readFileSync(location)),stdoutSha256:digest(stdout),exitCode:0,evidenceClass:report.evidenceClass,cases};
}
const ingestion=execute('verify-ingestion.mjs','ingestionNegativePairCases');
for(const id of ['wrong job','wrong stage','stale prompt id','agent application field','agent human field','unresolved relationship','missing evidence']){
  const result=ingestion.cases.find(item=>item.id===id);
  assert.ok(result&&result.expectedCode&&result.actualCodes.includes(result.expectedCode)&&result.corrected==='ACCEPTED_PROPOSAL',`Ingestion rejection/repair result missing: ${id}`);
}
const lifecycle=execute('verify-project-lifecycle.mjs','lifecycleCases');
for(const id of ['bulk-write:stale-revision-atomic','backup:required-canonical-bytes','backup:required-prompt-context','import:pre-commit-failure-preserves-state','storage-worker:commit-survives-lost-reply']){
  assert.ok(lifecycle.cases.some(item=>item.caseId===id),`Lifecycle result missing: ${id}`);
}
console.log(JSON.stringify({
  infrastructureComponentVerification:'PASS',
  infrastructureRouteClosure:'UNESTABLISHED',
  evidenceClass:'EXECUTED_SYNTHETIC_COMPONENT_CASES_WITH_STORAGE_IO_DOUBLE',
  completeRouteCoverageEstablished:false,
  completeOperatorJourney:false,
  physicalDeviceAcceptance:false,
  executions:[ingestion,lifecycle]
},null,2));
