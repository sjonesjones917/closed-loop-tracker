import fs from 'node:fs';

const p=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const fail=m=>{throw new Error(m)};
if(p.schema!=='mobile-closed-loop-project/5')fail('Retained project schema must be /5');
if(p.testProjectId!=='TEST-PROJECT-REAL-APP-001')fail('Unexpected retained project identity');
if(p.currentOperation!==11||p.currentState!=='BLOCKED')fail('Retained project must truthfully stop at blocked Operation 11 until ten independent runs exist');
if(Object.keys(p.operationStates||{}).length!==31)fail('All 31 operation states must exist');
for(let n=1;n<=10;n++)if(p.operationStates[String(n)]?.status!=='COMPLETE')fail(`Operation ${n} must preserve completed evidence`);
if(p.operationStates['11']?.status!=='BLOCKED')fail('Operation 11 must be BLOCKED');
for(let n=12;n<=31;n++)if(p.operationStates[String(n)]?.status!=='NOT STARTED')fail(`Operation ${n} must not claim downstream completion`);
if((p.runRecords||[]).length!==0)fail('Synthetic independent runs are prohibited');
if((p.externalResearch?.sources||[]).length<2)fail('Independent external research sources are required');
if((p.implementationEvidence||[]).some(x=>p.externalResearch.sources.some(s=>s.reference===x.reference)))fail('Implementation evidence cannot be promoted into external authority');
if((p.generatedPrompts||[]).length<11||(p.generatedOutputs||[]).length<11)fail('Generated prompts and outputs through Operation 11 must remain inspectable');
if(!(p.blockers||[]).some(b=>b.blockerId==='BLOCKER-001'&&b.currentStatus==='OPEN'))fail('Operation 11 blocker must be preserved');
console.log(JSON.stringify({determination:'SATISFIED',testProject:p.testProjectId,currentOperation:p.currentOperation,state:p.currentState,independentRuns:p.runRecords.length,externalSources:p.externalResearch.sources.length},null,2));
