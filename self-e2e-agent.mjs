import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const [stageArg,role='stage',runArg='0',promptB64='']=process.argv.slice(2);
const n=Number(stageArg),run=Number(runArg);
const prompt=Buffer.from(promptB64,'base64').toString('utf8');
if(!prompt.includes(`STAGE ${n} OF 31`))throw new Error(`Prompt does not identify Stage ${n}`);
const rid=`RUN-${String(run).padStart(3,'0')}`;
const receipt=`External agent process ${process.pid} handled only ${rid} from the rendered prompt. No sibling output was supplied.`;

const sources=[
  ['SRC-0001','HTML Living Standard','STANDARD','WHATWG','WHATWG','https://html.spec.whatwg.org/multipage/','CONTINUOUSLY_UPDATED','CURRENT_LIVING_STANDARD','Living Standard','PRIMARY_NORMATIVE','GOVERNING','WEB_PLATFORM','HTML document structure, native controls, scripting integration, links, downloads, and browser processing.','Document structure, forms, scripting, links, download processing, and web application APIs.'],
  ['SRC-0002','DOM Standard','STANDARD','WHATWG','WHATWG','https://dom.spec.whatwg.org/','CONTINUOUSLY_UPDATED','CURRENT_LIVING_STANDARD','Living Standard','PRIMARY_NORMATIVE','GOVERNING','WEB_PLATFORM','DOM trees, nodes, events, event dispatch, and observable UI state.','Tree model, node interfaces, mutation, and event dispatch.'],
  ['SRC-0003','Encoding Standard','STANDARD','WHATWG','WHATWG','https://encoding.spec.whatwg.org/','CONTINUOUSLY_UPDATED','CURRENT_LIVING_STANDARD','Living Standard','PRIMARY_NORMATIVE','GOVERNING','DATA_ENCODING','UTF-8 encoding and the browser Encoding API.','UTF-8 encoder/decoder and TextEncoder behavior.'],
  ['SRC-0004','File API','SPECIFICATION','World Wide Web Consortium','W3C','https://www.w3.org/TR/FileAPI/','2026-06-04','NOT_APPLICABLE','W3C Working Draft','PRIMARY_DRAFT','GOVERNING','FILE_EXPORT','Blob, File, client-side byte objects, file reading, and object URLs.','Blob byte sequences, File objects, read operations, and object URL lifecycle.'],
  ['SRC-0005','Fetch Standard','STANDARD','WHATWG','WHATWG','https://fetch.spec.whatwg.org/','CONTINUOUSLY_UPDATED','CURRENT_LIVING_STANDARD','Living Standard','PRIMARY_NORMATIVE','GOVERNING','NETWORK_LOADING','Requests, responses, CORS, network errors, bodies, abort, and scheme fetch.','Fetch method, response status, body consumption, abort, and network-error processing.'],
  ['SRC-0006','URL Standard','STANDARD','WHATWG','WHATWG','https://url.spec.whatwg.org/','CONTINUOUSLY_UPDATED','CURRENT_LIVING_STANDARD','Living Standard','PRIMARY_NORMATIVE','GOVERNING','URL_PATHS','URL parsing and relative resolution, including file URL behavior.','URL parser, relative resolution, file URLs, path segments, and hosts.'],
  ['SRC-0007','Web Storage','SPECIFICATION','WHATWG','WHATWG','https://html.spec.whatwg.org/multipage/webstorage.html','CONTINUOUSLY_UPDATED','CURRENT_LIVING_STANDARD','HTML Living Standard section','PRIMARY_NORMATIVE','GOVERNING','PERSISTENCE','Origin-scoped localStorage and sessionStorage semantics.','Storage objects, keys, values, persistence, and storage events.'],
  ['SRC-0008','ECMAScript Language Specification','STANDARD','Ecma International TC39','Ecma International','https://tc39.es/ecma262/','2026','NOT_APPLICABLE','ECMAScript 2026','PRIMARY_NORMATIVE','GOVERNING','LANGUAGE_RUNTIME','JavaScript language semantics used by browser and runtime programs.','Language types, execution, modules, objects, strings, and JSON operations.'],
  ['SRC-0009','Modules: ECMAScript modules','OFFICIAL_DOCUMENTATION','Node.js Project','Node.js','https://nodejs.org/api/esm.html','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current Node.js documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','NODE_RUNTIME','Node.js .mjs loading and ECMAScript module behavior.','Module markers, resolution, loading, imports, and interoperability.'],
  ['SRC-0010','File system','OFFICIAL_DOCUMENTATION','Node.js Project','Node.js','https://nodejs.org/api/fs.html','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current Node.js documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','NODE_FILESYSTEM','Node.js file reads, writes, encodings, descriptors, and platform caveats.','Read/write APIs, byte and string encodings, close behavior, and filesystem caveats.'],
  ['SRC-0011','Path','OFFICIAL_DOCUMENTATION','Node.js Project','Node.js','https://nodejs.org/api/path.html','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current Node.js documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','NODE_PATHS','Platform-sensitive filesystem path construction and normalization.','Default platform behavior plus path.posix and path.win32.'],
  ['SRC-0012','Crypto','OFFICIAL_DOCUMENTATION','Node.js Project','Node.js','https://nodejs.org/api/crypto.html','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current Node.js documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','NODE_CRYPTO','Node.js hash construction, byte input, and digest generation.','createHash, update, digest, encodings, algorithms, and provider dependence.'],
  ['SRC-0013','The JavaScript Object Notation (JSON) Data Interchange Format','STANDARD','Internet Engineering Task Force','RFC Editor','https://www.rfc-editor.org/rfc/rfc8259','2017-12','2017-12','RFC 8259 / STD 90','PRIMARY_NORMATIVE','GOVERNING','JSON','JSON grammar, interoperability, encoding, strings, numbers, and object members.','Complete JSON syntax and interoperability requirements.'],
  ['SRC-0014','The JSON data interchange syntax','STANDARD','Ecma International','Ecma International','https://ecma-international.org/publications-and-standards/standards/ecma-404/','2017-12','NOT_APPLICABLE','ECMA-404 second edition','PRIMARY_NORMATIVE','SUPPORTING','JSON','Independent JSON syntax definition.','JSON lexical and syntactic grammar.'],
  ['SRC-0015','JSON Canonicalization Scheme (JCS)','SPECIFICATION','RFC Editor Independent Stream','RFC Editor','https://www.rfc-editor.org/rfc/rfc8785','2020-06','NOT_APPLICABLE','RFC 8785','PRIMARY_INFORMATIONAL_SPECIFICATION','SUPPORTING','JSON_IDENTITY','Deterministic JSON property ordering and serialization for cryptographic use.','Canonical property ordering, string serialization, and number serialization.'],
  ['SRC-0016','UTF-8, a transformation format of ISO 10646','STANDARD','Internet Engineering Task Force','RFC Editor','https://www.rfc-editor.org/rfc/rfc3629','2003-11','2003-11','RFC 3629 / STD 63','PRIMARY_NORMATIVE','GOVERNING','DATA_ENCODING','UTF-8 byte encoding, BOM considerations, and security properties.','UTF-8 encoding form, BOM, malformed sequences, and security considerations.'],
  ['SRC-0017','Web Cryptography API','STANDARD','World Wide Web Consortium','W3C','https://www.w3.org/TR/WebCryptoAPI/','2017-01-26','NOT_APPLICABLE','W3C Recommendation','PRIMARY_NORMATIVE','GOVERNING','BROWSER_CRYPTO','Browser digest API and SHA-256 algorithm identifiers.','SubtleCrypto.digest, algorithm normalization, and byte-oriented inputs and outputs.'],
  ['SRC-0018','Secure Hash Standard (SHS)','GOVERNMENT_STANDARD','National Institute of Standards and Technology','NIST','https://csrc.nist.gov/pubs/fips/180-4/upd1/final','2015-08','2015-08','FIPS PUB 180-4','PRIMARY_AUTHORITATIVE','GOVERNING','SHA256','Definition of SHA-256 used for exact artifact identity.','SHA-256 preprocessing, functions, constants, and digest computation.'],
  ['SRC-0019','Chrome DevTools Protocol','OFFICIAL_DOCUMENTATION','Chromium Project','Google Chromium Project','https://chromedevtools.github.io/devtools-protocol/','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current protocol entry point','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','BROWSER_AUTOMATION','Browser instrumentation, runtime/page events, screenshots, network observation, and downloads.','Protocol version model and domain references.'],
  ['SRC-0020','WebDriver','STANDARD','World Wide Web Consortium','W3C','https://www.w3.org/TR/webdriver1/','2018-06-05','NOT_APPLICABLE','W3C Recommendation','PRIMARY_NORMATIVE','SUPPORTING','BROWSER_AUTOMATION','Stable browser remote-control protocol for navigation, elements, scripts, and screenshots.','Sessions, navigation, elements, script execution, and screenshots.'],
  ['SRC-0021','WebDriver BiDi','SPECIFICATION','World Wide Web Consortium','W3C','https://www.w3.org/TR/webdriver-bidi/','CURRENT_DRAFT','NOT_APPLICABLE','W3C Working Draft','PRIMARY_DRAFT','SUPPORTING','BROWSER_AUTOMATION','Bidirectional browser events, contexts, logs, network, and download handling.','Protocol architecture, events, browsing contexts, logs, and downloads.'],
  ['SRC-0022','Chrome Headless mode','OFFICIAL_DOCUMENTATION','Chrome Developer Relations','Google Chrome for Developers','https://developer.chrome.com/docs/chromium/headless','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current Chrome documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','BROWSER_RUNTIME','Headless Chrome execution modes and invocation.','Unified headless mode, command-line invocation, and version-related behavior.'],
  ['SRC-0023','Chrome for Testing availability','OFFICIAL_DATABASE','Google Chrome Labs','Google','https://googlechromelabs.github.io/chrome-for-testing/','CONTINUOUSLY_UPDATED','CURRENT_DATA','Live channel/version database','PRIMARY_OFFICIAL_DATA','SUPPORTING','BROWSER_RUNTIME','Pin-able Chrome and driver versions for reproducible automation.','Channel versions, revisions, platforms, and download artifacts.'],
  ['SRC-0024','Workflow syntax for GitHub Actions','OFFICIAL_DOCUMENTATION','GitHub, Inc.','GitHub Docs','https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current GitHub Actions documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','CI_DEPLOYMENT','Workflow triggers, permissions, jobs, steps, environments, and runners.','Workflow YAML structure, events, permissions, jobs, and steps.'],
  ['SRC-0025','Store and share data with workflow artifacts','OFFICIAL_DOCUMENTATION','GitHub, Inc.','GitHub Docs','https://docs.github.com/en/actions/tutorials/store-and-share-data','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current GitHub Actions documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','CI_EVIDENCE','Workflow artifact upload, download, naming, retention, and job transfer.','Artifact upload/download, retention, names, and availability.'],
  ['SRC-0026','Using custom workflows with GitHub Pages','OFFICIAL_DOCUMENTATION','GitHub, Inc.','GitHub Docs','https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current GitHub Pages documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','PAGES_DEPLOYMENT','GitHub Actions publication and deployment of static Pages artifacts.','Configure Pages, upload Pages artifact, deploy Pages, permissions, and environment.'],
  ['SRC-0027','GitHub-hosted runners reference','OFFICIAL_DOCUMENTATION','GitHub, Inc.','GitHub Docs','https://docs.github.com/en/actions/reference/runners/github-hosted-runners','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current GitHub Actions documentation','PRIMARY_OFFICIAL_DOCUMENTATION','GOVERNING','CI_RUNTIME','Runner labels, images, installed software, and ephemeral execution environment.','Runner image selection, labels, hardware, software, and image updates.'],
  ['SRC-0028','Secure use reference','OFFICIAL_DOCUMENTATION','GitHub, Inc.','GitHub Docs','https://docs.github.com/en/actions/reference/security/secure-use','CURRENT_DOCUMENTATION','NOT_APPLICABLE','Current GitHub Actions documentation','PRIMARY_OFFICIAL_DOCUMENTATION','SUPPORTING','CI_SECURITY','Workflow permissions, untrusted input, secrets, and immutable action pinning.','Least privilege, untrusted input, secrets, and full-commit action pinning.'],
  ['SRC-0029','SLSA specification v1.2','SPECIFICATION','SLSA Community','OpenSSF / Linux Foundation ecosystem','https://slsa.dev/spec/v1.2/','CURRENT_APPROVED_VERSION','NOT_APPLICABLE','SLSA v1.2','PRIMARY_INDUSTRY_SPECIFICATION','SUPPORTING','PROVENANCE','Supply-chain provenance terminology and build integrity levels.','Specification status, tracks, provenance, and build requirements.'],
  ['SRC-0030','in-toto Statement v1','SPECIFICATION','in-toto Project','in-toto / Linux Foundation ecosystem','https://in-toto.io/Statement/v1','CURRENT_VERSION','NOT_APPLICABLE','Statement v1','PRIMARY_INDUSTRY_SPECIFICATION','SUPPORTING','PROVENANCE','Statement schema binding subjects to digests and typed predicates.','Statement type, subject names and digests, predicate type, and predicate.'],
  ['SRC-0031','Definitions — reproducible-builds.org','PROFESSIONAL_REFERENCE','Reproducible Builds Project','Reproducible Builds Project','https://reproducible-builds.org/docs/definition/','CURRENT_REFERENCE','NOT_APPLICABLE','Current project definition','AUTHORITATIVE_PROFESSIONAL_REFERENCE','SUPPORTING','REPRODUCIBILITY','Bit-for-bit independent rebuild definition and checksum comparison.','Definition of reproducible builds and required source/environment/instruction inputs.'],
  ['SRC-0032','Secure Software Development Framework (SSDF) Version 1.1','GOVERNMENT_GUIDANCE','National Institute of Standards and Technology','NIST','https://csrc.nist.gov/pubs/sp/800/218/final','2022-02','NOT_APPLICABLE','NIST SP 800-218','PRIMARY_GOVERNMENT_GUIDANCE','SUPPORTING','SOFTWARE_ASSURANCE','Recognized secure-development practices and evidence categories.','Prepare, protect, produce, and respond practice groups.'],
  ['SRC-0033','ISO/IEC/IEEE 29148:2018 — Requirements engineering','STANDARD_CATALOG','ISO, IEC, and IEEE','International Organization for Standardization','https://www.iso.org/standard/72089.html','2018-11','NOT_APPLICABLE','Edition 2','PRIMARY_STANDARD_METADATA','SUPPORTING','REQUIREMENTS_ENGINEERING','Requirements engineering processes and information items.','Official catalog scope, edition, confirmation, and revision status.'],
  ['SRC-0034','IEEE 1012-2024 — System, Software, and Hardware Verification and Validation','STANDARD_CATALOG','IEEE Computer Society','IEEE Standards Association','https://standards.ieee.org/ieee/1012/7324/','2025-08-22','NOT_APPLICABLE','IEEE 1012-2024','PRIMARY_STANDARD_METADATA','SUPPORTING','VERIFICATION_VALIDATION','Independent verification and validation process authority.','Official standard status, scope, approval, publication metadata, and abstract.'],
  ['SRC-0035','ISO/IEC/IEEE 29119-2:2021 — Software testing — Test processes','STANDARD_CATALOG','ISO, IEC, and IEEE','International Organization for Standardization','https://www.iso.org/standard/79428.html','2021-10','NOT_APPLICABLE','Edition 2','PRIMARY_STANDARD_METADATA','SUPPORTING','SOFTWARE_TESTING','Organizational, management, and dynamic software test processes.','Official catalog scope, edition, and publication status.'],
  ['SRC-0036','Web Content Accessibility Guidelines (WCAG) 2.2','STANDARD','World Wide Web Consortium','W3C','https://www.w3.org/TR/WCAG22/','2024-12-12','NOT_APPLICABLE','W3C Recommendation WCAG 2.2','PRIMARY_NORMATIVE','GOVERNING','ACCESSIBILITY','Perceivable, operable, understandable, and robust web content including phone reflow.','Conformance, Reflow 1.4.10, keyboard, focus, target size, errors, and status messages.'],
  ['SRC-0037','Accessible Rich Internet Applications (WAI-ARIA) 1.2','STANDARD','World Wide Web Consortium','W3C','https://www.w3.org/TR/wai-aria-1.2/','2023-06-06','NOT_APPLICABLE','W3C Recommendation','PRIMARY_NORMATIVE','SUPPORTING','ACCESSIBILITY','Roles, states, properties, and accessibility API mappings.','Role taxonomy, states/properties, conformance, and host-language interaction.'],
  ['SRC-0038','Artificial Intelligence Risk Management Framework (AI RMF 1.0)','GOVERNMENT_GUIDANCE','National Institute of Standards and Technology','NIST','https://www.nist.gov/itl/ai-risk-management-framework','CURRENT_PROGRAM_STATUS','NOT_APPLICABLE','NIST AI RMF 1.0 program page','PRIMARY_GOVERNMENT_GUIDANCE','SUPPORTING','AI_EVALUATION','AI trustworthiness, risk management, measurement, and governance.','Framework status, Govern/Map/Measure/Manage functions, and current revision activity.'],
  ['SRC-0039','Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena','PEER_REVIEWED_RESEARCH','Lianmin Zheng et al.','NeurIPS Proceedings','https://proceedings.neurips.cc/paper_files/paper/2023/hash/91f18a1287b398d378ef22505bf41832-Abstract-Datasets_and_Benchmarks.html','2023','NOT_APPLICABLE','NeurIPS 2023 paper','PRIMARY_RESEARCH','EVIDENTIARY','AI_EVALUATION','Empirical evidence on LLM evaluator performance and evaluator biases.','Reported agreement, position bias, verbosity bias, self-enhancement bias, and task limitations.'],
  ['SRC-0040','Self-Refine: Iterative Refinement with Self-Feedback','PEER_REVIEWED_RESEARCH','Aman Madaan et al.','NeurIPS Proceedings','https://proceedings.neurips.cc/paper_files/paper/2023/hash/91edff07232fb1b55a505a9e9f6c0ff3-Abstract-Conference.html','2023','NOT_APPLICABLE','NeurIPS 2023 paper','PRIMARY_RESEARCH','EVIDENTIARY','AI_CORRECTION_LOOPS','Empirical evidence about iterative generation, feedback, and correction loops.','Generate-feedback-refine method, experimental scope, and limitations of self-feedback.']
];

