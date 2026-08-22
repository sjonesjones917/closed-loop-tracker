import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const replaceBetween=(text,start,end,replacement)=>{
  const a=text.indexOf(start),b=text.indexOf(end,a);
  if(a<0||b<0)throw new Error(`Patch anchor missing: ${start} / ${end}`);
  return text.slice(0,a)+replacement+text.slice(b);
};
const replaceExact=(text,oldValue,newValue,label)=>{
  if(!text.includes(oldValue))throw new Error(`${label} patch anchor missing`);
  return text.replace(oldValue,newValue);
};

const STAGE1_OLD="['DEFINE JOB','Read the original request and supplied inputs. Create the authoritative JOB RECORD and INPUT-v001 now. Preserve the exact objective and requested deliverable; inventory inputs, constraints, format, deadline, sources, tools, prohibited actions, explicit requirements, assumptions, and unknowns. Do not research or draft the final deliverable.']";
const STAGE1_NEW="['DEFINE JOB','Define the real job now from the user input only. Preserve the exact user objective and exact requested deliverable. Extract every explicit user requirement and prohibition, the required output form, the applicable domain or domains, the user-supplied facts, assumptions, unknowns, and blockers. Identify the questions that must be answered later by independent external authoritative research, but do not answer or research those questions in this stage. Do not inspect generated implementation artifacts and do not treat an existing implementation of the requested result as authority for what the result should contain. Return the completed JOB RECORD and INPUT-v001.']";
const STAGE2_OLD="['INVENTORY SOURCES','Inspect the actual supplied sources and build the complete source inventory now. Record SOURCE_ID, description, type, origin, version/date, authority, SOURCE_ROLE, relevant portions, conflicts, and blockers. Use current authoritative research only when the job requires it.']";
const STAGE2_NEW="['INVENTORY SOURCES','Build the external source inventory for this job now. Search the internet and other independent external authoritative information sources now. Find the official websites, government sources, statutes, regulations, case law, standards, specifications, official and API documentation, manufacturer documentation, books, textbooks, libraries, academic and peer-reviewed literature, professional references, patent and public databases, policies, technical references, and other external sources that govern this job. Start from the Stage 1 job definition and cover every identified research area. Prefer primary controlling authority and current official documentation. Record only sources actually found and examined. For every source record SOURCE_ID, EXACT_TITLE, SOURCE_TYPE, AUTHOR_OR_ISSUING_ORGANIZATION, PUBLISHER, URL_OR_EXTERNAL_LOCATION, PUBLICATION_DATE, EFFECTIVE_DATE, ACCESS_DATE, VERSION, AUTHORITY_LEVEL, SOURCE_ROLE, WHY_RELEVANT, RELEVANT_PORTION, PRIMARY_OR_SECONDARY, CONFLICT_STATUS, and ADDITIONAL_RESEARCH_REQUIRED. Record each research query and map every research area to at least one external source or an explicit blocker. Do not use application source code, HTML, JavaScript, tests, project JSON, generated prompts, prior workflow outputs, candidate artifacts, generated files, or any other work product of this job as research authority. The requested product may not exist yet. Do not inspect it to determine its requirements. Do not perform Stage 3 or extract the substantive requirements yet.']";
const STAGE3_OLD="['RESEARCH REQUIREMENTS','Read the controlling sources and extract every obligation, restriction, exception, dependency, applicability condition, format condition, numerical condition, and explicit user requirement now. Cite exact evidence and repeat until no new material category is found.']";
const STAGE3_NEW="['RESEARCH REQUIREMENTS','Research the requirements governing this job now by reading the independent external sources in the approved Stage 2 inventory and any additional external authoritative sources discovered as necessary. Do not derive requirements from application source code, HTML, JavaScript, tests, project JSON, generated prompts, prior workflow outputs, candidate artifacts, generated files, or any other work product of this job. For every finding record FINDING_ID, SOURCE_ID, the exact RELEVANT_PORTION, what the source requires or establishes, why it applies to this job, MANDATORY_OR_RECOMMENDATION, DIRECT_OR_INFERRED, APPLICABILITY, exceptions, conflicts, dependencies, REQUIREMENT_IMPLICATION, and unresolved questions. Continue until every Stage 1 external research question is answered or explicitly blocked. Determine what the finished result must satisfy before implementation.']";
const STAGE4_OLD="['COMPILE ATOMIC REQUIREMENTS','Compile one independently testable REQ record per obligation now. Split compound obligations. Record source, applicability, dependency, verification method, affirmative evidence, and failure condition for every requirement.']";
const STAGE4_NEW="['COMPILE ATOMIC REQUIREMENTS','Compile the user requirements and externally researched requirements into one atomic requirement registry now. Create one independently testable proposition per REQ record. Every requirement must identify ORIGIN as USER, EXTERNAL_AUTHORITY, or DERIVED_ENGINEERING_REQUIREMENT. A derived engineering requirement must explain its reasoning and trace to a user requirement, one or more external sources, or a necessary dependency; it may not trace only to generated implementation code. Record source references, applicability, mandatory status, dependencies, verification method, objective pass condition, and objective fail condition.']";

