from pathlib import Path
import re

def one(text, old, new, label):
    if text.count(old)!=1: raise SystemExit(f'{label}: expected one anchor, got {text.count(old)}')
    return text.replace(old,new,1)

p=Path('workflow-engine.js'); s=p.read_text()
anchor="function executionHandoff(project,{stage=Number(project.activeStage||0),operation=null,testIds=null,runIds=null}={}){\n"
helper="""function suppliedMaterialFileLabels(project){
  const raw=String(project?.job?.SUPPLIED_MATERIALS_INVENTORY||'').trim();if(!raw||['UNKNOWN','NONE','NOT APPLICABLE'].includes(upper(raw)))return [];
  const fileType=/FILE|ARTIFACT|ATTACHMENT|ZIP|ARCHIVE|DIRECTORY|FOLDER/i,nonFileType=/^(MESSAGE|TEXT|PROMPT|USER_MESSAGE|CHAT)$/i;
  try{const parsed=JSON.parse(raw),items=Array.isArray(parsed)?parsed:[parsed];return [...new Set(items.flatMap(item=>{if(!item||typeof item!=='object')return [];const type=String(item.type||item.materialType||item.kind||'').trim();if(nonFileType.test(type))return [];const label=String(item.exactNameOrReference||item.filename||item.fileName||item.name||item.description||'').trim(),looksFile=fileType.test(type)||/\\.(zip|pdf|docx?|xlsx?|csv|json|png|jpe?g|svg|txt|md|gz|tar|7z)$/i.test(label);return looksFile&&label?[label]:[];}))];}catch{return [];}
}
function executionHandoff(project,{stage=Number(project.activeStage||0),operation=null,testIds=null,runIds=null}={}){
"""
if 'function suppliedMaterialFileLabels(project)' not in s: s=one(s,anchor,helper,'engine helper')
s=one(s,"const addArtifact=a=>{if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')return;const id=recordId(a,'artifacts');send.set(id,{artifactId:id,filename:String(recordValue(a,'FILENAME')||id),sha256:String(recordValue(a,'SHA256')||'UNKNOWN'),role:String(recordValue(a,'ROLE')||'AUTHORIZED_INPUT')});};","const addArtifact=a=>{if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')return;const id=recordId(a,'artifacts');send.set(id,{artifactId:id,filename:String(recordValue(a,'FILENAME')||id),byteSize:Number(recordValue(a,'BYTE_SIZE')||0),sha256:String(recordValue(a,'SHA256')||'UNKNOWN'),role:String(recordValue(a,'ROLE')||'AUTHORIZED_INPUT')});};",'engine artifact shape')
old="if([22,23,24,25].includes(stage))for(const a of artifacts)if(String(a.scope?.productId||'')===String(current.productId||''))addArtifact(a);"
new=old+"\n  const missingRequired=[];if(stage===4){const labels=suppliedMaterialFileLabels(project),candidateInputs=artifacts.filter(a=>[1,4].includes(Number(a.stage))),normalized=value=>String(value||'').trim().replaceAll('\\\\','/').split('/').pop().toLowerCase();for(const label of labels){const key=normalized(label),matches=candidateInputs.filter(a=>{const name=normalized(recordValue(a,'FILENAME'));return name===key||name.includes(key)||key.includes(name);});if(matches.length)for(const a of matches)addArtifact(a);else missingRequired.push({label,reason:'Named supplied project material has no current application-verified artifact bytes available for Stage 04 transfer.'});}for(const a of candidateInputs.filter(a=>Number(a.stage)===4))addArtifact(a);}"
s=one(s,old,new,'engine stage4 inputs')
s=one(s,"return {send:[...send.values()],withhold:[...withhold.values()],expectBack:[...expectBack.values()]};","return {send:[...send.values()],withhold:[...withhold.values()],expectBack:[...expectBack.values()],missingRequired};",'engine return')
p.write_text(s)

