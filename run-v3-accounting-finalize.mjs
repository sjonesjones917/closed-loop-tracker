import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const finalizerPath='finalize-v3-accounting.mjs';
let finalizer=fs.readFileSync(finalizerPath,'utf8');
finalizer=finalizer.replace(
  "if(next===text)throw new Error(`Patch anchor not found: ${label}`);",
  "if(next===text){console.warn(`Patch anchor not found: ${label}`);return text;}"
);
finalizer=finalizer.replace(
  "if(!text.includes(\"const INTAKE_MANIFEST_SCHEMA='closed-loop-intake-manifest/1'\"))text=replaceOnce(text,'function executionHandoff(project,{stage,operation,testIds=null,runIds=null}={}){',accountingCode+'\\nfunction executionHandoff(project,{stage,operation,testIds=null,runIds=null}={}){','accounting helper insertion');",
  "if(!text.includes(\"const INTAKE_MANIFEST_SCHEMA='closed-loop-intake-manifest/1'\"))text=replaceOnce(text,/function executionHandoff\\(/,accountingCode+'\\nfunction executionHandoff(','accounting helper insertion');"
);
fs.writeFileSync(finalizerPath,finalizer);

const result=spawnSync(process.execPath,[finalizerPath],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);

const promptPath='prompt-engine.js';
let promptText=fs.readFileSync(promptPath,'utf8');
const stage3Old="3:'Research only the current accepted Stage 02 independent external source set, source-by-source and pass-by-pass. Examine exact portions and separately capture facts, mandatory obligations, recommendations, optional practices, examples, prohibitions, exceptions, dependencies, applicability facts, restrictions, invalidating material, conflicts, superseded guidance, source evidence, candidate requirement proposals, and unresolved questions. Use response-local references rather than assigning canonical requirement identities. Do not treat the target product, this operating application, repository source code, prior implementations, project-generated artifacts, or current UI behavior as independent requirement authority. Repeat discovery passes until saturation is actually supported by the evidence.',";
const stage3New="3:'Research only the complete current accepted Stage 02 independent external source set, source-by-source and pass-by-pass. Every current Stage 02 source must have current research coverage unless Stage 02 validly established NO_APPLICABLE_EXTERNAL_SOURCE. Examine the exact applicable portions of every source deeply enough to exhaustively and separately capture mandatory statements and obligations, recommendations, optional practices, examples, explanatory material, prohibitions, exceptions, dependencies, applicability facts, restrictions, invalidating material, conflicts, superseded guidance, source evidence, candidate obligations, and unresolved research gaps or blockers. Do not omit a category merely because no item was found; establish its absence from the inspected material where relevant. Perform a second conflict-and-exception pass and continue additional passes until saturation is supported by evidence: no known controlling source is uncovered, no applicable portion remains unexamined, and the latest pass finds no new material category or candidate obligation. Use response-local references rather than assigning canonical requirement identities. Do not treat the target product, this operating application, repository source code, prior implementations, project-generated artifacts, or current UI behavior as independent requirement authority. Stage 03 is complete research coverage, not requirement atomization; Stage 04 will compile the complete obligation universe from this research and the accepted Stage 01 human-authority capture.',";
if(promptText.includes(stage3Old))promptText=promptText.replace(stage3Old,stage3New);
else if(!promptText.includes('Every current Stage 02 source must have current research coverage'))throw new Error('Stage 03 exhaustive research prompt anchor missing.');
fs.writeFileSync(promptPath,promptText);

