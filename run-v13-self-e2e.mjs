import {spawnSync} from 'node:child_process';

const build=spawnSync(process.execPath,['build-v13-self.mjs'],{encoding:'utf8',stdio:'inherit'});
if(build.status!==0)process.exit(build.status??1);
const test=spawnSync(process.execPath,['self-browser-e2e.mjs'],{encoding:'utf8',stdio:'inherit',env:process.env});
process.exit(test.status??1);
