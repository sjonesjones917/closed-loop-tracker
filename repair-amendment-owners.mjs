import fs from 'node:fs';

const wrapper=fs.readFileSync('controlling-amendment.js','utf8');
const VERSION="closed-loop-controlling-completion/53-70/1";
const marker='/* INTEGRATED CONTROLLING COMPLETION 53-70 */';
const strip=file=>{let s=fs.readFileSync(file,'utf8');const i=s.indexOf(marker);if(i>=0)s=s.slice(0,i).trimEnd()+'\n';return s;};
const between=(a,b)=>{const i=wrapper.indexOf(a),j=wrapper.indexOf(b,i);if(i<0||j<0)throw new Error(`Missing split marker ${a} -> ${b}`);return wrapper.slice(i,j+b.length);};

let schema=between("const VERSION='closed-loop-controlling-completion/53-70/1'","globalThis.closedLoopWorkflowSchema=schema;");
schema=schema.replace(/const safe=v=>[^\n]+\nconst list=v=>[^\n]+\n/,'');
const schemaBlock=`\n${marker}\n;(()=>{\n'use strict';\nconst core=globalThis.closedLoopCore,s0=globalThis.closedLoopWorkflowSchema,h=globalThis.closedLoopHash;\nif(!core||!s0||!h)throw new Error('Base schema/hash must load before integrated completion schema.');\n${schema}\nconst augmented=globalThis.closedLoopWorkflowSchema;\nglobalThis.closedLoopWorkflowSchema=Object.freeze({...augmented,TRUTH_VALUES:Object.freeze([...E.truth]),EPISTEMIC_BASES:Object.freeze([...E.basis]),APPLICABILITY_VALUES:Object.freeze([...E.applicability]),ENTAILMENT_VALUES:Object.freeze([...E.entailment]),PROOF_EXPRESSION_OPERATORS:Object.freeze(['LEAF','ALL_OF','ANY_OF','AT_LEAST_K']),NORMATIVE_CLASS_VALUES:Object.freeze([...E.normative]),SEMANTIC_COVERAGE_VALUES:Object.freeze([...E.coverage]),OBSERVATION_ORIGIN_VALUES:Object.freeze([...E.origin]),DELIVERY_STATE_VALUES:Object.freeze([...E.delivery])});\n})();\n`;
fs.writeFileSync('workflow-schema.js',strip('workflow-schema.js')+schemaBlock);

let engine=between('const NEW=Object.keys(add);','globalThis.closedLoopWorkflowEngine=engine;');
engine=engine.replace('const NEW=Object.keys(add);',"const NEW=['propositions','propositionEquivalenceReviews','applicabilityRecords','proofExpressions','proofObligations','observationRecords','entailmentReviews','environmentDependencies','operationReservations','deliveryRecords','deploymentManifests'];");
engine=engine.replace("const engine=Object.freeze({...e0,version:'closed-loop-workflow-engine/3'", "const RESPONSIBLE_STAGE_MAP=Object.freeze({propositions:4,propositionEquivalenceReviews:5,applicabilityRecords:5,proofExpressions:6,proofObligations:6,observationRecords:1,entailmentReviews:1,environmentDependencies:1,operationReservations:1,deliveryRecords:27,deploymentManifests:1,requirements:4,tests:6,failureTests:7,instructions:8,runs:11,verification:12,comparisons:13,defects:14,regressions:15,changes:16,baselines:20,products:21,deterministicResults:22,meaningResults:23,adversarialResults:24,representationInspections:25,processAudits:26,productAudits:26,releaseRecords:27,artifactIdentities:28,evidenceChains:29});\nfunction responsibleStageForMutation(family){return RESPONSIBLE_STAGE_MAP[family]??1;}\nconst engine=Object.freeze({...e0,version:'closed-loop-workflow-engine/3'");
engine=engine.replace('evaluateProofExpression:evalExpr,propositionState:pstate,proofObligationSet:obligations,requiredVerificationRelationSet:relationSet,', 'evaluateProofExpression:evalExpr,evaluatePropositionState:pstate,propositionState:pstate,deriveProofObligations:obligations,proofObligationSet:obligations,deriveRequiredVerificationRelationSet:relationSet,requiredVerificationRelationSet:relationSet,responsibleStageForMutation,RESPONSIBLE_STAGE_MAP,');
engine=engine.replace('createDeliveryRecord:delivery,registryIntegrity:registry', 'deriveTerminalDeliveryRecord:delivery,createDeliveryRecord:delivery,registryIntegrity:registry');
const engineBlock=`\n${marker}\n;(()=>{\n'use strict';\nconst e0=globalThis.closedLoopWorkflowEngine,schema=globalThis.closedLoopWorkflowSchema,h=globalThis.closedLoopHash;\nif(!e0||!schema||!h)throw new Error('Base engine/schema/hash must load before integrated completion engine.');\nconst VERSION='${VERSION}',E=schema.CONTROLLING_COMPLETION_ENUMS,RS=schema.RECORD_SCHEMAS;\nconst safe=v=>Array.isArray(v)?v:[],up=v=>String(v==null?'':v).trim().toUpperCase(),fv=(r,k)=>e0.recordValue(r,k),scope=p=>e0.currentScope(p),old=(p,c)=>e0.recordsForCurrentScope(p,c);\nconst list=v=>{if(Array.isArray(v))return v.map(String).map(x=>x.trim()).filter(Boolean);if(v==null||v==='')return[];if(typeof v==='string'){try{const x=JSON.parse(v);if(Array.isArray(x))return x.map(String).map(y=>y.trim()).filter(Boolean);}catch{}return v.split(/[\\n,;]+/).map(x=>x.trim()).filter(Boolean);}return[String(v)];};\n${engine}\n})();\n`;
fs.writeFileSync('workflow-engine.js',strip('workflow-engine.js')+engineBlock);

