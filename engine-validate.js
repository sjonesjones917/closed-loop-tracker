(function(global){
"use strict";
const E=global.CLE,{ENUMS}=E;
const {parseBool,parseNumber,assignBlankIds,nextId,pad,hashString}=E;
function validateStandardStage(j,n,text){
  if(!text || !text.trim()) return {ok:false,reason:"No result was supplied."};
  switch(n){
    case 2:
      if(!/TITLE_OR_DESCRIPTION\s*:/i.test(text)) return {ok:false,reason:"No source record was found."};
      if(parseBool(text,"BLOCKED")==="TRUE") return {ok:false,blocked:true,reason:"Source inventory reported a mandatory blocker."};
      return {ok:true};
    case 3:
      if(parseBool(text,"FINAL_SATURATION_PASS_PERFORMED")!=="TRUE") return {ok:false,reason:"Final saturation pass is not established."};
      if(parseBool(text,"CONTROLLING_SOURCES_ALL_EXAMINED")!=="TRUE") return {ok:false,reason:"Not all controlling sources were established as examined."};
      return {ok:true};
    case 4:
      if(!/REQUIREMENT\s*:/i.test(text)) return {ok:false,reason:"No atomic requirement record was found."};
      return {ok:true};
    case 5:
      if(parseBool(text,"REQUIREMENT_SET_RESOLVED")!=="TRUE") return {ok:false,reason:"Requirement set is not resolved."};
      return {ok:true};
    case 6:
      if(!/TEST_TYPE\s*:/i.test(text)) return {ok:false,reason:"No verification test record was found."};
      const cov=parseNumber(text,"MANDATORY_TEST_COVERAGE");
      if(!cov || !["1","1.0","1.00","100%"].includes(cov)) return {ok:false,reason:"mandatory_test_coverage is not 1.00/100%."};
      return {ok:true};
    case 7:
      if(parseBool(text,"ALL_APPLICABLE_REQUIREMENTS_HAVE_FAILURE_TEST")!=="TRUE") return {ok:false,reason:"Failure-test coverage is incomplete."};
      if(parseBool(text,"ALL_INVALID_CASES_DETECTED_OR_REJECTED_OR_BLOCKED")!=="TRUE") return {ok:false,reason:"A deliberately invalid case was not proven detected/rejected/blocked."};
      return {ok:true};
    case 8:
      for(const h of ["OBJECTIVE","INPUTS","SOURCE AUTHORITY","SCOPE","DEFINED TERMS","REQUIRED PROCEDURE","DECISION RULES","TOOL RULES","OUTPUT CONTRACT","FAILURE HANDLING","COMPLETION CRITERIA"])
        if(!new RegExp("(^|\\n)"+h+"\\b","i").test(text)) return {ok:false,reason:"Production instruction is missing "+h+"."};
      return {ok:true};
    case 9:
      if(!/CORRECTED_FULL_INSTRUCTION\s*:/i.test(text)) return {ok:false,reason:"Corrected full instruction is missing."};
      return {ok:true};
    case 10:
      if(parseBool(text,"FREEZE_COMPLETE")!=="TRUE") return {ok:false,reason:"Candidate freeze is not complete."};
      return {ok:true};
    case 13:return {ok:true};
    case 14:return {ok:true};
    case 15:return {ok:true};
    case 16:return {ok:true};
    case 18:
      if(parseBool(text,"CONVERGED")!=="TRUE") return {ok:false,reason:"Convergence conditions are not all true.",loop:true};
      return {ok:true};
    case 20:
      if(parseBool(text,"BASELINE_FROZEN")!=="TRUE") return {ok:false,reason:"Production baseline is not frozen."};
      return {ok:true};
    case 21:
      if(!text.trim()) return {ok:false,reason:"No final product was generated."};
      return {ok:true};
    case 22:
      if(parseBool(text,"ALL_MANDATORY_DETERMINISTIC_TESTS_SUCCEEDED")!=="TRUE") return {ok:false,reason:"Mandatory deterministic verification did not all succeed."};
      return {ok:true};
    case 23:
      if(/\bDETERMINATION\s*:\s*(VIOLATED|UNDETERMINED)\b/i.test(text)) return {ok:false,reason:"A semantic requirement is violated or undetermined."};
      return {ok:true};
    case 24:
      if(/\bDEFECT_FOUND\s*:\s*TRUE\b/i.test(text)) return {ok:false,reason:"Adversarial verification found a defect.",loop:true};
      if(parseBool(text,"ADVERSARIAL_SEARCH_COMPLETE")!=="TRUE") return {ok:false,reason:"Adversarial search is not complete."};
      return {ok:true};
    case 25:
      for(const bad of ["CLIPPING_FOUND","MISSING_CONTENT_FOUND","BLANK_PAGES_FOUND","BROKEN_TABLES_FOUND","MISPLACED_GRAPHICS_FOUND","MATERIAL_FONT_SUBSTITUTION_FOUND","CORRUPT_FILES_FOUND","MISSING_PACKAGED_FILES_FOUND","UNEXPECTED_FILES_FOUND","WRONG_FILENAMES_FOUND","INCONSISTENT_VERSIONS_FOUND"])
        if(parseBool(text,bad)==="TRUE") return {ok:false,reason:bad+" is TRUE."};
      return {ok:true};
    case 26:
      if(parseBool(text,"PROCESS_CORRECTNESS")!=="TRUE" || parseBool(text,"PRODUCT_CORRECTNESS")!=="TRUE") return {ok:false,reason:"Process correctness and product correctness are not both TRUE."};
      return {ok:true};
    case 27:return {ok:true};
    case 28:
      if(/\bHASH_MATCH\s*:\s*FALSE\b/i.test(text)) return {ok:false,reason:"Release hash differs from audited hash."};
      return {ok:true};
    case 29:
      if(/\bCHAIN_COMPLETE\s*:\s*(FALSE|UNKNOWN)\b/i.test(text)) return {ok:false,reason:"A mandatory requirement evidence chain is incomplete."};
      return {ok:true};
    case 30:
      if(/\bSTILL_APPLICABLE\s*:\s*TRUE\b/i.test(text) && !/\bVERIFICATION_RESULT\s*:\s*SATISFIED\b/i.test(text)) return {ok:false,reason:"A still-applicable regression is not satisfied."};
      return {ok:true};
    default:return {ok:true};
  }
}
function saveStandardStage(j,n,text){
  text=assignBlankIds(j,n,text);
  if(n===21){
    const productId=(text.match(/PRODUCT_ID\s*:\s*([^\n]+)/i)||[])[1]||nextId(j,"PRODUCT");
    const execId=(text.match(/EXECUTION_ID\s*:\s*([^\n]+)/i)||[])[1]||nextId(j,"EXEC");
    j.versions.PRODUCT++;
    j.product={id:productId.trim(),executionId:execId.trim(),version:"PRODUCT-v"+pad(j.versions.PRODUCT),content:text,identity:hashString(text)};
  }
  if(n===27){
    const violated=Number(parseNumber(text,"MANDATORY_REQUIREMENTS_VIOLATED")||0);
    const unknown=Number(parseNumber(text,"MANDATORY_REQUIREMENTS_UNESTABLISHED")||0);
    const goodReq=Number(parseNumber(text,"MANDATORY_REQUIREMENTS_WITH_AFFIRMATIVE_EVIDENCE")||0);
    const totalReq=Number(parseNumber(text,"TOTAL_MANDATORY_REQUIREMENTS")||0);
    const goodVal=Number(parseNumber(text,"MANDATORY_VALIDATORS_SUCCEEDED")||0);
    const totalVal=Number(parseNumber(text,"TOTAL_MANDATORY_VALIDATORS")||0);
    j.releaseState=violated>0?"REJECTED":unknown>0?"BLOCKED":(totalReq>0&&goodReq===totalReq&&totalVal>0&&goodVal===totalVal)?"ACCEPTED":"BLOCKED";
    j.releaseEvidence=text;
    text+="\n\nAPP_COMPUTED_RELEASE_STATE: "+j.releaseState;
  }
  const v=validateStandardStage(j,n,text);
  const s=j.stages[n-1]; s.result=text; s.validated=!!v.ok;
  if(v.ok){s.status="COMPLETE"; if(j.currentStage===n) j.currentStage=Math.min(30,n+1)}
  else if(v.blocked){s.status="BLOCKED"} else {s.status="FAILED"}
  return {text,validation:v};
}

Object.assign(E,{validateStandardStage,saveStandardStage});
})(typeof window!=="undefined"?window:globalThis);
