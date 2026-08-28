from pathlib import Path

def function_span(text,name):
    marker=f'function {name}('
    start=text.find(marker)
    if start<0: raise RuntimeError(f'{name} missing')
    paren=text.find('(',start+len(f'function {name}'))
    depth=0; quote=None; esc=False; close=None; i=paren
    while i<len(text):
        ch=text[i]
        if quote:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==quote: quote=None
        else:
            if ch in "'\"`": quote=ch
            elif ch=='(': depth+=1
            elif ch==')':
                depth-=1
                if depth==0: close=i; break
        i+=1
    if close is None: raise RuntimeError(f'{name} parameters unclosed')
    brace=text.find('{',close+1)
    end=balanced_brace_end(text,brace)
    return start,end

def balanced_brace_end(text,brace):
    if brace<0: raise RuntimeError('opening brace missing')
    depth=0; quote=None; esc=False; line=False; block=False; i=brace
    while i<len(text):
        ch=text[i]; nxt=text[i+1] if i+1<len(text) else ''
        if line:
            if ch=='\n': line=False
        elif block:
            if ch=='*' and nxt=='/': block=False; i+=1
        elif quote:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==quote: quote=None
        else:
            if ch=='/' and nxt=='/': line=True; i+=1
            elif ch=='/' and nxt=='*': block=True; i+=1
            elif ch in "'\"`": quote=ch
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return i
        i+=1
    raise RuntimeError('body unclosed')

p=Path('workflow-engine.js'); s=p.read_text()

old="else if(collection==='regressionExecutions')recordFields(r).RESULT=d;"
new="else if(collection==='regressionExecutions'){const phase=upper(recordValue(r,'PHASE'));recordFields(r).RESULT=phase==='PRE_CORRECTION'?(d==='SATISFIED'?'VIOLATED':d==='VIOLATED'?'SATISFIED':'UNDETERMINED'):d;}"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise RuntimeError('adjudicatedClone regression compatibility anchor missing')

old_attach="const attachmentId=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim();if(attachmentId){const a=records(project,'artifacts').find(x=>recordId(x,'artifacts')===attachmentId);if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')reasons.push('Referenced evidence attachment bytes are not application-verified.');}"
new_attach="const rawAttachmentId=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim(),attachmentId=['','UNKNOWN','NONE','NOT APPLICABLE','PENDING','UNASSIGNED'].includes(upper(rawAttachmentId))?'':rawAttachmentId;if(attachmentId){const a=records(project,'artifacts').find(x=>recordId(x,'artifacts')===attachmentId);if(!a||upper(recordValue(a,'AVAILABILITY'))!=='BYTES_PERSISTED_AND_VERIFIED')reasons.push('Referenced evidence attachment bytes are not application-verified.');}"
if old_attach in s:s=s.replace(old_attach,new_attach,1)
elif new_attach not in s:raise RuntimeError('evidence attachment validation anchor missing')
old_required="if(requiresAttachment&&!evidence.some(item=>String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim()))reasons.push('The controlling test requires an attachment-backed evidence record.');"
new_required="if(requiresAttachment&&!evidence.some(item=>{const id=String(recordValue(item,'ATTACHMENT_ID')||item?.relationships?.ATTACHMENT_ID||'').trim();return !['','UNKNOWN','NONE','NOT APPLICABLE','PENDING','UNASSIGNED'].includes(upper(id));}))reasons.push('The controlling test requires an attachment-backed evidence record.');"
if old_required in s:s=s.replace(old_required,new_required,1)
elif new_required not in s:raise RuntimeError('required attachment evidence anchor missing')

old_observed="for(const key of ['OBSERVED_RESULT','ACTUAL_RESULT','OBSERVED_MEANING','OBSERVATIONS','RESULT','VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS','PROCESS_EVIDENCE','PRODUCT_EVIDENCE'])"
new_observed="for(const key of ['OBSERVED_RESULT','ACTUAL_RESULT','OBSERVED_MEANING','OBSERVATIONS','RESULT','VALIDATOR_RESULTS','MEANING_VERIFICATION_RESULTS','PROCESS_EVIDENCE','PRODUCT_EVIDENCE','FINDINGS'])"
if old_observed in s:s=s.replace(old_observed,new_observed,1)
elif new_observed not in s:raise RuntimeError('observed-value adapter anchor missing')

