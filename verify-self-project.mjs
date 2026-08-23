import fs from 'node:fs';
import crypto from 'node:crypto';

const fail=message=>{throw new Error(message)};
const projectBytes=fs.readFileSync('SELF_VERIFIED_PROJECT.json');
const project=JSON.parse(projectBytes.toString('utf8'));
const htmlBytes=fs.readFileSync('index.html');
const html=htmlBytes.toString('utf8');
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const exactStages=['DEFINE JOB','INVENTORY SOURCES','RESEARCH REQUIREMENTS','COMPILE ATOMIC REQUIREMENTS','RESOLVE CONFLICTS','BUILD ACCEPTANCE TESTS','BUILD FAILURE/MUTATION TESTS','AUTHOR PRODUCTION INSTRUCTION','PREFLIGHT INSTRUCTION','FREEZE CANDIDATE','RUN 10 INDEPENDENT EXECUTIONS','VERIFY EVERY RUN AGAINST EVERY REQUIREMENT','COMPARE ALL RUNS','ROOT-CAUSE EVERY DEFECT','ADD REGRESSION TESTS','CORRECT RESPONSIBLE LAYER','FREEZE NEW VERSION','RUN 10 NEW INDEPENDENT EXECUTIONS','REPEAT UNTIL CONVERGED','RUN UNCHANGED 10-EXECUTION CONFIRMATION','FREEZE APPROVED BASELINE','GENERATE FINISHED PRODUCT','DETERMINISTIC PRODUCT VERIFICATION','INDEPENDENT SEMANTIC VERIFICATION','ADVERSARIAL PRODUCT VERIFICATION','FINAL REPRESENTATION INSPECTION','PROCESS AUDIT','PRODUCT AUDIT','ACCEPTED / REJECTED / BLOCKED','VERIFY RELEASE HASH','RELEASE ONLY THE EXACT ACCEPTED ARTIFACT'];
const jobKeys=['exactUserObjective','exactDeliverables','requestedActions','subjectAndTarget','problemAndQuestionSet','scopeBoundaries','suppliedInformation','provenanceClassification','priorConversationDependencies','userDefinedTerminology','constraints','prohibitedActions','requiredMethods','requiredOutputProperties','temporalScope','locationAndJurisdiction','successConditions','priorities','uncertainties','externalResearchQuestions'];
const forbiddenLegacy=/\b(existing )?v13\b|version 13|sidecar-filename defect|repair-task tracker|fix stage|app-arbitrary application version|External agent process|Visible UI evidence for Stage|executable prompt was copied|paste agent response|copy stage prompt/i;

const manifestMatch=html.match(/<script id="stage-manifest" type="application\/json">([\s\S]*?)<\/script>/);
if(!manifestMatch)fail('Current application stage manifest is missing.');
const appStages=JSON.parse(manifestMatch[1]);
if(appStages.length!==31)fail('Current application does not contain exactly 31 stages.');
appStages.forEach((stage,index)=>{if(stage.number!==index+1||stage.name!==exactStages[index])fail(`Current application stage ${index+1} does not match the required workflow.`)});
if(!html.includes('data-self-project-proof="true"')||!html.includes('data-retained-self-project-loader="true"')||!html.includes('SELF_VERIFIED_PROJECT.json'))fail('Current application does not expose and load the retained project through the separate sidecar path.');