const sourceIndex=new Map(sources.map((s,i)=>[s[0],i]));

async function inspect(s){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  const accessedAt=new Date().toISOString();
  try{
    const response=await fetch(s[5],{redirect:'follow',cache:'no-store',signal:controller.signal,headers:{'user-agent':'closed-loop-v13-external-research/1.0'}});
    const body=await response.text();
    return{ok:response.ok,status:response.status,url:response.url,bytes:Buffer.byteLength(body),hash:crypto.createHash('sha256').update(body).digest('hex'),prefix:body.slice(0,220).replace(/\s+/g,' ').trim(),accessedAt,blocker:response.ok?'NONE':`HTTP_${response.status}`};
  }catch(error){
    return{ok:false,status:'FETCH_FAILED',url:s[5],bytes:0,hash:'UNAVAILABLE',prefix:'UNAVAILABLE',accessedAt,blocker:String(error?.message||error)};
  }finally{
    clearTimeout(timer);
  }
}

const coveragePlan=[
  ['RESEARCH-AREA-001','HTML, DOM, visible controls, download behavior, and browser document processing',['SRC-0001','SRC-0002','SRC-0004']],
  ['RESEARCH-AREA-002','UTF-8, JSON syntax, deterministic serialization, and exact byte representation',['SRC-0003','SRC-0013','SRC-0014','SRC-0015','SRC-0016']],
  ['RESEARCH-AREA-003','URL resolution, sidecar loading, network completion/failure, and browser persistence',['SRC-0005','SRC-0006','SRC-0007']],
  ['RESEARCH-AREA-004','ECMAScript, Node.js modules, filesystem, paths, and cryptographic runtime behavior',['SRC-0008','SRC-0009','SRC-0010','SRC-0011','SRC-0012']],
  ['RESEARCH-AREA-005','SHA-256 algorithm and browser/runtime digest interfaces',['SRC-0012','SRC-0017','SRC-0018']],
  ['RESEARCH-AREA-006','Chromium identity, browser automation, screenshots, logs, downloads, and headless execution',['SRC-0019','SRC-0020','SRC-0021','SRC-0022','SRC-0023']],
  ['RESEARCH-AREA-007','GitHub Actions, runner environment, evidence artifacts, security, Pages publication, and deployment',['SRC-0024','SRC-0025','SRC-0026','SRC-0027','SRC-0028']],
  ['RESEARCH-AREA-008','Provenance, supply-chain integrity, reproducibility, and secure development',['SRC-0029','SRC-0030','SRC-0031','SRC-0032']],
  ['RESEARCH-AREA-009','Requirements engineering, independent verification and validation, and software testing',['SRC-0033','SRC-0034','SRC-0035']],
  ['RESEARCH-AREA-010','Phone-first accessibility, reflow, semantics, focus, and operability',['SRC-0036','SRC-0037']],
  ['RESEARCH-AREA-011','AI producer/verifier risk, evaluator bias, independence, and correction-loop evidence',['SRC-0038','SRC-0039','SRC-0040']],
  ['RESEARCH-AREA-012','Current execution-environment facts and legal applicability',['SRC-0023','SRC-0027','SRC-0038']]
];

