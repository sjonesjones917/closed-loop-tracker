import assert from 'node:assert/strict';
// Reuse the existing comparison owner's declared synthetic canonical fixture.
// Altered populations are adversarial state controls, not supported run commands.
export function verifyTenRunPopulation({fixture,engine,hash}){
 const f=fixture(),cases=[],base=engine.clone(f.p),initial=JSON.stringify(f.p);
 for(const count of [9,10,11]){
  const p=engine.clone(base),runs=engine.recordsForIteration(p,'runs',f.iterationId);assert.equal(runs.length,10,'TEN_RUN_POPULATION_SETUP_ORACLE');
  if(count===9){const removed=engine.recordId(runs.at(-1),'runs');p.projectData.runs=p.projectData.runs.filter(row=>engine.recordId(row,'runs')!==removed);p.projectData.verification=p.projectData.verification.filter(row=>engine.recordValue(row,'RUN_ID')!==removed);}
  if(count===11){
   const old=engine.recordId(runs.at(-1),'runs'),run=engine.clone(runs.at(-1)),id=engine.allocateId(p,'runs',engine.clone({commandId:'SYNTHETIC_ELEVENTH_RUN_POPULATION',targetSlot:'population-eleven',payload:{control:'one extra current run'}}));run.id=id;run.fields.RUN_ID=run.RUN_ID=id;run.scope.runId=id;engine.refreshRecordHashes(run,'runs');p.projectData.runs.push(run);
   for(const source of p.projectData.verification.filter(row=>engine.recordValue(row,'RUN_ID')===old)){const row=engine.clone(source),verificationId=engine.allocateId(p,'verification',engine.clone({commandId:'SYNTHETIC_ELEVENTH_VERIFICATION',targetSlot:'population-eleven',payload:{control:'extra run observation'}}));row.id=verificationId;row.fields.VERIFICATION_ID=row.VERIFICATION_ID=verificationId;row.fields.RUN_ID=row.RUN_ID=id;if(row.relationships?.RUN_ID)row.relationships.RUN_ID=id;row.scope.runId=id;engine.refreshRecordHashes(row,'verification');p.projectData.verification.push(row);}
  }
  const before=hash.sha256Value(p),comparisonBefore=hash.sha256Value(p.projectData.comparisons),model=engine.evaluateCrossRunComparison(p,f.iterationId,{stage:f.comparisonStage});
  assert.equal(hash.sha256Value(p),before,'TEN_RUN_COMPARISON_READ_ONLY_ORACLE:'+count);
  const gate=engine.gate(f.comparisonStage,p); // Gate renews its application-owned proof-obligation scope for the changed population.
  assert.equal(model.runIds.length,count,'TEN_RUN_POPULATION_ID_COUNT_ORACLE:'+count);
  assert.equal(model.complete,count===10,'TEN_RUN_POPULATION_COMPLETE_ORACLE:'+count+':'+JSON.stringify(model.reasons));
  assert.equal(gate.complete,count===10,'TEN_RUN_POPULATION_GATE_ORACLE:'+count+':'+JSON.stringify(gate.reasons));
  if(count!==10)assert.ok(model.reasons.includes('Cross-run comparison requires exactly ten current run identities; found '+count+'.'),'TEN_RUN_POPULATION_COUNT_REASON_ORACLE:'+count);
  else assert.deepEqual(Array.from(model.reasons),[],'TEN_RUN_POPULATION_VALID_CONTROL_ORACLE');
  assert.equal(model.facts[f.requirementId||'REQ-STAGE17'].ALL_TEN_SATISFIED,count===10,'TEN_RUN_POPULATION_ALL_TEN_ORACLE:'+count);
  assert.equal(hash.sha256Value(p.projectData.comparisons),comparisonBefore,'TEN_RUN_COMPARISON_RESULT_PRESERVATION_ORACLE:'+count);
  cases.push({caseId:'current-runs-'+count,expectedCount:count,observedCount:model.runIds.length,expectedComplete:count===10,modelComplete:model.complete,gateComplete:gate.complete,allTenSatisfied:model.facts[f.requirementId||'REQ-STAGE17'].ALL_TEN_SATISFIED,comparisonReadOnly:true,acceptedComparisonPreserved:true,gateMayRenewProofObligationScope:true,passed:true});
 }
 for(const count of [9,11]){const p=engine.clone(base),before=hash.sha256Value(p);assert.throws(()=>engine.reserveRunBatch(p,{stage:11,iterationId:f.iterationId,candidateId:p.job.CURRENT_CANDIDATE_ID,count}),error=>error.message==='Run batches must contain exactly ten slots.','TEN_RUN_RESERVATION_COUNT_ORACLE:'+count);assert.equal(hash.sha256Value(p),before,'TEN_RUN_RESERVATION_NO_MUTATION_ORACLE:'+count);cases.push({caseId:'reservation-refuses-'+count,count,refused:true,noMutation:true,passed:true});}
 const valid=engine.clone(base),before=hash.sha256Value(valid),reserved=engine.reserveRunBatch(valid,{stage:11,iterationId:f.iterationId,candidateId:valid.job.CURRENT_CANDIDATE_ID,count:10});assert.equal(reserved.length,10,'TEN_RUN_RESERVATION_VALID_ORACLE');assert.equal(hash.sha256Value(valid),before,'TEN_RUN_RESERVATION_RETRY_ORACLE');cases.push({caseId:'reservation-ten-idempotent',count:10,returnedCount:10,readOnly:true,passed:true});
 assert.equal(JSON.stringify(f.p),initial,'TEN_RUN_ORIGINAL_FIXTURE_PRESERVATION_ORACLE');
 return {tenRunPopulation:true,synthetic:true,actualExternalActor:false,actualBrowser:false,boundary:'Existing synthetic comparison fixture with production ten-slot allocator/freeze and reviewed proof setup; adversarial nine/eleven current-population copies test actual comparison/gate, not real executions or prior-stage completion.',cases,verificationObservations:[{checkId:'comparison.exact-ten-run-population',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:2742'],boundary:'Actual comparison and Stage13 gate refuse nine/eleven current run identities; ten passes. Reservation command refuses wrong counts and ten retry is idempotent.',expected:{populationCounts:[9,10,11],complete:[false,true,false],wrongReservationCounts:[9,11]},observed:{populationCounts:cases.slice(0,3).map(row=>row.observedCount),complete:cases.slice(0,3).map(row=>row.modelComplete),wrongReservationCounts:cases.filter(row=>row.refused).map(row=>row.count)},passed:true}]};
}

// Reuse the existing expected-variance owner's actual accepted-source/cold-read
// setup, stopping before its intentional reauthor invalidation. Earlier actors
// are retained fixture evidence; the new count populations remain synthetic.
export async function prepareTenRunPopulationFixture({sourceOverrides={}}={}){
 const [{projectStoreRuntime},{testIrAuthorPrerequisite},{canonicalFixtureRecord},fs]=await Promise.all([import('./test-project-store-runtime.mjs'),import('./test-test-ir-author-prerequisite.mjs'),import('./test-fixtures.mjs'),import('node:fs')]);
 const inputs=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'],sources=Object.fromEntries(inputs.map(n=>[n,sourceOverrides[n]??fs.readFileSync(n,'utf8')]));
 let r=projectStoreRuntime({sourceOverrides:sources,storageWorker:false});const retained=(await testIrAuthorPrerequisite(r)).p;
 const written=await r.store.writeProject(retained,{createOnly:true,expectedProjectRevision:0,incrementRevision:false}),rows=structuredClone(r.rows),clock=r.runtime.Date;
 const cold=projectStoreRuntime({sourceOverrides:sources,storageWorker:false});cold.runtime.Date=clock;for(const[name,values]of rows)cold.rows.set(name,structuredClone(values));r=cold;
 let p=await r.store.readProject(written.job.JOB_ID);const e=r.engine,h=r.runtime.closedLoopHash,s=r.runtime.closedLoopWorkflowSchema;
 assert.equal(e.gate(6,p).complete,true,'TEN_RUN_ADMITTED_VARIANCE_PREREQUISITE_ORACLE');
 const activation=p.projectData.history.filter(row=>row.type==='EXPECTED_VARIANCE_CONTRACTS_ACTIVATED');assert.equal(activation.length,1);assert.equal(activation[0].historicalFreezeClaimed,false);assert.equal(activation[0].sourceProjectSha256,written.projectSha256);
 const perRun=e.recordsForCurrentScope(p,'tests').filter(row=>e.recordValue(row,'PER_RUN_REQUIRED')===true);assert.equal(perRun.length,1,'TEN_RUN_EXISTING_PER_RUN_TEST_POPULATION_ORACLE');
 const test=perRun[0],testId=test.id,requirementId=e.recordValue(test,'REQ_ID');assert.equal(e.expectedVarianceContractState(p,test).complete,true,'TEN_RUN_VARIANCE_CARRIER_CURRENT_ORACLE');
 // Same disclosed gate-fixture boundary as the existing comparison owner:
 // Stages7–9 and later verification observations are synthetic setup only.
 for(let stage=7;stage<=12;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
 const blob=new Blob(['Synthetic ten-run count candidate\n']),artifactId=e.allocateId(p,'artifacts',r.copy({commandId:'TEN_RUN_COUNT_CANDIDATE',payload:{purpose:'count boundary fixture'}})),digest=await h.sha256Bytes(blob);
 await r.store.putArtifact({artifactId,jobId:p.job.JOB_ID,blob,filename:'count-candidate.txt',mediaType:'text/plain',expectedSha256:digest});await r.store.getArtifact(artifactId);
 e.registerArtifactBytes(p,r.copy({stage:10,artifactId,filename:'count-candidate.txt',mediaType:'text/plain',byteSize:blob.size,sha256:digest}));
 const decision=e.recordRegisteredHumanDecision(p,{stage:10,purpose:'CANDIDATE_COMPONENT_SELECTION',targetFamily:'artifacts',targetId:h.sha256Value(r.copy([artifactId])),value:r.copy([artifactId]),operatorLabel:'SYNTHETIC_TEN_RUN_COUNT_FIXTURE'}),frozen=e.freezeCandidate(p,{stage:10,artifactIds:r.copy([artifactId]),selectionDecisionId:decision.id,operatorLabel:'SYNTHETIC_TEN_RUN_COUNT_FIXTURE'}),iterationId=frozen.iteration.id,candidateId=frozen.candidate.id,scope=e.scopeForIteration(p,iterationId),slots=e.reserveRunBatch(p,{stage:11,iterationId,candidateId,count:10});
 const add=(family,fields,options={})=>canonicalFixtureRecord({engine:e,schema:s},p,family,r.copy(fields),{scope:r.copy(scope),...options});
 for(let index=0;index<slots.length;index++){
  const slot=slots[index],run=e.records(p,'runs').find(row=>row.id===slot.runId),generator=e.records(p,'freshContexts').find(row=>row.id===slot.contextId);
  generator.fields.EXTERNAL_CONTEXT_IDENTIFIER=generator.EXTERNAL_CONTEXT_IDENTIFIER='synthetic-count-generator-'+index;generator.fields.CONTAMINATION_STATUS=generator.CONTAMINATION_STATUS='NONE';generator.fields.AUTHORIZED_PROJECT_INPUTS=generator.AUTHORIZED_PROJECT_INPUTS=r.copy(['candidate']);e.refreshRecordHashes(generator,'freshContexts');run.fields.CONTAMINATION_CHECK=run.CONTAMINATION_CHECK='NONE';run.fields.EXECUTION_STATUS=run.EXECUTION_STATUS='COMPLETED';run.status='COMPLETED';e.refreshRecordHashes(run,'runs');
  const reviewer=add('freshContexts',{EXTERNAL_CONTEXT_IDENTIFIER:'synthetic-count-reviewer-'+index,ROLE:'Independent run verifier',ITERATION_ID:iterationId,RUN_ID:slot.runId,AUTHORIZED_PROJECT_INPUTS:['target run','target requirement','target test'],CONTAMINATION_STATUS:'NONE'},{stage:12,scope:r.copy({...scope,runId:slot.runId})});
  const evidence=add('evidenceRecords',{KIND:'REVIEW_NOTE',AUTHORITY_TYPE:'INDEPENDENT_REVIEWER',DESCRIPTION:'Synthetic count-control observation',CONTENT:'Synthetic run observation satisfies the retained test proposition.',STATUS:'PRESERVED'},{stage:12});
  const result=add('verification',{REQ_ID:requirementId,RUN_ID:slot.runId,TEST_ID:testId,VERIFIER_CONTEXT_ID:reviewer.id,OBSERVED_RESULT:'SATISFIED',EXPECTED_RESULT:'SATISFIED',DETERMINATION:'SATISFIED'},{stage:12,scope:r.copy({...scope,runId:slot.runId})});result.evidenceRefs=r.copy([evidence.id]);e.refreshRecordHashes(result,'verification');
 }
 const comparison=add('comparisons',{REQ_ID:requirementId,RUN_DETERMINATIONS:'Ten synthetic current observations SATISFIED.',INTERPRETATION_VARIANCE:'NONE',OUTPUT_VARIANCE:'NONE',AUTHORIZED_VARIANCE:'TRUE',INCONCLUSIVE_TESTS:'NONE',REPEATED_FAILURE_PATTERNS:'NONE',UNIQUE_FAILURES:'NONE',CORRECTNESS_AFFECTING_VARIANCE:'FALSE',DEFECT_IDS:'NONE',EVIDENCE:'Synthetic current ten-run count fixture; no external performance claim.'},{stage:13});
 p.projectData.acceptedChanges.push(r.copy({changeId:'SYNTHETIC_COUNT_COMPARISON_ACCEPTANCE',stage:13,status:'COMMITTED',responseType:'DATA_PROPOSAL',scope}));
 for(let stage=7;stage<=12;stage++){p.stages[stage].status='COMPLETE';p.stages[stage].gate={complete:true,blocked:false,reasons:[]};}
 return {p,iterationId,comparisonStage:13,comparison,test,requirementId,prerequisite:{actualAcceptedSourceColdActivation:true,historicalFreezeClaimed:false,archivedFixtureClockUtc:new r.runtime.Date().toISOString(),sourceProjectSha256:written.projectSha256,actualCandidateBlob:true,syntheticStages7Through12:true,syntheticRunVerification:true,actualExternalActor:false},engine:e,hash:h,runtime:r.runtime};
}
