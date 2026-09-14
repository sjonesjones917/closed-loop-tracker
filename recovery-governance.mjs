import fs from 'node:fs';
import crypto from 'node:crypto';
export const recoveryManifestPath='specification/recovery-requirements.json';
export const recoveryManifest=JSON.parse(fs.readFileSync(new URL(recoveryManifestPath,import.meta.url),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export const recoveryManifestSha256=sha(fs.readFileSync(new URL(recoveryManifestPath,import.meta.url)));
export const recoveryRequirementIds=Object.freeze(recoveryManifest.requirements.filter(row=>row.mandatory).map(row=>row.requirementId));
export function validateRecoveryManifest(manifest=recoveryManifest){
  const source=fs.readFileSync(new URL(manifest.sourceTranscriptionPath,import.meta.url)),lines=source.toString('utf8').split('\n');
  if(sha(source)!==manifest.sourceTranscriptionSha256)throw new Error('Recovery amendment source identity changed.');
  if(manifest.originalStartingCommit!=='76bac0c862388623a0b43124153816bd3de1ac64')throw new Error('The original application starting revision changed.');
  const ids=new Set();
  for(const row of manifest.requirements){
    if(ids.has(row.requirementId)||!row.mandatory||!row.observableExpectedBehavior||!row.productionOwners?.length||!row.requiredEvidence?.length||!row.status||!Array.isArray(row.executedEvidence))throw new Error('Incomplete recovery requirement: '+row.requirementId);
    if(sha(Buffer.from(lines[row.sourceLine-1]||''))!==row.sourceLineSha256)throw new Error('Recovery requirement source mismatch: '+row.requirementId);
    ids.add(row.requirementId);
  }
  const sourceIds=lines.filter(line=>/^[A-Z]+-\d+ \| /.test(line)).map(line=>'RECOVERY-'+line.split(' | ')[0]);
  if(sourceIds.length!==ids.size||sourceIds.some(id=>!ids.has(id)))throw new Error('The amendment requirement universe differs from its controlling transcription.');
  return {amendmentId:manifest.amendmentId,mandatoryCount:ids.size,semanticCompletenessEstablished:false};
}
export function evaluateRecoveryAcceptance(evidence,commit){
  const reasons=[];
  if(!evidence||evidence.amendmentId!==recoveryManifest.amendmentId||evidence.manifestSha256!==recoveryManifestSha256||evidence.sourceCommit!==commit)return {complete:false,reasons:['RECOVERY_EVIDENCE_IDENTITY_REQUIRED'],denominator:recoveryRequirementIds.length,numerator:0};
  const cases=Array.isArray(evidence.cases)?evidence.cases:[],byId=new Map(cases.map(row=>[row.requirementId,row]));
  if(byId.size!==cases.length||cases.some(row=>!recoveryRequirementIds.includes(row.requirementId)))reasons.push('RECOVERY_CASE_UNIVERSE_MISMATCH');
  let numerator=0;
  for(const id of recoveryRequirementIds){const row=byId.get(id);if(row?.result==='PASS'&&row.sourceCommit===commit&&Array.isArray(row.executedCaseIds)&&row.executedCaseIds.length&&new Set(row.executedCaseIds).size===row.executedCaseIds.length&&row.executedCaseIds.every(value=>typeof value==='string'&&value)&&Array.isArray(row.evidenceReferences)&&row.evidenceReferences.length&&row.evidenceReferences.every(value=>typeof value==='string'&&value))numerator++;else reasons.push('RECOVERY_REQUIREMENT_UNPROVEN:'+id);}
  if(evidence.semanticCompletenessReview?.result!=='PASS'||evidence.semanticCompletenessReview?.sourceCommit!==commit||!evidence.semanticCompletenessReview?.evidenceReferences?.length)reasons.push('RECOVERY_SEMANTIC_COVERAGE_REVIEW_REQUIRED');
  return {complete:reasons.length===0&&numerator===recoveryRequirementIds.length,reasons,numerator,denominator:recoveryRequirementIds.length};
}
