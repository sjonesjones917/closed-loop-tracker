from pathlib import Path

def brace_end(text, start):
    depth=0; quote=None; esc=False; line=False; block=False; i=start
    while i < len(text):
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
                if depth==0: return i
        i+=1
    raise RuntimeError('unclosed body')

def replace_function(text,name,replacement):
    start=text.find(f'function {name}(')
    if start<0: raise RuntimeError(f'{name} missing')
    brace=text.find('{',start)
    end=brace_end(text,brace)
    return text[:start]+replacement+text[end+1:]

p=Path('workflow-engine.js'); s=p.read_text()

comparison="function comparisonFacts(project,reqId,iterationId){const rows=(iterationId?recordsForIteration(project,'verification',iterationId):recordsForCurrentScope(project,'verification')).filter(r=>String(recordValue(r,'REQ_ID')||r.relationships?.REQ_ID||'')===reqId),determinations=rows.map(r=>evaluateResultConsistency('verification',r,testForResult(project,r),project)),ds=determinations.map(x=>x.determination);return {rows,determinations,runDeterminations:rows.map((r,i)=>({runId:String(recordValue(r,'RUN_ID')||r.relationships?.RUN_ID||''),testId:String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||''),determination:ds[i]})),allSatisfied:rows.length>0&&ds.every(d=>d==='SATISFIED'),anyViolation:ds.includes('VIOLATED'),anyUndetermined:ds.some(d=>d!=='SATISFIED'&&d!=='VIOLATED')};}"
s=replace_function(s,'comparisonFacts',comparison)

old="return !expectedSet.has(key)||!['SATISFIED','VIOLATED','UNDETERMINED'].includes(evaluation.determination)||!evaluation.evidence?.sufficient||evaluation.reasons.some(reason=>reason.includes('independence is not application-established'));"
new="return !expectedSet.has(key)||evaluation.determination!=='SATISFIED'||!evaluation.evidence?.sufficient||evaluation.reasons.some(reason=>reason.includes('independence is not application-established'));"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise RuntimeError('verificationMatrix determination anchor missing')

root_cause="function validateRootCauseRecord(record,project){const reasons=[],defectId=String(recordValue(record,'DEFECT_ID')||record?.relationships?.DEFECT_ID||'').trim(),defect=records(project,'defects').find(d=>recordId(d,'defects')===defectId);if(!defect)reasons.push('RCA defect identity is missing or does not resolve.');else if(!scopeMatches(record,defect.scope||{},requiredVersionScopeKeys('rootCauses')))reasons.push('RCA scope does not match the associated defect scope.');for(const key of ['LAYER_TRACE','EARLIEST_DEFECTIVE_LAYER','ROOT_CAUSE','DOWNSTREAM_INVALIDATION'])if(adjudicationEmpty(recordValue(record,key)))reasons.push('RCA '+key+' is missing.');if(adjudicationEmpty(recordValue(record,'EVIDENCE'))&&!safe(record?.evidenceRefs).length)reasons.push('RCA evidence linkage is missing.');return {valid:reasons.length===0,reasons,defectId,responsibleLayer:String(recordValue(record,'EARLIEST_DEFECTIVE_LAYER')||'').trim()};}"
s=replace_function(s,'validateRootCauseRecord',root_cause)