if(project.schema!=='closed-loop-project/1')fail('Retained project is not in the current application project schema.');
if(!project.projectId||!String(project.name||'').trim())fail('Retained project identity is incomplete.');
if(!/Closed-Loop Agent Reliability application/i.test(`${project.name} ${project.job?.exactUserObjective||''}`))fail('Retained project is not about the complete application itself.');
if(!/domain-general/i.test(String(project.job?.exactUserObjective||'')))fail('Retained project objective is not domain-general.');
if(forbiddenLegacy.test(`${project.name}\n${JSON.stringify(project.job||{})}\n${(project.stages||[]).map(stage=>stage.completionEvidence||'').join('\n')}`))fail('Retained project still contains obsolete version/fix/prompt-relay framing.');
if(!project.job||jobKeys.some(key=>!String(project.job[key]||'').trim()))fail('Retained project does not preserve all 20 Stage 1 scopes as structured job data.');
if(!Array.isArray(project.stages)||project.stages.length!==31)fail('Retained project must contain exactly 31 stages.');
project.stages.forEach((stage,index)=>{if(stage.number!==index+1||stage.name!==exactStages[index])fail(`Retained project stage ${index+1} does not match the application workflow.`);if(stage.status!=='COMPLETE')fail(`Retained project stage ${index+1} is not COMPLETE.`);if(!String(stage.completionEvidence||'').trim())fail(`Retained project stage ${index+1} lacks completion evidence.`)});
const stage1=String(project.stages[0].completionEvidence||'');
const stage2=String(project.stages[1].completionEvidence||'');
if(!/REQUESTED ACTIONS:/i.test(stage1)||!/USER JOB INPUT/i.test(stage1)||!/EXTERNAL RESEARCH SOURCES/i.test(stage1)||!/WORKFLOW-GENERATED ARTIFACTS/i.test(stage1))fail('Stage 1 does not preserve requested actions and all three information classes.');
if(!/EXTERNAL_SEARCH_PERFORMED\s*:\s*true/i.test(stage2)||!/PROHIBITED_WORK_PRODUCTS_USED_AS_AUTHORITY\s*:\s*false/i.test(stage2))fail('Stage 2 does not affirm actual non-circular external research.');

const requireArray=(name,min=1)=>{const value=project[name];if(!Array.isArray(value)||value.length<min)fail(`${name} requires at least ${min} native structured record${min===1?'':'s'}.`);return value};
const userInputs=requireArray('userInputs',3);
const externalSources=requireArray('externalSources',3);
for(const source of externalSources){
  if(source.informationClass!=='EXTERNAL_RESEARCH_SOURCE'||source.stageNumber!==2)fail(`${source.id||'External source'} is not classified as a Stage 2 EXTERNAL_RESEARCH_SOURCE.`);
  if(source.externallyAccessed!==true||source.independentOfArtifact!==true)fail(`${source.id||'External source'} lacks affirmative access and independence evidence.`);
  if(!String(source.title||'').trim()||!String(source.canonicalLocation||'').trim()||!String(source.evidenceExtract||'').trim())fail(`${source.id||'External source'} is incomplete.`);
  if(/^(file:|data:|blob:|\.\.?\/|[a-z]:[\\/])/i.test(String(source.canonicalLocation)))fail(`${source.id} uses a local or generated location as external authority.`);
}
requireArray('researchCoverage');
const findings=requireArray('findings');
const sourceIds=new Set(externalSources.map(source=>source.id));
for(const finding of findings)for(const id of String(finding.sourceIds||'').split(/[\s,;]+/).filter(Boolean))if(!sourceIds.has(id))fail(`${finding.id} references unregistered external source ${id}.`);

const requirements=requireArray('requirements',8);
const requirementIds=new Set(requirements.map(requirement=>requirement.id));
if(requirementIds.size!==requirements.length)fail('Requirement identifiers are not unique.');
for(const requirement of requirements){
  if(!['USER_REQUIREMENT','EXTERNALLY_GOVERNED_REQUIREMENT'].includes(requirement.origin))fail(`${requirement.id} has an impermissible requirement origin.`);
  if(requirement.mandatory!=='MANDATORY')fail(`${requirement.id} is not mandatory in the retained application proof.`);
  if(!String(requirement.statement||'').trim()||!String(requirement.controllingReference||'').trim()||!String(requirement.verificationMethod||'').trim()||!String(requirement.acceptanceCriterion||'').trim()||!String(requirement.failureCondition||'').trim())fail(`${requirement.id} is incomplete.`);
  if(requirement.origin==='EXTERNALLY_GOVERNED_REQUIREMENT'&&!sourceIds.has(requirement.controllingReference))fail(`${requirement.id} does not trace to a registered independent external source.`);
  if(requirement.origin==='USER_REQUIREMENT'&&!userInputs.some(input=>input.id===requirement.controllingReference))fail(`${requirement.id} does not trace to a registered user input.`);
}
const idList=value=>String(value||'').split(/[\s,;]+/).filter(Boolean);
const acceptanceTests=requireArray('acceptanceTests',requirements.length);
const mutationTests=requireArray('mutationTests',requirements.length);
for(const requirement of requirements){
  if(!acceptanceTests.some(test=>idList(test.requirementIds).includes(requirement.id)))fail(`${requirement.id} lacks an acceptance test.`);
  if(!mutationTests.some(test=>idList(test.requirementIds).includes(requirement.id)&&test.detected==='YES'))fail(`${requirement.id} lacks a passing failure/mutation test.`);
}
requireArray('productionInstructions');
if(requireArray('preflightReviews').some(review=>!['RESOLVED','NONE_FOUND'].includes(review.status)))fail('Instruction preflight contains an unresolved issue.');

