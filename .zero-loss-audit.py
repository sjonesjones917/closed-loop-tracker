from pathlib import Path
import re


def extract_function(text: str, name: str) -> str:
    patterns = [f'function {name}(', f'function {name}Uncached(']
    starts = [(text.find(pattern), pattern) for pattern in patterns if text.find(pattern) >= 0]
    if not starts:
        return f'FUNCTION {name}: NOT FOUND\n'
    start, pattern = min(starts)
    brace = text.find('{', start)
    depth = 0
    quote = None
    escape = False
    template_depth = 0
    for index in range(brace, len(text)):
        ch = text[index]
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if quote:
            if ch == quote:
                quote = None
            continue
        if ch in "'\"`":
            quote = ch
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:index + 1] + '\n'
    return f'FUNCTION {name}: UNTERMINATED\n'

engine = Path('workflow-engine.js').read_text()
prompt = Path('prompt-engine.js').read_text()
app = Path('app-core.js').read_text()
schema = Path('workflow-schema.js').read_text()
pages = Path('.github/workflows/pages.yml').read_text()

for name in [
    'testExecutionPlan', 'artifactHandoff', 'evaluateContextIndependence',
    'evaluateEvidenceContract', 'evaluateEvidenceSufficiency',
    'evaluateResultConsistency', 'effectiveDetermination', 'validateTraceIntegrity',
    'comparisonFacts', 'detectCurrentContradictions', 'releaseMetrics',
    'freezeBaseline', 'operationalMetrics', 'recalculate'
]:
    print(f'\n===== {name} =====')
    print(extract_function(engine, name))

print('\n===== RAW FAVORABLE-VERDICT TRUST HITS =====')
for number, line in enumerate(engine.splitlines(), 1):
    if re.search(r"recordValue\([^\n]+(?:'DETERMINATION'|'RESULT'|'PROCESS_DETERMINATION'|'PRODUCT_DETERMINATION')", line) and 'effectiveDetermination' not in line and 'claim' not in line.lower():
        print(f'{number}: {line[:1200]}')

print('\n===== PROMPT ENGINE KEY HITS =====')
for number, line in enumerate(prompt.splitlines(), 1):
    if re.search(r'Stage 0?6|Stage 0?7|Stage 11|Stage 12|Stage 23|Stage 24|FILES YOU|MUST NOT RECEIVE|MUST RETURN|false|boundary|malformed|stale', line, re.I):
        print(f'{number}: {line[:1600]}')

print('\n===== APP CORE KEY HITS =====')
for number, line in enumerate(app.splitlines(), 1):
    if re.search(r'effective|determination|contradiction|stability|canonical state changed|next required action|conversation|final JSON|handoff|withhold|expect', line, re.I):
        print(f'{number}: {line[:1600]}')

print('\n===== SCHEMA CONTROLLED FIELD TYPES =====')
for number, line in enumerate(schema.splitlines(), 1):
    if re.search(r'EXECUTION_OUTCOME|PREFLIGHT_OBSERVATION|OBSERVATION_OUTCOME|CONFIRMATION', line):
        print(f'{number}: {line[:1600]}')

print('\n===== PAGES WORKFLOW =====')
print(pages)
