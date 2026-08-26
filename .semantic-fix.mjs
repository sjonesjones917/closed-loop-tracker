import fs from 'node:fs';

function replaceOnce(file,from,to){
  const text=fs.readFileSync(file,'utf8');
  const count=text.split(from).length-1;
  if(count!==1)throw new Error(`${file}: expected exactly one match, found ${count}`);
  fs.writeFileSync(file,text.replace(from,to));
}
function appendOnce(file,marker,text){
  const source=fs.readFileSync(file,'utf8');
  if(source.includes(marker))return;
  fs.writeFileSync(file,`${source.trimEnd()}\n\n${text.trim()}\n`);
}

// 1. Operator review/refinement must stay in the selected operation/run/context lane.
replaceOnce('app-core.js',
`function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}\nfunction promptMatches(record,n,options){`,
`function promptOptions(n){const operation=selectedOperation(n),options={operation},requiresRun=(schema.operationContract(n,operation)?.scopeRequirements||[]).includes('runId');if(requiresRun){const run=selectedRun(n);if(run){const runId=engine.recordId(run,'runs'),contextId=String(recordValue(run,'CONTEXT_ID')||run.relationships?.CONTEXT_ID||run.scope?.contextId||'');options.scope={runId,contextId};}}return options;}\nconst semanticScopeKeys=['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'];\nfunction currentOperatorScope(n){const j=current.job||{},options=promptOptions(n),candidate=engine.records(current,'candidateFreezes').filter(x=>x?.active!==false&&!x?.invalidatedBy).at(-1);return {inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:j.CURRENT_ITERATION||null,candidateId:candidate?engine.recordId(candidate,'candidateFreezes'):null,runId:options.scope?.runId||null,contextId:options.scope?.contextId||null,baselineId:j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null,productId:j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null};}\nfunction operatorLaneMatches(item,n){if(Number(item?.stage)!==Number(n))return false;const operation=String(item?.envelope?.operation||item?.operation||'COMPLETE'),selected=selectedOperation(n);if(operation!==selected)return false;const actual=item?.envelope?.scope||item?.scope||{},expected=currentOperatorScope(n),required=schema.operationContract(n,operation)?.scopeRequirements||[];for(const key of semanticScopeKeys){const a=actual?.[key],e=expected?.[key];if(a!==undefined&&a!==null&&a!==''&&e!==undefined&&e!==null&&e!==''&&String(a)!==String(e))return false;}for(const key of required){if(key==='projectRevision')continue;if(String(actual?.[key]??'')!==String(expected?.[key]??''))return false;}return true;}\nfunction validationLaneRecord(validation){return safe(current.projectData.generatedPrompts).find(x=>(x.instructionId||x.promptId)===validation?.promptId)||validation;}\nfunction acceptedLaneChanges(n){return engine.acceptedChanges(current,n).filter(x=>operatorLaneMatches(x,n));}\nfunction promptMatches(record,n,options){`);
replaceOnce('app-core.js',
`function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n).at(-1);if(!v||v.valid)return '';`,
`function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n&&!x.valid&&operatorLaneMatches(validationLaneRecord(x),n)).at(-1);if(!v)return '';`);
replaceOnce('app-core.js',
`function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===n&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);`,
`function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);`);
replaceOnce('app-core.js',
`${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?`,
`${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?`);
replaceOnce('app-core.js',
`function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===current.activeStage&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);}`,
`function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage)).at(-1);}`);
replaceOnce('app-core.js',
`const next=clone(current),change=engine.acceptedChanges(next,current.activeStage).at(-1);if(!change)throw new Error('No current accepted response exists to refine.');`,
`const next=clone(current),change=acceptedLaneChanges(current.activeStage).at(-1);if(!change)throw new Error('No accepted response exists in the selected operation/run lane to refine.');`);