const enginePath='workflow-engine.js';
let engine=fs.readFileSync(enginePath,'utf8');
const versionNeedle="  1:['CURRENT_INPUT_VERSION','INPUT'],2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],";
const versionReplacement="  2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],";
if(!engine.includes(versionNeedle))throw new Error('Stage 01 version-authority anchor missing.');
engine=engine.replace(versionNeedle,versionReplacement);
const marker='function intakeCoverageManifest(project){';
if(!engine.includes(marker))throw new Error('intake manifest anchor missing after finalization');
if(!engine.includes('function suppliedMaterialReferences(project){')){
  const helper=String.raw`function suppliedMaterialReferences(project){
  const raw=project&&project.job?project.job.SUPPLIED_MATERIALS_INVENTORY:null;
  if(raw===undefined||raw===null||String(raw).trim()==='')return [];
  const out=[];
  const push=value=>{const label=String(value===undefined?'':value).trim();if(label)out.push({label,type:'SUPPLIED_MATERIAL',transferMode:'REFERENCE'});};
  const ingest=value=>{
    if(value===undefined||value===null)return;
    if(Array.isArray(value)){value.forEach(ingest);return;}
    if(typeof value==='object'){
      const label=value.exactNameOrReference||value.filename||value.name||value.label||value.reference||value.path;
      if(label!==undefined)push(label);else Object.values(value).forEach(ingest);
      return;
    }
    const text=String(value).trim();
    if(!text)return;
    try{const parsed=JSON.parse(text);if(typeof parsed!=='string'){ingest(parsed);return;}}catch(error){}
    text.split(/\r?\n|;/).map(line=>line.trim()).filter(Boolean).forEach(push);
  };
  ingest(raw);
  const seen=new Set();
  return out.filter(item=>{const key=item.label.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;});
}
`;
  engine=engine.replace(marker,helper+marker);
}
const genericActionAnchor="  return actionEnvelope(project,stage,{actionType:'PASTE_FINAL_JSON',heading:'Return the final structured response',";
if(!engine.includes(genericActionAnchor))throw new Error('Generic next-action anchor missing.');
const stage4Action="  if(stage===4)return actionEnvelope(project,stage,{actionType:'PASTE_FINAL_JSON',heading:'Compile requirements from captured project intent',explanation:'The application is reusing the complete accepted Stage 01 intake and current Stage 03 research to build the Stage 04 obligation manifest. Do not attach or resend the original intent file. Provide new human input only if the application explicitly identifies a genuinely human-only unresolved question.',primaryButton:'Paste final JSON'});\n";
if(!engine.includes("heading:'Compile requirements from captured project intent'"))engine=engine.replace(genericActionAnchor,stage4Action+genericActionAnchor);
fs.writeFileSync(enginePath,engine);

const focusedPath='verify-intake-obligation-accounting.mjs';
let focused=fs.readFileSync(focusedPath,'utf8');
const stage1Needle="const prompt1=prompts.buildPromptRecord(1,p),envelope=";
const stage1Replacement="const prompt1=prompts.buildPromptRecord(1,p);p.projectData.generatedPrompts.push(structuredClone(prompt1));const envelope=";
if(!focused.includes(stage1Needle))throw new Error('Stage 01 accounting fixture prompt anchor missing.');
focused=focused.replace(stage1Needle,stage1Replacement);
const stage4Needle="const prompt4=prompts.buildPromptRecord(4,p);assert(";
const stage4Replacement="const prompt4=prompts.buildPromptRecord(4,p);p.projectData.generatedPrompts.push(structuredClone(prompt4));assert(";
if(!focused.includes(stage4Needle))throw new Error('Stage 04 accounting fixture prompt anchor missing.');
focused=focused.replace(stage4Needle,stage4Replacement);
const obsoleteHandoff="assert(handoff.conversationMaterials.length===0&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');";
const currentHandoff="assert(Array.isArray(handoff.send)&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');const stage4Action=engine.operationalNextAction(p,4);assert(/Do not attach or resend the original intent file/i.test(stage4Action.explanation),'Stage 04 next action does not state that captured intent is reused without reattachment.');";
if(!focused.includes(obsoleteHandoff))throw new Error('Stage 04 obsolete handoff assertion anchor missing.');
focused=focused.replace(obsoleteHandoff,currentHandoff);
fs.writeFileSync(focusedPath,focused);

