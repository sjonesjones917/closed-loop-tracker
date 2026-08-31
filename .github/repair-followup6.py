from pathlib import Path

path = Path('workflow-engine.js')
text = path.read_text()
old = "plans=testExecutionPlan(project).filter(item=>String(item.requirementId||'')===reqId)"
new = "plans=testExecutionPlan(project).items.filter(item=>String(item.requirementId||'')===reqId)"
if old not in text:
    raise AssertionError('Stage 07 execution-plan array misuse was not found.')
path.write_text(text.replace(old, new, 1))
print('Stage 07 now consumes the authoritative testExecutionPlan().items collection instead of treating the plan object as an array.')
