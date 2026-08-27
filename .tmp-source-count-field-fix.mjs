import fs from 'node:fs';
import {createHash} from 'node:crypto';

const appPath='app-core.js';
let app=fs.readFileSync(appPath,'utf8');

const oldField="['DESIRED_SOURCE_COUNT','Desired / suggested source count','number']";
const newField="['DESIRED_SOURCE_COUNT','Desired / suggested source count (optional)','number']";
if(!app.includes(oldField))throw new Error('Expected source-count field declaration was not found.');
app=app.replace(oldField,newField);

const oldMarkup=`${'${'}jobFields.map(([k,l,t])=>\`<div class="field${'${'}t==='textarea'?' full':''}"><label>${'${'}l}</label>${'${'}t==='textarea'?\`<textarea data-job="${'${'}k}">${'${'}esc(current.job[k]||'')}</textarea>\`:\`<input data-job="${'${'}k}" type="${'${'}t==='number'?'number':'text'}"${'${'}t==='number'?' min="0" step="1"':''} value="${'${'}esc(current.job[k]??'')}">\`}</div>\`).join('')}`;
const newMarkup=`${'${'}jobFields.map(([k,l,t])=>\`<div class="field${'${'}t==='textarea'?' full':''}"><label>${'${'}l}</label>${'${'}t==='textarea'?\`<textarea data-job="${'${'}k}">${'${'}esc(current.job[k]||'')}</textarea>\`:\`<input data-job="${'${'}k}" type="${'${'}t==='number'?'number':'text'}"${'${'}t==='number'?' min="0" step="1" inputmode="numeric" placeholder="Leave blank if unknown"':''} value="${'${'}esc(current.job[k]??'')}">\`}${'${'}t==='number'?'<span class="help">Whole number only. Leave blank if unknown or no preference.</span>':''}</div>\`).join('')}`;
if(!app.includes(oldMarkup))throw new Error('Expected project-field renderer was not found.');
app=app.replace(oldMarkup,newMarkup);

const oldSave=`async function saveJob(){const next=clone(current),changed=[];`;
const newSave=`async function saveJob(){const sourceCountInput=document.querySelector('[data-job="DESIRED_SOURCE_COUNT"]');if(sourceCountInput){sourceCountInput.setCustomValidity('');const raw=sourceCountInput.value.trim(),numeric=Number(raw);if(raw!==''&&(!/^\\d+$/.test(raw)||!Number.isSafeInteger(numeric))){sourceCountInput.setCustomValidity('Enter a whole number of 0 or more, or leave this field blank.');sourceCountInput.focus();sourceCountInput.reportValidity();announce('source count must be a whole number or blank');return;}}const next=clone(current),changed=[];`;
if(!app.includes(oldSave))throw new Error('Expected saveJob entry point was not found.');
app=app.replace(oldSave,newSave);
fs.writeFileSync(appPath,app);

const browserPath='verify-browser.mjs';
let browser=fs.readFileSync(browserPath,'utf8');
const oldBrowser=` await click(cdp,'[data-view="Project"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),\`Project intake artifact-generation guidance missing ${'${'}token}.\`);`;
const newBrowser=` await click(cdp,'[data-view="Project"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])assert(text.includes(token),\`Project intake artifact-generation guidance missing ${'${'}token}.\`);
 // Optional source count is visibly and behaviorally constrained to a whole number or blank.
 const sourceCountUi=await evalValue(cdp,\`(()=>{const input=document.querySelector('[data-job="DESIRED_SOURCE_COUNT"]'),field=input?.closest('.field'),label=field?.querySelector('label'),help=field?.querySelector('.help');return input?{label:label?.textContent||'',help:help?.textContent||'',type:input.type,min:input.min,step:input.step,inputMode:input.inputMode,placeholder:input.placeholder}:null;})()\`);assert(sourceCountUi&&sourceCountUi.label.includes('(optional)')&&sourceCountUi.help.includes('Whole number only')&&sourceCountUi.help.includes('Leave blank')&&sourceCountUi.type==='number'&&sourceCountUi.min==='0'&&sourceCountUi.step==='1'&&sourceCountUi.inputMode==='numeric'&&sourceCountUi.placeholder==='Leave blank if unknown',\`Source-count guidance/attributes are incomplete: ${'${'}JSON.stringify(sourceCountUi)}\`);
 const sourceCountBefore=(await activeProject(cdp)).job.DESIRED_SOURCE_COUNT;await fill(cdp,'[data-job="DESIRED_SOURCE_COUNT"]','2.5');await click(cdp,'#save-job');const invalidSourceCount=await evalValue(cdp,\`(()=>{const input=document.querySelector('[data-job="DESIRED_SOURCE_COUNT"]');return input?{valid:input.checkValidity(),message:input.validationMessage,focused:document.activeElement===input}:null;})()\`);assert(invalidSourceCount&&!invalidSourceCount.valid&&invalidSourceCount.focused&&invalidSourceCount.message.includes('whole number'),\`Decimal source count did not fail clearly: ${'${'}JSON.stringify(invalidSourceCount)}\`);assert((await activeProject(cdp)).job.DESIRED_SOURCE_COUNT===sourceCountBefore,'Invalid decimal source count was persisted.');
 await fill(cdp,'[data-job="DESIRED_SOURCE_COUNT"]','7');await click(cdp,'#save-job');await waitExpr(cdp,\`(async()=>{const all=await globalThis.closedLoopProjectStore.readAll(),id=document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0],p=all.find(x=>x.job?.JOB_ID===id);return p?.job?.DESIRED_SOURCE_COUNT===7;})()\`);await fill(cdp,'[data-job="DESIRED_SOURCE_COUNT"]','');await click(cdp,'#save-job');await waitExpr(cdp,\`(async()=>{const all=await globalThis.closedLoopProjectStore.readAll(),id=document.querySelector('#current-project-summary')?.textContent?.split(' · ')[0],p=all.find(x=>x.job?.JOB_ID===id);return p?.job?.DESIRED_SOURCE_COUNT===null;})()\`);`;
if(!browser.includes(oldBrowser))throw new Error('Expected Project-view browser-test marker was not found.');
browser=browser.replace(oldBrowser,newBrowser);
browser=browser.replace('artifactGenerationGuidance:true,malformedImportNonDestructive:true','artifactGenerationGuidance:true,sourceCountInputGuidance:true,sourceCountIntegerValidation:true,malformedImportNonDestructive:true');
fs.writeFileSync(browserPath,browser);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
const indexPath='index.html';
let index=fs.readFileSync(indexPath,'utf8');
const tokens=[...index.matchAll(/<script\s+defer\s+src="[^"]+\?v=([^"]+)"/g)].map(match=>match[1]);
if(tokens.length!==runtimeFiles.length||new Set(tokens).size!==1)throw new Error(`Expected one shared token across ${runtimeFiles.length} runtime scripts; found ${JSON.stringify(tokens)}.`);
index=index.replaceAll(tokens[0],runtimeBuildIdentity);
fs.writeFileSync(indexPath,index);
