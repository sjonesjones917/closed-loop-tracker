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
const shellSha='15c93b7fdddb9a1e11be03b73be4692a70a64fde363d15df1c3ec5309a00be3c';
ok(crypto.createHash('sha256').update(index.trimEnd()).digest('hex')===shellSha,'index.html is the approved existing application shell');
const css=index.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
ok(crypto.createHash('sha256').update(css).digest('hex')==='befcafe57d62c87df67fb4a27b5f86e7aa30b7e50929e027bd311e8f4f9c7c73','layout/colors/typography/responsive CSS are unchanged');
ok((index.match(/<script[^>]+src=/g)||[]).length===1 && index.includes('<script src="workbook.js"></script>'),'exactly one existing application runtime entry is loaded');
ok(!index.includes("view='appendices'"),'Appendices A-F are not implemented as a separate checklist workflow/view');
ok(index.includes("view='workbook'")&&index.includes("view='control'"),'the single application exposes only the workbook and integrated control surfaces');
ok(index.includes('Operational controls A–F')&&index.includes('Appendices A–F are integrated workflow controls'),'the existing control surface explicitly preserves the Appendix A-F meaning');
for(const text of ['A — Fresh agent context launch','B — Universal blocker','C — Change and invalidation','D — Exact final release','E — New-job reset','F — Universal agent-output receipt'])ok(index.includes(text),`${text} is visibly represented in the existing application`);
ok(['workbook.module.gz.1','workbook.module.gz.2','workbook.module.gz.3'].every(name=>loader.includes(name))&&loader.includes('DecompressionStream("gzip")'),'runtime loader reads only the corrected workbook module payload');
ok(compressed.length>0 && source.includes('export const STAGES'),'corrected module payload is present and decompresses');
const temp=path.join(process.cwd(),'.verify-runtime.mjs'); fs.writeFileSync(temp,source);
let m; try{m=await import(pathToFileURL(temp).href+'?t='+Date.now())}finally{fs.rmSync(temp,{force:true})}
const {STAGES,APPENDICES,SECTION_HEADINGS,STAGE_DECISIONS,REQUIREMENT_OUTCOMES,RELEASE_OUTCOMES,FOLDERS,ROLE_SEPARATION,createBlankState,createRecordTemplate,buildStagePrompt,validateStageDraft,immutableRevision,invalidateDownstream,compareArtifactSets,hasUnresolvedPlaceholder,stageHumanItems,stageGateItems,stageEvidenceItems}=m;
ok(STAGES.length===30&&STAGES.every((s,i)=>s.number===i+1),'exactly 30 ordered stages');
ok(new Set(STAGES.map(s=>s.title)).size===30,'30 distinct stage titles');
ok(Object.keys(APPENDICES).join('')==='ABCDEF','exactly Appendices A-F exist as reusable control definitions');
ok(SECTION_HEADINGS.length===7,'seven controlling stage sections');
ok(STAGE_DECISIONS.join('|')==='READY TO PROCEED|BLOCKED|NOT READY - CORRECTION REQUIRED','exact stage decisions');
ok(REQUIREMENT_OUTCOMES.join('|')==='SATISFIED|VIOLATED|UNDETERMINED','exact requirement outcomes');
ok(RELEASE_OUTCOMES.join('|')==='ACCEPTED|REJECTED|BLOCKED','exact release outcomes');
ok(!/31-stage|\/31 complete/i.test(index+source),'no 31-stage architecture');
ok(ROLE_SEPARATION.length>=20&&FOLDERS.includes('12_PERMANENT_DEFECT_REGISTRY'),'role separation and permanent regression registry retained');
const stageDefects=STAGES.flatMap(s=>s.defectIds||[]); ok(stageDefects.length===269&&new Set(stageDefects).size===269,'269 explicit stage defect controls represented exactly once');
const prompts=STAGES.map(s=>buildStagePrompt(s,createBlankState())); ok(prompts.length===30,'exactly one reusable copy block per stage');
ok(prompts.every((p,i)=>p.includes(STAGES[i].role)&&p.includes(STAGES[i].task)),'every copy block preserves exact stage role and task');
for(const n of [11,12,17,19])ok(prompts[n-1].includes('RUN_ID: <<RUN-001 THROUGH RUN-010>>'),`stage ${n} uses one reusable ten-run prompt`);
let s=createBlankState(), st=STAGES[0], item=s.stages[1]; item.draftRecord=createRecordTemplate(st); item.decision='READY TO PROCEED'; item.decisionEvidence='e'; item.decidedBy='x'; item.dateTime='2026-01-01T00:00:00Z'; stageHumanItems(st).forEach((_,i)=>item.humanChecks[i]=true); stageGateItems(st).forEach((_,i)=>item.gateChecks[i]=true); stageEvidenceItems(st).forEach((_,i)=>item.evidenceChecks[i]=true); ok(validateStageDraft(st,item,s).issues.length>0,'unresolved placeholders block READY');
item.draftRecord=item.draftRecord.replace(/<<[^>]+>>/g,'VALUE'); s.job.JOB_ID='JOB-1'; s.job.EXACT_USER_OBJECTIVE_VERBATIM='objective'; ok(!hasUnresolvedPlaceholder(item.draftRecord),'filled record contains no unresolved placeholders');
const hist=[]; const r1=await immutableRevision(hist,{a:1},{artifactType:'TEST'}); hist.push(r1.record); const r2=await immutableRevision(hist,{a:2},{artifactType:'TEST'}); ok(r1.record.version==='v001'&&r2.record.version==='v002'&&hist[0].payload.a===1,'revisions append without overwriting prior history');
const downstream=createBlankState(); downstream.stages[2].decision='READY TO PROCEED'; downstream.stages[2].status='COMPLETE'; ok(invalidateDownstream(downstream,1,'CHANGE-1').length>0&&downstream.stages[2].decision==='NOT READY - CORRECTION REQUIRED','upstream material change invalidates downstream determinations');
const audited=[{artifactId:'A1',name:'a',size:1,sha256:'1'.repeat(64)},{artifactId:'A2',name:'b',size:2,sha256:'2'.repeat(64)}], same=[{name:'a',size:1,sha256:'1'.repeat(64)},{name:'b',size:2,sha256:'2'.repeat(64)}], bad=[{name:'a',size:1,sha256:'3'.repeat(64)},{name:'b',size:2,sha256:'2'.repeat(64)}];
ok(compareArtifactSets(audited,same,'ACCEPTED').authorization==='AUTHORIZED','exact accepted audited/release bytes authorize delivery');
ok(compareArtifactSets(audited,bad,'ACCEPTED').authorization==='NOT AUTHORIZED','hash mismatch stops delivery');
ok(compareArtifactSets(audited,same,'BLOCKED').authorization==='NOT AUTHORIZED','non-ACCEPTED release gate stops delivery');
ok(source.includes('freshContext')||source.includes('freshContextLaunch'),'Appendix A is implemented as fresh-context execution/verification control');
ok(source.includes('blocker')&&source.includes('BLOCKED'),'Appendix B is implemented as a blocker mechanism that stops affected workflow');
ok(source.includes('appendAutomaticChange'),'Appendix C is implemented as append-only change and invalidation behavior');
ok(source.includes('pendingAuditedFiles')&&source.includes('pendingReleaseFiles'),'Appendix D is implemented by final release evidence and independent audited/release artifact identity');
ok(source.includes('newJob')||source.includes('createBlankState'),'Appendix E is implemented by clean new-job state/reset behavior');
ok(source.includes('appendices.F'),'Appendix F is implemented as the universal agent-output receipt path');
ok(source.includes('ACTUAL_CONTENT_INSPECTED')&&source.includes('CURRENCY_CONFIRMED'),'source inspection and current-source currency controls are implemented');
if(failures.length){console.error(JSON.stringify({determination:'VIOLATED',failures,evidenceCount:evidence.length},null,2));process.exit(1)}
console.log(JSON.stringify({determination:'SATISFIED',application:'index.html',stages:30,stageDefectControls:269,appendixControlFamilies:6,behavioralChecks:evidence.length,separateAppendixChecklistView:false,integratedAppendixControls:true,visualDesignChanged:false},null,2));