p=Path('prompt-engine.js'); s=p.read_text()
old="""if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length)return '';const lines=['EXECUTION / ARTIFACT HANDOFF — APPLICATION DERIVED'];if(handoff.send.length){lines.push('FILES YOU MUST RECEIVE');for(const x of handoff.send)lines.push('- '+x.artifactId+' — '+x.filename+' — SHA-256 '+x.sha256);}if(handoff.withhold.length){lines.push('FILES / CONTEXT YOU MUST NOT RECEIVE');for(const x of handoff.withhold)lines.push('- '+x.artifactIdOrCategory+' — '+x.reason);}if(handoff.expectBack.length){lines.push('FILES / EVIDENCE YOU MUST RETURN');for(const x of handoff.expectBack)lines.push('- '+(x.filenameOrPattern||x.kind)+(x.required?' — REQUIRED':''));}lines.push('Browser-local custody does not mean these bytes were transferred automatically. The executing environment must actually receive every required file.');return lines.join('\\n')+'\\n\\n';"""
new="""if(!handoff.send.length&&!handoff.withhold.length&&!handoff.expectBack.length&&!handoff.missingRequired?.length)return '';const lines=['EXECUTION / ARTIFACT HANDOFF — APPLICATION DERIVED'];if(handoff.send.length){lines.push('FILES YOU MUST RECEIVE');for(const x of handoff.send)lines.push('- '+x.artifactId+' — '+x.filename+' — '+x.byteSize+' bytes — SHA-256 '+x.sha256);}if(handoff.missingRequired?.length){lines.push('REQUIRED INPUT FILES MISSING FROM APPLICATION CUSTODY');for(const x of handoff.missingRequired)lines.push('- '+x.label+' — '+x.reason);}if(handoff.withhold.length){lines.push('FILES / CONTEXT YOU MUST NOT RECEIVE');for(const x of handoff.withhold)lines.push('- '+x.artifactIdOrCategory+' — '+x.reason);}if(handoff.expectBack.length){lines.push('FILES / EVIDENCE YOU MUST RETURN');for(const x of handoff.expectBack)lines.push('- '+(x.filenameOrPattern||x.kind)+(x.required?' — REQUIRED':''));}lines.push('Browser-local custody does not mean these bytes were transferred automatically. The executing environment must actually receive every required file.');if(stage===4)lines.push('The operator must attach every file listed under FILES YOU MUST RECEIVE to this external conversation before Stage 04 substantive work. If a required supplied-project file is unavailable in your executing context, return BLOCKED or HUMAN_INPUT_REQUIRED as contracted; do not compile a complete requirement set from a filename, inventory label, summary, or assumption alone.');return lines.join('\\n')+'\\n\\n';"""
s=one(s,old,new,'prompt handoff')
p.write_text(s)

p=Path('app-core.js'); s=p.read_text(); anchor='function workflow(){const n=current.activeStage'
helper="""function outgoingInstructionHandoffMarkup(n,locked){
  const handoff=engine.executionHandoff(current,{stage:n,operation:selectedOperation(n)}),missing=safe(handoff.missingRequired),send=safe(handoff.send);if(!send.length&&!missing.length)return '';
  const rows=send.map(x=>`<div class=\"record-row\"><div class=\"record-key\">Required</div><div class=\"record-value\"><strong>${esc(x.artifactId)} — ${esc(x.filename)}</strong><br>${Number(x.byteSize||0).toLocaleString()} bytes<br>SHA-256: ${esc(x.sha256)}<div class=\"button-row\"><button type=\"button\" data-download-artifact=\"${esc(x.artifactId)}\">Download exact bytes</button></div></div></div>`).join('');
  if(missing.length)return `<div class=\"panel\" id=\"outgoing-instruction-handoff\" tabindex=\"-1\"><h2 class=\"section-title\">Send with this instruction</h2><div class=\"notice danger\"><strong>Required input file is missing.</strong><br>Add ${esc(missing.map(x=>x.label).join(', '))} before copying the Stage ${String(n).padStart(2,'0')} instruction. The application will not save or copy an apparently executable instruction while required input bytes are absent.</div><div class=\"field\"><label>Add required input file</label><input id=\"outgoing-stage-files\" type=\"file\" multiple${locked?' disabled':''}><span class=\"help\">The application stores, hashes, reads back, and verifies the exact bytes before authorizing transfer.</span></div></div>`;
  return `<div class=\"panel\" id=\"outgoing-instruction-handoff\" tabindex=\"-1\"><h2 class=\"section-title\">Send with this instruction</h2><div class=\"notice warn\"><strong>Required — attach the exact file${send.length===1?'':'s'} below.</strong><br>Browser-local storage does not transfer files to the external agent automatically. Do not continue until every listed file is attached to that conversation.</div><div class=\"record-rows\">${rows}</div></div>`;
}
function promptHandoffBlocker(n){const handoff=engine.executionHandoff(current,{stage:n,operation:selectedOperation(n)});return safe(handoff.missingRequired).length?`Required input file is missing. Add ${handoff.missingRequired.map(x=>x.label).join(', ')} before copying the Stage ${String(n).padStart(2,'0')} instruction.`:'';}
function workflow(){const n=current.activeStage"""
if 'function outgoingInstructionHandoffMarkup' not in s: s=one(s,anchor,helper,'ui helper')
s=one(s,'${evidenceExplanationMarkup(n)}${interactionModeMarkup(n)}<div class="panel" id="prompt-heading" tabindex="-1">','${evidenceExplanationMarkup(n)}${interactionModeMarkup(n)}${outgoingInstructionHandoffMarkup(n,locked)}<div class="panel" id="prompt-heading" tabindex="-1">','ui placement')
s=one(s,'<button id="save-prompt"${locked?\' disabled\':\'\'}>Save instruction</button><button class="primary" id="copy-prompt"${locked?\' disabled\':\'\'}>Save and copy instruction</button>','<button id="save-prompt"${locked||Boolean(promptHandoffBlocker(n))?\' disabled\':\'\'}>Save instruction</button><button class="primary" id="copy-prompt"${locked||Boolean(promptHandoffBlocker(n))?\' disabled\':\'\'}>Save and copy instruction</button>','ui buttons')
s=one(s,'async function savePromptRecord(n){\n  const existing=currentPromptRecord(n);if(existing)return existing;','async function savePromptRecord(n){\n  const blocker=promptHandoffBlocker(n);if(blocker)throw new Error(blocker);\n  const existing=currentPromptRecord(n);if(existing)return existing;','ui save guard')
s=one(s,"if($('#stage-files'))$('#stage-files').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));","if($('#outgoing-stage-files'))$('#outgoing-stage-files').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));if($('#stage-files'))$('#stage-files').onchange=e=>registerStageFiles(Array.from(e.target.files||[]));",'ui file wire')
p.write_text(s)

