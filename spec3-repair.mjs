import fs from 'node:fs';
import crypto from 'node:crypto';
const r=f=>fs.readFileSync(f,'utf8'),w=(f,s)=>fs.writeFileSync(f,s);
function one(s,a,b,label){const i=s.indexOf(a);if(i<0)throw new Error(label+': anchor missing');if(s.indexOf(a,i+a.length)>=0)throw new Error(label+': anchor not unique');return s.slice(0,i)+b+s.slice(i+a.length);}
function maybe(s,a,b){return s.includes(a)?s.replace(a,b):s;}

// VISUAL INVARIANT: remove only the unauthorized later fixed-height override. The earlier established responsive CSS remains untouched.
let html=r('index.html');
html=maybe(html,'.expandable-prompt{height:280px;max-height:280px}.expandable-prompt.expanded{height:auto;max-height:none}\n','');
if(!html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'))throw new Error('Established prompt preview CSS is missing.');
if(!html.includes("worker-src 'self'"))html=one(html,"connect-src 'self'; object-src 'none';","connect-src 'self'; worker-src 'self'; object-src 'none';",'worker CSP');

// PROJECT CONTRACT /3 + Stage 16 visible terminology + deterministic /2 migration.
let workbook=r('workbook.js');
workbook=one(workbook,"const PROJECT_SCHEMA='closed-loop-project/2';","const PROJECT_SCHEMA='closed-loop-project/3';",'project schema');
workbook=one(workbook,"'REVISE THE RESPONSIBLE LAYER'","'CORRECT THE ROOT CAUSE'",'Stage16 title');
const legacyAnchor="  if(p.schema!=='human-project/30')throw new Error(`Unsupported project schema: ${p.schema||'MISSING'}`);";
const migrate2=`  if(p.schema==='closed-loop-project/2'){
    const migrated=JSON.parse(JSON.stringify(p)),original=JSON.parse(JSON.stringify(p));
    migrated.schema=PROJECT_SCHEMA;migrated.workflow=WORKFLOW_ID;migrated.stageCount=STAGE_COUNT;migrated.revision=Number.isInteger(migrated.revision)?migrated.revision:0;
    migrated.projectData=migrated.projectData&&typeof migrated.projectData==='object'?migrated.projectData:{};
    migrated.projectData.migrationArchives=Array.isArray(migrated.projectData.migrationArchives)?migrated.projectData.migrationArchives:[];
    migrated.projectData.historicalImportRecords=Array.isArray(migrated.projectData.historicalImportRecords)?migrated.projectData.historicalImportRecords:[];
    migrated.projectData.migrationArchives.push({kind:'MIGRATION_SOURCE',schema:'closed-loop-project/2',preservedAt:new Date().toISOString(),payload:original});
    if(migrated.projectData.stageRecords&&Object.keys(migrated.projectData.stageRecords).length){migrated.projectData.historicalImportRecords.push({kind:'LEGACY_STAGE_RECORDS',schema:'closed-loop-project/2',records:JSON.parse(JSON.stringify(migrated.projectData.stageRecords))});migrated.projectData.stageRecords={};}
    if(migrated.projectData.fullProject&&Object.keys(migrated.projectData.fullProject).length){migrated.projectData.migrationArchives.push({kind:'LEGACY_NESTED_PROJECT',schema:'closed-loop-project/2',preservedAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(migrated.projectData.fullProject))});delete migrated.projectData.fullProject;}
    return migrated;
  }
${legacyAnchor}`;
workbook=one(workbook,legacyAnchor,migrate2,'/2 migration');
w('workbook.js',workbook);

// RESPONSE /3, producer partitions, and canonical Test IR spelling/registry.
let schema=r('workflow-schema.js');
schema=one(schema,"const RESPONSE_SCHEMA='closed-loop-stage-response/2';","const RESPONSE_SCHEMA='closed-loop-stage-response/3';",'response schema');
schema=one(schema,"const HUMAN_JOB_FIELDS=Object.freeze([\n  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM'","const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\nconst HUMAN_JOB_FIELDS=Object.freeze([\n  'EXACT_USER_OBJECTIVE_VERBATIM'",'human decision partition');
const jfOld="  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});\n  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});";
const jfNew="  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});\n  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{provenanceRequired:false,nullable:true});\n  if(HUMAN_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN,{requiredAtStage:name==='EXACT_USER_OBJECTIVE_VERBATIM'?1:null,provenanceRequired:false,valueType:name==='DESIRED_SOURCE_COUNT'?'INTEGER':'STRING',nullable:name!=='EXACT_USER_OBJECTIVE_VERBATIM'});";
schema=one(schema,jfOld,jfNew,'job field producer');
schema=one(schema,"[...new Set([...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]","[...new Set([...HUMAN_DECISION_JOB_FIELDS,...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]",'job field union');
schema=schema.replaceAll("'CUSTOM_PIPELINE'","'TEST_IR'");
if(!schema.includes("'PARSE_XML'"))schema=one(schema,"'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','SELECT_JSON_PATH'","'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML'",'XML operations');
schema=schema.replaceAll('closed-loop-workflow-schema/2','closed-loop-workflow-schema/3');
if(!schema.includes('HUMAN_DECISION_JOB_FIELDS,'))schema=one(schema,'JOB_FIELDS,HUMAN_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,','JOB_FIELDS,HUMAN_JOB_FIELDS,HUMAN_DECISION_JOB_FIELDS,APPLICATION_JOB_FIELDS,AGENT_JOB_FIELDS,','export producer partition');
w('workflow-schema.js',schema);

// TEST IR runtime: exact kind, required XML primitives, explicit CSV semantics, and centralized resource limits.
let runtime=r('test-runtime.js');
runtime=runtime.replaceAll("'CUSTOM_PIPELINE'","'TEST_IR'");
if(!runtime.includes("'PARSE_XML'"))runtime=one(runtime,"'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','SELECT_JSON_PATH',","'LOAD_ARTIFACT','READ_BYTES','DECODE_UTF8','PARSE_JSON','PARSE_CSV','PARSE_XML','SELECT_JSON_PATH','SELECT_XML',",'runtime XML ops');
runtime=one(runtime,"const LIMITS=Object.freeze({maxSteps:64,maxTextBytes:16*1024*1024,maxCollectionItems:100000,maxRegexLength:2000,maxCsvCells:250000});","const LIMITS=Object.freeze({maxSteps:64,maxInputBytes:32*1024*1024,maxTextBytes:16*1024*1024,maxCollectionItems:100000,maxParsedDepth:64,maxRegexLength:2000,maxRegexInputBytes:4*1024*1024,maxCsvCells:250000,workerTimeoutMs:10000,maxArchiveExpandedBytes:64*1024*1024});",'central limits');
const xmlFns=`function parseXmlRestricted(text){
  const source=String(text||'');if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('DTD and entity declarations are unsupported.');
  const root={name:'#document',attributes:{},children:[],text:''},stack=[root],token=/<[^>]+>|[^<]+/g;let m;
  while((m=token.exec(source))){const part=m[0];if(part.startsWith('<?')||part.startsWith('<!--'))continue;if(part.startsWith('</')){const name=part.slice(2,-1).trim();if(stack.length<2||stack.at(-1).name!==name)throw new Error('Malformed XML closing element.');stack.pop();continue;}if(part.startsWith('<')){const self=/\\/>$/.test(part),inner=part.slice(1,self?-2:-1).trim(),tag=inner.match(/^([A-Za-z_][\\w:.-]*)([\\s\\S]*)$/);if(!tag)throw new Error('Unsupported XML element syntax.');const node={name:tag[1],attributes:{},children:[],text:''},attrs=tag[2].trim();if(attrs){const re=/([A-Za-z_][\\w:.-]*)\\s*=\\s*(?:"([^"]*)"|'([^']*)')/g;let a;while((a=re.exec(attrs)))node.attributes[a[1]]=a[2]??a[3]??'';if(attrs.replace(re,'').trim())throw new Error('Unsupported XML attribute syntax.');}stack.at(-1).children.push(node);if(!self)stack.push(node);continue;}if(part.trim())stack.at(-1).text+=part;}
  if(stack.length!==1||root.children.length!==1)throw new Error('XML must contain exactly one root element.');return root.children[0];
}
function selectXmlRestricted(root,selector){const text=String(selector||'').trim();if(!/^\\/[A-Za-z_][\\w:.-]*(?:\\/[A-Za-z_][\\w:.-]*)*(?:\\/@[A-Za-z_][\\w:.-]*)?$/.test(text))throw new Error('Unsupported XML selector syntax.');const parts=text.slice(1).split('/');let nodes=[root];if(parts[0]===root.name)parts.shift();for(const part of parts){if(part.startsWith('@')){if(nodes.length!==1||!(part.slice(1) in nodes[0].attributes))throw new Error('XML attribute selector did not resolve exactly once.');return nodes[0].attributes[part.slice(1)];}nodes=nodes.flatMap(n=>n.children.filter(c=>c.name===part));if(!nodes.length)throw new Error('XML selector matched no nodes.');}return nodes.length===1?nodes[0]:nodes;}
`;
if(!runtime.includes('function parseXmlRestricted'))runtime=one(runtime,'function selectJsonPath(value,path){',xmlFns+'function selectJsonPath(value,path){','XML parser');
runtime=one(runtime,"      case 'PARSE_CSV':value=parseCsv(String(value));break;\n      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;","      case 'PARSE_CSV':{if(step.encoding!=='UTF-8'||typeof step.delimiter!=='string'||step.delimiter.length!==1||typeof step.header!=='boolean'||!['LF','CRLF','AUTO'].includes(step.newline)||step.quote!=='\"')throw new Error('PARSE_CSV requires explicit delimiter, header, quote, newline, and UTF-8 encoding.');if(step.delimiter!==',')throw new Error('Version 1 CSV runtime currently supports only comma delimiter.');value=parseCsv(String(value));if(step.header&&value.length){const head=value.shift();value=value.map(row=>Object.fromEntries(head.map((key,i)=>[key,row[i]??''])));}break;}\n      case 'PARSE_XML':value=parseXmlRestricted(String(value));break;\n      case 'SELECT_JSON_PATH':value=selectJsonPath(value,step.path);break;\n      case 'SELECT_XML':value=selectXmlRestricted(value,step.selector);break;",'runtime parse ops');
w('test-runtime.js',runtime);

// Worker must be same-origin and time-limited by caller; it imports the shared build identity below.
let worker=r('test-worker.js');

// Engine must query the runtime, and it owns durable Stage 01 and Stage 04 enumeration.
let engine=r('workflow-engine.js');
engine=maybe(engine,"function applicationTestCapabilities(){return Object.freeze([schema.TEST_IR.capability]);}\nfunction applicationTestSupported(test){return schema.validateTestIRTest(test).valid;}","function applicationTestCapabilities(){const rt=globalThis.closedLoopTestRuntime;return Object.freeze(rt?.capabilities?rt.capabilities():[]);}\nfunction applicationTestSupported(test){const rt=globalThis.closedLoopTestRuntime;return Boolean(rt?.supports&&rt.supports(test)&&schema.validateTestIRTest(test).valid);}");
const manifestFns=`
function stage01IntakeManifest(project){
  ensureShape(project);const inputVersion=String(project.job?.CURRENT_INPUT_VERSION||'UNKNOWN'),entries=[],seen=new Set();
  const add=(sourceKind,sourceIdentity,location,value)=>{if(value===undefined||value===null||String(value).trim()==='')return;const rawValueHash=hash.sha256Value(value),inputId='INPUT-'+hash.sha256Value({inputVersion,sourceKind,sourceIdentity,location,rawValueHash}).slice(0,20).toUpperCase();if(seen.has(inputId))return;seen.add(inputId);entries.push({inputId,sourceKind,sourceIdentity,location,rawValueHash,value:clone(value)});};
  for(const [fieldName,definition] of Object.entries(schema.JOB_FIELDS||{}))if([schema.PRODUCER.HUMAN,schema.PRODUCER.HUMAN_DECISION].includes(definition.producer))add('JOB_FIELD',fieldName,fieldName,project.job?.[fieldName]);
  for(const [i,answer] of safe(project.projectData?.humanInputAnswers).entries())add('HUMAN_ANSWER',String(answer.answerId||answer.requestId||i+1),String(answer.requestId||i+1),answer.answer??answer.value??answer.response??'');
  return {schema:'closed-loop-intake-manifest/1',jobId:String(project.job?.JOB_ID||''),inputVersion,entries,coverageDenominator:entries.length,manifestSha256:hash.sha256Value(entries.map(x=>({inputId:x.inputId,rawValueHash:x.rawValueHash})))};
}
function stage04ObligationManifest(project){
  ensureShape(project);const scope=currentScope(project),entries=[],seen=new Set();const add=(sourceKind,sourceIdentity,location,value)=>{if(value===undefined||value===null)return;const text=typeof value==='string'?value.trim():JSON.stringify(value);if(!text||['NONE','UNKNOWN','NOT APPLICABLE','N/A'].includes(text.toUpperCase()))return;const rawValueHash=hash.sha256Value(value),obligationId='OBL-'+hash.sha256Value({sourceKind,sourceIdentity,location,rawValueHash,inputVersion:scope.inputVersion,sourceSetVersion:scope.sourceSetVersion}).slice(0,20).toUpperCase();if(seen.has(obligationId))return;seen.add(obligationId);entries.push({obligationId,sourceKind,sourceIdentity,location,rawValueHash,value:clone(value)});};
  for(const item of stage01IntakeManifest(project).entries)add('HUMAN_INPUT',item.inputId,item.location,item.value);
  for(const fieldName of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])add('STAGE01_JOB_DEFINITION','STAGE-01',fieldName,project.job?.[fieldName]);
  for(const record of recordsForCurrentScope(project,'intentStatements'))if(upper(recordValue(record,'REQUIREMENT_RELEVANCE'))==='REQUIREMENT')add('STAGE01_INTENT',recordId(record,'intentStatements'),'EXACT_STATEMENT',recordValue(record,'EXACT_STATEMENT'));
  for(const record of recordsForCurrentScope(project,'research'))for(const fieldName of ['MANDATORY_STATEMENTS','RECOMMENDATIONS','OPTIONAL_PRACTICES','PROHIBITIONS','EXCEPTIONS','DEPENDENCIES','APPLICABILITY_FACTS','RESTRICTIONS','INVALIDATING_MATERIAL'])add('STAGE03_RESEARCH',recordId(record,'research'),fieldName,recordValue(record,fieldName));
  for(const record of recordsForCurrentScope(project,'candidateRequirements'))add('STAGE03_CANDIDATE_OBLIGATION',recordId(record,'candidateRequirements'),'CANDIDATE_OBLIGATION',recordValue(record,'CANDIDATE_OBLIGATION'));
  return {schema:'closed-loop-obligation-manifest/1',jobId:String(project.job?.JOB_ID||''),scope,entries,obligationCount:entries.length,manifestSha256:hash.sha256Value(entries.map(x=>({obligationId:x.obligationId,rawValueHash:x.rawValueHash})))};
}
`;
if(!engine.includes('function stage01IntakeManifest'))engine=one(engine,'function operationalMetrics(project){',manifestFns+'function operationalMetrics(project){','accounting manifests');
if(engine.includes('operationalNextAction,operationalMetrics'))engine=engine.replace('operationalNextAction,operationalMetrics','operationalNextAction,stage01IntakeManifest,stage04ObligationManifest,operationalMetrics');
w('workflow-engine.js',engine);

// Prompt authority: project data is operative input, capture once, manifests are explicit, no domain branches.
let prompt=r('prompt-engine.js');
prompt=prompt.replace("const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/26';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/27';");
prompt=prompt.replace("definition?.producer==='HUMAN'","['HUMAN','HUMAN_DECISION'].includes(definition?.producer)");
if(!prompt.includes('function persistedHumanAnswersBlock'))prompt=one(prompt,'function humanInputBlock(job){',"function persistedHumanAnswersBlock(state){const answers=state?.projectData?.humanInputAnswers||[];return answers.length?answers.map((x,i)=>`${x.answerId||x.requestId||`ANSWER-${String(i+1).padStart(3,'0')}`}:\\n${show(x.answer??x.value??x.response??'')}`).join('\\n\\n'):'NONE';}\nfunction humanInputBlock(job){",'persisted human answers');
const bodySig='function body(stage,state,operation,scope){';const bi=prompt.indexOf(bodySig);if(bi<0)throw new Error('prompt body missing');const br=prompt.indexOf('return `',bi);if(br<0)throw new Error('prompt return missing');if(!prompt.includes('PROJECT DATA EXECUTION RULE — MANDATORY')){const d="PROJECT DATA EXECUTION RULE — MANDATORY\\nProject data embedded in this prompt is OPERATIVE INPUT. Use every relevant supplied and canonical project fact to perform the current stage transformation; do not merely restate, summarize, inventory, acknowledge, or discuss it. Project-relevant information supplied by the human is supplied once. If it exists in current canonical project state, persisted human answers, or this exact instruction, never ask the human to repeat, retype, summarize, resend, reopen, or reattach it. If required prior-stage capture is incomplete, return the exact earlier-stage deficiency and responsible stage instead of transferring that work back to the human. Never replace required stage work with generic advice about how somebody else should do it.\\n\\n";prompt=prompt.slice(0,br)+'return `'+d+prompt.slice(br+'return `'.length);}
// Insert persisted answers beside human input if not already present.
if(!prompt.includes('PERSISTED HUMAN-AUTHORITY ANSWERS — DO NOT ASK FOR THESE AGAIN')){const anchor='CURRENT USER JOB INPUT — HUMAN AUTHORITY';const ai=prompt.indexOf(anchor,bi);if(ai>0){const lineEnd=prompt.indexOf('\\n\\n',ai);prompt=prompt.slice(0,lineEnd+4)+"PERSISTED HUMAN-AUTHORITY ANSWERS — DO NOT ASK FOR THESE AGAIN\\n${persistedHumanAnswersBlock(state)}\\n\\n"+prompt.slice(lineEnd+4);}}
// Put accounting universes immediately before the stage task.
if(!prompt.includes('APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST'))prompt=prompt.replace('STAGE-SPECIFIC TASK\\n${procedures[stage]}',"${stage===1?'APPLICATION-OWNED INTAKE COVERAGE MANIFEST\\n'+show(workflow.stage01IntakeManifest(state))+'\\n\\n':''}${stage===4?'APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST\\n'+show(workflow.stage04ObligationManifest(state))+'\\n\\n':''}STAGE-SPECIFIC TASK\\n${procedures[stage]}");
// Make Stage 04 consume the app-enumerated universe, not rediscover inputs or request them again.
prompt=prompt.replace("4:'Compile atomic requirement proposals only from the canonical Stage 01 intentStatements ledger, Stage 03 candidateRequirements, and legitimately applicable Stage 03 external-source research.","4:'Compile the complete atomic requirement specification from the APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST in this prompt. Every obligationId in that manifest must receive a valid semantic disposition and no obligation may disappear. Use the canonical Stage 01 intake/job definition, intentStatements, Stage 03 candidateRequirements, and legitimately applicable Stage 03 external-source research already supplied by the application. Never ask the human to resend, retype, summarize, reopen, select, or reattach any project information already captured. The application owns the obligation universe; you own semantic atomization and mapping. The original Stage 01 intent file is prohibited input: never request it, attach it, resend it, reopen it, or rely on an earlier conversation that contains it.");
// Stage 06 publishes exact runtime grammar/capabilities rather than vague native support.
prompt=prompt.replace("6:'Define this job’s verification suite before any production instruction is authored.","6:'Define this job’s verification suite before any production instruction is authored. When APPLICATION_DETERMINISTIC is selected, compile the proposition to the application-owned closed-loop-test-spec/1 Test IR using only the registered operations and binding contract published in this prompt; do not invent runtime semantics. If supported primitives cannot faithfully establish the proposition, choose the correct non-native route rather than weakening the proposition.");
for(const forbidden of ['PATENT / REGULATED FILING','SOFTWARE / MULTI-FILE SYSTEM','BUILDING / ARCHITECTURE / AEC','PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'])if(prompt.includes(forbidden))throw new Error('Hard-coded project-subject prompt branch remains: '+forbidden);
w('prompt-engine.js',prompt);

// Load the Test IR runtime in the required dependency order.
html=r('index.html');
const sm=html.match(/<script defer src="workflow-schema\.js\?v=([^"]+)"><\/script>/);if(!sm)throw new Error('schema script tag missing');if(!html.includes('<script defer src="test-runtime.js'))html=one(html,sm[0],sm[0]+`\n<script defer src="test-runtime.js?v=${sm[1]}"></script>`,'test runtime script');
// One shared build/cache identity from all nine runtime files.
const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const blobSha=f=>{const b=fs.readFileSync(f);return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex')};const manifest=runtimeFiles.map(f=>`${f}:${blobSha(f)}\n`).join('');const token='runtime-'+crypto.createHash('sha256').update(manifest).digest('hex').slice(0,16);html=html.replace(/runtime-[a-zA-Z0-9-]+/g,token);w('index.html',html);worker=worker.replace(/runtime-[a-zA-Z0-9-]+/g,token);w('test-worker.js',worker);

// Update the runtime hash test's file set, without weakening its integrity check.
let vh=r('verify-hash.mjs');vh=vh.replace("const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];","const runtimeFiles=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];");w('verify-hash.mjs',vh);

// Add direct conformance proof for the controlling identities and capture-once behavior.
w('verify-spec3-contract.mjs',`import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});const core=closedLoopCore,schema=closedLoopWorkflowSchema,rt=closedLoopTestRuntime,engine=closedLoopWorkflowEngine,prompt=closedLoopPromptEngine;assert.equal(core.PROJECT_SCHEMA,'closed-loop-project/3');assert.equal(schema.RESPONSE_SCHEMA,'closed-loop-stage-response/3');assert.equal(core.WORKFLOW_ID,'mobile-closed-loop/30');assert.equal(core.STAGE_COUNT,30);assert.equal(core.STAGES[15].title,'CORRECT THE ROOT CAUSE');assert.equal(schema.JOB_FIELDS.JOB_TITLE.producer,'HUMAN_DECISION');assert.equal(schema.JOB_FIELDS.JOB_OWNER.producer,'HUMAN_DECISION');assert(rt.OPS.includes('PARSE_XML')&&rt.OPS.includes('SELECT_XML'));const html=fs.readFileSync('index.html','utf8');assert(!html.includes('.expandable-prompt{height:280px;max-height:280px}'));assert(html.includes('.expandable-prompt{max-height:280px}.expandable-prompt.expanded{max-height:none}'));assert(html.indexOf('workflow-schema.js')<html.indexOf('test-runtime.js')&&html.indexOf('test-runtime.js')<html.indexOf('workflow-engine.js'));assert(html.includes("worker-src 'self'"));const legacy=core.createBlankState('J');legacy.schema='closed-loop-project/2';legacy.projectData.extensionX={x:1};const migrated=core.migrateState(legacy);assert.equal(migrated.schema,'closed-loop-project/3');assert.deepEqual(migrated.projectData.extensionX,{x:1});const p=core.createBlankState('CAPTURE');Object.assign(p.job,{EXACT_USER_OBJECTIVE_VERBATIM:'Build the requested thing',EXPLICIT_USER_REQUIREMENTS:'Never ask me for the same project data twice',SUPPLIED_MATERIALS_INVENTORY:'intent.pdf',EXACT_DELIVERABLE_REQUESTED:'finished product',INPUT_SET_CONTENTS:'captured project requirements'});engine.ensureShape(p);engine.recalculate(p);const intake=engine.stage01IntakeManifest(p),ob=engine.stage04ObligationManifest(p);assert(intake.entries.length>=3);assert(ob.entries.some(x=>String(x.value).includes('Never ask me')));const pr=prompt.buildPromptRecord(4,p).prompt;for(const t of ['PROJECT DATA EXECUTION RULE — MANDATORY','APPLICATION-OWNED STAGE 04 OBLIGATION MANIFEST','Never ask the human','Never ask me for the same project data twice'])assert(pr.includes(t),t);console.log(JSON.stringify({projectSchema:core.PROJECT_SCHEMA,responseSchema:schema.RESPONSE_SCHEMA,stageCount:core.STAGE_COUNT,intake: intake.entries.length,obligations:ob.entries.length,visualBaselineRestored:true,testRuntimeLoaded:true}));`);

console.log(JSON.stringify({repaired:true,token}));
