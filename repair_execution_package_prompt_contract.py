from pathlib import Path

p=Path('project-store.js')
s=p.read_text()
start=s.index('async function createExecutionPackage(')
end=s.index('async function storageHealth()',start)
new_func=r'''async function createExecutionPackage({project=null,jobId=null,stage,operation=null,testIds=[],productId=null,runId=null,reviewerAliasContext=null,instructionId=null}={}){
  if(!project&&jobId){const all=await readAll();project=all.find(item=>projectIdentity(item)===String(jobId))||null;}
  if(!project||typeof project!=='object')throw new Error('A canonical project is required for an execution package.');
  const engine=globalThis.closedLoopWorkflowEngine,promptEngine=globalThis.closedLoopPromptEngine,canonicalJobId=projectIdentity(project);if(jobId&&String(jobId)!==canonicalJobId)throw storageError(`Execution-package job ${jobId} does not match canonical project ${canonicalJobId}.`,'EXECUTION_PACKAGE_JOB_MISMATCH');
  const normalizedStage=Number(stage),normalizedOperation=String(operation||globalThis.closedLoopWorkflowSchema?.STAGE_CONTRACTS?.[normalizedStage]?.operations?.[0]||'COMPLETE'),normalizedRunId=runId?String(runId):null,ids=[...new Set(testIds.map(String).filter(Boolean))];
  if(!promptEngine?.responseContractDescriptor)throw storageError('The prompt authority is unavailable for execution-package construction.','EXECUTION_PACKAGE_PROMPT_AUTHORITY_UNAVAILABLE');
  const prompts=(project.projectData?.generatedPrompts||[]).filter(record=>Number(record?.stage)===normalizedStage&&!record?.invalidatedBy&&String(record?.operation||'COMPLETE')===normalizedOperation&&String(record?.promptEngineVersion||'')===String(promptEngine.version||''));
  const lanePrompts=prompts.filter(record=>!normalizedRunId||String(record?.scope?.runId||'')===normalizedRunId),selectedPrompt=instructionId?lanePrompts.find(record=>String(record?.instructionId||record?.promptId||'')===String(instructionId)):lanePrompts.at(-1);
  if(!selectedPrompt)throw storageError('Save the current controlling instruction before preparing this execution package. No current saved instruction exists for this exact stage, operation, and run lane.','EXECUTION_PACKAGE_CURRENT_PROMPT_REQUIRED');
  const exactPrompt=String(selectedPrompt.prompt||'');if(!exactPrompt)throw storageError('The saved controlling instruction has no exact prompt text.','EXECUTION_PACKAGE_PROMPT_TEXT_MISSING');
  const fullTextSha256=hash.sha256Text(exactPrompt);if(selectedPrompt.fullTextSha256&&String(selectedPrompt.fullTextSha256)!==fullTextSha256)throw storageError('The saved controlling instruction text no longer matches its recorded identity.','EXECUTION_PACKAGE_PROMPT_IDENTITY_MISMATCH');
  const responseContract=promptEngine.responseContractDescriptor(normalizedStage,normalizedOperation),contractSha256=hash.sha256Value(responseContract);if(String(selectedPrompt.contractSha256||'')!==contractSha256)throw storageError('The saved controlling instruction response contract is stale. Save the current instruction again before preparing the package.','EXECUTION_PACKAGE_CONTRACT_STALE');
  if(normalizedRunId&&String(selectedPrompt.scope?.runId||'')!==normalizedRunId)throw storageError('The saved controlling instruction is bound to a different run lane.','EXECUTION_PACKAGE_RUN_MISMATCH');
  const plan=engine.executionHandoff(project,{stage:normalizedStage,operation:normalizedOperation,testIds:ids,runIds:normalizedRunId?[normalizedRunId]:null}),artifactIds=[...new Set(plan.send.map(x=>String(x.artifactId||'')).filter(Boolean))],artifactEntries=[];
  for(const artifactId of artifactIds){const canonical=engine.records(project,'artifacts').find(r=>engine.recordId(r,'artifacts')===artifactId&&engine.isActiveRecord(r));if(!canonical)throw storageError(`Execution-package artifact ${artifactId} is not current canonical state.`,'EXECUTION_PACKAGE_ARTIFACT_STALE');const row=await getArtifact(artifactId);if(!row||String(row.jobId)!==canonicalJobId)throw storageError(`Execution-package artifact ${artifactId} has no stored bytes for ${canonicalJobId}.`,'EXECUTION_PACKAGE_BYTES_MISSING');const bytes=new Uint8Array(await row.blob.arrayBuffer()),sha256=await hash.sha256Bytes(bytes),byteSize=bytes.byteLength,expectedSha=String(engine.recordValue(canonical,'SHA256')||''),expectedSize=Number(engine.recordValue(canonical,'BYTE_SIZE'));if(sha256!==expectedSha||byteSize!==expectedSize)throw storageError(`Execution-package artifact ${artifactId} failed byte identity verification.`,'EXECUTION_PACKAGE_ARTIFACT_MISMATCH');artifactEntries.push({artifactId,filename:String(engine.recordValue(canonical,'FILENAME')||row.filename||artifactId),mediaType:String(row.mediaType||'application/octet-stream'),byteSize,sha256,role:String(engine.recordValue(canonical,'ROLE')||''),base64:bytesToBase64(bytes)});}
  const tests=engine.records(project,'tests').filter(t=>ids.includes(engine.recordId(t,'tests'))).map(t=>({testId:engine.recordId(t,'tests'),requirementId:String(engine.recordValue(t,'REQ_ID')||t.relationships?.REQ_ID||''),fields:clone(t.fields||{}),relationships:clone(t.relationships||{})}));
  const reviewerAlias=reviewerAliasContext&&typeof reviewerAliasContext==='object'?String(reviewerAliasContext.alias||reviewerAliasContext.reviewerAlias||'').trim()||null:null;
  const instruction={instructionId:String(selectedPrompt.instructionId||selectedPrompt.promptId||''),promptEngineVersion:String(selectedPrompt.promptEngineVersion||''),bodySha256:String(selectedPrompt.bodySha256||selectedPrompt.sha256||''),contractSha256:String(selectedPrompt.contractSha256||''),contextSignature:String(selectedPrompt.contextSignature||''),scope:clone(selectedPrompt.scope||{}),fullTextSha256,text:exactPrompt};
  const manifest={schema:'closed-loop-verification-package/1',workflow:project.workflow,projectSchema:project.schema,responseSchema:globalThis.closedLoopWorkflowSchema?.RESPONSE_SCHEMA,jobId:canonicalJobId,stage:normalizedStage,operation:normalizedOperation,runId:normalizedRunId,reviewerAlias,productId:productId||project.job?.CURRENT_PRODUCT_ID||null,testIds:ids,instructionId:instruction.instructionId,instructionFullTextSha256:fullTextSha256,responseContractSha256:contractSha256,artifacts:artifactEntries.map(({base64,...x})=>x),handoff:clone(plan),createdAt:now()};
  const body={manifest,instruction,responseContract,tests,artifacts:artifactEntries},packageSha256=hash.sha256Value(body),payload={...body,packageSha256};const compressed=await compressBytes(new TextEncoder().encode(JSON.stringify(payload)));return {blob:new Blob([compressed],{type:'application/gzip'}),filename:`VERIFY-${canonicalJobId}-STAGE-${String(normalizedStage).padStart(2,'0')}.clverify.gz`,manifest,packageSha256};
}
'''
s=s[:start]+new_func+s[end:]
p.write_text(s)