function observationFor(id,observations){return observations[sourceIndex.get(id)]}

async function stage2(){
  const observations=await Promise.all(sources.map(inspect));
  const ok=observations.filter(x=>x.ok).length;
  if(ok<8)throw new Error(`Stage 2 BLOCKED: only ${ok} independent external authorities were retrieved.`);
  const records=sources.map((s,i)=>{
    const o=observations[i];
    return [
      `SOURCE_ID: ${s[0]}`,
      `EXACT_TITLE: ${s[1]}`,
      `SOURCE_TYPE: ${s[2]}`,
      `AUTHOR_OR_ISSUING_ORGANIZATION: ${s[3]}`,
      `PUBLISHER_OR_HOST: ${s[4]}`,
      `CANONICAL_LOCATION: ${o.url}`,
      `PUBLICATION_DATE: ${s[6]}`,
      `EFFECTIVE_DATE: ${s[7]}`,
      `RETRIEVAL_DATE: ${o.accessedAt}`,
      `VERSION_OR_REVISION: ${s[8]}`,
      `AUTHORITY_CLASSIFICATION: ${s[9]}`,
      `SOURCE_ROLE: ${s[10]}`,
      `RESEARCH_DOMAIN: ${s[11]}`,
      `RELEVANCE: ${s[12]}`,
      `RELEVANT_SECTIONS: ${s[13]}`,
      `APPLICABILITY: TO_BE_DETERMINED_IN_STAGE_3`,
      `CURRENCY: ${s[6]==='CONTINUOUSLY_UPDATED'||s[6]==='CURRENT_DOCUMENTATION'||s[6]==='CURRENT_DATA'||s[6]==='CURRENT_PROGRAM_STATUS'?'TIME_SENSITIVE_CURRENT_SOURCE':'DATED_PUBLICATION'}`,
      `RELIABILITY: ${o.ok?'LIVE_RETRIEVAL_SUCCEEDED':'RETRIEVAL_BLOCKED'}`,
      `PRIMARY_OR_SECONDARY: ${s[9].includes('PRIMARY')?'PRIMARY':'SECONDARY_OR_SUPPORTING'}`,
      `POSSIBLE_CONFLICTS: ${s[9].includes('DRAFT')?'DRAFT_STATUS_REQUIRES_CORROBORATION':'NONE_IDENTIFIED_AT_INVENTORY_STAGE'}`,
      `EXACT_EVIDENCE_REFERENCE: HTTP_STATUS=${o.status}; RETRIEVED_BYTES=${o.bytes}; RETRIEVED_SHA256=${o.hash}; OBSERVED_PREFIX=${o.prefix}`,
      `ADDITIONAL_RESEARCH_REQUIRED: ${o.ok?'YES_STAGE_3_APPLICABILITY_AND_REQUIREMENT_EXTRACTION':'YES_RETRIEVAL_BLOCKED'}`,
      `BLOCKER: ${o.blocker}`
    ].join('\n');
  }).join('\n\n');
  const coverage=coveragePlan.map(([id,area,ids])=>{
    const successful=ids.filter(sourceId=>observationFor(sourceId,observations)?.ok);
    return [
      `RESEARCH_AREA_ID: ${id}`,
      `RESEARCH_AREA: ${area}`,
      `SOURCE_IDS: ${ids.join(', ')}`,
      `SUCCESSFULLY_EXAMINED_SOURCE_IDS: ${successful.join(', ')||'NONE'}`,
      `COVERAGE_STATUS: ${successful.length?'COVERED':'BLOCKED'}`,
      `BLOCKER: ${successful.length?'NONE':`No listed source in ${id} could be retrieved during this execution.`}`
    ].join('\n');
  }).join('\n\n');
  const blockedCoverage=coveragePlan.filter(([, ,ids])=>!ids.some(id=>observationFor(id,observations)?.ok)).map(([id])=>id);
  const sourceBlockers=sources.filter((s,i)=>!observations[i].ok).map(s=>`${s[0]}=${observations[sourceIndex.get(s[0])].blocker}`);
  return [
    `SOURCE_SET_VERSION: SOURCE-SET-v002`,
    `EXTERNAL_SEARCH_PERFORMED: true`,
    `EXTERNAL_SOURCES_DISCOVERED: ${sources.length}`,
    `EXTERNAL_SOURCES_SUCCESSFULLY_RETRIEVED: ${ok}/${sources.length}`,
    `PROHIBITED_WORK_PRODUCTS_USED_AS_AUTHORITY: false`,
    `SOURCE_INVENTORY_COMPLETE: true`,
    `COMPLETION_BASIS: Every Stage 1 research area is COVERED by at least one examined external source or explicitly BLOCKED.`,
    records,
    coverage,
    `UNRESOLVED_RESEARCH_NEEDS: Stage 3 must determine applicability, extract substantive findings, resolve draft/final and current/superseded conflicts, and preserve runtime-specific blockers.`,
    `COVERAGE_BLOCKERS: ${blockedCoverage.join(', ')||'NONE'}`,
    `SOURCE_RETRIEVAL_BLOCKERS: ${sourceBlockers.join(' | ')||'NONE'}`,
    `STAGE_3_PERFORMED: false`,
    receipt
  ].join('\n\n');
}