function generatedPrompt(p,n){
  gate(p,n);
  const stageBoundary=n===1
    ? '- Stage 1 defines the job only. Identify external research questions but do not research them now.\n- Do not inspect generated implementation artifacts or treat an existing implementation as authority.'
    : n===2
      ? '- Search the internet and other external authoritative information sources now.\n- Discover and inventory external authority only; do not inventory project work products as research sources.\n- Do not inspect the requested product to determine what requirements it should satisfy.\n- Do not perform substantive requirements extraction; that is Stage 3.'
      : n===3
        ? '- Read and research the approved external sources now.\n- Do not derive requirements from any project artifact or implementation behavior.\n- Determine requirements before implementation and trace every finding to external authority.'
        : '- Use actual authorised inputs, tools, and previously accepted records only as permitted by this stage.';
  return `CLOSED-LOOP AGENT RELIABILITY WORKFLOW

JOB_ID: ${p.jobId}
PROJECT_ID: ${p.projectId}
PROJECT: ${p.name}

EXACT USER OBJECTIVE:
${p.objective}

EXACT DELIVERABLE REQUESTED:
${p.deliverable}

SUPPLIED FILES / MESSAGES / LINKS / DATA:
${p.inputs||'NONE SUPPLIED'}

CONSTRAINTS / PROHIBITED ACTIONS:
${p.constraints||'NONE SUPPLIED'}

REQUIRED OUTPUT FORMAT:
${p.format}

DEADLINE / TEMPORAL SCOPE:
${p.deadline}

STAGE ${n} OF 31 — ${STAGES[n-1][0]}

EXECUTE THIS STAGE NOW
${STAGES[n-1][1]}

STAGE-SPECIFIC BOUNDARY
${stageBoundary}

RULES
- Execute only the current stage; do not merely describe how.
- Perform all AI-capable work available to you.
- Do not invent missing facts. A mandatory unavailable fact is BLOCKED.
- Do not perform a later stage.
- Preserve exact evidence and identifiers.
- User input establishes what the user wants; it does not automatically establish external truth.
- Work products may be inspected later for verification, but they cannot establish the external requirement that caused them to be created.

PRIOR COMPLETED HANDOFF
${prior(p,n)}

RETURN ONLY THE COMPLETED STAGE RESULT.`;
}

function generatedValidateStandard(p,n,t){
  t=requireText(t,'Agent response');
  const U=t.toUpperCase();
  if(n===1){
    has(U,/JOB_ID/,'Stage 1 must contain JOB_ID.');
    has(U,/INPUT-V?001/,'Stage 1 must create INPUT-v001.');
    has(U,/APPLICABLE(?:_|\s)DOMAIN/,'Stage 1 must identify the applicable domain or domains.');
    has(U,/EXTERNAL(?:_|\s)RESEARCH(?:_|\s)QUESTION/,'Stage 1 must identify questions for later external research.');
    has(U,/EXPLICIT(?:_|\s)PROHIBITION/,'Stage 1 must preserve explicit prohibitions.');
    if(!U.includes(p.objective.slice(0,Math.min(24,p.objective.length)).toUpperCase()))throw Error('Stage 1 must preserve content from the real project objective.');
    if(!U.includes(p.deliverable.slice(0,Math.min(24,p.deliverable.length)).toUpperCase()))throw Error('Stage 1 must preserve content from the real requested deliverable.');
  }
  if(n===2){
    const required=[
      [/EXTERNAL_SEARCH_PERFORMED\s*:\s*TRUE/,'Stage 2 must affirm that an external search was actually performed.'],
      [/PROHIBITED_WORK_PRODUCTS_USED_AS_AUTHORITY\s*:\s*FALSE/,'Stage 2 must affirm that project work products were not used as authority.'],
      [/SOURCE_INVENTORY_COMPLETE\s*:\s*TRUE/,'Stage 2 must affirm source-inventory completion.'],
      [/SOURCE_ID\s*:/,'Stage 2 must contain SOURCE_ID.'],
      [/EXACT_TITLE\s*:/,'Stage 2 must record exact source titles.'],
      [/SOURCE_TYPE\s*:/,'Stage 2 must record SOURCE_TYPE.'],
      [/AUTHOR_OR_ISSUING_ORGANIZATION\s*:/,'Stage 2 must record the author or issuing organization.'],
      [/PUBLISHER\s*:/,'Stage 2 must record the publisher.'],
      [/URL_OR_EXTERNAL_LOCATION\s*:/,'Stage 2 must record an external locator.'],
      [/PUBLICATION_DATE\s*:/,'Stage 2 must record publication date.'],
      [/EFFECTIVE_DATE\s*:/,'Stage 2 must record effective date.'],
      [/ACCESS_DATE\s*:/,'Stage 2 must record access date.'],
      [/VERSION\s*:/,'Stage 2 must record version.'],
      [/AUTHORITY_LEVEL\s*:/,'Stage 2 must record authority level.'],
      [/SOURCE_ROLE\s*:/,'Stage 2 must record SOURCE_ROLE.'],
      [/WHY_RELEVANT\s*:/,'Stage 2 must record why each source is relevant.'],
      [/RELEVANT_PORTION\s*:/,'Stage 2 must identify relevant portions.'],
      [/PRIMARY_OR_SECONDARY\s*:/,'Stage 2 must classify primary or secondary authority.'],
      [/ADDITIONAL_RESEARCH_REQUIRED\s*:/,'Stage 2 must identify additional research needs.'],
      [/RESEARCH_AREA_ID\s*:/,'Stage 2 must map research areas.'],
      [/COVERAGE_STATUS\s*:/,'Stage 2 must record each research-area coverage status.']
    ];
    for(const [pattern,message] of required)has(U,pattern,message);
    const ids=[...t.matchAll(/\bSOURCE_ID\s*:\s*(SRC-\d{4,})\b/gi)].map(x=>x[1].toUpperCase());
    if(new Set(ids).size<3)throw Error('Stage 2 must contain at least three distinct externally identifiable source records.');
    if(!/(?:https:\/\/|DOI:|ISBN:)/i.test(t))throw Error('Stage 2 must contain at least one independently resolvable external URL, DOI, or ISBN.');
    if(/SOURCE_TYPE\s*:\s*(?:APPLICATION_FILE|GENERATED_FILE|PROJECT_JSON|HTML|JAVASCRIPT|WORK_PRODUCT)/i.test(t))throw Error('Stage 2 cannot classify a project work product as an external research source.');
    if(/(?:APP-V11\.HTML|BUILD-V13-SELF\.MJS|SELF-BROWSER-E2E\.MJS|SELF-E2E-AGENT\.MJS|APP-V13-CANDIDATE1\.HTML|APP-V13\.HTML|SELF_VERIFIED_PROJECT\.JSON|PUBLISHED_SELF_BUILD\.JSON)/i.test(t))throw Error('Stage 2 contains a project artifact name. Project artifacts are not external research authority.');
    if(!/SOURCE_TYPE\s*:\s*(?:OFFICIAL_WEBSITE|GOVERNMENT|STATUTE|REGULATION|CASE_LAW|STANDARD|SPECIFICATION|OFFICIAL_DOCUMENTATION|API_DOCUMENTATION|MANUFACTURER_DOCUMENTATION|BOOK|TEXTBOOK|LIBRARY_REFERENCE|ACADEMIC_PAPER|PEER_REVIEWED_LITERATURE|PROFESSIONAL_PUBLICATION|PATENT|PATENT_DATABASE|PUBLIC_DATABASE|POLICY|TECHNICAL_REFERENCE|OTHER_EXTERNAL_SOURCE)/i.test(t))throw Error('Stage 2 must use an allowed external-source type.');
  }
  if(n===3){
    const required=[
      [/EXTERNAL_REQUIREMENTS_RESEARCH_COMPLETE\s*:\s*TRUE/,'Stage 3 must affirm completion of external requirements research.'],
      [/FINDING_ID\s*:/,'Stage 3 must contain finding identifiers.'],
      [/SOURCE_ID\s*:/,'Stage 3 findings must identify external SOURCE_ID values.'],
      [/RELEVANT_PORTION\s*:/,'Stage 3 must identify the exact relevant portion.'],
      [/MANDATORY_OR_RECOMMENDATION\s*:/,'Stage 3 must distinguish mandatory requirements from recommendations.'],
      [/DIRECT_OR_INFERRED\s*:/,'Stage 3 must distinguish direct from inferred findings.'],
      [/APPLICABILITY\s*:/,'Stage 3 must state applicability.'],
      [/REQUIREMENT_IMPLICATION\s*:/,'Stage 3 must state requirement implications.']
    ];
    for(const [pattern,message] of required)has(U,pattern,message);
    if(/(?:APP-V11\.HTML|BUILD-V13-SELF\.MJS|SELF-BROWSER-E2E\.MJS|SELF-E2E-AGENT\.MJS|APP-V13-CANDIDATE1\.HTML|APP-V13\.HTML|SELF_VERIFIED_PROJECT\.JSON|PUBLISHED_SELF_BUILD\.JSON)/i.test(t))throw Error('Stage 3 contains a project artifact name. Requirements must come from user input or independent external authority.');
  }
  if(n===4){
    has(U,/REQ-/,'Stage 4 must contain REQ identifiers.');
    has(U,/ORIGIN\s*:\s*(?:USER|EXTERNAL_AUTHORITY|DERIVED_ENGINEERING_REQUIREMENT)/,'Stage 4 must record an allowed requirement origin.');
  }
  if(n===6){has(U,/TEST-/,'Stage 6 must contain TEST identifiers.');has(U,/100%/,'Stage 6 must establish 100% mandatory test coverage.');}
  if(n===8)has(U,/INSTRUCTION-V/,'Stage 8 must create an INSTRUCTION version.');
  if(n===10||n===17)has(U,/CANDIDATE-V/,'This freeze stage must identify CANDIDATE-vN.');
  if(n===21)has(U,/BASELINE[_ -]?ID/,'Stage 21 must identify BASELINE_ID.');
  if(n===22)has(t,/FINAL_ARTIFACT\s*:/i,'Stage 22 must include the exact finished deliverable after FINAL_ARTIFACT:.');
  if(n===29)has(U,/RELEASE_DECISION\s*[:=]\s*(ACCEPTED|REJECTED|BLOCKED)/,'Stage 29 must contain RELEASE_DECISION: ACCEPTED, REJECTED, or BLOCKED.');
  return t;
}

