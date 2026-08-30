from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def once(text,old,new,label):
    count=text.count(old)
    if count!=1: raise RuntimeError(f'{label}: expected one match, found {count}')
    return text.replace(old,new,1)
def run(*args): subprocess.run(args,cwd=ROOT,check=True)

# 1. Stage 03 is not complete merely because each source has one research row.
# It must also close the required second conflict/exception pass and saturation.
p='workflow-engine.js';s=read(p)
old="""    case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length){if(!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');break;}
      requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);break;
    }
    case 4:{
"""
new="""    case 3:{
      requireAccepted();const sourceIds=recordsForCurrentScope(project,'sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(!sourceIds.length){if(!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');break;}
      requireCount('research',1);const researched=new Set(recordsForCurrentScope(project,'research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);
      const researchData=project.stages[3]?.agentData||{};
      if(!truth(researchData.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED))reasons.push('Stage 03 has not established that all known controlling sources were examined.');
      if(!truth(researchData.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 second conflict and exception pass is incomplete.');
      if(numeric(researchData.LATEST_PASS_NUMBER)<2)reasons.push('Stage 03 requires a completed second conflict and exception pass.');
      if(!falsey(researchData.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS))reasons.push('Stage 03 is not exhausted because the latest pass still found new material.');
      break;
    }
    case 4:{
      if(project.stages?.[1]?.status!=='COMPLETE')reasons.push('Stage 04 requires exhausted Stage 01 human-authority intake.');
      if(project.stages?.[3]?.status!=='COMPLETE')reasons.push('Stage 04 requires exhausted Stage 03 source research.');
"""
s=once(s,old,new,'Stage 03/04 deterministic gate')
write(p,s)

# 2. Permanent prompt/gate regression proves an incomplete Stage 03 cannot pass the
# deterministic stage gate and cannot generate Stage 04.
p='verify-user-prompt-invariants.mjs';s=read(p)
old="""p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE',EXCEPTIONS_AND_EDGE_CONDITIONS:'STAGE3-STAGEDATA-SENTINEL'};p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
const r4=prompts.buildPromptRecord(4,p,{scope:{sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'}});
"""
new="""p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE',EXCEPTIONS_AND_EDGE_CONDITIONS:'STAGE3-STAGEDATA-SENTINEL'};p.stages[3].status='COMPLETE';p.stages[3].gate={complete:true,blocked:false,reasons:[]};
const r4=prompts.buildPromptRecord(4,p,{scope:{sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'}});
"""
s=once(s,old,new,'positive Stage 03 exhaustion fixture')
anchor="""const bad3=project();closeStage1(bad3);bad3.stages[2].status='COMPLETE';bad3.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='NO_APPLICABLE_EXTERNAL_SOURCE';blocked=false;try{prompts.buildPromptRecord(4,bad3,{scope:{sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'}});}catch(e){blocked=e.code==='STAGE4_UPSTREAM_INCOMPLETE';}assert(blocked,'Stage 04 generated while Stage 03 was incomplete.');
"""
insert=anchor+"""const unsaturated=project();closeStage1(unsaturated);unsaturated.stages[2].status='COMPLETE';unsaturated.stages[2].agentData.SOURCE_APPLICABILITY_DETERMINATION='APPLICABLE_SOURCES_ESTABLISHED';unsaturated.projectData.sources=[{id:'SOURCE-UNSAT',active:true,stage:2,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{SOURCE_ID:'SOURCE-UNSAT',TITLE:'Unsaturated source'}}];unsaturated.projectData.research=[{id:'RESEARCH-UNSAT',active:true,stage:3,scope:{inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'},fields:{RESEARCH_ID:'RESEARCH-UNSAT',SOURCE_ID:'SOURCE-UNSAT',PASS_NUMBER:1,EXACT_PORTION_EXAMINED:'fixture',FINDING_CLASSIFICATION:'fixture',SOURCE_EVIDENCE:'fixture'},relationships:{SOURCE_ID:'SOURCE-UNSAT'}}];unsaturated.projectData.acceptedChanges.push({changeId:'CHANGE-UNSAT',stage:3,status:'COMMITTED',responseType:'DATA_PROPOSAL'});unsaturated.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:'TRUE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'FALSE',LATEST_PASS_NUMBER:1,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'TRUE'};const unsatGate=engine.gate(3,unsaturated);assert(!unsatGate.complete&&unsatGate.reasons.some(x=>/second conflict and exception pass|latest pass still found new material/i.test(x)),'Stage 03 gate accepted unsaturated research.');unsaturated.stages[3].status='COMPLETE';unsaturated.stages[3].gate={complete:true,blocked:false,reasons:[]};blocked=false;try{prompts.buildPromptRecord(4,unsaturated,{scope:{sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001'}});}catch(e){blocked=e.code==='STAGE4_UPSTREAM_INCOMPLETE';}assert(blocked,'Stage 04 prompt generated from unsaturated Stage 03 research.');
"""
s=once(s,anchor,insert,'Stage 03 negative exhaustion regression')
write(p,s)

