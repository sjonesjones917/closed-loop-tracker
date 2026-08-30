from pathlib import Path
import subprocess,re,hashlib
before=subprocess.check_output(['git','show','HEAD:index.html'],text=True)
after=Path('index.html').read_text()
def style(text):
    m=re.search(r'<style>(.*?)</style>',text,re.S)
    if not m: raise SystemExit('Style block missing.')
    return m.group(1)
a=style(before);b=style(after)
if a!=b: raise SystemExit('Visual CSS changed during reconciliation; visual changes are prohibited in this repair.')
print('visual-css-sha256='+hashlib.sha256(b.encode()).hexdigest())