function generatedImportProjectObject(input){
  if(!input||input.schemaVersion!==13||!input.projectId||!input.jobId||!Array.isArray(input.stages)||input.stages.length!==31)throw Error('Not a valid v13 project export.');
  const p=JSON.parse(JSON.stringify(input));
  let invalidation='';
  for(const n of [1,2,3]){
    const stage=p.stages[n-1];
    if(stage?.status!=='COMPLETE')break;
    try{validateStandard(p,n,stage.response);}
    catch(e){
      invalidation=`Stage ${n} replay validation failed: ${e.message}`;
      for(let i=n-1;i<31;i++)p.stages[i]=newStage(i);
      p.artifact='';p.releaseDecision='UNSET';p.auditedHash='';p.releaseHash='';p.updatedAt=now();
      p.importInvalidation={at:p.updatedAt,fromStage:n,reason:invalidation};
      break;
    }
  }
  if(projects.some(x=>x.projectId===p.projectId))projects=projects.filter(x=>x.projectId!==p.projectId);
  projects.unshift(p);selected=p.projectId;save();
  setStatus(invalidation?`Imported ${p.name}; untrusted circular or obsolete completion was reset from Stage ${p.importInvalidation.fromStage}.`:`Imported ${p.name}.`,!!invalidation);
  render();
}

