from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"missing patch anchor in {path}: {old[:120]!r}")
    if s.count(old) != 1:
        raise SystemExit(f"non-unique patch anchor in {path}: {s.count(old)}")
    p.write_text(s.replace(old, new, 1))


replace_once(
    "workflow-schema.js",
    "'REGRESSION_RETIREMENT_AUTHORIZATION','BACKUP_POLICY_SELECTION','TRADEOFF_OR_SCOPE_DECISION','HUMAN_AUTHORITY_CORRECTION','DELIVERY_INTENT'",
    "'REGRESSION_RETIREMENT_AUTHORIZATION','BACKUP_POLICY_SELECTION','TRADEOFF_OR_SCOPE_DECISION','VISUAL_BASELINE_AUTHORIZATION','HUMAN_AUTHORITY_CORRECTION','DELIVERY_INTENT'",
)

replace_once(
    "workflow-schema.js",
    "retryRule:external?'EXACT_RETRY_OR_REPLACEMENT_PROMPT':'IDEMPOTENT_COMMAND'",
    "retryRule:external?'EXACT_RETRY_OR_REPLACEMENT_PROMPT':'IDEMPOTENT_COMMAND',minimumInputBindingBasis:external?'EXTERNALLY_SUPPORTED':'APPLICATION_OBSERVED'",
)

old = """function capabilityAffirmativelyAvailable(project,requiredCapability,mode,test){
  const capability=upper(requiredCapability);if(!capability)return false;
  if(mode==='APPLICATION_DETERMINISTIC')return applicationTestSupported(test);
  if(['INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION'].includes(mode))return true;
  if(mode==='UNAVAILABLE')return false;
  const declarations=[project?.job?.AVAILABLE_TOOLS,...recordsForCurrentScope(project,'freshContexts').map(record=>recordValue(record,'TOOL_AVAILABILITY'))],negative=/\\b(?:UNAVAILABLE|NOT AVAILABLE|NO ACCESS|MISSING|ABSENT|UNKNOWN)\\b/;
  return declarations.some(value=>{const text=upper(typeof value==='string'?value:JSON.stringify(value??''));return text.includes(capability)&&!negative.test(text);});
}"""
new = """function evaluateCapabilityReadiness(project,requiredCapability,mode,test){
  const capability=upper(requiredCapability),reasons=[];
  if(!capability)return {truthValue:'UNKNOWN',ready:false,reasons:['Required capability is not identified.'],capabilityIds:[]};
  if(mode==='APPLICATION_DETERMINISTIC'){const ready=applicationTestSupported(test);return {truthValue:ready?'TRUE':'FALSE',ready,reasons:ready?[]:['The application-native runtime does not support the required test.'],capabilityIds:[]};}
  if(mode==='UNAVAILABLE')return {truthValue:'FALSE',ready:false,reasons:['The required capability is explicitly unavailable.'],capabilityIds:[]};
  if(['INDEPENDENT_AGENT_REVIEW','HUMAN_INSPECTION'].includes(mode))return {truthValue:'TRUE',ready:true,reasons:[],capabilityIds:[]};
  const candidates=recordsForCurrentScope(project,'externalCapabilities').filter(record=>{
    const claim=upper(recordValue(record,'CAPABILITY_CLAIM')),id=upper(recordId(record,'externalCapabilities'));
    return claim===capability||claim.includes(capability)||id===capability;
  });
  if(!candidates.length)return {truthValue:'UNKNOWN',ready:false,reasons:[`No current canonical external-capability record identifies ${requiredCapability}.`],capabilityIds:[]};
  let sawUnknown=false,sawFalse=false;
  const conjuncts=['AUTHORIZED','PERMISSIONS_READY','INPUTS_TRANSFERABLE','ROUTE_USABLE','EVIDENCE_OBTAINABLE'];
  for(const record of candidates){
    const id=recordId(record,'externalCapabilities'),fresh=upper(recordValue(record,'FRESHNESS_STATUS')),status=upper(recordValue(record,'STATUS')),values=conjuncts.map(name=>recordValue(record,name));
    const unknown=fresh!=='CURRENT'||!status||['UNKNOWN','BLOCKED','STALE','EXPIRED'].includes(status)||values.some(value=>value!==true&&value!==false);
    const failed=values.some(value=>value===false)||['EXPIRED','STALE','BLOCKED','UNAVAILABLE'].includes(fresh)||['BLOCKED','REJECTED','UNAVAILABLE'].includes(status);
    if(!unknown&&!failed&&values.every(value=>value===true))return {truthValue:'TRUE',ready:true,reasons:[],capabilityIds:[id]};
    if(failed){sawFalse=true;reasons.push(`${id}: one or more required capability-readiness conjuncts are FALSE or unavailable.`);}else{sawUnknown=true;reasons.push(`${id}: one or more required capability-readiness conjuncts are UNKNOWN or not current.`);}
  }
  return {truthValue:sawFalse&&!sawUnknown?'FALSE':'UNKNOWN',ready:false,reasons,capabilityIds:candidates.map(record=>recordId(record,'externalCapabilities'))};
}
function capabilityAffirmativelyAvailable(project,requiredCapability,mode,test){return evaluateCapabilityReadiness(project,requiredCapability,mode,test).ready;}
"""
replace_once("workflow-engine.js", old, new)
replace_once(
    "workflow-engine.js",
    "releaseMetrics,applicationTestCapabilities,capabilityAffirmativelyAvailable,canonicalTestBindingCatalog",
    "releaseMetrics,applicationTestCapabilities,evaluateCapabilityReadiness,capabilityAffirmativelyAvailable,canonicalTestBindingCatalog",
)

