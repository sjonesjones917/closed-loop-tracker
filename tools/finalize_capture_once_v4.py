from pathlib import Path


def r(p): return Path(p).read_text()
def w(p,t): Path(p).write_text(t)
def req(c,m):
    if not c: raise SystemExit(m)

# Repair infrastructure declaration and retain durable capture-once implementation.
p='workflow-engine.js'; t=r(p)
bad="'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures,'intakeArtifactSnapshots'"
good="'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures','intakeArtifactSnapshots'"
if bad in t: t=t.replace(bad,good,1)
req(good in t,'infrastructure collection repair missing')
req('function registerIntakeArtifactSnapshot(project' in t,'Stage 01 snapshot command missing')
req('capturedFromBytes:true' in t,'captured Stage 01 bytes are not in intake manifest')
w(p,t)

# Make Test IR field inventory, ownership, and type metadata exactly consistent.
p='workflow-schema.js'; t=r(p)
field_anchor="'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','INPUTS'"
field_new="'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC_SHA256','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS','INPUTS'"
if field_anchor in t: t=t.replace(field_anchor,field_new,1)
req(field_new in t,'EXECUTABLE_SPEC_SHA256 missing from canonical tests field inventory')
type_anchor="EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC:Object.freeze"
type_new="EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC:Object.freeze"
if type_anchor in t: t=t.replace(type_anchor,type_new,1)
req('EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING' in t,'EXECUTABLE_SPEC_SHA256 type metadata missing')
req('"EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256"' in t,'Test IR version/hash are not application-owned')
w(p,t)

# The application must capture Stage 01 textual bytes once and Stage 04 must prohibit resupply.
p='app-core.js'; t=r(p)
req("new TextDecoder('utf-8',{fatal:true})" in t,'Stage 01 UTF-8 capture missing')
req("role:Number(stage)===1?'INPUT_INTENT_ARTIFACT':'STAGE_ARTIFACT'" in t,'Stage 01 intent artifact role missing')
req('Do not reattach, resend, retype, restate, reconstruct, or summarize project information already captured.' in t,'Stage 04 no-resupply rule missing')
w(p,t)

# Wire capture-once regression into both PR/main test and deployment source reproof.
p='.github/workflows/pages.yml'; t=r(p)
if t.count('node verify-intent-capture.mjs')<1:
    a='''      - name: Workflow and gates\n        run: |\n          node verify-complete.mjs\n          node verify-full-cycle.mjs\n'''
    b='''      - name: Workflow and gates\n        run: |\n          node verify-complete.mjs\n          node verify-full-cycle.mjs\n          node verify-intent-capture.mjs\n'''
    req(a in t,'workflow test insertion block missing'); t=t.replace(a,b,1)
if t.count('node verify-intent-capture.mjs')<2:
    a='''          node verify-full-cycle.mjs\n          node verify-prompt-semantics.mjs\n'''
    b='''          node verify-full-cycle.mjs\n          node verify-intent-capture.mjs\n          node verify-prompt-semantics.mjs\n'''
    req(a in t,'deployment reproof insertion block missing'); t=t.replace(a,b,1)
req(t.count('node verify-intent-capture.mjs')>=2,'capture-once proof is not wired into both CI paths')
w(p,t)

print('capture-once v4 final repair complete')
