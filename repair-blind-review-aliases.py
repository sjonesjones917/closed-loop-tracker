from pathlib import Path
import re

# prompt-engine.js: create deterministic internal alias map and expose only aliases in reviewer text/response scope.
p=Path('prompt-engine.js'); s=p.read_text()
marker='function buildPromptRecord(stageOrDefinition,state,options={}){'
assert marker in s
helper=r'''function blindReviewAliasEntries(stage,state,operation,scope,batchPlan){
  const entries=[],add=(kind,canonicalId,prefix)=>{const id=clean(canonicalId);if(!id||entries.some(x=>x.canonicalId===id))return;entries.push({kind,canonicalId:id,alias:`${prefix}-${hash.sha256Value({stage,operation,canonicalId:id,contextId:scope?.contextId||null}).slice(0,12).toUpperCase()}`});};
  const explicitIdentityNeeded=(()=>{if(!(stage===12||((stage===17||stage===19)&&operation==='VERIFY')))return false;const runId=clean(scope?.runId),triples=safe(batchPlan?.triples).filter(x=>!runId||String(x.runId)===runId),testIds=new Set(triples.map(x=>String(x.testId))),reqIds=new Set(triples.map(x=>String(x.requirementId)));const tests=safe(state?.projectData?.tests).filter(x=>testIds.has(recordId(x,'tests'))),reqs=safe(state?.projectData?.requirements).filter(x=>reqIds.has(recordId(x,'requirements'))),text=show([...tests.map(recordFields),...reqs.map(recordFields)]);return /\bRUN_ID\b|\bRUN ID\b|RUN IDENTITY|EXACT RUN ID/i.test(text);})();
  if((stage===12||((stage===17||stage===19)&&operation==='VERIFY'))&&scope?.runId&&!explicitIdentityNeeded)add('RUN_ID',scope.runId,'REVIEW-SAMPLE');
  if(stage===13)for(const run of safe(state?.projectData?.runs).filter(x=>x?.active!==false&&!x?.invalidatedBy))add('RUN_ID',recordId(run,'runs'),'REVIEW-SAMPLE');
  if((stage===23||stage===24)&&scope?.productId)add('PRODUCT_ID',scope.productId,'REVIEW-PRODUCT');
  return entries;
}
function applyBlindReviewAliases(value,entries,direction='PUBLIC'){const pairs=safe(entries).map(entry=>direction==='CANONICAL'?[entry.alias,entry.canonicalId]:[entry.canonicalId,entry.alias]).filter(([a,b])=>a&&b).sort((a,b)=>String(b[0]).length-String(a[0]).length);if(typeof value==='string'){let out=value;for(const [from,to] of pairs)out=out.split(String(from)).join(String(to));return out;}if(Array.isArray(value))return value.map(item=>applyBlindReviewAliases(item,entries,direction));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,applyBlindReviewAliases(item,entries,direction)]));return value;}
'''
assert 'function blindReviewAliasEntries(' not in s
s=s.replace(marker,helper+marker,1)
# Inject aliases after batchPlan, before handoff/context manifest.
old="feedback=recoveryFeedback(state,stage,operation,scope),batchPlan=verificationBatchPlan(stage,state,operation,scope),handoff="
new="feedback=recoveryFeedback(state,stage,operation,scope),batchPlan=verificationBatchPlan(stage,state,operation,scope),blindAliasMap=blindReviewAliasEntries(stage,state,operation,scope,batchPlan),handoff="
assert old in s; s=s.replace(old,new,1)
old="contextManifest={stage,operation,scope,intakeCoverageManifest:"
new="contextManifest={stage,operation,scope,blindAliasMap:cloneAliasMap(blindAliasMap),intakeCoverageManifest:"
# no cloneAliasMap helper, use map directly safely
new="contextManifest={stage,operation,scope,blindAliasMap:blindAliasMap.map(x=>({...x})),intakeCoverageManifest:"
assert old in s; s=s.replace(old,new,1)
old="const contextSignature=hash.sha256Value(contextManifest),bodyText=body(stage,state,operation,scope),bodySha256=hash.sha256Text(bodyText)"
new="const contextSignature=hash.sha256Value(contextManifest),publicScope=applyBlindReviewAliases(scope,blindAliasMap),bodyText=applyBlindReviewAliases(body(stage,state,operation,scope),blindAliasMap),bodySha256=hash.sha256Text(bodyText)"
assert old in s; s=s.replace(old,new,1)
old="${responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,scope,state?.job?.JOB_ID)}"
new="${responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,publicScope,state?.job?.JOB_ID)}"
assert old in s; s=s.replace(old,new,1)
# bump prompt version
m=re.search(r"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/(\d+)';",s); assert m
v=int(m.group(1))+1; s=s[:m.start()]+f"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/{v}';"+s[m.end():]
p.write_text(s)

