import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const sourcePath=path.resolve('verify-hardening-browser.mjs');
const patchedPath=path.resolve('.verify-hardening-runner.generated.mjs');
let source=fs.readFileSync(sourcePath,'utf8');
const bootstrapNeedle="await cdp.send('Runtime.enable');await cdp.send('Page.enable');";
if(!source.includes(bootstrapNeedle))throw new Error('Hardening verifier bootstrap changed; runner must be reviewed.');
const bootstrapInjection="await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:\"window.__alerts=[];window.alert=m=>window.__alerts.push(String(m));\"});";
source=source.replace(bootstrapNeedle,bootstrapInjection);

// The historical hardening fixture predates the Stage 02 authority taxonomy and used User Input as a SOURCE_ID record.
// Keep the hardening assertions intact, but execute them with a legitimate independent External Governing Source fixture.
const oldSourceFixture="await value(cdp,`(()=>{for(const e of document.querySelectorAll('[data-record-collection=\"sources\"]')){const f=e.dataset.recordField;e.value=f==='SOURCE_ID'?'COMPLETE-SOURCE':f==='TYPE'?'USER INPUT':f==='ORIGIN'?'USER':f==='REFERENCE'?'INPUT-1':f==='INSPECTION_STATE'?'INSPECTED':f==='CURRENCY_STATE'?'CURRENT':f==='CONTROLLING_STATUS'?'CONTROLLING':'UNKNOWN';}return true})()`);";
if(!source.includes(oldSourceFixture))throw new Error('Hardening source fixture changed; authority-aware runner must be reviewed.');
const externalSourceFixture="await value(cdp,`(()=>{for(const e of document.querySelectorAll('[data-record-collection=\"sources\"]')){const f=e.dataset.recordField;e.value=f==='SOURCE_ID'?'COMPLETE-SOURCE':f==='TYPE'?'OFFICIAL SPECIFICATION':f==='ORIGIN'?'WHATWG':f==='REFERENCE'?'https://html.spec.whatwg.org/':f==='INSPECTION_STATE'?'INSPECTED':f==='CURRENCY_STATE'?'CURRENT':f==='CONTROLLING_STATUS'?'CONTROLLING':f==='SOURCE_CLASS'?'EXTERNAL GOVERNING SOURCE':f==='INDEPENDENT_EXTERNAL_AUTHORITY'?'TRUE':f==='TARGET_PRODUCT_RELATIONSHIP'?'INDEPENDENT EXTERNAL AUTHORITY':f==='TITLE'?'HTML Standard':f==='ISSUING_ORGANIZATION_OR_AUTHOR'?'WHATWG':f==='PUBLICATION_ORIGIN'?'WHATWG Living Standard':f==='RELEVANCE'?'Independent browser-platform authority fixture':f==='APPLICABLE_PORTIONS'?'HTML platform requirements':'UNKNOWN';}return true})()`);";
source=source.replace(oldSourceFixture,externalSourceFixture);

fs.writeFileSync(patchedPath,source);
try{await import(pathToFileURL(patchedPath).href+`?run=${Date.now()}`);}finally{try{fs.unlinkSync(patchedPath);}catch{}}
