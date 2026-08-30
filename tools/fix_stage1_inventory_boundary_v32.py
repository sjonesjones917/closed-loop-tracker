from pathlib import Path
p=Path('prompt-engine.js'); t=p.read_text()
phrase='Do not enumerate archive entries, internal file counts, directory trees, hashes, workbook rows, or similar internal packet inventories merely to demonstrate inspection. Do not turn supplied project material into a Stage 02 archive/file inventory; extract only the human-authority statements needed for complete job definition and preserve material references.'
if phrase not in t:
    anchor='Limited intake inspection is Stage 01 job-definition work only.'
    if anchor not in t: raise SystemExit('Stage 01 limited-intake anchor missing')
    t=t.replace(anchor,anchor+' '+phrase,1)
p.write_text(t)
print('Stage 01 internal packet inventory regression prohibited')
