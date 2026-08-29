import fs from 'node:fs';

const appPath='app-core.js';
let app=fs.readFileSync(appPath,'utf8');

const marker="function stagePurposeMarkup(n){";
if(!app.includes(marker))throw new Error('stagePurposeMarkup marker missing');

const helper=`function operatorStageTitle(n,title){return Number(n)===16?'CORRECT THE ROOT CAUSE':title;}\nfunction stage16CorrectionMarkup(n){if(Number(n)!==16)return '';const rcas=engine.recordsForCurrentScope(current,'rootCauses'),changes=engine.recordsForCurrentScope(current,'changes'),defects=engine.recordsForCurrentScope(current,'defects');const rows=rcas.map(rca=>{const rcaId=engine.recordId(rca,'rootCauses'),defectId=String(engine.recordValue(rca,'DEFECT_ID')||rca.relationships?.DEFECT_ID||''),layer=String(engine.recordValue(rca,'EARLIEST_DEFECTIVE_LAYER')||'Unknown'),cause=String(engine.recordValue(rca,'ROOT_CAUSE')||'Root cause not yet established'),change=changes.find(item=>String(engine.recordValue(item,'TRIGGERING_DEFECT_IDS')||'').includes(defectId)),executionOnly=/execution/i.test(layer),next=change?'Correction recorded. The application will preserve prior versions and determine downstream invalidation.':executionOnly?'No specification edit should be made solely for this execution-only failure. Preserve it as a regression and repeat the required execution.':'Use the current correction instruction to prepare the evidence-based change. Approve or answer only if human authority is genuinely required.';return {defect:defectId||'UNLINKED',rootCause:cause,earliestCause:layer,correctionState:change?'RECORDED':'REQUIRED',whatYouNeedToDo:next};});return \\`<div class="panel stage16-correction"><h2 class="section-title">Correct the root cause</h2><p class="section-intro">The application has already traced each confirmed defect backward. Fix the earliest thing that became wrong—not a downstream symptom. Existing versions remain preserved, and the application determines what becomes stale and what must be repeated.</p>\${rows.length?details('What needs to change',rows,true):'<div class="notice warn">No current root-cause analysis is available yet. Complete root-cause analysis before making a correction.</div>'}<details class="record-card"><summary>How correction decisions work<span>Advanced</span></summary><div class="record-body"><p class="section-intro">Execution-only failures do not justify rewriting a correct requirement, test, or instruction. Evidence-based corrections are prepared at the earliest defective layer. Human input is requested only for facts or decisions that belong to human authority. External-tool corrections remain external actions with exact handoff instructions.</p></div></details></div>\`; }\n`;
app=app.replace(marker,helper+marker);

const titleExpr='${esc(d.title)}';
if(!app.includes(titleExpr))throw new Error('stage hero title expression missing');
app=app.replace(titleExpr,'${esc(operatorStageTitle(n,d.title))}');

const insertion='${stagePurposeMarkup(n)}';
if(!app.includes(insertion))throw new Error('stage purpose insertion missing');
app=app.replace(insertion,'${stagePurposeMarkup(n)}${stage16CorrectionMarkup(n)}');
fs.writeFileSync(appPath,app);

const verifyPath='verify-browser.mjs';
let verify=fs.readFileSync(verifyPath,'utf8');
const anchor="console.log('browser:ok');";
if(!verify.includes(anchor))throw new Error('verify-browser completion marker missing');
verify=verify.replace(anchor,`await page.evaluate(()=>{const select=document.querySelector('#stage-picker');if(!select)throw new Error('stage picker missing');select.value='16';select.dispatchEvent(new Event('change',{bubbles:true}));});\nawait page.waitForFunction(()=>document.body.innerText.includes('CORRECT THE ROOT CAUSE'));\nconst stage16Text=await page.evaluate(()=>document.body.innerText);\nif(!stage16Text.includes('Fix the earliest thing that became wrong'))throw new Error('Stage 16 does not explain root-cause correction in operator language');\nif(!stage16Text.includes('Human input is requested only'))throw new Error('Stage 16 does not bound human responsibility');\n${anchor}`);
fs.writeFileSync(verifyPath,verify);
