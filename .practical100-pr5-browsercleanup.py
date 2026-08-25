from pathlib import Path

old_cleanup="async function cleanup(){if(!proc.killed)proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),sleep(1000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}"
new_cleanup="function cleanup(){try{proc.kill('SIGKILL');}catch{}try{proc.unref();}catch{}}"
old_ending="try{await main();}finally{await cleanup();}"
new_ending="let failure=null;try{await main();}catch(error){failure=error;console.error(error);}finally{cleanup();}process.exit(failure?1:0);"
for name in ['verify-browser.mjs','verify-browser-extra.mjs']:
    p=Path(name);s=p.read_text();assert old_cleanup in s;s=s.replace(old_cleanup,new_cleanup,1);assert old_ending in s;s=s.replace(old_ending,new_ending,1);p.write_text(s)
