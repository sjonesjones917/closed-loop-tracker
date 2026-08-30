import fs from 'node:fs';
const patch=(path,fn)=>{let s=fs.readFileSync(path,'utf8');const before=s;s=fn(s);if(s===before)console.log(`${path}: no change`);else{fs.writeFileSync(path,s);console.log(`${path}: updated`);}};
patch('verify.mjs',s=>s
 .replaceAll("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js']")
 .replaceAll("['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']","['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']")
 .replaceAll("'Revise the Responsible Layer'","'Correct the Root Cause'")
 .replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3')
 .replaceAll('closed-loop-project/2','closed-loop-project/3')
 .replaceAll('CUSTOM_PIPELINE','TEST_IR')
);
for(const path of ['verify-ingestion.mjs','verify-complete.mjs','verify-full-cycle.mjs','verify-prompt-semantics.mjs','verify-semantic-invariant.mjs','verify-definition-of-done.mjs','verify-project-lifecycle.mjs','verify-browser.mjs','verify-browser-extra.mjs','verify-live.mjs']){
 if(!fs.existsSync(path))continue;
 patch(path,s=>s.replaceAll('closed-loop-stage-response/2','closed-loop-stage-response/3').replaceAll('closed-loop-project/2','closed-loop-project/3').replaceAll('CUSTOM_PIPELINE','TEST_IR').replaceAll("'Revise the Responsible Layer'","'Correct the Root Cause'").replaceAll('REVISE THE RESPONSIBLE LAYER','CORRECT THE ROOT CAUSE'));
}
