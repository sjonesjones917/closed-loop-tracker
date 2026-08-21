import fs from 'node:fs';

const replaceBetween=(text,start,end,replacement)=>{
  const a=text.indexOf(start),b=text.indexOf(end,a);
  if(a<0||b<0)throw new Error(`Patch anchor missing: ${start} / ${end}`);
  return text.slice(0,a)+replacement+text.slice(b);
};

function build(sidecarPath,output){
  let s=fs.readFileSync('app-v11.html','utf8');

  s=replaceBetween(s,'function prior(p,n){','function batchDigest(s){',`function prior(p,n){if(n===1)return'NONE';return p.stages.slice(0,n-1).map((s,i)=>{const batch=batchDigest(s);return \`===== STAGE \${i+1} — \${STAGES[i][0]} =====\\n\${s.response||'NO STAGE SUMMARY'}\${batch?\`\\n\\nBATCH RECORDS\\n\${batch}\`:''}\\n\\nEVIDENCE / NOTES\\n\${s.notes||'NONE'}\`}).join('\\n\\n')}
`);
  s=replaceBetween(s,'function runPrompt(p,n,i,role){','function requireText(t,label,min=100){',`function runPrompt(p,n,i,role,targetOverride=''){gate(p,n);const rid=\`RUN-\${String(i+1).padStart(3,'0')}\`,base=prompt(p,n);let target='';if(role==='verifier'){if(n===12)target=p.stages[10].producers[i]||'';else if(n===19)target=p.stages[17].producers[i]||'';else if(n===20)target=targetOverride||p.stages[19].producers[i]||'';if(!String(target).trim())throw Error(\`Verifier prompt for \${rid} is blocked until that run's actual producer output exists.\`)}return \`\${base}\\n\\n\${role==='producer'?'INDEPENDENT EXECUTION':'INDEPENDENT VERIFICATION'} RECORD \${rid}\\n\${role==='producer'?\`Execute \${rid} in a fresh context. Do not read or reuse any other run output. Return this run's complete actual output and evidence.\`:\`Verify \${rid} independently against every mandatory requirement and approved test. Do not trust the producing run's conclusion.\\n\\nTARGET RUN OUTPUT TO VERIFY:\\n\${target}\`}\`}
`);
  const oldRequire="function requireText(t,label,min=100){t=String(t||'').trim();if(t.length<min)throw Error(`${label} is required and must contain a substantive completed result (minimum ${min} characters).`);return t}";
  const newRequire="function requireText(t,label,min=100){const raw=String(t??''),checked=raw.trim();if(checked.length<min)throw Error(`${label} is required and must contain a substantive completed result (minimum ${min} characters).`);return raw}";
  if(!s.includes(oldRequire))throw new Error('requireText exact-byte preservation patch anchor missing');
  s=s.replace(oldRequire,newRequire);
  const oldHandler=`document.querySelectorAll('[data-rprompt]').forEach(b=>b.onclick=()=>{const [role,i]=b.dataset.rprompt.split(':');copyText(runPrompt(p,n,Number(i),role))});`;
  const newHandler=`document.querySelectorAll('[data-rprompt]').forEach(b=>b.onclick=()=>{const [role,i]=b.dataset.rprompt.split(':'),idx=Number(i),target=role==='verifier'&&n===20?(document.querySelector(\`[data-producer="\${idx}"]\`)?.value||''):'';try{copyText(runPrompt(p,n,idx,role,target))}catch(e){$('stageMsg').textContent=e.message;setStatus(e.message,true)}});`;
  if(!s.includes(oldHandler))throw new Error('Run-prompt click handler patch anchor missing');
  s=s.replace(oldHandler,newHandler);

  s=s.replaceAll('Closed-Loop Reliability v11','Closed-Loop Reliability v13')
    .replaceAll('Closed-Loop Agent Reliability v11','Closed-Loop Agent Reliability v13')
    .replaceAll('schemaVersion:11','schemaVersion:13')
    .replaceAll('schemaVersion!==11','schemaVersion!==13')
    .replaceAll('closedLoopReliability.projects.v11','closedLoopReliability.projects.v13')
    .replaceAll('closedLoopReliability.selected.v11','closedLoopReliability.selected.v13')
    .replaceAll('__CLR_V11__','__CLR_V13__')
    .replaceAll('valid v11 project export','valid v13 project export')
    .replaceAll('Load verified E2E export','Reload verified self-project export');

  const keyAnchor="const KEY='closedLoopReliability.projects.v13',SEL='closedLoopReliability.selected.v13';";
  if(!s.includes(keyAnchor))throw new Error('v13 key anchor missing');
  s=s.replace(keyAnchor,`const SELF_PROJECT_PATH=${JSON.stringify(sidecarPath)};${keyAnchor}`);

  s=replaceBetween(s,"$('loadVerifiedBtn').onclick=async()=>{","$('exportBtn').onclick=",`async function loadSelfProject(manual=false){try{const r=await fetch(SELF_PROJECT_PATH,{cache:'no-store'});if(!r.ok){if(manual)throw Error(\`Verified self-project export unavailable (\${r.status}).\`);return false}importProjectObject(await r.json());if(manual)show('workflow');return true}catch(e){if(manual)setStatus(e.message,true);return false}};$('loadVerifiedBtn').onclick=()=>loadSelfProject(true);`);

  const initAnchor='load();render();window.__CLR_V13__=';
  if(!s.includes(initAnchor))throw new Error('v13 initialization anchor missing');
  s=s.replace(initAnchor,'load();render();loadSelfProject(false);window.__CLR_V13__=');

  fs.writeFileSync(output,s);
  return {output,bytes:Buffer.byteLength(s),sidecarPath,autoLoadsSidecar:s.includes('loadSelfProject(false)'),containsNoEmbeddedCompletedProject:!s.includes('HARDCODED_COMPLETED_PROJECT')};
}

const candidate=build('SELF_VERIFIED_PROJEC.json','app-v13-candidate1.html');
const corrected=build('SELF_VERIFIED_PROJECT.json','app-v13.html');
console.log(JSON.stringify({status:'BUILT',candidate,corrected},null,2));
