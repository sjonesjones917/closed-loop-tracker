import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const replaceExact=(text,oldValue,newValue,label)=>{
  if(!text.includes(oldValue))throw new Error(`${label} patch anchor missing`);
  return text.replace(oldValue,newValue);
};

const build=spawnSync(process.execPath,['build-v13-self.mjs'],{encoding:'utf8',stdio:'inherit'});
if(build.status!==0)process.exit(build.status??1);

for(const file of ['app-v13-candidate1.html','app-v13.html']){
  if(!fs.existsSync(file)||fs.statSync(file).size===0)throw new Error(`${file} was not generated.`);
  const text=fs.readFileSync(file,'utf8');
  for(const token of [
    'function researchPrompt(p,n)',
    'if(n===2||n===3)return researchPrompt(p,n)',
    'RAW STAGE 1 RESPONSE AND SUPPLIED IMPLEMENTATION FILE LIST OMITTED BY DESIGN.',
    'RESEARCH AUTHORITY BOUNDARY — EXTERNAL SOURCES ONLY',
    'Stage 2 research sources must be independent external sources',
    '===== STAGE 2 — EXTERNAL SOURCE INVENTORY ====='
  ]) if(!text.includes(token))throw new Error(`${file} missing required research-boundary token: ${token}`);
  if(text.includes('Inspect the actual supplied sources and build the complete source inventory now.')){
    throw new Error(`${file} still contains the obsolete circular Stage 2 instruction.`);
  }
}

const corrected=fs.readFileSync('app-v13.html','utf8');
if(!corrected.includes("a.download=p.name==='REAL SELF-BUILD — CLOSED-LOOP RELIABILITY V13'?'SELF_VERIFIED_PROJECT.json':`${p.jobId}.json`")){
  throw new Error('The existing v13 app does not permanently use SELF_VERIFIED_PROJECT.json for its visible self-project export.');
}

// Keep the first browser genuinely empty. The invalid object cannot import as a project
// and is replaced only by the visible Export this project download after 31/31 completes.
fs.writeFileSync('SELF_VERIFIED_PROJECT.json','{}\n');
fs.writeFileSync('favicon.ico','');

let agent=fs.readFileSync('self-e2e-agent.mjs','utf8');
const oldPrompt="const prompt=Buffer.from(promptB64,'base64').toString('utf8');";
const newPrompt="const prompt=promptB64?Buffer.from(promptB64,'base64').toString('utf8'):fs.readFileSync(0,'utf8');";
agent=replaceExact(agent,oldPrompt,newPrompt,'Agent stdin');
fs.writeFileSync('self-e2e-agent-runtime.mjs',agent);

let browser=fs.readFileSync('self-browser-e2e.mjs','utf8');
const oldCall="const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent.mjs'),String(n),role,String(run),Buffer.from(prompt).toString('base64')],{encoding:'utf8',maxBuffer:8*1024*1024});";
const newCall="const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent-runtime.mjs'),String(n),role,String(run)],{encoding:'utf8',input:prompt,maxBuffer:8*1024*1024});";
browser=replaceExact(browser,oldCall,newCall,'Browser agent stdin call');

const oldStandard=`      const pr=await copyMain();
      assert.match(pr,new RegExp(\`STAGE \${n} OF 31\`));
      await page.locator('#response').fill(agent(n,'stage',pr));`;
const newStandard=`      const pr=await copyMain();
      assert.match(pr,new RegExp(\`STAGE \${n} OF 31\`));
      if(n===2){
        assert.match(pr,/RESEARCH AUTHORITY BOUNDARY — EXTERNAL SOURCES ONLY/);
        assert.match(pr,/RAW STAGE 1 RESPONSE AND SUPPLIED IMPLEMENTATION FILE LIST OMITTED BY DESIGN/);
        assert.doesNotMatch(pr,/Actual inputs:|app-v11\\.html|build-v13-self\\.mjs|self-browser-e2e\\.mjs|self-e2e-agent\\.mjs|app-v13-candidate1\\.html/i);
      }
      if(n===3){
        assert.match(pr,/APPROVED STAGE 2 EXTERNAL SOURCE INVENTORY:/);
        assert.doesNotMatch(pr,/Actual inputs:|app-v11\\.html|build-v13-self\\.mjs|self-browser-e2e\\.mjs|self-e2e-agent\\.mjs|app-v13-candidate1\\.html/i);
      }
      await page.locator('#response').fill(agent(n,'stage',pr));`;
browser=replaceExact(browser,oldStandard,newStandard,'Runtime Stage 2/3 prompt isolation assertion');

const oldDownload=`  const projectDownload=await projectDownloadPromise;
  const projectDownloadPath=await projectDownload.path();`;
const newDownload=`  const projectDownload=await projectDownloadPromise;
  assert.equal(projectDownload.suggestedFilename(),'SELF_VERIFIED_PROJECT.json');
  const projectDownloadPath=await projectDownload.path();`;
browser=replaceExact(browser,oldDownload,newDownload,'Visible project export filename assertion');

const transientStatus="assert.match(await freshPage.locator('#status').textContent(),/1 project/);";
const visibleState="assert.match(await freshPage.locator('#status').textContent(),/Imported|1 project/);";
browser=replaceExact(browser,transientStatus,visibleState,'Fresh-sidecar status assertion');
fs.writeFileSync('self-browser-e2e-runtime.mjs',browser);

for(const file of ['self-e2e-agent-runtime.mjs','self-browser-e2e-runtime.mjs']){
  const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(syntax.status!==0){process.stderr.write(syntax.stderr||syntax.stdout||'');process.exit(syntax.status??1)}
}

const test=spawnSync(process.execPath,['self-browser-e2e-runtime.mjs'],{encoding:'utf8',stdio:'inherit',env:process.env});
process.exit(test.status??1);
