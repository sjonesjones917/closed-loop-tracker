import {stage04AcceptanceFixture,stage04AcceptanceFixtureSource} from './test-fixtures.mjs';
// Disposable in-memory current-profile fixture: actual production proposal
// validation/commit, synthetic intent decision and independent review. No real
// external actor, human acceptance, selected file or browser storage is claimed.
export function stage04PromptProvenanceProbe(runtime){
 const {core,engine,prompts}=runtime,initial=core.createBlankState('JOB-BROWSER-STAGE04-PROOF');
 Object.assign(initial.job,{JOB_TITLE:'Synthetic Stage04 prompt provenance',EXACT_USER_OBJECTIVE_VERBATIM:'stage04-objective',EXPLICIT_USER_REQUIREMENTS:'stage04-requirement',SUPPLIED_MATERIALS_INVENTORY:JSON.stringify([{type:'FILE',exactNameOrReference:'design-input.pdf'}])});
 initial.projectData.userEntered={objective:'stage04-objective',requirement:'stage04-requirement'};
 const p=stage04AcceptanceFixture(runtime,initial.job.JOB_ID,{project:initial});
 const text=prompts.buildPromptRecord(4,p).prompt,refusals=[];
 for(const family of ['sourceSearchContracts','semanticReviews','acceptedChanges']){
  const missing=engine.clone(p);
  missing.projectData[family]=family==='acceptedChanges'?missing.projectData[family].filter(row=>Number(row.stage)!==2):[];
  let error;try{prompts.buildPromptRecord(4,missing);}catch(caught){error=caught;}
  if(error?.code!=='STAGE4_UPSTREAM_INCOMPLETE')throw new Error('STAGE04_PROVENANCE_ORACLE: missing '+family+' was not refused');
  refusals.push({missing:family,code:error.code});
 }
 return {prompt:text,synthetic:true,actualProductionAcceptance:true,realHuman:false,realExternalActor:false,selectedFile:false,refusals};
}
export function stage04PromptProvenanceSource(){return stage04AcceptanceFixtureSource()+'\n'+stage04PromptProvenanceProbe.toString();}
