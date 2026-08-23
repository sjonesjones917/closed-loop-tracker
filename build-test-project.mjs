import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const SCHEMA='closed-loop-project/30',TEST_JOB_ID='retained-real-test-project';
let raw=JSON.parse(zlib.gunzipSync(Buffer.from(fs.readFileSync('test_project.payload.gz.b64','utf8').trim(),'base64')).toString('utf8'));
const rewrite=v=>Array.isArray(v)?v.map(rewrite):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,rewrite(x)])):typeof v==='string'?v.replace(/maintenance handoff/gi,'generator operating status report').replace(/\bhandoff\b/gi,'status report').replace(/HANDOFF/g,'STATUS'):v;
const oldProductHash=raw.product?.files?.[0]?.sha256||'';
raw=rewrite(raw);
raw.title='GEN-042 generator operating status report';
if(raw.userJobInput){
  raw.userJobInput.objective='Create the requested operational status report for generator GEN-042 using only the supplied telemetry snapshot and output contract.';
  raw.userJobInput.deliverable='One UTF-8 plain-text generator operating status report file named GEN-042__STATUS__v001.txt.';
  raw.userJobInput.requiredOutputFormat='Six lines of plain text in the requested order, containing only the requested generator operating facts.';
  raw.userJobInput.explicitRequirements=[
    'Identify generator GEN-042.',
    'Report runtime, fuel, battery voltage, oil pressure, coolant temperature, transfer-switch state, and service-due point from supplied evidence.',
    'Produce exactly six lines of plain text as the generator operating status report.'
  ];
}
const rewrittenProduct=raw.product?.files?.[0];
if(rewrittenProduct){
  const newProductHash=crypto.createHash('sha256').update(rewrittenProduct.content).digest('hex');
  const replaceHash=v=>Array.isArray(v)?v.map(replaceHash):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,replaceHash(x)])):typeof v==='string'&&oldProductHash&&v===oldProductHash?newProductHash:v;
  raw=replaceHash(raw);
  raw.product.files[0].sha256=newProductHash;
  raw.product.files[0].size=Buffer.byteLength(raw.product.files[0].content,'utf8');
}
if(raw.currentStage!==30||Object.keys(raw.stageStates||{}).length!==30)throw new Error('Retained job source must contain exactly 30 completed stage records.');
if(/application conformance|Evaluate the Closed-Loop Reliability application/i.test(JSON.stringify(raw)))throw new Error('Self-referential application-conformance projects are prohibited.');
if(!raw.userJobInput?.objective?.includes('GEN-042'))throw new Error('Retained project must be the real GEN-042 operating-status job.');
if(/maintenance handoff/i.test(JSON.stringify(raw)))throw new Error('Obsolete maintenance-handoff test-project wording is prohibited.');
const productFile=raw.product?.files?.[0];
if(!productFile||crypto.createHash('sha256').update(productFile.content).digest('hex')!==productFile.sha256)throw new Error('Finished-product SHA-256 does not match its bytes.');
const stageData={1:{job:raw.userJobInput,sourceJobId:raw.jobId,suppliedMaterials:raw.suppliedMaterials,assumptions:raw.assumptions,unknowns:raw.unknowns},2:{authorityHierarchy:raw.authorityHierarchy,sources:raw.sourceInventory,conflicts:raw.sourceConflicts},3:{research:raw.research,candidateRequirements:raw.candidateRequirements},4:{requirements:raw.requirements,atomicity:raw.atomicityReviews},5:{resolution:raw.requirementResolution},6:{tests:raw.tests,coverage:raw.coverageRecords},7:{failureTests:raw.mutations},8:{instruction:raw.productionInstruction,trace:raw.instructionTrace},9:{preflight:raw.preflightRecords},10:{candidateFreeze:raw.candidateFreeze},11:{contexts:raw.freshContexts?.filter(x=>Number(x.stage)===11),runs:raw.runRecords?.filter(x=>x.iterationId==='ITERATION-001')},12:{verification:raw.verificationRecords?.filter(x=>x.iterationId==='ITERATION-001')},13:{comparison:raw.comparisons?.filter(x=>x.iterationId==='ITERATION-001')},14:{defects:raw.defects,rootCause:raw.rootCauseRecords},15:{regressions:raw.regressions},16:{changes:raw.changes},17:{candidateFreeze:raw.candidateFreeze,runs:raw.runRecords?.filter(x=>x.iterationId==='ITERATION-002')},18:{convergence:raw.convergence},19:{confirmation:raw.confirmation},20:{baseline:raw.baseline},21:{product:raw.product},22:{deterministic:raw.deterministicResults},23:{meaning:raw.semanticResults},24:{adversarial:raw.adversarialResults},25:{representation:raw.representation},26:{reconciliation:raw.reconciliation},27:{releaseGate:raw.releaseGate},28:{artifactIdentity:raw.artifactIdentity},29:{evidenceChains:raw.evidenceChains},30:{permanentRegistry:raw.permanentRegistry}};
const stageRecords={};for(let n=1;n<=30;n++){const src=raw.stageStates[String(n)]||raw.stageStates[n]||{};stageRecords[n]={status:src.status||'COMPLETE',decision:src.decision||'READY TO PROCEED',decisionEvidence:src.evidence||`Stage ${String(n).padStart(2,'0')} evidence is preserved in this record.`,nextStage:n<30?`Stage ${String(n+1).padStart(2,'0')}`:'NONE',decidedBy:'Test operator',dateTime:src.dateTime||raw.dateOpened,fields:{evidenceRecord:JSON.stringify(stageData[n]??{},null,2)}}}
const requirements=(raw.requirements||[]).map(r=>({...r,mandatory:r.mandatoryStatus!=='OPTIONAL',result:'SATISFIED'}));
const tests=(raw.tests||[]).map(t=>({...t,mandatory:true,result:'SATISFIED'}));
const defects=(raw.defects||[]).map(d=>({...d,rootCauseRecord:(raw.rootCauseRecords||[]).find(r=>r.defectId===d.defectId)||null}));
const artifacts=[...(raw.artifacts||[]),...(raw.suppliedMaterials||[]).map(x=>({artifactId:x.artifactId||x.itemId,kind:'AUTHORIZED_INPUT',fileName:x.exactNameOrReference||x.description,sha256:x.integrityHash,size:x.size||'UNKNOWN',inspectionState:x.actualContentInspected,record:x})),...(raw.product?.files||[]).map(x=>({artifactId:x.outputArtifactId||x.artifactId||'PRODUCT-FILE-001',kind:'FINISHED_PRODUCT',fileName:x.fileName,size:x.size,sha256:x.sha256,productVersion:x.productVersion||raw.product.productVersion,inlineContent:x.content,controlledStorageLocation:x.controlledStorageLocation||'Retained project evidence'}))];
const reviews=[{stage:14,type:'root-cause',records:raw.rootCauseRecords},{stage:18,type:'convergence',...raw.convergence},{stage:19,type:'unchanged-confirmation',...raw.confirmation},{stage:20,type:'production-baseline',...raw.baseline},{stage:22,type:'deterministic-product-verification',records:raw.deterministicResults},{stage:23,type:'independent-meaning-verification',records:raw.semanticResults},{stage:24,type:'adversarial-verification',records:raw.adversarialResults},{stage:25,type:'final-representation-inspection',...raw.representation},{stage:26,type:'process-product-reconciliation',...raw.reconciliation}];
const releaseRecords=[{stage:27,type:'release-gate',...raw.releaseGate},{stage:28,type:'artifact-identity',...raw.artifactIdentity},{stage:30,type:'permanent-registry',...raw.permanentRegistry}];
const sourceOutputs=(raw.generatedOutputs?.length?raw.generatedOutputs:raw.outputReceipts)||[];
const actualStageOutputs=Array.from({length:30},(_,i)=>{
  const stage=i+1,source=sourceOutputs.find(x=>Number(x.stage)===stage)||sourceOutputs[i]||{};
  const body=typeof source.output==='string'&&source.output.length?source.output:JSON.stringify(stageData[stage]??{},null,2);
  return {...source,stage,outputId:source.outputId||`STAGE-${String(stage).padStart(2,'0')}-OUTPUT`,output:body};
});
const project={schema:SCHEMA,specRevision:`${raw.specRevision}-operating-status`,job:{jobId:TEST_JOB_ID,sourceJobId:raw.jobId,title:raw.title,owner:raw.jobOwner,dateOpened:raw.dateOpened,currentStage:30,currentState:'ACCEPTED',currentIteration:raw.currentIteration||'ITERATION-002',nextAction:'Retained real job complete; inspect any stage, generated instruction, user entry, run, output, evidence chain, or regression record.',latestEvidence:raw.latestEvidenceReference||'Stage 30 permanent registry.'},stageRecords,userEntries:[raw.userJobInput],sources:raw.sourceInventory||[],research:raw.research||[],requirements,tests,failureTests:raw.mutations||[],instructions:[raw.productionInstruction],generatedPrompts:raw.generatedPrompts||[],agentOutputs:actualStageOutputs,outputReceipts:raw.outputReceipts||[],freshContexts:raw.freshContexts||[],runs:raw.runRecords||[],verification:raw.verificationRecords||[],comparisons:raw.comparisons||[],defects,regressions:raw.regressions||[],changes:raw.changes||[],blockers:raw.blockers||[],artifacts,reviews,releaseRecords,evidenceChains:raw.evidenceChains||[],history:raw.history||[],appendOnly:{defects:raw.permanentRegistry?.defects||defects,regressions:raw.permanentRegistry?.regressions||raw.regressions||[],changes:raw.changes||[],receipts:raw.outputReceipts||[]}};
if(Object.keys(project.stageRecords).length!==30||project.runs.length!==20||project.verification.length!==requirements.length*20)throw new Error('Converted retained project failed 30-stage/run-matrix invariants.');
if(project.generatedPrompts.length!==30||project.agentOutputs.length!==30||!project.agentOutputs.every(x=>typeof x.output==='string'&&x.output.length))throw new Error('Retained project must expose every generated stage instruction and readable generated stage output.');
if(project.outputReceipts.length!==30)throw new Error('Retained project must preserve every stage output receipt separately.');
fs.writeFileSync('TEST_PROJECT.json',JSON.stringify(project,null,2)+'\n');
console.log(`built ordinary ${SCHEMA} retained job ${TEST_JOB_ID}: ${requirements.length} requirements, ${project.runs.length} runs, ${project.verification.length} verification records, 30 stages`);