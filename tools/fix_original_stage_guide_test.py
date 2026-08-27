from pathlib import Path
p=Path('verify-browser.mjs')
s=p.read_text()
s=s.replace("'How to use this stage','Paste only the final JSON here'","'How to use this stage','Paste only that final JSON into the response box'")
p.write_text(s)