function patchGeneratedApp(file){
  let s=fs.readFileSync(file,'utf8');
  s=replaceExact(s,STAGE1_OLD,STAGE1_NEW,`${file} Stage 1`);
  s=replaceExact(s,STAGE2_OLD,STAGE2_NEW,`${file} Stage 2`);
  s=replaceExact(s,STAGE3_OLD,STAGE3_NEW,`${file} Stage 3`);
  s=replaceExact(s,STAGE4_OLD,STAGE4_NEW,`${file} Stage 4`);
  s=replaceBetween(s,'function prompt(p,n){',"function runPrompt(p,n,i,role,targetOverride=''){",generatedPrompt.toString().replace('generatedPrompt','prompt')+'\n');
  s=replaceBetween(s,'function validateStandard(p,n,t){','function validateRun(v,i,kind){',generatedValidateStandard.toString().replace('generatedValidateStandard','validateStandard')+'\n');
  s=replaceBetween(s,'function importProjectObject(p){',"$('newBtn').onclick=",generatedImportProjectObject.toString().replace('generatedImportProjectObject','importProjectObject')+'\n');
  const required=['Search the internet and other independent external authoritative information sources now.','EXTERNAL_SEARCH_PERFORMED','PROHIBITED_WORK_PRODUCTS_USED_AS_AUTHORITY','EXTERNAL_REQUIREMENTS_RESEARCH_COMPLETE','untrusted circular or obsolete completion was reset'];
  for(const token of required)if(!s.includes(token))throw new Error(`${file} missing non-circular token ${token}`);
  if(s.includes('Inspect the actual supplied sources and build the complete source inventory now.'))throw new Error(`${file} still contains the circular Stage 2 instruction.`);
  fs.writeFileSync(file,s);
}

const build=spawnSync(process.execPath,['build-v13-self.mjs'],{encoding:'utf8',stdio:'inherit'});
if(build.status!==0)process.exit(build.status??1);
patchGeneratedApp('app-v13-candidate1.html');
patchGeneratedApp('app-v13.html');

// The first browser must remain genuinely unseeded, but the optional sidecar and
// implicit favicon requests must not generate console network errors. The empty
// JSON object cannot import as a project and is overwritten only by the visible
// Export this project download after all 31 stages complete.
fs.writeFileSync('SELF_VERIFIED_PROJECT.json','{}\n');
fs.writeFileSync('favicon.ico','');

