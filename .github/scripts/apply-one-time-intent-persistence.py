from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement target, found {count}")
    target.write_text(text.replace(old, new, 1))


engine = Path("workflow-engine.js")
text = engine.read_text()
old = """  if(Object.keys(nonMirroredUserEntered).length)enumerateInputLeaves(nonMirroredUserEntered,'projectData.userEntered','ORIGINAL_USER_INPUT','Original user input',units,{inputVersion});
  for(const answer of safe(project.projectData.humanInputAnswers).filter(item=>!item.invalidatedBy)){const answerId=String(answer.answerId||answer.requestId||'UNKNOWN');enumerateInputLeaves(answer.answer,`projectData.humanInputAnswers.${answerId}.answer`,'HUMAN_ANSWER',`Human answer ${answerId}`,units,{inputVersion,extra:{answerId}});}
  const stageOneSelected=new Set(safe(project.stages?.[1]?.authorizedFiles).map(item=>String(item?.artifactId||item?.id||'')).filter(Boolean));
  const stageOneArtifacts=records(project,'artifacts').filter(record=>Number(record?.stage||recordValue(record,'STAGE')||record?.lineage?.stage||0)===1||stageOneSelected.has(recordId(record,'artifacts')));"""
new = """  if(Object.keys(nonMirroredUserEntered).length)enumerateInputLeaves(nonMirroredUserEntered,'projectData.userEntered','ORIGINAL_USER_INPUT','Original user input',units,{inputVersion});
  const suppliedArtifactFiles=project.projectData.userEntered?.suppliedArtifactFiles&&typeof project.projectData.userEntered.suppliedArtifactFiles==='object'?project.projectData.userEntered.suppliedArtifactFiles:{};
  const suppliedArtifactText=project.projectData.userEntered?.suppliedArtifactText&&typeof project.projectData.userEntered.suppliedArtifactText==='object'?project.projectData.userEntered.suppliedArtifactText:{};
  for(const [artifactId,entry] of Object.entries(suppliedArtifactText).sort(([left],[right])=>left.localeCompare(right))){
    const payload=entry&&typeof entry==='object'?entry:{text:entry},text=String(payload.text??'');
    if(!text.trim())continue;
    const metadata=suppliedArtifactFiles[artifactId]&&typeof suppliedArtifactFiles[artifactId]==='object'?suppliedArtifactFiles[artifactId]:payload,filename=String(metadata.filename||payload.filename||artifactId),artifactSha256=String(metadata.sha256||payload.sha256||''),byteSize=Number(metadata.byteSize||payload.byteSize||0);
    enumerateInputLeaves(text,`projectData.userEntered.suppliedArtifactText.${artifactId}.text`,'SUPPLIED_MATERIAL_CONTENT',`Supplied material content ${filename}`,units,{inputVersion,extra:{artifactId,filename,artifactSha256,byteSize,contentSource:'APPLICATION_CAPTURED_TEXT'}});
  }
  for(const answer of safe(project.projectData.humanInputAnswers).filter(item=>!item.invalidatedBy)){const answerId=String(answer.answerId||answer.requestId||'UNKNOWN');enumerateInputLeaves(answer.answer,`projectData.humanInputAnswers.${answerId}.answer`,'HUMAN_ANSWER',`Human answer ${answerId}`,units,{inputVersion,extra:{answerId}});}
  const stageOneSelected=new Set(safe(project.stages?.[1]?.authorizedFiles).map(item=>String(item?.artifactId||item?.id||'')).filter(Boolean));
  const stageOneArtifacts=records(project,'artifacts').filter(record=>Number(record?.stage||recordValue(record,'STAGE')||record?.lineage?.stage||0)===1||stageOneSelected.has(recordId(record,'artifacts'))).sort((left,right)=>recordId(left,'artifacts').localeCompare(recordId(right,'artifacts')));"""
if text.count(old) != 1:
    raise SystemExit(f"workflow-engine.js: intake insertion target count {text.count(old)}")
text = text.replace(old, new, 1)
old_matrix = "ACTUAL_MANDATORY_RECORDS:matrix.actual.length"
if text.count(old_matrix) != 1:
    raise SystemExit(f"workflow-engine.js: Stage 12 matrix target count {text.count(old_matrix)}")
text = text.replace(old_matrix, "ACTUAL_MANDATORY_RECORDS:matrix.verification.length", 1)
engine.write_text(text)

replace_once(
    "prompt-engine.js",
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/54';",
    "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/55';",
)
replace_once(
    "prompt-engine.js",
    "contextRecordsFor(state,collection,scope,batchPlan,stage).map(record=>({id:recordId(record,collection)",
    "contextRecordsFor(state,collection,scope,batchPlan,stage,operation).map(record=>({id:recordId(record,collection)",
)

