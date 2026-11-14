import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {evidenceFingerprint,readExecutionReceipt,validateExecutionReceipt,sha} from './verification-evidence.mjs';
import {executeEvidenceProducer} from './collect-verification-evidence.mjs';
import {verificationCatalog} from './verification-evidence-catalog.mjs';

export const COMPARISON_PACKAGE_OWNER='verify-comparison-materiality-package.mjs';
const runtimeSources=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const artifactSha256='6db7dc0e6aa291a1925498c569d8a9ea7bfac60f0af6dfbd01dbc0cd9ae92195';
const requireProof=(condition,message)=>assert(condition,'MATERIALITY_PACKAGE_OWNER_RECEIPT_ORACLE: '+message);

export function validateComparisonPackageProof(receipt,fingerprint=evidenceFingerprint()){
 requireProof(Boolean(receipt),'missing complete package owner receipt; execute '+COMPARISON_PACKAGE_OWNER+' first');
 validateExecutionReceipt(receipt,COMPARISON_PACKAGE_OWNER,fingerprint);
 requireProof(!Object.hasOwn(receipt,'promotion'),'package prerequisite cannot be promoted from another candidate');
 requireProof(receipt.fingerprint.sourceCommit===fingerprint.sourceCommit&&receipt.fingerprint.sourceTree===fingerprint.sourceTree,'package owner candidate commit/tree differs');
 const reports=receipt.reports.filter(report=>Object.hasOwn(report,'materialityPackage'));
 requireProof(reports.length===1,'one complete original package report required');
 const report=reports[0];
 for(const name of runtimeSources)requireProof(report.sourceSha256?.[name]===fingerprint.inputSha256[name],'package runtime source differs: '+name);
 requireProof(report.artifactSha256===artifactSha256,'governing attachment bytes differ from the package fixture');
 const currentBinding={sourceCommit:fingerprint.sourceCommit,sourceTree:fingerprint.sourceTree,sourceInputsSha256:fingerprint.sourceInputsSha256,runtime:fingerprint.runtime,reportSha256:sha(report),artifactId:report.artifactId,artifactSha256:report.artifactSha256,receiptSha256:receipt.receiptSha256,stdoutSha256:receipt.stdoutSha256};
 return {report,currentBinding,provenance:{schema:'closed-loop-comparison-package-prerequisite/1',owner:COMPARISON_PACKAGE_OWNER,command:receipt.command,receiptSha256:receipt.receiptSha256,stdoutSha256:receipt.stdoutSha256,reportSha256:sha(report),sourceCommit:receipt.fingerprint.sourceCommit,sourceTree:receipt.fingerprint.sourceTree,sourceInputsSha256:receipt.fingerprint.sourceInputsSha256,runtime:receipt.fingerprint.runtime,artifactId:report.artifactId,artifactSha256:report.artifactSha256,completeDefaultProducer:true,reusedCompleteOwnerReport:true,packageBodyExecutedDuringCrossRun:false}};
}

export function readCurrentComparisonPackageProof({directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS}={}){
 requireProof(typeof directory==='string'&&directory.length>0,'a current receipt directory is required');
 const fingerprint=evidenceFingerprint();
 const receipt=readExecutionReceipt(directory,COMPARISON_PACKAGE_OWNER,fingerprint);
 return {...validateComparisonPackageProof(receipt,fingerprint),receipt,fingerprint};
}

// The enclosing coordinator owns this prerequisite and its cleanup. The package
// producer and comparison consumer each retain their original 1200-second cap.
// Dependency parameters below isolate routing controls; ordinary callers supply
// only the consumer and optional receipt directory.
export async function withPreparedComparisonPackageProof(consume,{directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,readReceipt=readExecutionReceipt,executeProducer=executeEvidenceProducer,inspectProof=readCurrentComparisonPackageProof}={}){
 requireProof(typeof consume==='function','a checked comparison consumer is required');
 const owned=directory?null:fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-comparison-package-receipts-'));
 const selected=directory||owned,previous=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS;
 try{
  if(!readReceipt(selected,COMPARISON_PACKAGE_OWNER))await executeProducer(COMPARISON_PACKAGE_OWNER,{directory:selected,timeout:1200000});
  const proof=inspectProof({directory:selected});
  process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS=selected;
  return await consume(proof);
 }finally{
  if(previous===undefined)delete process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS;else process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS=previous;
  if(owned)fs.rmSync(owned,{recursive:true,force:true});
 }
}

