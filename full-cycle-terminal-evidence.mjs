import fs from 'node:fs';
import path from 'node:path';

export const FULL_CYCLE_TERMINAL_EVIDENCE_SCHEMA='closed-loop-full-cycle-terminal-evidence/1';
export const FULL_CYCLE_TERMINAL_EVIDENCE_MAX_AGE_MS=6*60*60*1000;
export const FULL_CYCLE_TERMINAL_EVIDENCE_SOURCE_PATHS=Object.freeze([
  'workbook.js',
  'hash.js',
  'workflow-schema.js',
  'test-runtime.js',
  'workflow-engine.js',
  'prompt-engine.js',
  'response-ingestion.js',
  'project-store.js',
  'test-fixtures.mjs',
  'full-cycle-terminal-evidence.mjs',
  'verify-full-cycle.mjs',
  'verify-controlling-completion.mjs',
  '.github/workflows/pages.yml'
]);

const sha256Pattern=/^[a-f0-9]{64}$/;
const fail=message=>{throw new Error(`FULL_CYCLE_TERMINAL_EVIDENCE_INVALID: ${message}`);};
const requireHash=hash=>{
  for(const name of ['sha256Text','sha256Value','recordSha256','contentRecordSha256','stableStringify','compareUnicodeScalarSequence'])if(typeof hash?.[name]!=='function')fail(`hash runtime omits ${name}.`);
};
const exactKeys=(value,expected,label)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))fail(`${label} must be an object.`);
  const actual=Object.keys(value).sort(),wanted=[...expected].sort();
  if(JSON.stringify(actual)!==JSON.stringify(wanted))fail(`${label} keys differ: expected ${wanted.join(', ')}, received ${actual.join(', ')}.`);
};
const requireSha=(value,label)=>{if(!sha256Pattern.test(String(value||'')))fail(`${label} is not a lowercase SHA-256 digest.`);};
const reportBody=report=>{const body={...report};delete body.reportSha256;return body;};

export function currentFullCycleSourceIdentity(root,hash){
  requireHash(hash);
  const files=FULL_CYCLE_TERMINAL_EVIDENCE_SOURCE_PATHS.map(relativePath=>{
    const absolutePath=path.join(root,relativePath);
    if(!fs.statSync(absolutePath).isFile())fail(`bound source is not a file: ${relativePath}.`);
    return {path:relativePath,sha256:hash.sha256Text(fs.readFileSync(absolutePath,'utf8'))};
  });
  return {algorithm:'SHA-256',canonicalization:'EXACT_UTF8_SOURCE_TEXT',files,sourceSetSha256:hash.sha256Value(files)};
}

export function sealFullCycleTerminalEvidence(body,hash){
  requireHash(hash);
  const clean=reportBody(body);
  return {...clean,reportSha256:hash.sha256Value(clean)};
}

export function writeFullCycleTerminalEvidence(outputPath,body,hash){
  if(!String(outputPath||'').trim())fail('output path is missing.');
  const report=sealFullCycleTerminalEvidence(body,hash);
  fs.writeFileSync(path.resolve(outputPath),`${JSON.stringify(report,null,2)}\n`,{encoding:'utf8',flag:'wx'});
  return report;
}

export function readAndValidateFullCycleTerminalEvidence(inputPath,options){
  if(!String(inputPath||'').trim())fail('input path is missing.');
  const absolutePath=path.resolve(inputPath);
  if(!fs.existsSync(absolutePath))fail(`report is missing: ${absolutePath}.`);
  let report;
  try{report=JSON.parse(fs.readFileSync(absolutePath,'utf8'));}catch(error){fail(`report is not valid JSON: ${error?.message||error}.`);}
  return validateFullCycleTerminalEvidence(report,options);
}