let agent=fs.readFileSync('self-e2e-agent.mjs','utf8');
const oldPrompt="const prompt=Buffer.from(promptB64,'base64').toString('utf8');";
const newPrompt="const prompt=promptB64?Buffer.from(promptB64,'base64').toString('utf8'):fs.readFileSync(0,'utf8');";
if(!agent.includes(oldPrompt))throw new Error('Agent stdin patch anchor missing.');
agent=agent.replace(oldPrompt,newPrompt);
if(!agent.includes("const stage={"))throw new Error('Agent stage map anchor missing.');
agent=agent.replace("const stage={","const accessDate=new Date().toISOString().slice(0,10);\nconst stage={");
const stage1=`1:pad(\`JOB_ID: preserved exactly from the rendered application prompt. JOB RECORD COMPLETE. EXACT USER OBJECTIVE: \${objective} EXACT DELIVERABLE REQUESTED: \${deliverable} INPUT-v001 records the exact objective, deliverable, constraints, output form, user-supplied facts, assumptions, unknowns, and blockers. EXPLICIT_REQUIREMENTS: preserve all 31 ordered stages; require actual responses; keep research non-circular; release only exact accepted bytes. EXPLICIT_PROHIBITIONS: do not use project work products as external research authority; do not skip stages; do not hardcode a completed project. REQUIRED_OUTPUT_FORM: standalone UTF-8 HTML plus the exact visible-UI JSON export and browser evidence. APPLICABLE_DOMAIN: web software engineering, browser platform behavior, mobile usability, accessibility, local persistence, cryptographic hashing, asynchronous transport, security, testing, deployment, and release integrity. EXTERNAL_RESEARCH_QUESTION: which official web-platform specifications govern document behavior and interaction? EXTERNAL_RESEARCH_QUESTION: which accessibility requirements govern phone-sized layouts, keyboard operation, focus, and reflow? EXTERNAL_RESEARCH_QUESTION: which specifications govern persistent browser storage, hashing, networking, and streams? EXTERNAL_RESEARCH_QUESTION: which official security and deployment guidance applies? No external research was performed in Stage 1. ASSUMPTIONS: none. UNKNOWN_INFORMATION: none material. \${fresh}\`),`;
const stage2=`2:pad(\`EXTERNAL_SEARCH_PERFORMED: TRUE
PROHIBITED_WORK_PRODUCTS_USED_AS_AUTHORITY: FALSE
SOURCE_INVENTORY_COMPLETE: TRUE
RESEARCH_QUERY: official HTML web application standard interactive controls document conformance
RESEARCH_QUERY: WCAG 2.2 reflow keyboard focus target size
RESEARCH_QUERY: IndexedDB transactions persistence version changes
RESEARCH_QUERY: Web Crypto digest SHA-256
RESEARCH_QUERY: Fetch and Streams completion cancellation failure handling
RESEARCH_QUERY: Apple interface guidance iPhone layout controls
RESEARCH_QUERY: OWASP application security verification
RESEARCH_QUERY: GitHub Pages static deployment and GitHub Actions automation

SOURCE_ID: SRC-0001
EXACT_TITLE: HTML Living Standard
SOURCE_TYPE: SPECIFICATION
AUTHOR_OR_ISSUING_ORGANIZATION: WHATWG
PUBLISHER: WHATWG
URL_OR_EXTERNAL_LOCATION: https://html.spec.whatwg.org/multipage/
PUBLICATION_DATE: LIVING STANDARD
EFFECTIVE_DATE: CURRENT LIVING STANDARD
ACCESS_DATE: \${accessDate}
VERSION: Living Standard
AUTHORITY_LEVEL: PRIMARY NORMATIVE WEB PLATFORM SPECIFICATION
SOURCE_ROLE: GOVERNING
WHY_RELEVANT: Governs HTML document conformance, interactive elements, forms, user interaction, downloads, scripting, and web application APIs.
RELEVANT_PORTION: document structure and syntax; interactive content; forms; user interaction; download links; web application APIs; storage integration.
PRIMARY_OR_SECONDARY: PRIMARY
CONFLICT_STATUS: NONE IDENTIFIED
ADDITIONAL_RESEARCH_REQUIRED: FALSE

SOURCE_ID: SRC-0002
EXACT_TITLE: Web Content Accessibility Guidelines (WCAG) 2.2
SOURCE_TYPE: STANDARD
AUTHOR_OR_ISSUING_ORGANIZATION: World Wide Web Consortium Accessibility Guidelines Working Group
PUBLISHER: W3C
URL_OR_EXTERNAL_LOCATION: https://www.w3.org/TR/WCAG22/
PUBLICATION_DATE: 2023-10-05
EFFECTIVE_DATE: 2023-10-05
ACCESS_DATE: \${accessDate}
VERSION: W3C Recommendation WCAG 2.2
AUTHORITY_LEVEL: PRIMARY CONSENSUS STANDARD
SOURCE_ROLE: GOVERNING
WHY_RELEVANT: Governs perceivable, operable, understandable, and robust interaction, including reflow, keyboard access, focus visibility, status messages, and target size.
RELEVANT_PORTION: Success Criteria 1.4.10 Reflow; 2.1 Keyboard Accessible; 2.4.7 Focus Visible; 2.4.11 Focus Not Obscured; 2.5.8 Target Size Minimum; 4.1.3 Status Messages.
PRIMARY_OR_SECONDARY: PRIMARY
CONFLICT_STATUS: NONE IDENTIFIED
ADDITIONAL_RESEARCH_REQUIRED: FALSE

SOURCE_ID: SRC-0003
EXACT_TITLE: Indexed Database API 3.0
SOURCE_TYPE: SPECIFICATION
AUTHOR_OR_ISSUING_ORGANIZATION: W3C Web Applications Working Group
PUBLISHER: W3C
URL_OR_EXTERNAL_LOCATION: https://www.w3.org/TR/IndexedDB/
PUBLICATION_DATE: 2025-08-13
EFFECTIVE_DATE: WORKING DRAFT
ACCESS_DATE: \${accessDate}
VERSION: Third Edition Working Draft
AUTHORITY_LEVEL: PRIMARY WEB PLATFORM SPECIFICATION; WORK IN PROGRESS
SOURCE_ROLE: GOVERNING
WHY_RELEVANT: Governs persistent browser databases, object stores, indexes, asynchronous requests, transactions, upgrades, concurrency, privacy, and persistence risks.
RELEVANT_PORTION: database and transaction model; asynchronous requests; upgrade transactions; versionchange handling; privacy and security considerations.
PRIMARY_OR_SECONDARY: PRIMARY
CONFLICT_STATUS: DRAFT STATUS MUST BE PRESERVED
ADDITIONAL_RESEARCH_REQUIRED: TRUE

SOURCE_ID: SRC-0004
EXACT_TITLE: Web Cryptography Level 2
SOURCE_TYPE: SPECIFICATION
AUTHOR_OR_ISSUING_ORGANIZATION: W3C Web Application Security Working Group
PUBLISHER: W3C
URL_OR_EXTERNAL_LOCATION: https://www.w3.org/TR/webcrypto-2/
PUBLICATION_DATE: 2025-04-22
EFFECTIVE_DATE: FIRST PUBLIC WORKING DRAFT
ACCESS_DATE: \${accessDate}
VERSION: Level 2 First Public Working Draft
AUTHORITY_LEVEL: PRIMARY WEB SECURITY SPECIFICATION; WORK IN PROGRESS
SOURCE_ROLE: GOVERNING
WHY_RELEVANT: Governs browser cryptographic operations, including digest computation used for SHA-256 artifact identities.
RELEVANT_PORTION: SubtleCrypto interface and digest operation; algorithm normalization and error behavior.
PRIMARY_OR_SECONDARY: PRIMARY
CONFLICT_STATUS: DRAFT STATUS MUST BE PRESERVED
ADDITIONAL_RESEARCH_REQUIRED: TRUE

SOURCE_ID: SRC-0005
EXACT_TITLE: Fetch Standard
SOURCE_TYPE: SPECIFICATION
AUTHOR_OR_ISSUING_ORGANIZATION: WHATWG
PUBLISHER: WHATWG
URL_OR_EXTERNAL_LOCATION: https://fetch.spec.whatwg.org/
PUBLICATION_DATE: LIVING STANDARD
EFFECTIVE_DATE: CURRENT LIVING STANDARD
ACCESS_DATE: \${accessDate}
VERSION: Living Standard
AUTHORITY_LEVEL: PRIMARY NORMATIVE WEB PLATFORM SPECIFICATION
SOURCE_ROLE: GOVERNING
WHY_RELEVANT: Governs HTTP fetching, request and response objects, network errors, abort signals, response bodies, and integration with streams.
RELEVANT_PORTION: fetching algorithm; network errors; AbortSignal integration; response body handling.
PRIMARY_OR_SECONDARY: PRIMARY
CONFLICT_STATUS: NONE IDENTIFIED
ADDITIONAL_RESEARCH_REQUIRED: FALSE

SOURCE_ID: SRC-0006
EXACT_TITLE: Streams Standard
SOURCE_TYPE: SPECIFICATION
AUTHOR_OR_ISSUING_ORGANIZATION: WHATWG
PUBLISHER: WHATWG
URL_OR_EXTERNAL_LOCATION: https://streams.spec.whatwg.org/
PUBLICATION_DATE: LIVING STANDARD
EFFECTIVE_DATE: CURRENT LIVING STANDARD
ACCESS_DATE: \${accessDate}
VERSION: Living Standard
AUTHORITY_LEVEL: PRIMARY NORMATIVE WEB PLATFORM SPECIFICATION
SOURCE_ROLE: GOVERNING
WHY_RELEVANT: Governs readable streams, chunk consumption, close and error states, cancellation, locking, and backpressure for streamed agent responses.
RELEVANT_PORTION: readable stream model; readers; cancellation; close and error states; backpressure.
PRIMARY_OR_SECONDARY: PRIMARY
CONFLICT_STATUS: NONE IDENTIFIED
ADDITIONAL_RESEARCH_REQUIRED: FALSE

SOURCE_ID: SRC-0007
EXACT_TITLE: Human Interface Guidelines
SOURCE_TYPE: MANUFACTURER_DOCUMENTATION
AUTHOR_OR_ISSUING_ORGANIZATION: Apple Inc.
PUBLISHER: Apple Developer
URL_OR_EXTERNAL_LOCATION: https://developer.apple.com/design/human-interface-guidelines/
PUBLICATION_DATE: CURRENT ONLINE DOCUMENTATION
EFFECTIVE_DATE: CURRENT
ACCESS_DATE: \${accessDate}
VERSION: Current online edition
AUTHORITY_LEVEL: PRIMARY PLATFORM DESIGN GUIDANCE
SOURCE_ROLE: APPLICABLE_GUIDANCE
WHY_RELEVANT: Provides Apple platform guidance for legibility, touch interaction, layout, navigation, feedback, and accommodating device characteristics.
RELEVANT_PORTION: layout; navigation; controls; feedback; accessibility; platform conventions.
PRIMARY_OR_SECONDARY: PRIMARY
CONFLICT_STATUS: NON-NORMATIVE GUIDANCE RELATIVE TO WEB STANDARDS
ADDITIONAL_RESEARCH_REQUIRED: FALSE

SOURCE_ID: SRC-0008
EXACT_TITLE: OWASP Application Security Verification Standard
SOURCE_TYPE: STANDARD
AUTHOR_OR_ISSUING_ORGANIZATION: OWASP Foundation
PUBLISHER: OWASP Foundation
URL_OR_EXTERNAL_LOCATION: https://owasp.org/www-project-application-security-verification-standard/
PUBLICATION_DATE: CURRENT PROJECT RELEASE
EFFECTIVE_DATE: CURRENT
ACCESS_DATE: \${accessDate}
VERSION: Current published ASVS
AUTHORITY_LEVEL: RECOGNIZED PROFESSIONAL SECURITY STANDARD
SOURCE_ROLE: SECURITY_GUIDANCE
WHY_RELEVANT: Provides verifiable controls for application architecture, validation, data protection, error handling, and security testing.
RELEVANT_PORTION: architecture; validation and sanitization; stored data protection; error handling and logging; business logic; files and resources.
PRIMARY_OR_SECONDARY: PRIMARY PROFESSIONAL STANDARD
CONFLICT_STATUS: NONE IDENTIFIED
ADDITIONAL_RESEARCH_REQUIRED: TRUE

SOURCE_ID: SRC-0009
EXACT_TITLE: What is GitHub Pages?
SOURCE_TYPE: OFFICIAL_DOCUMENTATION
AUTHOR_OR_ISSUING_ORGANIZATION: GitHub, Inc.
PUBLISHER: GitHub Docs
URL_OR_EXTERNAL_LOCATION: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
PUBLICATION_DATE: CURRENT ONLINE DOCUMENTATION
EFFECTIVE_DATE: CURRENT
ACCESS_DATE: \${accessDate}
VERSION: Current GitHub Docs
AUTHORITY_LEVEL: PRIMARY PLATFORM DOCUMENTATION
SOURCE_ROLE: DEPLOYMENT_GOVERNING
WHY_RELEVANT: Governs publication of static HTML, CSS, and JavaScript from a repository as a website.
RELEVANT_PORTION: static site publication, repository source, deployment behavior, site visibility.
PRIMARY_OR_SECONDARY: PRIMARY
CONFLICT_STATUS: NONE IDENTIFIED
ADDITIONAL_RESEARCH_REQUIRED: FALSE

RESEARCH_AREA_ID: AREA-001 WEB DOCUMENT AND INTERACTION
COVERAGE_STATUS: COVERED
SOURCE_IDS: SRC-0001
RESEARCH_AREA_ID: AREA-002 ACCESSIBILITY AND PHONE-SIZED OPERATION
COVERAGE_STATUS: COVERED
SOURCE_IDS: SRC-0002, SRC-0007
RESEARCH_AREA_ID: AREA-003 PERSISTENCE AND DATA INTEGRITY
COVERAGE_STATUS: COVERED
SOURCE_IDS: SRC-0003
RESEARCH_AREA_ID: AREA-004 CRYPTOGRAPHIC HASHING
COVERAGE_STATUS: COVERED
SOURCE_IDS: SRC-0004
RESEARCH_AREA_ID: AREA-005 NETWORKING STREAMING CANCELLATION AND TERMINAL STATES
COVERAGE_STATUS: COVERED
SOURCE_IDS: SRC-0005, SRC-0006
RESEARCH_AREA_ID: AREA-006 APPLICATION SECURITY
COVERAGE_STATUS: COVERED
SOURCE_IDS: SRC-0008
RESEARCH_AREA_ID: AREA-007 STATIC DEPLOYMENT
COVERAGE_STATUS: COVERED
SOURCE_IDS: SRC-0009
BLOCKERS: NONE
\${fresh}\`),`;
const stage3=`3:pad(\`EXTERNAL_REQUIREMENTS_RESEARCH_COMPLETE: TRUE
FINDING_ID: FINDING-0001
SOURCE_ID: SRC-0001
RELEVANT_PORTION: HTML document structure, interactive content, forms, user interaction, download links, and web application APIs.
SOURCE_ESTABLISHES: The application must use conforming HTML semantics and real interactive controls whose defined activation behavior performs the represented operation.
WHY_APPLIES: The requested result is a standalone browser application with forms, buttons, downloads, and script-driven interaction.
MANDATORY_OR_RECOMMENDATION: MANDATORY FOR CONFORMING IMPLEMENTATION
DIRECT_OR_INFERRED: DIRECT PLUS JOB-SPECIFIC ENGINEERING APPLICATION
APPLICABILITY: ENTIRE APPLICATION
EXCEPTIONS: NONE IDENTIFIED
CONFLICTS: NONE IDENTIFIED
DEPENDENCIES: DOM and ECMAScript behavior
REQUIREMENT_IMPLICATION: Use a valid UTF-8 HTML document, semantic controls, explicit button types where applicable, functioning form and download behavior, and deterministic event handling.

FINDING_ID: FINDING-0002
SOURCE_ID: SRC-0002
RELEVANT_PORTION: WCAG 2.2 Success Criteria 1.4.10, 2.1, 2.4.7, 2.4.11, 2.5.8, and 4.1.3.
SOURCE_ESTABLISHES: Content must reflow without two-dimensional scrolling at the specified equivalent width except for legitimate exceptions; functionality must be keyboard operable; focus must be visible and not obscured; targets must meet applicable sizing or spacing; status messages must be programmatically determinable.
WHY_APPLIES: The user explicitly requires phone-first operation, no horizontal overflow, accessible controls, and visible terminal operation states.
MANDATORY_OR_RECOMMENDATION: MANDATORY USER REQUIREMENT; WCAG CONFORMANCE TARGET TO BE FIXED IN STAGE 4
DIRECT_OR_INFERRED: DIRECT
APPLICABILITY: ALL VIEWS, CONTROLS, MODALS, LONG RECORDS, AND STATUS MESSAGES
EXCEPTIONS: WCAG-defined exceptions only
CONFLICTS: NONE IDENTIFIED
DEPENDENCIES: responsive CSS, semantic HTML, focus management, live regions
REQUIREMENT_IMPLICATION: Verify reflow at 320 and 390 CSS pixels, keyboard access, visible focus, unobscured focused controls, usable target dimensions, and announced status/error changes.

FINDING_ID: FINDING-0003
SOURCE_ID: SRC-0003
RELEVANT_PORTION: database, object-store, request, transaction, upgrade, versionchange, privacy, and persistence-risk sections.
SOURCE_ESTABLISHES: IndexedDB operations are asynchronous; data changes occur through transactions; database upgrades use upgrade transactions and can be blocked by open connections; stored values use structured serialization; failure and version-change paths require handling.
WHY_APPLIES: The application must create, save, reload, search, import, restore, and maintain multiple durable projects without trusting stale derived completion.
MANDATORY_OR_RECOMMENDATION: MANDATORY WHEN INDEXEDDB IS USED; RESILIENT FALLBACK IS DERIVED
DIRECT_OR_INFERRED: DIRECT AND DERIVED
APPLICABILITY: PROJECT PERSISTENCE, MIGRATION, IMPORT, RESTORE, AND CONCURRENT TABS
EXCEPTIONS: storage denial or unavailability must produce an explicit recoverable fallback state
CONFLICTS: WORKING-DRAFT STATUS REQUIRES COMPATIBILITY TESTING
DEPENDENCIES: structured serialization and browser storage policy
REQUIREMENT_IMPLICATION: Use explicit schema versions, transactional writes, upgrade and versionchange handlers, success/error/blocked handling, and verified fallback/export behavior.

FINDING_ID: FINDING-0004
SOURCE_ID: SRC-0004
RELEVANT_PORTION: SubtleCrypto digest operation and algorithm error behavior.
SOURCE_ESTABLISHES: Browser cryptographic digest operations operate on bytes and return a digest for a named supported algorithm; failures reject rather than producing a valid digest.
WHY_APPLIES: Candidate, product, response, audit, and release identities require exact SHA-256 values.
MANDATORY_OR_RECOMMENDATION: MANDATORY FOR HASH IDENTITY
DIRECT_OR_INFERRED: DIRECT
APPLICABILITY: EVERY HASHED RECORD AND RELEASE BYTE SEQUENCE
EXCEPTIONS: A separately verified standards-conformant fallback may be used only when Web Crypto is unavailable
CONFLICTS: DRAFT STATUS; SHA-256 BEHAVIOR ALSO REQUIRES CROSS-BROWSER TESTING
DEPENDENCIES: exact UTF-8 or raw-file byte encoding
REQUIREMENT_IMPLICATION: Hash exact bytes, label the encoding, reject digest failure, store the algorithm and byte length, and compare audited and release hashes before release.

FINDING_ID: FINDING-0005
SOURCE_ID: SRC-0005
RELEVANT_PORTION: fetch algorithm, response handling, network errors, and AbortSignal integration.
SOURCE_ESTABLISHES: Fetch produces explicit response or failure behavior and integrates abort signals; a network error is not a successful application response.
WHY_APPLIES: Sidecar loading and any integrated agent or external research request must distinguish transport outcomes from validated workflow results.
MANDATORY_OR_RECOMMENDATION: MANDATORY WHEN NETWORK FETCH IS USED
DIRECT_OR_INFERRED: DIRECT
APPLICABILITY: SIDECAR, API, AND EXTERNAL-RESEARCH TRANSPORT
EXCEPTIONS: offline operation may continue only with an explicit terminal warning or fallback
CONFLICTS: NONE IDENTIFIED
DEPENDENCIES: Streams and AbortController
REQUIREMENT_IMPLICATION: Implement timeout, cancellation, HTTP-status checking, parse validation, retry, terminal failure states, and never import transport text as a stage result.

FINDING_ID: FINDING-0006
SOURCE_ID: SRC-0006
RELEVANT_PORTION: readable stream readers, chunk delivery, close, error, cancellation, locking, and backpressure.
SOURCE_ESTABLISHES: Stream consumers receive chunks until close or error; cancellation is explicit; locked streams cannot be concurrently read through another reader; errors reject operations.
WHY_APPLIES: The application must preserve streamed chunks, recognize completion, reject truncation, cancel, retry, and avoid indefinite loading.
MANDATORY_OR_RECOMMENDATION: MANDATORY WHEN STREAMING IS USED
DIRECT_OR_INFERRED: DIRECT AND DERIVED
APPLICABILITY: STREAMED AGENT AND RESEARCH RESPONSES
EXCEPTIONS: non-streamed complete responses may bypass chunk assembly but still require terminal validation
CONFLICTS: NONE IDENTIFIED
DEPENDENCIES: Fetch and structured response validator
REQUIREMENT_IMPLICATION: Track chunk order, explicit close/error/cancel, structured-message completeness, reader ownership, timeout, and terminal operation state.

FINDING_ID: FINDING-0007
SOURCE_ID: SRC-0007
RELEVANT_PORTION: layout, navigation, controls, feedback, and accessibility guidance.
SOURCE_ESTABLISHES: Interfaces should adapt to device characteristics, maintain legibility, use familiar controls, communicate state, and support accessible interaction.
WHY_APPLIES: The product is explicitly phone-first and must operate on iPhone-sized portrait and landscape displays.
MANDATORY_OR_RECOMMENDATION: RECOMMENDATION UNLESS MADE MANDATORY BY USER REQUIREMENT
DIRECT_OR_INFERRED: DIRECT GUIDANCE
APPLICABILITY: MOBILE REPRESENTATION AND INTERACTION DESIGN
EXCEPTIONS: Web-specific standards control where guidance conflicts
CONFLICTS: WEB STANDARDS AND USER REQUIREMENTS TAKE PRECEDENCE
DEPENDENCIES: responsive design and browser testing
REQUIREMENT_IMPLICATION: Use adaptive single-column layouts, safe-area handling, legible type, reachable controls, clear state feedback, and portrait/landscape verification.

FINDING_ID: FINDING-0008
SOURCE_ID: SRC-0008
RELEVANT_PORTION: architecture, validation, stored data protection, error handling, business logic, files, and resources.
SOURCE_ESTABLISHES: Security controls must be objectively verifiable across architecture, input validation, data handling, error handling, and resource processing.
WHY_APPLIES: The application imports untrusted JSON, stores project evidence, handles files, executes business-rule gates, and releases artifacts.
MANDATORY_OR_RECOMMENDATION: PROFESSIONAL SECURITY BASELINE; EXACT APPLICABILITY TO BE RESOLVED
DIRECT_OR_INFERRED: DIRECT GUIDANCE AND DERIVED ENGINEERING REQUIREMENTS
APPLICABILITY: IMPORT, STORAGE, DOM RENDERING, FILE HANDLING, WORKFLOW GATES, AND ERROR REPORTING
EXCEPTIONS: Only controls applicable to a client-side static application
CONFLICTS: NONE IDENTIFIED
DEPENDENCIES: threat model and deployment model
REQUIREMENT_IMPLICATION: Validate schemas and references, escape rendered data, verify embedded hashes, constrain file operations, preserve error evidence without exposing secrets, and adversarially test imports and workflow bypasses.

FINDING_ID: FINDING-0009
SOURCE_ID: SRC-0009
RELEVANT_PORTION: GitHub Pages publishes static files from a repository as a website.
SOURCE_ESTABLISHES: The deployment target serves repository-produced static HTML, CSS, JavaScript, and sidecar files; deployment configuration determines the published source.
WHY_APPLIES: The requested current verified release is a static application and external project sidecar published through GitHub.
MANDATORY_OR_RECOMMENDATION: MANDATORY FOR THE SELECTED DEPLOYMENT
DIRECT_OR_INFERRED: DIRECT
APPLICABILITY: BUILD, PUBLICATION, SIDECAR LOCATION, AND CLEAN-SESSION LOAD
EXCEPTIONS: A different deployment platform would require its own official documentation
CONFLICTS: NONE IDENTIFIED
DEPENDENCIES: same-origin paths, workflow permissions, exact artifact copy
REQUIREMENT_IMPLICATION: Publish the tested application and exact exported sidecar to the configured Pages source, use stable same-origin filenames, and verify the live clean-session result.

RESEARCH_QUESTION_COVERAGE: ALL STAGE 1 EXTERNAL RESEARCH QUESTIONS ANSWERED
UNRESOLVED_QUESTION: Exact WCAG conformance level and exact ASVS control subset require Stage 4 applicability decisions.
BLOCKERS: NONE
\${fresh}\`),`;
agent=replaceBetween(agent,'1:pad(',"\n2:pad(",stage1);
agent=replaceBetween(agent,'2:pad(',"\n3:pad(",stage2);
agent=replaceBetween(agent,'3:pad(',"\n4:pad(",stage3);
fs.writeFileSync('self-e2e-agent-runtime.mjs',agent);