export async function verifyComparisonPackagePreparationRouting(){
 const cases=[],outer=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS;
 for(const mode of ['missing','present','stale','failed-producer','invalid-prepared','failed-consumer']){
  const events=[];let selected,timeout;
  const options={directory:null,
   readReceipt:(directory,suite)=>{selected=directory;requireProof(suite===COMPARISON_PACKAGE_OWNER,'routing owner changed');events.push('read');if(mode==='stale')throw new Error('CONTROLLED_STALE_PACKAGE_RECEIPT');return mode==='missing'||mode==='failed-producer'||mode==='invalid-prepared'?null:{};},
   executeProducer:async(suite,options)=>{requireProof(suite===COMPARISON_PACKAGE_OWNER&&options.directory===selected,'routing producer changed');events.push('produce');timeout=options.timeout;if(mode==='failed-producer')throw new Error('CONTROLLED_PACKAGE_PRODUCER_FAILURE');fs.writeFileSync(path.join(selected,'prepared-control'),'controlled');},
   inspectProof:({directory})=>{requireProof(directory===selected,'routing inspection directory changed');events.push('inspect');if(mode==='invalid-prepared')throw new Error('CONTROLLED_INVALID_PREPARED_RECEIPT');return {controlledRoutingOnly:true};}
  };
  const run=()=>withPreparedComparisonPackageProof(async proof=>{events.push('consume');requireProof(proof.controlledRoutingOnly===true&&process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS===selected,'consumer preceded prerequisite admission');if(mode==='failed-consumer')throw new Error('CONTROLLED_PACKAGE_CONSUMER_FAILURE');return 'CONTROLLED_CONSUMED';},options);
  if(mode==='missing'||mode==='present')assert.equal(await run(),'CONTROLLED_CONSUMED');
  else await assert.rejects(run,new RegExp({stale:'CONTROLLED_STALE_PACKAGE_RECEIPT','failed-producer':'CONTROLLED_PACKAGE_PRODUCER_FAILURE','invalid-prepared':'CONTROLLED_INVALID_PREPARED_RECEIPT','failed-consumer':'CONTROLLED_PACKAGE_CONSUMER_FAILURE'}[mode]));
  const expected={missing:['read','produce','inspect','consume'],present:['read','inspect','consume'],stale:['read'],'failed-producer':['read','produce'],'invalid-prepared':['read','produce','inspect'],'failed-consumer':['read','inspect','consume']}[mode];
  assert.deepEqual(events,expected);if(events.includes('produce'))assert.equal(timeout,1200000);
  requireProof(!fs.existsSync(selected),'owned prerequisite directory survived cleanup');
  assert.equal(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,outer);cases.push(mode);
 }
 return {comparisonPackagePreparationControls:'PASS',cases,checkedOrdering:true,invalidReceiptNeverRetried:true,ownedCleanupAndEnvironmentRestored:true,producerTimeoutMs:1200000,controlledDependencies:true,actualPackageJourneyExecuted:false};
}