p=Path('app-core.js')
s=p.read_text()
s=s.replace("const RUNTIME_BUILD_ID='runtime-20260830-live-operator-39';","const RUNTIME_BUILD_ID='runtime-20260830-live-operator-40';",1)
start=s.index('async function downloadExecutionPackage()')
end=s.index('function projectManagementMarkup()',start)
new_func=r'''async function downloadExecutionPackage(){try{const stage=Number(current.activeStage),options=promptOptions(stage),operation=options.operation,scope=options.scope||{},savedPrompt=currentPromptRecord(stage);if(!savedPrompt)throw new Error('Save the current controlling instruction before preparing the execution package.');const action=displayedStageAction(stage),plan=engine.testExecutionPlan(current),operatorAction=({AI_REVIEW:'SEND_TO_INDEPENDENT_REVIEWER',EXTERNAL_AGENT_TOOL:'SEND_TO_TOOL_AGENT',EXTERNAL_SYSTEM:'USE_EXTERNAL_SYSTEM',HUMAN_INSPECTION:'HUMAN_INSPECTION'})[action.actionType]||null,ids=plan.items.filter(item=>item.executionMode!=='APPLICATION_DETERMINISTIC'&&item.operatorAction!=='NO_ACTION'&&(!operatorAction||item.operatorAction===operatorAction)).map(item=>item.testId);if(!ids.length)throw new Error('No external verification package is required for the current state.');const pkg=await projectStore.createExecutionPackage({project:current,jobId:current.job.JOB_ID,stage,operation,testIds:ids,productId:current.job.CURRENT_PRODUCT_ID,runId:scope.runId||null,reviewerAliasContext:null,instructionId:savedPrompt.instructionId||savedPrompt.promptId});const url=URL.createObjectURL(pkg.blob),link=document.createElement('a');link.href=url;link.download=pkg.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);announce('verification package prepared');}catch(error){announce('verification package blocked');alert(error.message||error);}}
'''
s=s[:start]+new_func+s[end:]
p.write_text(s)

p=Path('index.html')
s=p.read_text()
if 'runtime-20260830-live-operator-39' not in s: raise SystemExit('expected runtime cache identity missing')
s=s.replace('runtime-20260830-live-operator-39','runtime-20260830-live-operator-40')
p.write_text(s)
