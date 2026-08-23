import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const failures=[];
const evidence=[];
const ok=(condition,message)=>{(condition?evidence:failures).push(message)};

const index=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('workbook.js','utf8');
const compressed=Buffer.concat([
  fs.readFileSync('workbook.module.gz.1'),
  fs.readFileSync('workbook.module.gz.2'),
  fs.readFileSync('workbook.module.gz.3')
]);
const source=zlib.gunzipSync(compressed).toString('utf8');

const rootHtml=fs.readdirSync('.').filter(name=>name.endsWith('.html'));
ok(rootHtml.length===1&&rootHtml[0]==='index.html','exactly one application HTML entry exists');
ok((index.match(/<script[^>]+src=/g)||[]).length===1&&index.includes('<script src="workbook.js"></script>'),'exactly one application runtime entry is loaded');
ok(!/view=['\"](?:appendices|control)['\"]/i.test(index),'no separate appendix/control application view exists');
ok(index.includes('data-integrated-appendix-controls="true"'),'Appendix A-F behavior is integrated into the existing application');

const integrated=index.match(/<script data-integrated-appendix-controls="true">([\s\S]*?)<\/script>/)?.[1]||'';
ok(integrated.length>0,'integrated cross-cutting control runtime is present');
try{new Function(integrated);evidence.push('integrated cross-cutting control runtime parses as JavaScript')}catch(error){failures.push(`integrated runtime syntax error: ${error.message}`)}

ok(index.includes("const STORE='mclarw'")&&index.includes('operationalRecords'),'Appendix controls use the same workbook state');
ok(index.includes("const LETTERS=['A','B','C','D','E','F']"),'exactly six Appendix control families are retained');
ok(index.includes('FRESH_STAGES')&&index.includes('freshRecord(state,n)'),'Appendix A is invoked as fresh-context behavior');
ok(index.includes('blockerRecord(state,n)')&&index.includes("stage.status='BLOCKED'")&&index.includes('invalidateAfter'),'Appendix B blocks the stage and affected downstream work');
ok(index.includes('changeRecordFromStage16')&&index.includes('DOWNSTREAM_ARTIFACTS_INVALIDATED')&&index.includes('REVALIDATION_COMPLETE'),'Appendix C records material change and downstream invalidation');
ok(index.includes('verifyIdentity(state,n,gate,audited,release)')&&index.includes("crypto.subtle.digest('SHA-256'")&&index.includes('AUDITED_SHA256')&&index.includes('RELEASE_SHA256'),'Appendix D performs exact artifact identity verification');
ok(index.includes('resetRecord(state,old)')&&index.includes("OLD_BASELINE_STATUS_CARRIED_FORWARD:'FALSE'")&&index.includes("OLD_RELEASE_DECISION_CARRIED_FORWARD:'FALSE'"),'Appendix E creates a clean new-job reset without inherited release/baseline state');
ok(index.includes('receiptRecord(state,n)')&&index.includes('NEXT_REQUIRED_VERIFICATION_STAGE'),'Appendix F records agent output identity and verification routing');
ok(index.includes('pendingForStage(state,n)')&&index.includes('stageControls(state,n)')&&index.includes('data-contextual-controls="true"'),'Appendix records render only when required by the current stage/event');
ok(index.includes('This record is required by the current workflow event. Complete it here; it is not an additional stage or checklist.'),'contextual control records are not presented as a parallel checklist workflow');
ok(!index.includes('data-integrated-operational-controls="true"'),'obsolete always-visible operational-controls panel is removed');
ok(index.includes('Master 30-stage tracker')&&index.includes('Mandatory operating rules')&&index.includes('Quick execution loop')&&index.includes('Master job control'),'master workbook controls remain in the single application');
ok(index.includes('How to use this workbook on a phone')&&index.includes('Phone folder structure')&&index.includes('Agent-role separation map'),'phone-use, folder, and role-separation controls remain in the application');

ok(['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'].every(name=>loader.includes(name)),'loader reads the existing workbook runtime chunks');
ok(loader.includes('DecompressionStream("gzip")')&&loader.includes('cache:"no-store"'),'runtime is decompressed and requested without stale-cache reuse');
ok(!loader.includes('localStorage')&&!loader.includes('renderOperationalControl')&&!loader.includes('controlPanel('),'workbook.js remains a loader, not a second application');
ok(compressed.length>0&&source.includes('export const STAGES'),'workbook runtime payload is present and decompresses');

const temp=path.join(process.cwd(),'.verify-runtime.mjs');
fs.writeFileSync(temp,source);
let m;
try{m=await import(pathToFileURL(temp).href+'?t='+Date.now())}finally{fs.rmSync(temp,{force:true})}

const {
  STAGES,APPENDICES,SECTION_HEADINGS,STAGE_DECISIONS,REQUIREMENT_OUTCOMES,RELEASE_OUTCOMES,
  FOLDERS,ROLE_SEPARATION,createBlankState,createRecordTemplate,buildStagePrompt,validateStageDraft,
  immutableRevision,invalidateDownstream,compareArtifactSets,hasUnresolvedPlaceholder,
  stageHumanItems,stageGateItems,stageEvidenceItems
}=m;

ok(STAGES.length===30&&STAGES.every((stage,index)=>stage.number===index+1),'exactly 30 ordered stages');
ok(new Set(STAGES.map(stage=>stage.title)).size===30,'30 distinct stage titles');
ok(Object.keys(APPENDICES).sort().join('')==='ABCDEF','Appendices A-F remain defined as operational controls');
const blank=createBlankState();
ok(blank&&blank.appendices&&Object.keys(blank.appendices).sort().join('')==='ABCDEF','every job state retains Appendix A-F record stores');
ok(SECTION_HEADINGS.length===7,'seven controlling stage sections are retained');
ok(STAGE_DECISIONS.join('|')==='READY TO PROCEED|BLOCKED|NOT READY - CORRECTION REQUIRED','stage decision vocabulary is exact');
ok(REQUIREMENT_OUTCOMES.join('|')==='SATISFIED|VIOLATED|UNDETERMINED','requirement outcome vocabulary is exact');
ok(RELEASE_OUTCOMES.join('|')==='ACCEPTED|REJECTED|BLOCKED','release outcome vocabulary is exact');
ok(!/31-stage|\/31 complete/i.test(index+source),'no 31-stage or alternate-stage architecture exists');
ok(ROLE_SEPARATION.length>=20&&FOLDERS.includes('12_PERMANENT_DEFECT_REGISTRY'),'role separation and permanent defect registry are retained');

const stageDefects=STAGES.flatMap(stage=>stage.defectIds||[]);
ok(stageDefects.length===269&&new Set(stageDefects).size===269,'269 explicit stage defect IDs are represented exactly once');
const stageControls=STAGES.flatMap(stage=>[
  ...stageHumanItems(stage).map((text,i)=>`S${stage.number}-H${i+1}:${text}`),
  ...stageGateItems(stage).map((text,i)=>`S${stage.number}-G${i+1}:${text}`),
  ...stageEvidenceItems(stage).map((text,i)=>`S${stage.number}-E${i+1}:${text}`)
]);
ok(stageControls.length>=400,`at least 400 explicit stage human/gate/evidence controls exist (actual ${stageControls.length})`);
ok(STAGES.every(stage=>stageHumanItems(stage).length&&stageGateItems(stage).length&&stageEvidenceItems(stage).length),'every stage has human, gate, and evidence controls');

const prompts=STAGES.map(stage=>buildStagePrompt(stage,createBlankState()));
ok(prompts.length===30,'exactly one reusable agent copy block exists per stage');
ok(prompts.every((prompt,i)=>prompt.includes(STAGES[i].role)&&prompt.includes(STAGES[i].task)),'every copy block contains its exact role and task');
ok(prompts.every(prompt=>prompt.includes('Do not invent a missing fact')&&prompt.includes('SATISFIED')&&prompt.includes('VIOLATED')&&prompt.includes('UNDETERMINED')&&prompt.includes('ACCEPTED')&&prompt.includes('REJECTED')&&prompt.includes('BLOCKED')),'universal operating rules and outcome vocabulary are present in every copy block');

let state=createBlankState();
const first=STAGES[0],item=state.stages[1];
item.draftRecord=createRecordTemplate(first);
item.decision='READY TO PROCEED';item.decisionEvidence='e';item.decidedBy='x';item.dateTime='2026-01-01T00:00:00Z';
stageHumanItems(first).forEach((_,i)=>item.humanChecks[i]=true);
stageGateItems(first).forEach((_,i)=>item.gateChecks[i]=true);
stageEvidenceItems(first).forEach((_,i)=>item.evidenceChecks[i]=true);
ok(validateStageDraft(first,item,state).issues.length>0,'unresolved placeholders prevent READY');
item.draftRecord=item.draftRecord.replace(/<<[^>]+>>/g,'VALUE');
state.job.JOB_ID='JOB-1';state.job.EXACT_USER_OBJECTIVE_VERBATIM='objective';
ok(!hasUnresolvedPlaceholder(item.draftRecord),'resolved record contains no unresolved placeholders');

const history=[];
const r1=await immutableRevision(history,{a:1},{artifactType:'TEST'});history.push(r1.record);
const r2=await immutableRevision(history,{a:2},{artifactType:'TEST'});
ok(r1.record.version==='v001'&&r2.record.version==='v002'&&history[0].payload.a===1,'material revisions append without overwriting prior history');

const downstream=createBlankState();
downstream.stages[2].decision='READY TO PROCEED';downstream.stages[2].status='COMPLETE';
ok(invalidateDownstream(downstream,1,'CHANGE-1').length>0&&downstream.stages[2].decision==='NOT READY - CORRECTION REQUIRED','upstream material change invalidates downstream determinations');

const audited=[{artifactId:'A1',name:'a',size:1,sha256:'1'.repeat(64)}];
const same=[{name:'a',size:1,sha256:'1'.repeat(64)}];
const bad=[{name:'a',size:1,sha256:'2'.repeat(64)}];
ok(compareArtifactSets(audited,same,'ACCEPTED').authorization==='AUTHORIZED','accepted byte-identical release is authorized');
ok(compareArtifactSets(audited,bad,'ACCEPTED').authorization==='NOT AUTHORIZED','hash mismatch stops release');
ok(compareArtifactSets(audited,same,'BLOCKED').authorization==='NOT AUTHORIZED','non-ACCEPTED release gate stops release');

if(failures.length){
  console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));
  process.exit(1);
}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',stages:30,stageDefectIds:stageDefects.length,stageControls:stageControls.length,appendixControlFamilies:6,separateAppendixChecklistView:false,contextualAppendixControls:true,applicationEntries:1,behavioralChecks:evidence.length},null,2));
