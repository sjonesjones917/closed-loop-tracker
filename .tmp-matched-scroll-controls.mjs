import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  const index = typeof from === 'string' ? text.indexOf(from) : text.search(from);
  if (index < 0) throw new Error(`Patch target not found: ${label}`);
  if (typeof from === 'string') {
    if (text.indexOf(from, index + from.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
    return text.slice(0, index) + to + text.slice(index + from.length);
  }
  const matches = [...text.matchAll(new RegExp(from.source, from.flags.includes('g') ? from.flags : `${from.flags}g`))];
  if (matches.length !== 1) throw new Error(`Patch target count for ${label}: ${matches.length}`);
  return text.replace(from, to);
}

let app = fs.readFileSync('app-core.js', 'utf8');
app = replaceOnce(
  app,
  "function jumpToAnchor(selector,message,block='start'){const node=$(selector);if(!node)return;node.scrollIntoView({block,inline:'nearest'});requestAnimationFrame(()=>node.focus({preventScroll:true}));announce(message);}\n",
  '',
  'remove inline scroll helper'
);

const proposalFunction = `function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);if(!p)return '';const rows=safe(p.changes).map(c=>({recordType:c.canonicalRecordType||c.canonicalCollection||'stageData',temporaryKey:c.temporaryResponseKey||'',canonicalId:c.canonicalRecordId||'APPLICATION_ASSIGNED',field:c.canonicalField||c.canonicalRelationship||'',proposedValue:c.normalizedValue,jsonPointer:c.jsonPointer||'',evidence:c.evidenceIds||'',validation:'SATISFIED'})),stale=!proposalVersionCurrent(p),longProposal=rows.length>50;return \`<div class="panel" id="proposal-heading" data-long-review="\${longProposal}" tabindex="-1"><h2 class="section-title">Proposed extracted changes</h2>\${stale?'<div class="notice warn"><strong>Obsolete instruction version.</strong><br>This proposal cannot be accepted. Save and send the current instruction, then parse the replacement response.</div>':'<p class="section-intro">Nothing below is canonical until you accept the complete validated proposal.</p>'}\${details('Proposal diff',rows,true)}<details class="record-card"><summary>Advanced raw proposal<span>Audit</span></summary><div class="record-body">\${details('Complete proposal',p)}</div></details><div class="button-row" id="proposal-actions" tabindex="-1">\${stale?'':'<button class="primary" id="accept-proposal">Accept response</button>'}<button id="reject-proposal">Reject response</button><button id="request-correction">Request correction</button></div><div class="field"><label>Correction or refinement needed</label><textarea id="correction-reason" placeholder="State exactly what is missing, incorrect, or should be made more complete."></textarea></div></div>\`;}`;
app = replaceOnce(
  app,
  /function proposalMarkup\(n\)\{[\s\S]*?\nfunction stageConfirmationMarkup/,
  `${proposalFunction}\nfunction stageConfirmationMarkup`,
  'replace inline proposal navigation with long-review marker'
);

app = replaceOnce(
  app,
  '<button id="jump-prompt-top" aria-controls="prompt-heading" hidden>Go to top of prompt ↑</button>',
  '',
  'remove inline prompt-top button'
);

app = replaceOnce(
  app,
  /if\(\$\('#toggle-prompt'\)\)\$\('#toggle-prompt'\)\.onclick=\(\)=>\{[\s\S]*?\};if\(\$\('#copy-prompt'\)\)/,
  "if($('#toggle-prompt'))$('#toggle-prompt').onclick=()=>{const node=$('#generated-prompt'),button=$('#toggle-prompt'),wasExpanded=Boolean(node?.classList.contains('expanded')),expanded=node?.classList.toggle('expanded');if(button){button.textContent=expanded?'Collapse preview':'Expand preview';button.setAttribute('aria-expanded',String(Boolean(expanded)));}if(expanded)node?.focus();else if(wasExpanded)requestAnimationFrame(()=>requestAnimationFrame(()=>node?.parentElement?.querySelector('.prompt-toolbar')?.scrollIntoView({block:'end',inline:'nearest'})));};if($('#copy-prompt'))",
  'restore prompt toggle without inline navigation control'
);

app = replaceOnce(
  app,
  "if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;if($('#jump-prompt-top'))$('#jump-prompt-top').onclick=()=>jumpToAnchor('#prompt-heading','top of prompt');if($('#jump-proposal-actions'))$('#jump-proposal-actions').onclick=()=>jumpToAnchor('#proposal-actions','proposal review actions','center');if($('#jump-review-top'))$('#jump-review-top').onclick=()=>jumpToAnchor('#proposal-heading','top of proposal review');if($('#accept-proposal'))",
  "if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;if($('#accept-proposal'))",
  'remove inline navigation handlers'
);

app = replaceOnce(
  app,
  'updateStageHelp();wire();}',
  "updateStageHelp();wire();document.dispatchEvent(new Event('closed-loop-rendered'));}",
  'notify matched floating controls after render'
);

for (const forbidden of ['jump-prompt-top','jump-proposal-actions','jump-review-top','jumpToAnchor']) {
  if (app.includes(forbidden)) throw new Error(`Obsolete inline navigation remains: ${forbidden}`);
}
fs.writeFileSync('app-core.js', app);

let hash = fs.readFileSync('hash.js', 'utf8');
const insertionPoint = "  document.addEventListener('change',()=>queueMicrotask(syncPromptBottomJump));\n";
const matchedControls = `

  function matchedScrollJump(id,text,ariaLabel,bottomOffset,handler){
    let button=document.getElementById(id);
    if(button)return button;
    button=document.createElement('button');
    button.id=id;
    button.type='button';
    button.textContent=text;
    button.setAttribute('aria-label',ariaLabel);
    button.style.cssText=promptBottomJump().style.cssText;
    button.style.bottom=\`calc(\${bottomOffset}px + env(safe-area-inset-bottom))\`;
    button.hidden=true;
    button.addEventListener('click',handler);
    document.body.append(button);
    return button;
  }
  function scrollToMatchedTarget(target,block){
    if(!target)return;
    target.scrollIntoView({behavior:'smooth',block,inline:'nearest'});
    requestAnimationFrame(()=>target.focus?.({preventScroll:true}));
  }
  const promptTopJump=matchedScrollJump('prompt-top-jump','↑ Top of message','Scroll to top of expanded message',70,()=>scrollToMatchedTarget(document.getElementById('prompt-heading'),'start'));
  const reviewTopJump=matchedScrollJump('review-top-jump','↑ Top of review','Scroll to top of proposal review',70,()=>scrollToMatchedTarget(document.getElementById('proposal-heading'),'start'));
  const reviewBottomJump=matchedScrollJump('review-bottom-jump','↓ Bottom of review','Scroll to bottom of proposal review',18,()=>scrollToMatchedTarget(document.getElementById('proposal-actions'),'end'));
  function syncMatchedScrollJumps(){
    const prompt=document.getElementById('generated-prompt');
    const review=document.getElementById('proposal-heading');
    const reviewRect=review?.getBoundingClientRect();
    const longReview=review?.dataset.longReview==='true';
    const reviewActive=Boolean(longReview&&reviewRect&&reviewRect.bottom>0&&reviewRect.top<innerHeight);
    const reviewPast=Boolean(longReview&&reviewRect&&reviewRect.bottom<=0);
    const promptActive=Boolean(prompt?.classList.contains('expanded')&&!reviewActive&&!reviewPast);
    promptBottomJump().hidden=!promptActive;
    promptTopJump.hidden=!promptActive;
    reviewTopJump.hidden=!reviewActive;
    reviewBottomJump.hidden=!reviewActive;
  }
  document.addEventListener('click',()=>queueMicrotask(syncMatchedScrollJumps));
  document.addEventListener('change',()=>queueMicrotask(syncMatchedScrollJumps));
  document.addEventListener('closed-loop-rendered',()=>queueMicrotask(syncMatchedScrollJumps));
  addEventListener('scroll',syncMatchedScrollJumps,{passive:true});
  addEventListener('resize',syncMatchedScrollJumps,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>queueMicrotask(syncMatchedScrollJumps),{once:true});
  else queueMicrotask(syncMatchedScrollJumps);
`;
hash = replaceOnce(hash, insertionPoint, insertionPoint + matchedControls, 'add three buttons matching untouched Bottom of message control');
if ((hash.match(/Bottom of message/g)||[]).length !== 1) throw new Error('Existing Bottom of message control was changed or duplicated.');
for (const required of ['prompt-top-jump','review-top-jump','review-bottom-jump']) if (!hash.includes(required)) throw new Error(`Missing matched floating control: ${required}`);
fs.writeFileSync('hash.js', hash);

let browser = fs.readFileSync('verify-browser.mjs', 'utf8');
const promptStart = "await click(cdp,'#toggle-prompt');assert(await evalValue(cdp,`(()=>{const n=document.querySelector('#generated-prompt'),b=document.querySelector('#toggle-prompt');return Boolean(n?.classList.contains('expanded')&&b?.getAttribute('aria-expanded')==='true'&&n.scrollHeight<=n.clientHeight+1);})()`),'Prompt preview did not expand to reveal the full instruction accessibly.');";
const promptEnd = "const collapsedAnchor=await evalValue(cdp,`(()=>{const t=document.querySelector('#generated-prompt')?.parentElement?.querySelector('.prompt-toolbar');if(!t)return null;const r=t.getBoundingClientRect();return {toolbarBottom:r.bottom,viewportBottom:innerHeight,pageBottom:scrollY+innerHeight,documentBottom:document.documentElement.scrollHeight};})()`);";
const promptStartIndex = browser.indexOf(promptStart);
const promptEndIndex = browser.indexOf(promptEnd, promptStartIndex);
if (promptStartIndex < 0 || promptEndIndex < 0) throw new Error('Prompt navigation regression block not found.');
const promptReplacement = `${promptStart}await waitExpr(cdp,\`(()=>{const t=document.querySelector('#prompt-top-jump'),b=document.querySelector('#prompt-bottom-jump');return Boolean(t&&!t.hidden&&b&&!b.hidden);})()\`);assert(!(await evalValue(cdp,\`Boolean(document.querySelector('#jump-prompt-top'))\`)),'Obsolete inline prompt scroll button remains.');const promptPair=await evalValue(cdp,\`(()=>{const top=document.querySelector('#prompt-top-jump'),bottom=document.querySelector('#prompt-bottom-jump'),a=top?.getBoundingClientRect(),b=bottom?.getBoundingClientRect(),sa=top&&getComputedStyle(top),sb=bottom&&getComputedStyle(bottom);return a&&b?{topBottom:a.bottom,bottomTop:b.top,rightA:a.right,rightB:b.right,backgroundA:sa.backgroundColor,backgroundB:sb.backgroundColor,radiusA:sa.borderRadius,radiusB:sb.borderRadius,colorA:sa.color,colorB:sb.color,fontA:sa.font,fontB:sb.font,shadowA:sa.boxShadow,shadowB:sb.boxShadow,minHeightA:sa.minHeight,minHeightB:sb.minHeight}:null;})()\`);assert(promptPair&&promptPair.topBottom<promptPair.bottomTop&&Math.abs(promptPair.rightA-promptPair.rightB)<=1&&promptPair.backgroundA===promptPair.backgroundB&&promptPair.radiusA===promptPair.radiusB&&promptPair.colorA===promptPair.colorB&&promptPair.fontA===promptPair.fontB&&promptPair.shadowA===promptPair.shadowB&&promptPair.minHeightA===promptPair.minHeightB,\`Prompt scroll controls do not match/stack like Bottom of message: \${JSON.stringify(promptPair)}\`);await click(cdp,'#prompt-bottom-jump');await sleep(260);const promptBottom=await evalValue(cdp,\`(()=>{const r=document.querySelector('#generated-prompt')?.parentElement?.querySelector('.prompt-toolbar')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()\`);assert(promptBottom&&promptBottom.bottom>0&&promptBottom.top<promptBottom.height,\`Bottom of message did not reveal the prompt toolbar: \${JSON.stringify(promptBottom)}\`);await click(cdp,'#prompt-top-jump');await sleep(260);const promptTop=await evalValue(cdp,\`(()=>{const r=document.querySelector('#prompt-heading')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()\`);assert(promptTop&&promptTop.bottom>0&&promptTop.top<promptTop.height,\`Top of message did not return the prompt heading to view: \${JSON.stringify(promptTop)}\`);await evalValue(cdp,\`(()=>{document.querySelector('#toggle-prompt')?.scrollIntoView({block:'end'});return true})()\`);await sleep(120);await click(cdp,'#toggle-prompt');assert(await evalValue(cdp,\`(()=>{const n=document.querySelector('#generated-prompt');return Boolean(n&&!n.classList.contains('expanded')&&n.scrollHeight>n.clientHeight+1);})()\`),'Prompt preview did not return to the bounded compact state.');assert(await evalValue(cdp,\`(()=>{const t=document.querySelector('#prompt-top-jump'),b=document.querySelector('#prompt-bottom-jump');return Boolean(t?.hidden&&b?.hidden);})()\`),'Prompt scroll controls remained visible after collapsing the preview.');`;
browser = browser.slice(0, promptStartIndex) + promptReplacement + browser.slice(promptEndIndex);

const reviewStart = "await fill(cdp,'#stage-output',JSON.stringify(longEnvelope));await click(cdp,'#parse-output');";
const reviewEnd = "await click(cdp,'#reject-proposal');";
const reviewStartIndex = browser.indexOf(reviewStart);
const reviewEndIndex = browser.indexOf(reviewEnd, reviewStartIndex);
if (reviewStartIndex < 0 || reviewEndIndex < 0) throw new Error('Long-review navigation regression block not found.');
const reviewReplacement = `${reviewStart}await waitExpr(cdp,\`(()=>{const t=document.querySelector('#review-top-jump'),b=document.querySelector('#review-bottom-jump');return Boolean(t&&!t.hidden&&b&&!b.hidden);})()\`);assert(await evalValue(cdp,\`document.querySelector('#proposal-heading>details.record-card')?.open===true\`),'Long proposal diff must remain expanded.');assert(await evalValue(cdp,\`!document.querySelector('#jump-proposal-actions')&&!document.querySelector('#jump-review-top')\`),'Obsolete inline review scroll buttons remain.');const reviewPair=await evalValue(cdp,\`(()=>{const top=document.querySelector('#review-top-jump'),bottom=document.querySelector('#review-bottom-jump'),reference=document.querySelector('#prompt-bottom-jump'),a=top?.getBoundingClientRect(),b=bottom?.getBoundingClientRect(),sa=top&&getComputedStyle(top),sb=bottom&&getComputedStyle(bottom),sr=reference&&getComputedStyle(reference);return a&&b&&sr?{topBottom:a.bottom,bottomTop:b.top,rightA:a.right,rightB:b.right,backgroundA:sa.backgroundColor,backgroundB:sb.backgroundColor,backgroundR:sr.backgroundColor,radiusA:sa.borderRadius,radiusB:sb.borderRadius,radiusR:sr.borderRadius,colorA:sa.color,colorB:sb.color,colorR:sr.color,fontA:sa.font,fontB:sb.font,fontR:sr.font,shadowA:sa.boxShadow,shadowB:sb.boxShadow,shadowR:sr.boxShadow,minHeightA:sa.minHeight,minHeightB:sb.minHeight,minHeightR:sr.minHeight}:null;})()\`);assert(reviewPair&&reviewPair.topBottom<reviewPair.bottomTop&&Math.abs(reviewPair.rightA-reviewPair.rightB)<=1&&reviewPair.backgroundA===reviewPair.backgroundB&&reviewPair.backgroundA===reviewPair.backgroundR&&reviewPair.radiusA===reviewPair.radiusB&&reviewPair.radiusA===reviewPair.radiusR&&reviewPair.colorA===reviewPair.colorB&&reviewPair.colorA===reviewPair.colorR&&reviewPair.fontA===reviewPair.fontB&&reviewPair.fontA===reviewPair.fontR&&reviewPair.shadowA===reviewPair.shadowB&&reviewPair.shadowA===reviewPair.shadowR&&reviewPair.minHeightA===reviewPair.minHeightB&&reviewPair.minHeightA===reviewPair.minHeightR,\`Review scroll controls do not match/stack like Bottom of message: \${JSON.stringify(reviewPair)}\`);await click(cdp,'#review-bottom-jump');await sleep(260);const proposalActions=await evalValue(cdp,\`(()=>{const r=document.querySelector('#proposal-actions')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()\`);assert(proposalActions&&proposalActions.top>=-1&&proposalActions.bottom<=proposalActions.height+1,\`Bottom of review did not bring review actions into view: \${JSON.stringify(proposalActions)}\`);await click(cdp,'#review-top-jump');await sleep(260);const reviewTop=await evalValue(cdp,\`(()=>{const r=document.querySelector('#proposal-heading')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()\`);assert(reviewTop&&reviewTop.bottom>0&&reviewTop.top<reviewTop.height,\`Top of review did not return the review heading to view: \${JSON.stringify(reviewTop)}\`);`;
browser = browser.slice(0, reviewStartIndex) + reviewReplacement + browser.slice(reviewEndIndex);

fs.writeFileSync('verify-browser.mjs', browser);

let index = fs.readFileSync('index.html', 'utf8');
const token = 'runtime-4f7a1c9e2b6d8035';
index = index.replace(/runtime-[a-f0-9]{16}/g, token);
const tokens = [...index.matchAll(/<script defer src="[^"]+\?v=(runtime-[a-f0-9]{16})"><\/script>/g)].map(match => match[1]);
if (tokens.length !== 8 || new Set(tokens).size !== 1 || tokens[0] !== token) throw new Error('Runtime build token update failed.');
fs.writeFileSync('index.html', index);

console.log('Matched floating prompt/review scroll controls patch applied.');