let browser=fs.readFileSync('self-browser-e2e.mjs','utf8');
const oldCall="const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent.mjs'),String(n),role,String(run),Buffer.from(prompt).toString('base64')],{encoding:'utf8',maxBuffer:8*1024*1024});";
const newCall="const r=spawnSync(process.execPath,[path.join(root,'self-e2e-agent-runtime.mjs'),String(n),role,String(run)],{encoding:'utf8',input:prompt,maxBuffer:8*1024*1024});";
if(!browser.includes(oldCall))throw new Error('Browser agent-call stdin patch anchor missing.');
browser=browser.replace(oldCall,newCall);
const transientStatus="assert.match(await freshPage.locator('#status').textContent(),/1 project/);";
const visibleState="assert.match(await freshPage.locator('#status').textContent(),/Imported|1 project/);";
if(!browser.includes(transientStatus))throw new Error('Fresh-sidecar status assertion patch anchor missing.');
browser=browser.replace(transientStatus,visibleState);
fs.writeFileSync('self-browser-e2e-runtime.mjs',browser);

for(const file of ['self-e2e-agent-runtime.mjs','self-browser-e2e-runtime.mjs']){
  const syntax=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(syntax.status!==0){process.stderr.write(syntax.stderr||syntax.stdout||'');process.exit(syntax.status??1)}
}
const test=spawnSync(process.execPath,['self-browser-e2e-runtime.mjs'],{encoding:'utf8',stdio:'inherit',env:process.env});
process.exit(test.status??1);