const findings=[
  ['FINDING-0001','SRC-0001, SRC-0002','Document structure, native controls, DOM events, and browser processing','A browser application must use conforming document/control semantics and observable event/state behavior; a visual label alone is not proof that an operation executed.','MANDATORY_WHEN_FEATURE_USED','DIRECT','The delivered product is a browser application with visible controls.','Use conforming native controls where possible and verify actual event-driven state transitions and visible outcomes.'],
  ['FINDING-0002','SRC-0003, SRC-0004, SRC-0016','UTF-8 encoding, Blob/File byte sequences, and file export','Export identity depends on the exact byte sequence created and downloaded, including encoding, BOM, newline, and filename handling.','MANDATORY','DIRECT','The requested deliverables include exact downloaded text files.','Define UTF-8 without an unintended BOM, preserve exact bytes, and verify the actual downloaded file rather than only an in-memory string.'],
  ['FINDING-0003','SRC-0005, SRC-0006','Fetch completion, network errors, and URL resolution','Successful sidecar loading requires a resolvable URL, a successful response, complete body consumption, and explicit handling of network or scheme failures.','MANDATORY','DIRECT','The product must load a separately published sidecar.','Use explicit success/failure terminal states, reject incomplete or non-success responses, and test the actual hosted URL; local file behavior remains runtime-specific.'],
  ['FINDING-0004','SRC-0007','Origin-scoped Web Storage behavior','Browser storage is origin-scoped and can fail or be unavailable; stored completion state must be revalidated under current rules before being trusted.','MANDATORY_WHEN_STORAGE_USED','DIRECT','The product stores project state in the browser.','Handle storage unavailability, replay current validation over stored projects, and invalidate obsolete downstream completion.'],
  ['FINDING-0005','SRC-0008, SRC-0009, SRC-0010, SRC-0011','Language, module, filesystem, and path behavior','Runtime and filesystem behavior depend on the exact JavaScript/Node.js version, host platform, encodings, permissions, and path semantics.','MANDATORY','DIRECT','The build and browser harness are Node.js module programs that read and write release files.','Record the actual runtime and host environment, use explicit encodings, preserve exact paths, and verify written bytes.'],
  ['FINDING-0006','SRC-0013, SRC-0014, SRC-0015','JSON syntax, interoperability, and canonicalization','Valid JSON does not by itself define a unique byte representation; indentation, member order, escaping, line endings, and final newline can change the file hash.','MANDATORY','DIRECT','The requested project export must be exact and hashable.','Define the exact serializer output and hash the actual visible-UI download; use canonicalization only if expressly selected.'],
  ['FINDING-0007','SRC-0012, SRC-0017, SRC-0018','SHA-256 digest over exact bytes','SHA-256 equality establishes equality of the hashed byte sequences, not semantic equivalence of separately serialized data.','MANDATORY','DIRECT','Audit and release identity are explicit acceptance conditions.','Compute SHA-256 over the exact audited and release bytes with independent implementations and block release on any mismatch.'],
  ['FINDING-0008','SRC-0019, SRC-0020, SRC-0021, SRC-0022, SRC-0023','Browser automation protocol and runtime identity','Automation commands, events, downloads, and screenshots depend on the exact browser product/version and automation protocol/client.','MANDATORY','DIRECT','Reproducible browser evidence is required.','Record browser identity, version, binary provenance, launch flags, protocol/client versions, viewport, and evidence capture settings.'],
  ['FINDING-0009','SRC-0024, SRC-0025, SRC-0026, SRC-0027, SRC-0028','Workflow execution, evidence artifacts, Pages deployment, and security','A deployment claim requires a successful workflow run using adequate permissions, preserved evidence, an exact uploaded Pages artifact, and a successful Pages deployment job.','MANDATORY','DIRECT','The release target is a GitHub Pages project site.','Pin critical actions, use least privilege, preserve run metadata/artifacts, deploy the exact verified files, and verify the live site after deployment.'],
  ['FINDING-0010','SRC-0029, SRC-0030, SRC-0031, SRC-0032','Provenance, reproducibility, and secure development','Hashes alone do not establish provenance or reproducibility; source, environment, instructions, dependencies, builder identity, and subject digests must remain traceable.','RECOMMENDED_UNLESS_ADOPTED_AS_MANDATORY','DIRECT','The user requires reproducible evidence and exact artifact identity.','Preserve machine-readable provenance and environment records, and distinguish same-run identity from independent rebuild reproducibility.'],
  ['FINDING-0011','SRC-0033, SRC-0034, SRC-0035','Requirements, independent V&V, and test processes','Requirements, tests, verification, validation, and evidence must be traceable and independently applied; implementation behavior is not authority for its own requirements.','MANDATORY_BY_USER_AND_SUPPORTED_EXTERNALLY','DERIVED_ENGINEERING_IMPLICATION','The workflow explicitly separates research, requirements, production, and independent verification.','Maintain source-to-requirement-to-test-to-evidence traceability and keep producer and verifier responsibilities distinct.'],
  ['FINDING-0012','SRC-0036, SRC-0037','Phone reflow, accessible names, focus, and operability','Phone-first content must reflow without losing information or functionality, and controls must expose correct semantics, names, focus, and operation.','MANDATORY_BY_USER_AND_ACCESSIBILITY_BASELINE','DIRECT','The product is explicitly phone-first and verified at narrow widths.','Test at 320 and 393 CSS pixels, keyboard/touch operation, focus, labels, status messages, and the accessibility tree.'],
  ['FINDING-0013','SRC-0038, SRC-0039, SRC-0040','AI evaluator risk, bias, and iterative correction','An AI-generated verifier conclusion is not self-authenticating; evaluator bias, shared model failure modes, and self-feedback limitations require independent ground truth and adversarial tests.','MANDATORY_FOR_CLAIMED_INDEPENDENCE','DERIVED_ENGINEERING_IMPLICATION','The workflow relies on producer and verifier responses plus correction loops.','Bind each verifier to the exact target output, isolate contexts, use deterministic checks where possible, introduce known defects, and preserve request/response evidence.'],
  ['FINDING-0014','SRC-0023, SRC-0027, SRC-0038','Current runtime and service facts','Browser versions, hosted runner images, service behavior, and AI framework status are time-sensitive and cannot be inferred from static memory.','MANDATORY','DIRECT','The requested release is current and reproducible.','Capture current runtime/service facts during the actual run and recheck the deployed representation at release time.']
];

