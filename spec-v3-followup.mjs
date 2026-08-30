import fs from 'node:fs';
const r=f=>fs.readFileSync(f,'utf8'),w=(f,s)=>fs.writeFileSync(f,s),must=(v,m)=>{if(!v)throw new Error(m);},rep=(s,a,b,m)=>{must(s.includes(a),m);return s.replace(a,b);};

// Correct remaining static ownership and structured application action contract.
{
 let s=r('workflow-schema.js');
 s=rep(s,"const HUMAN_JOB_FIELDS=Object.freeze([\n  'JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM'","const HUMAN_JOB_FIELDS=Object.freeze([\n  'EXACT_USER_OBJECTIVE_VERBATIM'",'human job ownership anchor');
 s=s.replace("const APPLICATION_JOB_FIELDS=Object.freeze([","const HUMAN_DECISION_JOB_FIELDS=Object.freeze(['JOB_TITLE','JOB_OWNER']);\nconst APPLICATION_JOB_FIELDS=Object.freeze([");
 s=s.replace("function jobFieldDefinition(name){\n  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`});","function jobFieldDefinition(name){\n  if(HUMAN_DECISION_JOB_FIELDS.includes(name))return field(name,PRODUCER.HUMAN_DECISION,{nullable:true,provenanceRequired:false});\n  if(APPLICATION_JOB_FIELDS.includes(name))return field(name,PRODUCER.APPLICATION,{derivation:`Application derives ${name} from canonical project state.`,valueType:name==='NEXT_REQUIRED_ACTION'?'OBJECT':'STRING'});");
 s=s.replace("[...new Set([...HUMAN_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]","[...new Set([...HUMAN_JOB_FIELDS,...HUMAN_DECISION_JOB_FIELDS,...APPLICATION_JOB_FIELDS,...AGENT_JOB_FIELDS])]");
 s=s.replace('"EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC",','"EXECUTABLE_KIND",\n      "EXECUTABLE_SPEC",');
 s=s.replace('"TEST_ID",\n      "REQ_ID",\n      "STATUS"','"TEST_ID",\n      "REQ_ID",\n      "STATUS",\n      "EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256"');
 s=s.replace("EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),","EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),");
 s=s.replace("'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'","'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC_SHA256','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'");
 w('workflow-schema.js',s);
}

