import fs from 'node:fs';
for (const file of ['verify-browser.mjs','verify-browser-extra.mjs']) {
  let s=fs.readFileSync(file,'utf8');
  s=s.replace(/const port=\d+\+Math\.floor\(Math\.random\(\)\*\d+\),profile=fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\),'[^']+'\)\);\nconst proc=spawn\(browser,\['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check',`--remote-debugging-port=\$\{port\}`,`--user-data-dir=\$\{profile\}`,'about:blank'\],\{stdio:'ignore'\}\);/,
`const profile=fs.mkdtempSync(path.join(os.tmpdir(),'closed-loop-browser-'));
const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',\`--user-data-dir=\${profile}\`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let browserStderr='';proc.stderr.on('data',chunk=>{browserStderr+=chunk.toString();if(browserStderr.length>20000)browserStderr=browserStderr.slice(-20000);});
async function debuggingPort(){const active=path.join(profile,'DevToolsActivePort');return poll(()=>{if(proc.exitCode!==null)throw new Error(\`Chrome exited before DevTools became ready (code \${proc.exitCode}): \${browserStderr.trim()}\`);if(!fs.existsSync(active))throw new Error('Waiting for Chrome DevToolsActivePort.');const [value]=fs.readFileSync(active,'utf8').trim().split(/\\r?\\n/);const port=Number(value);if(!Number.isInteger(port)||port<=0)throw new Error('Chrome DevToolsActivePort is invalid.');return port;},20000);}`);
  s=s.replace(/async function main\(\)\{\n\s*await poll\(\(\)=>getJson\(`http:\/\/127\.0\.0\.1:\$\{port\}\/json\/version`\),20000\);/,
`async function main(){
 const port=await debuggingPort();
 await poll(()=>getJson(\`http://127.0.0.1:\${port}/json/version\`),5000);`);
  if(!s.includes("--remote-debugging-port=0")||s.includes('Math.floor(Math.random()'))throw new Error(`Failed to patch ${file}`);
  fs.writeFileSync(file,s);
}
