import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!ingestion)throw new Error('Definition-of-done verifier could not load the responsible layers.');

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const coverageMetric=(metricId,passed,total,includedIds,excluded=[])=>{
  assert(Number.isInteger(total)&&total>0,`${metricId} has an empty or invalid denominator without an independently accepted evidence-supported EMPTY_UNIVERSE determination.`);
  assert(Number.isInteger(passed)&&passed>=0&&passed<=total,`${metricId} has an invalid numerator ${passed}/${total}.`);
  const ids=Array.isArray(includedIds)?includedIds.map(String):[];
  assert(ids.length===total,`${metricId} closed-universe IDs do not reconcile with denominator ${total}.`);
  return Object.freeze({metricId,derivationVersion:'closed-loop-definition-of-done-metrics/2',universeDefinition:`Exact verifier-owned closed universe for ${metricId}`,numerator:passed,denominator:total,includedIds:ids,excludedIds:Array.isArray(excluded)?excluded:[],scopeHash:globalThis.closedLoopHash.sha256Value({metricId,includedIds:ids,excludedIds:excluded}),evidenceReferences:['verify-definition-of-done.mjs'],value:passed/total,disposition:passed===total?'SATISFIED':'VIOLATED'});
};
const producers=new Set(Object.values(schema.PRODUCER));
const fieldRows=[];
for(const [name,def] of Object.entries(schema.JOB_FIELDS))fieldRows.push({kind:'job',owner:name,def});
for(const [stage,defs] of Object.entries(schema.STAGE_FIELDS))for(const [name,def] of Object.entries(defs))fieldRows.push({kind:'stage',owner:`${stage}.${name}`,def});
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [name,def] of Object.entries(record.fieldDefinitions||{}))fieldRows.push({kind:'record',owner:`${collection}.${name}`,def});
assert(fieldRows.length>0,'No canonical fields were discovered.');

const ownershipPassed=fieldRows.filter(({def})=>producers.has(def.producer)).length;
const fieldOwnershipMetric=coverageMetric('FIELD_OWNERSHIP_COVERAGE',ownershipPassed,fieldRows.length,fieldRows.map(row=>`${row.kind}:${row.owner}`));
const fieldOwnershipCoverage=fieldOwnershipMetric.value;
assert(fieldOwnershipCoverage===1,'Field ownership coverage is not 100%.');

const applicationRows=fieldRows.filter(({def})=>def.producer===schema.PRODUCER.APPLICATION);
const derivationPassed=applicationRows.filter(({def})=>typeof(def.derivationKey||def.derivation)==='string'&&String(def.derivationKey||def.derivation).trim()).length;
const applicationDerivationMetric=coverageMetric('APPLICATION_DERIVATION_COVERAGE',derivationPassed,applicationRows.length,applicationRows.map(row=>`${row.kind}:${row.owner}`));
const applicationDerivationCoverage=applicationDerivationMetric.value;
assert(applicationDerivationCoverage===1,'Application derivation coverage is not 100%.');

const relationshipRows=[];
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [field,target] of Object.entries(record.relationships||{}))relationshipRows.push({collection,field,target,def:record.fieldDefinitions?.[field]});
assert(relationshipRows.length>0,'No typed relationships were discovered.');
const relationshipPassed=relationshipRows.filter(row=>row.def&&schema.RECORD_SCHEMAS[row.target]&&['REFERENCE','REFERENCE_ARRAY'].includes(row.def.valueType)).length;
const typedRelationshipMetric=coverageMetric('TYPED_RELATIONSHIP_COVERAGE',relationshipPassed,relationshipRows.length,relationshipRows.map(row=>`${row.collection}.${row.field}->${row.target}`));
const typedRelationshipCoverage=typedRelationshipMetric.value;
assert(typedRelationshipCoverage===1,'Typed relationship coverage is not 100%.');

const agentRows=fieldRows.filter(({def})=>def.producer===schema.PRODUCER.AGENT);
const extractionPassed=agentRows.filter(({def})=>typeof def.responsePath==='string'&&def.responsePath.startsWith('/')&&def.provenanceRequired===true).length;
const acceptedAgentValueExtractionMetric=coverageMetric('ACCEPTED_AGENT_VALUE_EXTRACTION_COVERAGE',extractionPassed,agentRows.length,agentRows.map(row=>`${row.kind}:${row.owner}`));
const acceptedAgentValueExtractionCoverage=acceptedAgentValueExtractionMetric.value;
assert(acceptedAgentValueExtractionCoverage===1,'Accepted agent-value extraction metadata coverage is not 100%.');