{
 let s=r('workflow-engine.js');
 const a=s.indexOf('function operationalNextAction(project,currentStage){'),b=s.indexOf('\nfunction applicationTestCapabilities()',a);must(a>=0&&b>a,'operationalNextAction function');
 const fn=`function actionObject(actionType,heading,explanation,extra={}){return {actionType,heading,explanation,primaryButton:extra.primaryButton||null,secondaryAction:extra.secondaryAction||null,filesToSend:Array.isArray(extra.filesToSend)?extra.filesToSend:[],filesToWithhold:Array.isArray(extra.filesToWithhold)?extra.filesToWithhold:[],expectedReturnFiles:Array.isArray(extra.expectedReturnFiles)?extra.expectedReturnFiles:[],blockingReason:extra.blockingReason||null,canonicalStateChanged:extra.canonicalStateChanged??false,newPromptRequired:extra.newPromptRequired??false};}
function operationalNextAction(project,currentStage){
 const stage=Number(currentStage||1),requests=unresolvedHumanRequests(project,stage);
 if(requests.length)return actionObject('CONTINUE_AGENT_CONVERSATION','Human-authority answer required','Answer only the current genuinely human-only question. Saving the answer creates a new User Job Input version, invalidates the old prompt/proposal, recalculates state, and requires a replacement prompt.',{primaryButton:'Answer question',newPromptRequired:true});
 if(stage===16){const c=stage16CorrectionPlan(project);return actionObject(c.actionType==='BLOCKED'?'BLOCKED':c.actionType==='HUMAN_AUTHORITY'?'CONTINUE_AGENT_CONVERSATION':'AI_REVIEW',c.heading,c.explanation,{primaryButton:c.actionType==='BLOCKED'?null:'Continue correction',blockingReason:c.actionType==='BLOCKED'?c.explanation:null});}
 const plan=testExecutionPlan(project),relevant=[12,22,23,24].includes(stage)?plan.items:[],blocked=relevant.find(i=>!i.executableNow);
 if(blocked)return actionObject('BLOCKED','Verification is blocked',blocked.blockingReason||('Required capability '+(blocked.requiredCapability||'UNKNOWN')+' is unavailable.'),{blockingReason:blocked.blockingReason||'Required execution evidence is unavailable.',filesToSend:blocked.handoff?.send||[],filesToWithhold:blocked.handoff?.withhold||[],expectedReturnFiles:blocked.handoff?.expectBack||[]});
 const item=relevant.find(i=>i.operatorAction!=='NO_ACTION');
 if(item){const extra={filesToSend:item.handoff?.send||[],filesToWithhold:item.handoff?.withhold||[],expectedReturnFiles:item.handoff?.expectBack||[]};if(item.operatorAction==='SEND_TO_INDEPENDENT_REVIEWER')return actionObject('AI_REVIEW','Use a fresh independent reviewer','Open a fresh independent reviewer context and send only the exact authorized package. Do not send withheld prior conclusions or generator self-evaluation.',{...extra,primaryButton:'Prepare review package'});if(item.operatorAction==='SEND_TO_TOOL_AGENT')return actionObject('EXTERNAL_AGENT_TOOL','Run with the required external capability','Use an external tool-capable agent with '+item.requiredCapability+'. Send only the exact listed files and return the contracted evidence/files.',{...extra,primaryButton:'Prepare execution package'});if(item.operatorAction==='HUMAN_INSPECTION')return actionObject('HUMAN_INSPECTION','Human inspection required','Perform the exact current inspection and preserve a human-owned observation. AI assertion cannot substitute for the inspection.',{...extra,primaryButton:'Review inspection instructions'});if(item.operatorAction==='USE_EXTERNAL_SYSTEM')return actionObject('EXTERNAL_SYSTEM','Use the required external system','Use '+item.requiredCapability+' and return evidence attributable to that system.',{...extra,primaryButton:'Prepare external-system package'});}
 if(relevant.length&&relevant.every(i=>i.operatorAction==='NO_ACTION'))return actionObject('RUN_APP_TESTS','Run deterministic verification','No external action is required. The application will run the current ready Test IR against verified current bytes and record application-owned results.',{primaryButton:'Run tests'});
 if(stage===4)return actionObject('CONTINUE_AGENT_CONVERSATION','Compile the complete requirement specification','Use the current Stage 04 instruction. It contains the application-enumerated obligation universe assembled from prior supplied and accepted project information. Do not attach, resend, retype, or summarize the original intent material.',{primaryButton:'Copy current instruction'});
 return actionObject('CONTINUE_AGENT_CONVERSATION','Perform Stage '+String(stage).padStart(2,'0'),'Use the current controlling instruction and perform the stated stage task now. Continue the external conversation until the stage is ready; then return one final strict JSON response and any explicitly required files.',{primaryButton:'Copy current instruction'});
}
function operationalNextActionText(action){if(!action)return '';if(typeof action==='string')return action;return [action.heading,action.explanation,action.blockingReason].filter(Boolean).join('. ');}`;
 s=s.slice(0,a)+fn+s.slice(b);
 s=s.replace("project.job.NEXT_REQUIRED_ACTION=completed===30?'Preserve the completed workflow and exact release evidence.':operationalNextAction(project,currentStage);","project.job.NEXT_REQUIRED_ACTION=completed===30?actionObject('COMPLETE','Workflow complete','Preserve the completed workflow and exact release evidence.',{canonicalStateChanged:false,newPromptRequired:false}):operationalNextAction(project,currentStage);");
 s=s.replace('globalThis.closedLoopWorkflowEngine=Object.freeze({','globalThis.closedLoopWorkflowEngine=Object.freeze({actionObject,operationalNextActionText,');
 w('workflow-engine.js',s);
}

