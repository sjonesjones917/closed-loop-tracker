import fs from 'node:fs';
import {createHash} from 'node:crypto';

function replaceOnce(text,from,to,label){const i=text.indexOf(from);if(i<0)throw new Error(`Missing replacement target: ${label}`);if(text.indexOf(from,i+from.length)>=0)throw new Error(`Ambiguous replacement target: ${label}`);return text.slice(0,i)+to+text.slice(i+from.length);}
function writeChanged(path,text){const prior=fs.readFileSync(path,'utf8');if(prior===text)throw new Error(`${path} was not changed.`);fs.writeFileSync(path,text);}

let app=fs.readFileSync('app-core.js','utf8');
app=replaceOnce(app,
'<p class="section-intro">Enter only genuine human-owned User Job Input. The source count is a search target, not a quota and never permission to invent weaker sources. You do not need to know the final file format in advance: Stage 01 determines the actual artifact set and suitable formats. If the chosen agent can reliably construct the requested file or package from a defined representation and sufficient inputs, it should produce that real artifact even when a downstream authoring, build, CAD/CAM, filing, manufacturing, or other consuming system is unavailable. Opening, importing, building, executing, manufacturing, filing, or testing remains separately verified. A specification substitute requires human confirmation and is used only when the requested actual artifact cannot be generated reliably. This static application does not itself access external repositories, websites, or accounts; those capabilities depend on the external agent context you choose to run. The application derives workflow identity, versions, status, counts, and next action.</p><div class="grid-2">',
'<p class="section-intro">Describe the job in your own words. Add the files, facts, constraints, and preferences you already know.</p><details class="record-card"><summary>What belongs here?<span>?</span></summary><div class="record-body"><p class="section-intro">Enter genuine human facts and decisions. You do not need to know the final file format in advance: Stage 01 determines the suitable artifact set. When exact artifact bytes can be generated reliably, the workflow should require the actual artifact; opening, importing, building, filing, manufacturing, or testing is verified separately. A specification substitute requires human confirmation. The source count is guidance, not permission to invent weaker sources. The application owns IDs, versions, status, counts, and hashes.</p></div></details><div class="grid-2">','collapsible project intake help');
app=replaceOnce(app,'tap <strong>Parse / validate response</strong> again.','tap <strong>Validate current text</strong> again.','stale-response action label');
app=replaceOnce(app,
"return `<div class=\"notice danger\" id=\"validation-report\" tabindex=\"-1\"><strong>Response rejected before canonical mutation.</strong><br>${issues.map(x=>esc(`${x.code}: ${x.message}`)).join('<br>')}</div>`;}",
"return `<div class=\"notice danger\" id=\"validation-report\" tabindex=\"-1\"><strong>Response rejected before canonical mutation.</strong><br><span>Last checked response: ${esc(v.rawResponseId||'unknown raw response')}. Text currently in the response box is unchecked if you pasted or edited it after this result.</span><br>${issues.map(x=>esc(`${x.code}: ${x.message}`)).join('<br>')}<div class=\"button-row\"><button type=\"button\" class=\"primary\" id=\"revalidate-current-response\">Validate current text</button></div></div>`;}",
'general validation state and direct action');
app=replaceOnce(app,
"function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);if(!p)return '';const rows=",
"function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);if(!p)return '';const validation=safe(current.projectData.responseValidations).find(x=>x.validationId===p.validationId||x.rawResponseId===p.rawResponseId),typographyNormalized=safe(validation?.issues).some(x=>x.code==='JSON_TYPOGRAPHY_NORMALIZED');const rows=",'proposal normalization state');
app=replaceOnce(app,
'<h2 class="section-title">Proposed extracted changes</h2>${stale?',
'<h2 class="section-title">Proposed extracted changes</h2>${typographyNormalized?\'<div class="notice warn"><strong>JSON punctuation repaired.</strong><br>Curly delimiter quotes were normalized for parsing. The exact pasted response remains preserved unchanged.</div>\':\'\'}${stale?','visible smart-quote repair notice');
app=replaceOnce(app,
'Paste only the final strict JSON from ChatGPT after the conversation is complete. If ChatGPT is still asking you questions, answer them there instead of pasting that conversation here. Parse / validate preserves the raw response first, then validates it without changing canonical project records. If the final response declares returned files, attach those exact files in Authorized files for this stage before parsing.',
'Paste only the final JSON object from ChatGPT—not its questions or your conversation. Tap Validate current text for every new paste; an older rejection remains visible until the replacement text is checked. Validation preserves the raw response before checking it and does not change canonical project records. Attach any exact returned files before validation.','returned response guidance');
app=replaceOnce(app,'Complete JSON only — no Markdown wrapper.','Final JSON object only — no chat text or Markdown wrapper.','response box hint');
app=replaceOnce(app,'>Parse / validate response<','>Validate current text<','primary validation label');
app=replaceOnce(app,
"if($('#stage-output'))$('#stage-output').oninput=()=>{  const report=$('#validation-report');  if(!report||!report.classList.contains('danger'))return;  report.classList.remove('danger');  report.classList.add('warn');  report.innerHTML='<strong>Replacement not evaluated.</strong><br>The response text changed after the last rejected parse. Tap Parse / validate response to evaluate this replacement. The prior rejection remains preserved in the audit record.';  announce('replacement not evaluated');};if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;",
"if($('#stage-output'))$('#stage-output').oninput=()=>{  const report=$('#validation-report');  if(!report||!report.classList.contains('danger'))return;  report.classList.remove('danger');  report.classList.add('warn');  report.innerHTML='<strong>Replacement not evaluated.</strong><br>The response text changed after the last rejected check. Tap Validate current text to evaluate this replacement. The prior rejection remains preserved in the audit record.<div class=\"button-row\"><button type=\"button\" class=\"primary\" id=\"revalidate-current-response\">Validate current text</button></div>';  const button=$('#revalidate-current-response');  if(button)button.onclick=e=>{e.preventDefault();prepareStageResponse();};  announce('replacement not evaluated');};if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;if($('#revalidate-current-response'))$('#revalidate-current-response').onclick=e=>{e.preventDefault();prepareStageResponse();};",
'replacement-state direct validation');
writeChanged('app-core.js',app);