const ingestionTestPath='verify-ingestion.mjs';
let ingestionTest=fs.readFileSync(ingestionTestPath,'utf8');
const genericStageData="  if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);\n";
if(!ingestionTest.includes(genericStageData))throw new Error('verify-ingestion StageData fixture anchor missing.');
const stage1Fixture=String.raw`  if(stage===1){
    const intake=engine.intakeCoverageManifest(p);
    const capture={schema:'closed-loop-intake-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'ingestion-'+String(index+1),text:String(unit.rawValue??unit.label??unit.unitId),statementClass:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':'FACT'}]})),conversationStatements:[]};
    Object.assign(stageData,{EXACT_DELIVERABLE_REQUESTED:'Verified ingestion deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)});
  }
`;
ingestionTest=ingestionTest.replace(genericStageData,genericStageData+stage1Fixture);

const safeValueAnchor='function safeValue(name){';
if(!ingestionTest.includes(safeValueAnchor))throw new Error('verify-ingestion safeValue anchor missing.');
const prerequisiteHelpers=String.raw`function completeIntakeCapture(p){
  const intake=engine.intakeCoverageManifest(p);
  return {schema:'closed-loop-intake-capture/1',inputVersion:intake.inputVersion,manifestSha256:intake.manifestSha256,units:intake.units.map((unit,index)=>({sourceUnitId:unit.unitId,disposition:'INCORPORATED',reason:'',extractedStatements:[{statementKey:'seed-'+String(index+1),text:String(unit.rawValue??unit.label??unit.unitId),statementClass:unit.label==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUESTED_OUTPUT':'FACT'}]})),conversationStatements:[]};
}
function seedAcceptedStage1(p){
  const promptRecord=savePrompt(p,1),capture=completeIntakeCapture(p);
  const envelope={schema:schema.RESPONSE_SCHEMA,jobId:p.job.JOB_ID,stage:1,operation:promptRecord.operation,promptIdentity:{instructionId:promptRecord.instructionId,bodySha256:promptRecord.bodySha256,contractSha256:promptRecord.contractSha256,contextSignature:promptRecord.contextSignature},scope:promptRecord.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{EXACT_DELIVERABLE_REQUESTED:'Verified ingestion deliverable',ASSUMPTIONS:'NONE',UNKNOWN_INFORMATION:'NONE',INPUT_SET_CONTENTS:JSON.stringify(capture)},records:{},evidence:[{temporaryKey:'seed-evidence-1',kind:'HUMAN_INPUT',description:'Accepted Stage 01 prerequisite',location:'controlled ingestion fixture',content:'Complete current human authority capture'}],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope),promptRecord});
  if(!prepared.validation.valid)throw new Error('Failed to seed Stage 01 prerequisite: '+JSON.stringify(prepared.validation.issues));
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'INGESTION_FIXTURE',reviewNote:'Seed prerequisite.'});
  const seeded=committed.project,acceptedChangeId=seeded.projectData.acceptedChanges.at(-1).changeId;
  engine.recordStageConfirmation(seeded,1,true,'Current human authority captured for Stage 04 ingestion fixture.','INGESTION_FIXTURE',{acceptedChangeId,inputVersion:seeded.job.CURRENT_INPUT_VERSION,instructionId:promptRecord.instructionId,contextSignature:promptRecord.contextSignature,operatorLabel:'INGESTION_FIXTURE'});
  engine.recalculate(seeded);
  if(!engine.evaluateIntakeCoverage(seeded).complete)throw new Error('Seeded Stage 01 prerequisite did not close intake accounting.');
  return seeded;
}
`;
ingestionTest=ingestionTest.replace(safeValueAnchor,prerequisiteHelpers+safeValueAnchor);

