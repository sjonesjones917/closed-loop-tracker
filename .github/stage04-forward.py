from pathlib import Path
import re

engine_path = Path('workflow-engine.js')
engine = engine_path.read_text()
anchor = "if(stage===16){const correction=stage16CorrectionPlan(project);return correction.heading+'. '+correction.explanation;}"
insertion = anchor + "if(stage===4)return 'Compile atomic requirements from the accepted current-scope Stage 03 research and current User Job Input. No new file upload is required for Stage 04. If accepted research is insufficient to establish an obligation, identify the exact upstream research gap instead of inferring facts from a filename or asking the human to transcribe the file.';"
if engine.count(anchor) != 1:
    raise SystemExit('workflow-engine.js Stage 16 operational-action anchor is not unique')
if 'No new file upload is required for Stage 04.' in engine:
    raise SystemExit('workflow-engine.js already contains the intended Stage 04 action')
engine = engine.replace(anchor, insertion, 1)
engine_path.write_text(engine)

prompt_path = Path('prompt-engine.js')
prompt = prompt_path.read_text()
if "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/21';" not in prompt:
    raise SystemExit('Unexpected prompt-engine version; refusing an unanchored edit')
prompt = prompt.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/21';", "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/23';", 1)
start = prompt.index("\n4:'Compile atomic requirement proposals")
end = prompt.index("\n5:'Resolve the current job", start)
stage4 = "\n4:'Compile atomic requirement proposals for this current job from the accepted current-scope Stage 03 research and candidate-requirement records supplied in AUTHORIZED BOUNDED CONTEXT, together with current authorized User Job Input, preserving provenance for each obligation. Stage 04 compiles accepted canonical context; it does not reopen source inspection and it does not require the operator to upload a named supplied material again merely because its filename appears in SUPPLIED_MATERIALS_INVENTORY. Never infer substantive facts from a filename or metadata. If accepted Stage 03 research did not inspect material needed to establish an obligation, return BLOCKED with INADEQUATE_PRIOR_OUTPUT and identify the exact upstream research gap instead of inventing a requirement or asking the human to transcribe the file. Each proposed requirement should express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, and notes. The application assigns REQ_ID and controlled requirement-set identity after validated ingestion. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',"
prompt = prompt[:start] + stage4 + prompt[end:]
if prompt.count('Stage 04 compiles accepted canonical context') != 1:
    raise SystemExit('Stage 04 prompt replacement did not produce one controlling rule')
prompt_path.write_text(prompt)

complete_path = Path('verify-complete.mjs')
complete = complete_path.read_text()
complete_marker = "console.log(JSON.stringify({stage22ProductHandoff:true,epistemicEffectiveEvidence:true,releaseContradictions:true},null,2));"
if complete.count(complete_marker) != 1:
    raise SystemExit('verify-complete final marker is not unique')
complete_block = r'''
// stage04-canonical-context-no-upload-regression-v1
{
  const p=project('JOB-STAGE04-CANONICAL-CONTEXT');
  Object.assign(p.job,{SUPPLIED_MATERIALS_INVENTORY:'MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN 2',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001'});
  const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'};
  p.projectData.sources.push({id:'SOURCE-STAGE04',stage:2,active:true,scope,fields:{SOURCE_ID:'SOURCE-STAGE04'}});
  p.projectData.research.push({id:'RESEARCH-STAGE04',stage:3,active:true,scope,fields:{RESEARCH_ID:'RESEARCH-STAGE04',SOURCE_ID:'SOURCE-STAGE04',EXACT_PORTION_EXAMINED:'STAGE04-RESEARCH-SENTINEL',FINDING_CLASSIFICATION:'OBLIGATION',SOURCE_EVIDENCE:'STAGE04-EVIDENCE-SENTINEL'},relationships:{SOURCE_ID:'SOURCE-STAGE04'}});
  p.projectData.candidateRequirements.push({id:'CANDIDATE-STAGE04',stage:3,active:true,scope,fields:{CANDIDATE_REQ_ID:'CANDIDATE-STAGE04',SOURCE_ID:'SOURCE-STAGE04',SOURCE_LOCATION:'STAGE04-SOURCE-LOCATION',CANDIDATE_OBLIGATION:'STAGE04-CANDIDATE-SENTINEL',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',EVIDENCE:'STAGE04-EVIDENCE-SENTINEL',STATUS:'ACTIVE'},relationships:{SOURCE_ID:'SOURCE-STAGE04'}});
  const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});
  assert(handoff.send.length===0&&handoff.withhold.length===0&&handoff.expectBack.length===0,'Stage 04 incorrectly created an artifact-transfer prerequisite.');
  const action=engine.operationalNextAction(p,4);
  assert(!/required input file|attach the exact supplied|blocked:.*file|add .* file before/i.test(action),'Stage 04 next action incorrectly requires a new file upload.');
  assert(action.includes('No new file upload is required for Stage 04.'),'Stage 04 next action does not explicitly remove the false upload requirement.');
  p.projectData.artifacts.push({id:'ARTIFACT-STAGE04-METADATA',stage:4,active:true,scope,fields:{ARTIFACT_ID:'ARTIFACT-STAGE04-METADATA',FILENAME:'MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN 2',AVAILABILITY:'METADATA_ONLY'}});
  const after=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});
  assert(after.send.length===0,'Metadata-only Stage 04 artifact incorrectly entered the outgoing handoff.');
}
'''
complete = complete.replace(complete_marker, complete_block + '\n' + complete_marker, 1)
complete_path.write_text(complete)

