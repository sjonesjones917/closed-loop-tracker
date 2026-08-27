from pathlib import Path
import re

app=Path('app-core.js')
s=app.read_text()

s=re.sub(r'\nfunction stageHelpMarkup\(n\)\{.*?\n\}\n\nfunction provenanceMarkup', '\nfunction provenanceMarkup', s, flags=re.S)
s=s.replace('${testExecutionGuidanceMarkup(n)}${stageHelpMarkup(n)}<div class="panel"><h2 class="section-title">Generated instruction</h2>', '${testExecutionGuidanceMarkup(n)}<div class="panel"><h2 class="section-title">Generated instruction</h2>')
assert 'function stageHelpMarkup(n)' not in s
assert '${stageHelpMarkup(n)}' not in s
assert '<h2 class="section-title">Agent loop</h2>' not in s

helper=r'''
function suppliedFileMaterialLabels(){
  const raw=String(current?.job?.SUPPLIED_MATERIALS_INVENTORY||'').trim();
  if(!raw)return [];
  const fileType=/FILE|ARTIFACT|ATTACHMENT|ZIP|ARCHIVE|DIRECTORY|FOLDER/i;
  const nonFileType=/^(MESSAGE|TEXT|PROMPT|USER_MESSAGE|CHAT)$/i;
  try{
    const parsed=JSON.parse(raw),items=Array.isArray(parsed)?parsed:[parsed];
    return items.flatMap(item=>{
      if(!item||typeof item!=='object')return [];
      const type=String(item.type||item.materialType||item.kind||'').trim();
      if(nonFileType.test(type))return [];
      const label=String(item.exactNameOrReference||item.filename||item.fileName||item.name||item.description||'').trim();
      const looksFile=fileType.test(type)||/\.(zip|pdf|docx?|xlsx?|csv|json|png|jpe?g|svg|txt|md|gz|tar|7z)$/i.test(label);
      return looksFile&&label?[label]:[];
    });
  }catch{}
  const quoted=raw.match(/(?:zip|archive|file|attachment)\s+(?:file\s+)?[“"']?\s*([^”"'\n;]+?)(?=[”"']|$)/i);
  if(quoted?.[1])return [quoted[1].trim()];
  const named=raw.match(/([^\n;,]+\.(?:zip|pdf|docx?|xlsx?|csv|json|png|jpe?g|svg|txt|md|gz|tar|7z))/i);
  return named?.[1]?[named[1].trim()]:[];
}
function stageArtifactHelpText(n){
  const supplied=suppliedFileMaterialLabels();
  if((n===1||n===2)&&supplied.length){
    const names=supplied.join('; ');
    return n===1
      ?`Include the supplied project artifact(s) with the Stage 01 prompt if ChatGPT does not already have them in this chat: ${names}.`
      :`Include the original supplied project artifact(s) with the Stage 02 prompt so the agent can inventory and inspect the actual files: ${names}.`;
  }
  const later={
    10:'Include the exact candidate component files selected for the freeze if this operation must inspect their bytes.',
    11:'Include the exact frozen candidate package required for the selected run.',
    12:'Include the exact run output, candidate files, test fixtures, or other artifacts required by the accepted test definitions.',
    17:'Include the exact corrected candidate/package and any test artifacts required by the selected operation.',
    19:'Include the exact unchanged frozen candidate/package and any test or regression artifacts required by the confirmation operation.',
    20:'Include the exact approved component files being frozen into the production baseline when byte inspection is required.',
    21:'Include the exact approved baseline files/materials used to generate the finished product.',
    22:'Include the exact finished-product files and any deterministic test artifacts required by the accepted tests.',
    23:'Include the exact finished-product files being reviewed and any source/requirement artifact whose content is required for the meaning comparison.',
    24:'Include the exact finished-product files under adversarial review and any required regression fixtures or supporting artifacts.',
    25:'Include every exact delivery file and rendered or packaged representation that must be inspected.',
    26:'Include the exact finished-product or evidence artifacts this reconciliation operation must inspect.',
    27:'Include the exact product/evidence artifacts required for the release-gate determination when that determination depends on their contents.',
    28:'Include the exact audited release files and the exact delivery files whose byte identity is being verified.'
  };
  return later[n]||'';
}
function updateStageHelp(){
  const row=$('#stage-artifact-help');if(!row)return;
  const text=stageArtifactHelpText(Number(current?.activeStage||1));
  row.hidden=!text;
  row.innerHTML=text?`<strong>Include required artifact(s) when needed.</strong> ${esc(text)}`:'';
}
'''
if 'function updateStageHelp()' not in s:
    s=s.replace('function provenanceMarkup',helper+'\nfunction provenanceMarkup')
s=s.replace("function render(){if(!current)return;header();$('#screen').innerHTML=({Overview:overview,Project:projectView,Workflow:workflow,Records:records,Files:files,Release:release}[current.activeView]||overview)();wire();}", "function render(){if(!current)return;header();$('#screen').innerHTML=({Overview:overview,Project:projectView,Workflow:workflow,Records:records,Files:files,Release:release}[current.activeView]||overview)();updateStageHelp();wire();}")
app.write_text(s)

