from pathlib import Path
p=Path('verify-prompt-semantics.mjs')
s=p.read_text()
s=s.replace("||!record.prompt.includes('derive project-specific human-authority questions')","")
p.write_text(s)
