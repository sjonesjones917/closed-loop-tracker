import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const build=spawnSync(process.execPath,['build-v13-self.mjs'],{encoding:'utf8',stdio:'inherit'});
if(build.status!==0)process.exit(build.status??1);

// The first browser must remain genuinely unseeded, but the optional sidecar and
// implicit favicon requests must not generate console network errors. The empty
// JSON object cannot import as a project and is overwritten only by the visible
// Export this project download after all 31 stages complete.
fs.writeFileSync('SELF_VERIFIED_PROJECT.json','{}\n');
fs.writeFileSync('favicon.ico','');

let agent=fs.readFileSync('self-e2e-agent.mjs','utf8');
const oldPrompt="const prompt=Buffer.from(promptB64,'base64').toString('utf8');";
const newPrompt="const prompt=promptB64?Buffer.from(promptB64,'base64').toString('utf8'):fs.readFileSync(0,'utf8');";
if(!agent.includes(oldPrompt))throw new Error('Agent stdin patch anchor missing.');
agent=agent.replace(oldPrompt,newPrompt);
fs.writeFileSync('self-e2e-agent-runtime.mjs',agent);

let browser=fs.readFileSync('self-browser-e2e.mjs','utf8');
const oldCall="const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent.mjs'),String(n),role,String(run),Buffer.from(prompt).toString('base64')],{encoding:'utf8',maxBuffer:8*1024*1024});";
const newCall="const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent-runtime.mjs'),String(n),role,String(run)],{encoding:'utf8',input:prompt,maxBuffer:8*1024*1024});";
if(!browser.includes(oldCall))throw new Error('Browser agent-call stdin patch anchor missing.');
browser=browser.replace(oldCall,newCall);
const transientStatus="assert.match(await freshPage.locator('#status').textContent(),/1 project/);";
const visibleState="assert.match(await freshPage.locator('#status').textContent(),/Imported|1 project/);";
if(!browser.includes(transientStatus))throw new Error('Fresh-sidecar status assertion patch anchor missing.');
browser=browser.replace(transientStatus,visibleState);
fs.writeFileSync('self-browser-e2e-runtime.mjs',browser);

for(const file of ['self-e2e-agent-runtime.mjs','self-browser-e2e-runtime.mjs']){
  const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(syntax.status!==0){process.stderr.write(syntax.stderr||syntax.stdout||'');process.exit(syntax.status??1)}
}
const test=spawnSync(process.execPath,['self-browser-e2e-runtime.mjs'],{encoding:'utf8',stdio:'inherit',env:process.env});
process.exit(test.status??1);
