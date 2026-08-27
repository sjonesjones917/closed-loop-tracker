import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','runtime-fixes.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}
const core=globalThis.closedLoopCore;
const hash=globalThis.closedLoopHash;
const engine=globalThis.closedLoopWorkflowEngine;
const prompts=globalThis.closedLoopPromptEngine;
const ingestion=globalThis.closedLoopResponseIngestion;
if(!core||!hash||!engine||!prompts||!ingestion||!globalThis.closedLoopRuntimeFixes)throw new Error('Runtime fix modules failed to load.');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const project=core.createBlankState('JOB-RUNTIME-FIX');
Object.assign(project.job,{
  JOB_ID:'JOB-RUNTIME-FIX',
  JOB_TITLE:'Patent application',
  JOB_OWNER:'Stephen Jones',
  EXACT_USER_OBJECTIVE_VERBATIM:'Turn my supplied invention packet into a patent application.',
  SUPPLIED_MATERIALS_INVENTORY:'One invention-disclosure ZIP packet.',
  REQUIRED_OUTPUT_FORMAT:'The formats required for the selected filing route.',
  DEADLINE_OR_TEMPORAL_SCOPE:'UNKNOWN',
  DESIRED_SOURCE_COUNT:'UNKNOWN',
  KNOWN_AUTHORITATIVE_SOURCES:'The supplied invention-disclosure packet.',
  AVAILABLE_TOOLS:'Web and supplied files.',
  PROHIBITED_ACTIONS:'NONE',
  EXPLICIT_USER_REQUIREMENTS:'Do the best supportable work.',
  CURRENT_INPUT_VERSION:'INPUT-v001'
});
project.revision=4;
engine.ensureShape(project);
engine.recalculate(project);
const prompt=prompts.buildPromptRecord(1,project);
project.projectData.generatedPrompts.push(prompt);
assert(prompt.runtimeFixVersion==='closed-loop-runtime-fixes/1','Prompt record is missing runtime fix identity.');
assert(prompt.prompt.includes('STRICT MACHINE-RESPONSE SERIALIZATION'),'Prompt is missing strict JSON serialization rules.');
assert(prompt.prompt.includes('Never use sourceType, sourceReference, locator, excerpt, or supports.'),'Prompt is missing the exact evidence-key prohibition.');
assert(prompt.prompt.includes('Do not turn it into a ZIP audit'),'Stage 01 prompt is missing bounded-intake guidance.');
const body=prompt.prompt.slice(0,prompt.prompt.indexOf('\n\nPROMPT IDENTITY — ECHO EXACTLY'));
assert(hash.sha256Text(body)===prompt.bodySha256,'Prompt body hash does not match the augmented body.');
const descriptor=prompts.responseContractDescriptor(1,'COMPLETE');
assert(descriptor.contractVersion==='closed-loop-response-contract/2.3','Response contract descriptor was not upgraded.');
assert(descriptor.envelope.evidenceItemContract.requiredKeys.join(',')==='temporaryKey,kind,description,location,content','Evidence item contract is incomplete.');
assert(descriptor.stageOneOutputBounds?.prohibitedIntakeExpansion.includes('archive hashes'),'Stage 01 output bounds are missing.');

