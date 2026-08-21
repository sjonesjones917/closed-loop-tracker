(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.ClosedLoopCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const STAGES=[
  {
    "number": 1,
    "id": "STAGE-01",
    "name": "DEFINE JOB",
    "instruction": "Execute the job-definition operation now. Read the original user request and all supplied inputs. Create the authoritative job record by: (1) preserving the exact user objective without rewriting its meaning; (2) preserving the exact requested deliverable; (3) inventorying every supplied file, message, link, datum, constraint, requested format, deadline, authoritative source, available tool, prohibited action, explicit requirement, and known unknown; (4) separating explicit requirements from assumptions; (5) assigning the project JOB_ID supplied by this app; and (6) assigning INPUT-v001 for the initial input set. If a required fact is absent, write UNKNOWN; do not invent it. Return the completed JOB RECORD and INPUT-v001 as the stage result. Do not research, draft, or evaluate the final deliverable in this stage."
  },
  {
    "number": 2,
    "id": "STAGE-02",
    "name": "INVENTORY SOURCES",
    "instruction": "Execute source inventory now. Inspect the actual supplied files and links when available; do not rely on filenames or summaries. Identify every source that can govern correctness. For each source record SOURCE_ID, title/description, source type, origin, version, date/effective date where relevant, authority, SOURCE_ROLE, relevant portions, and conflicts. When current external facts govern correctness, research authoritative current sources. Resolve authority hierarchy where determinable; unresolved controlling conflicts are BLOCKED. Return the completed source registry, not instructions for building one."
  },
  {
    "number": 3,
    "id": "STAGE-03",
    "name": "RESEARCH REQUIREMENTS",
    "instruction": "Execute requirements research now from the approved source inventory. Read the controlling sources and extract every obligation, restriction, exception, required element, prohibited element, numerical condition, structural condition, procedural condition, dependency, applicability fact, and explicit user requirement. Continue passes until a pass yields no new material requirement category. For each extracted candidate cite its source and location. Return the completed research findings and coverage statement."
  },
  {
    "number": 4,
    "id": "STAGE-04",
    "name": "COMPILE ATOMIC REQUIREMENTS",
    "instruction": "Compile the researched obligations into an atomic requirement registry now. Create exactly one independently testable requirement per obligation. Split compounds. Each REQ record must contain requirement text, source, source location, authority, applicability, dependencies, prohibitions, verification method, expected affirmative evidence, failure condition, and status. Return the complete REQ registry and requirement count."
  },
  {
    "number": 5,
    "id": "STAGE-05",
    "name": "RESOLVE CONFLICTS",
    "instruction": "Resolve the requirement set now. Check every requirement for duplicates, contradictions, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported requirements, uncertain applicability, and unverifiable requirements. Resolve what controlling authority resolves; do not silently choose between unresolved authoritative conflicts. Mark unresolved mandatory items BLOCKED. Return the resolved requirement registry plus an explicit conflict/blocker table."
  },
  {
    "number": 6,
    "id": "STAGE-06",
    "name": "BUILD ACCEPTANCE TESTS",
    "instruction": "Build the acceptance test suite now. For every mandatory requirement, create at least one test that can establish SATISFIED, VIOLATED, or UNDETERMINED. Prefer deterministic verification for deterministic properties. Every TEST record must identify REQ_ID, procedure, inputs, expected result, required evidence, verification method, and failure condition. Prove mandatory requirement test coverage is 100 percent or return BLOCKED."
  },
  {
    "number": 7,
    "id": "STAGE-07",
    "name": "BUILD FAILURE/MUTATION TESTS",
    "instruction": "Build and execute failure/mutation tests now. For every requirement where a violating case is constructible, create a mutation that violates that requirement while holding unrelated conditions constant. Run the applicable validator against each mutation and record whether it correctly rejects/detects the violation. Any validator that accepts a violating mutation is a material test defect and prevents completion. Return mutation records and results."
  },
  {
    "number": 8,
    "id": "STAGE-08",
    "name": "AUTHOR PRODUCTION INSTRUCTION",
    "instruction": "Author the production instruction now from the approved requirements and tests. The instruction must contain the exact objective, governing inputs and sources, definitions, scope, ordered procedure, decision rules, tool-use rules, output contract, failure behavior, truth semantics, and exact completion criteria. Every mandatory requirement must be represented or traced into the production instruction. Return the complete production instruction as INSTRUCTION-v001 or the next version."
  },
  {
    "number": 9,
    "id": "STAGE-09",
    "name": "PREFLIGHT INSTRUCTION",
    "instruction": "Preflight the production instruction now without executing the target production work. Test it for ambiguity, undefined objects, missing inputs, contradictions, unavailable capabilities, unverifiable commands, unclear responsibility/order/failure behavior, missing traceability, and opportunities to satisfy wording without satisfying meaning. Correct every confirmed defect and return the corrected version plus preflight evidence. If correction changes requirements or sources, identify the upstream stage that must be invalidated."
  },
  {
    "number": 10,
    "id": "STAGE-10",
    "name": "FREEZE CANDIDATE",
    "instruction": "Freeze the candidate now. Record exact versions of input set, source set, requirement registry, acceptance/mutation tests, production instruction, and tool configuration. Hash immutable artifacts when practical. Assign CANDIDATE-vN. State that any material change creates a new candidate version and invalidates dependent verification. Return the frozen-candidate manifest."
  },
  {
    "number": 11,
    "id": "STAGE-11",
    "name": "RUN 10 INDEPENDENT EXECUTIONS",
    "instruction": "Run ten actual independent executions now using exactly the frozen candidate. Use fresh execution contexts. RUN-001 through RUN-010 must each contain its own complete output. No run may see another run output, reviewer comments, prior failures, or proposed corrections. Return all ten run outputs or verifiable references to all ten outputs; do not summarize them into one synthetic result."
  },
  {
    "number": 12,
    "id": "STAGE-12",
    "name": "VERIFY EVERY RUN AGAINST EVERY REQUIREMENT",
    "instruction": "Verify every run against every mandatory requirement now. For each RUN-001..RUN-010 × mandatory REQ_ID pair, apply the approved test and record TEST_ID, result (SATISFIED, VIOLATED, or UNDETERMINED), and affirmative evidence. Create DEFECT_ID records for violations or validator failures. Return the complete verification matrix and coverage totals."
  },
  {
    "number": 13,
    "id": "STAGE-13",
    "name": "COMPARE ALL RUNS",
    "instruction": "Compare all ten independently verified runs now, requirement by requirement. Identify inconsistent interpretations, prohibited variance, inconclusive tests, repeated failures, unique failures, and any correctness-affecting variance. Do not equate textual difference with defect unless the requirement makes it relevant. Return the comparison table and defect candidates."
  },
  {
    "number": 14,
    "id": "STAGE-14",
    "name": "ROOT-CAUSE EVERY DEFECT",
    "instruction": "Root-cause every confirmed material defect now. Trace each defect to the earliest responsible layer: source, research, requirement, test, instruction, input, execution, tool, or audit. Provide evidence for the causal assignment and identify every dependent artifact invalidated by the defect. Do not patch only final outputs when the defect originates upstream. Return the root-cause registry."
  },
  {
    "number": 15,
    "id": "STAGE-15",
    "name": "ADD REGRESSION TESTS",
    "instruction": "Create regression tests now for every confirmed defect. Preserve a minimal reproducer, create a test that demonstrably fails on the defective version, associate it with the responsible REQ/DEFECT, and define the expected pass condition after correction. Return the regression suite and pre-correction failure evidence."
  },
  {
    "number": 16,
    "id": "STAGE-16",
    "name": "CORRECT RESPONSIBLE LAYER",
    "instruction": "Apply the established corrections now at the earliest defective layer and regenerate every dependent artifact. Increment the version of every changed artifact. Do not alter frozen versions in place. Re-run each new regression test to prove the defect is corrected. Return corrected artifacts/versions and regression pass evidence."
  },
  {
    "number": 17,
    "id": "STAGE-17",
    "name": "FREEZE NEW VERSION",
    "instruction": "Freeze the corrected candidate now as a new immutable CANDIDATE-vN. Record exact versions and hashes of the corrected inputs, sources, requirements, tests, instruction, and tool configuration. Return the new candidate manifest. Do not reuse the prior candidate identifier."
  },
  {
    "number": 18,
    "id": "STAGE-18",
    "name": "RUN 10 NEW INDEPENDENT EXECUTIONS",
    "instruction": "Run a fresh batch of ten independent executions now against the new frozen candidate. Produce RUN-001 through RUN-010 as actual separate outputs. No run may see another run or prior batch output. Return all ten run outputs or verifiable references. Do not recycle prior-run content."
  },
  {
    "number": 19,
    "id": "STAGE-19",
    "name": "REPEAT UNTIL CONVERGED",
    "instruction": "Execute the convergence loop now. Verify the new ten-run batch, compare it, root-cause every defect, add regressions, correct the responsible layer, freeze a new candidate, and run another fresh ten-run batch as many times as required until all convergence gates are met: mandatory requirement coverage 100%; mandatory verification coverage 100%; regression success 100%; critical defects 0; major defects 0; mandatory unknowns 0; correctness contradictions 0; correctness ambiguities 0; unexplained correctness variance 0. Return the full convergence ledger and the exact converged candidate version."
  },
  {
    "number": 20,
    "id": "STAGE-20",
    "name": "RUN UNCHANGED 10-EXECUTION CONFIRMATION",
    "instruction": "Change nothing. Run another ten fresh independent executions against the exact converged candidate now. Verify every run against every mandatory requirement and compare the batch. Any new critical/major defect, new requirement, validator miss, contradiction, ambiguity, or unexplained correctness variance fails confirmation and returns the workflow to the earliest responsible stage. Return RUN-001..RUN-010 confirmation outputs and verification evidence."
  },
  {
    "number": 21,
    "id": "STAGE-21",
    "name": "FREEZE APPROVED BASELINE",
    "instruction": "Freeze the approved baseline now. Record the exact approved input set, source set, requirement registry, production instruction, test suites, validator configuration, tool configuration, convergence evidence, and unchanged confirmation evidence under one BASELINE_ID. Hash immutable artifacts when practical. Return the baseline manifest."
  },
  {
    "number": 22,
    "id": "STAGE-22",
    "name": "GENERATE FINISHED PRODUCT",
    "instruction": "Generate the actual finished product now in a fresh production execution using only approved baseline materials required for production. Produce the exact user-requested deliverable, not a description, template, outline, or placeholder. Record PRODUCT_ID, BASELINE_ID, EXECUTION_ID, output files/artifacts, and hashes. Return the finished product and product manifest."
  },
  {
    "number": 23,
    "id": "STAGE-23",
    "name": "DETERMINISTIC PRODUCT VERIFICATION",
    "instruction": "Run every applicable deterministic validator against the actual finished artifact now. Verify arithmetic, counts, schemas, filenames, inventory, hashes, sections/order, identifiers, references, links, dates, enumerations, tables, required/prohibited text, package contents, structural constraints, and formatting dimensions where applicable. Return each deterministic test result and evidence. Any mandatory failure rejects the product."
  },
  {
    "number": 24,
    "id": "STAGE-24",
    "name": "INDEPENDENT SEMANTIC VERIFICATION",
    "instruction": "Perform independent semantic verification now using a separate evaluator context. For every semantic requirement, record REQ_ID, product location, source evidence, observed meaning, required meaning, and SATISFIED, VIOLATED, or UNDETERMINED. The generating execution may not be its sole semantic validator. Return the semantic verification matrix."
  },
  {
    "number": 25,
    "id": "STAGE-25",
    "name": "ADVERSARIAL PRODUCT VERIFICATION",
    "instruction": "Attempt to disprove the product now. Search specifically for missing or prohibited material, contradictions, impossible logic, unsupported facts, source misrepresentation, wrong versions, broken references, hidden assumptions, partial completion, semantic nonsense, inconsistent terminology, unhandled exceptions, stale facts, malformed files, hidden content, export corruption, and requirements that are merely mentioned rather than satisfied. Return adversarial findings and defect records."
  },
  {
    "number": 26,
    "id": "STAGE-26",
    "name": "FINAL REPRESENTATION INSPECTION",
    "instruction": "Inspect the exact final representation now—the bytes and rendered form that will be delivered, including conversions and package contents. Check clipping, off-frame content, missing content, blank pages, broken tables, misplaced graphics, material font substitution, corruption, package inventory, filenames, and versions. Return representation inspection evidence and defects."
  },
  {
    "number": 27,
    "id": "STAGE-27",
    "name": "PROCESS AUDIT",
    "instruction": "Audit the workflow process independently now. Verify approved inputs, frozen instruction, tool configuration, test suites, execution isolation, version transitions, defect records, regression evidence, absence of unauthorized modifications, and end-to-end traceability. Return process-audit findings with pass/fail evidence."
  },
  {
    "number": 28,
    "id": "STAGE-28",
    "name": "PRODUCT AUDIT",
    "instruction": "Audit the finished product independently now. Confirm every mandatory requirement has affirmative evidence, every mandatory validator passed, semantic evidence exists where required, and no unresolved critical or major defect remains. Return the product-audit matrix and any blocker/defect records."
  },
  {
    "number": 29,
    "id": "STAGE-29",
    "name": "ACCEPTED / REJECTED / BLOCKED",
    "instruction": "Assign exactly one release decision now. ACCEPTED is allowed only when every mandatory requirement has affirmative evidence and every mandatory validator passed. REJECTED means at least one mandatory requirement is demonstrably violated. BLOCKED means at least one mandatory requirement cannot be established. Return RELEASE_DECISION with the evidence supporting that exact state."
  },
  {
    "number": 30,
    "id": "STAGE-30",
    "name": "VERIFY RELEASE HASH",
    "instruction": "Verify release identity now. Compute AUDITED_HASH for the exact artifact bytes that completed final verification. Immediately before release, compute RELEASE_HASH over the exact bytes to be released. Require RELEASE_HASH == AUDITED_HASH byte-for-byte. Any mismatch stops release and requires a new product version plus affected revalidation. Return both hashes and the equality result."
  },
  {
    "number": 31,
    "id": "STAGE-31",
    "name": "RELEASE ONLY THE EXACT ACCEPTED ARTIFACT",
    "instruction": "Release only the exact accepted artifact now. Preserve the complete source→requirement→instruction→execution→product element→test→result→evidence→release-decision trace chain. Confirm the artifact being released is byte-identical to the accepted artifact and that its release hash equals the audited hash. Return the release record containing PRODUCT_ID, RELEASE_DECISION, AUDITED_HASH, RELEASE_HASH, artifact identity, and traceability reference."
  }
];

const REQUIRED_TOKENS = {
  1: ['JOB_ID','EXACT USER OBJECTIVE','EXACT DELIVERABLE REQUESTED','INPUT-v'],
  2: ['SOURCE_ID','SOURCE_ROLE'],
  3: ['REQUIREMENT','SOURCE'],
  4: ['REQ-','VERIFICATION'],
  5: ['CONFLICT','RESOLVED'],
  6: ['TEST-','REQ-','100%'],
  7: ['MUTATION','REJECT'],
  8: ['INSTRUCTION-v'],
  9: ['PREFLIGHT','INSTRUCTION-v'],
  10:['CANDIDATE-v'],
  12:['RUN-001','REQ-','SATISFIED'],
  13:['RUN-001','VARIANCE'],
  14:['DEFECT','ROOT'],
  15:['REGRESSION','DEFECT'],
  16:['REGRESSION','PASS'],
  17:['CANDIDATE-v'],
  19:['100%','critical defects','major defects'],
  21:['BASELINE_ID'],
  22:['PRODUCT_ID','BASELINE_ID','ARTIFACT'],
  23:['DETERMINISTIC','SATISFIED'],
  24:['SEMANTIC','SATISFIED'],
  25:['ADVERSARIAL'],
  26:['REPRESENTATION'],
  27:['PROCESS','AUDIT'],
  28:['PRODUCT','AUDIT'],
  29:['RELEASE_DECISION'],
  30:['AUDITED_HASH','RELEASE_HASH'],
  31:['RELEASE_DECISION','AUDITED_HASH','RELEASE_HASH','PRODUCT_ID']
};

function uid(prefix){
  if(typeof crypto!=='undefined'&&crypto.randomUUID) return `${prefix}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

function createProject(input){
  for(const k of ['name','objective','deliverable']) if(!String(input[k]||'').trim()) throw new Error(`${k} is required.`);
  const now=new Date().toISOString();
  return {
    schemaVersion:3,
    projectId:uid('PRJ'),
    jobId:uid('JOB'),
    name:String(input.name).trim(),
    objective:String(input.objective).trim(),
    deliverable:String(input.deliverable).trim(),
    suppliedInputs:String(input.suppliedInputs||'').trim(),
    constraints:String(input.constraints||'').trim(),
    outputFormat:String(input.outputFormat||'UNSPECIFIED').trim(),
    deadline:String(input.deadline||'NONE SUPPLIED').trim(),
    createdAt:now, updatedAt:now,
    inputVersion:'INPUT-v001',
    releaseState:'UNSET',
    finalArtifact:'',
    auditedHash:'',
    releaseHash:'',
    stages:STAGES.map(s=>({stageId:s.id,status:'NOT_STARTED',agentResponse:'',evidence:'',completedAt:null}))
  };
}

function stage(project,n){
  if(!project||!Array.isArray(project.stages)) throw new Error('Invalid project.');
  if(!Number.isInteger(n)||n<1||n>STAGES.length) throw new Error('Invalid stage number.');
  return project.stages[n-1];
}

function validateSequentialAccess(project,n){
  for(let i=0;i<n-1;i++) if(project.stages[i].status!=='COMPLETE') throw new Error(`Stage ${i+1} must be COMPLETE before Stage ${n}.`);
  return true;
}

function countRunIds(text){
  const found=new Set();
  const re=/\bRUN-(00[1-9]|010)\b/gi;
  let m; while((m=re.exec(text))) found.add(m[0].toUpperCase());
  return found.size;
}

function validateStageResponse(project,n,response){
  validateSequentialAccess(project,n);
  const text=String(response||'').trim();
  if(!text) throw new Error('Agent response is required. Paste the complete agent response.');
  if(text.length<120) throw new Error('Agent response is too short to demonstrate completed stage work.');
  for(const token of (REQUIRED_TOKENS[n]||[])){
    if(!text.toLowerCase().includes(token.toLowerCase())) throw new Error(`Stage ${n} response is missing required evidence token: ${token}`);
  }
  if([11,18,20].includes(n) && countRunIds(text)!==10) throw new Error(`Stage ${n} must contain all ten distinct run identifiers RUN-001 through RUN-010.`);
  if(n===19){
    const required=[
      /mandatory requirement coverage\s*[:=]\s*100%/i,
      /mandatory verification coverage\s*[:=]\s*100%/i,
      /regression success\s*[:=]\s*100%/i,
      /critical defects\s*[:=]\s*0/i,
      /major defects\s*[:=]\s*0/i,
      /mandatory unknowns\s*[:=]\s*0/i,
      /correctness contradictions\s*[:=]\s*0/i,
      /correctness ambiguities\s*[:=]\s*0/i,
      /unexplained correctness variance\s*[:=]\s*0/i
    ];
    for(const rx of required) if(!rx.test(text)) throw new Error(`Stage 19 convergence gate missing: ${rx}`);
  }
  if(n===29 && !/RELEASE_DECISION\s*[:=]\s*(ACCEPTED|REJECTED|BLOCKED)/i.test(text)) throw new Error('Stage 29 must state RELEASE_DECISION: ACCEPTED, REJECTED, or BLOCKED.');
  if(n===30){
    const a=text.match(/AUDITED_HASH\s*[:=]\s*([a-f0-9]{64})/i);
    const r=text.match(/RELEASE_HASH\s*[:=]\s*([a-f0-9]{64})/i);
    if(!a||!r) throw new Error('Stage 30 must include 64-hex AUDITED_HASH and RELEASE_HASH.');
    if(a[1].toLowerCase()!==r[1].toLowerCase()) throw new Error('Stage 30 hash mismatch: AUDITED_HASH must equal RELEASE_HASH.');
  }
  return true;
}

function invalidateDownstream(project,n,reason){
  for(let i=n;i<project.stages.length;i++){
    const s=project.stages[i];
    if(s.status!=='NOT_STARTED'||s.agentResponse||s.evidence){
      s.status='NOT_STARTED'; s.agentResponse=''; s.evidence=''; s.completedAt=null;
    }
  }
  project.releaseState='UNSET';
  project.auditedHash='';
  project.releaseHash='';
  project.updatedAt=new Date().toISOString();
  return reason||'Downstream state invalidated by upstream material change.';
}

function completeStage(project,n,response,evidence){
  validateStageResponse(project,n,response);
  const s=stage(project,n);
  const changed=s.status==='COMPLETE' && s.agentResponse!==String(response).trim();
  s.agentResponse=String(response).trim();
  s.evidence=String(evidence||'').trim();
  s.status='COMPLETE';
  s.completedAt=new Date().toISOString();
  project.updatedAt=s.completedAt;
  if(changed) invalidateDownstream(project,n,'Completed stage changed; downstream verification invalidated.');
  const decision = n===29 ? s.agentResponse.match(/RELEASE_DECISION\s*[:=]\s*(ACCEPTED|REJECTED|BLOCKED)/i) : null;
  if(decision) project.releaseState=decision[1].toUpperCase();
  const hashes = n===30 ? {
    a:s.agentResponse.match(/AUDITED_HASH\s*[:=]\s*([a-f0-9]{64})/i),
    r:s.agentResponse.match(/RELEASE_HASH\s*[:=]\s*([a-f0-9]{64})/i)
  } : null;
  if(hashes&&hashes.a&&hashes.r){
    project.auditedHash=hashes.a[1].toLowerCase();
    project.releaseHash=hashes.r[1].toLowerCase();
  }
  return project;
}

function saveStageDraft(project,n,response,evidence){
  validateSequentialAccess(project,n);
  const s=stage(project,n);
  const nextResponse=String(response||'');
  const changed=s.status==='COMPLETE' && s.agentResponse!==nextResponse.trim();
  s.agentResponse=nextResponse;
  s.evidence=String(evidence||'');
  s.status='IN_PROGRESS';
  s.completedAt=null;
  project.updatedAt=new Date().toISOString();
  if(changed) invalidateDownstream(project,n,'Upstream completed stage edited; downstream state invalidated.');
  return project;
}

function completionPercent(project){
  return Math.round(project.stages.filter(s=>s.status==='COMPLETE').length/STAGES.length*100);
}

function priorHandoff(project,n){
  if(n===1) return 'NONE';
  const prev=project.stages[n-2];
  return `===== STAGE ${n-1} COMPLETED RESULT =====\n${prev.agentResponse}\n\nEVIDENCE / NOTES\n${prev.evidence||'NONE'}`;
}

function buildPrompt(project,n){
  validateSequentialAccess(project,n);
  const d=STAGES[n-1];
  return `CLOSED-LOOP AGENT RELIABILITY WORKFLOW

JOB_ID: ${project.jobId}
PROJECT_ID: ${project.projectId}
PROJECT: ${project.name}
EXACT USER OBJECTIVE:
${project.objective}

EXACT DELIVERABLE REQUESTED:
${project.deliverable}

SUPPLIED FILES / MESSAGES / LINKS / DATA:
${project.suppliedInputs||'NONE SUPPLIED'}

CONSTRAINTS / PROHIBITED ACTIONS:
${project.constraints||'NONE SUPPLIED'}

REQUIRED OUTPUT FORMAT:
${project.outputFormat||'UNSPECIFIED'}

DEADLINE / TEMPORAL SCOPE:
${project.deadline||'NONE SUPPLIED'}

CURRENT INPUT VERSION: ${project.inputVersion}

STAGE ${n} OF ${STAGES.length} — ${d.name}

EXECUTE THIS STAGE NOW
${d.instruction}

MANDATORY EXECUTION RULES
- Perform every AI-capable operation required by this stage yourself now.
- Use supplied files and available tools when the stage requires them.
- Return the completed stage work, not a plan, template, checklist of future work, or instructions for another person.
- Do not claim to have inspected, researched, executed, tested, rendered, hashed, or verified anything you did not actually inspect, research, execute, test, render, hash, or verify.
- Do not invent missing facts. Use UNKNOWN only after available sources/tools cannot establish the fact.
- A mandatory UNKNOWN that prevents the stage result is BLOCKED.
- Do not perform a later workflow stage in this response.
- Preserve exact identifiers, versions, evidence, and traceability needed by the next stage.

PRIOR HANDOFF
${priorHandoff(project,n)}

RETURN
Return only the completed result for STAGE ${n} — ${d.name}, including the concrete records, artifacts, evidence, results, defects/blockers, and version identifiers this stage actually creates or changes.`;
}

async function sha256(text){
  const value=String(text||'');
  if(typeof crypto!=='undefined'&&crypto.subtle){
    const bytes=new TextEncoder().encode(value);
    const buf=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  if(typeof require==='function'){
    const c=require('node:crypto');
    return c.createHash('sha256').update(value).digest('hex');
  }
  throw new Error('SHA-256 unavailable in this environment.');
}

async function setFinalArtifact(project,text){
  project.finalArtifact=String(text||'');
  project.updatedAt=new Date().toISOString();
  const hash=await sha256(project.finalArtifact);
  return hash;
}

async function artifactHash(project){
  return sha256(project.finalArtifact||'');
}

async function canRelease(project){
  if(!project.stages.every(s=>s.status==='COMPLETE')) return false;
  if(project.releaseState!=='ACCEPTED') return false;
  if(!project.finalArtifact) return false;
  if(!project.auditedHash||!project.releaseHash||project.auditedHash!==project.releaseHash) return false;
  const actual=await artifactHash(project);
  return actual===project.auditedHash;
}

function makeRealTestProject(){
  return createProject({
    name:'REAL E2E JOB — Inventory Reconciliation',
    objective:'Use the closed-loop workflow to reconcile the supplied inventory values, produce the exact required artifact, independently verify it, and release only the exact audited bytes.',
    deliverable:'inventory-reconciliation.txt with exactly four UTF-8 lines: A=3, B=4, C=5, TOTAL=12',
    suppliedInputs:'Authoritative user data: A=3; B=4; C=5. Arithmetic requirement: TOTAL = A+B+C. Required artifact bytes are exactly: A=3\\nB=4\\nC=5\\nTOTAL=12\\n',
    constraints:'No skipped workflow operation. Every stage must contain a pasted agent response. Ten-run stages require ten distinct run outputs. The final released bytes must hash exactly to the audited artifact hash.',
    outputFormat:'UTF-8 plain text, exact four lines',
    deadline:'NONE SUPPLIED'
  });
}

function runCoreRegression(){
  const p=createProject({name:'Gate Regression',objective:'Verify app state gating',deliverable:'A gated project state'});
  const failures=[];
  try{ completeStage(p,1,'x'); failures.push('short response accepted'); }catch(e){}
  try{ completeStage(p,2,'This response is intentionally long enough but stage one has not completed. '.repeat(3)); failures.push('stage skipping accepted'); }catch(e){}
  return {passed:failures.length===0,failures,stageCount:STAGES.length};
}

return {STAGES,createProject,validateSequentialAccess,validateStageResponse,completeStage,saveStageDraft,invalidateDownstream,completionPercent,buildPrompt,sha256,setFinalArtifact,artifactHash,canRelease,makeRealTestProject,runCoreRegression,countRunIds};
});
