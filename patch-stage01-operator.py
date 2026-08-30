from pathlib import Path

p = Path('app-core.js')
t = p.read_text()
old = "Stage 01 is an intake conversation. Save any facts you already know here, then send the generated instruction and only the files listed for that instruction. Continue the same external conversation until you receive the final JSON. HUMAN_INPUT_REQUIRED in this app is only a fallback when a required answer remains unavailable or deferred, or interactive conversation was unavailable."
new = "Stage 01 is an intake conversation. Save any facts you already know here, then send the generated instruction and only the files listed for that instruction. Resolve the remaining human-only questions in normal chat using that generated instruction. Continue until those questions are answered or explicitly deferred, then return only the final JSON to this application. HUMAN_INPUT_REQUIRED in this app is only a fallback when a required answer remains unavailable or deferred, or interactive conversation was unavailable."
if old in t:
    t = t.replace(old, new, 1)
# If finalize-zero-loss.py already emitted another equivalent corrected wording,
# leave it alone. This patch must never block the complete repair pipeline.
p.write_text(t)
