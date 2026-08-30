from pathlib import Path
import re

def rw(path): return Path(path).read_text()
def ww(path,s): Path(path).write_text(s)
def req(cond,msg):
    if not cond: raise SystemExit(msg)
def once(s,a,b,label):
    req(a in s,f'missing anchor: {label}')
    return s.replace(a,b,1)

# workbook: required contract identities and visible Stage 16 wording only; do not touch CSS/UI geometry.
p='workbook.js'; s=rw(p)
s=once(s,"const PROJECT_SCHEMA='closed-loop-project/2';","const PROJECT_SCHEMA='closed-loop-project/3';",'project schema')
s=once(s,"'REVISE THE RESPONSIBLE LAYER'","'CORRECT THE ROOT CAUSE'",'stage16 title')
ww(p,s)

# response schema identity.
p='workflow-schema.js'; s=rw(p)
s=once(s,"const RESPONSE_SCHEMA='closed-loop-stage-response/2';","const RESPONSE_SCHEMA='closed-loop-stage-response/3';",'response schema')
ww(p,s)

# Prompt authority: make Stage 01/03 exhaustive, Stage 04 closed-universe and fail closed on incomplete upstream stages.
p='prompt-engine.js'; s=rw(p)
s=re.sub(r"const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/\d+';","const PROMPT_ENGINE_VERSION='closed-loop-prompt-engine/28';",s,count=1)
req("1:'ONE-TIME INTENT FILE INTAKE:" in s,'missing stage1 procedure')
s=s.replace("1:'ONE-TIME INTENT FILE INTAKE:","1:'EXHAUSTIVE HUMAN-AUTHORITY INTAKE IS REQUIRED BEFORE STAGE 01 CAN COMPLETE. Treat every project-relevant thing the human has supplied in this job as durable authority: facts, requirements, constraints, decisions, prohibitions, requested outputs, acceptance conditions, material references, answers, corrections, and unresolved human-only issues. If the user already supplied it anywhere in current canonical project input or supplied material, do not ask for it again. The original intent file is a one-time Stage 01 source: fully exhaust it now into canonical intentStatements and never require it again. Stage 01 is NOT complete merely because a plausible summary exists; it is complete only when the entire available human-authority input has been semantically exhausted and represented without loss. ONE-TIME INTENT FILE INTAKE:",1)
req("3:'Research the current accepted Stage 02" in s,'missing stage3 procedure')
s=s.replace("3:'Research the current accepted Stage 02","3:'EXHAUSTIVE STAGE 03 RESEARCH IS REQUIRED BEFORE STAGE 04 MAY BE GENERATED. Exhaust every active requirement-relevant canonical Stage 01 intent statement and every current accepted Stage 02 source. No current intent requirement, source, applicable portion, exception, restriction, dependency, prohibition, invalidating condition, or candidate obligation may be silently skipped. A latest pass may claim saturation only after the complete current source set and complete current intent ledger have coverage and the repeated conflict/exception pass finds no new material category. Research the current accepted Stage 02",1)
req("4:'Compile atomic requirement proposals" in s,'missing stage4 procedure')
s=s.replace("4:'Compile atomic requirement proposals","4:'STAGE 04 IS A CLOSED COMPILATION STEP, NOT AN INTAKE OR REDISCOVERY STEP. It may run only after current Stage 01 and Stage 03 are COMPLETE. Use the complete union already captured by the application: all current canonical human/job input, every active canonical Stage 01 intentStatement, the accepted Stage 01 job definition, every current Stage 03 candidateRequirement, every current Stage 03 research record and its mandatory statements, prohibitions, exceptions, dependencies, applicability facts, restrictions and invalidating material, plus applicable source identities/evidence. Do not ask the human to retype, re-explain, resend, or re-attach anything already supplied. If required upstream canonical information is missing, return a missing-application-context/upstream-completeness blocker instead of asking the human to reconstruct it. Every requirement-relevant input obligation must map to one or more atomic requirements or an explicit retained/inapplicable/blocked disposition; no obligation may disappear. Compile atomic requirement proposals",1)
s=s.replace('EXECUTABLE_KIND = CUSTOM_PIPELINE','EXECUTABLE_KIND = TEST_IR')
# Hard Stage 04 generation precondition. This makes an incomplete Stage 01 or Stage 03 state unable to produce an apparently-authoritative Stage 04 prompt.
needle=" const d=core.STAGES[stage-1],existing=(state?.projectData?.generatedPrompts||[]).filter(x=>Number(x.stage)===stage),activeExisting=existing.filter(x=>!x.invalidatedBy&&x.promptEngineVersion===PROMPT_ENGINE_VERSION);"
req(needle in s,'missing buildPromptRecord anchor')
replacement=" const d=core.STAGES[stage-1],existing=(state?.projectData?.generatedPrompts||[]).filter(x=>Number(x.stage)===stage),activeExisting=existing.filter(x=>!x.invalidatedBy&&x.promptEngineVersion===PROMPT_ENGINE_VERSION);\n if(stage===4){const s1=state?.stages?.[1]||state?.stages?.['1'],s3=state?.stages?.[3]||state?.stages?.['3'];if(String(s1?.status||'').toUpperCase()!=='COMPLETE'||s1?.gate?.complete!==true)throw new Error('Stage 04 prompt generation blocked: current Stage 01 human-authority intake is not exhaustively complete.');if(String(s3?.status||'').toUpperCase()!=='COMPLETE'||s3?.gate?.complete!==true)throw new Error('Stage 04 prompt generation blocked: current Stage 03 research is not exhaustively complete.');}"
s=s.replace(needle,replacement,1)
# Global no-repeat rule immediately before bounded context.
anchor='AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE\n${contextFor(stage,state,operation,scope)}'
req(anchor in s,'missing bounded context anchor')
s=s.replace(anchor,"EXECUTION DIRECTIVE — USE CAPTURED PROJECT STATE; NEVER MAKE THE HUMAN RE-SUPPLY IT\nThe project data below is input to the stage task, not the task itself. Perform the stage-specific work. Never merely restate the context. Any project fact, requirement, constraint, decision, material reference, accepted prior-stage record, or human answer already present in current canonical context is already supplied and must be reused. Never ask the human to retype it, re-explain it, resend it, or re-attach the original Stage 01 intent file. If an earlier stage should have captured required data but did not, fail closed as incomplete/missing upstream application context; do not turn that defect into repeated human data entry.\n\nAUTHORIZED BOUNDED CONTEXT FOR THIS STAGE\n${contextFor(stage,state,operation,scope)}",1)
ww(p,s)

