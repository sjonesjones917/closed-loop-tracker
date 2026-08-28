import fs from 'node:fs';
import vm from 'node:vm';

globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});

const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const engine=globalThis.closedLoopWorkflowEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!schema||!engine||!ingestion)throw new Error('Definition-of-done verifier could not load the responsible layers.');

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const ratio=(passed,total)=>total===0?1:passed/total;
const producers=new Set(Object.values(schema.PRODUCER));
const fieldRows=[];
for(const [name,def] of Object.entries(schema.JOB_FIELDS))fieldRows.push({kind:'job',owner:name,def});
for(const [stage,defs] of Object.entries(schema.STAGE_FIELDS))for(const [name,def] of Object.entries(defs))fieldRows.push({kind:'stage',owner:`${stage}.${name}`,def});
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [name,def] of Object.entries(record.fieldDefinitions||{}))fieldRows.push({kind:'record',owner:`${collection}.${name}`,def});
assert(fieldRows.length>0,'No canonical fields were discovered.');

const ownershipPassed=fieldRows.filter(({def})=>producers.has(def.producer)).length;
const fieldOwnershipCoverage=ratio(ownershipPassed,fieldRows.length);
assert(fieldOwnershipCoverage===1,'Field ownership coverage is not 100%.');

const applicationRows=fieldRows.filter(({def})=>def.producer===schema.PRODUCER.APPLICATION);
const derivationPassed=applicationRows.filter(({def})=>typeof(def.derivationKey||def.derivation)==='string'&&String(def.derivationKey||def.derivation).trim()).length;
const applicationDerivationCoverage=ratio(derivationPassed,applicationRows.length);
assert(applicationDerivationCoverage===1,'Application derivation coverage is not 100%.');

const relationshipRows=[];
for(const [collection,record] of Object.entries(schema.RECORD_SCHEMAS))for(const [field,target] of Object.entries(record.relationships||{}))relationshipRows.push({collection,field,target,def:record.fieldDefinitions?.[field]});
assert(relationshipRows.length>0,'No typed relationships were discovered.');
const relationshipPassed=relationshipRows.filter(row=>row.def&&schema.RECORD_SCHEMAS[row.target]&&['REFERENCE','REFERENCE_ARRAY'].includes(row.def.valueType)).length;
const typedRelationshipCoverage=ratio(relationshipPassed,relationshipRows.length);
assert(typedRelationshipCoverage===1,'Typed relationship coverage is not 100%.');

const agentRows=fieldRows.filter(({def})=>def.producer===schema.PRODUCER.AGENT);
const extractionPassed=agentRows.filter(({def})=>typeof def.responsePath==='string'&&def.responsePath.startsWith('/')&&def.provenanceRequired===true).length;
const acceptedAgentValueExtractionCoverage=ratio(extractionPassed,agentRows.length);
assert(acceptedAgentValueExtractionCoverage===1,'Accepted agent-value extraction metadata coverage is not 100%.');

const relationshipProvenancePassed=relationshipRows.filter(({def,target})=>def?.producer===schema.PRODUCER.APPLICATION&&schema.RECORD_SCHEMAS[target]).length;
const acceptedRelationshipProvenanceCoverage=ratio(relationshipProvenancePassed,relationshipRows.length);
assert(acceptedRelationshipProvenanceCoverage===1,'Accepted relationship provenance ownership coverage is not 100%.');

assert(core.STAGE_COUNT===30&&core.STAGES.length===30&&core.WORKFLOW_ID==='mobile-closed-loop/30','30-stage workflow identity changed.');
assert(core.PROJECT_SCHEMA==='closed-loop-project/2'&&schema.RESPONSE_SCHEMA==='closed-loop-stage-response/2','Schema identity changed.');
assert(engine.applicationTestCapabilities().length===0,'APPLICATION_TEST_EXECUTORS is no longer empty without a proven native executor.');

const workflowSource=fs.readFileSync('.github/workflows/pages.yml','utf8');
assert((workflowSource.match(/^name:/gm)||[]).length===1,'Pages workflow file is malformed.');
const workflows=fs.readdirSync('.github/workflows').filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'));
assert(workflows.length===1&&workflows[0]==='pages.yml','Repository must retain exactly one Pages workflow.');
assert(workflowSource.includes('node verify-semantic-invariant.mjs'),'Semantic false-acceptance invariant is not in CI.');
assert(workflowSource.includes('verify-browser.mjs')&&workflowSource.includes('verify-browser-extra.mjs'),'Chromium acceptance is not in CI.');
assert(workflowSource.includes('Verify exact deployed source identity'),'Exact deployed-byte verification is not in CI.');

const engineSource=fs.readFileSync('workflow-engine.js','utf8');
for(const token of ['evaluateEvidenceContract','evaluateResultConsistency','effectiveDetermination','validateTraceIntegrity','detectCurrentContradictions','releaseMetrics','testExecutionPlan','executionHandoff'])assert(engineSource.includes(token),`Central reliability authority missing ${token}.`);
assert((engineSource.match(/function evaluateEvidenceContract\(/g)||[]).length===1,'Evidence-contract authority is duplicated.');assert(/function evaluateEvidenceSufficiency[\s\S]*?evaluateEvidenceContract\(test,result,null,project\)/.test(engineSource),'Evidence-sufficiency compatibility path does not delegate to the central evidence contract.');assert(!engineSource.includes(".map(v=>upper(recordValue(v,'DETERMINATION')))"),'Stability still consumes agent-submitted determinations.');assert(engineSource.includes("generator self-evaluation','other verifiers’ determinations"),'Stage 12 handoff isolation is incomplete.');assert(engineSource.includes("prior meaning-review verdict unless explicitly authorized"),'Stage 24 handoff isolation is incomplete.');

console.log(JSON.stringify({
  fieldOwnershipCoverage,
  applicationDerivationCoverage,
  typedRelationshipCoverage,
  acceptedAgentValueExtractionCoverage,
  acceptedRelationshipProvenanceCoverage,
  canonicalFieldCount:fieldRows.length,
  applicationFieldCount:applicationRows.length,
  agentFieldCount:agentRows.length,
  typedRelationshipCount:relationshipRows.length,
  stageCount:core.STAGE_COUNT,
  singlePagesWorkflow:true,
  applicationTestExecutorCount:engine.applicationTestCapabilities().length,
  centralAdjudication:true
},null,2));
