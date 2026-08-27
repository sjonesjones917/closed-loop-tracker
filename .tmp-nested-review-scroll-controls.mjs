import fs from 'node:fs';
import {createHash} from 'node:crypto';

const hashPath='hash.js';
let hash=fs.readFileSync(hashPath,'utf8');
const oldHash=`    const reviewRect=review?.getBoundingClientRect();
    const reviewDetails=review?.querySelector(':scope>details.record-card');
    const longReview=Boolean(review?.dataset.longReview==='true'&&reviewDetails?.open&&review?.scrollHeight>innerHeight);
    const reviewActive=Boolean(longReview&&reviewRect&&reviewRect.bottom>0&&reviewRect.top<innerHeight);`;
const newHash=`    const reviewRect=review?.getBoundingClientRect();
    const longReview=Boolean(review&&[...review.querySelectorAll('details.record-card[open]')].some(details=>details.getBoundingClientRect().height>innerHeight));
    const reviewActive=Boolean(longReview&&reviewRect&&reviewRect.bottom>0&&reviewRect.top<innerHeight);`;
if(!hash.includes(oldHash))throw new Error('Expected review visibility block was not found.');
hash=hash.replace(oldHash,newHash);
fs.writeFileSync(hashPath,hash);

const browserPath='verify-browser.mjs';
let browser=fs.readFileSync(browserPath,'utf8');
const marker=`const reviewTop=await evalValue(cdp,\`(()=>{const r=document.querySelector('#proposal-heading')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()\`);assert(reviewTop&&reviewTop.bottom>0&&reviewTop.top<reviewTop.height,\`Top of review did not return the review heading to view: \${JSON.stringify(reviewTop)}\`);await click(cdp,'#reject-proposal');`;
const replacement=`const reviewTop=await evalValue(cdp,\`(()=>{const r=document.querySelector('#proposal-heading')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()\`);assert(reviewTop&&reviewTop.bottom>0&&reviewTop.top<reviewTop.height,\`Top of review did not return the review heading to view: \${JSON.stringify(reviewTop)}\`);
 // Nested long review content uses the same pair even when Proposal diff is collapsed.
 await click(cdp,'#proposal-heading>details.record-card>summary');await waitExpr(cdp,\`(()=>{const d=document.querySelector('#proposal-heading>details.record-card'),t=document.querySelector('#review-top-jump'),b=document.querySelector('#review-bottom-jump');return Boolean(d&&!d.open&&t?.hidden&&b?.hidden);})()\`);
 await click(cdp,'#proposal-heading>details.record-card:nth-of-type(2)>summary');await click(cdp,'#proposal-heading>details.record-card:nth-of-type(2) details.record-card>summary');await waitExpr(cdp,\`(()=>{const d=document.querySelector('#proposal-heading>details.record-card:nth-of-type(2) details.record-card'),t=document.querySelector('#review-top-jump'),b=document.querySelector('#review-bottom-jump');return Boolean(d?.open&&d.getBoundingClientRect().height>innerHeight&&t&&!t.hidden&&b&&!b.hidden);})()\`);
 await click(cdp,'#review-bottom-jump');await waitExpr(cdp,\`(()=>{const r=document.querySelector('#proposal-actions')?.getBoundingClientRect();return Boolean(r&&r.top>=-1&&r.bottom<=innerHeight+1);})()\`,8000);
 await click(cdp,'#review-top-jump');await waitExpr(cdp,\`(()=>{const r=document.querySelector('#proposal-heading')?.getBoundingClientRect();return Boolean(r&&r.bottom>0&&r.top<innerHeight);})()\`,8000);
 await click(cdp,'#proposal-heading>details.record-card:nth-of-type(2) details.record-card>summary');await waitExpr(cdp,\`(()=>{const d=document.querySelector('#proposal-heading>details.record-card:nth-of-type(2) details.record-card'),t=document.querySelector('#review-top-jump'),b=document.querySelector('#review-bottom-jump');return Boolean(d&&!d.open&&t?.hidden&&b?.hidden);})()\`);
 await click(cdp,'#proposal-heading>details.record-card:nth-of-type(2) details.record-card>summary');await waitExpr(cdp,\`(()=>{const d=document.querySelector('#proposal-heading>details.record-card:nth-of-type(2) details.record-card'),t=document.querySelector('#review-top-jump'),b=document.querySelector('#review-bottom-jump');return Boolean(d?.open&&t&&!t.hidden&&b&&!b.hidden);})()\`);
 await click(cdp,'#review-bottom-jump');await waitExpr(cdp,\`(()=>{const r=document.querySelector('#proposal-actions')?.getBoundingClientRect();return Boolean(r&&r.top>=-1&&r.bottom<=innerHeight+1);})()\`,8000);await click(cdp,'#reject-proposal');`;
if(!browser.includes(marker))throw new Error('Expected review navigation browser-test marker was not found.');
browser=browser.replace(marker,replacement);
fs.writeFileSync(browserPath,browser);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeToken=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
const indexPath='index.html';
let index=fs.readFileSync(indexPath,'utf8');
const sources=[...index.matchAll(/<script\s+defer\s+src="([^"]+)"\s*><\/script>/g)];
if(sources.length!==8)throw new Error(`Expected 8 runtime scripts, found ${sources.length}.`);
index=index.replace(/(<script\s+defer\s+src="[^"]+\?v=)[^"]+("\s*><\/script>)/g,`$1${runtimeToken}$2`);
fs.writeFileSync(indexPath,index);
