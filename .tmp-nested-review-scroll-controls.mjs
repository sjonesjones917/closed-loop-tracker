import fs from 'node:fs';

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

const indexPath='index.html';
let index=fs.readFileSync(indexPath,'utf8');
const oldToken='runtime-647463b908c4b9b5';
const newToken='runtime-2b7d1e79d8f4c6a3';
const count=index.split(oldToken).length-1;
if(count!==8)throw new Error(`Expected 8 runtime tokens, found ${count}.`);
index=index.replaceAll(oldToken,newToken);
fs.writeFileSync(indexPath,index);
