from pathlib import Path

patch_path = Path('.semantic-adjudication-patch.py')
s = patch_path.read_text()
start = s.index('def replace_function(')
end = s.index("\np=Path('workflow-engine.js')", start)

replacement = r'''def replace_function(text, name, replacement):
    marker = f"function {name}("
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f'missing function {name}')

    paren = text.find('(', start + len(f"function {name}"))
    if paren < 0:
        raise RuntimeError(f'missing parameters for {name}')
    depth = 0
    quote = None
    escaped = False
    i = paren
    close = None
    while i < len(text):
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
        else:
            if ch in "'\"`":
                quote = ch
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    close = i
                    break
        i += 1
    if close is None:
        raise RuntimeError(f'unclosed parameters for {name}')

    brace = text.find('{', close + 1)
    if brace < 0:
        raise RuntimeError(f'missing body for {name}')

    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    i = brace
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ''
        if line_comment:
            if ch == '\n':
                line_comment = False
        elif block_comment:
            if ch == '*' and nxt == '/':
                block_comment = False
                i += 1
        elif quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
        else:
            if ch == '/' and nxt == '/':
                line_comment = True
                i += 1
            elif ch == '/' and nxt == '*':
                block_comment = True
                i += 1
            elif ch in "'\"`":
                quote = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return text[:start] + replacement + text[i + 1:]
        i += 1
    raise RuntimeError(f'unclosed function {name}')

_probe = "function probe(project,{test=null,result=null}={}){return {ok:true};}\nconst tail=1;"
_probe_expected = "function probe(){return 1;}\nconst tail=1;"
if replace_function(_probe, 'probe', 'function probe(){return 1;}') != _probe_expected:
    raise RuntimeError('replace_function self-test failed')
'''

s = s[:start] + replacement + s[end:]
s = s.replace(
    "if(result&&Number(result.stage)===23||recordValue(result,'OBSERVED_MEANING'))",
    "if(result&&(Number(result.stage)===23||recordValue(result,'OBSERVED_MEANING')))"
)

# The branch may already contain the regression-authority correction from the
# coordinated semantic work. Preserve fail-closed behavior: transform the
# historical form, accept either known corrected form, and reject every other
# source state.
old_block = '''old="return executions.length===1&&['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(executions[0],'RESULT')));"\nif old not in s: raise RuntimeError('regression resolution expression missing')\ns=s.replace(old,"return executions.length===1&&regressionExecutionDetermination(project,executions[0]).determination==='SATISFIED';",1)'''
new_block = '''old="return executions.length===1&&['SATISFIED','SUCCESS','PASSED'].includes(upper(recordValue(executions[0],'RESULT')));"\npatched_a="return executions.length===1&&regressionExecutionDetermination(project,executions[0]).determination==='SATISFIED';"\npatched_b="return executions.length===1&&effectiveRegressionDetermination(project,executions[0]).determination==='SATISFIED';"\nif old in s:\n    s=s.replace(old,patched_a,1)\nelif patched_a in s or patched_b in s:\n    pass\nelse:\n    raise RuntimeError('regression resolution expression is neither historical nor a known application-derived form')'''
if old_block not in s:
    raise RuntimeError('semantic patch regression-rewrite guard not found')
s = s.replace(old_block, new_block, 1)

patch_path.write_text(s)
