from pathlib import Path


def read(path): return Path(path).read_text()
def write(path,text): Path(path).write_text(text)
def require(cond,msg):
    if not cond: raise SystemExit(msg)

# Repair the one malformed infrastructure collection declaration introduced by the prior guarded patch.
p='workflow-engine.js'; t=read(p)
bad="'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures,'intakeArtifactSnapshots'"
good="'history','newJobResets','reviews','recoveredProjects','responseDispositions','executionFailures','intakeArtifactSnapshots'"
if bad in t: t=t.replace(bad,good,1)
require(good in t,'correct infrastructure collections are not present')
require("'executionFailures,'intakeArtifactSnapshots'" not in t,'malformed infrastructure collection remains')
require('function registerIntakeArtifactSnapshot(project' in t,'durable Stage 01 artifact snapshot command missing')
require('capturedFromBytes:true' in t,'Stage 01 intake manifest does not consume captured artifact content')
require('function stage4ObligationManifest(project)' in t,'Stage 04 obligation manifest missing')
write(p,t)

# Ensure operator-facing Stage 04 explanation uses application-captured memory, never repeated supply.
p='app-core.js'; t=read(p)
require("new TextDecoder('utf-8',{fatal:true})" in t,'Stage 01 textual bytes are not captured')
require("role:Number(stage)===1?'INPUT_INTENT_ARTIFACT':'STAGE_ARTIFACT'" in t,'Stage 01 intent artifact is not identified at first capture')
require('Do not reattach, resend, retype, restate, reconstruct, or summarize project information already captured.' in t,'Stage 04 capture-once operator rule missing')
write(p,t)

# Test IR ownership must remain application-owned.
p='workflow-schema.js'; t=read(p)
require('"EXECUTABLE_SPEC_VERSION",\n      "EXECUTABLE_SPEC_SHA256"' in t,'Test IR version/hash application ownership missing')
write(p,t)

# Wire the permanent capture-once regression into both pre-deploy test and exact-source reproof.
p='.github/workflows/pages.yml'; t=read(p)
workflow_block="""      - name: Workflow and gates
        run: |
          node verify-complete.mjs
          node verify-full-cycle.mjs
"""
workflow_new="""      - name: Workflow and gates
        run: |
          node verify-complete.mjs
          node verify-full-cycle.mjs
          node verify-intent-capture.mjs
"""
if 'node verify-intent-capture.mjs' not in t:
    require(workflow_block in t,'workflow-and-gates CI block missing')
    t=t.replace(workflow_block,workflow_new,1)
# There must be two occurrences after insertion: test + deploy reproof.
if t.count('node verify-intent-capture.mjs')<2:
    deploy_anchor='''          node verify-full-cycle.mjs
          node verify-prompt-semantics.mjs
'''
    require(deploy_anchor in t,'deploy reproof insertion point missing')
    t=t.replace(deploy_anchor,'''          node verify-full-cycle.mjs
          node verify-intent-capture.mjs
          node verify-prompt-semantics.mjs
''',1)
require(t.count('node verify-intent-capture.mjs')>=2,'capture-once regression is not in both CI proof paths')
write(p,t)

print('final capture-once repair and CI wiring complete')
