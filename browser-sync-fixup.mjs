import fs from 'node:fs';
const p='verify-browser.mjs';
let s=fs.readFileSync(p,'utf8');
const old="await fill(cdp,'#stage-output',JSON.stringify(longEnvelope));await click(cdp,'#parse-output');await positionNode(cdp,'#proposal-heading','top');";
const replacement="await fill(cdp,'#stage-output',JSON.stringify(longEnvelope));await click(cdp,'#parse-output');await waitExpr(cdp,`Boolean(document.querySelector('#proposal-heading'))`,8000);await positionNode(cdp,'#proposal-heading','top');";
if(!s.includes(old))throw new Error('Browser proposal synchronization anchor not found.');
s=s.replace(old,replacement);
fs.writeFileSync(p,s);
console.log('browser proposal synchronization fixed without changing assertions');