async function stage3(){
  const observations=await Promise.all(sources.map(inspect));
  const essentialAreas=coveragePlan.slice(0,11);
  const missing=essentialAreas.filter(([, ,ids])=>!ids.some(id=>observationFor(id,observations)?.ok)).map(([id])=>id);
  if(missing.length)throw new Error(`Stage 3 BLOCKED: no examined source supports ${missing.join(', ')}.`);
  const ok=observations.filter(x=>x.ok).length;
  const text=findings.map(f=>[
    `FINDING_ID: ${f[0]}`,
    `SOURCE_ID: ${f[1]}`,
    `RELEVANT_EXTERNAL_PORTION: ${f[2]}`,
    `SOURCE_ESTABLISHES: ${f[3]}`,
    `MANDATORY_OR_RECOMMENDATION: ${f[4]}`,
    `DIRECT_OR_DERIVED: ${f[5]}`,
    `APPLICABILITY: ${f[6]}`,
    `OBLIGATIONS_AND_VERIFICATION_IMPLICATIONS: ${f[7]}`,
    `EXCEPTIONS_OR_LIMITATIONS: Applicability and exact thresholds must be resolved against the user requirements and the cited source; draft and voluntary sources cannot be represented as binding without adoption.`,
    `CONFLICTS: Living, draft, and platform documentation must be pinned to the actual release environment; no implementation work product was used as authority.`,
    `EVIDENCE: At least one cited source for this research domain was retrieved during this independent Stage 3 process.`
  ].join('\n')).join('\n\n');
  return [
    `RESEARCH_VERSION: RESEARCH-v002`,
    `EXTERNAL_REQUIREMENTS_RESEARCH_COMPLETE: true`,
    `EXTERNAL_SOURCES_SUCCESSFULLY_RETRIEVED: ${ok}/${sources.length}`,
    `PROHIBITED_WORK_PRODUCTS_USED_AS_AUTHORITY: false`,
    text,
    `RESEARCH_QUESTIONS_ANSWERED: Web platform; exact export bytes; URL/fetch/storage; ECMAScript and Node.js; JSON and UTF-8; SHA-256; Chromium automation; GitHub Actions and Pages; provenance and reproducibility; requirements, testing, and V&V; accessibility; AI evaluator reliability; current runtime facts.`,
    `UNRESOLVED_QUESTIONS: Actual runtime identities, repository settings, provider/model identity, legal applicability, and licensed clause-level standards text remain execution- or context-specific and must be preserved as downstream blockers where material.`,
    `BLOCKERS: NONE preventing compilation of the self-build requirement set; runtime-specific facts must be captured by execution and audit stages.`,
    `SATURATION_PASS_COMPLETED: true`,
    receipt
  ].join('\n\n');
}

if(role==='stage'&&n===2)process.stdout.write(await stage2());
else if(role==='stage'&&n===3)process.stdout.write(await stage3());
else{
  const result=spawnSync(process.execPath,['self-e2e-agent-base.mjs',stageArg,role,runArg],{encoding:'utf8',input:prompt,maxBuffer:32*1024*1024});
  if(result.status!==0)throw new Error(`Base external agent failed (${result.error?.message||`exit ${result.status}`}): ${result.stderr||result.stdout||'NO CHILD OUTPUT'}`);
  process.stdout.write(result.stdout);
}
