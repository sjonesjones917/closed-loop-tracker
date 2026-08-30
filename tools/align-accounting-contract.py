from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()
old="return {...identity,units,manifestSha256:hash.sha256Value(identity)};"
new="""const compatibleUnits=units.map(unit=>{let label=unit.fieldName;if(unit.fieldName==='SUPPLIED_MATERIALS_INVENTORY'&&typeof unit.rawValue==='string'){try{const parsed=JSON.parse(unit.rawValue);if(Array.isArray(parsed)&&parsed[0]?.exactNameOrReference)label=String(parsed[0].exactNameOrReference);}catch{}}return {...unit,unitId:unit.sourceUnitId,label};});return {...identity,units:compatibleUnits,unitCount:compatibleUnits.length,manifestSha256:hash.sha256Value(identity)};"""
if old not in s: raise SystemExit('intake manifest return anchor missing')
s=s.replace(old,new,1)
old="return {...identity,obligations,manifestSha256:hash.sha256Value(identity)};"
new="return {...identity,obligations,items:obligations,obligationCount:obligations.length,manifestSha256:hash.sha256Value(identity)};"
if old not in s: raise SystemExit('obligation manifest return anchor missing')
s=s.replace(old,new,1)
old="return {complete:errors.length===0&&accounted===total,coverage:total?accounted/total:1,total,accounted,errors,manifest};"
new="const complete=errors.length===0&&accounted===total;return {complete,closed:complete,coverage:total?accounted/total:1,total,accounted,errors,manifest};"
if old not in s: raise SystemExit('obligation accounting return anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('verify-intake-obligation-accounting.mjs')
s=p.read_text()
old="const prompt1=prompts.buildPromptRecord(1,p),envelope=(capture)=>"
new="const prompt1=prompts.buildPromptRecord(1,p);p.projectData.generatedPrompts.push({...prompt1,generatedAt:new Date().toISOString(),invalidatedBy:null});p.stages[1].currentPromptId=prompt1.instructionId;const envelope=(capture)=>"
if old not in s: raise SystemExit('Stage1 prompt fixture anchor missing')
s=s.replace(old,new,1)
anchor="p.projectData.candidateRequirements.push({id:'CANDIDATE-REQ-ACCOUNTING'"
pos=s.index(anchor)
end=s.index(";\nconst obligations=engine.obligationManifest(p);",pos)+1
block=s[pos:end]
replacement=block+"\np.stages[3].status='COMPLETE';p.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false,RESEARCH_GAPS_AND_BLOCKERS:'NONE'};"
s=s[:pos]+replacement+s[end:]
old="const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});assert(handoff.conversationMaterials.length===0&&handoff.send.length===0,'Stage 04 still derives an original-intent-file handoff.');"
new="const handoff=engine.executionHandoff(p,{stage:4,operation:'COMPLETE'});assert(Array.isArray(handoff.send)&&handoff.send.length===0,'Stage 04 still derives a file handoff for previously supplied project input.');assert(!JSON.stringify(handoff).match(/original intent|intent file|reattach|re-attach/i),'Stage 04 handoff still asks for previously supplied intent material.');"
if old not in s: raise SystemExit('obsolete Stage4 handoff assertion missing')
s=s.replace(old,new,1)
old="const oldContext=prompt4.contextSignature;p.job.EXACT_USER_OBJECTIVE_VERBATIM+=' Updated.';p.job.CURRENT_INPUT_VERSION='INPUT-v002';engine.recalculate(p);const newPrompt=prompts.buildPromptRecord(4,p);assert(newPrompt.contextSignature!==oldContext,'Changed human authority did not invalidate the Stage 04 context signature.');"
new="const oldContext=prompt4.contextSignature;p.job.EXACT_USER_OBJECTIVE_VERBATIM+=' Updated.';p.job.CURRENT_INPUT_VERSION='INPUT-v002';engine.recalculate(p);let upstreamBlocked=false;try{prompts.buildPromptRecord(4,p);}catch(error){upstreamBlocked=error.code==='STAGE04_STAGE01_INCOMPLETE'||error.code==='STAGE04_STAGE03_INCOMPLETE';}assert(upstreamBlocked,'Changed human authority did not invalidate and block the old Stage 04 prompt.');assert(prompt4.contextSignature===oldContext,'Historical prompt identity was mutated instead of invalidated.');"
if old not in s: raise SystemExit('old Stage4 changed-input assertion missing')
s=s.replace(old,new,1)
p.write_text(s)
