from pathlib import Path

engine = Path('workflow-engine.js')
text = engine.read_text()

old = "if(Number(stage)===2&&upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE'){project.job.CURRENT_SOURCE_SET_VERSION='NOT APPLICABLE';return null;}"
new = "if(Number(stage)===2&&upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE'){project.job.CURRENT_SOURCE_SET_VERSION=null;return null;}"
if text.count(old) != 1:
    raise SystemExit(f'Expected exactly one Stage 02 sentinel assignment, found {text.count(old)}')
text = text.replace(old, new)

old = "deliveryRecords:27,deploymentManifests:1"
new = "deliveryRecords:30,deploymentManifests:1"
if text.count(old) != 1:
    raise SystemExit(f'Expected exactly one deliveryRecords responsible-stage defect, found {text.count(old)}')
text = text.replace(old, new)
engine.write_text(text)

test = Path('verify-v3-definition-of-done.mjs')
body = test.read_text()
marker = 'SPEC_P4_CANONICAL_POINTER_AND_RESPONSIBLE_STAGE_REGRESSION'
if marker not in body:
    body += '''\n\n// SPEC_P4_CANONICAL_POINTER_AND_RESPONSIBLE_STAGE_REGRESSION\n{\n  const source=fs.readFileSync('workflow-engine.js','utf8');\n  assert(!source.includes(\"CURRENT_SOURCE_SET_VERSION='NOT APPLICABLE'\"),'Stage 02 must not write a sentinel string into nullable CURRENT_SOURCE_SET_VERSION.');\n  assert(source.includes('deliveryRecords:30,deploymentManifests:1'),'deliveryRecords must invalidate from its declared Stage 30 owner, not Stage 27.');\n  assert(!source.includes('deliveryRecords:27,deploymentManifests:1'),'The obsolete Stage 27 deliveryRecords responsible-stage mapping must remain absent.');\n}\n'''
    test.write_text(body)
