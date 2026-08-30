from pathlib import Path

p = Path('app-core.js')
t = p.read_text()
old = "Stage 01 is an intake conversation. Save any facts you already know here, then send the generated instruction to ChatGPT. Use the generated instruction in normal chat; it contains the external agent's behavior rules. Continue the conversation until the remaining human-only questions are resolved or explicitly deferred. Stay in ChatGPT until you receive the final JSON. HUMAN_INPUT_REQUIRED in this app is only a fallback when a required answer remains unavailable or deferred, or interactive conversation was unavailable."
new = "Stage 01 is an intake conversation. Save any facts you already know here, then send the generated instruction to ChatGPT. Resolve the remaining human-only questions in normal chat using that generated instruction. Continue until those questions are answered or explicitly deferred, then return only the final JSON to this application. HUMAN_INPUT_REQUIRED in this app is only a fallback when a required answer remains unavailable or deferred, or interactive conversation was unavailable."
if old not in t:
    raise SystemExit('Expected Stage 01 operator guidance not found after prior repair patches')
t = t.replace(old, new, 1)
p.write_text(t)
