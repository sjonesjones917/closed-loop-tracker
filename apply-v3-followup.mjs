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
  if(s.includes("prompts.version!=='closed-loop-prompt-engine/26'")){
    s=s.replace("prompts.version!=='closed-loop-prompt-engine/26'","prompts.version!=='closed-loop-prompt-engine/27'");
    fs.writeFileSync(path,s);
    console.log('aligned prompt engine regression version');
  }else console.log('prompt engine regression version already aligned');
}
{
  const path='verify-ingestion.mjs';
  let s=fs.readFileSync(path,'utf8');
  const legacy="  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];";
  const migrated="  if(stage===1){const manifest=engine.stage01IntakeManifest(p);stageData.INTAKE_ACCOUNTING=manifest.units.map(unit=>({inputUnitId:unit.inputUnitId,disposition:engine.INTAKE_DISPOSITIONS[0],normalizedMeaning:String(unit.rawValue||unit.value||unit.text||'Preserved controlled human input'),reason:''}));records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];}";
  if(s.includes(legacy))s=s.replace(legacy,migrated);
  s=s.replaceAll("disposition:'INCORPORATED',normalizedMeaning:","disposition:engine.INTAKE_DISPOSITIONS[0],normalizedMeaning:");
  const stage1Line="  if(stage===1){const manifest=engine.stage01IntakeManifest(p);stageData.INTAKE_ACCOUNTING=manifest.units.map(unit=>({inputUnitId:unit.inputUnitId,disposition:engine.INTAKE_DISPOSITIONS[0],normalizedMeaning:String(unit.rawValue||unit.value||unit.text||'Preserved controlled human input'),reason:''}));records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];}";
  const stage4Line="\n  if(stage===4){const manifest=engine.stage04ObligationManifest(p);stageData.OBLIGATION_ACCOUNTING=manifest.obligations.map(obligation=>({obligationId:obligation.obligationId,disposition:engine.OBLIGATION_DISPOSITIONS[1],requirementTempKeys:[],reason:'Controlled fixture retains this manifest item as nonnormative context.'}));}";
  if(!s.includes('if(stage===4){const manifest=engine.stage04ObligationManifest(p);')){
    if(!s.includes(stage1Line))throw new Error('Stage 1 migrated fixture anchor missing for Stage 4 insertion.');
    s=s.replace(stage1Line,stage1Line+stage4Line);
  }
  const smartOld="  e.stageData={EXACT_DELIVERABLE_REQUESTED:'Patent application draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later filing-route facts',INPUT_SET_CONTENTS:'Human request and invention-packet.zip'};";
  const smartNew="  e.stageData={...e.stageData,EXACT_DELIVERABLE_REQUESTED:'Controlled deliverable draft',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'Later-resolvable facts',INPUT_SET_CONTENTS:'Human request and supplied project packet'};";
  if(s.includes(smartOld))s=s.replace(smartOld,smartNew);
  s=s.replace("if(stageEntries.length!==4||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))","if(stageEntries.length!==5||stageEntries.some(x=>!Array.isArray(x.evidenceIds)||x.evidenceIds.length===0))");
  fs.writeFileSync(path,s);
  console.log('aligned ingestion fixtures and smart-quote regression with exhaustive Stage 01/04 accounting');
}
{
  const path='workflow-engine.js';
  let s=fs.readFileSync(path,'utf8');
  const anchor="function stage04ObligationManifest(project){const inputVersion=String(project.job.CURRENT_INPUT_VERSION||'UNKNOWN'),sourceSetVersion=String(project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE'),entries=[];for(const s of currentIntentStatements(project)){";
  const replacement="function stage04ObligationManifest(project){const inputVersion=String(project.job.CURRENT_INPUT_VERSION||'UNKNOWN'),sourceSetVersion=String(project.job.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE'),entries=[];const intake=stage01IntakeManifest(project);for(const unit of intake.units)entries.push({origin:'CURRENT_USER_JOB_INPUT',sourceIdentity:unit.inputUnitId,sourceLocation:unit.sourceLocation,text:unit.rawValue,evidenceSha256:unit.rawValueSha256,requirementRelevant:true});for(const s of currentIntentStatements(project)){";
  if(!s.includes("origin:'CURRENT_USER_JOB_INPUT'")){
    if(!s.includes(anchor))throw new Error('Stage 04 obligation manifest anchor not found.');
    s=s.replace(anchor,replacement);
    fs.writeFileSync(path,s);
    console.log('patched Stage 04 to include current User Job Input directly in the obligation universe');
  }else console.log('Stage 04 current User Job Input union already patched');
}