old = """for(const artifact of stageOneArtifacts){const artifactId=recordId(artifact,'artifacts'),filename=String(recordValue(artifact,'FILENAME')||artifactId),sha256=String(recordValue(artifact,'SHA256')||''),byteSize=Number(recordValue(artifact,'BYTE_SIZE')||0),availability=String(recordValue(artifact,'AVAILABILITY')||'UNKNOWN'),sourceLocation=`artifact.${artifactId}`,rawValueText=JSON.stringify({artifactId,filename,sha256,byteSize,availability}),rawValueSha256=hash.sha256Value(rawValueText),unitId=`INPUT-UNIT-${hash.sha256Value({inputVersion,kind:'SUPPLIED_MATERIAL',sourceLocation,rawValueSha256}).slice(0,20).toUpperCase()}`;units.push({unitId,kind:'SUPPLIED_MATERIAL',sourceLocation,label:`Supplied material ${filename}`,rawValueSha256,rawValueText,artifactId,filename,artifactSha256:sha256,byteSize,availability});}"""
new = """for(const artifact of stageOneArtifacts){const artifactId=recordId(artifact,'artifacts'),filename=String(recordValue(artifact,'FILENAME')||artifactId),sha256=String(recordValue(artifact,'SHA256')||''),byteSize=Number(recordValue(artifact,'BYTE_SIZE')||0),availability=String(recordValue(artifact,'AVAILABILITY')||'UNKNOWN'),includedInHandoff=stageOneSelected.has(artifactId),sourceLocation=`artifact.${artifactId}`,rawValueText=JSON.stringify({artifactId,filename,sha256,byteSize,availability,includedInHandoff}),rawValueSha256=hash.sha256Value(rawValueText),unitId=`INPUT-UNIT-${hash.sha256Value({inputVersion,kind:'SUPPLIED_MATERIAL',sourceLocation,rawValueSha256}).slice(0,20).toUpperCase()}`;units.push({unitId,kind:'SUPPLIED_MATERIAL',sourceLocation,label:`Supplied material ${filename}`,rawValueSha256,rawValueText,artifactId,filename,artifactSha256:sha256,byteSize,availability,includedInHandoff});}"""
replace_once("workflow-engine.js", old, new)

