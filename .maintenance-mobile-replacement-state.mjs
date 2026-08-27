import fs from 'node:fs';
import {createHash} from 'node:crypto';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,text){fs.writeFileSync(path,text);}
function replaceOnce(text,search,replacement,label){
  const first=text.indexOf(search);
  const second=first<0?-1:text.indexOf(search,first+search.length);
  if(first<0)throw new Error(`${label}: expected source text was not found.`);
  if(second>=0)throw new Error(`${label}: expected source text was not unique.`);
  return text.slice(0,first)+replacement+text.slice(first+search.length);
}

{
  const path='app-core.js';
  let text=read(path);
  const parseBinding="if($('#parse-output'))$('#parse-output').onclick=prepareStageResponse;";
  const replacement=[
    "if($('#stage-output'))$('#stage-output').oninput=()=>{",
    "  const report=$('#validation-report');",
    "  if(!report||!report.classList.contains('danger'))return;",
    "  report.classList.remove('danger');",
    "  report.classList.add('warn');",
    "  report.innerHTML='<strong>Replacement not evaluated.</strong><br>The response text changed after the last rejected parse. Tap Parse / validate response to evaluate this replacement. The prior rejection remains preserved in the audit record.';",
    "  announce('replacement not evaluated');",
    "};",
    parseBinding
  ].join('');
  text=replaceOnce(text,parseBinding,replacement,'response replacement state');
  write(path,text);
}

{
  const path='verify-browser.mjs';
  let text=read(path);
  const oldBlock=" await fill(cdp,'#stage-output','{\"schema\":}');await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Response rejected before canonical mutation.')`);assert(await evalValue(cdp,`(()=>{const v=document.querySelector('#validation-report'),o=document.querySelector('#stage-output');return Boolean(v&&o&&(v.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING));})()`),'Validation status must appear before the response box so a phone user can see what the currently rejected response means.');retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Malformed response mutated canonical sources.');assert(retained.projectData.rawResponses.length>=1&&retained.projectData.responseValidations.at(-1).valid===false,'Malformed raw response/validation not preserved.');";
  const newBlock=" await fill(cdp,'#stage-output','{\"schema\":}');await click(cdp,'#parse-output');await waitExpr(cdp,`document.body.innerText.includes('Response rejected before canonical mutation.')`);assert(await evalValue(cdp,`(()=>{const v=document.querySelector('#validation-report'),o=document.querySelector('#stage-output');return Boolean(v&&o&&(v.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING));})()`),'Validation status must appear before the response box so a phone user can see what the currently rejected response means.');await fill(cdp,'#stage-output','{\"replacement\":\"not evaluated yet\"}');await waitExpr(cdp,`document.body.innerText.includes('Replacement not evaluated.')`);assert(await evalValue(cdp,`(()=>{const v=document.querySelector('#validation-report');return Boolean(v?.classList.contains('warn')&&!v?.classList.contains('danger'));})()`),'Edited replacement text must stop presenting the prior rejection as the current response state.');retained=await activeProject(cdp);assert(retained.projectData.sources.length===0,'Malformed response mutated canonical sources.');assert(retained.projectData.rawResponses.length>=1&&retained.projectData.responseValidations.at(-1).valid===false,'Malformed raw response/validation not preserved.');";
  text=replaceOnce(text,oldBlock,newBlock,'browser replacement-state regression');
  write(path,text);
}

{
  const path='verify-ingestion.mjs';
  let text=read(path);
  const insertionPoint="const negative=(name,mutate,expectedCode)=>negativeAt(name,2,mutate,expectedCode);\n";
  const smartQuoteTest=[
    insertionPoint.trimEnd(),
    '',
    '// Mobile/chat smart punctuation is normalized while the exact raw response remains preserved for audit.',
    '{',
    "  const p=project('JOB-SMART-QUOTE-JSON'),stage=2,promptRecord=savePrompt(p,stage),envelope=validEnvelope(p,stage,promptRecord);",
    "  envelope.evidence[0].content='He said \"keep the exact words\".';",
    '  const canonical=JSON.stringify(envelope);',
    "  let smart='',inString=false;",
    '  for(let i=0;i<canonical.length;i++){',
    '    const c=canonical[i];',
    "    if(!inString&&c==='\"'){smart+='“';inString=true;continue;}",
    '    if(inString){',
    "      if(c==='\\\\'&&canonical[i+1]==='\"'){smart+='\"';i++;continue;}",
    "      if(c==='\"'){smart+='”';inString=false;continue;}",
    '    }',
    '    smart+=c;',
    '  }',
    '  const prepared=ingestion.prepare(p,{stage,text:smart,promptRecord});',
    "  if(!prepared.validation.valid)throw new Error(`Smart-quoted mobile JSON was not normalized: ${JSON.stringify(prepared.validation.issues)}`);",
    "  if(!prepared.validation.issues.some(issue=>issue.code==='JSON_TYPOGRAPHY_NORMALIZED'&&issue.severity==='WARNING'))throw new Error('Smart-quote normalization warning was not preserved.');",
    "  if(prepared.rawRecord.completeRawResponse!==smart)throw new Error('Exact smart-quoted raw response was not preserved unchanged.');",
    "  if(prepared.project.projectData.acceptedChanges.length)throw new Error('Smart-quoted response changed canonical state before operator acceptance.');",
    '}',
    ''
  ].join('\n');
  text=replaceOnce(text,insertionPoint,smartQuoteTest,'smart-quote ingestion regression');
  write(path,text);
}

{
  const path='index.html';
  let text=read(path);
  text=replaceOnce(
    text,
    '<p>If research or requirements reveal a new human-only decision later, the agent may ask you then. That is expected; it must not guess.</p>',
    '<p>If research or requirements reveal a new human-only decision later, the agent may ask you then. That is expected; it must not guess. After you replace a rejected response, the status changes to <strong>Replacement not evaluated</strong> until you tap <em>Parse / validate response</em> again.</p>',
    'collapsed help replacement-state guidance');

  const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
  const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
  const manifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
  const runtimeIdentity=`runtime-${createHash('sha256').update(manifest).digest('hex').slice(0,16)}`;
  const tokens=[...text.matchAll(/runtime-[0-9a-f]{16}/g)].map(match=>match[0]);
  if(tokens.length!==runtimeFiles.length)throw new Error(`Expected ${runtimeFiles.length} runtime cache tokens; found ${tokens.length}.`);
  if(new Set(tokens).size!==1)throw new Error(`Expected one prior runtime cache identity; found ${[...new Set(tokens)].join(', ')}.`);
  text=text.replaceAll(tokens[0],runtimeIdentity);
  write(path,text);
}

for(const [path,tokens] of [
  ['app-core.js',['Replacement not evaluated.','replacement not evaluated']],
  ['verify-browser.mjs',['Edited replacement text must stop presenting the prior rejection as the current response state.']],
  ['verify-ingestion.mjs',['JOB-SMART-QUOTE-JSON','JSON_TYPOGRAPHY_NORMALIZED','Exact smart-quoted raw response was not preserved unchanged.']],
  ['index.html',['After you replace a rejected response','Replacement not evaluated']]
]){
  const text=read(path);
  for(const token of tokens)if(!text.includes(token))throw new Error(`${path}: missing repaired token ${token}.`);
}
