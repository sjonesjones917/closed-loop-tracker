(function(global){
"use strict";
const {STAGE_NAMES,STAGE_INSTRUCTIONS,MANDATORY_RULES,ENUMS}=global.ClosedLoopSpec;
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
  const j={
    id,title:input.title||"",objective:input.objective||"",deliverable:input.deliverable||"",
    supplied:input.supplied||"",format:input.format||"UNSPECIFIED",deadline:input.deadline||"",
    authorities:input.authorities||"",tools:input.tools||"",prohibited:input.prohibited||"",
    unknowns:input.unknowns||"",explicitRequirements:input.explicitRequirements||"",assumptions:input.assumptions||"",
    inputVersion:1,currentStage:2,status:"ACTIVE",iteration:1,
    counters:{SRC:0,REQ:0,TEST:0,DEFECT:0,REG:0,FREEZE:0,ITER:0,BASELINE:0,PRODUCT:0,EXEC:0,EVIDENCE:0},
    versions:{SOURCE_SET:0,REQUIREMENTS:0,TEST_SUITE:0,INSTRUCTION:0,VALIDATOR:0,TOOL_CONFIGURATION:0,PRODUCT:0},
    stages:Array.from({length:30},(_,i)=>({number:i+1,status:i===0?"COMPLETE":"NOT_STARTED",result:"",validated:false})),
    runs:{candidate:[],rerun:[],confirmation:[]},
    releaseState:null,releaseEvidence:"",product:null,blockers:[]
  };
  j.stages[0].result=stage1Record(j);
  j.stages[0].validated=true;
  return j;
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
function nextId(j,prefix){
  j.counters[prefix]=(j.counters[prefix]||0)+1;
  return prefix+"-"+pad(j.counters[prefix],4);
}
function nextVersion(j,key){
  j.versions[key]=(j.versions[key]||0)+1;
  return key.replaceAll("_","-")+"-v"+pad(j.versions[key]);
}
function relevantPrior(j,n){
  return j.stages.filter(s=>s.number>1 && s.number<n && s.result.trim())
    .map(s=>`===== STAGE ${pad(s.number,2)} — ${STAGE_NAMES[s.number-1]} =====\n${s.result.trim()}`).join("\n\n");
}
function promptHeader(j,n){
  return `CLOSED-LOOP AGENT RELIABILITY WORKFLOW

JOB RECORD
${stage1Record(j)}

CURRENT STAGE
${n}. ${STAGE_NAMES[n-1]}`;
}

global.CLE={STAGE_NAMES,STAGE_INSTRUCTIONS,MANDATORY_RULES,ENUMS,pad,randomHex,jobId,hashString,newJob,stage1Record,nextId,nextVersion,relevantPrior,promptHeader};
})(typeof window!=="undefined"?window:globalThis);
