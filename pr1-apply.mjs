import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const write=(path,text)=>fs.writeFileSync(path,text,'utf8');
const replaceOnce=(text,oldValue,newValue,label)=>{
  if(!text.includes(oldValue))throw new Error(`Missing ${label}`);
  return text.replace(oldValue,newValue);
};

// Static shell: apply the already-reviewed CSS repair and load each responsible
// module directly, exactly once, in dependency order with one shared build token.
{
  const path='index.html';
  let text=read(path);
  const marker='/* Mobile readability and touch-target floor */';
  if(!text.includes(marker)){
    const block=`
/* Mobile readability and touch-target floor */
:root{--touch-target:44px;--ui-small:11px;--ui-body:12px}
body{font-size:15px;line-height:1.5}
.brand-kicker,.project-select label,.progress-line strong,.fact span,.field .help,.stage-number,.stage-meta,.record-key,.project-field-group>summary span:last-child,.stage-action-strip{font-size:var(--ui-small)}
.brand h1{font-size:18px}
.brand p,.field label,.group-label,.check span,.record-card>summary,.stage-name,.record-value,.section-intro,.notice,.empty-state,.project-field-group>summary,.record-tools label{font-size:var(--ui-body)}
.project-select select{height:var(--touch-target);min-height:var(--touch-target);font-size:13px}
button:not(.workflow-button),.file-button{min-height:var(--touch-target);font-size:12px}
.header-actions button,.view-tabs button,.button-row button,.compact-button,.record-card button,.stage-card button{min-height:var(--touch-target);font-size:12px}
.view-tabs{top:125px}
.status{min-height:26px;font-size:11px}
.fact strong{font-size:16px}
h2.section-title{font-size:16px}
input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea,select{min-height:var(--touch-target)}
.stage-nav{grid-template-columns:44px minmax(0,1fr) 44px}
.stage-nav button{width:44px;height:44px}
.stage-nav select{height:44px;min-height:44px;font-size:12px}
.prompt,.code-text{font-size:12px}
.stage-jumpbar button{min-height:44px;max-height:44px;font-size:11px}
.workflow-list .stage-name{font-size:12px;line-height:1.25}
@media(max-width:620px){.workflow-list .stage-card{padding:6px}.workflow-list .stage-head>.status{font-size:11px;min-height:24px}.workflow-list .stage-head{row-gap:3px}}
`;
    text=replaceOnce(text,'</style>',`${block}\n</style>`,'style terminator');
  }
  const oldScripts='<script src="workbook.js?v=closed-loop-runtime-20260825-r2"></script>\n<script src="app.js?v=closed-loop-ingestion-20260825-r2"></script>';
  const build='20260825-pr1';
  const modules=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
  const direct=modules.map(name=>`<script defer src="${name}?v=${build}"></script>`).join('\n');
  if(text.includes(oldScripts))text=text.replace(oldScripts,direct);
  if(!text.includes(direct))throw new Error('Direct module loading was not installed.');
  if(!text.includes('http-equiv="Content-Security-Policy"')){
    const anchor='<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n';
    const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'unsafe-inline\'; img-src \'self\' data:; connect-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'self\'">\n';
    text=replaceOnce(text,anchor,anchor+csp,'cache-control meta');
  }
  write(path,text);
}

// Permanent responsive assertions from PR 62 plus deterministic explicit
// Page.navigate, which avoids browser URL parser variability in CI.
{
  const path='verify-browser.mjs';
  let text=read(path);
  text=text.replace('<=64','<=72').replace('>=32','>=44');
  const oldTarget="const target=await getJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?browser=${Date.now()}`)}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');";
  const newTarget="const target=await getJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');await cdp.send('Page.navigate',{url:`${PAGE_URL}?browser=${Date.now()}`});";
  if(text.includes(oldTarget))text=text.replace(oldTarget,newTarget);
  if(!text.includes('minimumUiTextPx')){
    const selector='.brand-kicker,.project-select label,.progress-line strong,.header-actions button,.view-tabs button,.status,.fact span,.field label,.field .help,.button-row button,.stage-number,.stage-name,.stage-meta,.record-card>summary,.record-key,.record-value,.prompt,.empty-state,.stage-action-strip,.project-field-group>summary,.record-tools label';
    text=replaceOnce(text,"const assert=(x,m)=>{if(!x)throw new Error(m);};",`const assert=(x,m)=>{if(!x)throw new Error(m);};\nconst minimumUiTextSelector=${JSON.stringify(selector)};`,'browser assertion helper');
    const oldAssertion="assert(Math.min(...s.buttons.filter(b=>b.h>0).map(b=>b.h),40)>=44,`Unusably small button detected at ${width}px.`);}";
    const newAssertion="assert(Math.min(...s.buttons.filter(b=>b.h>0).map(b=>b.h),44)>=44,`Touch target below 44px detected at ${width}px.`);const tinyText=await evalValue(cdp,`[...document.querySelectorAll(${JSON.stringify(minimumUiTextSelector)})].filter(e=>e.getClientRects().length&&parseFloat(getComputedStyle(e).fontSize)<11).map(e=>({text:e.textContent.trim().slice(0,80),size:getComputedStyle(e).fontSize,className:e.className}))`);assert(tinyText.length===0,`UI text below 11px at ${width}px: ${JSON.stringify(tinyText)}`);}";
    text=replaceOnce(text,oldAssertion,newAssertion,'browser size assertion');
    text=replaceOnce(text,'buttonSizing:true,','buttonSizing:true,touchTargetFloor:44,minimumUiTextPx:11,','browser result metadata');
  }
  write(path,text);
}
{
  const path='verify-browser-extra.mjs';
  let text=read(path).replace('<=64','<=72').replace('>=32','>=44');
  const oldTarget="const target=await getJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${PAGE_URL}?browserExtra=${Date.now()}`)}`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');";
  const newTarget="const target=await getJson(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}),cdp=new CDP(target.webSocketDebuggerUrl);await cdp.ready;await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');await cdp.send('Page.navigate',{url:`${PAGE_URL}?browserExtra=${Date.now()}`});";
  if(text.includes(oldTarget))text=text.replace(oldTarget,newTarget);
  write(path,text);
}

