from pathlib import Path

path=Path('verify-one-time-intent-intake.mjs')
text=path.read_text()
old="assert(stage3Prompt.prompt.includes('never ask the user to repeat available project facts'),'Stage 03 permits repeated project-data entry.');"
new="assert(stage3Prompt.prompt.includes('Never ask the human to repeat available project facts'),'Stage 03 permits repeated project-data entry.');"
if old not in text:
    raise AssertionError('The stale Stage 03 no-repeat assertion was not found.')
path.write_text(text.replace(old,new,1))
print('Aligned Stage 03 no-repeat regression with the controlling prompt language.')
