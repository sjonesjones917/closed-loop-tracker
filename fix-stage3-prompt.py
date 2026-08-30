from pathlib import Path

p=Path('prompt-engine.js')
text=p.read_text()
required='Research only the current accepted Stage 02 independent external source set'
if required not in text:
    anchor="3:'"
    if anchor not in text:
        raise SystemExit('Stage 03 procedure anchor missing')
    text=text.replace(anchor,anchor+required+'. ',1)
p.write_text(text)
