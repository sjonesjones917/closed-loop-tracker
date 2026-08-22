import fs from 'node:fs';

const BUILD_REVISION = '2026-08-22-existing-v13-external-research-exact-export-r6';

const replaceBetween = (text, start, end, replacement) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Patch anchor missing: ${start} / ${end}`);
  return text.slice(0, a) + replacement + text.slice(b);
};

const replaceExact = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`${label} patch anchor missing`);
  return text.replace(from, to);
};

const sourceOf = (fn, name) => {
  const renamed = fn.toString().replace(/^function\s+\w+/, `function ${name}`);
  return renamed.replace(new RegExp(`^function ${name}\\(([^)]*)\\)`), (_, args) => `function ${name}(${args.replace(/\s*,\s*/g, ',').trim()})`);
};

function generatedPrior(p, n) {
  if (n === 1) return 'NONE';
  if (n === 2) {
    return [
      '===== STAGE 1 — DEFINE JOB =====',
      'Use only the job definition represented by the exact objective, exact requested deliverable, constraints/prohibitions, required output form, applicable domains, and external research questions.',
      'Implementation files, generated artifacts, source code, tests, project JSON, candidate files, prior workflow work products, and implementation behavior are intentionally withheld because they are not external research authority.'
    ].join('\n');
  }
  if (n === 3) {
    const stageTwo = p.stages[1];
    return [
      '===== STAGE 2 — EXTERNAL SOURCE INVENTORY =====',
      stageTwo.response || 'NO EXTERNAL SOURCE INVENTORY',
      '',
      'EVIDENCE / NOTES',
      stageTwo.notes || 'NONE'
    ].join('\n');
  }
  return p.stages.slice(0, n - 1).map((stage, i) => {
    const batch = batchDigest(stage);
    return `===== STAGE ${i + 1} — ${STAGES[i][0]} =====\n${stage.response || 'NO STAGE SUMMARY'}${batch ? `\n\nBATCH RECORDS\n${batch}` : ''}\n\nEVIDENCE / NOTES\n${stage.notes || 'NONE'}`;
  }).join('\n\n');
}

function generatedResearchPrompt(p, n) {
  gate(p, n);
  const stageName = STAGES[n - 1][0];
  const stageInstruction = STAGES[n - 1][1];
  const inventory = n === 3 ? String(p.stages[1]?.response || '').trim() : '';
  if (n === 3 && !inventory) throw Error('Stage 3 is blocked until Stage 2 contains a completed external source inventory.');
  const handoff = n === 2
    ? 'RAW STAGE 1 RESPONSE AND SUPPLIED IMPLEMENTATION FILE LIST OMITTED BY DESIGN. Use only the user objective, requested deliverable, explicit constraints, output form, temporal scope, and external research questions to define the research scope.'
    : `APPROVED STAGE 2 EXTERNAL SOURCE INVENTORY:\n${inventory}`;

  return `CLOSED-LOOP AGENT RELIABILITY WORKFLOW

PROMPT_RULESET_VERSION: external-authority-first-2026-08-22-r4

JOB_ID: ${p.jobId}
PROJECT_ID: ${p.projectId}
PROJECT: ${p.name}

STAGE ${n} OF 31 — ${stageName}

STAGE ${n} RESEARCH AUTHORITY BOUNDARY — EXTERNAL SOURCES ONLY

USER JOB DEFINITION — SCOPE, NOT EXTERNAL RESEARCH AUTHORITY
EXACT USER OBJECTIVE:
${p.objective}

EXACT DELIVERABLE REQUESTED:
${p.deliverable}

EXPLICIT CONSTRAINTS / PROHIBITED ACTIONS:
${p.constraints || 'NONE SUPPLIED'}

REQUIRED OUTPUT FORM:
${p.format}

TEMPORAL SCOPE:
${p.deadline}

RESEARCH INPUT BOUNDARY
${handoff}

EXECUTE THIS STAGE NOW
${stageInstruction}

RESEARCH RULES
- Search the internet and other external authoritative information sources now.
- Find and actually examine independent official websites, government authorities, statutes, regulations, case law, standards, specifications, official platform and API documentation, manufacturer documentation, books, libraries, academic literature, peer-reviewed literature, professional references, public databases, patent databases, policies, and other external authorities appropriate to this job.
- Prefer primary sources, current official documentation, and controlling authority.
- User input defines the requested result and research scope; it does not automatically establish external truth.
- Do not inspect, inventory, cite, or treat supplied implementation files as research sources.
- Do not inspect, inventory, cite, or treat application HTML, JavaScript, source code, tests, generated prompts, generated project JSON, candidate files, prior workflow outputs, project records, implementation behavior, or any other work product of this job as research authority.
- The requested product may not exist yet. Establish externally governed requirements first; later stages may inspect produced artifacts only as verification subjects.
- ${n === 2 ? 'Record EXTERNAL_SEARCH_PERFORMED: true only after real external retrieval and examination occurred.' : 'Every finding must identify a FINDING_ID, registered SOURCE_ID, and exact relevant external portion.'}
- Do not invent missing facts. A mandatory unavailable authority or fact is BLOCKED.
- Do not perform a later stage.
- Preserve exact external provenance and identifiers.