const candidates=requireArray('candidates',2);
const initialCandidate=candidates.find(candidate=>Number(candidate.stageNumber)===10);
const correctedCandidate=candidates.find(candidate=>Number(candidate.stageNumber)===17);
for(const candidate of [initialCandidate,correctedCandidate])if(!candidate||!/^[0-9a-f]{64}$/i.test(String(candidate.candidateHash||'')))fail('Both Stage 10 and Stage 17 require an exact frozen candidate SHA-256.');
if(initialCandidate.candidateId===correctedCandidate.candidateId||initialCandidate.candidateHash===correctedCandidate.candidateHash)fail('Corrected candidate is not distinct from the initial candidate.');

const expectedRuns=Array.from({length:10},(_,index)=>`RUN-${String(index+1).padStart(3,'0')}`);
const executions=requireArray('executions',30);
const executionSet=stageNumber=>{
  const records=executions.filter(record=>Number(record.stageNumber)===stageNumber);
  if(records.length!==10)fail(`Stage ${stageNumber} must contain exactly ten execution records.`);
  const ids=records.map(record=>record.runId).sort();
  if(expectedRuns.some((id,index)=>ids[index]!==id))fail(`Stage ${stageNumber} must contain RUN-001 through RUN-010 exactly once.`);
  if(new Set(records.map(record=>record.contextId)).size!==10)fail(`Stage ${stageNumber} does not preserve ten distinct execution contexts.`);
  if(records.some(record=>record.status!=='COMPLETE'||!String(record.isolationEvidence||'').trim()||!String(record.output||'').trim()||!String(record.evidence||'').trim()))fail(`Stage ${stageNumber} contains an incomplete or unproven execution.`);
  return records;
};
for(const stageNumber of [11,18,20])executionSet(stageNumber);

const verificationRecords=requireArray('verificationRecords',requirements.length*30);
const verifyMatrix=(verifyStage,runStage,requireSatisfied)=>{
  const records=verificationRecords.filter(record=>Number(record.stageNumber)===verifyStage);
  if(records.length!==requirements.length*10)fail(`Stage ${verifyStage} does not contain the complete requirement-by-run matrix.`);
  const keys=new Set(records.map(record=>`${record.runId}::${record.requirementId}`));
  for(const runId of expectedRuns)for(const requirement of requirements)if(!keys.has(`${runId}::${requirement.id}`))fail(`Stage ${verifyStage} is missing ${runId} × ${requirement.id}.`);
  if(records.some(record=>!String(record.independenceEvidence||'').trim()||!String(record.testEvidence||'').trim()))fail(`Stage ${verifyStage} contains verification without independence or test evidence.`);
  if(requireSatisfied&&records.some(record=>record.result!=='SATISFIED'))fail(`Stage ${verifyStage} contains a mandatory result that is not SATISFIED.`);
  executionSet(runStage);
};
verifyMatrix(12,11,false);
verifyMatrix(19,18,true);
verifyMatrix(20,20,true);

const defects=requireArray('defects');
if(defects.some(defect=>defect.status!=='CORRECTED'||!String(defect.rootCause||'').trim()||!String(defect.earliestResponsibleLayer||'').trim()))fail('A retained defect is unresolved or lacks a root cause.');
const regressions=requireArray('regressionTests');
const corrections=requireArray('corrections');
for(const defect of defects){
  if(!regressions.some(test=>test.defectId===defect.id&&test.status==='PASS'))fail(`${defect.id} lacks a passing permanent regression test.`);
  if(!corrections.some(correction=>correction.defectId===defect.id&&correction.status==='COMPLETE'))fail(`${defect.id} lacks a completed responsible-layer correction.`);
}
if(!requireArray('convergenceCycles').some(cycle=>cycle.conclusion==='CONVERGED'&&Number(cycle.mandatoryCoveragePct)===100&&Number(cycle.verificationCoveragePct)===100&&Number(cycle.regressionPassPct)===100&&['criticalDefects','majorDefects','mandatoryUnknowns','contradictions','ambiguities','unexplainedVariance'].every(key=>Number(cycle[key])===0)))fail('Retained project does not contain a valid converged cycle.');
requireArray('comparisons',2);
requireArray('baselines');

