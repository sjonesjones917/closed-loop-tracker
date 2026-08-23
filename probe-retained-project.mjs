import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const candidates=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
const executablePath=candidates.find(p=>fs.existsSync(p));
if(!executablePath)throw new Error('No Chromium executable found.');
const port=4174;const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
await new Promise(r=>setTimeout(r,700));
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:393,height:852}});const logs=[];
page.on('pageerror',e=>logs.push('PAGEERROR '+String(e)));page.on('console',m=>logs.push('CONSOLE '+m.type()+' '+m.text()));
try{
 await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
 await page.waitForTimeout(1500);
 const text=await page.locator('#projectsView').innerText().catch(()=>'<NO PROJECTS VIEW>');
 const inputs=await page.locator('input[type=file]').evaluateAll(els=>els.map(e=>({id:e.id,name:e.name,accept:e.accept,aria:e.getAttribute('aria-label')}))).catch(()=>[]);
 console.log(JSON.stringify({projectsView:text,fileInputs:inputs,logs},null,2));
}finally{await browser.close();server.kill('SIGTERM');}