change_trace="function validateChangeTrace(record,project){const reasons=[],triggerRaw=recordValue(record,'TRIGGERING_DEFECT_IDS'),triggerIds=Array.isArray(triggerRaw)?triggerRaw.map(String):String(triggerRaw||'').split(/[;,\\s]+/).filter(Boolean),layer=String(recordValue(record,'RESPONSIBLE_LAYER')||'').trim();if(!triggerIds.length)reasons.push('Changeset has no triggering defect identity.');if(!layer)reasons.push('Changeset responsible layer is missing.');if(adjudicationEmpty(recordValue(record,'EXACT_MODIFICATION')))reasons.push('Changeset exact modification is missing.');if(adjudicationEmpty(recordValue(record,'NEW_ARTIFACT_VERSION')))reasons.push('Changeset changed artifact/version identity is missing.');if(adjudicationEmpty(recordValue(record,'DOWNSTREAM_INVALIDATION')))reasons.push('Changeset downstream invalidation statement is missing.');for(const id of triggerIds){const defect=records(project,'defects').find(d=>recordId(d,'defects')===id);if(!defect){reasons.push('Triggering defect '+id+' does not resolve.');continue;}if(!scopeMatches(record,defect.scope||{},requiredVersionScopeKeys('changes')))reasons.push('Changeset scope does not match defect '+id+'.');const rcas=records(project,'rootCauses').filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===id&&scopeMatches(r,defect.scope||{},requiredVersionScopeKeys('rootCauses')));if(rcas.length!==1){reasons.push('Exactly one scope-matched RCA is required for '+id+'.');continue;}const rv=validateRootCauseRecord(rcas[0],project);if(!rv.valid)reasons.push(...rv.reasons.map(x=>id+': '+x));if(rv.responsibleLayer&&layer&&upper(rv.responsibleLayer)!==upper(layer)&&upper(recordValue(record,'AUTHORIZATION'))!=='CONTROLLED OVERRIDE')reasons.push('Changeset responsible layer does not match RCA for '+id+' and no controlled override exists.');}return {valid:reasons.length===0,reasons,triggerIds};}"
s=replace_function(s,'validateChangeTrace',change_trace)

old14="if(stage===14)for(const defect of confirmedDefects(project)){const id=recordId(defect,'defects'),rcas=records(project,'rootCauses').filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===id);if(rcas.length!==1)add(['Exactly one complete RCA is required for '+id+'.']);else{const v=validateRootCauseRecord(rcas[0],project);if(!v.valid)add(v.reasons.map(x=>id+': '+x));}}"
new14="if(stage===14)for(const defect of confirmedDefects(project)){const id=recordId(defect,'defects'),rcas=records(project,'rootCauses').filter(r=>String(recordValue(r,'DEFECT_ID')||r.relationships?.DEFECT_ID||'')===id&&scopeMatches(r,defect.scope||{},requiredVersionScopeKeys('rootCauses')));if(rcas.length!==1)add(['Exactly one scope-matched complete RCA is required for '+id+'.']);else{const v=validateRootCauseRecord(rcas[0],project);if(!v.valid)add(v.reasons.map(x=>id+': '+x));}}"
if old14 in s:s=s.replace(old14,new14,1)
elif new14 not in s:raise RuntimeError('Stage 14 trace gate anchor missing')

old16="if(stage===16){for(const defect of confirmedDefects(project)){const id=recordId(defect,'defects'),changes=recordsForCurrentScope(project,'changes').filter(c=>String(recordValue(c,'TRIGGERING_DEFECT_IDS')||'').includes(id));if(changes.length!==1)add(['Exactly one responsible-layer changeset trace is required for '+id+'.']);else{const v=validateChangeTrace(changes[0],project);if(!v.valid)add(v.reasons.map(x=>id+': '+x));}}}"
new16="if(stage===16){for(const defect of confirmedDefects(project)){const id=recordId(defect,'defects'),changes=records(project,'changes').filter(c=>String(recordValue(c,'TRIGGERING_DEFECT_IDS')||'').includes(id)&&scopeMatches(c,defect.scope||{},requiredVersionScopeKeys('changes')));if(changes.length!==1)add(['Exactly one scope-matched responsible-layer changeset trace is required for '+id+'.']);else{const v=validateChangeTrace(changes[0],project);if(!v.valid)add(v.reasons.map(x=>id+': '+x));}}}"
if old16 in s:s=s.replace(old16,new16,1)
elif new16 not in s:raise RuntimeError('Stage 16 trace gate anchor missing')

p.write_text(s)