# 3. Remove stale browser expectations for the discarded intentStatements workaround.
# Verify the spec-compliant retained Stage 01 authority instead: exact user input,
# accepted Stage 01 data, and the application-generated intake manifest.
p='verify-browser.mjs';s=read(p)
old="""let retained=await activeProject(cdp);assert(retained.job.JOB_ID==='JOB-20260823144121','Wrong retained JOB_ID.');assert(retained.stages['1'].status==='COMPLETE'&&retained.job.CURRENT_STAGE==='STAGE 02','Retained Stage 01/02 state is wrong.');const migratedIntent=retained.projectData.intentStatements||[];assert(migratedIntent.length>0,'Legacy Stage 01 human authority was not migrated into the canonical intent ledger.');assert(migratedIntent.every(r=>r.scope?.inputVersion===retained.job.CURRENT_INPUT_VERSION),'Migrated intent statement scope does not match the current input version.');assert(migratedIntent.some(r=>(r.fields?.EXACT_STATEMENT||r.EXACT_STATEMENT)===retained.job.EXACT_USER_OBJECTIVE_VERBATIM),'Exact legacy user objective is missing from the canonical intent ledger.');assert((retained.projectData.sources||[]).length===0,'Stage 02 sources were fabricated on clean load.');
"""
new="""let retained=await activeProject(cdp);assert(retained.job.JOB_ID==='JOB-20260823144121','Wrong retained JOB_ID.');assert(retained.stages['1'].status==='COMPLETE'&&retained.job.CURRENT_STAGE==='STAGE 02','Retained Stage 01/02 state is wrong.');assert(String(retained.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim().length>0,'Exact legacy user objective was not preserved as human authority.');assert(String(retained.stages['1']?.agentData?.INPUT_SET_CONTENTS||retained.stages['1']?.acceptedData?.INPUT_SET_CONTENTS||'').trim().length>0,'Legacy Stage 01 accepted input-set capture was not preserved.');const intakeProof=await evalValue(cdp,`(()=>{const p=globalThis.closedLoopPromptEngine.buildPromptRecord(1,${JSON.stringify(retained)});const m=p.contextManifest?.intakeCoverageManifest;return {inputVersion:m?.inputVersion,unitCount:m?.unitCount||0,hasObjective:(m?.units||[]).some(u=>u.sourceLocation==='job.EXACT_USER_OBJECTIVE_VERBATIM')};})()`);assert(intakeProof&&intakeProof.inputVersion===retained.job.CURRENT_INPUT_VERSION&&intakeProof.unitCount>0&&intakeProof.hasObjective,'Application-owned Stage 01 intake manifest did not preserve current human-authority identity.');assert((retained.projectData.sources||[]).length===0,'Stage 02 sources were fabricated on clean load.');
"""
s=once(s,old,new,'browser legacy intent ledger assertion')
s=s.replace("'closed-loop-stage-response/2'","'closed-loop-stage-response/3'")
write(p,s)

# Proof current source before publishing.
for f in ['workflow-engine.js','verify-user-prompt-invariants.mjs','verify-browser.mjs']:
    run('node','--check',f)
run('node','verify-user-prompt-invariants.mjs')
run('git','add','workflow-engine.js','verify-user-prompt-invariants.mjs','verify-browser.mjs')
run('git','diff','--cached','--check')
run('git','commit','-m','Require exhausted Stage 3 research before Stage 4')