RETURN ONLY THE COMPLETED STAGE ${n} RESULT.`;
}

function generatedPrompt(p, n) {
  gate(p, n);
  if(n===2||n===3)return researchPrompt(p,n);
  return `CLOSED-LOOP AGENT RELIABILITY WORKFLOW

PROMPT_RULESET_VERSION: external-authority-first-2026-08-22-r4

JOB_ID: ${p.jobId}
PROJECT_ID: ${p.projectId}
PROJECT: ${p.name}

EXACT USER OBJECTIVE:
${p.objective}

EXACT DELIVERABLE REQUESTED:
${p.deliverable}

SUPPLIED FILES / MESSAGES / LINKS / DATA:
${p.inputs || 'NONE SUPPLIED'}

CONSTRAINTS / PROHIBITED ACTIONS:
${p.constraints || 'NONE SUPPLIED'}

REQUIRED OUTPUT FORMAT:
${p.format}

DEADLINE / TEMPORAL SCOPE:
${p.deadline}

STAGE ${n} OF 31 — ${STAGES[n - 1][0]}

EXECUTE THIS STAGE NOW
${STAGES[n - 1][1]}

RULES
- Execute the operation; do not merely describe how.
- Perform all AI-capable work available to you.
- Use supplied implementation files only in stages that authorize production or verification against them.
- Do not invent missing facts. A mandatory unavailable fact is BLOCKED.
- Do not perform a later stage.
- Preserve exact evidence and identifiers.

PRIOR COMPLETED HANDOFF
${prior(p, n)}

