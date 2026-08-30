// Rerun materializer after deployment-proof label correction.
import fs from 'node:fs';
let s=fs.readFileSync('verify-full-cycle.mjs','utf8');
const needle="data(2,{stageData:{AUTHORITY_HIERARCHY:'No external authority applies.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Evidence-supported search found no applicable external governing source.'}});complete(2);data(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'1',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'}});complete(3);\ndata(4,";
if(!s.includes(needle))throw new Error('full-cycle Stage 4 anchor missing');
const replacement="data(2,{stageData:{AUTHORITY_HIERARCHY:'No external authority applies.',SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',KNOWN_CONTROLLING_SOURCES_EXAMINED:'Evidence-supported search found no applicable external governing source.'}});complete(2);data(3,{stageData:{EXCEPTIONS_AND_EDGE_CONDITIONS:'NONE',CONFLICTING_OR_INVALIDATING_MATERIAL:'NONE',RESEARCH_GAPS_AND_BLOCKERS:'NONE',SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:'TRUE',LATEST_PASS_NUMBER:'1',NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:'FALSE'}});complete(3);\np.stages[1].agentData.INPUT_SET_CONTENTS=completeStage1InputSetContents();p.stages[1].status='COMPLETE';p.stages[1].gate={complete:true,blocked:false,reasons:[]};\ndata(4,";
s=s.replace(needle,replacement);
fs.writeFileSync('verify-full-cycle.mjs',s);
console.log('full-cycle Stage 1 accounting refreshed for current input version');
