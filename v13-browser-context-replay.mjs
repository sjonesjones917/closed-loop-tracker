import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const file='self-browser-e2e.mjs';
let source=fs.readFileSync(file,'utf8');

const helperStart=source.indexOf('const browserContextRecoveries=[];');
if(helperStart>=0){
  const helperEndToken='try{\n  await page.goto';
  const helperEnd=source.indexOf(helperEndToken,helperStart);
  if(helperEnd<0)throw new Error('browser context helper end anchor missing');
  source=source.slice(0,helperStart)+source.slice(helperEnd);
}
source=source.replace('    await ensureApplicationContext(n);\n','');
source=source.replace('      if(await ensureApplicationContext(n))await page.locator(`[data-stage="${n}"]`).click();\n','');
source=source.replace('    browserContextRecoveries,\n','');

const internalProjectLine='  const project=await page.evaluate(()=>window.__CLR_V13__.getCurrent());';
const visibleExportBlock=`  await page.locator('[data-view="workflow"]').click();
  const projectDownloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const projectDownload=await projectDownloadPromise;
  const projectDownloadPath=await projectDownload.path();
  const projectExportBytes=fs.readFileSync(projectDownloadPath);
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),projectExportBytes);
  const project=JSON.parse(projectExportBytes.toString('utf8'));
  await page.locator('[data-view="release"]').click();`;
const assertedVisibleExportBlock=`  await page.locator('[data-view="workflow"]').click();
  const projectDownloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const projectDownload=await projectDownloadPromise;
  assert.equal(projectDownload.suggestedFilename(),'SELF_VERIFIED_PROJECT.json');
  const projectDownloadPath=await projectDownload.path();
  const projectExportBytes=fs.readFileSync(projectDownloadPath);
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),projectExportBytes);
  const project=JSON.parse(projectExportBytes.toString('utf8'));
  await page.locator('[data-view="release"]').click();`;
const priorVisibleExportBlock=`  await page.locator('[data-view="workflow"]').click();
  const projectDownloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const projectDownload=await projectDownloadPromise;
  const projectDownloadPath=await projectDownload.path();
  const projectExportBytes=fs.readFileSync(projectDownloadPath);
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),projectExportBytes);
  const project=JSON.parse(projectExportBytes.toString('utf8'));`;
const priorAssertedVisibleExportBlock=`  await page.locator('[data-view="workflow"]').click();
  const projectDownloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const projectDownload=await projectDownloadPromise;
  assert.equal(projectDownload.suggestedFilename(),'SELF_VERIFIED_PROJECT.json');
  const projectDownloadPath=await projectDownload.path();
  const projectExportBytes=fs.readFileSync(projectDownloadPath);
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),projectExportBytes);
  const project=JSON.parse(projectExportBytes.toString('utf8'));`;
if(source.includes(priorAssertedVisibleExportBlock))source=source.replace(priorAssertedVisibleExportBlock,assertedVisibleExportBlock);
else if(source.includes(priorVisibleExportBlock))source=source.replace(priorVisibleExportBlock,visibleExportBlock);
else if(!source.includes(visibleExportBlock)&&!source.includes(assertedVisibleExportBlock)){
  if(!source.includes(internalProjectLine))throw new Error('completed-project retrieval anchor missing');
  source=source.replace(internalProjectLine,visibleExportBlock);
}

const duplicateExportBlock=`  await page.locator('[data-view="workflow"]').click();
  const projectDownloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const projectDownload=await projectDownloadPromise;
  const projectDownloadPath=await projectDownload.path();
  const exportedBytes=fs.readFileSync(projectDownloadPath);
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),exportedBytes);
  const exported=JSON.parse(exportedBytes.toString('utf8'));`;
const assertedDuplicateExportBlock=`  await page.locator('[data-view="workflow"]').click();
  const projectDownloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const projectDownload=await projectDownloadPromise;
  assert.equal(projectDownload.suggestedFilename(),'SELF_VERIFIED_PROJECT.json');
  const projectDownloadPath=await projectDownload.path();
  const exportedBytes=fs.readFileSync(projectDownloadPath);
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),exportedBytes);
  const exported=JSON.parse(exportedBytes.toString('utf8'));`;
if(source.includes(duplicateExportBlock))source=source.replace(duplicateExportBlock,'  const exported=project;');
else if(source.includes(assertedDuplicateExportBlock))source=source.replace(assertedDuplicateExportBlock,'  const exported=project;');
else if(!source.includes('  const exported=project;'))throw new Error('duplicate visible-export block anchor missing');

const legacyFreshWait=`  await freshPage.goto(\`${origin}/app-v13.html?fresh=\${Date.now()}\`,{waitUntil:'networkidle'});
  await freshPage.locator('[data-open]').waitFor({state:'visible'});`;
const diagnosticFreshWait=`  await freshPage.goto(\`${origin}/app-v13.html?fresh=\${Date.now()}\`,{waitUntil:'networkidle'});
  await freshPage.waitForTimeout(3000);
  const freshAutoloadDiagnostics=await freshPage.evaluate(async()=>{
    const status=document.querySelector('#status')?.textContent||'';
    const projectsText=document.querySelector('#projects')?.textContent||'';
    const storage={};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);storage[key]=String(localStorage.getItem(key)||'').length}
    let sidecar;
    try{
      const response=await fetch(\`SELF_VERIFIED_PROJECT.json?diagnostic=\${Date.now()}\`,{cache:'no-store'});
      const text=await response.text();
      let parsed=null,parseError='';
      try{parsed=JSON.parse(text)}catch(error){parseError=String(error?.message||error)}
      sidecar={ok:response.ok,status:response.status,url:response.url,bytes:new TextEncoder().encode(text).length,projectId:parsed?.projectId||null,jobId:parsed?.jobId||null,stageCount:Array.isArray(parsed?.stages)?parsed.stages.length:null,parseError};
    }catch(error){sidecar={fetchError:String(error?.message||error)}}
    return{status,projectsText,openCount:document.querySelectorAll('[data-open]').length,storage,sidecar};
  });
  if(!freshAutoloadDiagnostics.openCount)throw new Error(\`Fresh published-sidecar autoload failed: \${JSON.stringify(freshAutoloadDiagnostics)}\`);`;
if(!source.includes(diagnosticFreshWait)){
  if(!source.includes(legacyFreshWait))throw new Error('fresh-sidecar wait anchor missing');
  source=source.replace(legacyFreshWait,diagnosticFreshWait);
}

if(source.includes('window.__CLR_V13__.getCurrent'))throw new Error('browser verification still depends on the internal project API');
if(!source.includes('const project=JSON.parse(projectExportBytes.toString'))throw new Error('visible project export retrieval missing');
if(!source.includes("await page.locator('[data-view=\"release\"]')"))throw new Error('release view restoration after project export missing');
if(!source.includes('freshAutoloadDiagnostics'))throw new Error('fresh-sidecar diagnostics missing');
if(!source.includes('const exported=project;'))throw new Error('single visible project export was not established');

fs.writeFileSync(file,source);
const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(checked.status!==0)throw new Error(`${file} syntax failure: ${checked.stderr||checked.stdout}`);
console.log(JSON.stringify({
  status:'PATCHED_OR_ALREADY_CURRENT',
  file,
  projectEvidenceSource:'VISIBLE_UI_EXPORT',
  internalProjectHookRequired:false,
  releaseViewRestoredAfterProjectExport:true,
  freshAutoloadDiagnostics:true,
  filenameAssertionOwner:'run-v13-self-e2e.mjs'
}));