marker="if(collection==='preflightRecords'){"
start=s.find(marker)
if start<0:raise RuntimeError('preflight adapter marker missing')
brace=s.find('{',start)
end=balanced_brace_end(s,brace)
new_preflight="if(collection==='preflightRecords'){const adverseField=(value)=>{if(value===null||value===undefined||adjudicationEmpty(value))return false;if(typeof value==='boolean')return value;if(typeof value==='number')return value>0;if(Array.isArray(value))return value.some(v=>!adjudicationEmpty(v));if(typeof value==='object')return Object.values(value).some(adverseField);const out=controlledOutcome(value);return out==='VIOLATED'||['OPEN','UNRESOLVED','PRESENT','FOUND','YES','TRUE','UNAVAILABLE','MISSING','CONFLICT'].includes(upper(value));};for(const key of ['MULTIPLE_INTERPRETATIONS','UNDEFINED_OBJECTS','UNSUPPLIED_DEPENDENCIES','INTERNAL_CONFLICTS','UNAVAILABLE_CAPABILITIES'])if(adverseField(recordValue(record,key)))reasons.push(key+' contains an unresolved preflight finding.');for(const key of ['OBJECTIVELY_VERIFIABLE','RESPONSIBLE_OPERATION_ASSIGNED','ORDER_CLEAR','FAILURE_BEHAVIOR_DEFINED','TRACEABILITY']){const value=recordValue(record,key);if(!adjudicationEmpty(value)&&controlledOutcome(value)!=='SATISFIED'&&!truth(value))reasons.push(key+' is explicitly not established.');}if(!evidence.sufficient)reasons.push(...evidence.reasons);determination=reasons.length?'UNDETERMINED':'SATISFIED';}"
s=s[:start]+new_preflight+s[end+1:]

old_gate="case 9:\n      requireAccepted();requireCount('preflightRecords',1);\n      if(collection('preflightRecords').some(record=>['VIOLATED','UNDETERMINED','BLOCKED','REJECTED'].includes(upper(recordValue(record,'DETERMINATION')))))reasons.push('Instruction preflight contains an unresolved material finding.');\n      break;"
new_gate="case 9:\n      requireAccepted();requireCount('preflightRecords',1);\n      for(const record of collection('preflightRecords')){const evaluation=evaluateResultConsistency('preflightRecords',record,null,project);if(evaluation.determination!=='SATISFIED')reasons.push(...(evaluation.reasons.length?evaluation.reasons:['Instruction preflight is not application-established as satisfied.']));}\n      break;"
if old_gate in s:s=s.replace(old_gate,new_gate,1)
elif new_gate not in s:raise RuntimeError('Stage 9 application-owned gate anchor missing')

wrapper_marker='function detectCurrentContradictionsBase('
if wrapper_marker not in s:
    start,end=function_span(s,'detectCurrentContradictions')
    base=s[start:end+1].replace('function detectCurrentContradictions(','function detectCurrentContradictionsBase(',1)
    wrapper="""
function detectCurrentContradictions(project){
  const contradictions=detectCurrentContradictionsBase(project);
  const claimedByKey=(collection)=>{const map=new Map();for(const r of recordsForCurrentScope(project,collection)){const key=[resultRequirementId(project,r),String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')].join('|'),claim=claimedDetermination(collection,r);if(!map.has(key))map.set(key,[]);map.get(key).push({record:r,claim});}return map;};
  const detClaims=claimedByKey('deterministicResults'),meaningClaims=claimedByKey('meaningResults'),advClaims=claimedByKey('adversarialResults');
  const opposed=(a,b)=>(a==='SATISFIED'&&['VIOLATED','REJECTED','FAILED','FAIL'].includes(b))||(b==='SATISFIED'&&['VIOLATED','REJECTED','FAILED','FAIL'].includes(a));
  for(const [key,ds] of detClaims)for(const d of ds)for(const m of meaningClaims.get(key)||[])if(opposed(d.claim,m.claim)&&!contradictions.some(x=>x.type==='DETERMINISTIC_MEANING_CONFLICT'&&x.key===key))contradictions.push({type:'DETERMINISTIC_MEANING_CONFLICT',severity:'RELEASE_MATERIAL',key,recordIds:[recordId(d.record,'deterministicResults'),recordId(m.record,'meaningResults')],reason:'Deterministic and meaning records assert mutually exclusive conclusions; application adjudication must resolve the conflict.'});
  for(const [key,ms] of meaningClaims)for(const m of ms)for(const a of advClaims.get(key)||[])if(opposed(m.claim,a.claim)&&!contradictions.some(x=>x.type==='MEANING_ADVERSARIAL_CONFLICT'&&x.key===key))contradictions.push({type:'MEANING_ADVERSARIAL_CONFLICT',severity:'RELEASE_MATERIAL',key,recordIds:[recordId(m.record,'meaningResults'),recordId(a.record,'adversarialResults')],reason:'Meaning and adversarial records assert mutually exclusive conclusions; application adjudication must resolve the conflict.'});
  return contradictions;
}
"""
    s=s[:start]+base+wrapper+s[end+1:]