// UI consumes the structured action and uses the single Test IR runtime authority.
{
 let s=r('app-core.js');
 s=s.replace("let core,schema,engine,ingestion,projectStore,projects=[]","let core,schema,engine,ingestion,projectStore,testRuntime,projects=[]");
 s=s.replace("function stageLocked(n){","const actionText=value=>engine?.operationalNextActionText?engine.operationalNextActionText(value):(typeof value==='string'?value:JSON.stringify(value||{}));\nfunction stageLocked(n){");
 s=s.replace("if(![core.SCHEMA,'human-project/30'].includes(raw?.schema))","if(![core.SCHEMA,'closed-loop-project/2','human-project/30'].includes(raw?.schema))");
 s=s.replace("if(raw.schema&&![core.SCHEMA,'human-project/30'].includes(raw.schema))","if(raw.schema&&![core.SCHEMA,'closed-loop-project/2','human-project/30'].includes(raw.schema))");
 s=s.replace("${esc(current.job.NEXT_REQUIRED_ACTION||'No next action recorded.')}","${esc(actionText(current.job.NEXT_REQUIRED_ACTION)||'No next action recorded.')}");
 s=s.replace("${esc(current.job.NEXT_REQUIRED_ACTION)}</span>","${esc(actionText(current.job.NEXT_REQUIRED_ACTION))}</span>");
 const old="async function executeTestWorker(spec,artifacts,timeoutMs=10000){return new Promise((resolve,reject)=>{const worker=new Worker('test-worker.js'),requestId='TEST-RUN-'+crypto.randomUUID(),timer=setTimeout(()=>{worker.terminate();reject(new Error('Deterministic test exceeded its execution time limit.'));},timeoutMs);worker.onmessage=event=>{if(event.data?.requestId!==requestId)return;clearTimeout(timer);worker.terminate();resolve(event.data.result);};worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(new Error(event.message||'Deterministic test worker failed.'));};worker.postMessage({requestId,spec,artifacts});});}";
 must(s.includes(old),'duplicated Stage22 worker helper');s=s.replace(old,"async function executeTestWorker(spec,artifacts){return testRuntime.execute({spec,artifacts});}");
 s=s.replace("const result=await executeTestWorker(engine.recordValue(test,'EXECUTABLE_SPEC'),artifactPayload);","const result=await testRuntime.executeTest(test,artifactPayload,{});");
 const init="core=globalThis.closedLoopCore;schema=globalThis.closedLoopWorkflowSchema;engine=globalThis.closedLoopWorkflowEngine;ingestion=globalThis.closedLoopResponseIngestion;projectStore=globalThis.closedLoopProjectStore;";
 must(s.includes(init),'app init anchor');s=s.replace(init,init+"testRuntime=globalThis.closedLoopTestRuntime;");
 s=s.replace("if(!core||!schema||!engine||!ingestion||!projectStore)","if(!core||!schema||!engine||!ingestion||!projectStore||!testRuntime)");
 w('app-core.js',s);
}

// Execution package accepts the complete required identity surface.
{
 let s=r('project-store.js');
 s=s.replace("async function createExecutionPackage({project,stage,testIds=[],productId=null}={}){","async function createExecutionPackage({project,jobId=null,stage,operation='COMPLETE',testIds=[],productId=null,runId=null,reviewerAliasContext=null}={}){");
 s=s.replace("jobId=projectIdentity(project),ids=","canonicalJobId=projectIdentity(project);if(jobId&&String(jobId)!==canonicalJobId)throw storageError('Execution package jobId does not match the canonical project.','EXECUTION_PACKAGE_JOB_MISMATCH');const jobId=canonicalJobId,ids=");
 s=s.replace("plan=engine.executionHandoff(project,{stage:Number(stage),testIds:ids})","plan=engine.executionHandoff(project,{stage:Number(stage),operation,testIds:ids,runId,reviewerAliasContext})");
 s=s.replace("jobId,stage:Number(stage),productId:","jobId,stage:Number(stage),operation,runId:runId||null,reviewerAliasContext:reviewerAliasContext||null,productId:");
 w('project-store.js',s);
}

// Extend focused conformance tests for these discovered mismatches.
{
 let s=r('verify-spec-v3.mjs');
 const insert=`\nassert(schema.JOB_FIELDS.JOB_TITLE.producer===schema.PRODUCER.HUMAN_DECISION&&schema.JOB_FIELDS.JOB_OWNER.producer===schema.PRODUCER.HUMAN_DECISION,'Job title/owner producer class is wrong.');\nassert(schema.RECORD_SCHEMAS.tests.fieldDefinitions.EXECUTABLE_SPEC_VERSION.producer===schema.PRODUCER.APPLICATION,'Test IR version is not application-owned.');\nconst action=engine.operationalNextAction(p,4);assert(action&&typeof action==='object'&&action.actionType&&Object.prototype.hasOwnProperty.call(action,'canonicalStateChanged')&&Object.prototype.hasOwnProperty.call(action,'newPromptRequired'),'Next action is not a structured application object.');\nconst appSource=fs.readFileSync('app-core.js','utf8');assert(!appSource.includes("new Worker('test-worker.js')"),'app-core still duplicates Test IR worker coordination.');assert(appSource.includes("'closed-loop-project/2'"),'UI import boundary does not accept /2 for deterministic migration.');\n`;
 s=s.replace("console.log(JSON.stringify({projectSchema:",insert+"console.log(JSON.stringify({projectSchema:");
 w('verify-spec-v3.mjs',s);
}
console.log('second-pass v3 conformance corrections complete');
