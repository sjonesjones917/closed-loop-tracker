from pathlib import Path

index = Path('index.html')
text = index.read_text()
old = 'runtime-ab455a96964da1d4'
new = 'runtime-6f87684799cfb12d'
count = text.count(old)
if count == 0:
    raise SystemExit('Old runtime token not found; refusing to guess.')
index.write_text(text.replace(old, new))
print(f'replaced {count} runtime cache-token occurrence(s)')
