from pathlib import Path

old="async function cleanup(){if(!proc.killed)proc.kill('SIGTERM');await Promise.race([new Promise(r=>proc.once('exit',r)),sleep(1000)]);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}"
new="async function cleanup(){try{proc.kill('SIGKILL');}catch{}try{proc.unref();}catch{}await sleep(100);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{}}"
for name in ['verify-browser.mjs','verify-browser-extra.mjs']:
    p=Path(name);s=p.read_text();assert old in s;s=s.replace(old,new,1);p.write_text(s)