let ingestion=fs.readFileSync('response-ingestion.js','utf8');
ingestion=replaceOnce(ingestion,'responseSchema:validation.responseSchema,responseType:validation.responseType,status:','responseSchema:validation.responseSchema??null,responseType:validation.responseType??null,status:','canonical validation identity normalization');
writeChanged('response-ingestion.js',ingestion);

let html=fs.readFileSync('index.html','utf8');
html=replaceOnce(html,'then tap <em>Parse / validate response</em>.','then tap <em>Validate current text</em>.','global guide action label');
html=replaceOnce(html,'until you tap <em>Parse / validate response</em> again.','until you tap <em>Validate current text</em>.','global guide replacement state');
writeChanged('index.html',html);

let builder=fs.readFileSync('build-test-project.mjs','utf8');
builder=builder.replaceAll('Parse / validate response','Validate current text');
writeChanged('build-test-project.mjs',builder);

let verifyIngestion=fs.readFileSync('verify-ingestion.mjs','utf8');
verifyIngestion=replaceOnce(verifyIngestion,"negative('empty response',()=>'', 'EMPTY_RESPONSE');",`{
  const p=project('JOB-SCHEMALESS-JSON'),stage=2,promptRecord=savePrompt(p,stage);
  const prepared=ingestion.prepare(p,{stage,text:'{"replacement":"not evaluated yet"}',promptRecord});
  if(prepared.validation.valid)throw new Error('Schema-less JSON was accepted.');
  const validationRecord=prepared.project.projectData.responseValidations.at(-1);
  if(validationRecord.responseSchema!==null||validationRecord.responseType!==null)throw new Error('Missing response identity was not normalized to null before canonical storage.');
  globalThis.closedLoopHash.sha256Value(prepared.project);
  negativeCount++;
}
negative('empty response',()=>'', 'EMPTY_RESPONSE');`,'schema-less JSON canonical persistence regression');
writeChanged('verify-ingestion.mjs',verifyIngestion);