// Structural source verification now proves direct loading and the absence of
// the deleted dynamic loader/repair scaffolding.
{
  const path='verify.mjs';
  let text=read(path);
  text=text.replace("const files=['index.html','app.js','app-core.js'","const files=['index.html','app-core.js'");
  const anchor="for(const file of files)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);\n";
  const replacement=`for(const file of files)if(!fs.existsSync(file))throw new Error(\`Missing \${file}\`);
if(fs.existsSync('app.js'))throw new Error('app.js dynamic loader must not exist.');
const repairScaffolding=fs.readdirSync('.').filter(name=>name.startsWith('.repair-'));
if(repairScaffolding.length)throw new Error(\`Repair scaffolding remains: \${repairScaffolding.join(', ')}\`);
const html=fs.readFileSync('index.html','utf8');
if(/document\\.write\\s*\\(/.test(html))throw new Error('document.write runtime injection remains.');
const expectedScripts=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const scripts=[...html.matchAll(/<script\\s+defer\\s+src="([^"]+)"\\s*><\\/script>/g)].map(match=>match[1]);
if(scripts.length!==expectedScripts.length)throw new Error(\`Expected \${expectedScripts.length} direct deferred scripts; found \${scripts.length}.\`);
const names=scripts.map(value=>value.split('?')[0]);
if(names.join('|')!==expectedScripts.join('|'))throw new Error(\`Runtime script order mismatch: \${names.join(', ')}\`);
if(new Set(names).size!==names.length)throw new Error('A runtime script is loaded more than once.');
const tokens=scripts.map(value=>new URLSearchParams(value.split('?')[1]||'').get('v'));
if(tokens.some(value=>!value)||new Set(tokens).size!==1)throw new Error('All runtime scripts must use one nonempty build token.');
`;
  text=replaceOnce(text,anchor,replacement,'verify.mjs file existence anchor');
  write(path,text);
}
{
  const path='build-test-project.mjs';
  let text=read(path);
  text=text.replace("const required=['index.html','app.js','app-core.js'","const required=['index.html','app-core.js'");
  text=text.replace("const html=fs.readFileSync('index.html','utf8'),loader=fs.readFileSync('app.js','utf8'),app=","const html=fs.readFileSync('index.html','utf8'),loader='',app=");
  const oldChecks="for(const token of ['workbook.js','app.js'])if(!html.includes(token))throw new Error(`Application shell is missing ${token}.`);\nfor(const token of ['hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'])if(!loader.includes(token))throw new Error(`Application loader is missing ${token}.`);";
  const newChecks=`const runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const scripts=[...html.matchAll(/<script\\s+defer\\s+src="([^"]+)"\\s*><\\/script>/g)].map(match=>match[1]);
if(scripts.length!==runtime.length||scripts.map(value=>value.split('?')[0]).join('|')!==runtime.join('|'))throw new Error('Application shell direct runtime order is wrong.');
if(new Set(scripts.map(value=>value.split('?')[0])).size!==runtime.length)throw new Error('Application shell loads a runtime module more than once.');
const tokens=scripts.map(value=>new URLSearchParams(value.split('?')[1]||'').get('v'));if(tokens.some(value=>!value)||new Set(tokens).size!==1)throw new Error('Application shell runtime build token is not shared.');
if(fs.existsSync('app.js')||/document\\.write\\s*\\(/.test(html))throw new Error('Dynamic runtime loader remains.');`;
  text=replaceOnce(text,oldChecks,newChecks,'build shell checks');
  write(path,text);
}
{
  const path='verify-live.mjs';
  let text=read(path);
  text=text.replace("const deployed=['index.html','app.js','app-core.js'","const deployed=['index.html','app-core.js'");
  const anchor='for(const file of deployed){';
  const insertion="{const r=await fetch(new URL(`app.js?live=${Date.now()}-${Math.random()}`,base),{cache:'no-store'});if(r.status!==404)throw new Error(`Deleted app.js must return 404; received ${r.status}.`);}\nfor(const file of deployed){";
  text=replaceOnce(text,anchor,insertion,'live file loop');
  write(path,text);
}