// 2. Legacy promotion must be strict, canonical, and all-or-nothing.
replaceOnce('project-store.js',
`function parseLegacy(storage=globalThis.localStorage){const out=[],seen=new Set();if(!storage)return out;for(const key of LEGACY_KEYS){let raw=null;try{raw=storage.getItem(key);}catch{}if(!raw)continue;try{const parsed=JSON.parse(raw);for(const item of Array.isArray(parsed)?parsed:[parsed]){if(!item||typeof item!=='object')continue;const id=projectIdentity(item)||hash.sha256Value(item);if(seen.has(id))continue;seen.add(id);out.push(item);}}catch{}}return out;}\nfunction readAllLegacy(storage){return parseLegacy(storage);}`,
`function parseLegacy(storage=globalThis.localStorage){const out=[],seen=new Set();if(!storage)return out;for(const key of LEGACY_KEYS){let raw=null;try{raw=storage.getItem(key);}catch{}if(!raw)continue;try{const parsed=JSON.parse(raw);for(const item of Array.isArray(parsed)?parsed:[parsed]){if(!item||typeof item!=='object')continue;const id=projectIdentity(item)||hash.sha256Value(item);if(seen.has(id))continue;seen.add(id);out.push(item);}}catch{}}return out;}\nfunction parseLegacyForMigration(storage=globalThis.localStorage){const out=[],seen=new Set();if(!storage)return out;for(const key of LEGACY_KEYS){let raw;try{raw=storage.getItem(key);}catch(error){throw storageError(\`Legacy project storage ${key} could not be read; original data was preserved.\`,'LEGACY_STORAGE_READ_FAILED');}if(!raw)continue;let parsed;try{parsed=JSON.parse(raw);}catch(error){throw storageError(\`Legacy project storage ${key} is malformed; original data was preserved.\`,'LEGACY_PROJECT_PARSE_FAILED');}for(const item of Array.isArray(parsed)?parsed:[parsed]){if(!item||typeof item!=='object'||Array.isArray(item))throw storageError(\`Legacy project storage ${key} contains a non-project value; original data was preserved.\`,'LEGACY_PROJECT_INVALID');const identity=projectIdentity(item)||hash.sha256Value(item);if(seen.has(identity))continue;seen.add(identity);out.push(item);}}return out;}\nfunction canonicalizeLegacyProject(source){const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine;if(!core?.migrateState||!engine?.ensureShape||!engine?.recalculate)throw storageError('Legacy migration runtime is incomplete; original data was preserved.','LEGACY_MIGRATION_RUNTIME_MISSING');const project=core.migrateState(clone(source));engine.ensureShape(project);engine.recalculate(project);if(!projectIdentity(project))throw storageError('Legacy project has no JOB_ID; original data was preserved.','LEGACY_PROJECT_ID_MISSING');assertProjectIntegrity(project);return project;}\nfunction readAllLegacy(storage){return parseLegacy(storage);}`);
replaceOnce('project-store.js',
`const legacy=parseLegacy();if(!legacy.length){await metaPut('migrationStatus',{status:'NONE',at:now()});return {migrated:0};}\n  const tx=db.transaction([PROJECTS,META],'readwrite');let migrated=0;\n  try{fault('before-legacy-migration');for(const source of legacy){const project=clone(source);const id=projectIdentity(project);if(!id)continue;const revision=Number(project.revision||0);tx.objectStore(PROJECTS).put({jobId:id,revision,project,projectSha256:projectSha256(project),updatedAt:now()});migrated++;}`,
`let legacy;try{legacy=parseLegacyForMigration();}catch(error){await metaPut('migrationStatus',{status:'FAILED',message:String(error.message||error),originalPreserved:true,at:now()});throw error;}if(!legacy.length){await metaPut('migrationStatus',{status:'NONE',at:now()});return {migrated:0};}\n  const tx=db.transaction([PROJECTS,META],'readwrite');let migrated=0;\n  try{fault('before-legacy-migration');for(const source of legacy){const project=canonicalizeLegacyProject(source),id=projectIdentity(project),revision=Number(project.revision||0);tx.objectStore(PROJECTS).put({jobId:id,revision,project,projectSha256:projectSha256(project),updatedAt:now()});migrated++;}`);
replaceOnce('project-store.js',
`STORE_KEY,LEGACY_KEYS,clone,projectIdentity,projectSha256,validateProjectIntegrity,openDatabase,ready,readAll,`,
`STORE_KEY,LEGACY_KEYS,clone,projectIdentity,projectSha256,validateProjectIntegrity,canonicalizeLegacyProject,openDatabase,ready,readAll,`);

