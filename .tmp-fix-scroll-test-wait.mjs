import fs from 'node:fs';

let text=fs.readFileSync('verify-browser.mjs','utf8');
const replacements=[
  ["await click(cdp,'#prompt-bottom-jump');await sleep(260);const promptBottom=", "await click(cdp,'#prompt-bottom-jump');await waitExpr(cdp,`(()=>{const r=document.querySelector('#generated-prompt')?.parentElement?.querySelector('.prompt-toolbar')?.getBoundingClientRect();return Boolean(r&&r.bottom>0&&r.top<innerHeight);})()`,6000);const promptBottom="],
  ["await click(cdp,'#prompt-top-jump');await sleep(260);const promptTop=", "await click(cdp,'#prompt-top-jump');await waitExpr(cdp,`(()=>{const r=document.querySelector('#prompt-heading')?.getBoundingClientRect();return Boolean(r&&r.bottom>0&&r.top<innerHeight);})()`,6000);const promptTop="],
  ["await click(cdp,'#review-bottom-jump');await sleep(260);const proposalActions=", "await click(cdp,'#review-bottom-jump');await waitExpr(cdp,`(()=>{const r=document.querySelector('#proposal-actions')?.getBoundingClientRect();return Boolean(r&&r.top>=-1&&r.bottom<=innerHeight+1);})()`,8000);const proposalActions="],
  ["await click(cdp,'#review-top-jump');await sleep(260);const reviewTop=", "await click(cdp,'#review-top-jump');await waitExpr(cdp,`(()=>{const r=document.querySelector('#proposal-heading')?.getBoundingClientRect();return Boolean(r&&r.bottom>0&&r.top<innerHeight);})()`,8000);const reviewTop="]
];
for(const [from,to] of replacements){
  const count=text.split(from).length-1;
  if(count!==1)throw new Error(`Expected one smooth-scroll test target, found ${count}: ${from}`);
  text=text.replace(from,to);
}
fs.writeFileSync('verify-browser.mjs',text);
