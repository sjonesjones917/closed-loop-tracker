from pathlib import Path

# Preserve the no-repeat behavior while aligning the regression with the exact
# controlling prompt language.
path=Path('verify-one-time-intent-intake.mjs')
text=path.read_text()
old="assert(stage3Prompt.prompt.includes('never ask the user to repeat available project facts'),'Stage 03 permits repeated project-data entry.');"
new="assert(stage3Prompt.prompt.includes('Never ask the human to repeat available project facts'),'Stage 03 permits repeated project-data entry.');"
if old not in text:
    raise AssertionError('The stale Stage 03 no-repeat assertion was not found.')
path.write_text(text.replace(old,new,1))

# Replace a source-variable-name heuristic with a check of the exact generated
# Stage 04 exhausted-input context and obligation-manifest identity.
path=Path('verify-zero-loss-accounting.mjs')
text=path.read_text()
old="const source=fs.readFileSync('prompt-engine.js','utf8');assert(source.includes('currentUserJobInput')&&source.includes('originalUserEntered')&&source.includes('applicableSources')&&source.includes('applicableEvidence'),'Stage 04 exhaustive context union is incomplete.');"
new="project.stages[1].status='COMPLETE';project.stages[1].gate={complete:true,blocked:false,reasons:[]};project.stages[2].status='COMPLETE';project.stages[2].gate={complete:true,blocked:false,reasons:[]};project.stages[2].agentData={SOURCE_APPLICABILITY_DETERMINATION:'APPLICABLE_SOURCES_ESTABLISHED'};project.stages[3].status='COMPLETE';project.stages[3].gate={complete:true,blocked:false,reasons:[]};project.stages[3].agentData={ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED:true,SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED:true,LATEST_PASS_NUMBER:2,NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS:false};const stage4Prompt=prompts.buildPromptRecord(4,project,{operation:'COMPLETE'}),exhausted=stage4Prompt.contextManifest.stage4ExhaustedInputs;assert(exhausted.stage01AcceptedCapture.units.length===manifest.unitCount&&exhausted.stage03Research.length===1&&exhausted.stage03CandidateRequirements.length===1&&stage4Prompt.contextManifest.obligationManifest.manifestSha256===o.manifestSha256,'Stage 04 exhaustive context union is incomplete.');"
if old not in text:
    raise AssertionError('The stale Stage 04 source-name heuristic was not found.')
path.write_text(text.replace(old,new,1))

# Ingestion tests exercise stages independently. Their prompt fixtures must still
# obey the production prerequisite gate; no test may generate a later prompt from
# an illegal predecessor state.
path=Path('verify-ingestion.mjs')
text=path.read_text()
old="""function savePrompt(p,stage){
  if(stage===4)prepareStage4Upstream(p);
  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};
"""
new="""function savePrompt(p,stage){
  if(stage===4)prepareStage4Upstream(p);
  else if(stage>1){p.stages[stage-1].status='COMPLETE';p.stages[stage-1].gate={complete:true,blocked:false,reasons:[]};}
  const options=stage===19?{operation:'COMPARE'}:stage===11?{scope:{runId:'RUN-INGESTION-FIXTURE',contextId:'CONTEXT-INGESTION-FIXTURE'}}:{};
"""
if old not in text:
    raise AssertionError('The ingestion prompt fixture helper was not found.')
text=text.replace(old,new,1)
old="if(stage<30){const nextStage=stage+1;if(nextStage===4)prepareStage4Upstream(reloaded);"
new="if(stage<30){reloaded.stages[stage].status='COMPLETE';reloaded.stages[stage].gate={complete:true,blocked:false,reasons:[]};const nextStage=stage+1;if(nextStage===4)prepareStage4Upstream(reloaded);"
if old not in text:
    raise AssertionError('The ingestion downstream prompt fixture was not found.')
text=text.replace(old,new,1)

# A generated valid response fixture must use values permitted by the declared
# closed schema. Keep the source-specific fixture values, but derive every enum
# value from the authoritative field definition instead of inventing placeholders.
old="for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=safeValue(name);}"
new="for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT){const definition=def.fieldDefinitions[name];fields[name]=definition?.enumValues?.length?definition.enumValues[0]:safeValue(name);}}"
if old not in text:
    raise AssertionError('The ingestion required-field fixture generator was not found.')
text=text.replace(old,new,1)
old="if(!Object.keys(fields).length){const agentField=schema.recordAgentFields(collection)[0];if(agentField)fields[agentField]=safeValue(agentField);}"
new="if(!Object.keys(fields).length){const agentField=schema.recordAgentFields(collection)[0];if(agentField){const definition=def.fieldDefinitions[agentField];fields[agentField]=definition?.enumValues?.length?definition.enumValues[0]:safeValue(agentField);}}"
if old not in text:
    raise AssertionError('The ingestion fallback field fixture generator was not found.')
path.write_text(text.replace(old,new,1))

print('Aligned prompt and ingestion regressions with generated behavior, legal stage prerequisites, and declared enum contracts.')
