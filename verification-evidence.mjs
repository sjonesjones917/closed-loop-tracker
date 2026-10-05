// Repository verification evidence. This module is never shipped to the app.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import './hash.js';
import {verificationCatalog,metricCatalog,zeroCatalog,negativePopulationCatalog} from './verification-evidence-catalog.mjs';

export const RECEIPT_SCHEMA='closed-loop-executed-verification-receipt/1';
export const SPECIFICATION_PATH='specification/closed-loop-reliability-controlling-implementation-specification.txt';
export const sha=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const requireEvidence=(condition,message)=>{if(!condition)throw new Error('EXECUTED_EVIDENCE_ORACLE: '+message);};
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
// Full-clause proof is an optional, independently reviewed declaration over the
// existing assertion bindings. Execution identities and outcomes are derived
// later from current receipts; no future receipt digest enters source inputs.
const validatedEvidenceDigests=new WeakMap();
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const normativeManifestPath=SPECIFICATION_PATH.replace('closed-loop-reliability-controlling-implementation-specification.txt','closed-loop-normative-requirements.json');
export function coverageDeclarationSha256(coverage){const declaration={...coverage};delete declaration.review;return globalThis.closedLoopHash.sha256Value(declaration);}
export function evaluateFullRequirementProof(requirement,bindings,observations,fingerprint){
  const complete=bindings.filter(binding=>binding.fullCoverage),reasons=[];
  const result={normativeRequirementId:requirement.normativeRequirementId,sourceLineSha256:requirement.sourceLocation.lineSha256,disposition:'UNKNOWN',reasons,executedAssertions:[]};
  if(complete.length!==1){reasons.push(complete.length?'AMBIGUOUS_FULL_COVERAGE_DECLARATIONS':'NO_REVIEWED_FULL_COVERAGE_DECLARATION');return result;}
  const binding=complete[0],coverage=binding.fullCoverage;
  const reject=reason=>reasons.push(reason);
  if(coverage.schema!=='closed-loop-full-requirement-coverage/1'||coverage.sourceLineSha256!==requirement.sourceLocation.lineSha256||coverage.schemaOrRegistryEntry!==requirement.schemaOrRegistryEntry)reject('COVERAGE_SOURCE_OR_REGISTRY_MISMATCH');
  if(!Array.isArray(coverage.unresolvedObligations)||coverage.unresolvedObligations.length)reject('UNRESOLVED_COVERAGE_OBLIGATIONS');
  const owners=coverage.productionOwners;
  if(!Array.isArray(owners)||!owners.length||owners.some(owner=>!plain(owner)||!nonempty(owner.path)||!nonempty(owner.symbol)||!/\.(?:m?js|html|ya?ml)$/.test(owner.path)||!nonempty(fingerprint.inputSha256[owner.path])||fingerprint.inputSha256[owner.path]!==owner.sha256))reject('MISSING_OR_STALE_PRODUCTION_OWNER');
  const reviewRef=coverage.review;let retainedReview=null;
  if(!plain(reviewRef)||!/^verification\/[^/\\]+\.json$/.test(reviewRef.path||'')||fingerprint.inputSha256[reviewRef.path]!==reviewRef.sha256)reject('MISSING_OR_STALE_COVERAGE_REVIEW');
  else {
    let review;try{review=readJson(reviewRef.path);}catch{reject('UNREADABLE_COVERAGE_REVIEW');}
    if(!plain(review))reject('INVALID_COVERAGE_REVIEW_RECORD');
    else {
      retainedReview=review;
      if(review.schema!=='closed-loop-requirement-coverage-review/1'||review.normativeRequirementId!==requirement.normativeRequirementId||review.sourceLineSha256!==requirement.sourceLocation.lineSha256||review.specificationSha256!==fingerprint.specificationSha256||review.declarationSha256!==coverageDeclarationSha256(coverage))reject('COVERAGE_REVIEW_BINDING_MISMATCH');
      if(review.decision!=='COMPLETE_COVERAGE'||review.evidenceBasis!=='EXTERNALLY_SUPPORTED'||!nonempty(review.method)||!nonempty(review.author?.actor)||!nonempty(review.author?.contextId)||!nonempty(review.reviewer?.actor)||!nonempty(review.reviewer?.contextId)||review.author.contextId===review.reviewer.contextId||!Array.isArray(review.reviewedInputs)||!review.reviewedInputs.length||!Array.isArray(review.findings)||review.findings.length||review.reviewPerformed!==true)reject('INCOMPLETE_OR_SELF_COVERAGE_REVIEW');
      const reviewedInputs=Array.isArray(review.reviewedInputs)?review.reviewedInputs:[];
      if(!reviewedInputs.some(input=>input?.path===SPECIFICATION_PATH&&input.sha256===fingerprint.specificationSha256)||!reviewedInputs.some(input=>input?.declarationSha256===coverageDeclarationSha256(coverage))||(Array.isArray(owners)?owners:[]).some(owner=>!plain(owner)||!reviewedInputs.some(input=>input?.path===owner.path&&input.sha256===owner.sha256)))reject('COVERAGE_REVIEW_INPUTS_INCOMPLETE');
    }
  }
  const obligations=coverage.obligations;
  if(!Array.isArray(obligations)||!obligations.length||obligations.some(obligation=>!plain(obligation)||!nonempty(obligation.id)||!nonempty(obligation.sourceText)||!nonempty(obligation.expectedBehavior))||new Set(obligations.map(obligation=>obligation.id)).size!==obligations.length||obligations.map(obligation=>obligation.sourceText).join('')!==requirement.controllingText){reject('INCOMPLETE_SOURCE_OBLIGATION_DECOMPOSITION');return result;}
  if((requirement.requiredBrowserOrPhysicalDeviceProof||[]).length)reject('REQUIRED_BROWSER_OR_PHYSICAL_PROOF_NOT_ESTABLISHED_BY_SYNTHETIC_RECEIPTS');
  const references=[];
  for(const obligation of obligations){
    const observedKinds=new Set();
    if(!Array.isArray(obligation.evidenceKinds)||!obligation.evidenceKinds.length||obligation.evidenceKinds.some(kind=>!['EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS','EXECUTED_SCHEMA_METADATA_ASSERTIONS'].includes(kind)))reject('UNSUPPORTED_REQUIRED_EVIDENCE_KIND');
    for(const role of ['deterministic','semantic','mutation']){
      const checks=obligation.checks?.[role];
      if(!Array.isArray(checks)||(!checks.length&&(role==='deterministic'||!nonempty(obligation.nonapplicable?.[role])))){reject('REQUIRED_CHECK_ROLE_UNACCOUNTED');continue;}
      for(const reference of checks){
        const observation=observations.get(reference?.checkId);
        if(!plain(reference)||!nonempty(reference.suite)||!nonempty(reference.checkId)||!binding.checkIds.includes(reference.checkId)||!observation||observation.suite!==reference.suite||observation.passed!==true){reject('REQUIRED_CURRENT_ASSERTION_MISSING_OR_WRONG_PRODUCER');continue;}
        if(!['EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS','EXECUTED_SCHEMA_METADATA_ASSERTIONS'].includes(observation.evidenceBasis))reject('UNSUPPORTED_ASSERTION_EVIDENCE_BASIS');
        observedKinds.add(observation.evidenceBasis);
        for(const inputPath of [reference.suite,'verification-evidence-catalog.mjs',...(verificationCatalog[reference.suite]?.sourceInputs||[])])if(!(Array.isArray(retainedReview?.reviewedInputs)?retainedReview.reviewedInputs:[]).some(input=>input?.path===inputPath&&input?.sha256===fingerprint.inputSha256[inputPath]))reject('COVERAGE_REVIEW_TEST_INPUT_MISMATCH');
        references.push({role,obligationId:obligation.id,checkId:observation.checkId,suite:observation.suite,receiptSha256:observation.receiptSha256});
      }
    }
    if(Array.isArray(obligation.evidenceKinds)&&obligation.evidenceKinds.some(kind=>!observedKinds.has(kind)))reject('REQUIRED_EVIDENCE_KIND_NOT_OBSERVED');
  }
  if(new Set(references.map(reference=>reference.checkId)).size!==new Set(binding.checkIds).size)reject('FULL_COVERAGE_CHECK_UNIVERSE_MISMATCH');
  result.reasons=[...new Set(reasons)];result.executedAssertions=references;result.review=coverage.review;result.declarationSha256=coverageDeclarationSha256(coverage);
  if(!result.reasons.length){result.disposition='CONFORMANT_PROVEN';result.testTraceStatus='EXECUTED_REQUIREMENT_CASES';result.productionOwnerStatus='VERIFIED_PRODUCTION_OWNER';}
  return result;
}
function normativeProofSummary(evidence){
  const proof=evidence.fullRequirementProofs,rows=proof?.requirements||[],proven=rows.filter(row=>row.disposition==='CONFORMANT_PROVEN'),complete=rows.length>0&&proven.length===rows.length;
  return {metricId:'NORMATIVE_REQUIREMENT_TRACE_COVERAGE',derivationVersion:'closed-loop-current-normative-proof/1',universeDefinition:'Every stable source requirement ID in the exact current normative manifest, with independently reviewed complete source-obligation coverage and current executed proof.',numerator:proven.length,denominator:rows.length,includedIds:rows.map(row=>row.normativeRequirementId),excludedIds:[],scopeHash:sha({fingerprint:evidence.fingerprint,proof}),evidenceReferences:[...new Set(proven.flatMap(row=>row.executedAssertions.map(assertion=>`${assertion.suite}.json#${assertion.checkId}`)))],value:complete?1:null,disposition:complete?'SATISFIED':'UNKNOWN',evidenceBasis:'REVIEWED_FULL_SOURCE_COVERAGE_AND_CURRENT_EXECUTED_RECEIPTS',qualifiedExecutedRequirementCount:evidence.normativeRequirementTrace.filter(row=>row.disposition==='QUALIFIED_EXECUTED_ASSERTION_EVIDENCE').length,fullClauseConformanceEstablished:complete};
}
export function validateFinalNormativeProof(report,evidence){
  const validated=plain(evidence)?validatedEvidenceDigests.get(evidence):null;
  requireEvidence(validated&&validated.digest===sha(evidence),'final normative proof requires unchanged revalidated current executed evidence');
  const current=evidenceFingerprint(validated.cwd);
  requireEvidence(current.sourceCommit===evidence.fingerprint.sourceCommit&&current.sourceInputsSha256===evidence.fingerprint.sourceInputsSha256&&current.specificationSha256===evidence.fingerprint.specificationSha256,'final normative proof source changed after receipt validation');
  requireEvidence(report.commit===evidence.fingerprint.sourceCommit,'final normative proof belongs to a different candidate');
  requireEvidence(isDeepStrictEqual(report.executedVerificationEvidence?.fingerprint,evidence.fingerprint)&&report.executedVerificationEvidence?.evidenceSha256===evidence.evidenceSha256,'final normative execution identity differs from revalidated evidence');
  const expected=normativeProofSummary(evidence);
  requireEvidence(isDeepStrictEqual(report.section49CoverageMetrics?.normativeRequirementTraceCoverage,expected)&&report.normativeRequirementTraceCoverage===expected.value,'final normative metric does not derive from the exact current requirement universe');
  requireEvidence(isDeepStrictEqual(report.fullRequirementProofs,evidence.fullRequirementProofs)&&isDeepStrictEqual(report.normativeRequirementTrace,evidence.normativeRequirementTrace),'final normative proof trace differs from current source/receipts');
  requireEvidence(expected.fullClauseConformanceEstablished===true,'mandatory normative implementation or proof remains unestablished');
  return true;
}