semantics_path = Path('verify-prompt-semantics.mjs')
semantics = semantics_path.read_text()
if 'stage04-canonical-context-no-upload-regression-v1' in semantics:
    raise SystemExit('Stage 04 prompt regression already exists unexpectedly')
semantics_block = r'''

// stage04-canonical-context-no-upload-regression-v1
{
  const p=baseProject();
  p.job.SUPPLIED_MATERIALS_INVENTORY='MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN 2';
  const scope={inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001'};
  p.projectData.sources.push({id:'SOURCE-STAGE04',stage:2,active:true,scope,fields:{SOURCE_ID:'SOURCE-STAGE04'}});
  p.projectData.research.push({id:'RESEARCH-STAGE04',stage:3,active:true,scope,fields:{RESEARCH_ID:'RESEARCH-STAGE04',SOURCE_ID:'SOURCE-STAGE04',EXACT_PORTION_EXAMINED:'STAGE04-RESEARCH-SENTINEL',FINDING_CLASSIFICATION:'OBLIGATION',SOURCE_EVIDENCE:'STAGE04-EVIDENCE-SENTINEL'},relationships:{SOURCE_ID:'SOURCE-STAGE04'}});
  p.projectData.candidateRequirements.push({id:'CANDIDATE-STAGE04',stage:3,active:true,scope,fields:{CANDIDATE_REQ_ID:'CANDIDATE-STAGE04',SOURCE_ID:'SOURCE-STAGE04',SOURCE_LOCATION:'STAGE04-SOURCE-LOCATION',CANDIDATE_OBLIGATION:'STAGE04-CANDIDATE-SENTINEL',CLASSIFICATION:'MANDATORY',APPLICABILITY:'APPLICABLE',EVIDENCE:'STAGE04-EVIDENCE-SENTINEL',STATUS:'ACTIVE'},relationships:{SOURCE_ID:'SOURCE-STAGE04'}});
  const before=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  for(const token of ['STAGE04-RESEARCH-SENTINEL','STAGE04-CANDIDATE-SENTINEL','Stage 04 compiles accepted canonical context','does not require the operator to upload a named supplied material again','Never infer substantive facts from a filename or metadata','return BLOCKED with INADEQUATE_PRIOR_OUTPUT'])if(!before.prompt.includes(token))throw new Error('Stage 04 canonical-context rule missing: '+token);
  for(const bad of ['REQUIRED INPUT FILES NOT READY','must add and application-verify these exact bytes','Attach every file shown in','Send with this instruction'])if(before.prompt.includes(bad))throw new Error('Stage 04 retained a false file-transfer prerequisite: '+bad);
  if(before.contextManifest.executionHandoff.send.length||before.contextManifest.executionHandoff.withhold.length||before.contextManifest.executionHandoff.expectBack.length)throw new Error('Stage 04 context manifest incorrectly contains an execution handoff.');
  p.projectData.artifacts.push({id:'ARTIFACT-STAGE04-METADATA',stage:4,active:true,scope,fields:{ARTIFACT_ID:'ARTIFACT-STAGE04-METADATA',FILENAME:'MAINFRAME_INVENTION_DISCLOSURE_COUNSEL_READY_LOGIC_CLEAN 2',AVAILABILITY:'METADATA_ONLY'}});
  const after=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
  if(after.bodySha256!==before.bodySha256||after.contextSignature!==before.contextSignature)throw new Error('Irrelevant Stage 04 artifact custody changed the controlling prompt identity.');
}
console.log(JSON.stringify({stage04CanonicalContextNoUpload:true},null,2));
'''
semantics_path.write_text(semantics.rstrip() + semantics_block + '\n')

index_path = Path('index.html')
index = index_path.read_text()
runtime = r'(\b(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js)\?v=[^"]+'
index, count = re.subn(runtime, r'\1?v=stage04-canonical-23', index)
if count != 8:
    raise SystemExit(f'Expected to replace 8 shared runtime tokens, replaced {count}')
index_path.write_text(index)

Path('.github/workflows/stage04-canonical-context.yml').unlink()
Path('.github/stage04-forward.py').unlink()

final_engine = engine_path.read_text()
final_prompt = prompt_path.read_text()
if "closed-loop-prompt-engine/23" not in final_prompt:
    raise SystemExit('Prompt engine version was not advanced to /23')
if 'stage===4&&handoff.send.length' in final_prompt or 'REQUIRED INPUT FILES NOT READY' in final_prompt:
    raise SystemExit('False Stage 04 file handoff survived the forward correction')
if 'No new file upload is required for Stage 04.' not in final_engine:
    raise SystemExit('Stage 04 next-action certainty is missing')
