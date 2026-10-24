import assert from 'node:assert/strict';
import {readDeferredDefinitionLegacyFixture,currentRetainedFixtureProject} from './test-fixtures.mjs';
import {restoreArtifactFixture,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
// Stage6 author tests require accepted stages1–5 and original bytes. An old
// Stage7 native definition becoming unsupported after an honest registry change
// is not a prerequisite to reauthoring Stage6. Never restamp its accepted data.
export async function testIrAuthorPrerequisite(r){
 const payload=readDeferredDefinitionLegacyFixture(r),retained=payload.admittedDueFixtures?.failureTests||payload.cohorts?.failureTests?.currentSupportedRecovery;
 assert(retained?.project&&retained.artifacts,'TEST_IR_AUTHOR_RETAINED_PREREQUISITE_ORACLE');
 const p=currentRetainedFixtureProject(r,retained.project);await restoreArtifactFixture(r.store,retained.artifacts);await hydrateRetainedPromptContexts(r,p,retained.contextFiles||[]);
 if(payload.archivedFixtureClockUtc){const clock=payload.archivedFixtureClockUtc;r.runtime.Date=class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return Date.parse(clock);}};}
 r.engine.recalculate(p);for(let stage=1;stage<=5;stage++)assert.equal(r.engine.gate(stage,p).complete,true,'TEST_IR_AUTHOR_ACTUAL_PREREQUISITE_ORACLE '+stage);
 return {p,synthetic:true,actualBrowser:false,priorStagesAreSetupOnly:true};
}