export function validateFullCycleTerminalEvidence(report,{root,hash,now=Date.now(),maxAgeMs=FULL_CYCLE_TERMINAL_EVIDENCE_MAX_AGE_MS}={}){
  requireHash(hash);
  if(!String(root||'').trim())fail('source root is missing.');
  exactKeys(report,['schema','generatedAt','sourceIdentity','execution','project','terminal','reportSha256'],'report');
  if(report.schema!==FULL_CYCLE_TERMINAL_EVIDENCE_SCHEMA)fail(`unexpected schema ${String(report.schema)}.`);
  requireSha(report.reportSha256,'reportSha256');
  if(hash.sha256Value(reportBody(report))!==report.reportSha256)fail('reportSha256 does not bind the complete report body.');

  const generatedAtMs=Date.parse(report.generatedAt);
  if(!Number.isFinite(generatedAtMs))fail('generatedAt is invalid.');
  if(generatedAtMs>Number(now)+5*60*1000)fail('generatedAt is implausibly in the future.');
  if(!Number.isFinite(Number(maxAgeMs))||Number(maxAgeMs)<=0)fail('maximum report age is invalid.');
  if(Number(now)-generatedAtMs>Number(maxAgeMs))fail('report is stale by age.');

  exactKeys(report.sourceIdentity,['algorithm','canonicalization','files','sourceSetSha256'],'sourceIdentity');
  if(report.sourceIdentity.algorithm!=='SHA-256'||report.sourceIdentity.canonicalization!=='EXACT_UTF8_SOURCE_TEXT')fail('source hashing contract differs.');
  if(!Array.isArray(report.sourceIdentity.files))fail('sourceIdentity.files must be an array.');
  const expectedPaths=[...FULL_CYCLE_TERMINAL_EVIDENCE_SOURCE_PATHS],reportedPaths=report.sourceIdentity.files.map(item=>String(item?.path||''));
  if(JSON.stringify(reportedPaths)!==JSON.stringify(expectedPaths))fail('source file set or order differs from the closed evidence contract.');
  for(const [index,item] of report.sourceIdentity.files.entries()){
    exactKeys(item,['path','sha256'],`sourceIdentity.files[${index}]`);
    requireSha(item.sha256,`sourceIdentity.files[${index}].sha256`);
  }
  requireSha(report.sourceIdentity.sourceSetSha256,'sourceIdentity.sourceSetSha256');
  if(hash.sha256Value(report.sourceIdentity.files)!==report.sourceIdentity.sourceSetSha256)fail('sourceSetSha256 is inconsistent.');
  const current=currentFullCycleSourceIdentity(path.resolve(root),hash);
  if(hash.stableStringify(current)!==hash.stableStringify(report.sourceIdentity))fail('report source hashes are stale or do not match the current verifier/runtime/workflow sources.');

  exactKeys(report.execution,['verifier','nodeVersion','elapsedMs','assertions'],'execution');
  if(report.execution.verifier!=='verify-full-cycle.mjs')fail('execution verifier identity differs.');
  if(typeof report.execution.nodeVersion!=='string'||!report.execution.nodeVersion)fail('execution nodeVersion is missing.');
  if(!Number.isFinite(report.execution.elapsedMs)||report.execution.elapsedMs<0)fail('execution elapsedMs is invalid.');
  const assertions=report.execution.assertions;
  exactKeys(assertions,['stagesCompleted','clarificationCycles','confirmedDefects','correctedIterationRuns','unchangedConfirmationRuns','verificationTripleCoverage','release','artifactIdentity','evidenceChains','baselineBackup','finalDeliveryBackup','deliveryState','reloadIntegrity'],'execution.assertions');
  if(assertions.stagesCompleted!==30||assertions.release!=='ACCEPTED'||assertions.deliveryState!=='AUTHORIZED')fail('full-cycle terminal outcome was not ACCEPTED and AUTHORIZED after 30 stages.');
  for(const field of ['artifactIdentity','evidenceChains','baselineBackup','finalDeliveryBackup','reloadIntegrity'])if(assertions[field]!==true)fail(`full-cycle assertion ${field} did not pass.`);
  if(!Number.isFinite(assertions.verificationTripleCoverage)||assertions.verificationTripleCoverage<=0)fail('verification triple coverage is not positive executed evidence.');

  exactKeys(report.project,['jobId','revision','sha256'],'project');
  if(typeof report.project.jobId!=='string'||!report.project.jobId)fail('project jobId is missing.');
  if(!Number.isInteger(report.project.revision)||report.project.revision<0)fail('project revision is invalid.');
  requireSha(report.project.sha256,'project.sha256');

  const terminal=report.terminal;
  exactKeys(terminal,['complete','reasons','releaseId','baselineBackupId','finalBackupId','deliveryId','deliveryState','deliveryRecordHash','deliveryRecordSha256','deliveryContentSha256','proofObligationSetHash','evidenceChainSetHash','registryIntegrityHash','terminalEvidenceHash','humanDeliveryAuthorizationId','authorizedArtifactIds','authorizedArtifacts','deliveryRecord'],'terminal');
  if(terminal.complete!==true||!Array.isArray(terminal.reasons)||terminal.reasons.length)fail('terminal prerequisites were not simultaneously complete.');
  for(const field of ['releaseId','baselineBackupId','finalBackupId','deliveryId','humanDeliveryAuthorizationId'])if(typeof terminal[field]!=='string'||!terminal[field])fail(`terminal ${field} is missing.`);
  if(terminal.deliveryState!=='AUTHORIZED')fail('terminal delivery state is not AUTHORIZED.');
  for(const field of ['deliveryRecordHash','deliveryRecordSha256','deliveryContentSha256','proofObligationSetHash','evidenceChainSetHash','registryIntegrityHash','terminalEvidenceHash'])requireSha(terminal[field],`terminal.${field}`);
  if(!Array.isArray(terminal.authorizedArtifactIds)||!terminal.authorizedArtifactIds.length||new Set(terminal.authorizedArtifactIds).size!==terminal.authorizedArtifactIds.length)fail('authorized artifact IDs are empty or duplicated.');
  if(terminal.authorizedArtifactIds.some(id=>typeof id!=='string'||!id))fail('authorized artifact ID is invalid.');
  const sortedIds=[...terminal.authorizedArtifactIds].sort(hash.compareUnicodeScalarSequence);
  if(JSON.stringify(sortedIds)!==JSON.stringify(terminal.authorizedArtifactIds))fail('authorized artifact IDs are not in canonical order.');
  if(!Array.isArray(terminal.authorizedArtifacts)||terminal.authorizedArtifacts.length!==terminal.authorizedArtifactIds.length)fail('authorized artifact identity count differs.');
  for(const [index,item] of terminal.authorizedArtifacts.entries()){
    exactKeys(item,['artifactId','filename','byteLength','hashAlgorithm','digest'],`terminal.authorizedArtifacts[${index}]`);
    if(item.artifactId!==terminal.authorizedArtifactIds[index]||typeof item.filename!=='string'||!item.filename||!Number.isInteger(item.byteLength)||item.byteLength<0||item.hashAlgorithm!=='SHA-256')fail(`authorized artifact ${index} has an invalid exact identity.`);
    requireSha(item.digest,`terminal.authorizedArtifacts[${index}].digest`);
  }

  const record=terminal.deliveryRecord;
  if(!record||typeof record!=='object'||Array.isArray(record)||!record.fields||typeof record.fields!=='object'||Array.isArray(record.fields))fail('terminal deliveryRecord is invalid.');
  const fields=record.fields;
  const deliveryId=String(fields.DELIVERY_ID||record.id||'');
  if(deliveryId!==terminal.deliveryId||String(record.id||'')!==terminal.deliveryId)fail('delivery ID does not bind the exact canonical record.');
  if(record.active!==true||Number(record.stage)!==30||record.source!=='APPLICATION_DERIVED')fail('delivery record is not the active Stage 30 application-derived record.');
  if(String(fields.JOB_ID||'')!==report.project.jobId)fail('delivery record belongs to another project.');
  if(fields.DELIVERY_STATE!==terminal.deliveryState||fields.DELIVERY_STATE!=='AUTHORIZED')fail('delivery record state differs.');
  if(String(fields.RELEASE_ID||'')!==terminal.releaseId)fail('delivery record release ID differs.');
  if(String(fields.HUMAN_DELIVERY_AUTHORIZATION_ID||'')!==terminal.humanDeliveryAuthorizationId)fail('delivery record human authorization differs.');
  if(Number(fields.EXPECTED_PRECONDITION_REVISION)!==report.project.revision||Number(fields.COMMITTED_PROJECT_REVISION)!==report.project.revision+1)fail('delivery record revision binding differs.');
  const fieldsWithoutHash=Object.fromEntries(Object.entries(fields).filter(([name])=>name!=='DELIVERY_RECORD_HASH'));
  if(String(fields.DELIVERY_RECORD_HASH||'')!==terminal.deliveryRecordHash||hash.sha256Value(fieldsWithoutHash)!==terminal.deliveryRecordHash)fail('delivery record field hash is invalid.');
  if(String(record.recordSha256||'')!==terminal.deliveryRecordSha256||hash.recordSha256(record)!==terminal.deliveryRecordSha256)fail('delivery complete-record hash is invalid.');
  if(String(record.contentSha256||'')!==terminal.deliveryContentSha256||hash.contentRecordSha256(record,'DELIVERY_ID')!==terminal.deliveryContentSha256)fail('delivery content-record hash is invalid.');
  if(String(fields.TERMINAL_PROOF_OBLIGATION_SET_HASH||'')!==terminal.proofObligationSetHash||String(fields.EVIDENCE_CHAIN_SET_SHA256||'')!==terminal.evidenceChainSetHash||String(fields.REGISTRY_INTEGRITY_HASH||'')!==terminal.registryIntegrityHash||String(fields.TERMINAL_EVIDENCE_HASH||'')!==terminal.terminalEvidenceHash)fail('delivery terminal prerequisite hashes differ.');
  if(hash.stableStringify(fields.AUTHORIZED_ARTIFACT_IDS)!==hash.stableStringify(terminal.authorizedArtifactIds))fail('delivery authorized artifact IDs differ.');
  const digests=Array.isArray(fields.HASH_ALGORITHMS_AND_DIGESTS)?fields.HASH_ALGORITHMS_AND_DIGESTS:[],filenames=Array.isArray(fields.AUTHORIZED_FILENAMES)?fields.AUTHORIZED_FILENAMES:[],byteSizes=Array.isArray(fields.BYTE_SIZES)?fields.BYTE_SIZES:[];
  const recordArtifacts=terminal.authorizedArtifactIds.map((artifactId,index)=>{const digest=digests.find(item=>String(item?.artifactId||'')===artifactId)||{};return {artifactId,filename:String(filenames[index]||''),byteLength:Number(byteSizes[index]),hashAlgorithm:String(digest.hashAlgorithm||''),digest:String(digest.digest||'')};});
  if(hash.stableStringify(recordArtifacts)!==hash.stableStringify(terminal.authorizedArtifacts))fail('delivery record artifact identities differ from the terminal report projection.');

  return Object.freeze({
    schema:report.schema,
    reportSha256:report.reportSha256,
    sourceSetSha256:report.sourceIdentity.sourceSetSha256,
    generatedAt:report.generatedAt,
    elapsedMs:report.execution.elapsedMs,
    projectSha256:report.project.sha256,
    deliveryId:terminal.deliveryId,
    deliveryRecordHash:terminal.deliveryRecordHash,
    terminalEvidenceHash:terminal.terminalEvidenceHash,
    authorizedArtifactCount:terminal.authorizedArtifactIds.length,
    report
  });
}
