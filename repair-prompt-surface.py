from pathlib import Path
p=Path('index.html')
s=p.read_text()
old='.expandable-prompt{height:280px;max-height:280px}.expandable-prompt.expanded{height:auto;max-height:none}'
new='.expandable-prompt{max-height:80vh}.expandable-prompt.expanded{max-height:none}'
assert old in s, 'forced 280px prompt override not found'
p.write_text(s.replace(old,new,1))
