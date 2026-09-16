// Scope-boundary fixtures only: these records do not establish completed stages,
// real external outputs, or an operator journey. Production allocation and scope
// validation remain active; callers may omit a reference to test its allocation.
export function reservationScopeFixture({core,schema,engine},contract,{omitReferences=[],jobId='SYNTHETIC-SCOPE-'+contract.stage+'-'+contract.operation}={}){
  const project=core.createBlankState(jobId);engine.ensureShape(project);
  for(const key of Object.keys(project.job))if(key.startsWith('CURRENT_')&&key!=='CURRENT_INPUT_VERSION')project.job[key]=`SYNTHETIC-${key}`;
  const references={};
  for(const key of contract.scopeRequirements){
    const family=schema.SCOPE_REFERENCE_FAMILIES[key];if(!family||omitReferences.includes(key))continue;
    const definition=schema.RECORD_SCHEMAS[family],id=engine.allocateId(project,family),fields={[definition.idField]:id};
    if(key==='confirmationIterationId'){fields.PURPOSE='UNCHANGED_CONFIRMATION';fields.PREVIOUS_ITERATION_ID=references.sourceConvergedIterationId||references.iterationId||id;}
    const row={id,stage:Math.min(contract.stage,definition.stage),active:true,fields,...fields,source:'SYNTHETIC_SCOPE_FIXTURE'};
    if(family==='products'&&contract.scope.dimensions[key]==='INPUT_CURRENT')row.completionState='COMPLETED';
    engine.refreshRecordHashes(row,family);project.projectData[family].push(row);references[key]=id;
  }
  return {project,scope:engine.operationScope(project,contract.stage,contract.operation,references,{reserveTargets:true})};
}
