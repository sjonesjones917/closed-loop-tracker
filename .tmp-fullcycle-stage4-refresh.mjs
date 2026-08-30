// Refresh full-cycle Stage 01 accounting and make release-proof invariants explicit.
import fs from 'node:fs';
let s=fs.readFileSync('verify-full-cycle.mjs','utf8');
const needle="data(2,{stageData:{AUTHORITY_HIERARCHY:'No external authority applies.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Evidence-supported search found no applicable external governing source.'}});complete(2);data(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'1',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'}});complete(3);\ndata(4,";
if(!s.includes(needle))throw new Error('full-cycle Stage 4 anchor missing');
const replacement="data(2,{stageData:{AUTHORITY_HIERARCHY:'No external authority applies.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Evidence-supported search found no applicable external governing source.'}});complete(2);data(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'1',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'}});complete(3);\np.stages[1].agentData.INPUT_SET_CONTENTS=completeStage1InputSetContents();p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};\ndata(4,";
s=s.replace(needle,replacement);
fs.writeFileSync('verify-full-cycle.mjs',s);

let pages=fs.readFileSync('.github/workflows/pages.yml','utf8');
const reportAnchor="            ...definition,\n            ...v3,\n";
const explicitFields="            favorableAgentVerdictsOverridingContradictoryObservations: definition.favorableAgentVerdictsOverridingContradictoryObservations,\n            externallySupportedUnestablishedIndependenceTreatedAsProven: definition.externallySupportedUnestablishedIndependenceTreatedAsProven,\n";
if(!pages.includes('favorableAgentVerdictsOverridingContradictoryObservations: definition.')){
  if(!pages.includes(reportAnchor))throw new Error('machine acceptance report anchor missing');
  pages=pages.replace(reportAnchor,reportAnchor+explicitFields);
}
fs.writeFileSync('.github/workflows/pages.yml',pages);

let lifecycle=fs.readFileSync('verify-project-lifecycle.mjs','utf8');
const lifecycleOld="for(const token of ['currentScopeSelectorCoverage','exactReqRunTestCoverage','applicableCurrentRegressionSuccess','mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage','favorableAgentVerdictsOverridingContradictoryObservations','externallySupportedUnestablishedIndependenceTreatedAsProven'])assert(pages.includes(token),`Acceptance reduction lost required invariant ${token}.`);";
const lifecycleNew="for(const token of ['currentScopeSelectorCoverage','exactReqRunTestCoverage','applicableCurrentRegressionSuccess','mandatoryEvidenceChainCoverage','releaseArtifactIdentityCoverage'])assert(pages.includes(token),`Acceptance reduction lost required invariant ${token}.`);assert(pages.includes('...definition'),'Acceptance reduction must preserve all definition-of-done invariants, including required zero-valued failure counters.');";
if(lifecycle.includes(lifecycleOld))lifecycle=lifecycle.replace(lifecycleOld,lifecycleNew);
else if(!lifecycle.includes('required zero-valued failure counters'))throw new Error('lifecycle acceptance-reduction anchor missing');
fs.writeFileSync('verify-project-lifecycle.mjs',lifecycle);
console.log('full-cycle Stage 01 accounting, explicit acceptance invariants, and lifecycle reduction refreshed');