old = """const statements=safe(unit?.extractedStatements);if(!noStatementDisposition&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;
    for(const statement of statements){const key=String(statement?.statementKey||'').trim(),text=String(statement?.text||'').trim(),classification=String(statement?.statementClass||'').trim().toUpperCase();if(!key||statementKeys.has(key)){reasons.push(`Stage 01 intake unit ${id} has a missing or duplicate statementKey.`);statementsValid=false;}statementKeys.add(key);if(!text){reasons.push(`Stage 01 intake unit ${id} contains an empty extracted statement.`);statementsValid=false;}if(!INTAKE_STATEMENT_CLASSES.includes(classification)){reasons.push(`Stage 01 intake unit ${id} has an invalid statementClass.`);statementsValid=false;}}
    if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&(noStatementDisposition?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);"""
new = """const statements=safe(unit?.extractedStatements);if(!noStatementDisposition&&!statements.length)reasons.push(`Stage 01 intake unit ${id} contains no extracted human-authority statement.`);const statementKeys=new Set();let statementsValid=true;
    for(const statement of statements){const key=String(statement?.statementKey||'').trim(),text=String(statement?.text||'').trim(),classification=String(statement?.statementClass||'').trim().toUpperCase(),location=String(statement?.sourceLocation||'').trim();if(!key||statementKeys.has(key)){reasons.push(`Stage 01 intake unit ${id} has a missing or duplicate statementKey.`);statementsValid=false;}statementKeys.add(key);if(!text){reasons.push(`Stage 01 intake unit ${id} contains an empty extracted statement.`);statementsValid=false;}if(!INTAKE_STATEMENT_CLASSES.includes(classification)){reasons.push(`Stage 01 intake unit ${id} has an invalid statementClass.`);statementsValid=false;}if(source.kind==='SUPPLIED_MATERIAL'&&!noStatementDisposition&&!location){reasons.push(`Stage 01 supplied-file statement ${key||'UNKNOWN'} for ${id} lacks the available source location.`);statementsValid=false;}}
    let inspectionSupported=true;
    if(source.kind==='SUPPLIED_MATERIAL'&&Number(source.byteSize||0)>0){
      const duplicateIncluded=manifest.units.some(other=>other!==source&&other.kind==='SUPPLIED_MATERIAL'&&String(other.artifactSha256||'')&&String(other.artifactSha256)===String(source.artifactSha256)&&other.includedInHandoff===true);
      const requiredInspection=!duplicateIncluded;
      const claimed=unit?.externalInspectionClaimed===true||['EXTERNAL_INSPECTION_CLAIMED','INSPECTION_SUPPORTED','INSPECTION_ESTABLISHED_TO_REQUIRED_BASIS'].includes(String(unit?.inspectionStatus||'').trim().toUpperCase());
      if(requiredInspection&&source.includedInHandoff!==true){reasons.push(`Stage 01 required supplied file ${source.artifactId} was not INCLUDED_IN_HANDOFF by the application.`);inspectionSupported=false;}
      if(requiredInspection&&source.includedInHandoff===true&&!claimed){reasons.push(`Stage 01 required supplied file ${source.artifactId} lacks the external inspection claim required to establish INSPECTION_SUPPORTED.`);inspectionSupported=false;}
      if(requiredInspection&&upper(source.availability)!=='BYTES_PERSISTED_AND_VERIFIED'){reasons.push(`Stage 01 required supplied file ${source.artifactId} does not have verified available bytes.`);inspectionSupported=false;}
      if(requiredInspection&&disposition==='INACCESSIBLE_OR_BLOCKED')inspectionSupported=false;
    }
    if(hashMatches&&INTAKE_ACCOUNTING_DISPOSITIONS.includes(disposition)&&statementsValid&&inspectionSupported&&(noStatementDisposition?Boolean(String(unit?.reason||'').trim()):statements.length>0))accounted.add(id);"""
replace_once("workflow-engine.js", old, new)

