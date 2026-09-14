import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createOperatorBrowser,digest} from './operator-browser-driver.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {responseFixture,OBJECTIVE} from './operator-journey-fixtures.mjs';
globalThis.dispatchEvent=()=>true;
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const engine=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema;
const directory=path.resolve(process.env.RECOVERY_EVIDENCE_DIR||'recovery-browser-evidence'),browser=await createOperatorBrowser({directory});
const report={basis:'SYNTHETIC_EXTERNAL_COUNTERPART_WITH_ACTUAL_BROWSER_CONTROLS_INDEXEDDB_AND_FILE_TRANSPORT',physicalDevice:false,humanIndependenceEstablished:false,cases:[],failures:[],complete:false};
const record=(name,details={})=>report.cases.push({name,...details,result:'PASS'});
async function state(){return browser.project();}
async function position(){const h=await browser.navigationHistory();return h.entries[h.currentIndex];}
async function stageFiles(){const [archive]=await browser.download('#export-stage-files');const entries=readStoreArchive(archive.bytes),manifest=JSON.parse(Buffer.from(entries.find(e=>e.canonicalPath==='manifest.json').bytes).toString()),instructionBytes=Buffer.from(entries.find(e=>e.canonicalPath==='instruction.txt').bytes);for(const member of manifest.members){const bytes=entries.find(e=>e.canonicalPath===member.canonicalPath)?.bytes;assert.ok(bytes);assert.equal(digest(bytes),member.sha256);assert.equal(bytes.length,member.byteSize);}const p=(await state()).project,prompt=p.projectData.generatedPrompts.find(row=>row.instructionId===manifest.promptIdentity.instructionId);return {schema,engine,prompt,manifest,instructionBytes,contextFiles:manifest.contextFiles.map(file=>({filename:file.path,bytes:Buffer.from(entries.find(e=>e.canonicalPath===file.path).bytes)}))};}
async function uploadValid({reloadSelection=false}={}){const files=await stageFiles(),response=responseFixture(files);await browser.selectFiles('#response-json-file',[{filename:'response.json',bytes:Buffer.from(JSON.stringify(response)+'\n')}]);if(reloadSelection){const selectedEntry=await position();await browser.reload();assert.ok((await browser.evaluate(`document.querySelector('#response-file-status').textContent`)).includes('bytes saved'));assert.equal((await state()).project.projectData.rawResponses.length,0);await browser.click('[data-view="Project"]');await browser.fill('[data-job="JOB_TITLE"]','Disposable selection continuation');await browser.click('#save-job');await browser.restoreEntry(selectedEntry.id);record('Selected response file remains unvalidated and its exact bytes survive reload and version restoration');}await browser.click('#process-response-file');assert.ok(await browser.exists('#accept-proposal'));return response;}
const accepted=p=>p.projectData.acceptedChanges.filter(row=>!row.invalidatedBy);
try{
 await browser.click('#new-project');await browser.fill('[data-job="JOB_TITLE"]','Disposable recoverable acceptance journey');await browser.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]',OBJECTIVE);await browser.click('#save-job');
 assert.equal(await browser.evaluate(`document.querySelector('#next-required-action')!==null`),true,'Saving project information did not open the next operation');
 const initial=await state(),startEntry=await position();
 await uploadValid({reloadSelection:true});await browser.click('#accept-proposal');await browser.click('#confirm-stage-one');
 await browser.fill('#stage-picker',2);await stageFiles();const before=await state(),beforeEntry=await position();assert.equal(accepted(before.project).length,1);
 // Selection spans every registered stage. It cannot rewind accepted data.
 for(const selected of Object.keys(schema.STAGE_CONTRACTS).map(Number)){await browser.fill('#stage-picker',selected);assert.equal(await browser.evaluate(`Number(document.querySelector('#stage-picker').value)`),selected);}
 assert.deepEqual((await state()).project.projectData,before.project.projectData);record('Ordinary selection opens each of all 30 stages in the active version without changing project data');
 await browser.fill('#stage-picker',1);await browser.fill('#accepted-refinement-reason','Reassess the retained input for the same requested output.');await browser.click('#refine-accepted-response');
 const prepared=await state();assert.deepEqual(accepted(prepared.project),accepted(before.project));assert.ok(prepared.project.projectData.generatedPrompts.some(row=>row.stage===2&&!row.invalidatedBy));record('Replacement execution preserves accepted result and pending dependent work');
 await uploadValid();await browser.click('#accept-proposal');assert.ok(await browser.exists('#replacement-confirmation'));
 assert.equal(await browser.evaluate(`(()=>{const n=document.querySelector('#replacement-confirmation'),r=n.getBoundingClientRect();return r.top>=0&&r.top<innerHeight&&n.innerText.includes('Stage 02')&&n.innerText.includes('History')})()`),true,'Replacement impact was incomplete or not brought into view');
 const unanswered=await state();assert.equal(accepted(unanswered.project).length,1);await browser.click('#keep-current-progress');assert.deepEqual(accepted((await state()).project),accepted(unanswered.project));
 await browser.reload();const reloaded=await state();assert.equal(accepted(reloaded.project).length,1);assert.ok(reloaded.project.projectData.responseProposals.some(row=>row.status==='PENDING_OPERATOR_REVIEW'));record('Cancellation and unanswered confirmation survive reload without accepting or invalidating');
 await browser.fill('#stage-picker',1);await browser.click('#accept-proposal');await browser.click('#accept-replacement');const after=await state(),afterEntry=await position();assert.equal(after.project.projectData.acceptedChanges.length,2);assert.ok(after.project.projectData.generatedPrompts.filter(row=>row.stage===2).every(row=>row.invalidatedBy));record('Confirmed replacement commits once and invalidates pending dependent work');
 for(const destination of [beforeEntry,afterEntry,startEntry,beforeEntry,afterEntry]){await browser.restoreEntry(destination.id);const actual=(await state()).project,expected=destination.id===beforeEntry.id?before.project:destination.id===afterEntry.id?after.project:initial.project;assert.deepEqual(actual.projectData,expected.projectData);assert.deepEqual(actual.stages,expected.stages);}record('Native history restores complete destination versions across arbitrary retained-entry distances',{traversals:5});
 await browser.click('#history-undo');const undone=await state();await browser.click('#history-redo');assert.deepEqual((await state()).project.projectData,after.project.projectData);record('Undo and Redo restore project state through the same checkpoint mechanism');
 await browser.restoreEntry(beforeEntry.id);await browser.click('[data-view="Project"]');await browser.fill('[data-job="JOB_TITLE"]','Retained alternative continuation');await browser.click('#save-job');if(await browser.exists('#accept-replacement'))await browser.click('#accept-replacement');
 const branched=await state();assert.ok(branched.package.recovery.entries.some(entry=>entry.id===new URL(afterEntry.url).searchParams.get('version')));record('New continuation keeps the previous forward version in application History');
 await browser.fill('#history-version',new URL(afterEntry.url).searchParams.get('version'));await browser.click('#history-restore');assert.deepEqual((await state()).project.projectData,after.project.projectData);
 const exported=await state();await browser.selectFiles('#import-file',[{filename:'recovery.closed-loop.json.gz',bytes:exported.file.bytes}]);const imported=await state();assert.deepEqual(imported.project.projectData,exported.project.projectData);for(const entry of exported.package.recovery.entries)assert.ok(imported.package.recovery.entries.some(saved=>saved.id===entry.id));record('Actual exported backup bytes restore active data and retained alternatives');
 await browser.openUrl(beforeEntry.url);assert.deepEqual((await state()).project.projectData,before.project.projectData);record('Saved-version direct link resolves the named complete version');
 assert.deepEqual(browser.exceptions(),[]);report.complete=true;
}catch(error){report.failures.push({message:error.stack});process.exitCode=1;try{await browser.inspect(1);}catch{}}
finally{report.events=browser.events;fs.writeFileSync(path.join(directory,'recovery.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report,null,2));