test = Path("verify-one-time-intent-intake.mjs")
text = test.read_text()
old_project = """project.projectData.userEntered={
  productConstraint:'The prompt box must retain its established dimensions.',
  acceptance:{oneTimeSupply:'Project information is supplied once and remains available to every later stage.'}
};"""
new_project = """const suppliedArtifactId='ARTIFACT-INTENT-001';
project.projectData.userEntered={
  productConstraint:'The prompt box must retain its established dimensions.',
  acceptance:{oneTimeSupply:'Project information is supplied once and remains available to every later stage.'},
  suppliedArtifactFiles:{[suppliedArtifactId]:{artifactId:suppliedArtifactId,filename:'intent.txt',sha256:'a'.repeat(64),byteSize:144,mediaType:'text/plain'}},
  suppliedArtifactText:{[suppliedArtifactId]:{artifactId:suppliedArtifactId,filename:'intent.txt',sha256:'a'.repeat(64),byteSize:144,mediaType:'text/plain',text:'The original intent file requires preserved prompt box dimensions.\\nThe original intent file forbids duplicate user data entry.'}}
};"""
if text.count(old_project) != 1:
    raise SystemExit("verify-one-time-intent-intake.mjs: project fixture target not found exactly once")
text = text.replace(old_project, new_project, 1)
old_asserts = """assert(intake.units.some(unit=>unit.sourceLocation.includes('projectData.userEntered.acceptance.oneTimeSupply')),'Nested user-entered acceptance data was omitted from the intake manifest.');

const capture={"""
new_asserts = """assert(intake.units.some(unit=>unit.sourceLocation.includes('projectData.userEntered.acceptance.oneTimeSupply')),'Nested user-entered acceptance data was omitted from the intake manifest.');
const suppliedContentUnits=intake.units.filter(unit=>unit.kind==='SUPPLIED_MATERIAL_CONTENT'&&unit.artifactId===suppliedArtifactId);
assert(suppliedContentUnits.length===2,'Text captured from the supplied Stage 01 intent file was not enumerated line by line.');
assert(suppliedContentUnits.some(unit=>unit.rawValueText==='The original intent file requires preserved prompt box dimensions.'),'The first supplied intent-file requirement was omitted.');
assert(suppliedContentUnits.some(unit=>unit.rawValueText==='The original intent file forbids duplicate user data entry.'),'The second supplied intent-file requirement was omitted.');

const capture={"""
if text.count(old_asserts) != 1:
    raise SystemExit("verify-one-time-intent-intake.mjs: intake assertion target not found exactly once")
text = text.replace(old_asserts, new_asserts, 1)
old_required = """  'Project information is supplied once and remains available to every later stage.',
  'External mandatory obligation retained from Stage 03.',"""
new_required = """  'Project information is supplied once and remains available to every later stage.',
  'The original intent file requires preserved prompt box dimensions.',
  'The original intent file forbids duplicate user data entry.',
  'External mandatory obligation retained from Stage 03.',"""
if text.count(old_required) != 1:
    raise SystemExit("verify-one-time-intent-intake.mjs: obligation fixture target not found exactly once")
text = text.replace(old_required, new_required, 1)
old_prompt_assert = """assert(stage4Prompt.prompt.includes('The prompt box must retain its established dimensions.'),'Stage 04 prompt omitted captured Stage 01 project detail.');
assert(stage4Prompt.prompt.includes('External mandatory obligation retained from Stage 03.'),'Stage 04 prompt omitted Stage 03 research detail.');"""
new_prompt_assert = """assert(stage4Prompt.prompt.includes('The prompt box must retain its established dimensions.'),'Stage 04 prompt omitted captured Stage 01 project detail.');
assert(stage4Prompt.prompt.includes('The original intent file requires preserved prompt box dimensions.'),'Stage 04 prompt omitted content captured from the supplied Stage 01 intent file.');
assert(stage4Prompt.prompt.includes('The original intent file forbids duplicate user data entry.'),'Stage 04 prompt omitted a second requirement captured from the supplied Stage 01 intent file.');
assert(stage4Prompt.prompt.includes('External mandatory obligation retained from Stage 03.'),'Stage 04 prompt omitted Stage 03 research detail.');"""
if text.count(old_prompt_assert) != 1:
    raise SystemExit("verify-one-time-intent-intake.mjs: Stage 04 prompt target not found exactly once")
test.write_text(text.replace(old_prompt_assert, new_prompt_assert, 1))

for path in ["index.html", "app-core.js"]:
    target = Path(path)
    text = target.read_text()
    if "runtime-20260830-live-operator-59" not in text:
        raise SystemExit(f"{path}: expected runtime cache identity was not found")
    target.write_text(text.replace("runtime-20260830-live-operator-59", "runtime-20260830-live-operator-61"))
