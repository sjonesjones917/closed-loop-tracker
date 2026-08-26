import fs from 'node:fs';

function replaceOnce(text,oldValue,newValue,label){
  const count=text.split(oldValue).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one match, got ${count}`);
  return text.replace(oldValue,newValue);
}

let s=fs.readFileSync('app-core.js','utf8');
const anchor='function promptMatches(record,n,options){';
const helper=`const operatorScopeKeys=['inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId'];
function currentOperatorScope(n){const j=current.job||{},options=promptOptions(n),candidate=engine.records(current,'candidateFreezes').filter(x=>x?.active!==false&&!x?.invalidatedBy).at(-1);return {inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:j.CURRENT_ITERATION||null,candidateId:candidate?engine.recordId(candidate,'candidateFreezes'):null,runId:options.scope?.runId||null,contextId:options.scope?.contextId||null,baselineId:j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null,productId:j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null};}
function operatorLaneMatches(item,n){if(Number(item?.stage)!==Number(n))return false;const operation=String(item?.envelope?.operation||item?.operation||'COMPLETE'),selected=selectedOperation(n);if(operation!==selected)return false;const actual=item?.envelope?.scope||item?.scope||{},expected=currentOperatorScope(n),required=schema.operationContract(n,operation)?.scopeRequirements||[];for(const key of operatorScopeKeys){const av=actual?.[key],ev=expected?.[key];if(av!==undefined&&av!==null&&av!==''&&ev!==undefined&&ev!==null&&ev!==''&&String(av)!==String(ev))return false;}for(const key of required){if(key==='projectRevision')continue;if(String(actual?.[key]??'')!==String(expected?.[key]??''))return false;}return true;}
function validationLaneRecord(validation){return safe(current.projectData.generatedPrompts).find(x=>(x.instructionId||x.promptId)===validation?.promptId)||validation;}
function acceptedLaneChanges(n){return engine.acceptedChanges(current,n).filter(x=>operatorLaneMatches(x,n));}
`;
s=replaceOnce(s,anchor,helper+anchor,'lane helper');
s=replaceOnce(s,"function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n).at(-1);if(!v||v.valid)return '';","function validationMarkup(n){const v=safe(current.projectData.responseValidations).filter(x=>Number(x.stage)===n&&!x.valid&&operatorLaneMatches(validationLaneRecord(x),n)).at(-1);if(!v)return '';",'validation lane');
s=replaceOnce(s,"function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===n&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);if(!p)return validationMarkup(n);","function proposalMarkup(n){const p=safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n)).at(-1);if(!p)return validationMarkup(n);",'proposal lane');
s=replaceOnce(s,'${engine.acceptedChanges(current,n).length&&!current.isRetainedTestProject?`<details class="record-card"><summary>Refine accepted result','${acceptedLaneChanges(n).length&&!current.isRetainedTestProject?`<details class="record-card"><summary>Refine accepted result','refinement visibility');
s=replaceOnce(s,"function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>Number(x.stage)===current.activeStage&&x.status==='PENDING_OPERATOR_REVIEW').at(-1);}","function pendingProposal(){return safe(current.projectData.responseProposals).filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage)).at(-1);}",'pending proposal lane');
fs.writeFileSync('app-core.js',s);

s=fs.readFileSync('index.html','utf8');
const token='runtime-control-evidence-20260826-r2';
const tokenCount=s.split(token).length-1;
if(tokenCount!==8)throw new Error(`runtime token expected 8 matches, got ${tokenCount}`);
fs.writeFileSync('index.html',s.replaceAll(token,'runtime-operator-lane-20260826-r3'));

s=fs.readFileSync('verify-complete.mjs','utf8');
const marker='// Explicit workflow gates cannot be bypassed by manual assertions.';
const test=`// Multi-operation review controls must remain bound to the operator-selected operation/run lane.
{
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes('function operatorLaneMatches(item,n)'),'Operator review has no shared lane matcher.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,n))"),'Proposal rendering is still stage-wide.');
  assert(appSource.includes("filter(x=>x.status==='PENDING_OPERATOR_REVIEW'&&operatorLaneMatches(x,current.activeStage))"),'Accept/reject selection is still stage-wide.');
  assert(appSource.includes('operatorLaneMatches(validationLaneRecord(x),n)'),'Validation feedback is still stage-wide.');
  assert(appSource.includes('acceptedLaneChanges(n).length'),'Refinement control visibility is still stage-wide.');
}

`;
s=replaceOnce(s,marker,test+marker,'verification insertion');
fs.writeFileSync('verify-complete.mjs',s);