elif 'function detectCurrentContradictions(project)' not in s:
    raise RuntimeError('contradiction base exists without wrapper')

p.write_text(s)

# The legacy full-cycle fixture previously asserted arbitrary verifier-context
# strings. Under the mandatory-release contract that is intentionally invalid.
# Keep the same lifecycle assertions, but establish every verifier context via
# the application-owned context registry before the verification observation is
# submitted. This changes test setup only; production never trusts the string.
vf=Path('verify-full-cycle.mjs'); v=vf.read_text()
old_verify="function verifyBatch(stage,operation,slots){const records=[];for(const {runId} of slots)for(const test of stage6Tests){const currentTestId=engine.recordId(test,'tests'),testType=engine.recordValue(test,'TEST_TYPE');records.push(recordProposal(schema,'verification',{tempKey:`verify-${runId}-${currentTestId}`,relationships:{REQ_ID:{recordId:reqId},RUN_ID:{recordId:runId},TEST_ID:{recordId:currentTestId}},overrides:{VERIFIER:'INDEPENDENT_VERIFIER',VERIFIER_CONTEXT_ID:`VERIFY-${runId}-${currentTestId}`,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:'Canonical run output',PROCEDURE:`Execute ${testType} test`,EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:`Evidence ${runId} ${currentTestId}`,DETERMINATION:'SATISFIED'}}));}data(stage,{operation,records:{verification:records}});}"
new_verify="function verifyBatch(stage,operation,slots){const records=[];for(const {runId} of slots)for(const test of stage6Tests){const currentTestId=engine.recordId(test,'tests'),testType=engine.recordValue(test,'TEST_TYPE'),verifierContext=engine.registerFreshContext(p,{stage,externalContextIdentifier:`VERIFY-${stage}-${runId}-${currentTestId}`,operatorLabel:'FULL_CYCLE'}),verifierContextId=engine.recordId(verifierContext,'freshContexts');records.push(recordProposal(schema,'verification',{tempKey:`verify-${runId}-${currentTestId}`,relationships:{REQ_ID:{recordId:reqId},RUN_ID:{recordId:runId},TEST_ID:{recordId:currentTestId}},overrides:{VERIFIER:'INDEPENDENT_VERIFIER',VERIFIER_CONTEXT_ID:verifierContextId,INDEPENDENCE_STATUS:'INDEPENDENT',INPUTS:'Canonical run output',PROCEDURE:`Execute ${testType} test`,EXPECTED_RESULT:'SATISFIED',OBSERVED_RESULT:'SATISFIED',EXACT_EVIDENCE:`Evidence ${runId} ${currentTestId}`,DETERMINATION:'SATISFIED'}}));}data(stage,{operation,records:{verification:records}});}"
if old_verify in v:v=v.replace(old_verify,new_verify,1)
elif new_verify not in v:raise RuntimeError('full-cycle verifier-context fixture anchor missing')
vf.write_text(v)

# CI trigger only: runtime transformations above are unchanged.
