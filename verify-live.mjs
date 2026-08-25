const base=process.env.PAGE_URL;if(!base)throw new Error('PAGE_URL is required');const required={
'index.html':['Reliability Workbook','workbook.js','app.js'],
'app.js':['workflow-model.js','workflow-engine.js','project-store.js','response-ingestion.js','prompt-engine.js','app-core.js'],
'workflow-model.js':['closed-loop-stage-response/1','HUMAN_DECISION','STAGE_COLLECTIONS'],
'workflow-engine.js':['stageGate','deriveReleaseGate','recalculateProject','sourceIsIndependent'],
'project-store.js':['closed-loop-reliability-projects-v3','reconcileRetained','transaction'],
'response-ingestion.js':['parseAndValidate','commitProposal','extractionManifest','TARGET_PRODUCT_SOURCE_PROHIBITED'],
'prompt-engine.js':['closed-loop-stage-response/1','HUMAN_INPUT_REQUIRED','genuinely independent external'],
'app-core.js':['Parse and validate','Accept response','Request correction','Human clarification required'],
'workbook.js':['RUN INDEPENDENT MEANING-BASED VERIFICATION'],
'TEST_PROJECT.json':['JOB-20260823144121','Mobile Closed-Loop Agent Reliability Workbook','Proceed to Operation 02']};
for(const [path,tokens] of Object.entries(required)){const r=await fetch(new URL(`${path}?live=${Date.now()}`,base),{cache:'no-store'});if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);const body=await r.text();for(const t of tokens)if(!body.includes(t))throw new Error(`${path} missing ${t}`);if(/GEN-042|field status report|maintenance[- ]handoff/i.test(body)&&path!=='TEST_PROJECT.json')throw new Error(`${path} contains unauthorized active product content`)}
const p=await (await fetch(new URL(`TEST_PROJECT.json?live=${Date.now()}`,base),{cache:'no-store'})).json();if(p.jobId!=='JOB-20260823144121'||p.currentStage!==2||p.currentState!=='READY')throw new Error('Retained project state mismatch');if((p.sourceInventory||[]).length||(p.requirements||[]).length)throw new Error('Retained downstream data was fabricated');if(p.currentVersions?.sources!=='NOT APPLICABLE')throw new Error('Retained source-set version must be NOT APPLICABLE');console.log(JSON.stringify({pageUrl:base,sourceIdentity:true,retainedProject:true},null,2));