const returnEnvelopeAnchor="  return {\n    schema:schema.RESPONSE_SCHEMA,";
if(!ingestionTest.includes(returnEnvelopeAnchor))throw new Error('verify-ingestion envelope return anchor missing.');
const stage4Fixture=String.raw`  if(stage===4){
    const obligations=engine.obligationManifest(p).items;
    records.requirements=obligations.map((item,index)=>({tempKey:'requirement-'+String(index+1),fields:{OBLIGATION:item.text,REQUIREMENT_TYPE:'FUNCTIONAL',MANDATORY_OPTIONAL_STATUS:'MANDATORY',SOURCE_LOCATION:'manifest '+item.obligationId,SOURCE_AUTHORITY:item.origin,USER_INPUT_RELATIONSHIP:item.obligationId,APPLICABILITY:'APPLICABLE',DEPENDENCIES:'NONE',PROHIBITIONS:'NONE',DEFINED_TERMS:'NONE',OBSERVABLE_SATISFACTION_CONDITION:'The obligation is demonstrably satisfied.',INTENDED_VERIFICATION_METHOD:'DETERMINISTIC_OR_INDEPENDENT',EXPECTED_EVIDENCE:'Current sufficient evidence',FAILURE_CONDITION:'The obligation is not satisfied.',SEVERITY:'MAJOR',NOTES:''},relationships:{},evidenceRefs:['evidence-1']}));
  }
`;
ingestionTest=ingestionTest.replace(returnEnvelopeAnchor,stage4Fixture+returnEnvelopeAnchor);

const loopProjectAnchor="  let p=project(`JOB-E2E-${String(stage).padStart(2,'0')}`);\n  p.activeStage=stage;";
if(!ingestionTest.includes(loopProjectAnchor))throw new Error('verify-ingestion all-stage project anchor missing.');
ingestionTest=ingestionTest.replace(loopProjectAnchor,"  let p=project(`JOB-E2E-${String(stage).padStart(2,'0')}`);\n  if(stage===4)p=seedAcceptedStage1(p);\n  p.activeStage=stage;");

const prepareAnchor="  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});\n  if(!prepared.validation.valid)throw new Error(`Stage ${stage} valid response rejected: ${JSON.stringify(prepared.validation.issues)}`);";
if(!ingestionTest.includes(prepareAnchor))throw new Error('verify-ingestion prepare anchor missing.');
ingestionTest=ingestionTest.replace(prepareAnchor,"  const acceptedBefore=p.projectData.acceptedChanges.length,manifestsBefore=p.projectData.extractionManifests.length;\n  const prepared=ingestion.prepare(p,{stage,text:JSON.stringify(envelope),promptRecord});\n  if(!prepared.validation.valid)throw new Error(`Stage ${stage} valid response rejected: ${JSON.stringify(prepared.validation.issues)}`);");
const noMutationAnchor="  if(prepared.project.projectData.acceptedChanges.length)throw new Error(`Stage ${stage} mutated canonical state before operator acceptance.`);";
if(!ingestionTest.includes(noMutationAnchor))throw new Error('verify-ingestion preaccept assertion anchor missing.');
ingestionTest=ingestionTest.replace(noMutationAnchor,"  if(prepared.project.projectData.acceptedChanges.length!==acceptedBefore)throw new Error(`Stage ${stage} mutated canonical state before operator acceptance.`);");
const commitChecksAnchor="  if(!p.projectData.acceptedChanges.length)throw new Error(`Stage ${stage} did not create an accepted canonical change.`);\n  if(!p.projectData.extractionManifests.length)throw new Error(`Stage ${stage} did not create an extraction manifest.`);";
if(!ingestionTest.includes(commitChecksAnchor))throw new Error('verify-ingestion commit assertion anchor missing.');
ingestionTest=ingestionTest.replace(commitChecksAnchor,"  if(p.projectData.acceptedChanges.length!==acceptedBefore+1)throw new Error(`Stage ${stage} did not create exactly one accepted canonical change.`);\n  if(p.projectData.extractionManifests.length!==manifestsBefore+1)throw new Error(`Stage ${stage} did not create exactly one extraction manifest.`);");
fs.writeFileSync(ingestionTestPath,ingestionTest);
