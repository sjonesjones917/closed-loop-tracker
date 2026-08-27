from pathlib import Path
import hashlib
import re

app = Path('app-core.js')
text = app.read_text()
pattern = r"function proposalMarkup\(n\)\{.*?\}\nfunction stageConfirmationMarkup"
replacement = '''function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);if(!p)return '';const rows=safe(p.changes).map(c=>({recordType:c.canonicalRecordType||c.canonicalCollection||'stageData',temporaryKey:c.temporaryResponseKey||'',canonicalId:c.canonicalRecordId||'APPLICATION_ASSIGNED',field:c.canonicalField||c.canonicalRelationship||'',proposedValue:c.normalizedValue,jsonPointer:c.jsonPointer||'',evidence:c.evidenceIds||'',validation:'SATISFIED'})),stale=!proposalVersionCurrent(p),longProposal=rows.length>50,jump=longProposal?'<div class="button-row proposal-shortcut"><button id="jump-proposal-actions" aria-controls="proposal-actions">Go to review actions ↓</button></div>':'';return `<div class="panel" id="proposal-heading" tabindex="-1"><h2 class="section-title">Proposed extracted changes</h2>${stale?'<div class="notice warn"><strong>Obsolete instruction version.</strong><br>This proposal cannot be accepted. Save and send the current instruction, then parse the replacement response.</div>':'<p class="section-intro">Nothing below is canonical until you accept the complete validated proposal.</p>'}${jump}${details('Proposal diff',rows,!longProposal)}<details class="record-card"><summary>Advanced raw proposal<span>Audit</span></summary><div class="record-body">${details('Complete proposal',p)}</div></details><div class="button-row" id="proposal-actions" tabindex="-1">${stale?'':'<button class="primary" id="accept-proposal">Accept response</button>'}<button id="reject-proposal">Reject response</button><button id="request-correction">Request correction</button></div><div class="field"><label>Correction or refinement needed</label><textarea id="correction-reason" placeholder="State exactly what is missing, incorrect, or should be made more complete."></textarea></div></div>`;}
function stageConfirmationMarkup'''
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'proposalMarkup replacement count was {count}')
wire_anchor = "if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;if($('#accept-proposal'))"
wire_replacement = "if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;if($('#jump-proposal-actions'))$('#jump-proposal-actions').onclick=()=>{const node=$('#proposal-actions');node?.scrollIntoView({block:'center',inline:'nearest'});requestAnimationFrame(()=>node?.focus({preventScroll:true}));announce('proposal review actions');};if($('#accept-proposal'))"
if text.count(wire_anchor) != 1:
    raise SystemExit('proposal jump wire anchor not found exactly once')
app.write_text(text.replace(wire_anchor, wire_replacement, 1))

browser = Path('verify-browser.mjs')
test = browser.read_text()
anchor = " await fill(cdp,'#stage-output',JSON.stringify(envelope));await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);retained=await activeProject(cdp);"
insertion = """ const longEnvelope=structuredClone(envelope);longEnvelope.evidence=Array.from({length:12},(_,i)=>({temporaryKey:`evidence-${i+1}`,kind:'WORKFLOW_EVIDENCE',description:`Controlled long-proposal evidence ${i+1}`,location:'browser fixture',content:`source inspection evidence ${i+1}`}));
 await fill(cdp,'#stage-output',JSON.stringify(longEnvelope));await click(cdp,'#parse-output');await waitExpr(cdp,`Boolean(document.querySelector('#jump-proposal-actions'))`);assert(!(await evalValue(cdp,`document.querySelector('#proposal-heading>details.record-card')?.open`)),'Long proposal diff should start collapsed.');await click(cdp,'#jump-proposal-actions');await sleep(180);const proposalActions=await evalValue(cdp,`(()=>{const r=document.querySelector('#proposal-actions')?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,height:innerHeight}:null;})()`);assert(proposalActions&&proposalActions.top>=-1&&proposalActions.bottom<=proposalActions.height+1,`Proposal review actions were not brought into view: ${JSON.stringify(proposalActions)}`);await click(cdp,'#reject-proposal');await waitExpr(cdp,`!document.querySelector('#proposal-heading')`);await click(cdp,'#save-prompt');retained=await activeProject(cdp);promptRecord=retained.projectData.generatedPrompts.filter(x=>Number(x.stage)===2).at(-1);envelope.promptIdentity={instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256||promptRecord.sha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature};envelope.scope=promptRecord.scope;
 await fill(cdp,'#stage-output',JSON.stringify(envelope));await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);retained=await activeProject(cdp);"""
if test.count(anchor) != 1:
    raise SystemExit('browser proposal anchor not found exactly once')
browser.write_text(test.replace(anchor, insertion, 1))

runtime_files = [
    'workbook.js',
    'hash.js',
    'workflow-schema.js',
    'workflow-engine.js',
    'prompt-engine.js',
    'response-ingestion.js',
    'project-store.js',
    'app-core.js',
]
def git_blob_sha(path):
    data = Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
manifest = ''.join(f'{path}:{git_blob_sha(path)}\n' for path in runtime_files)
runtime_token = 'runtime-' + hashlib.sha256(manifest.encode()).hexdigest()[:16]
index = Path('index.html')
html = index.read_text()
modules = r'(workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)'
html, count = re.subn(
    rf'(<script defer src="{modules}\.js\?v=)[^"]+',
    lambda match: match.group(1) + runtime_token,
    html,
)
if count != 8:
    raise SystemExit(f'expected 8 runtime cache-token replacements, found {count}')
index.write_text(html)