replace_once(
    "prompt-engine.js",
    "Do not treat a filename or file hash as a substitute for inspecting the transferred file bytes.",
    "Do not treat a filename or file hash as a substitute for inspecting the transferred file bytes. For every required supplied-file unit whose bytes you actually read, set externalInspectionClaimed=true (or inspectionStatus=EXTERNAL_INSPECTION_CLAIMED) in that unit's accounting entry and give sourceLocation for each extracted statement where mechanically available. Never claim inspection for bytes you did not read; the application separately establishes INCLUDED_IN_HANDOFF and derives whether INSPECTION_SUPPORTED is reached.",
)

replace_once(
    "verify-contract-closure.mjs",
    "'readCollections','writableCollections','agentWritableCollections','allowedStageData','scopeRequirements','applicationCollections','completionPredicate','retryRule'",
    "'readCollections','writableCollections','agentWritableCollections','allowedStageData','scopeRequirements','applicationCollections','completionPredicate','retryRule','minimumInputBindingBasis'",
)
replace_once(
    "verify-contract-closure.mjs",
    "assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].reservationRequired,true);",
    "assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].reservationRequired,true);\n  assert.equal(schema.STAGE_OPERATION_REGISTRY['1:COMPLETE'].minimumInputBindingBasis,'EXTERNALLY_SUPPORTED','External operations must declare the minimum accepted input-binding basis.');\n  assert.equal(schema.STAGE_OPERATION_REGISTRY['30:CALCULATE_TERMINAL'].minimumInputBindingBasis,'APPLICATION_OBSERVED','Application commands bind application-observed inputs.');",
)
replace_once(
    "verify-contract-closure.mjs",
    "assert.equal(schema.identityAssuranceSatisfies('BASELINE_AUTHORIZATION','SELF_ASSERTED').allowed,true,'Current baseline authority must permit its registered assurance.');",
    "assert.equal(schema.identityAssuranceSatisfies('BASELINE_AUTHORIZATION','SELF_ASSERTED').allowed,true,'Current baseline authority must permit its registered assurance.');\n  assert.equal(schema.identityAssuranceSatisfies('VISUAL_BASELINE_AUTHORIZATION','SELF_ASSERTED').allowed,true,'Visual baseline authorization must be a registered human-decision purpose.');",
)

replace_once(
    "verify-stage01-intake-closure.mjs",
    "engine.registerArtifactBytes(p,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:42,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});",
    "engine.registerArtifactBytes(p,{stage:1,artifactId:'ARTIFACT-INTENT-001',filename:'intent.txt',mediaType:'text/plain',byteSize:42,sha256:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',role:'HUMAN_INPUT'});\np.stages[1].authorizedFiles=[{artifactId:'ARTIFACT-INTENT-001'}];",
)
replace_once(
    "verify-stage01-intake-closure.mjs",
    "sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserved as current human-authority input.',extractedStatements:[{statementKey:`statement-${index+1}`,text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT'}]",
    "sourceUnitId:unit.unitId,sourceRawValueSha256:unit.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserved as current human-authority input.',externalInspectionClaimed:unit.kind==='SUPPLIED_MATERIAL'?true:undefined,extractedStatements:[{statementKey:`statement-${index+1}`,text:unit.rawValueText||unit.label||unit.unitId,statementClass:'CONTEXT',sourceLocation:unit.kind==='SUPPLIED_MATERIAL'?unit.sourceLocation:undefined}]",
)
replace_once(
    "verify-stage01-intake-closure.mjs",
    "const incomplete=structuredClone(capture);incomplete.units.pop();",
    "const inspectionMissing=structuredClone(capture);const fileAccounting=inspectionMissing.units.find(unit=>manifest.units.find(source=>source.unitId===unit.sourceUnitId)?.kind==='SUPPLIED_MATERIAL');delete fileAccounting.externalInspectionClaimed;\nassert(!engine.evaluateIntakeAccounting(p,{capture:JSON.stringify(inspectionMissing)}).complete,'Stage 01 accepted a required supplied file without EXTERNAL_INSPECTION_CLAIMED.');\nconst handoffMissing=structuredClone(p);handoffMissing.stages[1].authorizedFiles=[];const handoffManifest=engine.intakeCoverageManifest(handoffMissing);const handoffCapture={...capture,manifestSha256:handoffManifest.manifestSha256,units:handoffManifest.units.map((source,index)=>({sourceUnitId:source.unitId,sourceRawValueSha256:source.rawValueSha256,disposition:'RETAINED_AS_CONTEXT',reason:'Preserved.',externalInspectionClaimed:source.kind==='SUPPLIED_MATERIAL'?true:undefined,extractedStatements:[{statementKey:`handoff-${index}`,text:source.rawValueText||source.label,statementClass:'CONTEXT',sourceLocation:source.kind==='SUPPLIED_MATERIAL'?source.sourceLocation:undefined}]}))};\nassert(!engine.evaluateIntakeAccounting(handoffMissing,{capture:JSON.stringify(handoffCapture)}).complete,'Stage 01 accepted a required supplied file that was not INCLUDED_IN_HANDOFF.');\nconst incomplete=structuredClone(capture);incomplete.units.pop();",
)
replace_once(
    "verify-stage01-intake-closure.mjs",
    "console.log(JSON.stringify({stage01IntakeClosure:true,artifactIdentityBound:true,currentManifestBound:true,incompleteAccountingRejected:true}));",
    "console.log(JSON.stringify({stage01IntakeClosure:true,artifactIdentityBound:true,currentManifestBound:true,incompleteAccountingRejected:true,missingInspectionClaimRejected:true,missingHandoffRejected:true}));",
)