const legacyEnvelope={
  schema:'closed-loop-stage-response/2',
  jobId:project.job.JOB_ID,
  stage:1,
  operation:prompt.operation,
  promptIdentity:{instructionId:prompt.instructionId,bodySha256:prompt.bodySha256,contractSha256:prompt.contractSha256,contextSignature:prompt.contextSignature},
  scope:prompt.scope,
  responseType:'DATA_PROPOSAL',
  humanInputRequests:[],
  stageData:{
    EXACT_DELIVERABLE_REQUESTED:'Prepare the later-stage patent-application artifact set defined by the supplied invention packet.',
    ASSUMPTIONS:'No patentability, allowance, inventorship, title, or ownership result is assumed.',
    UNKNOWN_INFORMATION:'Filing jurisdiction, filing route, filing date, priority facts, and route-dependent formalities remain later-needed.',
    INPUT_SET_CONTENTS:'Controlled User Job Input INPUT-v001 and one supplied invention-disclosure ZIP packet.'
  },
  records:{},
  evidence:[{
    temporaryKey:'evidence-1',
    sourceType:'HUMAN_JOB_INPUT',
    sourceReference:'INPUT-v001',
    locator:'EXACT_USER_OBJECTIVE_VERBATIM and SUPPLIED_MATERIALS_INVENTORY',
    excerpt:'The human requested a patent-application drafting job from one supplied invention packet.',
    supports:['/stageData/EXACT_DELIVERABLE_REQUESTED','/stageData/INPUT_SET_CONTENTS']
  }],
  unresolved:[],
  warnings:[],
  attachments:[]
};
const strictText=JSON.stringify(legacyEnvelope);
const curlyText=strictText.replaceAll('"','“');
const parsed=ingestion.strictParse(curlyText);
assert(parsed.schema===legacyEnvelope.schema,'Curly-quote response did not parse after deterministic normalization.');
assert(parsed.evidence[0].kind==='HUMAN_JOB_INPUT','Legacy evidence sourceType was not mapped to kind.');
assert(parsed.evidence[0].location.includes('EXACT_USER_OBJECTIVE_VERBATIM'),'Legacy evidence locator was not mapped to location.');
assert(parsed.evidence[0].content.includes('patent-application drafting job'),'Legacy evidence excerpt was not mapped to content.');
assert(!Object.hasOwn(parsed.evidence[0],'sourceType')&&!Object.hasOwn(parsed.evidence[0],'supports'),'Legacy evidence aliases survived normalization.');

const captured=ingestion.captureRaw(project,{stage:1,text:curlyText,promptRecord:prompt});
const prepared=ingestion.prepareCaptured(captured.project,{rawResponseId:captured.rawRecord.rawResponseId,promptRecord:prompt,expectedCommittedRevision:project.revision+2});
assert(prepared.validation?.valid===true,`Normalized response did not validate: ${JSON.stringify(prepared.validation?.issues)}`);
assert(prepared.rawRecord.completeRawResponse===curlyText,'Exact raw response was not preserved.');
assert(prepared.rawRecord.originalRawResponsePreserved===true,'Raw-preservation marker is missing.');
assert(prepared.rawRecord.normalizationSteps.includes('NORMALIZED_UNICODE_JSON_QUOTES'),'Unicode-quote normalization was not audited.');
assert(prepared.rawRecord.normalizationSteps.includes('NORMALIZED_LEGACY_EVIDENCE_KEYS'),'Evidence-key normalization was not audited.');
assert(prepared.validation.issues.some(issue=>issue.code==='SAFE_RESPONSE_NORMALIZATION_APPLIED'&&issue.severity==='WARNING'),'Normalization warning was not preserved in validation evidence.');

const unsafe='{“schema”: “closed-loop-stage-response/2”, “content”: “He said "quoted text" inside the value.”}';
let unsafeError=null;
try{ingestion.strictParse(unsafe);}catch(error){unsafeError=error;}
assert(unsafeError?.code==='MALFORMED_JSON_SMART_QUOTES','Ambiguous smart-quote JSON was not rejected with the targeted code.');
assert(unsafeError.message.includes('automatic replacement was unsafe'),'Ambiguous smart-quote diagnostic is not actionable.');

const fenced=ingestion.normalizeResponseText(`\n\`\`\`json\n${strictText}\n\`\`\`\n`);
assert(fenced.steps.includes('REMOVED_SINGLE_JSON_CODE_FENCE'),'Single JSON fence was not deterministically removed.');

console.log(JSON.stringify({
  runtimeFixVersion:globalThis.closedLoopRuntimeFixes.version,
  promptContractVersion:descriptor.contractVersion,
  promptSerializationRules:true,
  stageOneBounds:true,
  smartQuoteNormalization:true,
  unsafeQuoteRejection:true,
  legacyEvidenceNormalization:true,
  exactRawPreserved:true
},null,2));
