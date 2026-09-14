import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const fault=spawnSync(process.execPath,['verify-history-selection-capture.mjs','--fault=late-history-selection'],{encoding:'utf8'});
assert.notEqual(fault.status,0,'The delayed History selection fault was not detected');
assert.match(fault.stderr,/HISTORY_SELECTION_ORACLE/,'The test failed for an unrelated reason');
const restored=spawnSync(process.execPath,['verify-history-selection-capture.mjs'],{encoding:'utf8'});
assert.equal(restored.status,0,restored.stderr);
console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases:[{fault:'READ_SELECTED_DESTINATION_AFTER_HISTORY_REPAINT',oracle:'HISTORY_SELECTION_ORACLE',result:'DETECTED'}],restoredImplementation:'PASS'},null,2));
