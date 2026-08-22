import fs from 'node:fs';

const replaceBetween=(text,start,end,replacement)=>{
  const a=text.indexOf(start),b=text.indexOf(end,a);
  if(a<0||b<0)throw new Error(`Patch anchor missing: ${start} / ${end}`);
  return text.slice(0,a)+replacement+text.slice(b);
};

function build(sidecarPath,output){
  let s=fs.readFileSync('app-v11.html','utf8');

  s=replaceBetween(s,'function prior(p,n){','function batchDigest(s){',`function prior(p,n){if(n===1)return'NONE';return p.stages.slice(0,n-1).map((s,i)=>{const batch=batchDigest(s);return \`===== STAGE \${i+1} — \${STAGES[i][0]} =====\\n\${s.response||'NO STAGE SUMMARY'}\${batch?\`\\n\\nBATCH RECORDS\\n\${batch}\`:''}\\n\\nEVIDENCE / NOTES\\n\${s.notes||'NONE'}\`}).join('\\n\\n')}\n`);
  s=replaceBetween(s,'function runPrompt(p,n,i,role){','function requireText(t,label,min=100){',`function runPrompt(p,n,i,role,targetOverride=''){gate(p,n);const rid=\`RUN-\${String(i+1).padStart(3,'0')}\`,base=prompt(p,n);let target='';if(role==='verifier'){if(n===12)target=p.stages[10].producers[i]||'';else if(n===19)target=p.stages[17].producers[i]||'';else if(n===20)target=targetOverride||p.stages[19].producers[i]||'';if(!String(target).trim())throw Error(\`Verifier prompt for \${rid} is blocked until that run's actual producer output exists.\`)}return \`\${base}\\n\\n\${role==='producer'?'INDEPENDENT EXECUTION':'INDEPENDENT VERIFICATION'} RECORD \${rid}\\n\${role==='producer'?\`Execute \${rid} in a fresh context. Do not read or reuse any other run output. Return this run's complete actual output and evidence.\`:\`Verify \${rid} independently against every mandatory requirement and approved test. Do not trust the producing run's conclusion.\\n\\nTARGET RUN OUTPUT TO VERIFY:\\n\${target}\`}\`}\n`);
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

  const oldStage1="['DEFINE JOB','Read the original request and supplied inputs. Create the authoritative JOB RECORD and INPUT-v001 now. Preserve the exact objective and requested deliverable; inventory inputs, constraints, format, deadline, sources, tools, prohibited actions, explicit requirements, assumptions, and unknowns. Do not research or draft the final deliverable.'],";
  const newStage1="['DEFINE JOB','Define the real job now from USER INPUT only. Read the complete user request. Preserve the exact user objective and exact requested deliverable. Extract every explicit user requirement and prohibition, required output form, applicable domain or domains, known user-supplied facts, assumptions, unknowns, blockers, and the external research questions that must be answered later. Stage 1 is not research. Do not inspect generated implementation artifacts, candidate application files, project JSON, generated tests, or prior workflow work products to decide what the requested result should contain. Do not invent missing facts. Return the completed job definition.'],";
  const oldStage2="['INVENTORY SOURCES','Inspect the actual supplied sources and build the complete source inventory now. Record SOURCE_ID, description, type, origin, version/date, authority, SOURCE_ROLE, relevant portions, conflicts, and blockers. Use current authoritative research only when the job requires it.'],";
  const newStage2="['INVENTORY SOURCES','Build the EXTERNAL SOURCE inventory for this job now. Search the internet and other external authoritative information sources outside this project. Find and actually examine the official websites, government sources, statutes, regulations, case law, standards, specifications, official platform and API documentation, manufacturer documentation, books, libraries, academic literature, professional references, public databases, policies, and other independent authorities appropriate to the domain. Start from the Stage 1 job definition and determine what external authority controls correctness, what official specifications and standards govern it, what laws or regulations apply, what technical documentation governs it, what established engineering or professional references govern it, what current external facts affect it, and what independent literature is needed. Prefer primary sources, current official documentation, and controlling authority. Do NOT use application source code, HTML, JavaScript, tests, generated prompts, generated project JSON, candidate files, prior workflow outputs, project records, or any other work product of this job as research authority. The requested product may not exist yet; do not inspect it to determine what requirements it should satisfy. For every source actually found and examined record SOURCE_ID, exact title, source type, author or issuing organization, publisher, URL or external location, publication date, effective date when applicable, access date, version, authority level, relevance, relevant portion, primary/secondary status, possible conflicts, and whether additional research is required. Stage 2 completes only when every Stage 1 research area has at least one appropriate external source or an explicit blocker and remaining research needs are identifiable. Return the external source inventory only; do not perform Stage 3 requirement extraction.'],";
  const oldStage3="['RESEARCH REQUIREMENTS','Read the controlling sources and extract every obligation, restriction, exception, dependency, applicability condition, format condition, numerical condition, and explicit user requirement now. Cite exact evidence and repeat until no new material category is found.'],";
  const newStage3="['RESEARCH REQUIREMENTS','Research the requirements governing this job from the Stage 2 EXTERNAL SOURCE inventory and additional external authoritative sources discovered as necessary. Do not derive requirements from application files, generated code, tests, project JSON, candidate implementations, generated prompts, prior workflow outputs, or other work products. The product may not exist yet. For every finding identify the external source and exact relevant portion, state what it requires or establishes, explain why it applies, distinguish mandatory requirements from recommendations, distinguish direct requirements from derived engineering implications, identify exceptions, conflicts, and applicability conditions, and preserve enough provenance for independent verification. Continue until every external research question from Stage 1 is answered or explicitly BLOCKED. Return research findings only; do not compile the Stage 4 requirement registry yet.'],";
  if(!s.includes(oldStage1)||!s.includes(oldStage2)||!s.includes(oldStage3))throw new Error('Stage 1-3 prompt patch anchors missing');
  s=s.replace(oldStage1,newStage1).replace(oldStage2,newStage2).replace(oldStage3,newStage3);

  const keyAnchor="const KEY='closedLoopReliability.projects.v13',SEL='closedLoopReliability.selected.v13';";
  if(!s.includes(keyAnchor))throw new Error('v13 key anchor missing');
  s=s.replace(keyAnchor,`const SELF_PROJECT_PATH=${JSON.stringify(sidecarPath)};${keyAnchor}`);

  s=replaceBetween(s,"$('loadVerifiedBtn').onclick=async()=>{","$('exportBtn').onclick=",`async function loadSelfProject(manual=false){try{const r=await fetch(SELF_PROJECT_PATH,{cache:'no-store'});if(!r.ok){if(manual)throw Error(\`Verified self-project export unavailable (\${r.status}).\`);return false}importProjectObject(await r.json());if(manual)show('workflow');return true}catch(e){if(manual)setStatus(e.message,true);return false}};$('loadVerifiedBtn').onclick=()=>loadSelfProject(true);`);

  s=replaceBetween(s,'if(n===22){const m=t.match(/FINAL_ARTIFACT','if(n===29){',`if(n===22){const m=t.match(/FINAL_ARTIFACT\\s*:\\s*([\\s\\S]*)$/i);p.artifact=(m?m[1]:'').replace(/^\\n/,'');if(!p.artifact)throw Error('Stage 22 FINAL_ARTIFACT is empty.');const f=t.match(/ARTIFACT_NAME\\s*:\\s*([A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*)/i);if(f)p.artifactName=f[1]}`);

  const initAnchor='load();render();window.__CLR_V13__=';
  if(!s.includes(initAnchor))throw new Error('v13 initialization anchor missing');
  s=s.replace(initAnchor,'load();render();loadSelfProject(false);window.__CLR_V13__=');

  fs.writeFileSync(output,s);
  return {output,bytes:Buffer.byteLength(s),sidecarPath,autoLoadsSidecar:s.includes('loadSelfProject(false)'),containsNoEmbeddedCompletedProject:!s.includes('HARDCODED_COMPLETED_PROJECT'),preservesArtifactName:s.includes('ARTIFACT_NAME'),nonCircularStage2:s.includes('Build the EXTERNAL SOURCE inventory for this job now.')&&!s.includes('Inspect the actual supplied sources and build the complete source inventory now.')};
}

const candidate=build('SELF_VERIFIED_PROJEC.json','app-v13-candidate1.html');
const corrected=build('SELF_VERIFIED_PROJECT.json','app-v13.html');
console.log(JSON.stringify({status:'BUILT',candidate,corrected},null,2));
