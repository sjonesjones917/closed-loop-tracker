from pathlib import Path
p=Path('verify-prompt-semantics.mjs'); t=p.read_text()
old="original.prompt.replace('Use HUMAN_INPUT_REQUIRED only when a required human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable','Use HUMAN_INPUT_REQUIRED before conversational clarification')"
new="original.prompt.replaceAll('Use HUMAN_INPUT_REQUIRED only when a required human answer remains unavailable or explicitly deferred after that conversation, or when interactive conversation is unavailable','Use HUMAN_INPUT_REQUIRED before conversational clarification')"
if old not in t: raise SystemExit('fallback mutation anchor missing')
t=t.replace(old,new,1)
p.write_text(t)
print('fallback mutation now removes every duplicated invariant occurrence')