# workflow-engine.js: persist the internal mapping with the prompt identity; retire it when the prompt is superseded.
p=Path('workflow-engine.js'); s=p.read_text()
old="const invalidationId=`PROMPT-SUPERSEDED-${promptRecord.instructionId}`;for(const prior of safe(project.projectData.generatedPrompts).filter(x=>!x.invalidatedBy&&samePromptTarget(x,promptRecord)))prior.invalidatedBy=invalidationId;"
new="const invalidationId=`PROMPT-SUPERSEDED-${promptRecord.instructionId}`;for(const prior of safe(project.projectData.generatedPrompts).filter(x=>!x.invalidatedBy&&samePromptTarget(x,promptRecord))){prior.invalidatedBy=invalidationId;for(const map of safe(project.projectData.blindAliasMaps).filter(x=>!x.invalidatedBy&&x.instructionId===prior.instructionId))map.invalidatedBy=invalidationId;}"
assert old in s; s=s.replace(old,new,1)
old="const record={...clone(promptRecord),source:'APPLICATION_PROMPT_REGISTRATION'};project.projectData.generatedPrompts.push(record);project.stages[Number(record.stage)].currentPromptId=record.instructionId;"
new="const record={...clone(promptRecord),source:'APPLICATION_PROMPT_REGISTRATION'};project.projectData.generatedPrompts.push(record);const aliases=safe(record.contextManifest?.blindAliasMap);if(aliases.length&&!project.projectData.blindAliasMaps.some(x=>x.instructionId===record.instructionId&&!x.invalidatedBy)){project.projectData.blindAliasMaps.push({mapId:`BLIND-MAP-${hash.sha256Value({instructionId:record.instructionId,contextSignature:record.contextSignature}).slice(0,20).toUpperCase()}`,instructionId:record.instructionId,stage:Number(record.stage),operation:record.operation,contextSignature:record.contextSignature,entries:clone(aliases),active:true,createdAt:now(),source:'APPLICATION_PROMPT_REGISTRATION'});}project.stages[Number(record.stage)].currentPromptId=record.instructionId;"
assert old in s; s=s.replace(old,new,1)
p.write_text(s)

# project-store.js: automatically consume prompt-owned alias info; never put canonical mapping in the external package.
p=Path('project-store.js'); s=p.read_text()
old="const reviewerAlias=reviewerAliasContext&&typeof reviewerAliasContext==='object'?String(reviewerAliasContext.alias||reviewerAliasContext.reviewerAlias||'').trim()||null:null;"
new="const promptAliases=Array.isArray(selectedPrompt.contextManifest?.blindAliasMap)?selectedPrompt.contextManifest.blindAliasMap:[],providedAlias=reviewerAliasContext&&typeof reviewerAliasContext==='object'?reviewerAliasContext:null,aliasEntries=providedAlias?[providedAlias]:promptAliases,reviewerAlias=String(aliasEntries[0]?.alias||aliasEntries[0]?.reviewerAlias||'').trim()||null,publicIdentity=value=>{const text=String(value??'');const match=aliasEntries.find(entry=>String(entry.canonicalId||'')===text);return match?String(match.alias):value;},publicScope=Object.fromEntries(Object.entries(selectedPrompt.scope||{}).map(([key,value])=>[key,publicIdentity(value)]));"
assert old in s; s=s.replace(old,new,1)
old="scope:clone(selectedPrompt.scope||{}),fullTextSha256,text:exactPrompt"
new="scope:clone(publicScope),fullTextSha256,text:exactPrompt"
assert old in s; s=s.replace(old,new,1)
old="runId:normalizedRunId,reviewerAlias,productId:productId||project.job?.CURRENT_PRODUCT_ID||null"
new="runId:publicIdentity(normalizedRunId),reviewerAlias,productId:publicIdentity(productId||project.job?.CURRENT_PRODUCT_ID||null)"
assert old in s; s=s.replace(old,new,1)
p.write_text(s)

