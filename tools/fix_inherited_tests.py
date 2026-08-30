from pathlib import Path

def r(path, old, new):
    p=Path(path); t=p.read_text()
    if old not in t: raise SystemExit(f'missing target: {path}: {old[:100]!r}')
    p.write_text(t.replace(old,new,1))

# Browser runtime order is workbook -> hash -> schema -> test-runtime -> workflow-engine.
r('verify-prompt-semantics.mjs',
  "['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js']",
  "['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js']")
r('verify-ingestion.mjs',
  "['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']",
  "['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js']")

# Test IR v1 permits TEST_IR only; CUSTOM_PIPELINE is explicitly prohibited.
r('verify-test-runtime.mjs',"EXECUTABLE_KIND:'CUSTOM_PIPELINE'","EXECUTABLE_KIND:'TEST_IR'")

# Stage 4 next action is a structured application-owned action, not free-form prose.
r('verify-test-runtime.mjs',
  "const nextAction=String(engine.operationalNextAction(project,4)||'');assert.ok(nextAction.includes('canonical Stage 01 intent-statement ledger')&&nextAction.includes('Do not attach, resend, reopen, or otherwise reuse the original intent file.'),'Stage 04 next action must identify canonical intent reuse and prohibit original-file reuse.');assert.ok(!/required stage 04 input file|add the exact supplied project file|missing or unverified.*stage 04|send the stage 04 instruction with|attach or provide the original|required material/i.test(nextAction),'Stage 04 next action must not require a filename-derived re-upload.');",
  "const nextAction=engine.operationalNextAction(project,4);assert.equal(typeof nextAction,'object');assert.ok(['PASTE_FINAL_JSON','CONTINUE_AGENT_CONVERSATION'].includes(nextAction.actionType),'Stage 04 next action must remain a structured operator action.');assert.ok(nextAction.explanation.includes('canonical Stage 01 intent-statement ledger')&&nextAction.explanation.includes('Do not attach, resend, reopen'),'Stage 04 next action must identify canonical intent reuse and prohibit original-file reuse.');assert.ok(nextAction.explanation.includes('Do not ask the user to repeat project information already captured.'),'Stage 04 must explicitly prohibit repeated project input.');assert.ok(!/required stage 04 input file|add the exact supplied project file|missing or unverified.*stage 04|send the stage 04 instruction with|attach or provide the original|required material/i.test(nextAction.explanation),'Stage 04 next action must not require a filename-derived re-upload.');")

# Node test harness needs the same minimal DOM-ready stubs as the other verification files.
p=Path('verify-capture-once.mjs'); t=p.read_text()
needle="import fs from 'node:fs';\nimport vm from 'node:vm';\n"
if needle not in t: raise SystemExit('capture-once import target missing')
p.write_text(t.replace(needle,needle+"globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};\nglobalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);\n",1))

# Stage 01 fixture must satisfy the current application-owned intake accounting contract.
p=Path('verify-ingestion.mjs'); t=p.read_text()
old="""  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];
"""
new="""  if(stage===1){
    const intake=engine.currentIntakeCoverageManifest(p);
    stageData.INPUT_SET_CONTENTS=intake.units.map(unit=>`${unit.unitId} INCORPORATED — ${unit.rawValue}`).join('\\n');
    records.intentStatements=intake.units.map((unit,index)=>({tempKey:`intent-statement-${index+1}`,fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:`${unit.unitId} / ${unit.sourceLocation}:${unit.sourceStart}-${unit.sourceEnd}`,EXACT_STATEMENT:unit.rawValue,STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}));
  }
"""
if old not in t: raise SystemExit('Stage 01 ingestion fixture target missing')
p.write_text(t.replace(old,new,1))
