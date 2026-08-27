import fs from 'node:fs';
import {createHash} from 'node:crypto';

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match; found ${count}.`);
  return text.replace(from, to);
}

let prompt = fs.readFileSync('prompt-engine.js', 'utf8');
prompt = replaceOnce(prompt,
  "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/17';",
  "const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/18';",
  'bump prompt engine version');
prompt = replaceOnce(prompt,
  'Stage 02 owns that inventory and formal inspection.',
  'Stage 02 does not own supplied-project-material inventory; later stages inspect supplied project materials only when they need those materials for their substantive work.',
  'remove Stage 01 claim that Stage 02 inventories supplied project material');
prompt = replaceOnce(prompt,
  'A later source/material stage owns formal discovery, inventory, provenance, formal inspection status, authority, currency, supersession, applicability, and conflicts.',
  'Stage 02 owns independent external-source discovery, inspection, authority classification, currency, supersession, applicability, and external-source conflicts. Supplied project materials remain project input and are inspected later only when the stage performing substantive work actually needs them.',
  'separate external-source authority from project-material inspection');
prompt = replaceOnce(prompt,
  "2:'Build the complete source and supplied-material inventory for this current job only. Stage 02 owns inventory and inspection: enumerate human-supplied files, links, references, records, and other materials without treating them as automatically independent governing authority, and discover independent external sources only where the job actually needs them. Do not perform Stage 03 substantive source research or derive requirements yet. Build the independent external source inventory for this current job only.",
  "2:'Discover, inspect, and classify only independent external sources and authorities for this current job. Stage 02 is not a supplied-project-material inventory stage. Human-supplied files, links, records, implementations, drawings, repositories, packets, and other project materials remain authorized project input, but do not enumerate, inventory, hash, or inspect their internal project contents here merely because they were supplied. Missing project-material bytes do not by themselves block Stage 02. Human-supplied material may provide a search lead or citation to a genuinely external publication, standard, statute, regulation, repository, dataset, patent publication, or other independent source; when that occurs, retrieve and inspect the external source itself before proposing it as a Stage 02 source record. Do not perform Stage 03 substantive source research or derive requirements yet. Build the independent external source inventory for this current job only.",
  'make Stage 02 external-source-only');
prompt = replaceOnce(prompt,
  "return {contractVersion:'closed-loop-response-contract/2.3'",
  "return {contractVersion:'closed-loop-response-contract/2.4'",
  'bump response contract descriptor version');
prompt = replaceOnce(prompt,
  "recordIdentityRule:'Exactly one of tempKey or targetId; UPDATE_RESERVED uses targetId and new proposals use tempKey.',relationshipReferenceRule:",
  "recordIdentityRule:'Exactly one of tempKey or targetId; UPDATE_RESERVED uses targetId and new proposals use tempKey.',recordProvenanceRule:'Every proposed record containing any AGENT-owned canonical field MUST include a non-empty evidenceRefs array. Every evidenceRefs item must exactly match an evidence[].temporaryKey in the same response. evidence.sourceRef is a reverse link and does not satisfy the proposed record provenance requirement.',relationshipReferenceRule:",
  'add explicit record provenance contract');
prompt = replaceOnce(prompt,
  "evidenceRule:'Evidence references must resolve completely; claimed source or attachment references may not resolve to UNKNOWN. Every evidence object must use only evidenceKeys.'",
  "evidenceRule:'Evidence references must resolve completely; claimed source or attachment references may not resolve to UNKNOWN. Every evidence object must use only evidenceKeys. Every proposed record containing AGENT-owned canonical data must point forward to its supporting evidence using non-empty record.evidenceRefs; an evidence.sourceRef back-reference alone is not sufficient provenance.'",
  'make forward record evidence linkage explicit');
prompt = replaceOnce(prompt,
  'RESPONSE CONTRACT DEFINITIONS\nThe CONTRACT_SHA256',
  'RECORD PROVENANCE — REQUIRED FOR EVERY PROPOSED AGENT RECORD\n- If a proposed record contains any agent-owned canonical field, include a non-empty evidenceRefs array on that record.\n- Every evidenceRefs value must exactly equal a temporaryKey in the response evidence array.\n- Evidence may also use sourceRef or attachmentRef when appropriate, but those reverse references do not replace the record evidenceRefs requirement.\n- Before returning final JSON, verify every proposed record that needs provenance has at least one resolvable evidenceRefs entry.\n\nRESPONSE CONTRACT DEFINITIONS\nThe CONTRACT_SHA256',
  'surface provenance rule immediately before strict response contract');
fs.writeFileSync('prompt-engine.js', prompt);

let schema = fs.readFileSync('workflow-schema.js', 'utf8');
schema = replaceOnce(schema,
  "const TARGET_PRODUCT_REFERENCE_PATTERN=/(?:closed-loop-tracker|current\\s+application|existing\\s+application|target\\s+product|current\\s+ui|target\\s+screenshot|app-core\\.js|workbook\\.js|prompt-engine\\.js|TEST_PROJECT\\.json|github\\.com\\/sjonesjones917\\/closed-loop-tracker)/i;",
  "const TARGET_PRODUCT_REFERENCE_PATTERN=/(?:closed-loop-tracker|(?:current|existing)\\s+(?:operating\\s+)?application\\s+(?:repository|source\\s+code|ui|stored\\s+state|implementation|artifact|screenshot)|target\\s+product|current\\s+ui|target\\s+screenshot|app-core\\.js|workbook\\.js|prompt-engine\\.js|TEST_PROJECT\\.json|github\\.com\\/sjonesjones917\\/closed-loop-tracker)/i;",
  'narrow target-product source detection to actual implementation references');
fs.writeFileSync('workflow-schema.js', schema);

let ingestion = fs.readFileSync('verify-ingestion.mjs', 'utf8');
const targetNegative = "negative('target product source',(e)=>{e.stageData={};e.records={sources:[sourceProposal('source-target',{TITLE:'Current application repository',ISSUING_ORGANIZATION_OR_AUTHOR:'Project repository',SOURCE_TYPE:'repository source code',PUBLICATION_ORIGIN:'current application',URL_REFERENCE:'https://github.com/sjonesjones917/closed-loop-tracker',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'target product',APPLICABLE_PORTIONS:'app-core.js',CONTROLLING_STATE:'CONTROLLING'})]};},'INVALID_EXTERNAL_SOURCE');";
ingestion = replaceOnce(ingestion, targetNegative,
  "{const currentPatentForms=schema.sourceClassificationIssues({TITLE:'Current application forms and filing instructions',ISSUING_ORGANIZATION_OR_AUTHOR:'Independent Patent Office',SOURCE_TYPE:'OFFICIAL ADMINISTRATIVE SOURCE',PUBLICATION_ORIGIN:'Independent official website',URL_REFERENCE:'https://example.gov/current-application-forms',AUTHORITY_LEVEL:'OFFICIAL',AUTHORITY_ROLE:'OPERATIONAL GUIDANCE',RELEVANCE:'Current application forms for an external filing process',APPLICABLE_PORTIONS:'Current application forms',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'GOVERNING WHERE APPLICABLE'});if(currentPatentForms.length)throw new Error(`Legitimate external source containing the phrase current application was rejected: ${currentPatentForms.join(' | ')}`);}\n" + targetNegative,
  'add false-positive regression for current application phrase');
fs.writeFileSync('verify-ingestion.mjs', ingestion);

const oldStage2Guide = 'Include the original supplied project artifact(s) with the Stage 02 prompt';
const newStage2Guide = 'Stage 02 researches independent external sources. Supplied project artifacts are not required for this stage';
let app = fs.readFileSync('app-core.js', 'utf8');
if (!app.includes(oldStage2Guide)) throw new Error('Stage 02 operator guide anchor not found');
app = app.replaceAll(oldStage2Guide, newStage2Guide);
fs.writeFileSync('app-core.js', app);
let browser = fs.readFileSync('verify-browser.mjs', 'utf8');
browser = browser.replaceAll(oldStage2Guide, newStage2Guide);
fs.writeFileSync('verify-browser.mjs', browser);

let semantics = fs.readFileSync('verify-prompt-semantics.mjs', 'utf8');
semantics = semantics.replaceAll(oldStage2Guide, newStage2Guide);
const stage2Anchor = "if(record.stage===2){\n    if(!record.prompt.includes('DESIRED OR SUGGESTED SOURCE COUNT'))issues.push('SOURCE_COUNT_MISSING');";
if (!semantics.includes(stage2Anchor)) throw new Error('Stage 02 semantic block anchor not found');
semantics = semantics.replace(stage2Anchor,
  "if(record.stage===2){\n    if(!record.prompt.includes('Stage 02 is not a supplied-project-material inventory stage'))issues.push('STAGE02_PROJECT_MATERIAL_INVENTORY_LEAK');\n    if(!record.prompt.includes('Missing project-material bytes do not by themselves block Stage 02'))issues.push('STAGE02_FALSE_PROJECT_FILE_BLOCKER');\n    if(!record.prompt.includes('Every proposed record containing any AGENT-owned canonical field MUST include a non-empty evidenceRefs array'))issues.push('RECORD_PROVENANCE_PROMPT_RULE_MISSING');\n    if(!record.prompt.includes('DESIRED OR SUGGESTED SOURCE COUNT'))issues.push('SOURCE_COUNT_MISSING');");
const oldUiAssertion = "if(!ui.includes('Stage 02 researches independent external sources. Supplied project artifacts are not required for this stage')||!ui.includes('suppliedFileMaterialLabels'))throw new Error('Stage 02 guide does not conditionally tell the human to provide actual supplied file artifacts.');";
if (semantics.includes(oldUiAssertion)) {
  semantics = semantics.replace(oldUiAssertion, "if(!ui.includes('Stage 02 researches independent external sources. Supplied project artifacts are not required for this stage'))throw new Error('Stage 02 operator guide does not explain the external-source-only boundary.');");
}
fs.writeFileSync('verify-prompt-semantics.mjs', semantics);

const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const gitBlobSha=file=>{const bytes=fs.readFileSync(file);return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');};
const runtimeManifest=runtimeFiles.map(file=>`${file}:${gitBlobSha(file)}\n`).join('');
const runtimeBuildIdentity=`runtime-${createHash('sha256').update(runtimeManifest).digest('hex').slice(0,16)}`;
let html=fs.readFileSync('index.html','utf8');
const runtimeTokenPattern=/runtime-[0-9a-f]{16}/g;
const existing=[...html.matchAll(runtimeTokenPattern)].map(x=>x[0]);
if(existing.length!==runtimeFiles.length)throw new Error(`Expected ${runtimeFiles.length} runtime cache tokens in index.html; found ${existing.length}.`);
html=html.replace(runtimeTokenPattern,runtimeBuildIdentity);
fs.writeFileSync('index.html',html);

console.log(JSON.stringify({patched:['prompt-engine.js','workflow-schema.js','app-core.js','index.html','verify-ingestion.mjs','verify-prompt-semantics.mjs','verify-browser.mjs'],runtimeBuildIdentity,fixes:['Stage 02 external-source-only boundary','explicit forward record provenance','external-source false-positive classifier','Stage 02 operator guidance']}, null, 2));
