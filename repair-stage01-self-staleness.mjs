import fs from 'node:fs';

function replaceOnce(file,oldText,newText){
  const text=fs.readFileSync(file,'utf8'),count=text.split(oldText).length-1;
  if(count!==1)throw new Error(`${file}: expected exactly one repair target, found ${count}.`);
  fs.writeFileSync(file,text.replace(oldText,newText));
}

replaceOnce('workflow-engine.js',
"  const stageOneSelected=new Set(safe(project.stages?.[1]?.authorizedFiles).map(item=>String(item?.artifactId||item?.id||'')).filter(Boolean));\n  const stageOneArtifacts=recordsForCurrentScope(project,'artifacts').filter(record=>Number(record?.stage||recordValue(record,'STAGE')||record?.lineage?.stage||0)===1||stageOneSelected.has(recordId(record,'artifacts')));",
"  const stageOneSelected=new Set(safe(project.stages?.[1]?.authorizedFiles).map(item=>String(item?.artifactId||item?.id||'')).filter(Boolean));\n  const stageOneArtifacts=recordsForCurrentScope(project,'artifacts').filter(record=>(Number(record?.stage||recordValue(record,'STAGE')||record?.lineage?.stage||0)===1||stageOneSelected.has(recordId(record,'artifacts')))&&upper(recordValue(record,'ROLE'))!=='RETURNED_ATTACHMENT');");

const oldAccountingStart=`function parseCapturedInputSet(stageOrProject){const stageOne=stageOrProject?.stages?.[1]||stageOrProject||{},raw=stageOne?.agentData?.INPUT_SET_CONTENTS??stageOne?.acceptedData?.INPUT_SET_CONTENTS??'';if(!String(raw||'').trim())return {format:'EMPTY',units:[],raw:''};try{const parsed=JSON.parse(String(raw));if(parsed&&typeof parsed==='object'&&Array.isArray(parsed.units))return {format:'STRUCTURED',...parsed,raw:String(raw)};}catch{}return {format:'LEGACY_TEXT',units:[],raw:String(raw)};}
function evaluateIntakeAccounting(project,{capture}={}){
  ensureShape(project);const manifest=intakeCoverageManifest(project),parsed=capture===undefined?parseCapturedInputSet(project):(()=>{try{const value=typeof capture==='string'?JSON.parse(capture):capture;return value&&typeof value==='object'&&Array.isArray(value.units)?{format:'STRUCTURED',...value}:{format:'INVALID',units:[]};}catch{return {format:'INVALID',units:[]};}})(),reasons=[];`;
const newAccountingStart=`function parseCapturedInputSet(stageOrProject){const stageOne=stageOrProject?.stages?.[1]||stageOrProject||{},raw=stageOne?.agentData?.INPUT_SET_CONTENTS??stageOne?.acceptedData?.INPUT_SET_CONTENTS??'';if(!String(raw||'').trim())return {format:'EMPTY',units:[],raw:''};try{const parsed=JSON.parse(String(raw));if(parsed&&typeof parsed==='object'&&Array.isArray(parsed.units))return {format:'STRUCTURED',...parsed,raw:String(raw)};}catch{}return {format:'LEGACY_TEXT',units:[],raw:String(raw)};}
function acceptedStageOneIntakeManifest(project,parsed,liveManifest){
  if(!parsed||parsed.format!=='STRUCTURED')return null;
  const latest=acceptedChanges(project,1).at(-1),currentInputVersion=String(project.job.CURRENT_INPUT_VERSION||'');
  if(!latest||!currentInputVersion||String(parsed.inputVersion||'')!==currentInputVersion)return null;
  const prompt=safe(project.projectData.generatedPrompts).find(record=>String(record?.instructionId||record?.promptId||'')===String(latest.promptId||'')&&!record?.invalidatedBy),bound=prompt?.contextManifest?.intakeCoverageManifest;
  if(!bound||String(bound.inputVersion||'')!==currentInputVersion||String(parsed.manifestSha256||'')!==String(bound.manifestSha256||''))return null;
  const boundById=new Map(safe(bound.units).map(unit=>[String(unit?.unitId||''),unit]).filter(([id])=>id)),liveById=new Map(safe(liveManifest?.units).map(unit=>[String(unit?.unitId||''),unit]).filter(([id])=>id));
  for(const [id,unit] of boundById){const current=liveById.get(id);if(!current||String(current.rawValueSha256||'')!==String(unit.rawValueSha256||'')||String(current.sourceLocation||'')!==String(unit.sourceLocation||''))return null;}
  const confirmationIds=new Set(safe(latest.humanAuthorityConfirmationIds).map(String).filter(Boolean)),allowedAnswerIds=new Set();
  for(const confirmationId of confirmationIds){const confirmation=safe(project.projectData.humanAuthorityConfirmations).find(item=>String(item?.confirmationId||'')===confirmationId&&!item?.invalidatedBy);if(!confirmation||upper(confirmation.status)!=='CONFIRMED_EXACT')return null;if(upper(confirmation.authorityClass)==='HUMAN'){const answerId=String(confirmation.resultingRecordId||''),answer=safe(project.projectData.humanInputAnswers).find(item=>String(item?.answerId||'')===answerId&&!item?.invalidatedBy);if(!answer||String(answer.inputVersion||'')!==currentInputVersion||JSON.stringify(answer.answer)!==JSON.stringify(confirmation.confirmedValue))return null;allowedAnswerIds.add(answerId);}}
  for(const [id,unit] of liveById){if(boundById.has(id))continue;if(String(unit.kind||'')!=='HUMAN_ANSWER'||!allowedAnswerIds.has(String(unit.answerId||'')))return null;}
  return bound;
}
function evaluateIntakeAccounting(project,{capture}={}){
  ensureShape(project);const parsed=capture===undefined?parseCapturedInputSet(project):(()=>{try{const value=typeof capture==='string'?JSON.parse(capture):capture;return value&&typeof value==='object'&&Array.isArray(value.units)?{format:'STRUCTURED',...value}:{format:'INVALID',units:[]};}catch{return {format:'INVALID',units:[]};}})(),liveManifest=intakeCoverageManifest(project),boundManifest=capture===undefined?acceptedStageOneIntakeManifest(project,parsed,liveManifest):null,manifest=boundManifest||liveManifest,reasons=[];`;
replaceOnce('workflow-engine.js',oldAccountingStart,newAccountingStart);

replaceOnce('.github/workflows/pages.yml',
"          node verify-stage01-intake-closure.mjs\n          node verify-one-time-intent-intake.mjs\n          node verify-zero-loss-accounting.mjs",
"          node verify-stage01-intake-closure.mjs\n          node verify-one-time-intent-intake.mjs\n          node verify-zero-loss-accounting.mjs\n          node verify-human-authority-roundtrip.mjs");

console.log('Applied Stage 01 atomic-confirmation intake accounting repair.');
