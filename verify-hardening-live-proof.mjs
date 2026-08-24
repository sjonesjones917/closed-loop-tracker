import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const sourcePath=path.resolve('verify-hardening-browser.mjs');
const patchedPath=path.resolve('.verify-hardening-live-proof.generated.mjs');
const source=fs.readFileSync(sourcePath,'utf8');
const needle="await cdp.send('Runtime.enable');await cdp.send('Page.enable');";
if(!source.includes(needle))throw new Error('Hardening verifier bootstrap changed; live-proof wrapper must be reviewed.');
const injection="await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:\"window.__alerts=[];window.alert=m=>window.__alerts.push(String(m));\"});";
fs.writeFileSync(patchedPath,source.replace(needle,injection));
try{await import(pathToFileURL(patchedPath).href+`?proof=${Date.now()}`);}finally{try{fs.unlinkSync(patchedPath);}catch{}}
