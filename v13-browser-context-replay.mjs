import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const file='self-browser-e2e.mjs';
let source=fs.readFileSync(file,'utf8');

const helper=`const browserContextRecoveries=[];
const ensureApplicationContext=async(stageNumber)=>{
  const ready=await page.evaluate(()=>Boolean(window.__CLR_V13__&&typeof window.__CLR_V13__.getCurrent==='function')).catch(()=>false);
  if(ready)return false;
  const evidence={
    stageNumber,
    priorUrl:page.url(),
    priorTitle:await page.title().catch(()=>''),
    priorBodyPrefix:String(await page.locator('body').textContent().catch(()=>'' )).slice(0,240),
    recoveredAt:new Date().toISOString()
  };
  browserContextRecoveries.push(evidence);
  console.log(JSON.stringify({status:'RECOVERING_APPLICATION_CONTEXT',...evidence}));
  await page.goto(\`\${origin}/app-v13.html?resumeStage=\${stageNumber}&recovery=\${Date.now()}\`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(window.__CLR_V13__&&typeof window.__CLR_V13__.getCurrent==='function'));
  const current=await page.evaluate(()=>window.__CLR_V13__.getCurrent());
  if(!current)throw new Error(\`Application context recovered at Stage \${stageNumber}, but the selected project was not restored from browser storage.\`);
  const open=page.locator(\`[data-open="\${current.projectId}"]\`);
  if(await open.count())await open.first().click();
  await page.locator(\`[data-stage="\${stageNumber}"]\`).waitFor({state:'visible'});
  return true;
};
`;

if(!source.includes('const browserContextRecoveries=[];')){
  const anchor='try{\n  await page.goto';
  if(!source.includes(anchor))throw new Error('browser recovery helper insertion anchor missing');
  source=source.replace(anchor,helper+'\ntry{\n  await page.goto');
}

const oldLoop='  for(let n=1;n<=31;n++){\n    await page.locator(`[data-stage="${n}"]`).click();';
const newLoop='  for(let n=1;n<=31;n++){\n    await ensureApplicationContext(n);\n    await page.locator(`[data-stage="${n}"]`).click();';
if(!source.includes(newLoop)){
  if(!source.includes(oldLoop))throw new Error('browser recovery loop anchor missing');
  source=source.replace(oldLoop,newLoop);
}

const oldStage30='    }else if(n===30){\n      const project=await page.evaluate(()=>window.__CLR_V13__.getCurrent());';
const newStage30='    }else if(n===30){\n      if(await ensureApplicationContext(n))await page.locator(`[data-stage="${n}"]`).click();\n      const project=await page.evaluate(()=>window.__CLR_V13__.getCurrent());';
const fileHashStage30="    }else if(n===30){\n      const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'app-v13.html'))).digest('hex');";
if(!source.includes(newStage30)&&!source.includes(fileHashStage30)){
  if(!source.includes(oldStage30))throw new Error('Stage 30 is neither the legacy API-hash form nor the corrected exact-file-hash form');
  source=source.replace(oldStage30,newStage30);
}

const reportAnchor="    hardcodedProject:false,";
const reportReplacement="    hardcodedProject:false,\n    browserContextRecoveries,";
if(!source.includes('    browserContextRecoveries,')){
  if(!source.includes(reportAnchor))throw new Error('browser recovery report anchor missing');
  source=source.replace(reportAnchor,reportReplacement);
}

fs.writeFileSync(file,source);
const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
if(checked.status!==0)throw new Error(`${file} syntax failure: ${checked.stderr||checked.stdout}`);
console.log(JSON.stringify({status:'PATCHED_OR_ALREADY_CURRENT',file,recovery:'STORAGE_BACKED_UI_RELOAD',stage30:'API_OR_EXACT_FILE_HASH_SUPPORTED',reportField:'browserContextRecoveries'}));
