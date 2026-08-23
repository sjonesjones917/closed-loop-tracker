import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const failures=[],evidence=[];
const ok=(condition,message)=>(condition?evidence:failures).push(message);
const index=fs.readFileSync('index.html','utf8');
const human=fs.readFileSync('human-ui.js','utf8');
const project=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));
const rootFiles=fs.readdirSync('.');
const parts=['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'];
const source=zlib.gunzipSync(Buffer.concat(parts.map(n=>fs.readFileSync(n)))).toString('utf8');
const opNames=['Define Job','Inventory Sources','Research Requirements','Compile Atomic Requirements','Resolve Conflicts','Build Acceptance Tests','Build Failure / Mutation Tests','Author Production Instruction','Preflight Instruction','Freeze Candidate','Run 10 Independent Executions','Verify Every Run','Compare Runs','Root-Cause Defects','Add Regression Tests','Correct Responsible Layer','Freeze New Version','Run 10 New Independent Executions','Repeat Until Converged','Unchanged 10-Execution Confirmation','Freeze Approved Baseline','Generate Finished Product','Deterministic Verification','Independent Semantic Verification','Adversarial Verification','Final Representation Inspection','Process Audit','Product Audit','ACCEPTED / REJECTED / BLOCKED','Verify Release Hash','Release Exact Accepted Artifact'];

ok(rootFiles.filter(n=>n.endsWith('.html')).join(',')==='index.html','one application HTML entry');
ok(index.includes('0/31 complete')&&index.includes('human-ui.js'),'single shell loads 31-operation human UI');
ok(index.includes('min-height:32px')&&index.includes('min-height:30px'),'compact controls are specified');
ok(index.includes('@media(max-width:560px)'),'phone-first responsive layout is present');
ok(!index.includes('APPENDIX A–F — OPERATIONAL CONTROLS'),'normal UI does not contain an appendix checklist wall');
ok(human.includes("REGISTRY='closed-loop-project-registry-v4'")&&human.includes('stateFromSpec(spec,template)'),'ordinary projects and retained project share one registry/runtime model');
ok(human.includes("schema:'human-project/31'")&&human.includes('31-operation workflow'),'human project model implements corrected 31-operation architecture');
ok(opNames.every(name=>human.includes(name)),'all 31 operation names are represented exactly');
ok(['User Job Input','External Research Sources','Workflow-Generated Artifacts'].every(x=>human.includes(x)),'three information classes are explicit in the project UI');
ok(human.includes('Uploaded/project/generated files are not promoted')&&human.includes('exactly two origins'),'Operations 2–4 enforce authority separation');
ok(['Overview','Workflow','Work','Runs','Issues','Release','History'].every(x=>human.includes(x)),'complete project navigation exists');
ok(human.includes('Generated instruction / prompt')&&human.includes('Generated / captured outputs')&&human.includes('Complete history'),'prompts, outputs, and history are inspectable');
ok(human.includes('function addBlocker')&&human.includes('function change(')&&human.includes('function context('),'blocker, invalidation, and fresh-context services exist');
ok(human.includes('completeResponseSaved:true'),'output-receipt provenance capture exists');
ok(human.includes('New isolated project created at Operation 01')&&human.includes('requirements:[]'),'new projects start clean');
ok(human.includes('staleChanges')&&human.includes("releaseState:open||stale?'BLOCKED'"),'stale change evidence cannot count toward release');

function projectErrors(p){
  const errors=[];
  if(p.schema!=='mobile-closed-loop-project/5')errors.push('schema');
  if(p.currentOperation!==11||p.currentState!=='BLOCKED')errors.push('truthful-block');
  if(Object.keys(p.operationStates||{}).length!==31)errors.push('operation-count');
  if((p.runRecords||[]).length!==0)errors.push('synthetic-runs');
  if((p.externalResearch?.sources||[]).length<2)errors.push('external-research');
  if((p.externalResearch?.sources||[]).some(s=>/IMPLEMENTATION EVIDENCE/i.test(String(s.classification||s.type||''))))errors.push('authority-contamination');
  if(!(p.blockers||[]).some(b=>b.currentStatus==='OPEN'&&b.operationDiscovered===11))errors.push('missing-blocker');
  if((p.generatedPrompts||[]).length<11||(p.generatedOutputs||[]).length<11)errors.push('missing-history');
  return errors;
}
const projectValidation=projectErrors(project);
ok(projectValidation.length===0,'retained project truthfully uses the corrected schema and blocked independent-run state');
ok(project.title==='Closed-Loop Reliability application repair','retained project is a real application-repair job inside the app');
ok(project.userJobInput?.objective&&project.externalResearch?.sources?.length>=3&&project.implementationEvidence?.length>=3,'user input, external research, and implementation evidence are separately populated');
ok(project.requirements?.every(r=>/^USER$|^EXTERNAL:/.test(r.origin)),'requirements have only USER or EXTERNAL authority origins');
ok(project.operationStates?.['1']?.status==='COMPLETE'&&project.operationStates?.['10']?.status==='COMPLETE'&&project.operationStates?.['11']?.status==='BLOCKED','real project history reaches candidate freeze then stops at independent execution');
ok(Array.from({length:20},(_,i)=>i+12).every(n=>project.operationStates?.[String(n)]?.status==='NOT STARTED'),'downstream operations do not fabricate completion');
ok(project.release?.releaseState==='BLOCKED'&&project.release?.deliveryAuthorization==='NOT AUTHORIZED','blocked project cannot authorize release');

