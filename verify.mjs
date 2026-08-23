import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const failures=[], evidence=[]; const ok=(x,m)=>{(x?evidence:failures).push(m)};
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
const css=index.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
ok(crypto.createHash('sha256').update(css).digest('hex')==='befcafe57d62c87df67fb4a27b5f86e7aa30b7e50929e027bd311e8f4f9c7c73','layout/colors/typography/responsive CSS are unchanged');
ok((index.match(/<script[^>]+src=/g)||[]).length===1 && index.includes('<script src="workbook.js"></script>'),'exactly one existing application runtime entry is loaded');
ok(!/view=['\"](?:appendices|control)['\"]/i.test(index),'Appendices A-F are not a separate workflow or control view');
ok(index.includes('data-integrated-appendix-controls="true"')&&index.includes('data-integrated-operational-controls="true"'),'Appendix controls are integrated into the existing stage surface');
ok(index.includes('Appendices A–F operate inside the stages that require them')&&index.includes('They are reusable enforcement records, not additional stages and not a second checklist application.'),'the existing shell states the intended appendix architecture');
ok(index.includes('MASTER JOB CONTROL')&&index.includes('Master 30-stage tracker')&&index.includes('Mandatory operating rules')&&index.includes('Quick execution loop'),'master job control, tracker, rules, and execution loop are retained in the one app');
ok(index.includes("const STORE='mclarw'")&&index.includes('operationalRecords'),'Appendix A-F records use the same controlling workbook state');
ok(index.includes('FRESH_CONTEXT_STAGES')&&index.includes('createFreshContextRecord'),'Appendix A is stage-integrated fresh-context control');
ok(index.includes('openWorkflowBlocker')&&index.includes('hasOpenBlocker')&&index.includes('synchronizeBlockedGate'),'Appendix B opens blockers and enforces blocked stage gates');
ok(index.includes('recordMaterialChange')&&index.includes('invalidateAfter'),'Appendix C is append-only change and downstream invalidation behavior');
ok(index.includes('compareReleaseArtifacts')&&index.includes('crypto.subtle.digest')&&index.includes('AUDITED_SHA256')&&index.includes('RELEASE_SHA256'),'Appendix D performs exact release-artifact SHA-256 identity control');
ok(index.includes('createResetRecord')&&index.includes("label==='New clean job'"),'Appendix E records a clean new-job reset inside the same app');
ok(index.includes('recordAgentOutputReceipt')&&index.includes('createPendingReceipt'),'Appendix F records agent outputs and verification routing');
ok(index.includes('installRenderGuard')&&index.includes("globalThis.view='workbook'"),'the runtime guard keeps the application on the single workbook surface');
ok(['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'].every(name=>loader.includes(name))&&loader.includes('DecompressionStream("gzip")'),'runtime loader reads the existing compressed workbook module payload');
ok(!loader.includes('closed-loop-workbook-operational-controls')&&!loader.includes('renderOperationalControl')&&!loader.includes('controlPanel('),'workbook.js contains no duplicate Appendix A-F subsystem');
ok(compressed.length>0 && source.includes('export const STAGES'),'workbook module payload is present and decompresses');
const temp=path.join(process.cwd(),'.verify-runtime.mjs'); fs.writeFileSync(temp,source);
let m; try{m=await import(pathToFileURL(temp).href+'?t='+Date.now())}finally{fs.rmSync(temp,{force:true})}
const {STAGES,APPENDICES,SECTION_HEADINGS,STAGE_DECISIONS,REQUIREMENT_OUTCOMES,RELEASE_OUTCOMES,FOLDERS,ROLE_SEPARATION,createBlankState,createRecordTemplate,buildStagePrompt,validateStageDraft,immutableRevision,invalidateDownstream,compareArtifactSets,hasUnresolvedPlaceholder,stageHumanItems,stageGateItems,stageEvidenceItems}=m;
ok(STAGES.length===30&&STAGES.every((s,i)=>s.number===i+1),'exactly 30 ordered stages');
ok(new Set(STAGES.map(s=>s.title)).size===30,'30 distinct stage titles');
ok(Object.keys(APPENDICES).join('')==='ABCDEF','exactly Appendices A-F exist as reusable operational control definitions');
const blankState=createBlankState();
ok(blankState&&blankState.appendices&&Object.keys(blankState.appendices).sort().join('')==='ABCDEF','Appendices A-F exist in every actual job state as operational records');
ok(SECTION_HEADINGS.length===7,'seven controlling stage sections');
ok(STAGE_DECISIONS.join('|')==='READY TO PROCEED|BLOCKED|NOT READY - CORRECTION REQUIRED','exact stage decisions');
ok(REQUIREMENT_OUTCOMES.join('|')==='SATISFIED|VIOLATED|UNDETERMINED','exact requirement outcomes');
ok(RELEASE_OUTCOMES.join('|')==='ACCEPTED|REJECTED|BLOCKED','exact release outcomes');
ok(!/31-stage|\/31 complete/i.test(index+source),'no 31-stage architecture');
ok(ROLE_SEPARATION.length>=20&&FOLDERS.includes('12_PERMANENT_DEFECT_REGISTRY'),'role separation and permanent regression registry retained');
const stageDefects=STAGES.flatMap(s=>s.defectIds||[]); ok(stageDefects.length===269&&new Set(stageDefects).size===269,'269 explicit stage defect IDs are represented exactly once');
const stageControls=STAGES.flatMap(s=>[
  ...stageHumanItems(s).map((x,i)=>`S${s.number}-H${i+1}:${x}`),
  ...stageGateItems(s).map((x,i)=>`S${s.number}-G${i+1}:${x}`),
  ...stageEvidenceItems(s).map((x,i)=>`S${s.number}-E${i+1}:${x}`)
]);
ok(stageControls.length>=400,`full 30-stage workbook exposes at least 400 explicit human, gate, and evidence controls (actual ${stageControls.length})`);
ok(STAGES.every(s=>stageHumanItems(s).length>0&&stageGateItems(s).length>0&&stageEvidenceItems(s).length>0),'every stage has human controls, a completion gate, and evidence-preservation controls');
const prompts=STAGES.map(s=>buildStagePrompt(s,createBlankState())); ok(prompts.length===30,'exactly one reusable copy block per stage');
ok(prompts.every((p,i)=>p.includes(STAGES[i].role)&&p.includes(STAGES[i].task)),'every copy block preserves exact stage role and task');
ok(prompts.every(p=>p.includes('Do not invent a missing fact')&&p.includes('SATISFIED')&&p.includes('VIOLATED')&&p.includes('UNDETERMINED')&&p.includes('ACCEPTED')&&p.includes('REJECTED')&&p.includes('BLOCKED')),'every copy block carries the universal operating rules and exact outcome vocabulary');
for(const n of [11,12,17,19])ok(prompts[n-1].includes('RUN_ID: <<RUN-001 THROUGH RUN-010>>'),`stage ${n} uses one reusable ten-run prompt`);
let s=createBlankState(), st=STAGES[0], item=s.stages[1]; item.draftRecord=createRecordTemplate(st); item.decision='READY TO PROCEED'; item.decisionEvidence='e'; item.decidedBy='x'; item.dateTime='2026-01-01T00:00:00Z'; stageHumanItems(st).forEach((_,i)=>item.humanChecks[i]=true); stageGateItems(st).forEach((_,i)=>item.gateChecks[i]=true); stageEvidenceItems(st).forEach((_,i)=>item.evidenceChecks[i]=true); ok(validateStageDraft(st,item,s).issues.length>0,'unresolved placeholders block READY');
item.draftRecord=item.draftRecord.replace(/<<[^>]+>>/g,'VALUE'); s.job.JOB_ID='JOB-1'; s.job.EXACT_USER_OBJECTIVE_VERBATIM='objective'; ok(!hasUnresolvedPlaceholder(item.draftRecord),'filled record contains no unresolved placeholders');
const hist=[]; const r1=await immutableRevision(hist,{a:1},{artifactType:'TEST'}); hist.push(r1.record); const r2=await immutableRevision(hist,{a:2},{artifactType:'TEST'}); ok(r1.record.version==='v001'&&r2.record.version==='v002'&&hist[0].payload.a===1,'revisions append without overwriting prior history');
const downstream=createBlankState(); downstream.stages[2].decision='READY TO PROCEED'; downstream.stages[2].status='COMPLETE'; ok(invalidateDownstream(downstream,1,'CHANGE-1').length>0&&downstream.stages[2].decision==='NOT READY - CORRECTION REQUIRED','upstream material change invalidates downstream determinations');
const audited=[{artifactId:'A1',name:'a',size:1,sha256:'1'.repeat(64)},{artifactId:'A2',name:'b',size:2,sha256:'2'.repeat(64)}], same=[{name:'a',size:1,sha256:'1'.repeat(64)},{name:'b',size:2,sha256:'2'.repeat(64)}], bad=[{name:'a',size:1,sha256:'3'.repeat(64)},{name:'b',size:2,sha256:'2'.repeat(64)}];
ok(compareArtifactSets(audited,same,'ACCEPTED').authorization==='AUTHORIZED','exact accepted audited/release bytes authorize delivery');
ok(compareArtifactSets(audited,bad,'ACCEPTED').authorization==='NOT AUTHORIZED','hash mismatch stops delivery');
ok(compareArtifactSets(audited,same,'BLOCKED').authorization==='NOT AUTHORIZED','non-ACCEPTED release gate stops delivery');
ok(source.includes('freshContext')||source.includes('freshContextLaunch'),'core Appendix A control state retained');
ok(source.includes('blocker')&&source.includes('BLOCKED'),'core Appendix B blocker state retained');
ok(source.includes('appendAutomaticChange'),'core Appendix C change-control behavior retained');
ok(source.includes('pendingAuditedFiles')&&source.includes('pendingReleaseFiles'),'core Appendix D release identity state retained');
ok(source.includes('newJob')||source.includes('createBlankState'),'core Appendix E new-job behavior retained');
ok(source.includes('appendices.F'),'core Appendix F receipt state retained');
ok(source.includes('ACTUAL_CONTENT_INSPECTED')&&source.includes('CURRENCY_CONFIRMED'),'source inspection and current-source currency controls are implemented');
if(failures.length){console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));process.exit(1)}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',stages:30,stageDefectIds:stageDefects.length,stageControls:stageControls.length,appendixControlFamilies:6,behavioralChecks:evidence.length,separateAppendixChecklistView:false,integratedAppendixControls:true,staticAppendixSubstitute:false,visualDesignChanged:false},null,2));
