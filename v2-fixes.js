(function(global){
"use strict";
const C=global.CLV2;
function fillIds(j,n,text){
  const maps={2:[["SOURCE_ID","SRC"]],4:[["REQ_ID","REQ"]],6:[["TEST_ID","TEST"]],10:[["FREEZE_ID","FREEZE"]],14:[["DEFECT_ID","DEFECT"]],15:[["REG_ID","REG"]],20:[["BASELINE_ID","BASELINE"]],21:[["PRODUCT_ID","PRODUCT"],["EXECUTION_ID","EXEC"]]};
  for(const [field,prefix] of (maps[n]||[])){
    const re=new RegExp("("+field+"\\s*:\\s*)(?=\\n|\\[leave blank|AUTO|$)","gi");
    text=text.replace(re,(match,p1)=>p1+C.nextId(j,prefix));
  }
  return text;
}
function between(text,a,b){const m=text.match(new RegExp(a+"\\s*:\\s*\\n([\\s\\S]*?)\\n"+b+"\\s*:","i"));return m?m[1].trim():null}
const original=C.saveStandardStage;
C.saveStandardStage=function(j,n,text){
  text=fillIds(j,n,text);
  const r=original(j,n,text);
  if(n===1 && r.validation.ok){
    const objective=between(r.text,"EXACT_USER_OBJECTIVE","EXACT_DELIVERABLE_REQUESTED");
    const deliverable=between(r.text,"EXACT_DELIVERABLE_REQUESTED","SUPPLIED_FILES");
    if(objective!==String(j.objective||"UNKNOWN").trim()) r.validation={ok:false,reason:"Stage 1 changed the user's exact objective instead of preserving it verbatim."};
    else if(deliverable!==String(j.deliverable||"UNKNOWN").trim()) r.validation={ok:false,reason:"Stage 1 changed the exact requested deliverable instead of preserving it verbatim."};
    if(!r.validation.ok){const s=j.stages[0];s.status="FAILED";s.validated=false;j.currentStage=1;}
  }
  return r;
};
C.fillIds=fillIds;
})(typeof window!=="undefined"?window:globalThis);
