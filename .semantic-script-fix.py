from pathlib import Path
p=Path('.semantic-minimal-closure.py')
s=p.read_text()
old="replace('workbook.js', \"'POST_CORRECTION_SUCCESSES_PROVEN',\", \"\", 2)"
new="replace('workbook.js', \"'POST_CORRECTION_SUCCESSES_PROVEN',\", \"\")\nreplace('workbook.js', '      \\\"POST_CORRECTION_SUCCESSES_PROVEN\\\",\\n', '')"
if old not in s:
    raise SystemExit('Stage 15 patch line not found')
p.write_text(s.replace(old,new,1))
