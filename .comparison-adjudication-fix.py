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
p.write_text(s)
