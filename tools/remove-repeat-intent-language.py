from pathlib import Path
p=Path('prompt-engine.js')
s=p.read_text()
replacements={
    'Do not rediscover an unspecified input universe and do not ask the human to attach the original intent file again.':'Do not rediscover an unspecified input universe. Use retained canonical project input and never request previously supplied project input again.',
    'do not ask the human to attach the original intent file again.':'use retained canonical project input and never request previously supplied project input again.',
    'Do not ask the human to attach the original intent file again.':'Use retained canonical project input and never request previously supplied project input again.'
}
for old,new in replacements.items():
    s=s.replace(old,new)
for forbidden in ['attach the original intent','reattach the original intent','resend the original intent']:
    if forbidden.lower() in s.lower():
        raise SystemExit(f'Forbidden repeated-intent attachment language remains: {forbidden}')
p.write_text(s)
