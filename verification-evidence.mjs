// Repository verification evidence. This module is never shipped to the app.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import './hash.js';
import {evaluateMobileAcceptanceSubmission,deployedExpected} from './evaluate-mobile-acceptance-submission.mjs';
import {REQUIRED_MOBILE_RECEIPT_KINDS} from './verify-mobile-acceptance-evidence.mjs';
import {validateBrowserExecution} from './browser-execution-evidence.mjs';
import {verificationCatalog,browserVerificationCatalog,metricCatalog,zeroCatalog,negativePopulationCatalog} from './verification-evidence-catalog.mjs';
import {deploymentContractIdentities} from './deployment-contract-identities.mjs';

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
const contextApplicabilityPath='verification/normative-context-applicability-20261005.json';
const normativeManifestPath=SPECIFICATION_PATH.replace('closed-loop-reliability-controlling-implementation-specification.txt','closed-loop-normative-requirements.json');
const specificationManifestPath=SPECIFICATION_PATH.replace('closed-loop-reliability-controlling-implementation-specification.txt','closed-loop-specification-manifest.json');
function specificationAcceptanceIdentity(cwd,fingerprint){
  const bytes=fs.readFileSync(path.join(cwd,specificationManifestPath)),manifest=JSON.parse(bytes);
  requireEvidence(sha(bytes)===fingerprint.inputSha256[specificationManifestPath],'acceptance specification manifest is not the current source input');
  requireEvidence(manifest.schema==='closed-loop-specification-manifest/1'&&manifest.repositoryPath===SPECIFICATION_PATH&&manifest.artifactFilename===path.posix.basename(SPECIFICATION_PATH)&&typeof manifest.sourceCommit==='string'&&/^[a-f0-9]{40}$/.test(manifest.sourceCommit)&&manifest.sha256===fingerprint.specificationSha256,'acceptance specification source identity is malformed or differs from the current source');
  return {manifestPath:specificationManifestPath,manifestSha256:sha(bytes),sourceCommit:manifest.sourceCommit,sourcePath:manifest.repositoryPath,sourceSha256:manifest.sha256};
}
export function coverageDeclarationSha256(coverage){const declaration={...coverage};delete declaration.review;return globalThis.closedLoopHash.sha256Value(declaration);}
// Context entries remain in the source inventory. Only the exact independently
// reviewed set is excluded from the independent behavior denominator; their
// governing clauses and modifiers remain mandatory.
export function reviewedContextApplicability(normative,fingerprint){
  if(!fingerprint.inputSha256[contextApplicabilityPath])return new Map();
  const review=readJson(contextApplicabilityPath),governance=readJson('specification/requirement-evidence-bindings.json');
  requireEvidence(sha(fs.readFileSync('specification/requirement-evidence-bindings.json'))===fingerprint.inputSha256['specification/requirement-evidence-bindings.json'],'context governance declaration is not current');
  const declared=governance.contextApplicabilityReview;requireEvidence(declared?.path===contextApplicabilityPath&&declared.sha256===fingerprint.inputSha256[contextApplicabilityPath],'context applicability record differs from its retained governance declaration');
  const reconciliation=readJson(governance.independentSourceReview.reconciliationPath),retained=reconciliation.retainedContextEntries;
  requireEvidence(sha(fs.readFileSync(contextApplicabilityPath))===fingerprint.inputSha256[contextApplicabilityPath]&&review.schema==='closed-loop-independent-context-applicability-review/1'&&review.status==='REVIEWED_EXACT_EXISTING_CONTEXT_MEMBERSHIP'&&review.source?.sha256===fingerprint.specificationSha256,'stale or invalid reviewed context applicability');
  requireEvidence(nonempty(review.reviewer?.actor)&&nonempty(review.reviewer?.contextId)&&review.reviewer.distinctFromReconciler===true&&nonempty(review.method)&&Array.isArray(review.unresolved)&&review.unresolved.length===0,'incomplete independent context applicability review');
  for(const input of review.inputs.filter(row=>row.path===SPECIFICATION_PATH||row.path.startsWith('verification/')))requireEvidence(fingerprint.inputSha256[input.path]===input.sha256,'context applicability governing source changed');
  requireEvidence(Array.isArray(review.rows)&&review.rows.length===retained.length&&new Set(review.rows.map(row=>row.normativeRequirementId)).size===retained.length,'context applicability membership is incomplete or duplicated');
  const requirements=new Map(normative.requirements.map(row=>[row.normativeRequirementId,row])),rows=new Map(),contextIds=new Set(retained.map(row=>row.normativeRequirementId)),sourceLineCount=fs.readFileSync(SPECIFICATION_PATH,'utf8').split('\n').length;
  for(const row of review.rows){
    const prior=retained.find(value=>value.normativeRequirementId===row.normativeRequirementId),current=requirements.get(row.normativeRequirementId);
    requireEvidence(prior&&current&&prior.classification===row.existingReconciledClassification&&isDeepStrictEqual(current.sourceLocation,row.sourceLocation)&&current.controllingText===row.controllingText,'context applicability changed exact source membership');
    const disposition=prior.classification==='STRUCTURAL_REQUIREMENT_CONTEXT'?'CONTEXT_GOVERNED_BY_LINKED_CLAUSES':'HISTORICAL_CONTEXT_NOT_CURRENT_OBLIGATION';
    requireEvidence(row.reviewedDisposition===disposition&&row.independentBehavioralObligation===false&&row.retainSourceEntryAndStableId===true&&row.excludeOnlyFromIndependentBehaviorProofDenominator===true&&row.linkedClausesRemainMandatoryAccordingToTheirOwnContext===true&&row.implementationConformanceClaim===false&&nonempty(row.exclusionReason),'context applicability disposition is not an exact nonbehavioral source classification');
    requireEvidence(Array.isArray(row.governingNormativeRequirementIds)&&row.governingNormativeRequirementIds.length>0&&new Set(row.governingNormativeRequirementIds).size===row.governingNormativeRequirementIds.length,'missing or duplicate governing clauses');
    const ranges=row.governingSourceRanges;
    requireEvidence(Array.isArray(ranges)&&ranges.length>0&&ranges.every((range,index)=>Array.isArray(range)&&range.length===2&&Number.isSafeInteger(range[0])&&Number.isSafeInteger(range[1])&&range[0]>0&&range[1]>=range[0]&&range[1]<=sourceLineCount&&(index===0||range[0]>ranges[index-1][1])),'invalid, overlapping or unordered governing source ranges');
    const governed=normative.requirements.filter(child=>!contextIds.has(child.normativeRequirementId)&&ranges.some(([start,end])=>child.sourceLocation.startLine>=start&&child.sourceLocation.endLine<=end));
    requireEvidence(isDeepStrictEqual(row.governingNormativeRequirementIds,governed.map(child=>child.normativeRequirementId))&&isDeepStrictEqual(row.governingSourceLineHashes,Object.fromEntries(governed.map(child=>[child.sourceLocation.startLine,child.sourceLocation.lineSha256]))),'incomplete or changed governing range membership');
    for(const id of row.governingNormativeRequirementIds){const child=requirements.get(id);requireEvidence(child&&id!==row.normativeRequirementId&&row.governingSourceLineHashes[child.sourceLocation.startLine]===child.sourceLocation.lineSha256,'unknown, self-linked or stale governing clause');}
    rows.set(row.normativeRequirementId,row);
  }
  const visit=(id,parents=new Set())=>{requireEvidence(!parents.has(id),'cyclic context applicability');const row=rows.get(id);if(row)for(const child of row.governingNormativeRequirementIds)visit(child,new Set([...parents,id]));};
  for(const id of rows.keys())visit(id);
  return rows;
}
export function evaluateFullRequirementProof(requirement,bindings,observations,fingerprint,governingContext=[]){
  const complete=bindings.filter(binding=>binding.fullCoverage),reasons=[];
  const result={normativeRequirementId:requirement.normativeRequirementId,sourceLineSha256:requirement.sourceLocation.lineSha256,disposition:'UNKNOWN',reasons,executedAssertions:[]};
  if(complete.length!==1){reasons.push(complete.length?'AMBIGUOUS_FULL_COVERAGE_DECLARATIONS':'NO_REVIEWED_FULL_COVERAGE_DECLARATION');return result;}
  const binding=complete[0],coverage=binding.fullCoverage;
  const reject=reason=>reasons.push(reason);
  if(governingContext.length&&!isDeepStrictEqual(coverage.governingContext,governingContext))reject('GOVERNING_SOURCE_CONTEXT_NOT_ACCOUNTED');
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
      if(reviewedInputs.some(input=>input?.path&&(!nonempty(input.sha256)||fingerprint.inputSha256[input.path]!==input.sha256)))reject('COVERAGE_REVIEW_INPUT_CHANGED');
      if(!reviewedInputs.some(input=>input?.path===SPECIFICATION_PATH&&input.sha256===fingerprint.specificationSha256)||!reviewedInputs.some(input=>input?.declarationSha256===coverageDeclarationSha256(coverage))||(Array.isArray(owners)?owners:[]).some(owner=>!plain(owner)||!reviewedInputs.some(input=>input?.path===owner.path&&input.sha256===owner.sha256)))reject('COVERAGE_REVIEW_INPUTS_INCOMPLETE');
    }
  }
  const obligations=coverage.obligations;
  if(!Array.isArray(obligations)||!obligations.length||obligations.some(obligation=>!plain(obligation)||!nonempty(obligation.id)||!nonempty(obligation.sourceText)||!nonempty(obligation.expectedBehavior))||new Set(obligations.map(obligation=>obligation.id)).size!==obligations.length||obligations.map(obligation=>obligation.sourceText).join('')!==requirement.controllingText){reject('INCOMPLETE_SOURCE_OBLIGATION_DECOMPOSITION');return result;}
  const requiredExternal=requirement.requiredBrowserOrPhysicalDeviceProof||[],externalScopes=new Set();
  const references=[];
  for(const obligation of obligations){
    const observedKinds=new Set(),browserCases=new Map();
    if(!Array.isArray(obligation.evidenceKinds)||!obligation.evidenceKinds.length||obligation.evidenceKinds.some(kind=>!['EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS','EXECUTED_SCHEMA_METADATA_ASSERTIONS','ACTUAL_BROWSER_CONTROL_ASSERTIONS','HUMAN_OBSERVATION','VERIFIED_EXTERNAL'].includes(kind)))reject('UNSUPPORTED_REQUIRED_EVIDENCE_KIND');
    for(const role of ['deterministic','semantic','mutation']){
      const checks=obligation.checks?.[role];
      if(!Array.isArray(checks)||(!checks.length&&(role==='deterministic'||!nonempty(obligation.nonapplicable?.[role])))){reject('REQUIRED_CHECK_ROLE_UNACCOUNTED');continue;}
      for(const reference of checks){
        const observation=observations.get(reference?.checkId);
        if(!plain(reference)||!nonempty(reference.suite)||!nonempty(reference.checkId)||!binding.checkIds.includes(reference.checkId)||!observation||observation.suite!==reference.suite||observation.passed!==true){reject('REQUIRED_CURRENT_ASSERTION_MISSING_OR_WRONG_PRODUCER');continue;}
        if(!['EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS','EXECUTED_SCHEMA_METADATA_ASSERTIONS','ACTUAL_BROWSER_CONTROL_ASSERTIONS','HUMAN_OBSERVATION','VERIFIED_EXTERNAL'].includes(observation.evidenceBasis))reject('UNSUPPORTED_ASSERTION_EVIDENCE_BASIS');
        if(observation.browserScope&&observation.evidenceBasis!=='ACTUAL_BROWSER_CONTROL_ASSERTIONS')reject('BROWSER_SCOPE_REQUIRES_ACTUAL_BROWSER_ASSERTION');if(observation.physicalDevice===true&&!['HUMAN_OBSERVATION','VERIFIED_EXTERNAL'].includes(observation.evidenceBasis))reject('PHYSICAL_SCOPE_REQUIRES_ACCEPTED_PHYSICAL_EVIDENCE');
        observedKinds.add(observation.evidenceBasis);if(observation.browserScope){externalScopes.add(observation.browserScope);const key=observation.checkId.replace(/^browser\.(?:LOCAL|DEPLOYED)\./,'');if(!browserCases.has(key))browserCases.set(key,new Set());browserCases.get(key).add(observation.browserScope);}if(observation.physicalDevice===true)externalScopes.add('ACTUAL_IPHONE_SAFARI');
        for(const inputPath of reference.suite==='physical-iphone'?['verify-mobile-acceptance-evidence.mjs','evaluate-mobile-acceptance-submission.mjs','verification-evidence.mjs']:[reference.suite,'verification-evidence-catalog.mjs',...(verificationCatalog[reference.suite]?.sourceInputs||browserVerificationCatalog[reference.suite]?.sourceInputs||[]),...(browserVerificationCatalog[reference.suite]?['browser-execution-evidence.mjs','operator-browser-driver.mjs']:[])])if(!(Array.isArray(retainedReview?.reviewedInputs)?retainedReview.reviewedInputs:[]).some(input=>input?.path===inputPath&&input?.sha256===fingerprint.inputSha256[inputPath]))reject('COVERAGE_REVIEW_TEST_INPUT_MISMATCH');
        references.push({role,obligationId:obligation.id,checkId:observation.checkId,suite:observation.suite,receiptSha256:observation.receiptSha256});
      }
    }
    if(requiredExternal.includes('LOCAL_AND_DEPLOYED_BROWSER')&&[...browserCases.values()].some(scopes=>!scopes.has('LOCAL')||!scopes.has('DEPLOYED')))reject('BROWSER_CASE_MISSING_LOCAL_OR_DEPLOYED_SCOPE');
    if(Array.isArray(obligation.evidenceKinds)&&obligation.evidenceKinds.some(kind=>!observedKinds.has(kind)))reject('REQUIRED_EVIDENCE_KIND_NOT_OBSERVED');
  }
  if(requiredExternal.some(kind=>kind==='LOCAL_AND_DEPLOYED_BROWSER'?!externalScopes.has('LOCAL')||!externalScopes.has('DEPLOYED'):kind==='ACTUAL_IPHONE_SAFARI'?!externalScopes.has(kind):true))reject('REQUIRED_BROWSER_OR_PHYSICAL_PROOF_NOT_ESTABLISHED_BY_SYNTHETIC_RECEIPTS');
  if(new Set(references.map(reference=>reference.checkId)).size!==new Set(binding.checkIds).size)reject('FULL_COVERAGE_CHECK_UNIVERSE_MISMATCH');
  result.reasons=[...new Set(reasons)];result.executedAssertions=references;result.review=coverage.review;result.declarationSha256=coverageDeclarationSha256(coverage);
  if(!result.reasons.length){result.disposition='CONFORMANT_PROVEN';result.testTraceStatus='EXECUTED_REQUIREMENT_CASES';result.productionOwnerStatus='VERIFIED_PRODUCTION_OWNER';}
  return result;
}
function normativeProofSummary(evidence){
  const proof=evidence.fullRequirementProofs,rows=proof?.requirements||[],context=rows.filter(row=>['CONTEXT_GOVERNED_BY_LINKED_CLAUSES','HISTORICAL_CONTEXT_NOT_CURRENT_OBLIGATION'].includes(row.disposition)),mandatory=rows.filter(row=>!context.includes(row)),proven=mandatory.filter(row=>row.disposition==='CONFORMANT_PROVEN'),complete=mandatory.length>0&&proven.length===mandatory.length;
  return {metricId:'NORMATIVE_REQUIREMENT_TRACE_COVERAGE',derivationVersion:'closed-loop-current-normative-proof/1',universeDefinition:'Every noncontext source entry in the exact current normative manifest, with complete independently reviewed obligation coverage and current executed proof. All stable source IDs remain retained; exact reviewed context exclusions preserve mandatory governing links.',numerator:proven.length,denominator:mandatory.length,includedIds:mandatory.map(row=>row.normativeRequirementId),excludedIds:context.map(row=>({id:row.normativeRequirementId,reason:row.reason,governingNormativeRequirementIds:row.governingNormativeRequirementIds})),retainedSourceIds:rows.map(row=>row.normativeRequirementId),scopeHash:sha({fingerprint:evidence.fingerprint,proof}),evidenceReferences:[...new Set(proven.flatMap(row=>row.executedAssertions.map(assertion=>`${assertion.suite}.json#${assertion.checkId}`)))],value:complete?1:null,disposition:complete?'SATISFIED':'UNKNOWN',evidenceBasis:'REVIEWED_FULL_SOURCE_COVERAGE_AND_CURRENT_EXECUTED_RECEIPTS',qualifiedExecutedRequirementCount:evidence.normativeRequirementTrace.filter(row=>row.disposition==='QUALIFIED_EXECUTED_ASSERTION_EVIDENCE').length,fullClauseConformanceEstablished:complete};
}
export function validateFinalNormativeProof(report,evidence){
  const validated=plain(evidence)?validatedEvidenceDigests.get(evidence):null;
  requireEvidence(validated&&validated.digest===sha(evidence),'final normative proof requires unchanged revalidated current executed evidence');
  const current=evidenceFingerprint(validated.cwd);
  requireEvidence(current.sourceCommit===evidence.fingerprint.sourceCommit&&current.sourceInputsSha256===evidence.fingerprint.sourceInputsSha256&&current.specificationSha256===evidence.fingerprint.specificationSha256,'final normative proof source changed after receipt validation');
  requireEvidence(report.commit===evidence.fingerprint.sourceCommit,'final normative proof belongs to a different candidate');
  requireEvidence(isDeepStrictEqual(report.specificationIdentity,validated.specificationIdentity),'final specification source identity is missing or differs');
  for(const key of ['registryIdentities','testIrIdentities'])requireEvidence(isDeepStrictEqual(report[key],validated.contractIdentities?.[key]),'final deployment contract identity is missing or differs: '+key);
  requireEvidence(isDeepStrictEqual(report.executedVerificationEvidence?.fingerprint,evidence.fingerprint)&&report.executedVerificationEvidence?.evidenceSha256===evidence.evidenceSha256,'final normative execution identity differs from revalidated evidence');
  const expected=normativeProofSummary(evidence);
  requireEvidence(isDeepStrictEqual(report.section49CoverageMetrics?.normativeRequirementTraceCoverage,expected)&&report.normativeRequirementTraceCoverage===expected.value,'final normative metric does not derive from the exact current requirement universe');
  requireEvidence(isDeepStrictEqual(report.fullRequirementProofs,evidence.fullRequirementProofs)&&isDeepStrictEqual(report.normativeRequirementTrace,evidence.normativeRequirementTrace),'final normative proof trace differs from current source/receipts');
  if(evidence.externalMobile){mobileObservations(evidence.externalMobile,current,{fresh:true});const mobile=evaluateMobileAcceptanceSubmission(evidence.externalMobile);for(const [key,value]of Object.entries(mobile))requireEvidence(isDeepStrictEqual(report[key],value),'final physical summary differs from revalidated raw evidence');}
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
  const governed=[...(governance.contextApplicabilityReview?[governance.contextApplicabilityReview.path]:[]),...fullCoverageReviewPaths,...(independentSourceReview?[independentSourceReview.sourceReviewPath,independentSourceReview.reconciliationPath]:[]),...amendments.flatMap(amendment=>['sourceReviewPath','approvedProposalPath'].map(key=>amendment[key])),...[...Object.values(verificationCatalog),...Object.values(browserVerificationCatalog)].flatMap(suite=>suite.sourceInputs||[])];
  const sourceRoot=fs.realpathSync(cwd)+path.sep;
  for(const name of governed){
    requireEvidence(typeof name==='string'&&/^(?:verification\/[^/\\]+\.(?:json|md)|[\w-]+\.m?js)$/.test(name)&&path.posix.normalize(name)===name,'declared governance or verifier input must be an exact first-party verification path');
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
export function browserExecutionReports(stdout){
  const reports=[];let pending='';
  for(const line of String(stdout).split('\n')){
    if(!pending&&!line.startsWith('{'))continue;
    pending+=(pending?'\n':'')+line;
    try{const report=JSON.parse(pending);requireEvidence(plain(report),'browser report must be an object');reports.push(report);pending='';}catch(error){if(!error.message.includes('JSON')&&!error.message.includes('Unexpected')&&!error.message.includes('Expected')&&!error.message.includes('Unterminated'))throw error;}
  }
  requireEvidence(!pending&&reports.length>0,'browser producer emitted incomplete structured report');return reports;
}
function valueAt(object,pointer){return pointer.split('.').reduce((value,key)=>value?.[key],object);}
function selectedReport(reports,marker){const selected=reports.filter(report=>Object.hasOwn(report,marker));requireEvidence(selected.length===1,`expected exactly one report marker ${marker}; received ${selected.length}`);return selected[0];}
export function observationsFromReports(suite,reports,{scope}={}){
  const browser=browserVerificationCatalog[suite];
  if(browser)requireEvidence(['LOCAL','DEPLOYED'].includes(scope),'browser assertion scope missing');
  const definition=verificationCatalog[suite]||browser;requireEvidence(definition,`unregistered producer ${suite}`);
  const ownedReports=new Set();
  const observations=definition.checks.map(check=>{
    const report=selectedReport(reports,check.marker),observed=valueAt(report,check.path);
    ownedReports.add(report);
    const passed=check.condition?check.condition(observed,report,reports):isDeepStrictEqual(observed,check.expected);
    return {checkId:browser?`browser.${scope}.${check.id}`:check.id,...(browser?{browserScope:scope}:{}),requirementRefs:check.requirementRefs||[],assertionReference:check.assertionReference,boundary:check.boundary||definition.boundary,expected:check.expected??check.expectedDescription,observed:observed===undefined?null:observed,passed,evidenceBasis:check.basis||'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS',...(check.violation?{violation:check.violation,accepted:!passed}:{}),...(check.coverageIds?{coverageIds:check.coverageIds(report)}:{}),...(check.excludedIds?{excludedIds:check.excludedIds(report)}:{})};
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
    if(ownedReports.has(report))observations.push({...observation,evidenceBasis:definition.emittedEvidenceBasis||'EXECUTED_SYNTHETIC_PRODUCTION_ASSERTIONS'});
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
export function createExecutionReceipt(suite,result,{cwd=process.cwd(),fingerprint=evidenceFingerprint(cwd),browser=null}={}){
  requireEvidence(result.exitCode===0&&result.outcome==='PASS'&&!result.signal&&!result.reason&&!result.error,`producer ${suite} failed or did not finish`);
  const reports=browser?browserExecutionReports(result.stdout):executionReports(result.stdout),observations=observationsFromReports(suite,reports,browser||{});
  requireEvidence(observations.every(row=>row.passed),`producer ${suite} reported a failed or missing required assertion`);
  const producerFileSha256=sha(fs.readFileSync(path.resolve(cwd,result.command?.[1]||suite)));
  requireEvidence(producerFileSha256===fingerprint.inputSha256[suite],`producer script differs from current repository ${suite}`);
  const receipt={schema:RECEIPT_SCHEMA,suite,fingerprint,producerFileSha256,...(browser?{browser}:{}),command:result.command,exitCode:result.exitCode,outcome:result.outcome,complete:true,stdoutSha256:sha(result.stdout),stderrSha256:sha(result.stderr||''),reports,observations};
  receipt.receiptSha256=sha(receipt);if(browser)validateExecutionReceipt(receipt,suite,fingerprint);return receipt;
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
  if(browserVerificationCatalog[suite]){
    requireEvidence(plain(receipt.browser)&&['LOCAL','DEPLOYED'].includes(receipt.browser.scope),'browser receipt scope missing');
    const manifest=receipt.browser.manifest,unsignedManifest={...manifest};delete unsignedManifest.manifestDigest;requireEvidence(manifest?.schema==='closed-loop-deployment-manifest/1'&&manifest.manifestDigest?.hashAlgorithm==='SHA-256'&&manifest.manifestDigest.digest===globalThis.closedLoopHash.sha256Value(unsignedManifest),'browser retained manifest digest mismatch');
    const carriers=receipt.reports.filter(report=>report.browserExecution);requireEvidence(carriers.length===1,'browser receipt needs one actual execution carrier');
    requireEvidence(receipt.browser.manifest?.sourceCommit===receipt.fingerprint.sourceCommit,'browser manifest belongs to a different original producer candidate');
    requireEvidence(receipt.browser.scope==='LOCAL'||receipt.fingerprint.sourceCommit===fingerprint.sourceCommit,'deployed browser proof cannot be promoted from another deployed revision');
    validateBrowserExecution(carriers[0].browserExecution,{suite,scope:receipt.browser.scope,manifest:receipt.browser.manifest,sourceCommit:receipt.fingerprint.sourceCommit});
  }
  const expected=observationsFromReports(suite,receipt.reports,receipt.browser||{});
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
  for(const scope of ['LOCAL','DEPLOYED'])for(const suite of Object.keys(browserVerificationCatalog)){const file=path.join(directory,'browser',scope,suite+'.json');if(fs.existsSync(file)){const receipt=validateExecutionReceipt(readJson(file),suite,fingerprint);requireEvidence(receipt.browser.scope===scope,'browser receipt stored under wrong scope');receipts.set(`browser/${scope}/${suite}`,receipt);}}
  return receipts;
}
export function aggregateExecutedEvidence(receipts,fingerprint,{mobile=null}={}){
  const observations=new Map(),receiptRefs=[];
  for(const [key,receipt] of receipts){const suite=receipt.suite;validateExecutionReceipt(receipt,suite,fingerprint);receiptRefs.push(`${key}.json#${receipt.receiptSha256}`);for(const observation of receipt.observations){requireEvidence(!observations.has(observation.checkId),`duplicate observation ${observation.checkId}`);observations.set(observation.checkId,{...observation,suite,receiptSha256:receipt.receiptSha256});}}
  if(mobile)for(const observation of mobileObservations(mobile,fingerprint)){requireEvidence(!observations.has(observation.checkId),'duplicate physical assertion');observations.set(observation.checkId,observation);}
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
  const contexts=reviewedContextApplicability(normative,fingerprint);
  const contextReaches=(row,id)=>row.governingNormativeRequirementIds.some(child=>child===id||contexts.has(child)&&contextReaches(contexts.get(child),id));
  const fullRequirementProofs={schema:'closed-loop-full-requirement-proof/1',specificationSha256:fingerprint.specificationSha256,normativeManifestSha256:sha(fs.readFileSync(normativeManifestPath)),normativeManifestIdentity:normative.manifestIdentity,requirements:normative.requirements.map(requirement=>{const context=contexts.get(requirement.normativeRequirementId);if(context)return {normativeRequirementId:requirement.normativeRequirementId,sourceLineSha256:requirement.sourceLocation.lineSha256,disposition:context.reviewedDisposition,reason:context.exclusionReason,governingNormativeRequirementIds:context.governingNormativeRequirementIds,executedAssertions:[],review:{path:contextApplicabilityPath,sha256:fingerprint.inputSha256[contextApplicabilityPath]}};const governingContext=[...contexts.values()].filter(row=>row.existingReconciledClassification==='STRUCTURAL_REQUIREMENT_CONTEXT'&&contextReaches(row,requirement.normativeRequirementId)).map(row=>({normativeRequirementId:row.normativeRequirementId,sourceLineSha256:row.sourceLocation.lineSha256,controllingText:row.controllingText}));return evaluateFullRequirementProof(requirement,assertionBindings.bindings.filter(binding=>binding.normativeRequirementId===requirement.normativeRequirementId),observations,fingerprint,governingContext);})};
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
  return JSON.parse(JSON.stringify({schema:'closed-loop-executed-verification-evidence/1',fingerprint,receiptCount:receipts.size,observationCount:observations.size,receiptReferences:receiptRefs,externalAssertions:[...observations.values()].filter(row=>row.browserScope||row.physicalDevice===true),metrics,zeroCounts,negativePopulations,normativeRequirementTrace,fullRequirementProofs,contractRequirementTrace,...(mobile?{externalMobile:mobile}:{}),sourceInspectionIsBehavioralProof:false}));
}
function mobileObservations(mobile,fingerprint,{fresh=false}={}){
  requireEvidence(plain(mobile)&&plain(mobile.expected)&&mobile.expected.sourceCommit===fingerprint.sourceCommit&&nonempty(mobile.submitter),'physical proof needs exact current source and authenticated submitter');
  const expected={...mobile.expected,...(fresh?{verificationTime:new Date().toISOString()}: {})};
  const summary=evaluateMobileAcceptanceSubmission({targetJson:mobile.targetJson,evidenceJson:mobile.evidenceJson,expected,usedChallenges:mobile.usedChallenges,submitter:mobile.submitter});
  requireEvidence(summary.mobileAcceptanceResult==='ACCEPTED','raw physical target/evidence was not accepted by its owner');
  const evidence=JSON.parse(mobile.evidenceJson),receiptSha256=sha(mobile);
  return REQUIRED_MOBILE_RECEIPT_KINDS.map(kind=>({checkId:`physical-iphone.${kind}`,suite:'physical-iphone',passed:true,evidenceBasis:evidence.evidenceBasis,physicalDevice:true,boundary:'Attributed physical iPhone Safari observation plus application-observed current-bound operation receipt',assertionReference:kind,expected:'Valid current physical acceptance operation receipt',observed:evidence.operationReceipts.find(row=>row.kind===kind),receiptSha256}));
}
export async function readReleaseExecutedEvidence(file,{siteDirectory,directory=path.dirname(file),targetJson='',evidenceJson='',submitter=process.env.GITHUB_ACTOR,usedChallenges=[]}={}){
  const fingerprint=evidenceFingerprint(),receipts=readExecutionReceipts(directory,fingerprint),retained=readJson(file);
  requireEvidence(Array.isArray(retained.receiptReferences)&&retained.receiptReferences.every(value=>typeof value==='string'&&/^(?:[\w.-]+|browser\/(?:LOCAL|DEPLOYED)\/[\w.-]+)\.json#[a-f0-9]{64}$/.test(value)),'sealed base receipt references are malformed');
  const baseKeys=new Set(retained.receiptReferences.map(value=>value.slice(0,value.indexOf('.json#'))));
  const base=readEvidencePayload(file,fingerprint,new Map([...receipts].filter(([key])=>baseKeys.has(key)))),{validateSite}=await import('./verified-site.mjs'),manifest=validateSite(siteDirectory);
  requireEvidence(manifest.sourceCommit===fingerprint.sourceCommit,'release site is not the current candidate');
  for(const receipt of receipts.values())if(receipt.browser){const tested=receipt.browser.manifest;requireEvidence(tested.buildIdentity===manifest.buildIdentity&&isDeepStrictEqual(tested.runtimeResources,manifest.runtimeResources),'browser observations concern a different built runtime graph');if(receipt.browser.scope==='DEPLOYED')requireEvidence(tested.manifestDigest.digest===manifest.manifestDigest.digest,'deployed browser observation manifest differs');}
  let mobile=null,mobileResult=null;
  if(nonempty(targetJson)||nonempty(evidenceJson)){
    requireEvidence(process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&nonempty(submitter)&&submitter===process.env.GITHUB_ACTOR,'physical proof requires the authenticated workflow submission actor');
    const expected=await deployedExpected();
    requireEvidence(expected.deploymentManifestDigest===manifest.manifestDigest.digest&&expected.buildIdentity===manifest.buildIdentity&&isDeepStrictEqual(expected.runtimeResources,manifest.runtimeResources),'physical submission deployed bytes differ from verified site');
    const submission={targetJson,evidenceJson,expected,usedChallenges,submitter};mobileResult=evaluateMobileAcceptanceSubmission(submission);if(mobileResult.mobileAcceptanceResult==='ACCEPTED'){mobile=submission;mobileObservations(mobile,fingerprint);}
  }
  const output=aggregateExecutedEvidence(receipts,fingerprint,{mobile});if(mobileResult)output.externalMobileResult=mobileResult;output.evidenceSha256=sha(output);
  validatedEvidenceDigests.set(output,{digest:sha(output),cwd:process.cwd(),releaseManifest:manifest,specificationIdentity:specificationAcceptanceIdentity(process.cwd(),fingerprint),contractIdentities:{registryIdentities:manifest.registryIdentities,testIrIdentities:manifest.testIrIdentities}});return output;
}
function readEvidencePayload(file,fingerprint,receipts){
  const evidence=readJson(file),{evidenceSha256,...payload}=evidence;
  requireEvidence(evidence.schema==='closed-loop-executed-verification-evidence/1'&&evidenceSha256===sha(payload),'aggregated evidence digest/schema mismatch');
  requireEvidence(evidence.fingerprint?.sourceCommit===fingerprint.sourceCommit&&evidence.fingerprint.sourceInputsSha256===fingerprint.sourceInputsSha256&&evidence.fingerprint.specificationSha256===fingerprint.specificationSha256&&isDeepStrictEqual(evidence.fingerprint.runtime,fingerprint.runtime),'aggregated evidence is not the current source/specification/revision/runtime');
  const canonical=aggregateExecutedEvidence(receipts,fingerprint);
  requireEvidence(isDeepStrictEqual(canonical,payload),'aggregated metrics/populations do not derive from the current executed receipts');
  validatedEvidenceDigests.set(evidence,{digest:sha(evidence),cwd:process.cwd(),specificationIdentity:specificationAcceptanceIdentity(process.cwd(),fingerprint),contractIdentities:deploymentContractIdentities(process.cwd())});
  return evidence;
}
export function readExecutedEvidence(file,fingerprint=evidenceFingerprint()){return readEvidencePayload(file,fingerprint,readExecutionReceipts(path.dirname(file),fingerprint));}
export function applyExecutedEvidence(report,evidence){
  const validated=validatedEvidenceDigests.get(evidence);
  const output={...report,...structuredClone(validated?{...validated.contractIdentities,specificationIdentity:validated.specificationIdentity}:{}),...(evidence.externalMobile?evaluateMobileAcceptanceSubmission(evidence.externalMobile):evidence.externalMobileResult||{}),coverageMetrics:{...report.coverageMetrics},section49CoverageMetrics:{...report.section49CoverageMetrics},section49ZeroCountMetrics:{...report.section49ZeroCountMetrics},executedVerificationEvidence:{fingerprint:evidence.fingerprint,receiptCount:evidence.receiptCount,observationCount:evidence.observationCount,evidenceSha256:evidence.evidenceSha256,receiptReferences:evidence.receiptReferences},negativePopulations:evidence.negativePopulations,normativeRequirementTrace:evidence.normativeRequirementTrace,fullRequirementProofs:evidence.fullRequirementProofs,contractRequirementTrace:evidence.contractRequirementTrace};
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