# Runtime canonical Test IR name.
p='test-runtime.js'; s=rw(p)
s=s.replace("'CUSTOM_PIPELINE'","'TEST_IR'").replace('CUSTOM_PIPELINE','TEST_IR')
ww(p,s)

# Static shell: add required Test IR dependency without changing any CSS or prompt-box dimensions.
p='index.html'; s=rw(p)
if "test-runtime.js" not in s:
    anchor='<script defer src="workflow-schema.js?v='
    i=s.find(anchor); req(i>=0,'missing workflow-schema script')
    end=s.find('</script>',i); req(end>=0,'missing workflow-schema end'); end+=len('</script>')
    tag=s[i:end]
    m=re.search(r'v=([^\"]+)',tag); req(m,'missing build token')
    s=s[:end]+f'\n<script defer src="test-runtime.js?v={m.group(1)}"></script>'+s[end:]
# worker-src same-origin if not already present; no other CSP widening.
if 'worker-src' not in s:
    s=s.replace("connect-src 'self'; object-src", "connect-src 'self'; worker-src 'self'; object-src",1)
ww(p,s)

# Focused permanent regression. This is source-semantic proof and is also run by the PR test workflow added separately.
Path('verify-stage01-stage03-stage04-closure.mjs').write_text(r'''import fs from 'node:fs';
const w=fs.readFileSync('workbook.js','utf8'), p=fs.readFileSync('prompt-engine.js','utf8'), s=fs.readFileSync('workflow-schema.js','utf8'), h=fs.readFileSync('index.html','utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
must(w.includes("closed-loop-project/3"),'project schema is not /3');
must(s.includes("closed-loop-stage-response/3"),'response schema is not /3');
must(w.includes('CORRECT THE ROOT CAUSE'),'Stage 16 visible title not corrected');
must(p.includes('EXHAUSTIVE HUMAN-AUTHORITY INTAKE IS REQUIRED'),'Stage 01 is not explicitly exhaustive');
must(p.includes('EXHAUSTIVE STAGE 03 RESEARCH IS REQUIRED'),'Stage 03 is not explicitly exhaustive');
must(p.includes('STAGE 04 IS A CLOSED COMPILATION STEP'),'Stage 04 is not closed over upstream state');
must(p.includes('Stage 04 prompt generation blocked: current Stage 01'),'Stage 04 does not hard-block incomplete Stage 01');
must(p.includes('Stage 04 prompt generation blocked: current Stage 03'),'Stage 04 does not hard-block incomplete Stage 03');
must(p.includes('Never ask the human to retype it, re-explain it, resend it, or re-attach'),'no-repeat rule missing');
must(!p.includes('EXECUTABLE_KIND = CUSTOM_PIPELINE'),'CUSTOM_PIPELINE still exposed');
must(p.includes('EXECUTABLE_KIND = TEST_IR'),'TEST_IR authoring instruction missing');
const order=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js'];
const src=[...h.matchAll(/<script\s+defer\s+src="([^\"]+)"/g)].map(x=>x[1].split('?')[0]);
must(order.every((x,i)=>src[i]===x),'runtime script order is not controlling order');
must(/\.stage-output\{min-height:280px\}/.test(h),'established 280px prompt/response visual baseline changed');
must(!/stage-output\{[^}]*min-height:88px/.test(h),'prohibited 88px mobile prompt/response size override returned');
console.log('verify-stage01-stage03-stage04-closure: PASS');
''')
print('apply_current_controlling_spec: complete')
