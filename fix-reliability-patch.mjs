import fs from 'node:fs';
const path='apply-reliability-patch.mjs';
let source=fs.readFileSync(path,'utf8');

const broken="},id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields};chains.push(fields);chains[chains.length-1]={id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields};";
const repaired="};chains.push({id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields});";
if(!source.includes(broken))throw new Error('Expected evidence-chain patch-generator defect was not found.');
source=source.replace(broken,repaired);

function encodeRawTemplate(callMarker,endAnchor){
  const callStart=source.indexOf(callMarker);
  if(callStart<0)throw new Error(`Missing embedded-test call marker: ${callMarker}`);
  const rawStart=source.indexOf('String.raw`',callStart);
  if(rawStart<0)throw new Error(`Missing raw template after: ${callMarker}`);
  const bodyStart=rawStart+'String.raw`'.length;
  const anchorStart=source.indexOf(endAnchor,bodyStart);
  if(anchorStart<0)throw new Error(`Missing embedded-test end anchor: ${endAnchor}`);
  const closingBacktick=anchorStart+1;
  if(source[closingBacktick]!=='`')throw new Error(`Expected closing raw-template backtick for: ${callMarker}`);
  const body=source.slice(bodyStart,closingBacktick);
  source=source.slice(0,rawStart)+JSON.stringify(body)+source.slice(closingBacktick+1);
}

encodeRawTemplate("complete=appendOnce(complete,'deterministicReliabilityRouting:true'","\n`);\nwrite('verify-complete.mjs',complete);");
encodeRawTemplate("semantics=appendOnce(semantics,'contextLeakageRegression:true'","\n`);\nwrite('verify-prompt-semantics.mjs',semantics);");

const executionBlockNeedle="`const APPLICATION_TEST_EXECUTORS=Object.freeze({});\\n\\n${sourceOf(applicationTestCapabilities";
const executionActions="const TEST_EXECUTION_ACTIONS=Object.freeze({APPLICATION_DETERMINISTIC:'No operator execution is required only when the exact REQUIRED_CAPABILITY names a registered application-native test executor.',EXTERNAL_AGENT_TOOL:'Use a capable external agent/tool environment.',INDEPENDENT_AGENT_REVIEW:'Use a fresh independent reviewer context.',HUMAN_INSPECTION:'Perform the irreducible human inspection.',EXTERNAL_SYSTEM:'Use the declared external system and preserve its evidence.',UNAVAILABLE:'The required capability is unavailable and remains blocking.'});";
const executionBlockReplacement="`const APPLICATION_TEST_EXECUTORS=Object.freeze({});\\n"+executionActions+"\\n\\n${sourceOf(applicationTestCapabilities";
if(!source.includes(executionBlockNeedle))throw new Error('Expected execution-plan replacement template was not found.');
source=source.replace(executionBlockNeedle,executionBlockReplacement);

const overStrictCustody="verified=artifacts.filter(item=>upper(recordValue(item,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED'&&Number(recordValue(item,'BYTE_SIZE'))>=0&&/^[a-f0-9]{64}$/i.test(String(recordValue(item,'SHA256')||'')))";
const canonicalCustody="verified=artifacts.filter(item=>upper(recordValue(item,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED')";
if(!source.includes(overStrictCustody))throw new Error('Expected over-strict execution-routing custody predicate was not found.');
source=source.replace(overStrictCustody,canonicalCustody);

const enrichedItemNeedle="requiredArtifactIds:artifact.artifactIds,requiredArtifactNames";
const compatibleItem="artifactRequirements:artifact.artifactRequirements,evidenceIds:artifact.evidenceIds,artifactIds:artifact.artifactIds,requiredArtifactIds:artifact.artifactIds,requiredArtifactNames";
if(!source.includes(enrichedItemNeedle))throw new Error('Expected enriched execution-plan item shape was not found.');
source=source.replace(enrichedItemNeedle,compatibleItem);

const oldExportPatch="engine=engine.replace('testExecutionPlan,applicationTestCapabilities,operationalMetrics,','testExecutionPlan,executionHandoff,applicationTestCapabilities,evaluateContextIndependence,evaluateEvidenceSufficiency,detectCurrentContradictions,executionStability,regressionLifecycle,deriveNextRequiredAction,explainEvidenceChain,operationalMetrics,');";
const newExportPatch="engine=engine.replace('releaseMetrics,applicationTestCapabilities,testExecutionPlan,operationalMetrics,','releaseMetrics,applicationTestCapabilities,testExecutionPlan,executionHandoff,evaluateContextIndependence,evaluateEvidenceSufficiency,detectCurrentContradictions,executionStability,regressionLifecycle,deriveNextRequiredAction,explainEvidenceChain,operationalMetrics,');";
if(!source.includes(oldExportPatch))throw new Error('Expected ineffective engine export patch was not found.');
source=source.replace(oldExportPatch,newExportPatch);

