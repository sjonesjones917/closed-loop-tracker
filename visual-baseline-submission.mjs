// Repository-only transport. Authentication attributes the submission; it does not
// manufacture visual approval, screenshots, measurements, or comparison results.
import './hash.js';
import fs from 'node:fs';
import {createVerifierRuntime} from './verifier-runtime.mjs';
import {execFileSync} from 'node:child_process';
import {runtimePaths} from './verified-site.mjs';
// Read the existing browser registry in a private realm, rather than copying its
// authority vocabulary or installing application globals into the controller.
const humanDecisionPolicy=(()=>{
  const context=createVerifierRuntime({TextEncoder,TextDecoder,dispatchEvent(){},Event:class Event{}});
  for(const file of ['hash.js','workbook.js','workflow-schema.js','test-runtime.js'])createVerifierRuntime.loadScript(context,fs.readFileSync(new URL(file,import.meta.url),'utf8'),{filename:file});
  return {...context.closedLoopWorkflowSchema,exactDecimalParts:context.closedLoopTestRuntime.exactDecimalParts};
})();
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const commitSha=/^[0-9a-f]{40}$/;
const sha256=/^[0-9a-f]{64}$/;
const isCommit=value=>typeof value==='string'&&commitSha.test(value);
const isSha256=value=>typeof value==='string'&&sha256.test(value);
const stringList=value=>Array.isArray(value)&&value.every(nonempty)&&new Set(value).size===value.length;
const same=(a,b)=>{try{return globalThis.closedLoopHash.sha256Value(a)===globalThis.closedLoopHash.sha256Value(b);}catch{return false;}};
const instant=value=>{try{const parsed=globalThis.closedLoopHash.normalizeDateTime(value);return parsed.kind==='INSTANT'&&parsed.normalized===value;}catch{return false;}};
const dimension=value=>{
  if(typeof value==='number')return Number.isSafeInteger(value)&&value>0;
  if(typeof value!=='string')return false;
  try{const parsed=humanDecisionPolicy.exactDecimalParts(value);return parsed.sign>0n&&parsed.digits>0n;}catch{return false;}
};
const viewportSizes=['320x568','393x852','1280x800'];
const sourceGraphs=new Map();