# app-core.js: stop passing an explicit null; the saved prompt is the single alias authority.
p=Path('app-core.js'); s=p.read_text()
old="runId:scope.runId||null,reviewerAliasContext:null,instructionId:"
new="runId:scope.runId||null,instructionId:"
assert old in s; s=s.replace(old,new,1)
p.write_text(s)

# response-ingestion.js: preserve exact raw response, but remap only prompt-authorized aliases in the parsed working copy before validation/proposal.
p=Path('response-ingestion.js'); s=p.read_text()
marker='function disposition(project,type,{stage,rawResponseId,promptId,validationId,proposalId=null,receiptId=null,details={}}){'
helper=r'''function remapBlindAliases(envelope,promptRecord){const entries=Array.isArray(promptRecord?.contextManifest?.blindAliasMap)?promptRecord.contextManifest.blindAliasMap:[];if(!entries.length)return {envelope,changed:false};const byAlias=new Map(entries.map(entry=>[String(entry.alias||''),String(entry.canonicalId||'')]).filter(([alias,id])=>alias&&id));let changed=false;const walk=value=>{if(typeof value==='string'&&byAlias.has(value)){changed=true;return byAlias.get(value);}if(Array.isArray(value))return value.map(walk);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,walk(item)]));return value;};const mapped=walk(envelope);if(changed)Object.defineProperty(mapped,'__blindAliasRemap',{value:true,enumerable:false});return {envelope:mapped,changed};}
'''
assert 'function remapBlindAliases(' not in s
s=s.replace(marker,helper+marker,1)
old="let envelope=null,parseError=null;try{envelope=strictParse(rawText);}catch(error){parseError=error;}\n  if(envelope){const envelopeHash="
new="let envelope=null,parseError=null;try{envelope=strictParse(rawText);}catch(error){parseError=error;}if(envelope){const remapped=remapBlindAliases(envelope,prompt);envelope=remapped.envelope;}\n  if(envelope){const envelopeHash="
assert old in s; s=s.replace(old,new,1)
old="if(envelope?.__parseNormalization){validation.issues.push(issue('JSON_TYPOGRAPHY_NORMALIZED'"
new="if(envelope?.__blindAliasRemap){validation.issues.push(issue('BLIND_ALIAS_REMAPPED','/','Application-issued blind review aliases were remapped to their prompt-bound canonical identities for validation; the exact raw response remains preserved unchanged.','WARNING'));validation.warningCount=validation.issues.filter(item=>item.severity==='WARNING').length;}if(envelope?.__parseNormalization){validation.issues.push(issue('JSON_TYPOGRAPHY_NORMALIZED'"
assert old in s; s=s.replace(old,new,1)
# agent-origin extraction entries must record alias normalization when it occurred
s=s.replace("origin:'AGENT_VALUE',jsonPointer:`/stageData/${pointerEscape(name)}`,rawValueHash:hash.sha256Value(value),normalizerUsed:null","origin:'AGENT_VALUE',jsonPointer:`/stageData/${pointerEscape(name)}`,rawValueHash:hash.sha256Value(value),normalizerUsed:envelope.__blindAliasRemap?'BLIND_ALIAS_REMAP':null")
s=s.replace("origin:'AGENT_VALUE',jsonPointer:`/records/${pointerEscape(collection)}/${index}/fields/${pointerEscape(name)}`,rawValueHash:hash.sha256Value(value),normalizerUsed:null","origin:'AGENT_VALUE',jsonPointer:`/records/${pointerEscape(collection)}/${index}/fields/${pointerEscape(name)}`,rawValueHash:hash.sha256Value(value),normalizerUsed:envelope.__blindAliasRemap?'BLIND_ALIAS_REMAP':null")
s=s.replace("origin:'AGENT_VALUE',jsonPointer:`/evidence/${index}/${pointerEscape(name)}`,rawValueHash:hash.sha256Value(value),normalizerUsed:null","origin:'AGENT_VALUE',jsonPointer:`/evidence/${index}/${pointerEscape(name)}`,rawValueHash:hash.sha256Value(value),normalizerUsed:envelope.__blindAliasRemap?'BLIND_ALIAS_REMAP':null")
p.write_text(s)
