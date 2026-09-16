import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[];
for(const [suite,fault,oracle] of [['verify-context-provenance.mjs','global-prompt-input','PROMPT_PREREQUISITE_SCOPE_ORACLE'],['verify-context-provenance.mjs','limited-provenance','PROVENANCE_CONTEXT_ORACLE'],['verify-context-provenance.mjs','global-version','GOVERNING_VERSION_CONTEXT_ORACLE'],['verify-ui-acceptance-impact.mjs','skip-complete-confirmation','COMPLETE_ACCEPTANCE_IMPACT_ORACLE'],['verify-mutation-impact-projections.mjs','stale-projection','DERIVED_IMPACT_CONFIRMATION_ORACLE'],['verify-semantic-review-acceptance.mjs','review-request-invalidates','REVIEW_REQUEST_PROGRESS_ORACLE'],['verify-clarification-continuation.mjs','global-input-gate','CLARIFICATION_UPSTREAM_ORACLE'],['verify-clarification-continuation.mjs','global-input-selector','CLARIFICATION_SELECTOR_ORACLE']]){
 process.stderr.write(`Checking ${suite}: ${fault}\n`);
 const options=suite==='verify-clarification-continuation.mjs'?['--skip-matrix']:[];
 const broken=spawnSync(process.execPath,[suite,'--fault='+fault,...options],{encoding:'utf8',maxBuffer:8*1024*1024});assert.notEqual(broken.status,0,'Undetected implementation fault: '+fault);assert.match(broken.stderr,new RegExp(oracle),'The implementation fault failed for an unrelated reason.');
 const restored=spawnSync(process.execPath,[suite,...options],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(restored.status,0,restored.stderr);cases.push({suite,fault,result:'DETECTED',restoredImplementation:'PASS'});
}
console.log(JSON.stringify({synthetic:true,actualBrowser:false,method:'Targeted in-memory production faults; source files remain unchanged',cases},null,2));
