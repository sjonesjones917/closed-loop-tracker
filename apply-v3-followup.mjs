import fs from 'node:fs';
{
  const path='prompt-engine.js';
  let s=fs.readFileSync(path,'utf8');
  const old='Repeat discovery passes until saturation is actually supported by the evidence.';
  const replacement='Repeat discovery passes until saturation is actually supported by the evidence. Do not stop at a first pass. Before final Stage 03 JSON, every current Stage 02 source must have current research coverage; every required semantic category must have been examined; a second conflict-and-exception pass must be complete; and the latest complete pass must find no new material category. If any source is uncovered, any category remains unexamined, any conflict/exception pass is incomplete, or the latest pass discovers new material, continue Stage 03 rather than returning a completion proposal. Stage 03 must exhaust the accepted source set because Stage 04 will compile only the application-enumerated union of accepted Stage 01 and Stage 03 material.';
  if(!s.includes(replacement)){
    if(!s.includes(old))throw new Error('Stage 03 saturation sentence not found.');
    s=s.replace(old,replacement);
    fs.writeFileSync(path,s);
    console.log('patched prompt-engine Stage 03 exhaustion semantics');
  }else console.log('Stage 03 exhaustion semantics already patched');
}
{
  const path='prompt-engine.js';
  let s=fs.readFileSync(path,'utf8');
  const anchor='Stage 01 also owns proactive human intake: before finalizing Stage 01, collect the human-specific facts and decisions that are already foreseeable as necessary to achieve the requested outcome, even when a later stage will use them.';
  const required=' Every foreseeable human-only issue must be supplied, asked and answered, or asked and explicitly deferred before Stage 01 completion.';
  if(!s.includes(required.trim())){
    if(!s.includes(anchor))throw new Error('Stage 01 proactive human intake anchor not found.');
    s=s.replace(anchor,anchor+required);
    fs.writeFileSync(path,s);
    console.log('patched prompt-engine Stage 01 human-only closure semantics');
  }else console.log('Stage 01 human-only closure semantics already patched');
}
{
  const path='verify-prompt-semantics.mjs';
  let s=fs.readFileSync(path,'utf8');
  const replacements=[
    ["prompts.version!=='closed-loop-prompt-engine/26'","prompts.version!=='closed-loop-prompt-engine/27'"],
  ];
  let changed=false;
  for(const [a,b] of replacements){if(s.includes(a)){s=s.replace(a,b);changed=true;}else if(!s.includes(b)){} }
  if(changed){fs.writeFileSync(path,s);console.log('aligned prompt engine regression version');}else console.log('prompt engine regression version already aligned');
}
{
  const path='verify-ingestion.mjs';
  let s=fs.readFileSync(path,'utf8');
  const old="  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];";
  const replacement="  if(stage===1){const manifest=engine.stage01IntakeManifest(p);stageData.INTAKE_ACCOUNTING=manifest.units.map(unit=>({inputUnitId:unit.inputUnitId,disposition:'INCORPORATED',normalizedMeaning:String(unit.rawValue||unit.value||unit.text||'Preserved controlled human input'),reason:''}));records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];}";
  if(!s.includes(replacement)){
    if(!s.includes(old))throw new Error('Stage 01 ingestion fixture anchor not found.');
    s=s.replace(old,replacement);
    fs.writeFileSync(path,s);
    console.log('migrated Stage 01 ingestion valid fixture to exhaustive /3 accounting');
  }else console.log('Stage 01 ingestion fixture already migrated');
}
