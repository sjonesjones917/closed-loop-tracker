from pathlib import Path
import re


def extract_function(text: str, name: str) -> str:
    patterns = [f'function {name}(', f'function {name}Uncached(']
    starts = [(text.find(pattern), pattern) for pattern in patterns if text.find(pattern) >= 0]
    if not starts:
        return f'FUNCTION {name}: NOT FOUND\n'
    start, _ = min(starts)
    paren = text.find('(', start)
    depth = 0
    quote = None
    escape = False
    body = -1
    for index in range(paren, len(text)):
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
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                body = text.find('{', index)
                break
    if body < 0:
        return f'FUNCTION {name}: BODY NOT FOUND\n'
    depth = 0
    quote = None
    escape = False
    for index in range(body, len(text)):
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
response = Path('response-ingestion.js').read_text()

for name in [
    'testExecutionPlan', 'executionHandoff', 'evaluateContextIndependence',
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
        print(f'{number}: {line[:2400]}')

print('\n===== INDEPENDENCE / CAPABILITY FIELDS =====')
for source_name, source in [('ENGINE', engine), ('PROMPT', prompt), ('APP', app), ('INGESTION', response)]:
    for number, line in enumerate(source.splitlines(), 1):
        if re.search(r'CAPABIL|CONTEXT_ID|INDEPENDEN|EXECUTION_RECEIPT|PRODUCTION_CONTEXT|REVIEWER_CONTEXT|VERIFIER_CONTEXT', line, re.I):
            print(f'{source_name}:{number}: {line[:2400]}')