idx=Path('index.html')
t=idx.read_text()
help_html='''<div class="app-help"><details><summary><b>?</b> How to use this stage</summary><div class="help-body"><ol><li><strong>Copy or send the current instruction to ChatGPT.</strong> Keep using the same chat for that stage.</li><li id="stage-artifact-help" hidden></li><li><strong>Answer the agent normally.</strong> If it needs information only you can provide, it should ask short plain-language questions in ChatGPT and wait for your answer. Keep talking there until it says the stage is ready for the final JSON. Do not paste the conversation into this app.</li><li><strong>Wait for the final JSON.</strong> When the agent has enough information, it should return one JSON object with no extra prose.</li><li><strong>Paste only that final JSON into the response box</strong>, then tap <em>Parse / validate response</em>. Review the proposed change before accepting it.</li></ol><p>If research or requirements reveal a new human-only decision later, the agent may ask you then. That is expected; it must not guess. After you replace a rejected response, the status changes to <strong>Replacement not evaluated</strong> until you tap <em>Parse / validate response</em> again.</p></div></details></div>'''
if '<div class="app-help">' not in t:
    t=t.replace('<main><section class="screen" id="screen">',help_html+'\n<main><section class="screen" id="screen">')
else:
    t=re.sub(r'<div class="app-help">.*?</div>\s*<main><section class="screen" id="screen">',help_html+'\n<main><section class="screen" id="screen">',t,flags=re.S)
idx.write_text(t)

vb=Path('verify-browser.mjs')
q=vb.read_text()
q=q.replace("await openStage(cdp,2);assert(await evalValue(cdp,`Boolean(document.querySelector('.stage-help')&&!document.querySelector('.stage-help').open)`),'Stage guide must exist and start collapsed.');", "assert(await evalValue(cdp,`Boolean(document.querySelector('.app-help details')&&!document.querySelector('.app-help details').open)`),'Human guide must exist in its original location and start collapsed.');")
q=q.replace("await openStage(cdp,2);await evalValue(cdp,`document.querySelector('.stage-help').open=true`);let text=(await snapshot(cdp)).text;for(const token of ['Independent external sources only.','closed-loop-stage-response/2','PROMPT IDENTITY','Parse / validate response','How to use this stage','The prompt text does not give ChatGPT the file bytes','Required supplied material(s) for this job','Expand preview','exact controlling copy block','Complete JSON only'])", "await openStage(cdp,2);await evalValue(cdp,`document.querySelector('.app-help details').open=true`);let text=(await snapshot(cdp)).text;for(const token of ['Independent external sources only.','closed-loop-stage-response/2','PROMPT IDENTITY','Parse / validate response','How to use this stage','Expand preview','exact controlling copy block','Complete JSON only'])")
q=q.replace("await openStage(cdp,1);await evalValue(cdp,`document.querySelector('.stage-help').open=true`);text=(await snapshot(cdp)).text;", "await openStage(cdp,1);await evalValue(cdp,`document.querySelector('.app-help details').open=true`);text=(await snapshot(cdp)).text;")
if 'Non-file MESSAGE input incorrectly rendered' not in q:
    q=q.replace(' // Return retained project to Stage 02 and verify strict prompt contract.', " // Retained test input is MESSAGE content, not a file; do not tell the user to attach it.\n await openStage(cdp,2);assert(await evalValue(cdp,`document.querySelector('#stage-artifact-help')?.hidden===true`),'Non-file MESSAGE input incorrectly rendered as an attachment requirement.');\n // Return retained project to Stage 02 and verify strict prompt contract.")
vb.write_text(q)

sem=Path('verify-prompt-semantics.mjs')
q=sem.read_text()
q=q.replace("if(!ui.includes('Stage 01 is an intake conversation')||!ui.includes('remaining human-only questions in normal chat')||!ui.includes('HUMAN_INPUT_REQUIRED in this app is only a fallback')||!ui.includes('? How to use this stage')||!ui.includes('Paste only the final JSON here'))throw new Error('Stage 01 operator UI does not explain the human conversation and final JSON handoff.');", "if(!ui.includes('Stage 01 is an intake conversation')||!ui.includes('remaining human-only questions in normal chat')||!ui.includes('HUMAN_INPUT_REQUIRED in this app is only a fallback'))throw new Error('Stage 01 operator UI does not explain the human conversation and final JSON handoff.');")
q=q.replace("if(!ui.includes('The prompt text does not give ChatGPT the file bytes')||!ui.includes('Required supplied material(s) for this job'))throw new Error('Stage 02 guide does not tell the human to provide the supplied project artifact.');", "if(!ui.includes('Include the original supplied project artifact(s) with the Stage 02 prompt')||!ui.includes('suppliedFileMaterialLabels'))throw new Error('Stage 02 guide does not conditionally tell the human to provide actual supplied file artifacts.');")
sem.write_text(q)

# Refresh deterministic runtime token after changing app-core.
import hashlib
runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def git_blob_sha(path):
    data=Path(path).read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
manifest=''.join(f'{f}:{git_blob_sha(f)}\n' for f in runtime_files)
runtime='runtime-'+hashlib.sha256(manifest.encode()).hexdigest()[:16]
t=idx.read_text()
t=re.sub(r'(src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)[^"]+',lambda m:m.group(1)+runtime,t)
idx.write_text(t)
print(runtime)
