from pathlib import Path

engine = Path('workflow-engine.js')
text = engine.read_text()
old_versions = """const VERSION_BY_STAGE=Object.freeze({
  1:['CURRENT_INPUT_VERSION','INPUT'],2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],
  4:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],6:['CURRENT_TEST_SUITE_VERSION','TEST-SUITE'],
  7:['CURRENT_MUTATION_SUITE_VERSION','MUTATION-SUITE'],8:['CURRENT_INSTRUCTION_VERSION','INSTRUCTION']
});
"""
new_versions = """const VERSION_BY_STAGE=Object.freeze({
  2:['CURRENT_SOURCE_SET_VERSION','SOURCE-SET'],3:['CURRENT_RESEARCH_VERSION','RESEARCH'],
  4:['CURRENT_REQUIREMENTS_VERSION','REQUIREMENTS'],6:['CURRENT_TEST_SUITE_VERSION','TEST-SUITE'],
  7:['CURRENT_MUTATION_SUITE_VERSION','MUTATION-SUITE'],8:['CURRENT_INSTRUCTION_VERSION','INSTRUCTION']
});
"""
if old_versions not in text:
    raise SystemExit('Expected Stage 01 version registry entry not found; refusing ambiguous repair.')
text = text.replace(old_versions, new_versions, 1)
old_obligations = """  const obligationClasses=new Set(['FACT_AFFECTING_REQUIREMENTS','REQUIREMENT','CONSTRAINT','DECISION','PROHIBITION','REQUESTED_OUTPUT','ACCEPTANCE_CONDITION','UNRESOLVED_HUMAN_ONLY']);
  for(const statement of intake.capturedStatements||[]){if(!obligationClasses.has(statement.statementClass)||statement.disposition==='INAPPLICABLE'||statement.disposition==='RETAINED_CONTEXT')continue;add(statement.text,'STAGE01_CAPTURED_HUMAN_AUTHORITY',{statementId:statement.statementId,sourceUnitId:statement.sourceUnitId,statementKey:statement.statementKey,inputVersion,status:statement.status||null});}
"""
new_obligations = """  for(const statement of intake.capturedStatements||[]){
    if(statement.disposition==='INAPPLICABLE')continue;
    add(statement.text,'STAGE01_CAPTURED_HUMAN_AUTHORITY',{statementId:statement.statementId,sourceUnitId:statement.sourceUnitId,statementKey:statement.statementKey,statementClass:statement.statementClass,stage01Disposition:statement.disposition,inputVersion,status:statement.status||null});
  }
"""
if old_obligations not in text:
    raise SystemExit('Expected Stage 04 filtering block not found; refusing ambiguous repair.')
engine.write_text(text.replace(old_obligations, new_obligations, 1))

test = Path('verify-intake-obligation-accounting.mjs')
text = test.read_text()
old_prompt1 = "const prompt1=prompts.buildPromptRecord(1,p),envelope=(capture)=>"
new_prompt1 = "const prompt1=prompts.buildPromptRecord(1,p);p.projectData.generatedPrompts.push(prompt1);const envelope=(capture)=>"
if old_prompt1 not in text:
    raise SystemExit('Expected Stage 01 prompt fixture block not found.')
text = text.replace(old_prompt1, new_prompt1, 1)
old_stage1 = """prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(captureFor(intake.units))),promptRecord:prompt1});assert(prepared.validation.valid,JSON.stringify(prepared.validation.issues));p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'ACCOUNTING_TEST'}).project;engine.recordStageConfirmation(p,1,true,'Captured human authority confirmed','ACCOUNTING_TEST',{acceptedChangeId:p.projectData.acceptedChanges.at(-1).changeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId:prompt1.instructionId,contextSignature:prompt1.contextSignature,operatorLabel:'ACCOUNTING_TEST'});engine.recalculate(p);assert(engine.evaluateIntakeCoverage(p).complete&&engine.evaluateIntakeCoverage(p).coverage===1,'Complete Stage 01 capture did not close accounting.');
"""
new_stage1 = """prepared=ingestion.prepare(p,{stage:1,text:JSON.stringify(envelope(captureFor(intake.units))),promptRecord:prompt1});assert(prepared.validation.valid,JSON.stringify(prepared.validation.issues));const acceptedInputVersion=p.job.CURRENT_INPUT_VERSION;p=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'ACCOUNTING_TEST'}).project;assert.equal(p.job.CURRENT_INPUT_VERSION,acceptedInputVersion,'Accepting Stage 01 agent output changed the human-owned input version.');engine.recordStageConfirmation(p,1,true,'Captured human authority confirmed','ACCOUNTING_TEST',{acceptedChangeId:p.projectData.acceptedChanges.at(-1).changeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId:prompt1.instructionId,contextSignature:prompt1.contextSignature,operatorLabel:'ACCOUNTING_TEST'});engine.recalculate(p);const stage1Accounting=engine.evaluateIntakeCoverage(p);assert(stage1Accounting.complete&&stage1Accounting.coverage===1,JSON.stringify(stage1Accounting.errors));
"""
if old_stage1 not in text:
    raise SystemExit('Expected Stage 01 acceptance fixture block not found.')
text = text.replace(old_stage1, new_stage1, 1)
old_stage4 = """const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4=prompts.buildPromptRecord(4,p);assert(prompt4.prompt.includes('APPLICATION OBLIGATION MANIFEST')&&prompt4.prompt.includes(obligations.items[0].obligationId),'Stage 04 prompt omitted the application obligation manifest.');assert(!/attach or provide the original material with the Stage 04 instruction/i.test(prompt4.prompt),'Stage 04 prompt still requires the original intent file.');const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});assert(handoff.conversationMaterials.length===0&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');
"""
new_stage4 = """const intakeAccounting=engine.evaluateIntakeCoverage(p);const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');for(const statement of intakeAccounting.capturedStatements.filter(statement=>statement.disposition!=='INAPPLICABLE')){const item=obligations.items.find(candidate=>candidate.provenance?.statementId===statement.statementId);assert(item,'Stage 04 silently discarded Stage 01 statement '+statement.statementId+'.');assert.equal(item.provenance.statementClass,statement.statementClass,'Stage 04 lost the original Stage 01 semantic class.');assert.equal(item.provenance.stage01Disposition,statement.disposition,'Stage 04 lost the original Stage 01 disposition.');}const retained=intakeAccounting.capturedStatements.find(statement=>statement.disposition==='RETAINED_CONTEXT');assert(retained&&obligations.items.some(item=>item.provenance?.statementId===retained.statementId),'Stage 04 silently discarded retained Stage 01 project context.');const prompt4=prompts.buildPromptRecord(4,p);p.projectData.generatedPrompts.push(prompt4);assert(prompt4.prompt.includes('APPLICATION OBLIGATION MANIFEST')&&prompt4.prompt.includes(obligations.items[0].obligationId),'Stage 04 prompt omitted the application obligation manifest.');assert(prompt4.prompt.includes(retained.statementId)&&prompt4.prompt.includes(retained.text),'Stage 04 prompt omitted retained Stage 01 project context.');assert(!/attach or provide the original material with the Stage 04 instruction/i.test(prompt4.prompt),'Stage 04 prompt still requires the original intent file.');const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});assert(handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');
"""
if old_stage4 not in text:
    raise SystemExit('Expected Stage 04 accounting fixture block not found.')
test.write_text(text.replace(old_stage4, new_stage4, 1))
