import vm from 'node:vm';
import assert from 'node:assert/strict';
import {projectStoreRuntime} from './test-project-store-runtime.mjs';
import {stage04PromptProvenanceSource} from './test-browser-stage04-provenance.mjs';
const {runtime}=projectStoreRuntime();
const proof=vm.runInContext(stage04PromptProvenanceSource()+`;stage04PromptProvenanceProbe({core:closedLoopCore,schema:closedLoopWorkflowSchema,engine:closedLoopWorkflowEngine,prompts:closedLoopPromptEngine,ingestion:closedLoopResponseIngestion})`,runtime);
assert.equal(proof.refusals.length,3);
assert(proof.prompt.includes('current User Job Input'));
console.log(JSON.stringify({...proof,prompt:undefined}));