const oldStage12Reason="if(!matrix.expected.length)reasons.push('No current mandatory verification triples exist.');";
const newStage12Reason="if(!matrix.expected.length)reasons.push('REQ × RUN × TEST coverage cannot be evaluated because no current mandatory verification triples exist.');";
if(!source.includes(oldStage12Reason))throw new Error('Expected Stage 12 empty-matrix diagnostic was not found.');
source=source.replace(oldStage12Reason,newStage12Reason);

const overStrictCompleted="const completed=runs.filter(run=>['COMPLETED','COMPLETE','SUCCESS','SUCCEEDED'].includes(upper(recordValue(run,'EXECUTION_STATUS')||run.status))&&String(recordValue(run,'COMPLETE_OUTPUT')||'').trim());if(completed.length!==10)reasons.push(`Exactly ten separately preserved completed run outputs are required; found ${completed.length}.`);";
const acceptedOutputCompleted="const completed=runs.filter(run=>String(recordValue(run,'COMPLETE_OUTPUT')||'').trim());if(completed.length!==10)reasons.push(`Exactly ten separately preserved completed run outputs are required; found ${completed.length}.`);";
if(!source.includes(overStrictCompleted))throw new Error('Expected over-strict Stage 11 execution-status predicate was not found.');
source=source.replace(overStrictCompleted,acceptedOutputCompleted);

const wrongAcceptedStage="const accepted=acceptedChanges(project,Number(iteration?.stage)||([String(purpose).toUpperCase()==='INITIAL'?11:17])).filter(change=>String(change.scope?.iterationId||'')===id)";
const correctAcceptedStage="const acceptedStage=upper(purpose)==='INITIAL'?11:upper(purpose)==='CORRECTED'?17:19,accepted=acceptedChanges(project,acceptedStage).filter(change=>String(change.scope?.iterationId||'')===id)";
if(!source.includes(wrongAcceptedStage))throw new Error('Expected Stage 11 accepted-response stage-selection defect was not found.');
source=source.replace(wrongAcceptedStage,correctAcceptedStage);

const oldMissing="const actualKeys=new Set(valid.map(verificationKey)),missing=expected.filter(key=>!actualKeys.has(key)||duplicates.includes(key));";
const newMissing="const presentKeys=new Set([...grouped.entries()].filter(([,items])=>items.length===1).map(([key])=>key)),missing=expected.filter(key=>!presentKeys.has(key)||duplicates.includes(key));";
if(!source.includes(oldMissing))throw new Error('Expected verification-matrix missing-set coupling was not found.');
source=source.replace(oldMissing,newMissing);

const routingHeading="<h2 class=\"section-title\">Who performs verification</h2>";
if(!source.includes(routingHeading))throw new Error('Expected new execution-routing heading was not found.');
source=source.replace(routingHeading,"<h2 class=\"section-title\">Verification execution</h2>");
const routingIntro="Execution routing is calculated once by the workflow engine from the accepted TEST records, current capability evidence, and verified artifact custody. The screen does not reinterpret execution mode.";
if(!source.includes(routingIntro))throw new Error('Expected new execution-routing intro was not found.');
source=source.replace(routingIntro,"Who performs the current tests is calculated once by the workflow engine from the accepted TEST records, current capability evidence, and verified artifact custody. The screen does not reinterpret execution mode. No registered application-native executor exists unless the declared required capability exactly matches the registered executor list; an unsupported APPLICATION_DETERMINISTIC route is shown as an Invalid application executor claim and remains blocked.");
const handoffIntro="Transfer only the items below. Browser-local storage does not automatically give an external agent or tool access to these bytes.";
if(!source.includes(handoffIntro))throw new Error('Expected artifact-handoff intro was not found.');
source=source.replace(handoffIntro,"Transfer only the items below. Remember: a filename, hash claim, or code block is not file possession. Browser-local storage does not automatically give an external agent or tool access to these bytes.");

fs.writeFileSync(path,source);
console.log('Patch generator repaired while preserving Stage 12 continuation accounting separately from gate evidence validity.');
