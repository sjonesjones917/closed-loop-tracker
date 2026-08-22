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
  const initialProjectDownloadPromise=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const initialProjectDownload=await initialProjectDownloadPromise;
  assert.equal(initialProjectDownload.suggestedFilename(),'SELF_VERIFIED_PROJECT.json');
  const initialProjectDownloadPath=await initialProjectDownload.path();
  const projectExportBytes=fs.readFileSync(initialProjectDownloadPath);
  fs.writeFileSync(path.join(root,'SELF_VERIFIED_PROJECT.json'),projectExportBytes);
  const project=JSON.parse(projectExportBytes.toString('utf8'));`;
if(!source.includes(visibleExportBlock)){
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
if(source.includes(duplicateExportBlock))source=source.replace(duplicateExportBlock,'  const exported=project;');
else if(!source.includes('  const exported=project;'))throw new Error('duplicate visible-export block anchor missing');

if(source.includes('window.__CLR_V13__.getCurrent'))throw new Error('browser verification still depends on the internal project API');
if(!source.includes("initialProjectDownload.suggestedFilename(),'SELF_VERIFIED_PROJECT.json'"))throw new Error('visible export filename verification missing');
if(!source.includes('const exported=project;'))throw new Error('single visible project export was not established');

fs.writeFileSync(file,source);
const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(checked.status!==0)throw new Error(`${file} syntax failure: ${checked.stderr||checked.stdout}`);
console.log(JSON.stringify({
  status:'PATCHED_OR_ALREADY_CURRENT',
  file,
  projectEvidenceSource:'VISIBLE_UI_EXPORT',
  internalProjectHookRequired:false,
  exactExportFilename:'SELF_VERIFIED_PROJECT.json'
}));