export function evidenceFingerprint(cwd=process.cwd()){
  // Generated retained fixtures and progress/artifact directories are excluded.
  // All first-party executable/configuration/specification inputs are included,
  // including newly added regression files before they have been committed.
  const tracked=execFileSync('git',['ls-files','-z'],{cwd,encoding:'utf8'}).split('\0').filter(name=>name&&name!=='TEST_PROJECT.json'&&/\.(?:m?js|html|css|json|txt|ya?ml)$/.test(name));
  // An approved proposal and its source-only approval review are active
  // governance inputs, including before their new files have been committed.
  // Ordinary Markdown documentation is outside this execution-input policy.
  const declaration=path.join(cwd,'specification/requirement-evidence-bindings.json');
  const governance=fs.existsSync(declaration)?JSON.parse(fs.readFileSync(declaration,'utf8')):{},amendments=governance.approvedAmendments||[],independentSourceReview=governance.independentSourceReview;
  const assertionPath=path.join(cwd,'verification-assertion-bindings.json'),fullCoverageReviewPaths=fs.existsSync(assertionPath)?(JSON.parse(fs.readFileSync(assertionPath,'utf8')).bindings||[]).flatMap(binding=>binding.fullCoverage?.review?.path?[binding.fullCoverage.review.path]:[]):[];
  const governed=[...fullCoverageReviewPaths,...(independentSourceReview?[independentSourceReview.sourceReviewPath,independentSourceReview.reconciliationPath]:[]),...amendments.flatMap(amendment=>['sourceReviewPath','approvedProposalPath'].map(key=>amendment[key])),...Object.values(verificationCatalog).flatMap(suite=>suite.sourceInputs||[])];
  const sourceRoot=fs.realpathSync(cwd)+path.sep;
  for(const name of governed){
    requireEvidence(typeof name==='string'&&/^verification\/[^/\\]+\.(?:json|md)$/.test(name)&&path.posix.normalize(name)===name,'declared governance or verifier input must be an exact first-party verification path');
    requireEvidence(fs.realpathSync(path.join(cwd,name)).startsWith(sourceRoot),'declared governance or verifier input is outside the first-party source root');
  }
  const inputs=[...new Set([...tracked,...governed,...fs.readdirSync(cwd).filter(name=>!name.startsWith('.')&&/\.(?:m?js|html|css)$/.test(name)),...['verification-assertion-bindings.json','verification-negative-populations.json'].filter(name=>fs.existsSync(path.join(cwd,name)))])];
  const inputSha256=Object.fromEntries(inputs.sort().map(name=>[name,sha(fs.readFileSync(path.join(cwd,name)))]));
  return {sourceCommit:git(cwd,'rev-parse','HEAD'),sourceTree:git(cwd,'rev-parse','HEAD^{tree}'),sourceInputsSha256:sha(inputSha256),inputSha256,specificationSha256:inputSha256[SPECIFICATION_PATH],runtime:{node:process.version,platform:process.platform,architecture:process.arch},catalogSha256:inputSha256['verification-evidence-catalog.mjs']};
}
export function executionReports(stdout){
  const reports=String(stdout).trim().split(/\n(?=\{)/).map(text=>JSON.parse(text));
  requireEvidence(reports.length>0&&reports.every(row=>row&&typeof row==='object'&&!Array.isArray(row)),'child did not emit complete JSON report objects');
  return reports;
}
function valueAt(object,pointer){return pointer.split('.').reduce((value,key)=>value?.[key],object);}
function selectedReport(reports,marker){const selected=reports.filter(report=>Object.hasOwn(report,marker));requireEvidence(selected.length===1,`expected exactly one report marker ${marker}; received ${selected.length}`);return selected[0];}
export function observationsFromReports(suite,reports){
  const definition=verificationCatalog[suite];requireEvidence(definition,`unregistered producer ${suite}`);
  const ownedReports=new Set();
  const observations=definition.checks.map(check=>{
    const report=selectedReport(reports,check.marker),observed=valueAt(report,check.path);
    ownedReports.add(report);
    const passed=check.condition?check.condition(observed,report):isDeepStrictEqual(observed,check.expected);
    return {checkId:check.id,requirementRefs:check.requirementRefs||[],assertionReference:check.assertionReference,boundary:check.boundary||definition.boundary,expected:check.expected??check.expectedDescription,observed:observed===undefined?null:observed,passed,evidenceBasis:check.basis||'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS',...(check.violation?{violation:check.violation,accepted:!passed}:{}),...(check.coverageIds?{coverageIds:check.coverageIds(report)}:{}),...(check.excludedIds?{excludedIds:check.excludedIds(report)}:{})};
  });
  const emittedIds=new Set(observations.map(row=>row.checkId));
  for(const report of reports)for(const observation of report.verificationObservations||[]){
    requireEvidence(typeof observation.checkId==='string'&&observation.checkId&&typeof observation.passed==='boolean'&&typeof observation.boundary==='string'&&Object.hasOwn(observation,'expected')&&Object.hasOwn(observation,'observed'),'malformed emitted assertion observation');
    // Imported verifier reports remain complete evidence in receipt.reports,
    // and every emitted assertion must still be well formed, unique and pass.
    // Only this producer's exact catalog-selected reports publish its detailed
    // assertion identities. An importing wrapper cannot replace the required
    // canonical producer receipt or claim its assertions a second time.
    requireEvidence(!emittedIds.has(observation.checkId),`duplicate emitted assertion ${observation.checkId}`);
    emittedIds.add(observation.checkId);
    requireEvidence(observation.passed,`producer ${suite} reported a failed or missing required assertion ${observation.checkId}`);
    if(ownedReports.has(report))observations.push({...observation,evidenceBasis:'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS'});
  }
  const population=negativePopulationCatalog[suite];
  if(population){
    const actual=reports.flatMap(report=>report.negativeCasePopulation||[]);
    requireEvidence(actual.length===population.cases.length&&new Set(actual.map(row=>row.caseId)).size===actual.length,`missing/duplicate negative population ${suite}`);
    for(const expected of population.cases){
      const row=actual.find(value=>value.caseId===expected.caseId);
      requireEvidence(row&&row.checkId===expected.checkId&&row.violation===expected.violation&&row.result==='PASS'&&row.accepted===false&&typeof row.boundary==='string'&&row.observed,`failed/missing negative case ${suite}:${expected.caseId}`);
      observations.push({checkId:`negativecase.${suite}.${row.caseId}`,boundary:row.boundary,assertionReference:row.checkId,expected:'REJECTED_WITH_CANONICAL_STATE_PRESERVED',observed:row.observed,passed:row.result==='PASS'&&row.accepted===false,violation:row.violation,accepted:row.accepted,evidenceBasis:'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS',scopeLimit:population.scopeLimit});
    }
  }
  requireEvidence(new Set(observations.map(row=>row.checkId)).size===observations.length,'duplicate assertion observations');
  return observations;
}
export function createExecutionReceipt(suite,result,{cwd=process.cwd(),fingerprint=evidenceFingerprint(cwd)}={}){
  requireEvidence(result.exitCode===0&&result.outcome==='PASS'&&!result.signal&&!result.reason&&!result.error,`producer ${suite} failed or did not finish`);
  const reports=executionReports(result.stdout),observations=observationsFromReports(suite,reports);
  requireEvidence(observations.every(row=>row.passed),`producer ${suite} reported a failed or missing required assertion`);
  const producerFileSha256=sha(fs.readFileSync(path.resolve(cwd,result.command?.[1]||suite)));
  requireEvidence(producerFileSha256===fingerprint.inputSha256[suite],`producer script differs from current repository ${suite}`);
  const receipt={schema:RECEIPT_SCHEMA,suite,fingerprint,producerFileSha256,command:result.command,exitCode:result.exitCode,outcome:result.outcome,complete:true,stdoutSha256:sha(result.stdout),stderrSha256:sha(result.stderr||''),reports,observations};
  receipt.receiptSha256=sha(receipt);return receipt;
}
export function validateExecutionReceipt(receipt,suite,fingerprint){
  requireEvidence(receipt?.schema===RECEIPT_SCHEMA&&receipt.suite===suite,'receipt schema/producer mismatch');
  const {receiptSha256,...payload}=receipt;requireEvidence(receiptSha256===sha(payload),'receipt content digest mismatch');
  requireEvidence(receipt.complete===true&&receipt.exitCode===0&&receipt.outcome==='PASS','failed/incomplete receipt');
  requireEvidence(receipt.producerFileSha256===fingerprint.inputSha256[suite],'receipt producer bytes are not the current registered verifier');
  requireEvidence(receipt.fingerprint?.sourceInputsSha256===fingerprint.sourceInputsSha256&&receipt.fingerprint.specificationSha256===fingerprint.specificationSha256&&receipt.fingerprint.catalogSha256===fingerprint.catalogSha256&&isDeepStrictEqual(receipt.fingerprint.runtime,fingerprint.runtime),'stale source/specification/catalog/runtime receipt');
  // Same tree promotion is permitted only through the verified-site owner. The
  // original tested commit stays visible; equal input bytes never rewrite it.
  requireEvidence(receipt.fingerprint.sourceCommit===fingerprint.sourceCommit||receipt.promotion?.sourceCommit===fingerprint.sourceCommit&&receipt.promotion.sourceTree===fingerprint.sourceTree&&receipt.promotion.sourceTree===receipt.fingerprint.sourceTree&&receipt.promotion.verifiedSourceCommit===receipt.fingerprint.sourceCommit,'receipt belongs to a different candidate revision');
  const expected=observationsFromReports(suite,receipt.reports);
  requireEvidence(isDeepStrictEqual(expected,receipt.observations)&&expected.every(row=>row.passed),'receipt assertions differ from actual executed report');
  requireEvidence(sha(receipt.reports)!==sha([]),'empty executed report');
  return receipt;
}
export function recordExecutionReceipt(result,{cwd=process.cwd(),directory=process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS}={}){
  if(!directory)return null;
  const suite=path.basename(result.command?.[1]||'');if(!verificationCatalog[suite])return null;
  const receipt=createExecutionReceipt(suite,result,{cwd});fs.mkdirSync(directory,{recursive:true});
  const file=path.resolve(directory,suite+'.json');
  if(fs.existsSync(file)){
    // Retain already valid evidence for unchanged inputs. A newly failed child
    // never reaches this branch: its failure replaces the old receipt above.
    const existing=readJson(file);
    try{return validateExecutionReceipt(existing,suite,receipt.fingerprint);}catch{
      // A newly executed, current, successful producer may supersede invalid
      // evidence. Preserve its bytes; validation never treats it as current.
      const superseded=path.join(directory,'superseded');fs.mkdirSync(superseded,{recursive:true});fs.copyFileSync(file,path.join(superseded,suite+'.'+sha(existing)+'.json'));
    }
  }
  const temporary=file+'.'+crypto.randomUUID()+'.partial';fs.writeFileSync(temporary,JSON.stringify(receipt,null,2)+'\n');fs.renameSync(temporary,file);return receipt;
}
export function readExecutionReceipts(directory,fingerprint=evidenceFingerprint()){
  const receipts=new Map();
  for(const suite of Object.keys(verificationCatalog)){
    const file=path.join(directory,suite+'.json');if(!fs.existsSync(file))continue;
    // A stale or corrupt mandatory receipt is a failed evidence handoff, rather
    // than a reason to silently reuse or replace an old green result.
    const receipt=validateExecutionReceipt(readJson(file),suite,fingerprint);receipts.set(suite,receipt);
  }
  return receipts;
}
export function aggregateExecutedEvidence(receipts,fingerprint){
  const observations=new Map(),receiptRefs=[];
  for(const [suite,receipt] of receipts){validateExecutionReceipt(receipt,suite,fingerprint);receiptRefs.push(`${suite}.json#${receipt.receiptSha256}`);for(const observation of receipt.observations){requireEvidence(!observations.has(observation.checkId),`duplicate observation ${observation.checkId}`);observations.set(observation.checkId,{...observation,suite,receiptSha256:receipt.receiptSha256});}}
  const metrics={};
  for(const [name,definition]of Object.entries(metricCatalog)){
    const expected=definition.checkIds;requireEvidence(expected.length>0&&new Set(expected).size===expected.length,`empty/duplicate metric universe ${name}`);
    const rows=expected.flatMap(id=>{const observation=observations.get(id),ids=observation?.coverageIds;if(ids){requireEvidence(Array.isArray(ids)&&ids.length>0&&new Set(ids).size===ids.length,`invalid enumerated assertion universe ${id}`);return ids.map(member=>({id:`${id}:${member}`,observation}));}return [{id,observation}];});
    const includedIds=rows.map(row=>row.id),missing=rows.filter(row=>!row.observation).map(row=>row.id),failed=rows.filter(row=>row.observation&&!row.observation.passed).map(row=>row.id),numerator=rows.length-missing.length-failed.length;
    const exclusions=expected.flatMap(id=>observations.get(id)?.excludedIds||[]);
    requireEvidence(exclusions.every(row=>row&&typeof row.id==='string'&&row.id&&typeof row.reason==='string'&&row.reason)&&new Set(exclusions.map(row=>row.id)).size===exclusions.length,`invalid/duplicate metric exclusion reason ${name}`);
    requireEvidence(new Set(includedIds).size===includedIds.length,`duplicate expanded metric universe ${name}`);
    metrics[name]={metricId:definition.metricId,derivationVersion:'closed-loop-executed-metrics/1',universeDefinition:definition.universeDefinition,numerator,denominator:rows.length,includedIds,excludedIds:[...(definition.excludedIds||[]),...exclusions],scopeHash:sha({fingerprint,checkIds:includedIds,exclusions}),evidenceReferences:[...new Set(rows.filter(row=>row.observation).map(row=>`${row.observation.suite}.json#${row.observation.checkId}`))],value:missing.length?null:numerator/rows.length,disposition:missing.length?'UNKNOWN':failed.length?'VIOLATED':'SATISFIED',evidenceBasis:'CURRENT_CANDIDATE_EXECUTED_ASSERTIONS',applicationConformanceEstablished:false,missingIds:missing,failedIds:failed,scopeLimit:definition.scopeLimit};
  }
  const zeroCounts={},negativePopulations={};
  for(const [name,definition]of Object.entries(zeroCatalog)){
    const expected=definition.checkIds,missing=expected.filter(id=>!observations.has(id)),observed=expected.filter(id=>observations.has(id)).map(id=>observations.get(id));
    requireEvidence(expected.length>0&&new Set(expected).size===expected.length,`empty/duplicate negative population ${name}`);
    zeroCounts[name]=missing.length?null:observed.filter(row=>row.accepted!==false).length;
    negativePopulations[name]={populationDefinition:definition.populationDefinition,includedIds:expected,excludedIds:definition.excludedIds||[],observedIds:observed.map(row=>row.checkId),missingIds:missing,acceptedViolationIds:observed.filter(row=>row.accepted!==false).map(row=>row.checkId),count:zeroCounts[name],evidenceReferences:observed.map(row=>`${row.suite}.json#${row.checkId}`),scopeHash:sha({fingerprint,expected}),scopeLimit:definition.scopeLimit};
  }
  const normative=readJson(SPECIFICATION_PATH.replace('closed-loop-reliability-controlling-implementation-specification.txt','closed-loop-normative-requirements.json'));
  const assertionBindings=fs.existsSync('verification-assertion-bindings.json')?readJson('verification-assertion-bindings.json'):{schema:'closed-loop-verification-assertion-bindings/1',specificationSha256:normative.specificationSha256,bindings:[]};
  requireEvidence(assertionBindings.schema==='closed-loop-verification-assertion-bindings/1'&&assertionBindings.specificationSha256===fingerprint.specificationSha256,'assertion bindings use a different controlling specification');
  requireEvidence(sha(fs.readFileSync('verification-assertion-bindings.json'))===fingerprint.inputSha256['verification-assertion-bindings.json'],'normative assertion declarations are not current source inputs');
  const requirementsById=new Map(normative.requirements.map(row=>[row.normativeRequirementId,row]));
  for(const binding of assertionBindings.bindings){
    const requirement=requirementsById.get(binding.normativeRequirementId);
    requireEvidence(requirement&&requirement.sourceLocation.lineSha256===binding.sourceLineSha256&&Array.isArray(binding.checkIds)&&binding.checkIds.length>0&&typeof binding.scope==='string'&&binding.scope&&['EXECUTED_DETERMINISTIC_BOUNDARY','EXECUTED_WIRING_BOUNDARY'].includes(binding.basis),'invalid exact requirement/assertion binding');
  }
  const normativeRequirementTrace=normative.requirements.map(requirement=>{
    const bindings=assertionBindings.bindings.filter(binding=>binding.normativeRequirementId===requirement.normativeRequirementId),ids=[...new Set(bindings.flatMap(binding=>binding.checkIds))],linked=ids.filter(id=>observations.has(id)).map(id=>observations.get(id)),missingIds=ids.filter(id=>!observations.has(id));
    return {normativeRequirementId:requirement.normativeRequirementId,sourceLocation:requirement.sourceLocation,sourceLineSha256:requirement.sourceLocation.lineSha256,controllingText:requirement.controllingText,disposition:linked.length&&missingIds.length===0&&linked.every(row=>row.passed)?'QUALIFIED_EXECUTED_ASSERTION_EVIDENCE':'UNKNOWN',implementationClassification:linked.length?'implemented but insufficiently tested':null,implementationEvidenceDisposition:linked.length?'QUALIFIED_SCOPED_IMPLEMENTATION_EVIDENCE':'INSUFFICIENT_CURRENT_EVIDENCE_TO_CLASSIFY_IMPLEMENTATION',scopeBindings:bindings.map(binding=>({scope:binding.scope,basis:binding.basis,checkIds:binding.checkIds})),missingAssertionIds:missingIds,executedAssertions:linked.map(row=>({checkId:row.checkId,suite:row.suite,boundary:row.boundary,assertionReference:row.assertionReference,expected:row.expected,observed:row.observed,receiptSha256:row.receiptSha256,evidenceBasis:row.evidenceBasis})),reason:linked.length?'Exact linked assertions establish their stated boundary. Long clauses retain unproved semantic/operator/environment obligations; no full-clause success is inferred.':'No requirement-specific current executed assertion binding. Candidate file mappings do not establish whether the implementation conforms, is missing, or requires unavailable external proof.'};
  });
  const fullRequirementProofs={schema:'closed-loop-full-requirement-proof/1',specificationSha256:fingerprint.specificationSha256,normativeManifestSha256:sha(fs.readFileSync(normativeManifestPath)),normativeManifestIdentity:normative.manifestIdentity,requirements:normative.requirements.map(requirement=>evaluateFullRequirementProof(requirement,assertionBindings.bindings.filter(binding=>binding.normativeRequirementId===requirement.normativeRequirementId),observations,fingerprint))};
  requireEvidence(fullRequirementProofs.normativeManifestSha256===fingerprint.inputSha256[normativeManifestPath],'normative proof manifest is not the current source input');
  const contractRequirementTrace=(assertionBindings.contractRefs||[]).map(binding=>{
    const source=binding.source,lines=fs.readFileSync(source.path,'utf8').split('\n');
    requireEvidence(sha(lines[source.startLine-1])===binding.sourceLineSha256,'amendment assertion binding source line changed');
    const linked=binding.checkIds.filter(id=>observations.has(id)).map(id=>observations.get(id));
    return {...binding,disposition:linked.length===binding.checkIds.length?'QUALIFIED_EXECUTED_ASSERTION_EVIDENCE':'UNKNOWN',executedAssertions:linked.map(row=>({checkId:row.checkId,suite:row.suite,boundary:row.boundary,expected:row.expected,observed:row.observed,receiptSha256:row.receiptSha256})),fullClauseConformanceEstablished:false};
  });
  // The handoff contract is JSON. Optional properties absent from an executed
  // observation stay absent; explicit nulls remain null. Return the exact value
  // that is persisted so a genuine report round trip cannot differ merely
  // because an in-memory optional member was undefined before serialization.
  return JSON.parse(JSON.stringify({schema:'closed-loop-executed-verification-evidence/1',fingerprint,receiptCount:receipts.size,observationCount:observations.size,receiptReferences:receiptRefs,metrics,zeroCounts,negativePopulations,normativeRequirementTrace,fullRequirementProofs,contractRequirementTrace,sourceInspectionIsBehavioralProof:false}));
}
export function readExecutedEvidence(file,fingerprint=evidenceFingerprint()){
  const evidence=readJson(file),{evidenceSha256,...payload}=evidence;
  requireEvidence(evidence.schema==='closed-loop-executed-verification-evidence/1'&&evidenceSha256===sha(payload),'aggregated evidence digest/schema mismatch');
  requireEvidence(evidence.fingerprint?.sourceCommit===fingerprint.sourceCommit&&evidence.fingerprint.sourceInputsSha256===fingerprint.sourceInputsSha256&&evidence.fingerprint.specificationSha256===fingerprint.specificationSha256&&isDeepStrictEqual(evidence.fingerprint.runtime,fingerprint.runtime),'aggregated evidence is not the current source/specification/revision/runtime');
  const canonical=aggregateExecutedEvidence(readExecutionReceipts(path.dirname(file),fingerprint),fingerprint);
  requireEvidence(isDeepStrictEqual(canonical,payload),'aggregated metrics/populations do not derive from the current executed receipts');
  validatedEvidenceDigests.set(evidence,{digest:sha(evidence),cwd:process.cwd()});
  return evidence;
}
export function applyExecutedEvidence(report,evidence){
  const output={...report,coverageMetrics:{...report.coverageMetrics},section49CoverageMetrics:{...report.section49CoverageMetrics},section49ZeroCountMetrics:{...report.section49ZeroCountMetrics},executedVerificationEvidence:{fingerprint:evidence.fingerprint,receiptCount:evidence.receiptCount,observationCount:evidence.observationCount,evidenceSha256:evidence.evidenceSha256,receiptReferences:evidence.receiptReferences},negativePopulations:evidence.negativePopulations,normativeRequirementTrace:evidence.normativeRequirementTrace,fullRequirementProofs:evidence.fullRequirementProofs,contractRequirementTrace:evidence.contractRequirementTrace};
  if(output.section49CoverageMetrics.normativeRequirementTraceCoverage){
    output.section49CoverageMetrics.normativeRequirementTraceCoverage=normativeProofSummary(evidence);
    output.normativeRequirementTraceCoverage=output.section49CoverageMetrics.normativeRequirementTraceCoverage.value;
  }
  for(const [key,metric]of Object.entries(evidence.metrics)){
    if(Object.hasOwn(output.coverageMetrics,key))output.coverageMetrics[key]=metric;
    else output.section49CoverageMetrics[key]=metric;
    output[key]=metric.value;
  }
  for(const [key,value]of Object.entries(evidence.zeroCounts)){
    output[key]=value;if(Object.hasOwn(output.section49ZeroCountMetrics,key))output.section49ZeroCountMetrics[key]=value;
  }
  const values=Object.values(output.section49ZeroCountMetrics);
  output.section49ZeroCountInvariantCount=values.length;
  output.section49ZeroCountUnknowns=values.filter(value=>value===null).length;
  output.section49ZeroCountInvariantViolations=values.some(value=>value===null)?null:values.reduce((sum,value)=>sum+value,0);
  return output;
}
export function applyAvailableExecutedEvidence(report){
  const file=process.env.CLOSED_LOOP_VERIFICATION_EVIDENCE||(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS?path.join(process.env.CLOSED_LOOP_VERIFICATION_RECEIPTS,'evidence.json'):null);
  return file&&fs.existsSync(file)?applyExecutedEvidence(report,readExecutedEvidence(file)):report;
}
