from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()
marker='function detectCurrentContradictions('
start=s.find(marker)
if start<0: raise RuntimeError('detectCurrentContradictions missing')
paren=s.find('(',start+len('function detectCurrentContradictions'))
depth=0; quote=None; esc=False; close=None
i=paren
while i<len(s):
    ch=s[i]
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
if close is None: raise RuntimeError('unclosed contradiction parameters')
brace=s.find('{',close+1)
depth=0; quote=None; esc=False; line=False; block=False; end=None
i=brace
while i<len(s):
    ch=s[i]; nxt=s[i+1] if i+1<len(s) else ''
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
if end is None: raise RuntimeError('unclosed contradiction body')
fn=s[start:end+1]
needle='return contradictions;'
if needle not in fn: raise RuntimeError('contradiction return anchor missing')
addition="""const claimedByKey=(collection)=>{const map=new Map();for(const r of recordsForCurrentScope(project,collection)){const key=[resultRequirementId(project,r),String(recordValue(r,'TEST_ID')||r.relationships?.TEST_ID||'')].join('|'),claim=claimedDetermination(collection,r);if(!map.has(key))map.set(key,[]);map.get(key).push({record:r,claim});}return map;};
  const detClaims=claimedByKey('deterministicResults'),meaningClaims=claimedByKey('meaningResults'),advClaims=claimedByKey('adversarialResults');
  const opposed=(a,b)=>(a==='SATISFIED'&&['VIOLATED','REJECTED','FAILED','FAIL'].includes(b))||(b==='SATISFIED'&&['VIOLATED','REJECTED','FAILED','FAIL'].includes(a));
  for(const [key,ds] of detClaims){for(const d of ds)for(const m of meaningClaims.get(key)||[])if(opposed(d.claim,m.claim)&&!contradictions.some(x=>x.type==='DETERMINISTIC_MEANING_CONFLICT'&&x.key===key))contradictions.push({type:'DETERMINISTIC_MEANING_CONFLICT',severity:'RELEASE_MATERIAL',key,recordIds:[recordId(d.record,'deterministicResults'),recordId(m.record,'meaningResults')],reason:'Deterministic and meaning records assert mutually exclusive conclusions; application adjudication must resolve the conflict.'});}
  for(const [key,ms] of meaningClaims){for(const m of ms)for(const a of advClaims.get(key)||[])if(opposed(m.claim,a.claim)&&!contradictions.some(x=>x.type==='MEANING_ADVERSARIAL_CONFLICT'&&x.key===key))contradictions.push({type:'MEANING_ADVERSARIAL_CONFLICT',severity:'RELEASE_MATERIAL',key,recordIds:[recordId(m.record,'meaningResults'),recordId(a.record,'adversarialResults')],reason:'Meaning and adversarial records assert mutually exclusive conclusions; application adjudication must resolve the conflict.'});}
  return contradictions;"""
fn2=fn.replace(needle,addition,1)
s=s[:start]+fn2+s[end+1:]
p.write_text(s)