// Accurate architecture documentation for this PR's actual state.
write('README.md',`# Closed-Loop Reliability

Live application: https://sjonesjones917.github.io/closed-loop-tracker/

This repository contains one static, phone-first vanilla-JavaScript application and one HTML entry point: \`index.html\`. The workflow contains exactly 30 stages and no Stage 31.

## Responsibility boundaries

| Responsibility | Owner |
| --- | --- |
| Workflow stages, names, roles, declared completion conditions | \`workbook.js\` |
| Field ownership, types, enums, relationships, stage contracts | \`workflow-schema.js\` |
| Canonical serialization and SHA-256 | \`hash.js\` |
| Prompt content, context selection, prompt identity | \`prompt-engine.js\` |
| Parsing, validation, proposal planning, response disposition | \`response-ingestion.js\` |
| Derived values, current-scope selection, gates, invalidation, release logic | \`workflow-engine.js\` |
| Projects, revisions, artifact bytes, migration, import/export | \`project-store.js\` |
| Rendering and operator actions | \`app-core.js\` |
| Static shell, CSS, ordered module loading | \`index.html\` |
| Source, lifecycle, browser, deployment, and live verification | \`.github/workflows/pages.yml\` |

\`index.html\` loads each responsible module directly, once, in dependency order, with one shared cache-build token. There is no dynamic script loader, runtime wrapper guard, MutationObserver repair, monkey patch, alternate store, alternate parser, alternate workflow engine, or second application shell.

## Current contracts

- Project schema: \`human-project/30\` pending the deterministic \`closed-loop-project/2\` migration.
- Workflow identity: represented by the exact 30-stage workbook pending separation into \`mobile-closed-loop/30\`.
- Response schema: \`closed-loop-stage-response/1\` pending the version-2 scope and prompt-contract binding.
- Persistence: one browser-local project-store adapter using Web Storage at this revision; IndexedDB and actual artifact-Blob persistence are the next responsible-layer migration.
- Backend: none. This is a single-device browser-local application and does not claim multi-device synchronization.

## Retained project

\`TEST_PROJECT.json\` is the retained project \`JOB-20260823144121\`, titled \`Mobile Closed-Loop Agent Reliability Workbook\`. Stage 01 is preserved as completed history, Stage 02 is current/next, and Stages 02–30 contain no fabricated downstream project data.

## Verification

Run \`node build-test-project.mjs\`, all \`node --check\` commands listed by \`.github/workflows/pages.yml\`, then \`node verify.mjs\`, \`node verify-ingestion.mjs\`, and \`node verify-complete.mjs\`. Browser verification uses \`verify-browser.mjs\` and \`verify-browser-extra.mjs\` against the served application at 320, 393, and desktop widths.

The Pages workflow runs source checks before deployment, deploys only \`main\`, verifies exact deployed source identity, and executes the deployed browser tests.

## Migration and backup policy

Schema migrations must preserve unknown extension fields, raw responses, receipts, historical records, project identity, and all 30 stages. A failed migration must leave the prior project available and preserve the original payload for audit/recovery. Browser-local persistence is not a substitute for an exported backup; device loss or user-deleted browser data cannot be prevented by this static application.
`);

// Remove one-time scaffolding after integrating the verified behavior.
for(const path of ['app.js','.repair-engine-a.mjs','.repair-engine-b.mjs','.repair-schema.mjs','.github/workflows/repair-readability.yml']){
  if(fs.existsSync(path))fs.rmSync(path,{force:true});
}

// Strengthen the single deployment workflow when present.
if(fs.existsSync('.github/workflows/pages.yml')){
  const path='.github/workflows/pages.yml';
  let text=read(path).replace('          node --check app.js\n','');
  const anchor='          test ! -f usability.js\n';
  const extra=`          test ! -f usability.js
          test ! -f app.js
          test ! -f .github/workflows/repair-readability.yml
          test "$(find . -maxdepth 1 -type f -name '.repair-*' | wc -l)" -eq 0
          ! grep -R "document.write" --include='*.js' --include='*.html' .
`;
  text=replaceOnce(text,anchor,extra,'Pages structural assertions');
  write(path,text);
}
