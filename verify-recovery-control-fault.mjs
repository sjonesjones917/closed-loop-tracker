import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=args=>spawnSync(process.execPath,['verify-operator-action-lifecycle.mjs',...args],{encoding:'utf8'});
const broken=run(['--fault=obsolete-recovery-control']);
assert.notEqual(broken.status,0,'Obsolete Undo availability escaped detection');
assert.match(broken.stderr,/RECOVERY_CONTROL_ORACLE/,'The fault failed for an unrelated reason');
const restored=run([]);assert.equal(restored.status,0,restored.stderr);
console.log(JSON.stringify({synthetic:true,actualBrowser:false,cases:[{fault:'Restore pre-operation Undo availability after the active history changes',oracle:'RECOVERY_CONTROL_ORACLE',result:'DETECTED'}],restoredImplementation:'PASS'},null,2));
