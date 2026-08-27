from pathlib import Path
import hashlib
import re

app = Path('app-core.js')
text = app.read_text()

announce_anchor = "function announce(message){const node=$('#app-live-status');if(node)node.textContent=String(message||'');}\nconst recordValue"
announce_replacement = "function announce(message){const node=$('#app-live-status');if(node)node.textContent=String(message||'');}\nfunction jumpToAnchor(selector,message,block='start'){const node=$(selector);if(!node)return;node.scrollIntoView({block,inline:'nearest'});requestAnimationFrame(()=>node.focus({preventScroll:true}));announce(message);}\nconst recordValue"
if text.count(announce_anchor) != 1:
    raise SystemExit('announce anchor not found exactly once')
text = text.replace(announce_anchor, announce_replacement, 1)

proposal_pattern = r"function proposalMarkup\(n\)\{.*?\}\nfunction stageConfirmationMarkup"
proposal_replacement = '''function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);if(!p)return '';const rows=safe(p.changes).map(c=>({recordType:c.canonicalRecordType||c.canonicalCollection||'stageData',temporaryKey:c.temporaryResponseKey||'',canonicalId:c.canonicalRecordId||'APPLICATION_ASSIGNED',field:c.canonicalField||c.canonicalRelationship||'',proposedValue:c.normalizedValue,jsonPointer:c.jsonPointer||'',evidence:c.evidenceIds||'',validation:'SATISFIED'})),stale=!proposalVersionCurrent(p),longProposal=rows.length>50,jump=longProposal?'<div class="prompt-toolbar"><div class="button-row"><button id="jump-proposal-actions" aria-controls="proposal-actions">Go to review actions ↓</button></div></div>':'',back=longProposal?'<div class="prompt-toolbar"><div class="button-row"><button id="jump-review-top" aria-controls="proposal-heading">Go to top of review ↑</button></div></div>':'';return `<div class="panel" id="proposal-heading" tabindex="-1"><h2 class="section-title">Proposed extracted changes</h2>${stale?'<div class="notice warn"><strong>Obsolete instruction version.</strong><br>This proposal cannot be accepted. Save and send the current instruction, then parse the replacement response.</div>':'<p class="section-intro">Nothing below is canonical until you accept the complete validated proposal.</p>'}${jump}${details('Proposal diff',rows,true)}<details class="record-card"><summary>Advanced raw proposal<span>Audit</span></summary><div class="record-body">${details('Complete proposal',p)}</div></details><div class="button-row" id="proposal-actions" tabindex="-1">${stale?'':'<button class="primary" id="accept-proposal">Accept response</button>'}<button id="reject-proposal">Reject response</button><button id="request-correction">Request correction</button></div><div class="field"><label>Correction or refinement needed</label><textarea id="correction-reason" placeholder="State exactly what is missing, incorrect, or should be made more complete."></textarea></div>${back}</div>`;}
function stageConfirmationMarkup'''
text, count = re.subn(proposal_pattern, proposal_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'proposalMarkup replacement count was {count}')

prompt_panel_anchor = '<div class="panel"><h2 class="section-title">Generated instruction</h2>'
prompt_panel_replacement = '<div class="panel" id="prompt-heading" tabindex="-1"><h2 class="section-title">Generated instruction</h2>'
if text.count(prompt_panel_anchor) != 1:
    raise SystemExit('generated instruction panel anchor not found exactly once')
text = text.replace(prompt_panel_anchor, prompt_panel_replacement, 1)

prompt_button_anchor = '<button id="toggle-prompt" aria-expanded="false">Expand preview</button><button id="save-prompt"'
prompt_button_replacement = '<button id="toggle-prompt" aria-expanded="false">Expand preview</button><button id="jump-prompt-top" aria-controls="prompt-heading" hidden>Go to top of prompt ↑</button><button id="save-prompt"'
if text.count(prompt_button_anchor) != 1:
    raise SystemExit('prompt button anchor not found exactly once')