const products=requireArray('products');
const product=products.find(item=>Number(item.stageNumber)===22&&item.productId);
if(!product||product.artifactKind!=='FILE'||!product.artifactFile?.stored||!product.artifactFile?.base64)fail('Stage 22 does not retain the exact finished application bytes as a native FILE product.');
const productBytes=Buffer.from(product.artifactFile.base64,'base64');
const appSha256=sha256(htmlBytes);
if(!productBytes.equals(htmlBytes))fail('Retained Stage 22 product bytes do not equal the current application bytes.');
if(product.artifactFile.size!==htmlBytes.length||product.exactByteLength!==htmlBytes.length)fail('Retained product byte length is incorrect.');
if(product.artifactFile.sha256!==appSha256||product.computedSha256!==appSha256)fail('Retained product SHA-256 is incorrect.');

if(requireArray('deterministicChecks').some(check=>!['PASS','NOT_APPLICABLE'].includes(check.status)))fail('A deterministic product check did not pass.');
for(const requirement of requirements.filter(item=>item.semanticVerification==='REQUIRED'))if(!requireArray('semanticChecks').some(check=>check.requirementId===requirement.id&&check.result==='SATISFIED'))fail(`${requirement.id} lacks a satisfied independent semantic check.`);
if(requireArray('adversarialChecks').some(check=>!['PASS','NOT_APPLICABLE'].includes(check.status)))fail('An adversarial product check found a defect or blocker.');
if(requireArray('representationInspections').some(check=>!['PASS','NOT_APPLICABLE'].includes(check.status)))fail('A final representation inspection failed or was blocked.');
if(!requireArray('processAudits').some(audit=>audit.status==='PASS'))fail('No independent process audit passed.');
if(!requireArray('productAudits').some(audit=>audit.status==='PASS'))fail('No independent product audit passed.');

const decisions=requireArray('decisions');
if(decisions.length!==1||decisions[0].decision!=='ACCEPTED')fail('Retained project does not have exactly one ACCEPTED release decision.');
const hashes=requireArray('hashVerifications');
const hashRecord=hashes.find(record=>record.productId===product.productId&&record.match==='YES');
if(!hashRecord||hashRecord.algorithm!=='SHA-256'||hashRecord.auditedHash!==appSha256||hashRecord.releaseHash!==appSha256||Number(hashRecord.byteLength)!==htmlBytes.length)fail('Release hash record does not prove exact product, audited, and release byte identity.');
const releases=requireArray('releases');
if(releases.length!==1||releases[0].releaseStatus!=='RELEASED'||releases[0].productId!==product.productId||!String(releases[0].destination||'').includes('sjonesjones917.github.io/closed-loop-tracker'))fail('Retained project does not contain the exact accepted release record for the configured Pages destination.');
requireArray('workflowArtifacts');

const meta=project.legacyProjectMetadata||{};
if(meta.releaseDecision!=='ACCEPTED'||meta.auditedHash!==appSha256||meta.releaseHash!==appSha256)fail('Retained project metadata does not bind acceptance and release to the current application bytes.');
if(html.includes(project.projectId)||html.includes(stage1.slice(0,160)))fail('Completed retained project state is embedded in the application HTML instead of remaining a separate importable project.');

const projectSha256=sha256(projectBytes);
const result={status:'PASS',selfProject:true,nativeCurrentSchema:true,aboutCompleteApplication:true,stageWorkflowMatchesCurrentApp:true,stages:31,stage1Scopes:20,externalSources:externalSources.length,requirements:requirements.length,initialExecutions:10,correctedExecutions:10,confirmationExecutions:10,verificationRows:verificationRecords.length,defectsCorrected:defects.length,releaseDecision:'ACCEPTED',appBytes:htmlBytes.length,appSha256,projectSha256};
fs.writeFileSync('SELF_PROJECT_VERIFICATION.json',`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
