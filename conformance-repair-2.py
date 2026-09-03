from pathlib import Path

def replace_once(s,old,new,label):
    if new in s:return s
    if old not in s:raise SystemExit(f'missing anchor: {label}')
    return s.replace(old,new,1)

p=Path('response-ingestion.js');s=p.read_text()
s=replace_once(s,
"const TOP_LEVEL_KEYS=Object.freeze(['schema','jobId','stage','operation','promptIdentity','scope','responseType','humanInputRequests','stageData','records','evidence','unresolved','warnings','attachments']);",
"const TOP_LEVEL_KEYS=Object.freeze(['schema','contractProfileId','jobId','stage','operation','promptIdentity','packageId','operationReservationId','challengeNonce','scope','responseType','humanInputRequests','humanAuthorityCandidates','stageData','records','evidence','unresolved','warnings','attachments']);",
'envelope keys')
s=replace_once(s,
"const RESPONSE_SCOPE_KEYS=Object.freeze(['projectRevision','inputVersion','sourceSetVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','baselineId','productId']);",
"const RESPONSE_SCOPE_KEYS=Object.freeze(['projectRevision','inputVersion','sourceSetVersion','researchVersion','requirementsVersion','testSuiteVersion','instructionVersion','iterationId','candidateId','runId','contextId','sourceConvergedIterationId','confirmationIterationId','baselineId','productId','productVersion','deliveryCandidateSetId','reviewVersion','reconciledReviewVersion','releaseId','hashReviewId','evidenceChainVersion']);",
'response scope keys')
start='  let envelope,normalization=null,firstError=null;try{envelope=parseCandidate(trimmed);}'
if start in s:
    a=s.index(start);b=s.index("\n  if(!object(envelope))",a);end=s.index("return envelope;",b)+len("return envelope;")
    replacement="""  if(/[“”]/.test(trimmed))throw Object.assign(new Error('Unsafe smart or curly quotation marks are invalid in an authoritative response JSON file.'),{code:'SMART_JSON_QUOTATION'});
  let envelope;
  try{envelope=parseCandidate(trimmed);}catch(error){if(error.code)throw error;const likelyTruncated=!trimmed.endsWith('}')||((trimmed.match(/{/g)||[]).length!==(trimmed.match(/}/g)||[]).length);throw Object.assign(new Error(`Response JSON could not be parsed: ${error.message}`),{code:likelyTruncated?'TRUNCATED_RESPONSE':'MALFORMED_JSON',cause:error});}
  if(!object(envelope))throw Object.assign(new Error('The response root must be one JSON object.'),{code:'INVALID_ROOT'});
  return envelope;"""
    s=s[:a]+replacement+s[end:]
p.write_text(s)

Path('verify-response-envelope-conformance.mjs').write_text(r'''import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type}};globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});const ingestion=globalThis.closedLoopResponseIngestion;assert(ingestion,'ingestion missing');let smart=false;try{ingestion.strictParse('{“schema”:“closed-loop-stage-response/3”}');}catch(e){smart=e?.code==='SMART_JSON_QUOTATION';}assert(smart,'authoritative smart-quote JSON must be rejected, not repaired');const src=fs.readFileSync('response-ingestion.js','utf8');for(const key of ['contractProfileId','packageId','operationReservationId','challengeNonce','humanAuthorityCandidates','researchVersion','productVersion','deliveryCandidateSetId','reviewVersion','reconciledReviewVersion','releaseId','hashReviewId','evidenceChainVersion'])assert(src.includes(`'${key}'`),`response contract missing ${key}`);assert(!src.includes("normalization='SMART_JSON_DELIMITERS'"),'smart quote repair remains reachable');console.log('response envelope conformance regressions passed');
''')

# Replace the obsolete acceptance assertion: authoritative curly-quoted JSON must fail closed and preserve raw bytes without mutation.
p=Path('verify-ingestion.mjs');t=p.read_text()
old="""// Mobile/chat smart punctuation is normalized while the exact raw response remains preserved for audit.
{
  const p=project('JOB-SMART-QUOTE-JSON'),stage=2,promptRecord=savePrompt(p,stage),envelope=validEnvelope(p,stage,promptRecord);
  envelope.evidence[0].content='He said \"keep the exact words\".';
  const canonical=JSON.stringify(envelope);
  let smart='',inString=false;
  for(let i=0;i<canonical.length;i++){
    const c=canonical[i];
    if(!inString&&c==='\"'){smart+='“';inString=true;continue;}
    if(inString){
      if(c==='\\\\'&&canonical[i+1]==='\"'){smart+='\"';i++;continue;}
      if(c==='\"'){smart+='”';inString=false;continue;}
    }
    smart+=c;
  }
  const prepared=ingestion.prepare(p,{stage,text:smart,promptRecord});
  if(!prepared.validation.valid)throw new Error(`Smart-quoted mobile JSON was not normalized: ${JSON.stringify(prepared.validation.issues)}`);
  if(!prepared.validation.issues.some(issue=>issue.code==='JSON_TYPOGRAPHY_NORMALIZED'&&issue.severity==='WARNING'))throw new Error('Smart-quote normalization warning was not preserved.');
  if(prepared.rawRecord.completeRawResponse!==smart)throw new Error('Exact smart-quoted raw response was not preserved unchanged.');
  if(prepared.project.projectData.acceptedChanges.length)throw new Error('Smart-quoted response changed canonical state before operator acceptance.');
}
"""
new="""// Authoritative response bytes with smart/curly JSON delimiters are rejected exactly; they are never repaired into a different authoritative response.
{
  const p=project('JOB-SMART-QUOTE-JSON'),stage=2,promptRecord=savePrompt(p,stage),envelope=validEnvelope(p,stage,promptRecord);
  envelope.evidence[0].content='He said \"keep the exact words\".';
  const canonical=JSON.stringify(envelope);
  let smart='',inString=false;
  for(let i=0;i<canonical.length;i++){
    const c=canonical[i];
    if(!inString&&c==='\"'){smart+='“';inString=true;continue;}
    if(inString){if(c==='\\\\'&&canonical[i+1]==='\"'){smart+='\"';i++;continue;}if(c==='\"'){smart+='”';inString=false;continue;}}
    smart+=c;
  }
  const prepared=ingestion.prepare(p,{stage,text:smart,promptRecord});
  if(prepared.validation.valid)throw new Error('Smart-quoted authoritative JSON was accepted instead of rejected.');
  if(!prepared.validation.issues.some(issue=>issue.code==='SMART_JSON_QUOTATION'))throw new Error(`Smart-quoted authoritative JSON did not fail with SMART_JSON_QUOTATION: ${JSON.stringify(prepared.validation.issues)}`);
  if(prepared.rawRecord.completeRawResponse!==smart)throw new Error('Exact rejected smart-quoted raw response was not preserved unchanged.');
  if(prepared.project.projectData.acceptedChanges.length)throw new Error('Rejected smart-quoted response changed canonical state.');
}
"""
if old not in t:raise SystemExit('smart quote legacy regression anchor changed')
p.write_text(t.replace(old,new,1))
