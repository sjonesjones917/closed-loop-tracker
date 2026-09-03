import fs from 'node:fs';

const path='response-ingestion.js';
let source=fs.readFileSync(path,'utf8');
const marker="const expectedOperation=promptRecord?.operation||contract?.operations?.[0];const operationContract=schema.operationContract(stageNumber,expectedOperation);";
if(!source.includes(marker))throw new Error('Expected operation-contract validation marker was not found exactly once.');
if((source.match(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length!==1)throw new Error('Operation-contract validation marker is ambiguous.');
const enforcement="if(operationContract?.responseEnvelopeAllowed===false)issues.push(issue('EXTERNAL_RESPONSE_NOT_ALLOWED','/operation',`Operation ${expectedOperation||'UNKNOWN'} does not accept an external response envelope.`));";
if(!source.includes(enforcement))source=source.replace(marker,marker+enforcement);
fs.writeFileSync(path,source);

const testPath='verify-operation-authority-closure.mjs';
let test=fs.readFileSync(testPath,'utf8');
const loadMarker="for(const file of ['workbook.js','hash.js','workflow-schema.js']){";
if(!test.includes(loadMarker))throw new Error('Authority runtime load marker not found.');
test=test.replace(loadMarker,"for(const file of ['workbook.js','hash.js','workflow-schema.js']){");
const runtimeMarker="const schema=globalThis.closedLoopWorkflowSchema;";
const executable=`\nfor(const file of ['test-runtime.js','workflow-engine.js','response-ingestion.js']){\n  vm.runInThisContext(fs.readFileSync(new URL(\`./\${file}\`,import.meta.url),'utf8'),{filename:file});\n}\nconst state=globalThis.closedLoopCore.createBlankState('JOB-AUTHORITY-REJECTION');\nstate.job.CONTRACT_PROFILE_ID='closed-loop-completion-profile/1';\nconst forbiddenEnvelope={schema:'closed-loop-stage-response/3',contractProfileId:'closed-loop-completion-profile/1',jobId:state.job.JOB_ID,stage:18,operation:'COMPLETE',promptIdentity:{instructionId:'INSTRUCTION-AUTHORITY',bodySha256:'0'.repeat(64),contractSha256:'1'.repeat(64),contextSignature:'2'.repeat(64)},scope:{},responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{},evidence:[],unresolved:[],warnings:[],attachments:[]};\nconst forbiddenPrompt={stage:18,operation:'COMPLETE',instructionId:'INSTRUCTION-AUTHORITY',bodySha256:'0'.repeat(64),contractSha256:'1'.repeat(64),contextSignature:'2'.repeat(64),scope:{},promptEngineVersion:null};\nconst forbiddenValidation=globalThis.closedLoopResponseIngestion.validateEnvelope(state,forbiddenEnvelope,{stage:18,promptRecord:forbiddenPrompt,rawSha256:'3'.repeat(64),files:[]});\nassert.ok(forbiddenValidation.issues.some(item=>item.code==='EXTERNAL_RESPONSE_NOT_ALLOWED'),'Stage 18 COMPLETE external response envelope must be rejected by executable ingestion validation');\n`;
if(!test.includes('forbiddenValidation.issues.some'))test=test.replace(runtimeMarker,executable+'\n'+runtimeMarker);
fs.writeFileSync(testPath,test);