let browser=fs.readFileSync('verify-browser.mjs','utf8');
browser=browser.replaceAll('Parse / validate response','Validate current text').replaceAll('Complete JSON only','Final JSON object only');
browser=replaceOnce(browser,
"assert(await evalValue(cdp,`Boolean(document.querySelector('.app-help details')&&!document.querySelector('.app-help details').open)`),'Human guide must exist and start collapsed.');",
"assert(await evalValue(cdp,`Boolean(document.querySelector('.app-help details')&&!document.querySelector('.app-help details').open)`),'Human guide must exist and start collapsed.');assert(await evalValue(cdp,`(()=>{const n=document.querySelector('.app-help details');return Boolean(n?.textContent.includes('Answer the agent normally')&&n?.textContent.includes('Validate current text'));})()`),'Collapsed human guide does not contain conversation and final-validation instructions.');",'collapsed global guide proof');
browser=replaceOnce(browser,
"await fill(cdp,'#stage-output','{\"schema\":}');await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Response rejected before canonical mutation.')`);assert(await evalValue(cdp,`(()=>{const v=document.querySelector('#validation-report'),o=document.querySelector('#stage-output');return Boolean(v&&o&&(v.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING));})()`),'Validation status must appear before the response box so a phone user can see what the currently rejected response means.');await fill(cdp,'#stage-output','{\"replacement\":\"not evaluated yet\"}');await waitExpr(cdp,`document.body.innerText.includes('Replacement not evaluated.')`);assert(await evalValue(cdp,`(()=>{const v=document.querySelector('#validation-report');return Boolean(v?.classList.contains('warn')&&!v?.classList.contains('danger'));})()`),'Edited replacement text must stop presenting the prior rejection as the current response state.');retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Malformed response mutated canonical sources.');assert(retained.projectData.rawResponses.length>=1&&retained.projectData.responseValidations.at(-1).valid===false,'Malformed raw response/validation not preserved.');",
"await fill(cdp,'#stage-output','{\"schema\":}');await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Response rejected before canonical mutation.')`);assert(await evalValue(cdp,`(()=>{const v=document.querySelector('#validation-report'),o=document.querySelector('#stage-output');return Boolean(v&&o&&(v.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING));})()`),'Validation status must appear before the response box so a phone user can see what the currently rejected response means.');retained=await activeProject(cdp);const rejectedRawCount=retained.projectData.rawResponses.length;await fill(cdp,'#stage-output','{\"replacement\":\"not evaluated yet\"}');await waitExpr(cdp,`document.body.innerText.includes('Replacement not evaluated.')`);assert(await evalValue(cdp,`Boolean(document.querySelector('#revalidate-current-response'))`),'Edited replacement does not expose direct validation.');await click(cdp,'#revalidate-current-response');await waitExpr(cdp,`document.body.innerText.includes('Response rejected before canonical mutation.')`);retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Malformed response mutated canonical sources.');assert(retained.projectData.rawResponses.length===rejectedRawCount+1&&retained.projectData.responseValidations.at(-1).valid===false,'Direct Validate current text did not preserve and evaluate the replacement.');assert(retained.projectData.responseValidations.at(-1).responseSchema===null&&retained.projectData.responseValidations.at(-1).responseType===null,'Missing response identity was not canonically stored as null.');",'direct retry and canonical null browser proof');
browser=replaceOnce(browser,
"await fill(cdp,'#stage-output',JSON.stringify(envelope));await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);retained=await activeProject(cdp);",
"const mobileJson=JSON.stringify(envelope).replace(/\"([^\"]*)\"/g,'“$1”');await fill(cdp,'#stage-output',mobileJson);await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Proposed extracted changes')`);assert((await snapshot(cdp)).text.includes('JSON punctuation repaired.'),'Successful smart-quote normalization is not disclosed.');retained=await activeProject(cdp);",'visible smart-quote browser proof');
browser=replaceOnce(browser,"await click(cdp,'[data-view=\"Project\"]');text=(await snapshot(cdp)).text;for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])","await click(cdp,'[data-view=\"Project\"]');text=await evalValue(cdp,`document.body.textContent`);for(const token of ['Output format (optional)','You do not need to know the final file format in advance','A specification substitute requires human confirmation'])",'collapsed project help proof');
writeChanged('verify-browser.mjs',browser);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeIdentity=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
html=fs.readFileSync('index.html','utf8');const tokens=[...html.matchAll(/runtime-[0-9a-f]{16}/g)].map(m=>m[0]);if(tokens.length!==8||new Set(tokens).size!==1)throw new Error('Runtime token set is invalid.');html=html.replaceAll(tokens[0],runtimeIdentity);writeChanged('index.html',html);

console.log(JSON.stringify({filesChanged:6,canonicalUndefinedFixed:true,directValidation:true,smartQuoteDisclosure:true,collapsedHelp:true,runtimeIdentity},null,2));