// 3. Prompt language must agree with source-role and preflight gates.
for(const pair of [
  ['If no legitimate external authority applies after evidence-supported inspection','If no legitimate independent external source or evidence applies after evidence-supported inspection'],
  ['If no legitimate external governing source applies','If no legitimate independent external source or evidence applies'],
  ['in an independent context where required.','in an independent context.']
])replaceOnce('prompt-engine.js',pair[0],pair[1]);

appendOnce('verify-prompt-semantics.mjs','FINAL_SEMANTIC_EDGE_PROMPT_ASSERTIONS',`
// FINAL_SEMANTIC_EDGE_PROMPT_ASSERTIONS
{
 const stage2=prompts.buildPromptRecord(2,baseProject(),{operation:'COMPLETE'}).prompt;
 if(stage2.includes('If no legitimate external authority applies')||stage2.includes('If no legitimate external governing source applies'))throw new Error('Stage 02 still conflates absence of governing authority with absence of legitimate external evidence.');
 if(!stage2.includes('If no legitimate independent external source or evidence applies'))throw new Error('Stage 02 no-source path is not tied to absence of legitimate independent source/evidence.');
 const stage9=prompts.buildPromptRecord(9,baseProject(),{operation:'COMPLETE'}).prompt;
 if(stage9.includes('independent context where required'))throw new Error('Stage 09 prompt makes mandatory independence conditional.');
 if(!stage9.includes('in an independent context.'))throw new Error('Stage 09 prompt does not require independent preflight context.');
}
`);
appendOnce('verify.mjs','FINAL_SEMANTIC_EDGE_RUNTIME_ASSERTIONS',`
// FINAL_SEMANTIC_EDGE_RUNTIME_ASSERTIONS
{
 const legacy=core.createBlankState('JOB-LEGACY-CANONICAL');legacy.schema='human-project/30';legacy.projectData.stageRecords={1:{status:'COMPLETE',note:'historical'}};
 const canonical=store.canonicalizeLegacyProject(legacy);
 if(canonical.schema!==core.PROJECT_SCHEMA||canonical.workflow!==core.WORKFLOW_ID||canonical.stageCount!==30)throw new Error('Legacy canonicalization did not produce the current project identity.');
 if(canonical.projectData.stageRecords)throw new Error('Legacy stageRecords remained operational after canonicalization.');
 if(!canonical.projectData.migrationArchives?.some(x=>x.kind==='MIGRATION_SOURCE'))throw new Error('Legacy migration did not preserve its original payload.');
 const noId=core.createBlankState('JOB-REMOVE-ME');noId.schema='human-project/30';delete noId.job.JOB_ID;let rejected=false;try{store.canonicalizeLegacyProject(noId);}catch{rejected=true;}if(!rejected)throw new Error('Legacy migration accepted a project without JOB_ID.');
 const storeSource=fs.readFileSync('project-store.js','utf8');if(!storeSource.includes('parseLegacyForMigration')||!storeSource.includes('LEGACY_PROJECT_PARSE_FAILED'))throw new Error('Production legacy migration does not fail closed on malformed JSON.');
 const appSource=fs.readFileSync('app-core.js','utf8');for(const token of ['function operatorLaneMatches','operatorLaneMatches(validationLaneRecord(x),n)','operatorLaneMatches(x,n)','acceptedLaneChanges(current.activeStage)'])if(!appSource.includes(token))throw new Error(\`Operator review/refinement is not lane-bound: ${token}\`);
}
`);

console.log('Applied final semantic edge corrections.');
