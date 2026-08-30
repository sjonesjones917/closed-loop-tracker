from pathlib import Path


def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text:
        raise SystemExit(f'missing patch target in {path}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

# workflow-engine.js: deterministic statement-level controlled-input segmentation with source offsets.
replace_once('workflow-engine.js',
"""function splitControlledUnits(value){
  if(value===undefined||value===null)return [];
  if(Array.isArray(value))return value.flatMap(splitControlledUnits);
  if(typeof value==='object')return Object.entries(value).flatMap(([k,v])=>splitControlledUnits(`${k}: ${typeof v==='string'?v:JSON.stringify(v)}`));
  const text=String(value).replace(/\\r\\n?/g,'\\n').trim();if(!text)return [];
  const lines=text.split(/\\n+/).map(x=>x.trim()).filter(Boolean);return lines.length?lines:[text];
}
""",
"""function splitControlledUnits(value){
  if(value===undefined||value===null)return [];
  if(Array.isArray(value))return value.flatMap(splitControlledUnits);
  if(typeof value==='object')return Object.entries(value).flatMap(([k,v])=>splitControlledUnits(`${k}: ${typeof v==='string'?v:JSON.stringify(v)}`));
  const text=String(value).replace(/\\r\\n?/g,'\\n');if(!text.trim())return [];
  const units=[];
  const push=(raw,start,end)=>{const value=String(raw||'').trim();if(value)units.push({value,start,end});};
  let lineStart=0;
  for(const rawLine of text.split('\\n')){
    const leading=(rawLine.match(/^\\s*/)||[''])[0].length,trailing=(rawLine.match(/\\s*$/)||[''])[0].length,line=rawLine.trim(),base=lineStart+leading;
    if(line){
      const marker=(line.match(/^(?:[-*•]|\\d+[.)]|[A-Za-z][.)])\\s+/)||[''])[0],body=line.slice(marker.length),bodyBase=base+marker.length;
      const boundary=/(?<=[.!?;])\\s+(?=(?:[\\"'([{]*[A-Z0-9]|[-*•]))/g;let cursor=0,match;
      while((match=boundary.exec(body))){const part=body.slice(cursor,match.index);push(part,bodyBase+cursor,bodyBase+match.index);cursor=match.index+match[0].length;}
      push(body.slice(cursor),bodyBase+cursor,bodyBase+body.length);
    }
    lineStart+=rawLine.length+1;
  }
  return units.length?units:[{value:text.trim(),start:text.indexOf(text.trim()),end:text.indexOf(text.trim())+text.trim().length}];
}
""")

replace_once('workflow-engine.js',
"""  const push=(sourceLocation,rawValue,kind='HUMAN_INPUT')=>{for(const [index,value] of splitControlledUnits(rawValue).entries()){const rawValueHash=hash.sha256Value(value),unitId='INPUT-UNIT-'+hash.sha256Value({inputVersion,sourceLocation,index,rawValueHash}).slice(0,20).toUpperCase();units.push({unitId,sourceLocation,index,kind,rawValueHash,rawValue:value});}};
""",
"""  const push=(sourceLocation,rawValue,kind='HUMAN_INPUT')=>{for(const [index,segment] of splitControlledUnits(rawValue).entries()){const value=segment.value,rawValueHash=hash.sha256Value(value),unitId='INPUT-UNIT-'+hash.sha256Value({inputVersion,sourceLocation,index,sourceStart:segment.start,sourceEnd:segment.end,rawValueHash}).slice(0,20).toUpperCase();units.push({unitId,sourceLocation,index,sourceStart:segment.start,sourceEnd:segment.end,kind,rawValueHash,rawValue:value});}};
""")

replace_once('workflow-engine.js',
"""  const push=(originType,originId,sourceLocation,rawValue,provenance={})=>{for(const [index,value] of splitControlledUnits(rawValue).entries()){const rawValueHash=hash.sha256Value(value),obligationId='OBLIGATION-'+hash.sha256Value({scope,originType,originId,sourceLocation,index,rawValueHash}).slice(0,20).toUpperCase();if(seen.has(obligationId))continue;seen.add(obligationId);obligations.push({obligationId,originType,originId,sourceLocation,index,rawValueHash,rawValue:value,provenance});}};
  for(const unit of intake.units)push('HUMAN_INPUT',unit.unitId,unit.sourceLocation,unit.rawValue,{inputVersion:intake.inputVersion,inputManifestId:intake.manifestId});
  for(const name of ['EXACT_DELIVERABLE_REQUESTED','INPUT_SET_CONTENTS','ASSUMPTIONS','UNKNOWN_INFORMATION'])push('STAGE_01',`STAGE01.${name}`,name,project.job[name],{inputVersion:project.job.CURRENT_INPUT_VERSION||null,acceptedChangeId:acceptedChanges(project,1).at(-1)?.changeId||null});
""",
"""  const push=(originType,originId,sourceLocation,rawValue,provenance={})=>{for(const [index,segment] of splitControlledUnits(rawValue).entries()){const value=segment.value,rawValueHash=hash.sha256Value(value),obligationId='OBLIGATION-'+hash.sha256Value({scope,originType,originId,sourceLocation,index,sourceStart:segment.start,sourceEnd:segment.end,rawValueHash}).slice(0,20).toUpperCase();if(seen.has(obligationId))continue;seen.add(obligationId);obligations.push({obligationId,originType,originId,sourceLocation,index,sourceStart:segment.start,sourceEnd:segment.end,rawValueHash,rawValue:value,provenance});}};
  for(const unit of intake.units)push('HUMAN_INPUT',unit.unitId,unit.sourceLocation,unit.rawValue,{inputVersion:intake.inputVersion,inputManifestId:intake.manifestId,intakeUnitId:unit.unitId});
  for(const statement of currentIntentStatements(project)){const statementId=recordId(statement,'intentStatements');push('STAGE_01_INTENT',statementId,String(recordValue(statement,'SOURCE_LOCATION')||statementId),recordValue(statement,'EXACT_STATEMENT'),{statementId,sourceMaterial:String(recordValue(statement,'SOURCE_MATERIAL')||''),statementKind:String(recordValue(statement,'STATEMENT_KIND')||''),requirementRelevance:String(recordValue(statement,'REQUIREMENT_RELEVANCE')||''),normativeForce:String(recordValue(statement,'NORMATIVE_FORCE')||''),dependencies:recordValue(statement,'DEPENDENCIES')||null,exceptions:recordValue(statement,'EXCEPTIONS')||null,conflicts:recordValue(statement,'CONFLICTS')||null});}
  for(const name of ['EXACT_DELIVERABLE_REQUESTED','INPUT_SET_CONTENTS','ASSUMPTIONS','UNKNOWN_INFORMATION'])push('STAGE_01',`STAGE01.${name}`,name,project.job[name],{inputVersion:project.job.CURRENT_INPUT_VERSION||null,acceptedChangeId:acceptedChanges(project,1).at(-1)?.changeId||null});
""")

# Stage 01 accounting must trace non-inapplicable controlled units into the proposed intent ledger.
replace_once('workflow-engine.js',
"""  if(stage===1){const manifest=buildIntakeCoverageManifest(project),text=String(envelope?.stageData?.INPUT_SET_CONTENTS||'');for(const id of manifest.requiredUnitIds){const line=text.split(/\\r?\\n/).find(x=>x.includes(id))||'';if(!line)issues.push({code:'INCOMPLETE_INTAKE_ACCOUNTING',path:'/stageData/INPUT_SET_CONTENTS',message:`Stage 01 omitted controlled input unit ${id}.`});else if(!INTAKE_DISPOSITIONS.some(d=>line.includes(d)))issues.push({code:'INVALID_INTAKE_DISPOSITION',path:'/stageData/INPUT_SET_CONTENTS',message:`Stage 01 unit ${id} lacks a controlled semantic disposition.`});}}
""",
"""  if(stage===1){const manifest=buildIntakeCoverageManifest(project),text=String(envelope?.stageData?.INPUT_SET_CONTENTS||''),proposed=safe(envelope?.records?.intentStatements),locations=proposed.map(r=>String(r?.fields?.SOURCE_LOCATION||''));for(const id of manifest.requiredUnitIds){const line=text.split(/\\r?\\n/).find(x=>x.includes(id))||'';if(!line)issues.push({code:'INCOMPLETE_INTAKE_ACCOUNTING',path:'/stageData/INPUT_SET_CONTENTS',message:`Stage 01 omitted controlled input unit ${id}.`});else{const disposition=INTAKE_DISPOSITIONS.find(d=>line.includes(d));if(!disposition)issues.push({code:'INVALID_INTAKE_DISPOSITION',path:'/stageData/INPUT_SET_CONTENTS',message:`Stage 01 unit ${id} lacks a controlled semantic disposition.`});else if(disposition!=='INAPPLICABLE'&&!locations.some(location=>location.includes(id)))issues.push({code:'INTAKE_UNIT_NOT_CAPTURED',path:'/records/intentStatements',message:`Stage 01 accounted for ${id} but did not trace it into the canonical intent-statement ledger.`});}}}
""")

# Stage 03 must be genuinely exhausted before Stage 04.
replace_once('workflow-engine.js',
"""      const requiredStatements=currentIntentStatements(project).filter(intentStatementRequiresRequirement),candidateLocations=new Set(collection('candidateRequirements').map(record=>String(recordValue(record,'SOURCE_LOCATION')||'').trim())),missingStatements=requiredStatements.map(record=>recordId(record,'intentStatements')).filter(id=>!candidateLocations.has(id));
      if(missingStatements.length)reasons.push(`Candidate requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);
      break;
""",
"""      const requiredStatements=currentIntentStatements(project).filter(intentStatementRequiresRequirement),candidateLocations=new Set(collection('candidateRequirements').map(record=>String(recordValue(record,'SOURCE_LOCATION')||'').trim())),missingStatements=requiredStatements.map(record=>recordId(record,'intentStatements')).filter(id=>!candidateLocations.has(id));
      if(missingStatements.length)reasons.push(`Candidate requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);
      const stageData=project.stages[3]?.agentData||{},latestPass=Math.max(0,...collection('research').map(record=>Number(recordValue(record,'PASS_NUMBER')||0)));
      if(!truth(stageData.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED))reasons.push('Stage 03 has not affirmatively examined all known controlling sources.');
      if(!truth(stageData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 requires a completed second conflict-and-exception pass.');
      if(Number(stageData.LATEST_PASS_NUMBER||latestPass)<2)reasons.push('Stage 03 requires at least two completed research passes before exhaustion can be established.');
      if(truth(stageData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS))reasons.push('Stage 03 is not exhausted because the latest pass found a new material category; another pass is required.');
      if(collection('research').some(record=>['OPEN','INCOMPLETE','UNSATURATED','UNKNOWN','MORE_RESEARCH_REQUIRED'].includes(upper(recordValue(record,'SATURATION_STATUS')))))reasons.push('At least one current source-research record is not saturated.');
      break;
""")

# Stage 04 gate itself proves the application-owned obligation universe closed, not only ingestion.
replace_once('workflow-engine.js',
"""      const missingStatements=requiredStatementIds.filter(id=>!coveredIntentStatements.has(id));if(missingStatements.length)reasons.push(`Requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);
      break;
""",
"""      const missingStatements=requiredStatementIds.filter(id=>!coveredIntentStatements.has(id));if(missingStatements.length)reasons.push(`Requirement coverage is missing for canonical intent statement(s): ${missingStatements.join(', ')}.`);
      const obligationManifest=buildObligationManifest(project),mappedObligations=new Set(collection('requirements').flatMap(req=>safe(recordValue(req,'OBLIGATION_TRACE')).map(String))),nonRequirementAccounting=String(project.stages[4]?.agentData?.ATOMICITY_REVIEW_RESULTS||'')+'\\n'+String(project.stages[4]?.agentData?.DEFINED_TERM_GAPS||'');
      const missingObligations=obligationManifest.requiredObligationIds.filter(id=>mappedObligations.has(id)||nonRequirementAccounting.split(/\\r?\\n/).some(line=>line.includes(id)&&OBLIGATION_DISPOSITIONS.slice(1).some(d=>line.includes(d)))?false:true);if(missingObligations.length)reasons.push(`Stage 04 obligation accounting is incomplete for: ${missingObligations.join(', ')}.`);
      break;
""")

# prompt-engine: make manifest-to-ledger trace explicit and Stage 03 exhaustion operational.
replace_once('prompt-engine.js',
"""Preserve the exact wording in EXACT_STATEMENT; identify the exact filename or material label in SOURCE_MATERIAL; identify the exact page, section, paragraph, table, cell, line, or other locator in SOURCE_LOCATION; classify STATEMENT_KIND""",
"""Preserve the exact wording in EXACT_STATEMENT; identify the exact filename or material label in SOURCE_MATERIAL; for statements originating in an APPLICATION-OWNED INTAKE COVERAGE MANIFEST unit, SOURCE_LOCATION MUST begin with that exact unitId followed by the human-readable locator; for supplied-artifact statements not represented by a manifest unit, identify the exact page, section, paragraph, table, cell, line, or other locator in SOURCE_LOCATION; classify STATEMENT_KIND""")

replace_once('prompt-engine.js',
"""Repeat discovery passes until saturation is actually supported by the evidence.'""",
"""Repeat discovery passes until saturation is actually supported by the evidence. Stage 03 may not finish on the same pass that discovers a new material category. Complete at least a second conflict-and-exception pass, set ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED only when true, set SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED only after it actually occurred, report LATEST_PASS_NUMBER, and set NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS = false only when the latest complete pass introduced no new material category requiring another pass. Every current source must have current research coverage and SATURATION_STATUS must not claim completion while a known gap remains.'""")

replace_once('prompt-engine.js',
"""For the final DATA_PROPOSAL, INPUT_SET_CONTENTS must include one concise line for every unitId in this manifest. Each line must contain the exact unitId, exactly one disposition from INCORPORATED | RETAINED_CONTEXT | UNRESOLVED_HUMAN_ONLY | LATER_RESOLVABLE | INAPPLICABLE, and the faithful substantive content or reason. Do not omit an ID.""",
"""For the final DATA_PROPOSAL, INPUT_SET_CONTENTS must include one concise line for every unitId in this manifest. Each line must contain the exact unitId, exactly one disposition from INCORPORATED | RETAINED_CONTEXT | UNRESOLVED_HUMAN_ONLY | LATER_RESOLVABLE | INAPPLICABLE, and the faithful substantive content or reason. Every unit not classified INAPPLICABLE must also be traced into one or more intentStatements records by beginning SOURCE_LOCATION with that exact unitId. Split compound meaning into multiple intentStatements where necessary; one manifest unit may therefore map to multiple canonical statements. Do not omit an ID.""")

# response-ingestion: reject Stage 03 semantic non-exhaustion before proposal acceptance too.
replace_once('response-ingestion.js',
"""  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===3){
    const covered=new Set(safe(envelope.records?.candidateRequirements).map(record=>String(record?.fields?.SOURCE_LOCATION||'').trim()));
    const missing=requiredIntentIds.filter(id=>!covered.has(id));
    if(missing.length)issues.push(issue('MISSING_INTENT_STATEMENT_CANDIDATE','/records/candidateRequirements',`Candidate requirement coverage is missing for canonical intent statement(s): ${missing.join(', ')}.`));
  }
""",
"""  if(envelope.responseType==='DATA_PROPOSAL'&&stageNumber===3){
    const covered=new Set(safe(envelope.records?.candidateRequirements).map(record=>String(record?.fields?.SOURCE_LOCATION||'').trim()));
    const missing=requiredIntentIds.filter(id=>!covered.has(id));
    if(missing.length)issues.push(issue('MISSING_INTENT_STATEMENT_CANDIDATE','/records/candidateRequirements',`Candidate requirement coverage is missing for canonical intent statement(s): ${missing.join(', ')}.`));
    const allExamined=envelope.stageData?.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED===true||upper(envelope.stageData?.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED)==='TRUE',secondPass=envelope.stageData?.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED===true||upper(envelope.stageData?.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED)==='TRUE',latestPass=Number(envelope.stageData?.LATEST_PASS_NUMBER||0),newCategory=envelope.stageData?.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS===true||upper(envelope.stageData?.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS)==='TRUE';
    if(!allExamined)issues.push(issue('INCOMPLETE_STAGE03_SOURCE_EXHAUSTION','/stageData/ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED','Stage 03 cannot complete until all known controlling sources are affirmatively examined.'));
    if(!secondPass||latestPass<2)issues.push(issue('INCOMPLETE_STAGE03_SECOND_PASS','/stageData/SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED','Stage 03 requires an actual second conflict-and-exception pass.'));
    if(newCategory)issues.push(issue('STAGE03_NOT_SATURATED','/stageData/NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS','The latest Stage 03 pass found new material, so another pass is required before Stage 04.'));
  }
""")

# Permanent regression proving one-line multi-statement capture, Stage 01 ledger trace, Stage 03 exhaustion, Stage 04 inclusion, no resupply, and visual invariance.
Path('verify-zero-loss-final.mjs').write_text(r'''import fs from 'node:fs';
import vm from 'node:vm';
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(new URL('./'+file,import.meta.url),'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine,prompt=globalThis.closedLoopPromptEngine,schema=globalThis.closedLoopWorkflowSchema;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const p=core.createBlankState('JOB-ZERO-LOSS');engine.ensureShape(p);
p.job.EXACT_USER_OBJECTIVE_VERBATIM='Build the product. Preserve alpha exactly. Never ask me to provide project information twice; Stage 4 must use everything already captured.';
p.job.EXPLICIT_USER_REQUIREMENTS='Requirement beta must be preserved; Requirement gamma must also be preserved. Do not change the prompt box dimensions.';
p.job.SUPPLIED_MATERIALS_INVENTORY='intent.txt';
engine.recordHumanInputVersion(p,['EXACT_USER_OBJECTIVE_VERBATIM','EXPLICIT_USER_REQUIREMENTS','SUPPLIED_MATERIALS_INVENTORY']);
const intake=engine.currentIntakeCoverageManifest(p);
assert(intake.units.some(u=>u.rawValue==='Build the product.'),'sentence segmentation lost first sentence');
assert(intake.units.some(u=>u.rawValue==='Preserve alpha exactly.'),'sentence segmentation lost second sentence');
assert(intake.units.some(u=>u.rawValue.includes('Never ask me to provide project information twice')),'sentence segmentation lost no-resupply requirement');
assert(intake.units.every(u=>Number.isInteger(u.sourceStart)&&Number.isInteger(u.sourceEnd)&&u.sourceEnd>u.sourceStart),'input units lack source offsets');
let sid=0;
for(const unit of intake.units){p.projectData.intentStatements.push({id:`STATEMENT-${String(++sid).padStart(6,'0')}`,stage:1,active:true,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION},fields:{STATEMENT_ID:`STATEMENT-${String(sid).padStart(6,'0')}`,SOURCE_MATERIAL:'User Job Input',SOURCE_LOCATION:`${unit.unitId} / ${unit.sourceLocation}:${unit.sourceStart}-${unit.sourceEnd}`,EXACT_STATEMENT:unit.rawValue,STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'NONE',STATUS:'ACTIVE'}});}
p.job.EXACT_DELIVERABLE_REQUESTED='Finished product';p.job.ASSUMPTIONS='NONE';p.job.UNKNOWN_INFORMATION='NONE';p.job.INPUT_SET_CONTENTS=intake.units.map(u=>`${u.unitId} INCORPORATED — ${u.rawValue}`).join('\n');
p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:p.job.EXACT_DELIVERABLE_REQUESTED,ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:p.job.INPUT_SET_CONTENTS};
p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false};
const obligations=engine.currentObligationManifest(p);
const statementObligations=obligations.obligations.filter(o=>o.originType==='STAGE_01_INTENT');
assert(statementObligations.length>=intake.units.length,'Stage 04 manifest omitted canonical Stage 01 intent statements');
const stage4=prompt.buildPromptRecord(4,p,{operation:'COMPLETE'}).prompt;
for(const o of statementObligations)assert(stage4.includes(o.obligationId),`Stage 04 prompt omitted ${o.obligationId}`);
assert(stage4.includes('do not ask the human to repeat it')||stage4.includes('do not ask for the original intent file again'),'Stage 04 prompt lacks no-resupply instruction');
assert(!/patent|software|AEC|mechanical|CAD|medical/i.test(prompt.buildPromptRecord(1,p,{operation:'COMPLETE'}).prompt.split('STAGE 01 SUBJECT-NEUTRAL INTAKE ADAPTATION')[1]?.split('STAGE 01 CLARIFICATION EXPERIENCE')[0]||''),'Stage 01 subject adaptation contains hard-coded domain branch');
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
for(const css of ['height:clamp(260px,45vh,520px)','max-height:80vh','min-height:92px','min-height:220px'])assert(html.replace(/\s+/g,'').includes(css.replace(/\s+/g,'')),`visual baseline changed: ${css}`);
assert(schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','response schema not /3');
assert(core.PROJECT_SCHEMA==='closed-loop-project/3','project schema not /3');
console.log('zero-loss final regression passed');
''')

print('zero-loss patch applied')
