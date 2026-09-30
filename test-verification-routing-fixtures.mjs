// Synthetic records and external reports; these do not assert a real external tool was verified.
export function routingFixture(mode='APPLICATION_DETERMINISTIC'){
 const engine=globalThis.closedLoopWorkflowEngine,core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema;
 const p=core.createBlankState('JOB-ROUTING-'+crypto.randomUUID());engine.ensureShape(p);p.activeStage=22;
 const add=(family,fields,stage)=>{const id=engine.allocateId(p,family),full={...fields,[schema.RECORD_SCHEMAS[family].idField]:id},row={id,active:true,stage,scope:engine.currentScope(p),fields:full,...full,source:'SYNTHETIC_ROUTING_FIXTURE'};engine.refreshRecordHashes(row,family);p.projectData[family].push(row);return row;};
 const product=add('products',{PRODUCT_VERSION:'PRODUCT-V1',STATUS:'COMPLETED'},21);product.completionState='COMPLETED';engine.refreshRecordHashes(product,'products');p.job.CURRENT_PRODUCT_ID=product.id;p.job.CURRENT_PRODUCT_VERSION='PRODUCT-V1';
 const requirement=add('requirements',{MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE',APPLICABILITY:'APPLICABLE'},5);
 const canonical=engine.canonicalTestBindingCatalog(p)['JOB.JOB_ID'];
 const test=add('tests',{REQ_ID:requirement.id,TEST_TYPE:'DETERMINISTIC',EXECUTION_MODE:mode,REQUIRED_CAPABILITY:mode==='APPLICATION_DETERMINISTIC'?'CLOSED_LOOP_TEST_IR':'CAD_TOOL',EXECUTABLE_KIND:mode==='APPLICATION_DETERMINISTIC'?'TEST_IR':'NONE',EXECUTABLE_SPEC_VERSION:'closed-loop-test-spec/1',EXECUTABLE_SPEC:{version:'closed-loop-test-spec/1',steps:[{op:'LOAD_ARTIFACT',binding:'JOB'},{op:'ASSERT_EQ',value:p.job.JOB_ID}]},EXECUTABLE_INPUT_BINDINGS:{JOB:{kind:'CANONICAL_VALUE',canonicalKey:'JOB.JOB_ID',valueSha256:canonical.valueSha256}},ARTIFACT_REQUIREMENTS:'NONE',TEST_PROPOSITION_TEXT:'The exact current project identity is preserved.',EVIDENCE_TO_PRESERVE:'A report of the exact observed project identity.',STATUS:'ACTIVE',VERIFICATION_PHASE:'FINAL_PRODUCT_DETERMINISTIC',EARLIEST_EXECUTABLE_STAGE:22,REQUIRED_BY_STAGE:22,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true,DELIVERY_REQUIRED:false,TARGET_AVAILABILITY_CONDITION:{type:'PHASE_TARGET'}},6);
 return {p,test,product,canonical};
}
export function completedReport(p,test){
 const engine=globalThis.closedLoopWorkflowEngine;
 const report=engine.externalCapabilityEvidenceTemplate(p,test.id);
 Object.assign(report,{reportedBy:'ISOLATED_FIXTURE_OPERATOR',environment:'Disposable verification sandbox',observedAt:new Date(Date.now()-60000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),action:{target:'Read-only disposable sandbox/project/'+p.job.JOB_ID,riskClasses:['READ_ONLY'],expectedEffect:'Observe the specified project identity',reversibility:'No mutation',maximumCost:'0',authority:'Fixture owner permits this exact read',containment:'Disposable isolated fixture only',stopCondition:'Stop on any unexpected target or missing access',responsibleActor:'ISOLATED_FIXTURE_OPERATOR'}});
 for(const [key,check] of Object.entries(report.checks))Object.assign(check,{status:'TRUE',evidence:'Synthetic observed '+key+' check for '+report.action.target+'; no real external service is being claimed.'});return report;
}
