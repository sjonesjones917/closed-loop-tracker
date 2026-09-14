import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=fault=>spawnSync(process.execPath,['verify-exact-progress.mjs'],{encoding:'utf8',env:{...process.env,CLRT_EXACT_PROGRESS_FAULT:fault},timeout:60000});
const broken=run('fractional-coverage');
assert.notEqual(broken.status,0,'The partial-progress regression did not detect fractional persisted coverage.');
assert.match(broken.stderr,/EXACT_PROGRESS_ORACLE/,'The fault failed for a different reason.');
const restored=run('');assert.equal(restored.status,0,restored.stdout+'\n'+restored.stderr);
console.log(JSON.stringify({synthetic:true,actualBrowser:false,fault:'Fractional JSON number substituted in the responsible coverage producer',result:'DETECTED',restoredImplementation:'PASS',restoredCases:JSON.parse(restored.stdout).cases},null,2));