// These controls mutate copies of a genuine producer receipt. They do not run
// the package journey again and never write, promote or re-sign its saved slot.
export function verifyComparisonPackageProofControls(receipt,fingerprint=evidenceFingerprint()){
 const original=sha(receipt),cases=[];
 const reject=(name,mutate,{resign=true,current=fingerprint}={})=>{
  const copy=structuredClone(receipt);mutate(copy);
  if(resign){delete copy.receiptSha256;copy.receiptSha256=sha(copy);}
  assert.throws(()=>validateComparisonPackageProof(copy,current),/EXECUTED_EVIDENCE_ORACLE|MATERIALITY_PACKAGE_OWNER_RECEIPT_ORACLE/,name);
  requireProof(sha(receipt)===original,'a refusal control changed the genuine receipt');
  validateComparisonPackageProof(receipt,fingerprint);cases.push(name);
 };
 assert.throws(()=>validateComparisonPackageProof(null,fingerprint),/missing complete package owner receipt/);cases.push('missing');
 reject('invalid-digest',copy=>{copy.stdoutSha256='0'.repeat(64);},{resign:false});
 reject('incomplete',copy=>{copy.complete=false;});
 reject('failed',copy=>{copy.exitCode=1;copy.outcome='FAIL';});
 reject('focused-invocation',copy=>{copy.command.push('--materiality-package-only');});
 reject('different-candidate',copy=>{copy.fingerprint.sourceCommit='0'.repeat(40);});
 reject('different-tree',copy=>{copy.fingerprint.sourceTree='0'.repeat(40);});
 reject('promoted-candidate',copy=>{copy.promotion={sourceCommit:fingerprint.sourceCommit,sourceTree:fingerprint.sourceTree,verifiedSourceCommit:fingerprint.sourceCommit};});
 reject('stale-source',copy=>{copy.fingerprint.sourceInputsSha256='0'.repeat(64);});
 reject('stale-specification',copy=>{copy.fingerprint.specificationSha256='0'.repeat(64);});
 reject('stale-catalog',copy=>{copy.fingerprint.catalogSha256='0'.repeat(64);});
 reject('different-runtime',copy=>{copy.fingerprint.runtime.node='v0.0.0';});
 reject('changed-runtime-source-map',copy=>{copy.reports[0].sourceSha256['project-store.js']='0'.repeat(64);});
 reject('changed-artifact-bytes',copy=>{copy.reports[0].artifactSha256='0'.repeat(64);});
 reject('missing-required-assertion',copy=>{delete copy.reports[0].backupRestore;});
 reject('changed-observations',copy=>{copy.observations=[];});
 reject('missing-report',copy=>{copy.reports=[];});
 reject('duplicate-report',copy=>{copy.reports.push(structuredClone(copy.reports[0]));});
 const changed=structuredClone(fingerprint);changed.inputSha256['project-store.js']=sha('controlled changed project-store input bytes');changed.sourceInputsSha256=sha(changed.inputSha256);
 reject('current-source-change',()=>{},{current:changed});
 const proof=validateComparisonPackageProof(receipt,fingerprint),check=verificationCatalog['verify-cross-run-comparison.mjs'].checks.find(row=>row.id==='stage-semantic.comparison-materiality.current-package-prerequisite');
 const envelope={comparisonMaterialityPackagePrerequisite:proof.provenance,comparisonPackageCurrentBinding:proof.currentBinding};
 requireProof(check.condition(proof.provenance,envelope)===true,'genuine provenance was rejected');
 for(const [field,value]of [['sourceCommit','1'.repeat(40)],['sourceTree','2'.repeat(40)],['sourceInputsSha256','3'.repeat(64)],['receiptSha256','4'.repeat(64)],['stdoutSha256','5'.repeat(64)],['reportSha256','6'.repeat(64)],['artifactId','ARTIFACT-FOREIGN-CONTROL'],['artifactSha256','7'.repeat(64)]]){
  const changed=structuredClone(envelope);changed.comparisonMaterialityPackagePrerequisite[field]=value;
  requireProof(check.condition(changed.comparisonMaterialityPackagePrerequisite,changed)===false,'plausible foreign provenance passed: '+field);cases.push('foreign-provenance-'+field);
 }
 validateComparisonPackageProof(receipt,fingerprint);cases.push('restored-genuine');
 return {comparisonPackageReceiptControls:'PASS',cases,genuineReceiptUnchanged:true,packageBodyReexecuted:false,controlledReceiptMutations:true,applicationAssertionsNotReexecuted:true};
}
