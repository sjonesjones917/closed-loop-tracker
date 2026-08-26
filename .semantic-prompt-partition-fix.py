from pathlib import Path
p=Path('workbook.js')
s=p.read_text()
old='      "POST_CORRECTION_SUCCESSES_PROVEN",\n'
if s.count(old)!=1:
    raise SystemExit(f'Expected exactly one Stage 15 ownership entry, found {s.count(old)}')
p.write_text(s.replace(old,'',1))