text = text.replace(prompt_button_anchor, prompt_button_replacement, 1)

toggle_pattern = r"if\(\$\('#toggle-prompt'\)\)\$\('#toggle-prompt'\)\.onclick=\(\)=>\{.*?\};if\(\$\('#copy-prompt'\)\)"
toggle_replacement = "if($('#toggle-prompt'))$('#toggle-prompt').onclick=()=>{const node=$('#generated-prompt'),button=$('#toggle-prompt'),topButton=$('#jump-prompt-top'),wasExpanded=Boolean(node?.classList.contains('expanded')),expanded=node?.classList.toggle('expanded');if(button){button.textContent=expanded?'Collapse preview':'Expand preview';button.setAttribute('aria-expanded',String(Boolean(expanded)));}if(topButton)topButton.hidden=!expanded;if(expanded)node?.focus();else if(wasExpanded)requestAnimationFrame(()=>requestAnimationFrame(()=>node?.parentElement?.querySelector('.prompt-toolbar')?.scrollIntoView({block:'end',inline:'nearest'})));};if($('#copy-prompt'))"
text, count = re.subn(toggle_pattern, toggle_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'prompt toggle replacement count was {count}')

wire_pattern = r"if\(\$\('#parse-output'\)\)\$\('#parse-output'\)\.onclick=prepareStageResponse;if\(\$\('#jump-proposal-actions'\)\).*?;if\(\$\('#accept-proposal'\)\)"
wire_replacement = "if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;if($('#jump-prompt-top'))$('#jump-prompt-top').onclick=()=>jumpToAnchor('#prompt-heading','top of prompt');if($('#jump-proposal-actions'))$('#jump-proposal-actions').onclick=()=>jumpToAnchor('#proposal-actions','proposal review actions','center');if($('#jump-review-top'))$('#jump-review-top').onclick=()=>jumpToAnchor('#proposal-heading','top of proposal review');if($('#accept-proposal'))"
text, count = re.subn(wire_pattern, wire_replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'navigation wire replacement count was {count}')

app.write_text(text)

browser = Path('verify-browser.mjs')
test = browser.read_text()

expand_assert = "assert(await evalValue(cdp,`(()=>{const n=document.querySelector('#generated-prompt'),b=document.querySelector('#toggle-prompt');return Boolean(n?.classList.contains('expanded')&&b?.getAttribute('aria-expanded')==='true'&&n.scrollHeight<=n.clientHeight+1);})()`),'Prompt preview did not expand to reveal the full instruction accessibly.');"
expand_insert = expand_assert + "assert(await evalValue(cdp,`(()=>{const b=document.querySelector('#jump-prompt-top');return Boolean(b&&!b.hidden&&b.closest('.prompt-toolbar')&&b.parentElement?.classList.contains('button-row'));})()`),'Expanded prompt did not expose the shared Go to top control.');await evalValue(cdp,`(()=>{document.querySelector('#jump-prompt-top')?.scrollIntoView({block:'center'});return true})()`);await sleep(120);await click(cdp,'#jump-prompt-top');await sleep(120);const promptTop=await evalValue(cdp,`(()=>{const r=document.querySelector('#prompt-heading')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()`);assert(promptTop&&promptTop.bottom>0&&promptTop.top<promptTop.height,`Go to top of prompt did not return the prompt heading to view: ${JSON.stringify(promptTop)}`);"
if test.count(expand_assert) != 1:
    raise SystemExit('prompt expansion assertion anchor not found exactly once')
test = test.replace(expand_assert, expand_insert, 1)

collapse_assert = "assert(await evalValue(cdp,`(()=>{const n=document.querySelector('#generated-prompt');return Boolean(n&&!n.classList.contains('expanded')&&n.scrollHeight>n.clientHeight+1);})()`),'Prompt preview did not return to the bounded compact state.');"
collapse_insert = collapse_assert + "assert(await evalValue(cdp,`document.querySelector('#jump-prompt-top')?.hidden===true`),'Prompt top control remained visible after collapsing the preview.');"
if test.count(collapse_assert) != 1:
    raise SystemExit('prompt collapse assertion anchor not found exactly once')