RETURN ONLY THE COMPLETED STAGE RESULT.`;
}

function generatedRunPrompt(p, n, i, role, targetOverride = '') {
  gate(p, n);
  const rid = `RUN-${String(i + 1).padStart(3, '0')}`;
  const base = prompt(p, n);
  let target = '';
  if (role === 'verifier') {
    if (n === 12) target = p.stages[10].producers[i] || '';
    else if (n === 19) target = p.stages[17].producers[i] || '';
    else if (n === 20) target = targetOverride || p.stages[19].producers[i] || '';
    if (!String(target).trim()) throw Error(`Verifier prompt for ${rid} is blocked until that run's actual producer output exists.`);
  }
  return `${base}

${role === 'producer' ? 'INDEPENDENT EXECUTION' : 'INDEPENDENT VERIFICATION'} RECORD ${rid}
${role === 'producer'
  ? `Execute ${rid} in a fresh context. Do not read or reuse any other run output. Return this run's complete actual output and evidence.`
  : `Verify ${rid} independently against every mandatory requirement and approved test. Do not trust the producing run's conclusion.

TARGET RUN OUTPUT TO VERIFY:
${target}`}`;
}

function generatedValidateStandard(p, n, t) {
  t = requireText(t, 'Agent response');
  const U = t.toUpperCase();

  if (n === 1) {
    has(U, /JOB_ID/, 'Stage 1 must contain JOB_ID.');
    has(U, /EXPLICIT USER REQUIREMENTS/, 'Stage 1 must record explicit user requirements.');
    has(U, /EXPLICIT PROHIBITIONS/, 'Stage 1 must record explicit prohibitions.');
    has(U, /EXTERNAL RESEARCH QUESTIONS/, 'Stage 1 must record external research questions without researching them yet.');
    has(U, /ASSUMPTIONS/, 'Stage 1 must record assumptions.');
    has(U, /UNKNOWNS/, 'Stage 1 must record unknowns.');
    has(U, /BLOCKERS/, 'Stage 1 must record blockers.');
    if (!U.includes(p.objective.slice(0, Math.min(24, p.objective.length)).toUpperCase())) {
      throw Error('Stage 1 must preserve content from the real project objective.');
    }
    if (!U.includes(p.deliverable.slice(0, Math.min(24, p.deliverable.length)).toUpperCase())) {
      throw Error('Stage 1 must preserve content from the real requested deliverable.');
    }
  }

  if (n === 2) {
    has(U, /EXTERNAL_SEARCH_PERFORMED\s*[:=]\s*TRUE/, 'Stage 2 must affirm EXTERNAL_SEARCH_PERFORMED: true.');
    has(U, /SOURCE_ID/, 'Stage 2 must contain SOURCE_ID.');
    has(U, /SOURCE_TYPE/, 'Stage 2 must contain SOURCE_TYPE.');
    has(U, /SOURCE_ROLE/, 'Stage 2 must contain SOURCE_ROLE.');
    if (!/(https?:\/\/|DOI\s*[:=]|ISBN\s*[:=]|RFC\s*[-:]?\s*\d+)/i.test(t)) {
      throw Error('Stage 2 must record externally identifiable source provenance such as a URL, DOI, ISBN, or RFC identifier.');
    }
    if (/SOURCE_TYPE\s*[:=]\s*(USER_INPUT|FILE|HTML|JAVASCRIPT|PROJECT_JSON|APPLICATION_FILE|GENERATED_FILE|PROMPT|AGENT_RESPONSE|WORK_PRODUCT)\b/i.test(t)) {
      throw Error('Stage 2 research sources must be independent external sources, not user input or project work products.');
    }
    if (/\b(app-v\d+(?:-candidate\d+)?\.html|build-v13-self\.mjs|self-browser-e2e\.mjs|self-e2e-agent\.mjs|SELF_VERIFIED_PROJECT\.json)\b/i.test(t)) {
      throw Error('Stage 2 rejected: application and workflow work-product files cannot be inventoried as external research authority.');
    }
    if (/FINDING_ID\s*[:=]/i.test(t)) {
      throw Error('Stage 2 rejected: substantive findings belong to Stage 3.');
    }
  }

  if (n === 3) {
    has(U, /FINDING(?:_ID|\s+[A-Z0-9-]+)/, 'Stage 3 must contain finding identifiers.');
    has(U, /SOURCE_ID/, 'Stage 3 findings must trace to SOURCE_ID records.');
    if (/\b(app-v\d+(?:-candidate\d+)?\.html|build-v13-self\.mjs|self-browser-e2e\.mjs|self-e2e-agent\.mjs|SELF_VERIFIED_PROJECT\.json)\b/i.test(t)) {
      throw Error('Stage 3 rejected: implementation and workflow work-product files cannot establish researched requirements.');
    }
  }

  if (n === 4) has(U, /REQ-/, 'Stage 4 must contain REQ identifiers.');
  if (n === 6) {
    has(U, /TEST-/, 'Stage 6 must contain TEST identifiers.');
    has(U, /100%/, 'Stage 6 must establish 100% mandatory test coverage.');
  }
  if (n === 8) has(U, /INSTRUCTION-V/, 'Stage 8 must create an INSTRUCTION version.');
  if (n === 10 || n === 17) has(U, /CANDIDATE-V/, 'This freeze stage must identify CANDIDATE-vN.');
  if (n === 21) has(U, /BASELINE[_ -]?ID/, 'Stage 21 must identify BASELINE_ID.');
  if (n === 22) has(t, /FINAL_ARTIFACT\s*:/i, 'Stage 22 must include the exact finished deliverable after FINAL_ARTIFACT:.');
  if (n === 29) has(U, /RELEASE_DECISION\s*[:=]\s*(ACCEPTED|REJECTED|BLOCKED)/, 'Stage 29 must contain RELEASE_DECISION: ACCEPTED, REJECTED, or BLOCKED.');
  return t;
}

function build(sidecarPath, output) {
  let s = fs.readFileSync('app-v11.html', 'utf8');

  s = replaceBetween(s, 'function prior(p,n){', 'function batchDigest(s){', `${sourceOf(generatedPrior, 'prior')}\n`);
  s = replaceBetween(s, 'function prompt(p,n){', 'function runPrompt(p,n,i,role){', `${sourceOf(generatedResearchPrompt, 'researchPrompt')}\n${sourceOf(generatedPrompt, 'prompt')}\n`);
  s = replaceBetween(s, 'function runPrompt(p,n,i,role){', 'function requireText(t,label,min=100){', `${sourceOf(generatedRunPrompt, 'runPrompt')}\n`);

  const oldRequire = "function requireText(t,label,min=100){t=String(t||'').trim();if(t.length<min)throw Error(`${label} is required and must contain a substantive completed result (minimum ${min} characters).`);return t}";
  const newRequire = "function requireText(t,label,min=100){const raw=String(t??''),checked=raw.trim();if(checked.length<min)throw Error(`${label} is required and must contain a substantive completed result (minimum ${min} characters).`);return raw}";
  s = replaceExact(s, oldRequire, newRequire, 'requireText exact-byte preservation');

  s = replaceBetween(s, 'function validateStandard(p,n,t){', 'function validateRun(v,i,kind){', `${sourceOf(generatedValidateStandard, 'validateStandard')}\n`);

  const oldHandler = `document.querySelectorAll('[data-rprompt]').forEach(b=>b.onclick=()=>{const [role,i]=b.dataset.rprompt.split(':');copyText(runPrompt(p,n,Number(i),role))});`;
  const newHandler = `document.querySelectorAll('[data-rprompt]').forEach(b=>b.onclick=()=>{const [role,i]=b.dataset.rprompt.split(':'),idx=Number(i),target=role==='verifier'&&n===20?(document.querySelector(\`[data-producer="\${idx}"]\`)?.value||''):'';try{copyText(runPrompt(p,n,idx,role,target))}catch(e){$('stageMsg').textContent=e.message;setStatus(e.message,true)}});`;
  s = replaceExact(s, oldHandler, newHandler, 'run-prompt click handler');

  s = s.replaceAll('Closed-Loop Reliability v11', 'Closed-Loop Reliability v13')
    .replaceAll('Closed-Loop Agent Reliability v11', 'Closed-Loop Agent Reliability v13')
    .replaceAll('schemaVersion:11', 'schemaVersion:13')
    .replaceAll('schemaVersion!==11', 'schemaVersion!==13')
    .replaceAll('closedLoopReliability.projects.v11', 'closedLoopReliability.projects.v13')
    .replaceAll('closedLoopReliability.selected.v11', 'closedLoopReliability.selected.v13')
    .replaceAll('__CLR_V11__', '__CLR_V13__')
    .replaceAll('valid v11 project export', 'valid v13 project export')
    .replaceAll('Load verified E2E export', 'Reload verified self-project export')
    .replaceAll('31 sequential operations · phone-first · every completion requires an actual pasted result · no seeded completed project', '31 sequential operations · external-authority research boundary · exact visible export · no seeded completed project');

  const oldStage1 = "['DEFINE JOB','Read the original request and supplied inputs. Create the authoritative JOB RECORD and INPUT-v001 now. Preserve the exact objective and requested deliverable; inventory inputs, constraints, format, deadline, sources, tools, prohibited actions, explicit requirements, assumptions, and unknowns. Do not research or draft the final deliverable.'],";
  const newStage1 = "['DEFINE JOB','Define the real job now from USER INPUT only. Read the complete user request. Preserve the exact user objective and exact requested deliverable. Extract every explicit user requirement and prohibition, required output form, applicable domain or domains, known user-supplied facts, assumptions, unknowns, blockers, and the external research questions that must be answered later. Stage 1 is not research. Do not inspect generated implementation artifacts, candidate application files, project JSON, generated tests, or prior workflow work products to decide what the requested result should contain. Do not invent missing facts. Return the completed job definition.'],";
  const oldStage2 = "['INVENTORY SOURCES','Inspect the actual supplied sources and build the complete source inventory now. Record SOURCE_ID, description, type, origin, version/date, authority, SOURCE_ROLE, relevant portions, conflicts, and blockers. Use current authoritative research only when the job requires it.'],";
  const newStage2 = "['INVENTORY SOURCES','EXTERNAL RESEARCH ONLY. Build the EXTERNAL SOURCE inventory for this job now. Search the internet and other independent external authoritative information systems outside this project. Find and actually examine official websites, government sources, statutes, regulations, case law, standards, specifications, official platform and API documentation, manufacturer documentation, books, libraries, academic literature, professional references, public databases, policies, and other independent authorities appropriate to the domain. Start only from the Stage 1 job definition. Do NOT inspect or use application source code, HTML, JavaScript, tests, generated prompts, generated project JSON, candidate files, prior workflow outputs, project records, or implementation behavior as research authority. For every source actually found and examined record SOURCE_ID, exact title, SOURCE_TYPE, author or issuing organization, publisher, URL or external location, publication date, effective date when applicable, access date, version, authority level, SOURCE_ROLE, relevance, relevant portion, primary/secondary status, possible conflicts, and whether additional research is required. Record EXTERNAL_SEARCH_PERFORMED: true only after external retrieval actually occurred. Complete only when every Stage 1 research area has at least one appropriate external source or an explicit blocker. Return the external source inventory only; do not perform Stage 3 requirement extraction.'],";
  const oldStage3 = "['RESEARCH REQUIREMENTS','Read the controlling sources and extract every obligation, restriction, exception, dependency, applicability condition, format condition, numerical condition, and explicit user requirement now. Cite exact evidence and repeat until no new material category is found.'],";
  const newStage3 = "['RESEARCH REQUIREMENTS','Research the requirements governing this job from the Stage 2 EXTERNAL SOURCE inventory and additional independent external authority discovered as necessary. Search externally as needed. Do not derive requirements from application files, generated code, tests, project JSON, candidate implementations, generated prompts, prior workflow outputs, or implementation behavior. For every finding assign a FINDING_ID, identify the SOURCE_ID and exact relevant portion, state what the source requires or establishes, explain why it applies, distinguish mandatory requirements from recommendations, distinguish direct requirements from derived engineering implications, and identify exceptions, conflicts, and applicability conditions. Continue until every Stage 1 external research question is answered or explicitly BLOCKED. Return research findings only; do not compile the Stage 4 requirement registry yet.'],";
  s = replaceExact(s, oldStage1, newStage1, 'Stage 1 description');
  s = replaceExact(s, oldStage2, newStage2, 'Stage 2 description');
  s = replaceExact(s, oldStage3, newStage3, 'Stage 3 description');

  const keyAnchor = "const KEY='closedLoopReliability.projects.v13',SEL='closedLoopReliability.selected.v13';";
  s = replaceExact(s, keyAnchor, `const SELF_PROJECT_PATH=${JSON.stringify(sidecarPath)};${keyAnchor}`, 'v13 storage key');

  s = replaceBetween(
    s,
    "$('loadVerifiedBtn').onclick=async()=>{",
    "$('exportBtn').onclick=",
    `async function loadSelfProject(manual=false){try{const r=await fetch(SELF_PROJECT_PATH,{cache:'no-store'});if(!r.ok){if(manual)throw Error(\`Verified self-project export unavailable (\${r.status}).\`);return false}importProjectObject(await r.json());if(manual)show('workflow');return true}catch(e){if(manual)setStatus(e.message,true);return false}};$('loadVerifiedBtn').onclick=()=>loadSelfProject(true);`
  );

  s = replaceBetween(
    s,
    'if(n===22){const m=t.match(/FINAL_ARTIFACT',
    'if(n===29){',
    `if(n===22){const m=t.match(/FINAL_ARTIFACT\\s*:\\s*([\\s\\S]*)$/i);p.artifact=(m?m[1]:'').replace(/^\\n/,'');if(!p.artifact)throw Error('Stage 22 FINAL_ARTIFACT is empty.');const f=t.match(/ARTIFACT_NAME\\s*:\\s*([A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*)/i);if(f)p.artifactName=f[1]}`
  );

  const exportNameAnchor = 'a.download=`${p.jobId}.json`';
  const exportNameReplacement = "a.download=p.name==='REAL SELF-BUILD — CLOSED-LOOP RELIABILITY V13'?'SELF_VERIFIED_PROJECT.json':`${p.jobId}.json`";
  s = replaceExact(s, exportNameAnchor, exportNameReplacement, 'visible project export filename');

  const initAnchor = 'load();render();window.__CLR_V13__=';
  s = replaceExact(s, initAnchor, 'load();render();loadSelfProject(false);window.__CLR_V13__=', 'v13 initialization');

  fs.writeFileSync(output, s);
  return {
    output,
    bytes: Buffer.byteLength(s),
    buildRevision: BUILD_REVISION,
    sidecarPath,
    autoLoadsSidecar: s.includes('loadSelfProject(false)'),
    containsNoEmbeddedCompletedProject: !s.includes('HARDCODED_COMPLETED_PROJECT'),
    preservesArtifactName: s.includes('ARTIFACT_NAME'),
    exactSelfProjectExportName: s.includes("'SELF_VERIFIED_PROJECT.json'"),
    nonCircularStage2: s.includes('Build the EXTERNAL SOURCE inventory for this job now.')
      && !s.includes('Inspect the actual supplied sources and build the complete source inventory now.'),
    stage2OmitsWorkProductInputs: s.includes('OMITTED FROM RESEARCH AUTHORITY'),
    stage2RejectsWorkProducts: s.includes('Stage 2 research sources must be independent external sources'),
    stage3ReceivesOnlyExternalInventory: s.includes('===== STAGE 2 — EXTERNAL SOURCE INVENTORY =====')
  };
}

const candidate = build('SELF_VERIFIED_PROJEC.json', 'app-v13-candidate1.html');
const corrected = build('SELF_VERIFIED_PROJECT.json', 'app-v13.html');
console.log(JSON.stringify({ status: 'BUILT', buildRevision: BUILD_REVISION, candidate, corrected }, null, 2));
