from pathlib import Path
p=Path('.direct-semantic-gate-fix.py')
s=p.read_text()
s=s.replace("23:'Verify the actual finished product","23:'Perform independent meaning/content verification")
s=s.replace("Verify the actual finished product","Perform independent meaning/content verification")
s=s.replace("24:'Attack the actual finished product","24:'Perform adversarial verification on the finished product")
s=s.replace("Attack the actual finished product","Perform adversarial verification on the finished product")
p.write_text(s)