Path("verify-capability-readiness.mjs").write_text(r'''import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
globalThis.crypto=webcrypto;
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const core=globalThis.closedLoopCore,engine=globalThis.closedLoopWorkflowEngine;
const p=core.createBlankState('JOB-CAPABILITY-CLOSURE');engine.ensureShape(p);
p.job.AVAILABLE_TOOLS='CAD_TOOL is available';
assert.equal(engine.capabilityAffirmativelyAvailable(p,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null),false,'Human/tool prose alone must not establish CAPABILITY_READY.');
const cap={id:'CAPABILITY-TEST',active:true,scope:{},fields:{CAPABILITY_ID:'CAPABILITY-TEST',CAPABILITY_CLAIM:'CAD_TOOL',FRESHNESS_STATUS:'CURRENT',STATUS:'CURRENT',AUTHORIZED:true,PERMISSIONS_READY:true,INPUTS_TRANSFERABLE:true,ROUTE_USABLE:true,EVIDENCE_OBTAINABLE:true}};
p.projectData.externalCapabilities.push(cap);
assert.equal(engine.evaluateCapabilityReadiness(p,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null).truthValue,'TRUE');
for(const field of ['AUTHORIZED','PERMISSIONS_READY','INPUTS_TRANSFERABLE','ROUTE_USABLE','EVIDENCE_OBTAINABLE']){
  const q=structuredClone(p);q.projectData.externalCapabilities[0].fields[field]=false;
  assert.equal(engine.capabilityAffirmativelyAvailable(q,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null),false,`${field}=false must block routing.`);
}
const unknown=structuredClone(p);delete unknown.projectData.externalCapabilities[0].fields.EVIDENCE_OBTAINABLE;
assert.equal(engine.evaluateCapabilityReadiness(unknown,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null).truthValue,'UNKNOWN','Unknown conjunction input must remain UNKNOWN.');
const stale=structuredClone(p);stale.projectData.externalCapabilities[0].fields.FRESHNESS_STATUS='EXPIRED';
assert.equal(engine.capabilityAffirmativelyAvailable(stale,'CAD_TOOL','EXTERNAL_AGENT_TOOL',null),false,'Expired capability must block.');
console.log(JSON.stringify({capabilityReadyClosedConjunction:true,proseCannotEstablishCapability:true,unknownFailsClosed:true}));
''')
