from pathlib import Path
p=Path('.semantic-closure.py')
s=p.read_text()
old="if(typeof core.buildStagePrompt==='function')throw new Error('workbook.js still exposes a competing legacy prompt generator.');"
new="if(fs.readFileSync('workbook.js','utf8').includes('function buildStagePrompt('))throw new Error('workbook.js still contains a competing legacy prompt generator.');"
if old not in s:
    raise SystemExit('target assertion not found')
p.write_text(s.replace(old,new,1))
