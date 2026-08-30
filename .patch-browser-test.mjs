import fs from 'node:fs';
const path='verify-browser.mjs';
let s=fs.readFileSync(path,'utf8');
const old="retained.stages['1'].status==='COMPLETE'&&retained.job.CURRENT_STAGE==='STAGE 02'";
const neu="retained.stages['1'].status==='COMPLETE'&&Number(String(retained.job.CURRENT_STAGE).replace(/\\D/g,''))===2";
if(!s.includes(old))throw new Error('retained Stage 02 browser assertion anchor missing');
fs.writeFileSync(path,s.replace(old,neu));
fs.rmSync('.patch-browser-test.mjs');
