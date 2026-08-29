from pathlib import Path
p=Path('app-core.js'); s=p.read_text()
old='Executor class, execution mode, capability readiness, and blocking diagnostics are shown here for audit.'
new='<strong>Who performs the current tests</strong> is derived here for audit. Executor class, execution mode, capability readiness, and blocking diagnostics remain available without making the operator interpret them. If execution is blocked, the app identifies the exact artifact bytes that are missing or unverified. Remember: browser storage alone does not give an external executor access to those bytes.'
if s.count(old)!=1: raise SystemExit(f'expected one app audit wording match, found {s.count(old)}')
p.write_text(s.replace(old,new,1))
print('app audit wording patched')