const relationshipProvenancePassed=relationshipRows.filter(({def,target})=>def?.producer===schema.PRODUCER.APPLICATION&&schema.RECORD_SCHEMAS[target]).length;
const acceptedRelationshipProvenanceMetric=coverageMetric('ACCEPTED_RELATIONSHIP_PROVENANCE_COVERAGE',relationshipProvenancePassed,relationshipRows.length,relationshipRows.map(row=>`${row.collection}.${row.field}->${row.target}`));
const acceptedRelationshipProvenanceCoverage=acceptedRelationshipProvenanceMetric.value;
assert(acceptedRelationshipProvenanceCoverage===1,'Accepted relationship provenance ownership coverage is not 100%.');

assert(core.STAGE_COUNT===30&&core.STAGES.length===30&&core.WORKFLOW_ID==='mobile-closed-loop/30','30-stage workflow identity changed.');
assert(core.PROJECT_SCHEMA==='closed-loop-project/3'&&schema.RESPONSE_SCHEMA==='closed-loop-stage-response/3','Schema identity changed.');
assert(JSON.stringify(engine.applicationTestCapabilities())===JSON.stringify(['CLOSED_LOOP_TEST_IR']),'The only registered project-test executor must be the proven Closed Loop Test IR runtime.');
assert(fs.existsSync('test-runtime.js')&&fs.existsSync('test-worker.js')&&fs.existsSync('verify-test-runtime.mjs'),'Native Test IR executor proof files are missing.');

const workflowSource=fs.readFileSync('.github/workflows/pages.yml','utf8');
assert((workflowSource.match(/^name:/gm)||[]).length===1,'Pages workflow file is malformed.');
const workflows=fs.readdirSync('.github/workflows').filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'));
assert(workflows.length===1&&workflows[0]==='pages.yml','Repository must retain exactly one Pages workflow.');
assert(workflowSource.includes('node verify-semantic-invariant.mjs'),'Semantic false-acceptance invariant is not in CI.');
assert(workflowSource.includes('verify-browser.mjs')&&workflowSource.includes('verify-browser-extra.mjs'),'Chromium acceptance is not in CI.');
assert(workflowSource.includes('Exact deployed-byte verification')&&workflowSource.includes('run: node verify-live.mjs'),'Exact deployed-byte verification is not in CI.');

// Registry declarations and CI wiring are useful checks, but they do not
// measure behavior, accepted records, or the full specification universe.
const declarationChecks={
 producerLabels:{declared:fieldRows.length,present:ownershipPassed},
 derivationIdentifiers:{declared:applicationRows.length,present:derivationPassed},
 relationshipTypes:{declared:relationshipRows.length,present:relationshipPassed},
 agentProvenanceDescriptors:{declared:agentRows.length,present:extractionPassed},
 relationshipOwnerLabels:{declared:relationshipRows.length,present:relationshipProvenancePassed}
};
const unmeasuredCoverage=['fieldOwnershipCoverage','applicationDerivationCoverage','typedRelationshipCoverage','acceptedAgentValueExtractionCoverage','acceptedRelationshipProvenanceCoverage','currentScopeSelectorCoverage','exactReqRunTestCoverage','applicableCurrentRegressionSuccess','mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage'];
const unmeasuredCounters=['unauthorizedFieldMutationsAccepted','canonicalMutationsBeforeAcceptance','partialCommitsAfterInjectedFailure','staleProposalsAccepted','crossProjectRelationshipsAccepted','historicalScopeSatisfyingCurrentGates','unmatchedDeliveryFilesAuthorized','appendOnlyHistoryRewritesAccepted','favorableAgentVerdictsOverridingContradictoryObservations','structurallyInsufficientEvidenceProducingMandatorySatisfaction','externallySupportedUnestablishedIndependenceTreatedAsProven'];
console.log(JSON.stringify({
 schemaDeclarationChecks:'PASS',evidenceClass:'REGISTRY_DECLARATIONS_AND_CI_CONFIGURATION',
 declarationChecks,stageCount:core.STAGE_COUNT,singlePagesWorkflow:true,
 applicationCompletion:false,mandatoryBehavioralUniverseEstablished:false,
 ...Object.fromEntries([...unmeasuredCoverage,...unmeasuredCounters].map(name=>[name,null])),
 coverageMetrics:Object.fromEntries(unmeasuredCoverage.map(name=>[name,{metricId:name,value:null,disposition:'UNKNOWN',universeDefinition:'The full mandatory behavioral case universe has not been established by declaration checks.',numerator:null,denominator:null,includedIds:[],excludedIds:[],evidenceReferences:[]}]))
},null,2));