p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
if 'stage04ExactOutgoingArtifactHandoff' not in s:
 s += """

// Stage 04 exact outgoing supplied-file handoff.
{
 const p=baseProject(),name='MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN 2';p.job.SUPPLIED_MATERIALS_INVENTORY=JSON.stringify([{type:'FILE',exactNameOrReference:name}]);
 let r=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});if(!r.prompt.includes('REQUIRED INPUT FILES MISSING FROM APPLICATION CUSTODY')||!r.prompt.includes(name))throw new Error('Stage 04 prompt does not fail closed when named supplied file bytes are missing.');
 p.projectData.artifacts.push({id:'ARTIFACT-000041',stage:1,active:true,scope:engine.currentScope(p),fields:{ARTIFACT_ID:'ARTIFACT-000041',FILENAME:name,BYTE_SIZE:416621,SHA256:'abc123stage4handoff',ROLE:'USER_SUPPLIED_INPUT',AVAILABILITY:'BYTES_PERSISTED_AND_VERIFIED'}});
 r=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});for(const token of ['FILES YOU MUST RECEIVE','ARTIFACT-000041',name,'416621 bytes','SHA-256 abc123stage4handoff','operator must attach every file listed under FILES YOU MUST RECEIVE','do not compile a complete requirement set from a filename'])if(!r.prompt.includes(token))throw new Error('Stage 04 outgoing handoff missing '+token);
 const h=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});if(h.send.length!==1||h.send[0].artifactId!=='ARTIFACT-000041'||h.send[0].byteSize!==416621||h.missingRequired.length)throw new Error('Stage 04 handoff is not derived from exact verified supplied artifact bytes.');
 const ui=fs.readFileSync('app-core.js','utf8');for(const token of ['Send with this instruction','Required input file is missing.','Browser-local storage does not transfer files to the external agent automatically.','outgoing-stage-files','promptHandoffBlocker'])if(!ui.includes(token))throw new Error('Stage 04 operator handoff UI missing '+token);
}
console.log(JSON.stringify({stage04ExactOutgoingArtifactHandoff:true},null,2));
"""
p.write_text(s)

p=Path('verify-browser-extra.mjs'); s=p.read_text(); anchor="const appCoreSource=fs.readFileSync('app-core.js','utf8');"
if 'Stage 04 outgoing artifact handoff browser surface missing' not in s: s=one(s,anchor,anchor+"\nfor(const token of ['Send with this instruction','Required input file is missing.','Browser-local storage does not transfer files to the external agent automatically.','outgoing-instruction-handoff','promptHandoffBlocker'])if(!appCoreSource.includes(token))throw new Error('Stage 04 outgoing artifact handoff browser surface missing '+token);",'browser source regression')
p.write_text(s)

p=Path('index.html'); s=p.read_text(); s=re.sub(r'runtime-[A-Za-z0-9-]+','runtime-stage4handoff-20260829',s); p.write_text(s)
