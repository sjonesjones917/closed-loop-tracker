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
    depth=0; quote=None; esc=False; line=False; block=False; end=None; i=brace
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
                if depth==0: end=i; break
        i+=1
    if end is None: raise RuntimeError(f'{name} body unclosed')
    return start,end

p=Path('workflow-engine.js'); s=p.read_text()

# Gate evaluation uses an adjudicated clone. Preserve the factual observation
# polarity of PRE_CORRECTION regressions while keeping the application-derived
# effective determination authoritative.
old="else if(collection==='regressionExecutions')recordFields(r).RESULT=d;"
new="else if(collection==='regressionExecutions'){const phase=upper(recordValue(r,'PHASE'));recordFields(r).RESULT=phase==='PRE_CORRECTION'?(d==='SATISFIED'?'VIOLATED':d==='VIOLATED'?'SATISFIED':'UNDETERMINED'):d;}"
if old in s:s=s.replace(old,new,1)
elif new not in s:raise RuntimeError('adjudicatedClone regression compatibility anchor missing')

# Keep all existing contradiction rules. Add claimed cross-method conflicts as
# release-material signals even when structural evidence makes both effective
# determinations UNDETERMINED. Claims do not control release; they only expose
# the unresolved contradiction that the application must adjudicate.
start,end=function_span(s,'detectCurrentContradictions')
fn=s[start:end+1]
if 'claimedByKey=' not in fn:
    needle='return contradictions;'
    if needle not in fn: raise RuntimeError('contradiction return anchor missing')
    addition="""const claimedByKey=(collection)=>{const map=new Map();for(const r of recordsForCurrentScope(project,collection)){const key=[resultRequirementId(project,r),String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')].join('|'),claim=claimedDetermination(collection,r);if(!map.has(key))map.set(key,[]);map.get(key).push({record:r,claim});}return map;};
  const detClaims=claimedByKey('deterministicResults'),meaningClaims=claimedByKey('meaningResults'),advClaims=claimedByKey('adversarialResults');
  const opposed=(a,b)=>(a==='SATISFIED'&&['VIOLATED','REJECTED','FAILED','FAIL'].includes(b))||(b==='SATISFIED'&&['VIOLATED','REJECTED','FAILED','FAIL'].includes(a));
  for(const [key,ds] of detClaims)for(const d of ds)for(const m of meaningClaims.get(key)||[])if(opposed(d.claim,m.claim)&&!contradictions.some(x=>x.type==='DETERMINISTIC_MEANING_CONFLICT'&&x.key===key))contradictions.push({type:'DETERMINISTIC_MEANING_CONFLICT',severity:'RELEASE_MATERIAL',key,recordIds:[recordId(d.record,'deterministicResults'),recordId(m.record,'meaningResults')],reason:'Deterministic and meaning records assert mutually exclusive conclusions; application adjudication must resolve the conflict.'});
  for(const [key,ms] of meaningClaims)for(const m of ms)for(const a of advClaims.get(key)||[])if(opposed(m.claim,a.claim)&&!contradictions.some(x=>x.type==='MEANING_ADVERSARIAL_CONFLICT'&&x.key===key))contradictions.push({type:'MEANING_ADVERSARIAL_CONFLICT',severity:'RELEASE_MATERIAL',key,recordIds:[recordId(m.record,'meaningResults'),recordId(a.record,'adversarialResults')],reason:'Meaning and adversarial records assert mutually exclusive conclusions; application adjudication must resolve the conflict.'});
  return contradictions;"""
    fn=fn.replace(needle,addition,1)
    s=s[:start]+fn+s[end+1:]

p.write_text(s)
