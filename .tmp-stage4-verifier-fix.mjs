import fs from 'node:fs';
const file='verify-ingestion.mjs';
let s=fs.readFileSync(file,'utf8');
if(!s.includes('function prepareStage4Upstream(p)'))throw new Error('Stage 4 fixture helper was not materialized.');
const save='const record={...prompts.buildPromptRecord(stage,p,options),generatedAt:new Date().toISOString(),iteration:p.job.CURRENT_ITERATION||\'NOT APPLICABLE\'};';
if(s.includes(save))s=s.replace(save,"if(stage===4)prepareStage4Upstream(p);\n  "+save);
const next='nextPrompt=prompts.buildPromptRecord(nextStage,reloaded,nextOptions).prompt';
if(s.includes(next))s=s.replace(next,"nextPrompt=(nextStage===4?(prepareStage4Upstream(reloaded),prompts.buildPromptRecord(nextStage,reloaded,nextOptions)):prompts.buildPromptRecord(nextStage,reloaded,nextOptions)).prompt");
const stageDataAnchor="if(stageFields.length)stageData[stageFields[0]]=safeValue(stageFields[0]);";
if(!s.includes('stageData.INPUT_SET_CONTENTS=JSON.stringify({units:')){
  if(!s.includes(stageDataAnchor))throw new Error('validEnvelope stageData anchor missing.');
  s=s.replace(stageDataAnchor,stageDataAnchor+`\n  if(stage===1){const intake=promptRecord.contextManifest?.intakeCoverageManifest;if(!intake?.units)throw new Error('Stage 1 prompt fixture lacks intake manifest.');stageData.INPUT_SET_CONTENTS=JSON.stringify({units:intake.units.map((u,i)=>({sourceUnitId:u.unitId,disposition:'incorporated into the job definition',extractedStatements:[{statementKey:'S'+String(i+1),text:u.sourceLocation?.startsWith('job.')?String(p.job?.[u.sourceLocation.slice(4)]??('Captured '+u.label)):('Captured supplied material '+u.label),statementClass:u.label==='EXACT_USER_OBJECTIVE_VERBATIM'?'REQUIREMENT':'FACT'}]}))});}\n  if(stage===3){stageData.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED='TRUE';stageData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED='TRUE';stageData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS='FALSE';}`);
}
const evidenceAnchor="evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`}],";
if(!s.includes("kind:'OBLIGATION_DISPOSITION'")){
  if(!s.includes(evidenceAnchor))throw new Error('validEnvelope evidence anchor missing.');
  s=s.replace(evidenceAnchor,"evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Controlled verification evidence',location:'verification fixture',content:`stage-${stage}-evidence`},...(stage===4?(promptRecord.contextManifest?.obligationManifest?.items||[]).map((item,i)=>({temporaryKey:'obligation-disposition-'+String(i+1),kind:'OBLIGATION_DISPOSITION',description:'Controlled Stage 04 obligation accounting fixture',location:'verification fixture',content:JSON.stringify({obligationId:item.obligationId,disposition:'retained nonnormative context',reason:'Synthetic ingestion fixture exercises closed accounting without inventing a production requirement.'})})):[])],");
}
if(!s.includes('if(stage===4)prepareStage4Upstream(p);'))throw new Error('Stage 4 savePrompt fixture correction missing.');
if(!s.includes('nextStage===4?(prepareStage4Upstream(reloaded)'))throw new Error('Stage 4 next-prompt fixture correction missing.');
if(!s.includes('stageData.INPUT_SET_CONTENTS=JSON.stringify({units:'))throw new Error('Stage 1 structured intake fixture correction missing.');
if(!s.includes("kind:'OBLIGATION_DISPOSITION'"))throw new Error('Stage 4 closed accounting fixture correction missing.');
fs.writeFileSync(file,s);
console.log('Stage 1/3/4 ingestion verifier fixtures corrected.');