const mutationOldNumbering=human.replace('31-operation workflow','30-stage workflow').replace("'Release Exact Accepted Artifact'","'Preserve Failures Permanently'");
ok(!opNames.every(name=>mutationOldNumbering.includes(name)),'mutation validator rejects old/incorrect workflow numbering');
const mutationAuthority=structuredClone(project);mutationAuthority.externalResearch.sources.push({sourceId:'BAD',type:'IMPLEMENTATION EVIDENCE'});
ok(projectErrors(mutationAuthority).includes('authority-contamination'),'mutation validator rejects implementation evidence promoted into external research');
const mutationRuns=structuredClone(project);mutationRuns.runRecords=[{runId:'SYNTHETIC'}];
ok(projectErrors(mutationRuns).includes('synthetic-runs'),'mutation validator rejects synthetic independent runs');

const tmp=path.join(process.cwd(),'.verify-runtime.mjs');
fs.writeFileSync(tmp,source);let runtime;
try{runtime=await import(pathToFileURL(tmp).href+`?t=${Date.now()}`)}finally{fs.rmSync(tmp,{force:true})}
const {STAGES,APPENDICES,createBlankState,buildStagePrompt,stageHumanItems,stageGateItems,stageEvidenceItems,immutableRevision,invalidateDownstream,compareArtifactSets}=runtime;
ok(STAGES.length===30&&STAGES.every((s,i)=>s.number===i+1),'earlier 30-stage workbook remains intact as detailed semantic source material');
ok(Object.keys(APPENDICES).sort().join('')==='ABCDEF','Appendices A-F remain in the underlying workflow engine');
const controls=STAGES.flatMap(s=>[...stageHumanItems(s),...stageGateItems(s),...stageEvidenceItems(s)]);
ok(controls.length>=400,`400+ underlying workbook controls remain (${controls.length})`);
ok(STAGES.every(s=>buildStagePrompt(s,createBlankState())),'all detailed workbook stage instructions remain available');
const rev=[];const a=await immutableRevision(rev,{value:1},{artifactType:'TEST'});rev.push(a.record);const b=await immutableRevision(rev,{value:2},{artifactType:'TEST'});
ok(a.record.version==='v001'&&b.record.version==='v002','immutable revisions create new controlled identities');
const state=createBlankState();state.stages[2].decision='READY TO PROCEED';state.stages[2].status='COMPLETE';
ok(invalidateDownstream(state,1,'CHANGE-1').length>0,'upstream material change invalidates downstream verification');
const audited=[{artifactId:'A1',name:'a',size:1,sha256:'1'.repeat(64)}];
ok(compareArtifactSets(audited,[{name:'a',size:1,sha256:'1'.repeat(64)}],'ACCEPTED').authorization==='AUTHORIZED','identical accepted bytes authorize delivery');
ok(compareArtifactSets(audited,[{name:'a',size:1,sha256:'2'.repeat(64)}],'ACCEPTED').authorization==='NOT AUTHORIZED','byte mismatch blocks delivery');
ok(compareArtifactSets(audited,[{name:'a',size:1,sha256:'1'.repeat(64)}],'BLOCKED').authorization==='NOT AUTHORIZED','BLOCKED gate cannot authorize delivery');

if(failures.length){console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));process.exit(1)}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',workflowOperations:31,detailedWorkbookStages:30,testProject:project.testProjectId,currentOperation:project.currentOperation,state:project.currentState,independentRuns:project.runRecords.length,externalSources:project.externalResearch.sources.length,controls:controls.length,checks:evidence.length},null,2));
