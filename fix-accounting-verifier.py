from pathlib import Path

p = Path('verify-intake-obligation-accounting.mjs')
text = p.read_text()

old = "const prompt1=prompts.buildPromptRecord(1,p),envelope=(capture)=>"
new = "const prompt1={...prompts.buildPromptRecord(1,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(prompt1);const envelope=(capture)=>"
if old not in text:
    raise SystemExit('Stage 01 prompt fixture anchor missing')
text = text.replace(old, new, 1)

old = "const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4=prompts.buildPromptRecord(4,p);"
new = "const obligations=engine.obligationManifest(p);assert(obligations.obligationCount>=4,'Stage 04 did not build the complete obligation universe.');const prompt4={...prompts.buildPromptRecord(4,p),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(prompt4);"
if old not in text:
    raise SystemExit('Stage 04 prompt fixture anchor missing')
text = text.replace(old, new, 1)

p.write_text(text)
