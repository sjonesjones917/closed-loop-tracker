(function(global){
"use strict";
const {STAGE_NAMES,STAGE_INSTRUCTIONS,MANDATORY_RULES,ENUMS}=global.CLV2_SPEC;
function pad(n,w=3){return String(n).padStart(w,"0")}
function randomHex(){
  if(typeof crypto!=="undefined" && crypto.getRandomValues){
    const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0].toString(16).toUpperCase().padStart(8,"0");
  }
  return Math.floor(Math.random()*0xffffffff).toString(16).toUpperCase().padStart(8,"0");
}
function jobId(){return "JOB-"+Date.now().toString(36).toUpperCase()+"-"+randomHex()}
function hashString(s){
  let h1=2166136261>>>0,h2=0x9e3779b9>>>0;
  for(let i=0;i<s.length;i++){h1=Math.imul(h1^s.charCodeAt(i),16777619);h2=Math.imul(h2+s.charCodeAt(i),2246822519)}
  return (h1>>>0).toString(16).padStart(8,"0")+(h2>>>0).toString(16).padStart(8,"0");
}
function newJob(input={}){
  const id=jobId();
  return {
    id,title:input.title||"",objective:input.objective||"",deliverable:input.deliverable||"",
    supplied:input.supplied||"",format:input.format||"UNSPECIFIED",deadline:input.deadline||"",
    authorities:input.authorities||"",tools:input.tools||"",prohibited:input.prohibited||"",
    unknowns:input.unknowns||"",explicitRequirements:input.explicitRequirements||"",assumptions:input.assumptions||"",
    inputVersion:1,currentStage:1,status:"ACTIVE",iteration:1,
    counters:{SRC:0,REQ:0,TEST:0,DEFECT:0,REG:0,FREEZE:0,ITER:0,BASELINE:0,PRODUCT:0,EXEC:0,EVIDENCE:0},
    versions:{SOURCE_SET:0,REQUIREMENTS:0,TEST_SUITE:0,INSTRUCTION:0,VALIDATOR:0,TOOL_CONFIGURATION:0,PRODUCT:0},
    stages:Array.from({length:30},(_,i)=>({number:i+1,status:"NOT_STARTED",result:"",validated:false})),
    runs:{candidate:[],rerun:[],confirmation:[]},
    iterationWorkspace:{freeze:"",rerunVerification:[],comparison:"",rootCause:"",regressions:"",correction:""},
    confirmationWorkspace:{verification:[],summary:""},
    releaseState:null,releaseEvidence:"",product:null,blockers:[]
  };
}
function stage1Record(j){
  return `JOB_ID: ${j.id}
EXACT_USER_OBJECTIVE:
${j.objective||"UNKNOWN"}

EXACT_DELIVERABLE_REQUESTED:
${j.deliverable||"UNKNOWN"}

ALL_SUPPLIED_FILES_MESSAGES_LINKS_DATA_AND_CONSTRAINTS:
${j.supplied||"NONE SUPPLIED"}

REQUIRED_OUTPUT_FORMAT:
${j.format||"UNSPECIFIED"}

DEADLINE_OR_TEMPORAL_SCOPE:
${j.deadline||"NONE SUPPLIED"}

KNOWN_AUTHORITATIVE_SOURCES:
${j.authorities||"NONE SUPPLIED"}

AVAILABLE_TOOLS:
${j.tools||"UNKNOWN"}

PROHIBITED_ACTIONS:
${j.prohibited||"NONE SUPPLIED"}

UNKNOWN_INFORMATION_THAT_MAY_AFFECT_CORRECTNESS:
${j.unknowns||"NONE RECORDED"}

EXPLICIT_USER_REQUIREMENTS:
${j.explicitRequirements||"NONE SEPARATELY RECORDED"}

ASSUMPTIONS:
${j.assumptions||"NONE"}

INPUT_SET_VERSION:
INPUT-v${pad(j.inputVersion)}`;
}
function nextId(j,prefix){j.counters[prefix]=(j.counters[prefix]||0)+1;return prefix+"-"+pad(j.counters[prefix],4)}
function nextVersion(j,key){j.versions[key]=(j.versions[key]||0)+1;return key.replaceAll("_","-")+"-v"+pad(j.versions[key])}
function rawJobInput(j){
  return `JOB_ID_PREASSIGNED_BY_APP: ${j.id}
RAW_USER_OBJECTIVE:
${j.objective||"UNKNOWN"}

RAW_DELIVERABLE_REQUESTED:
${j.deliverable||"UNKNOWN"}

RAW_SUPPLIED_FILES_MESSAGES_LINKS_DATA_AND_CONSTRAINTS:
${j.supplied||"NONE SUPPLIED"}

RAW_REQUIRED_OUTPUT_FORMAT:
${j.format||"UNSPECIFIED"}

RAW_DEADLINE_OR_TEMPORAL_SCOPE:
${j.deadline||"NONE SUPPLIED"}

RAW_KNOWN_AUTHORITATIVE_SOURCES:
${j.authorities||"NONE SUPPLIED"}

RAW_TOOL_OR_ACCESS_INFORMATION_SUPPLIED_BY_HUMAN:
${j.tools||"NONE SUPPLIED"}

RAW_PROHIBITED_ACTIONS:
${j.prohibited||"NONE SUPPLIED"}

RAW_OTHER_INFORMATION_OR_KNOWN_UNKNOWNS:
${j.unknowns||"NONE SUPPLIED"}

INFERENCE_EXPRESSLY_PERMITTED:
${j.assumptions==="INFERENCE_PERMITTED"?"TRUE":"FALSE"}

INPUT_SET_VERSION_PREASSIGNED_BY_APP:
INPUT-v${pad(j.inputVersion)}`;
}
function authoritativeJobRecord(j){const s=j.stages[0];return s&&s.result.trim()?s.result.trim():"STAGE 1 JOB RECORD NOT YET COMPLETED"}
function relevantPrior(j,n){
  const deps={2:[1],3:[1,2],4:[2,3],5:[2,4],6:[4,5],7:[4,6],8:[2,4,5,6,7],9:[4,6,8],10:[1,2,4,6,9],13:[12],14:[12,13],15:[14],16:[14,15],18:[17],20:[10,18,19],21:[1,2,4,6,9,20],22:[6,20,21],23:[2,4,21],24:[2,4,21,22,23],25:[21,22,23,24],26:[20,21,22,23,24,25],27:[4,22,23,24,25,26],28:[21,22,23,24,25,27],29:[2,4,9,21,22,23,24,25,26,27,28],30:[14,15,16,17,18,19,27]};
  const nums=deps[n]||Array.from({length:n-1},(_,i)=>i+1);
  return nums.map(k=>j.stages[k-1]).filter(s=>s&&s.result.trim()).map(s=>`===== STAGE ${pad(s.number,2)} — ${STAGE_NAMES[s.number-1]} =====\n${s.result.trim()}`).join("\n\n");
}
function productionInstruction(j){const pre=j.stages[8]?.result||"";const m=pre.match(/CORRECTED_FULL_INSTRUCTION\s*:\s*([\s\S]*)/i);if(m&&m[1].trim())return m[1].trim();return (j.stages[7]?.result||"UNKNOWN — production instruction not established").trim()}
function candidateFreeze(j,kind){if(kind==="candidate")return (j.stages[9]?.result||"UNKNOWN — candidate freeze not established").trim();if(kind==="rerun")return (j.iterationWorkspace?.freeze||"UNKNOWN — corrected iteration freeze not established").trim();return (j.iterationWorkspace?.freeze||j.stages[9]?.result||"UNKNOWN — confirmation freeze not established").trim()}
function promptHeader(j,n){if(n===1)return `CLOSED-LOOP AGENT RELIABILITY WORKFLOW\n\nRAW JOB INPUT\n${rawJobInput(j)}\n\nCURRENT STAGE\n1. ${STAGE_NAMES[0]}`;return `CLOSED-LOOP AGENT RELIABILITY WORKFLOW\n\nAUTHORITATIVE JOB RECORD FROM STAGE 1\n${authoritativeJobRecord(j)}\n\nCURRENT STAGE\n${n}. ${STAGE_NAMES[n-1]}`}
global.CLV2={STAGE_NAMES,STAGE_INSTRUCTIONS,MANDATORY_RULES,ENUMS,pad,randomHex,jobId,hashString,newJob,stage1Record,nextId,nextVersion,rawJobInput,authoritativeJobRecord,relevantPrior,productionInstruction,candidateFreeze,promptHeader};
})(typeof window!=="undefined"?window:globalThis);