// Historical resource closure comes from that immutable repository source,
// never from a producer-supplied list or the current deployment's file count.
export function resolveVisualBaselineResourceGraph(sourceCommit,{cwd=process.cwd()}={}){
  if(!isCommit(sourceCommit))throw new Error('Visual baseline source graph requires an exact source commit.');
  const key=cwd+'\0'+sourceCommit;if(sourceGraphs.has(key))return structuredClone(sourceGraphs.get(key));
  let source;
  try{source=execFileSync('git',['show',`${sourceCommit}:verified-site.mjs`],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:1048576});}
  catch{throw new Error('Visual evidence baseline resource graph is unavailable; fetch the exact source commit before validation or use a current human-authorized baseline.');}
  const literal=source.match(/^export const runtimePaths\s*=\s*(\[[\s\S]*?\]);/m)?.[1],members=literal?.slice(1,-1);
  if(!members||!/^\s*(?:'[^'\\\r\n]+'|"[^"\\\r\n]+")\s*(?:,\s*(?:'[^'\\\r\n]+'|"[^"\\\r\n]+")\s*)*,?\s*$/.test(members))throw new Error('Visual evidence baseline resource graph is not mechanically recognized; retain its history evidence and use a current human-authorized baseline.');
  const paths=[...members.matchAll(/(['"])(.*?)\1/g)].map(match=>match[2]);
  if(!stringList(paths)||!paths.length)throw new Error('Visual evidence baseline resource graph is not mechanically recognized; retain its history evidence and use a current human-authorized baseline.');
  const graph={sourceCommit,sourcePath:'verified-site.mjs',sourceDefinitionSha256:globalThis.closedLoopHash.sha256Text(source),paths};sourceGraphs.set(key,graph);return structuredClone(graph);
}

// This checks supplied evidence consistency. Artifact retrieval, visual judgment,
// and the truth of human observations remain the controller's evidence duties.
export function validateVisualBaselineEvidence(evidence,{commit,deploymentManifestDigest,baselineResourceGraph}={}){
  const issues=[],fail=(path,message)=>issues.push({path,message});
  if(!object(evidence)){fail('/', 'Visual evidence must be an object.');return {valid:false,issues};}
  try{globalThis.closedLoopHash.sha256Value(evidence);}catch(error){fail('/', 'Visual evidence contains data outside the canonical JSON contract.');issues.at(-1).detail=error.message;return {valid:false,issues};}
  if(evidence.status!=='PROVEN'||!isCommit(commit)||!isCommit(evidence.sourceCommit)||evidence.comparedCommit!==commit||evidence.comparisonResult!=='PASS')fail('/', 'Visual evidence must bind a passing comparison to the exact submitted commit.');
  if(!['APPROVED_PREDECESSOR','VISUAL_BASELINE_AUTHORIZATION'].includes(evidence.authority)||!nonempty(evidence.authorityRecordId))fail('authority','Visual evidence requires the actual approved-predecessor or human-authorization record identity.');
  if(!stringList(evidence.evidenceReferences)||!evidence.evidenceReferences.length)fail('evidenceReferences','Visual evidence must reference actual approval and before/after comparison artifacts.');
  if(issues.length)return {valid:false,issues};
  const tuple=evidence.baseline,comparison=evidence.comparison;
  const tupleMessage='Visual evidence requires the complete frozen baseline tuple.';
  if(!object(tuple)||!nonempty(tuple.VISUAL_BASELINE_ID)||tuple.sourceCommit!==evidence.sourceCommit){fail('baseline',tupleMessage);return {valid:false,issues};}
  let baselineGraph=baselineResourceGraph;
  if(baselineGraph===undefined)try{baselineGraph=resolveVisualBaselineResourceGraph(tuple.sourceCommit);}catch(error){fail('baseline.deploymentManifest.runtimeResources',error.message);return {valid:false,issues};}
  if(!object(baselineGraph)||baselineGraph.sourceCommit!==tuple.sourceCommit||!stringList(baselineGraph.paths)||!baselineGraph.paths.length){fail('baseline.deploymentManifest.runtimeResources','Visual evidence requires the trusted exact-source resource graph.');return {valid:false,issues};}
  function manifest(value,sourceCommit,path,expectedDigest,expectedPaths=runtimePaths){
    if(!object(value)||value.schema!=='closed-loop-deployment-manifest/1'||value.sourceCommit!==sourceCommit||!nonempty(value.buildIdentity)||!object(value.manifestDigest)||value.manifestDigest.hashAlgorithm!=='SHA-256'||!isSha256(value.manifestDigest.digest)||!Array.isArray(value.runtimeResources)||!value.runtimeResources.length){fail(path,'Visual evidence requires an exact-source deployment manifest and complete resource hashes.');return;}
    const unsigned={...value};delete unsigned.manifestDigest;
    if(globalThis.closedLoopHash.sha256Value(unsigned)!==value.manifestDigest.digest||(expectedDigest!==undefined&&value.manifestDigest.digest!==expectedDigest))fail(path+'.manifestDigest','Visual evidence deployment manifest identity does not match the supplied source or final deployed artifact.');
    if(!same(value.runtimeResources.map(row=>row?.path).sort(),[...expectedPaths].sort()))fail(path+'.runtimeResources','Visual evidence requires the complete registered deployment resource graph.');
    const paths=new Set();
    for(const [index,row] of value.runtimeResources.entries()){
      if(!object(row)||!nonempty(row.path)||paths.has(row.path)||!nonempty(row.mediaType)||!Number.isSafeInteger(row.byteSize)||row.byteSize<0||row.hashAlgorithm!=='SHA-256'||!isSha256(row.digest)||row.buildIdentity!==value.buildIdentity)fail(`${path}.runtimeResources[${index}]`,'Visual evidence contains an invalid or duplicate deployment resource.');
      if(object(row))paths.add(row.path);
    }
  }
  manifest(tuple.deploymentManifest,tuple.sourceCommit,'baseline.deploymentManifest',undefined,baselineGraph.paths);
  const ids=new Set(),sizes=[];
  if(!Array.isArray(tuple.viewports)||tuple.viewports.length!==viewportSizes.length)fail('baseline.viewports',tupleMessage);
  else for(const [index,row] of tuple.viewports.entries()){
    const path=`baseline.viewports[${index}]`,box=row?.promptBox,shot=row?.referenceScreenshot;
    if(!object(row)||!nonempty(row.id)||ids.has(row.id)||!Number.isSafeInteger(row.width)||row.width<=0||!Number.isSafeInteger(row.height)||row.height<=0){fail(path,tupleMessage);continue;}
    ids.add(row.id);sizes.push(`${row.width}x${row.height}`);
    if(!object(box)||!dimension(box.width)||!dimension(box.height)||!nonempty(box.widthBehavior)||!nonempty(box.heightBehavior)||!object(box.computedStyles)||!Object.keys(box.computedStyles).length||Object.values(box.computedStyles).some(value=>!nonempty(value)))fail(path+'.promptBox',tupleMessage);
    if(!object(shot)||!nonempty(shot.reference)||!isSha256(shot.sha256))fail(path+'.referenceScreenshot',tupleMessage);
  }
  if(!same([...sizes].sort(),[...viewportSizes].sort()))fail('baseline.viewports',tupleMessage);
  const regions=new Set(),allowed=new Set(),dynamic=new Set();
  for(const [name,target] of [['allowedChangeRegions',allowed],['dynamicRegions',dynamic]]){
    if(!Array.isArray(tuple[name])){fail('baseline.'+name,tupleMessage);continue;}
    for(const [index,row] of tuple[name].entries()){
      if(!object(row)||!nonempty(row.id)||regions.has(row.id)||!ids.has(row.viewportId)||!nonempty(row.selector)||(name==='allowedChangeRegions'&&!nonempty(row.normativeRequirementReference)))fail(`baseline.${name}[${index}]`,tupleMessage);
      else {regions.add(row.id);target.add(row.id);}
    }
  }
  if(issues.length)return {valid:false,issues};
  const baselineSha256=globalThis.closedLoopHash.sha256Value(tuple),comparisonMessage='Visual evidence requires a complete comparison bound to the frozen tuple and exact deployed artifact.';
  if(!object(comparison)||comparison.VISUAL_BASELINE_ID!==tuple.VISUAL_BASELINE_ID||comparison.baselineSha256!==baselineSha256||comparison.comparedCommit!==commit){fail('comparison',comparisonMessage);return {valid:false,issues};}
  manifest(comparison.deploymentManifest,commit,'comparison.deploymentManifest',deploymentManifestDigest);
  if(!stringList(comparison.viewportIds)||!same([...comparison.viewportIds].sort(),[...ids].sort()))fail('comparison.viewportIds',comparisonMessage);
  const screenshotIds=new Set();
  if(!Array.isArray(comparison.screenshots)||comparison.screenshots.length!==ids.size)fail('comparison.screenshots',comparisonMessage);
  else for(const [index,row] of comparison.screenshots.entries()){
    if(!object(row)||!ids.has(row.viewportId)||screenshotIds.has(row.viewportId)||!nonempty(row.reference)||!isSha256(row.sha256))fail(`comparison.screenshots[${index}]`,comparisonMessage);
    if(object(row))screenshotIds.add(row.viewportId);
  }
  for(const [key,inventory] of [['changedRegionIds',allowed],['ignoredDynamicRegionIds',dynamic]])if(!stringList(comparison[key])||comparison[key].some(id=>!inventory.has(id)))fail('comparison.'+key,'Visual evidence cannot change or ignore a region outside the frozen inventory.');
  if(Array.isArray(comparison.changedRegionIds)&&comparison.changedRegionIds.length&&(evidence.authority!=='VISUAL_BASELINE_AUTHORIZATION'||tuple.sourceCommit!==commit))fail('comparison.changedRegionIds','Intentional visual changes require a new human-authorized baseline for the exact compared commit.');
  function decision(record,receipt,recordId,path,{historical=false}={}){
    const fields=record?.fields,value=fields?.VALUE;
    const purposeAllowed=historical?['VISUAL_BASELINE_AUTHORIZATION','TRADEOFF_OR_SCOPE_DECISION','HUMAN_AUTHORITY_CORRECTION'].includes(fields?.PURPOSE):fields?.PURPOSE==='VISUAL_BASELINE_AUTHORIZATION';
    if(!object(record)||!object(fields)||record.id!==recordId||fields.HUMAN_DECISION_ID!==recordId||record.source!=='HUMAN_DECISION_COMMAND'||record.active!==true||fields.STATUS!=='CURRENT'||!purposeAllowed||!nonempty(fields.JOB_ID)||fields.TARGET_FAMILY!=='job'||fields.TARGET_ID!==fields.JOB_ID||!humanDecisionPolicy.identityAssuranceSatisfies(fields.PURPOSE,fields.IDENTITY_ASSURANCE).allowed||fields.IDENTITY_ASSURANCE!==humanDecisionPolicy.HUMAN_DECISION_PURPOSE_REGISTRY[fields.PURPOSE]?.currentAvailableIdentityAssurance||!object(fields.SCOPE)||!same(record.scope,fields.SCOPE)||Object.entries(fields).some(([key,item])=>!Object.hasOwn(record,key)||!same(record[key],item))||!instant(fields.VALID_FROM)||(fields.VALID_UNTIL!==''&&(!instant(fields.VALID_UNTIL)||Date.parse(fields.VALID_UNTIL)<=Date.now()))||!object(value)||value.authorized!==true||value.VISUAL_BASELINE_ID!==tuple.VISUAL_BASELINE_ID||value.baselineSha256!==baselineSha256||!nonempty(record.operatorLabel))fail(path,'Visual evidence requires an actual current human-decision record bound to this frozen tuple.');
    if(!object(receipt)||receipt.type!=='REGISTERED_HUMAN_DECISION_RECORDED'||!nonempty(receipt.eventId)||receipt.eventId!==fields?.RECEIPT_ID||receipt.recordId!==recordId||receipt.purpose!==fields?.PURPOSE||receipt.targetFamily!==fields?.TARGET_FAMILY||receipt.targetId!==fields?.TARGET_ID||receipt.operatorLabel!==record?.operatorLabel||receipt.identityAssurance!==fields?.IDENTITY_ASSURANCE||!instant(receipt.createdAt))fail(path.replace(/Record$/,'Receipt'),'Visual evidence requires the matching recorded human-decision receipt.');
  }
  if(evidence.authority==='VISUAL_BASELINE_AUTHORIZATION')decision(evidence.authorityRecord,evidence.authorityReceipt,evidence.authorityRecordId,'authorityRecord');
  else {
    const predecessor=evidence.predecessorRecord;
    if(!object(predecessor)||predecessor.recordId!==evidence.authorityRecordId||predecessor.VISUAL_BASELINE_ID!==tuple.VISUAL_BASELINE_ID||predecessor.baselineSha256!==baselineSha256||!Array.isArray(predecessor.candidates)||predecessor.candidates.length!==1)fail('predecessorRecord','Visual evidence requires one mechanically established approved predecessor bound to this frozen tuple.');
    else {const candidate=predecessor.candidates[0];
      if(!object(candidate)||candidate.sourceCommit!==tuple.sourceCommit||!nonempty(candidate.approvalRecordId)||!stringList(candidate.approvalEvidenceReferences)||!candidate.approvalEvidenceReferences.length||!stringList(candidate.historyEvidenceReferences)||!candidate.historyEvidenceReferences.length)fail('predecessorRecord.candidates[0]','Visual evidence requires actual predecessor approval and history evidence.');
      else decision(candidate.approvalRecord,candidate.approvalReceipt,candidate.approvalRecordId,'predecessorRecord.candidates[0].approvalRecord',{historical:true});
    }
  }
  return {valid:issues.length===0,issues};
}

export function resolveVisualBaselineSubmission({inputJson='',ledgerVisualBaseline=null,eventName,ref,submitter,commit,deploymentManifestDigest,baselineResourceGraph}={}){
  if(typeof inputJson!=='string')throw new TypeError('Visual evidence input must be JSON text.');
  if(!inputJson.trim())return structuredClone(ledgerVisualBaseline);
  if(eventName!=='workflow_dispatch'||ref!=='refs/heads/main'||!nonempty(submitter)||!isCommit(commit))throw new Error('Visual evidence requires authenticated workflow dispatch on exact main.');
  let evidence;
  try{evidence=JSON.parse(inputJson);}catch{throw new Error('Visual evidence input is not valid JSON.');}
  const validation=validateVisualBaselineEvidence(evidence,{commit,deploymentManifestDigest,baselineResourceGraph});
  if(!validation.valid){const error=new Error(validation.issues[0].message);error.issues=structuredClone(validation.issues);throw error;}
  // Retain supplied proof exactly; never fill in comparedCommit or infer approval.
  // Any caller-supplied submitter metadata is replaced by authenticated CI context.
  return {...evidence,submission:{method:'AUTHENTICATED_WORKFLOW_INPUT',submitter,commit,eventName,ref}};
}