test = test.replace(collapse_assert, collapse_insert, 1)

long_pattern = r"await fill\(cdp,'#stage-output',JSON\.stringify\(longEnvelope\)\);await click\(cdp,'#parse-output'\);await waitExpr\(cdp,`Boolean\(document\.querySelector\('#jump-proposal-actions'\)\)`\);.*?await click\(cdp,'#reject-proposal'\);"
long_replacement = "await fill(cdp,'#stage-output',JSON.stringify(longEnvelope));await click(cdp,'#parse-output');await waitExpr(cdp,`Boolean(document.querySelector('#jump-proposal-actions'))`);assert(await evalValue(cdp,`document.querySelector('#proposal-heading>details.record-card')?.open===true`),'Long proposal diff must preserve the existing expanded review behavior.');const navigationSymmetry=await evalValue(cdp,`(()=>{const review=document.querySelector('#jump-proposal-actions'),prompt=document.querySelector('#toggle-prompt');if(!review||!prompt)return null;const a=getComputedStyle(review),b=getComputedStyle(prompt),keys=['minHeight','borderRadius','borderColor','backgroundColor','fontSize','fontWeight','paddingTop','paddingRight','paddingBottom','paddingLeft'];return {reviewToolbar:Boolean(review.closest('.prompt-toolbar')),reviewButtonRow:review.parentElement?.classList.contains('button-row')===true,same:keys.every(k=>a[k]===b[k]),reviewWidth:review.getBoundingClientRect().width,promptWidth:prompt.getBoundingClientRect().width};})()`);assert(navigationSymmetry?.reviewToolbar&&navigationSymmetry.reviewButtonRow&&navigationSymmetry.same&&Math.abs(navigationSymmetry.reviewWidth-navigationSymmetry.promptWidth)<=2,`Review navigation does not reuse the prompt-preview control appearance: ${JSON.stringify(navigationSymmetry)}`);await click(cdp,'#jump-proposal-actions');await sleep(180);const proposalActions=await evalValue(cdp,`(()=>{const r=document.querySelector('#proposal-actions')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()`);assert(proposalActions&&proposalActions.top>=-1&&proposalActions.bottom<=proposalActions.height+1,`Proposal review actions were not brought into view: ${JSON.stringify(proposalActions)}`);assert(await evalValue(cdp,`(()=>{const b=document.querySelector('#jump-review-top');return Boolean(b&&b.closest('.prompt-toolbar')&&b.parentElement?.classList.contains('button-row'));})()`),'Long proposal did not expose the shared Go to top review control.');await click(cdp,'#jump-review-top');await sleep(180);const reviewTop=await evalValue(cdp,`(()=>{const r=document.querySelector('#proposal-heading')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()`);assert(reviewTop&&reviewTop.bottom>0&&reviewTop.top<reviewTop.height,`Go to top of review did not return the review heading to view: ${JSON.stringify(reviewTop)}`);await click(cdp,'#reject-proposal');"
test, count = re.subn(long_pattern, long_replacement, test, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'long proposal test replacement count was {count}')

browser.write_text(test)

runtime_files = ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data = Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
manifest = ''.join(f'{path}:{git_blob_sha(path)}\n' for path in runtime_files)
runtime_identity = 'runtime-' + hashlib.sha256(manifest.encode()).hexdigest()[:16]
index = Path('index.html')
html = index.read_text()
modules = r'(workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)'
html, count = re.subn(rf'(<script defer src="{modules}\.js\?v=)[^"]+', rf'\g<1>{runtime_identity}', html)
if count != 8:
    raise SystemExit(f'expected 8 runtime cache-token replacements, found {count}')
index.write_text(html)
print(runtime_identity)