let runtime=between('function exactIssues(spec)','globalThis.closedLoopTestRuntime=runtime;');
runtime=runtime.replace("execute:async (spec,...args)=>{const v=validate(spec);if(!v.valid)throw new r0.RuntimeError('UNSUPPORTED_EXACT_SEMANTICS',v.issues.join(' '));return r0.execute(spec,...args);}","execute:async (request,...args)=>{const spec=request?.spec??request;const v=validate(spec);if(!v.valid)throw new r0.RuntimeError('UNSUPPORTED_EXACT_SEMANTICS',v.issues.join(' '));return r0.execute(request,...args);}");
const runtimeBlock=`\n${marker}\n;(()=>{\n'use strict';\nconst r0=globalThis.closedLoopTestRuntime;\nif(!r0)throw new Error('Base Test IR runtime must load before integrated completion runtime.');\nconst VERSION='${VERSION}',safe=v=>Array.isArray(v)?v:[],up=v=>String(v==null?'':v).trim().toUpperCase(),fv=(r,k)=>r?.fields?.[k]??r?.[k];\n${runtime}\n})();\n`;
fs.writeFileSync('test-runtime.js',strip('test-runtime.js')+runtimeBlock);

let promptStart=wrapper.indexOf('function dataEnvelope(value,sourceIdentity)');
let promptEnd=wrapper.indexOf('let pv=globalThis.closedLoopPromptEngine;',promptStart);
if(promptStart<0||promptEnd<0)throw new Error('Prompt split markers missing.');
let prompt=wrapper.slice(promptStart,promptEnd);
const promptBlock=`\n${marker}\n;(()=>{\n'use strict';\nconst schema=globalThis.closedLoopWorkflowSchema,h=globalThis.closedLoopHash;\nif(!schema||!h||!globalThis.closedLoopPromptEngine)throw new Error('Base prompt/schema/hash must load before integrated completion prompt boundary.');\nconst VERSION='${VERSION}',safe=v=>Array.isArray(v)?v:[];\nconst rid=(r,c)=>{const f=schema.RECORD_SCHEMAS[c]?.idField;return String(r?.id||r?.recordId||(f?(r?.fields?.[f]??r?.[f]):'')||'').trim();};\n${prompt}\nconst base=globalThis.closedLoopPromptEngine;\nglobalThis.closedLoopPromptEngine=wrapPrompt(base);\n})();\n`;
fs.writeFileSync('prompt-engine.js',strip('prompt-engine.js')+promptBlock);

let verifier=fs.readFileSync('verify-spec3-contract.mjs','utf8');
verifier=verifier.replace(",'controlling-amendment.js'",'').replace("'controlling-amendment.js',",'');
fs.writeFileSync('verify-spec3-contract.mjs',verifier);

for(const file of ['workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','verify-spec3-contract.mjs']){
  if(!fs.readFileSync(file,'utf8').includes(file==='verify-spec3-contract.mjs'?'__controllingCompletionAmendmentVersion':marker))throw new Error(`Integration failed for ${file}`);
}
console.log(JSON.stringify({integrated:true,owners:['workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'],wrapperRemovedByWorkflow:true}));
