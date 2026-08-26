from pathlib import Path

def rep(path, old, new, count=1):
    p=Path(path);s=p.read_text()
    if s.count(old)!=count: raise SystemExit(f'{path}: expected {count}, found {s.count(old)} for {old[:90]!r}')
    p.write_text(s.replace(old,new,count))

# Production must not auto-inject repository test data. Tests opt in explicitly.
p=Path('app-core.js');s=p.read_text()
old="current=projects[0];if(needsPersist){const selectedId=current.job.JOB_ID;projects=await projectStore.writeAll(projects);current=projects.find(p=>p.job?.JOB_ID===selectedId)||projects[0];}"
if old not in s: raise SystemExit('app-core load tail marker missing')
start="let needsPersist=false;try{const res=await fetch(`TEST_PROJECT.json?retained=${Date.now()}`,{cache:'no-store'});"
end="}catch(error){console.error('Bundled retained project could not load',error);}if(!projects.length)"
if s.count(start)!=1 or s.count(end)!=1: raise SystemExit('app-core retained seed block changed')
s=s.replace(start,"let needsPersist=false;const testProjectMode=new URLSearchParams(location.search).get('testProject')==='1';if(testProjectMode){try{const res=await fetch(`TEST_PROJECT.json?retained=${Date.now()}`,{cache:'no-store'});",1)
s=s.replace(end,"}catch(error){console.error('Bundled test project could not load',error);}}if(!projects.length)",1)
p.write_text(s)

# Browser tests explicitly opt into migration-fixture mode; ordinary production URL remains clean.
p=Path('verify-browser.mjs');s=p.read_text();s=s.replace("`${PAGE_URL}?browser=${Date.now()}`","`${PAGE_URL}?testProject=1&browser=${Date.now()}`",1);p.write_text(s)
p=Path('verify-browser-extra.mjs');s=p.read_text();
for old,new in [("`${PAGE_URL}?browserExtra=${Date.now()}`","`${PAGE_URL}?testProject=1&browserExtra=${Date.now()}`"),("`${PAGE_URL}?browserExtraTab2=${Date.now()}`","`${PAGE_URL}?testProject=1&browserExtraTab2=${Date.now()}`")]:
    if old in s:s=s.replace(old,new,1)
marker="  console.log('extra:prompt-copy');"
if marker not in s: raise SystemExit('verify-browser-extra clean-state marker missing')
insert="""  console.log('extra:clean-production-state');
  const cleanBase=PAGE_URL.replace('127.0.0.1','localhost');
  const cleanTarget=await getJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${cleanBase}?cleanProduction=${Date.now()}`)}`,{method:'PUT'}),cleanCdp=new CDP(cleanTarget.webSocketDebuggerUrl);await cleanCdp.ready;await cleanCdp.send('Runtime.enable');await cleanCdp.send('Page.enable');await waitExpr(cleanCdp,`globalThis.closedLoopAppReady===true`,20000);const cleanProjects=await projects(cleanCdp);assert(!cleanProjects.some(p=>p.job?.JOB_ID==='JOB-20260823144121'),'Production startup injected the retained repository test project.');assert(cleanProjects.length===1&&cleanProjects[0].job?.CURRENT_STAGE==='STAGE 01','Clean production startup did not create exactly one blank Stage 01 project.');cleanCdp.close();

"""
s=s.replace(marker,insert+marker,1);p.write_text(s)

p=Path('README.md');s=p.read_text();s=s.replace("It implements exactly 30 closed-loop reliability stages and retains `JOB-20260823144121` as the authorized Stage 01-complete, Stage 02-next project.","It implements exactly 30 closed-loop reliability stages. Normal production startup never injects repository test data; the retained legacy project is available only to explicit automated migration/acceptance tests.")
p.write_text(s)

p=Path('verify.mjs');s=p.read_text();marker="const retained=JSON.parse(fs.readFileSync('TEST_PROJECT.json','utf8'));"
if marker not in s: raise SystemExit('verify retained marker missing')
s=s.replace(marker,"if(!fs.readFileSync('app-core.js','utf8').includes(\"new URLSearchParams(location.search).get('testProject')==='1'\"))throw new Error('Repository test project is not isolated behind explicit test mode.');\n"+marker,1);p.write_text(s)
