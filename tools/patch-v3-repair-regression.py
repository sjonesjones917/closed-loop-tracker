from pathlib import Path
p=Path('tools/apply-v3-current.py')
s=p.read_text(encoding='utf-8')
anchor="# Proofs must pass before the source commit is published.\n"
if s.count(anchor)!=1:
    raise SystemExit('proof anchor missing')
block=r'''# Permanent regression: prove Stage 04 fails closed before Stage 01/03 exhaustion,
# then prove the same captured input is automatically present once both are exhausted.
p = 'verify-capture-once.mjs'
s = read(p)
old = """p.stages[1].acceptedData=p.stages[1].agentData;p.stages[1].status='COMPLETE';
p.stages[2].status='COMPLETE';p.stages[3].status='COMPLETE';
engine.recalculate(p);
const obligations=engine.currentObligationManifest(p);
"""
new = """p.stages[1].acceptedData=p.stages[1].agentData;
let blockedBeforeIntake=false;try{prompt.buildPromptRecord(4,p,{operation:'COMPLETE'});}catch(error){blockedBeforeIntake=/Stage 01 human-authority intake is not exhausted/.test(String(error?.message||error));}
assert(blockedBeforeIntake,'Stage 04 prompt generation did not fail closed before Stage 01 exhaustion');
const stage1ChangeId='CHANGE-STAGE1-CAPTURE-ONCE';
p.projectData.acceptedChanges.push({changeId:stage1ChangeId,stage:1,status:'COMMITTED',responseType:'DATA_PROPOSAL'});
p.projectData.stageConfirmations.push({confirmationId:'CONFIRM-STAGE1-CAPTURE-ONCE',stage:1,confirmed:true,acceptedChangeId:stage1ChangeId,inputVersion:p.job.CURRENT_INPUT_VERSION});
p.stages[1].status='COMPLETE';
const stage2ProposalId='PROPOSAL-STAGE2-NO-SOURCE';
p.projectData.responseProposals.push({proposalId:stage2ProposalId,stage:2,evidence:[{temporaryKey:'e-stage2-no-source',kind:'SOURCE_RESEARCH',description:'No applicable external authority exists for this fixture.',authorityType:'EXTERNAL_AGENT_RESPONSE',location:'fixture',content:'Evidence-supported no-applicable-source determination.'}]});
p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE2-CAPTURE-ONCE',stage:2,status:'COMMITTED',responseType:'DATA_PROPOSAL',proposalId:stage2ProposalId});
p.stages[2].status='COMPLETE';p.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE'};
let blockedBeforeResearch=false;try{prompt.buildPromptRecord(4,p,{operation:'COMPLETE'});}catch(error){blockedBeforeResearch=/Stage 03 source research is not exhausted/.test(String(error?.message||error));}
assert(blockedBeforeResearch,'Stage 04 prompt generation did not fail closed before Stage 03 exhaustion');
p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE3-CAPTURE-ONCE',stage:3,status:'COMMITTED',responseType:'DATA_PROPOSAL'});
p.stages[3].status='COMPLETE';p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false};
engine.recalculate(p);
assert(engine.stage01Exhausted(p),'Stage 01 exhaustion evaluator rejected complete canonical intake accounting');
assert(engine.stage03Exhausted(p),'Stage 03 exhaustion evaluator rejected valid no-applicable-source completion');
assert(engine.stage04InputReadiness(p).ready,'Stage 04 readiness did not open after Stage 01 and Stage 03 exhaustion');
const obligations=engine.currentObligationManifest(p);
"""
if s.count(old)!=1:
    raise RuntimeError('capture-once fixture anchor missing')
s=s.replace(old,new,1)
write(p,s)

'''
s=s.replace(anchor,block+anchor,1)
p.write_text(s,encoding='utf-8')
