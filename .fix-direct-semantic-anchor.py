from pathlib import Path
p=Path('.direct-semantic-gate-fix.py')
s=p.read_text()
s=s.replace("23:'Verify the actual finished product","23:'Perform independent meaning/content verification")
s=s.replace("Verify the actual finished product","Perform independent meaning/content verification")
s=s.replace("24:'Attack the actual finished product","24:'Perform adversarial verification on the finished product")
s=s.replace("Attack the actual finished product","Perform adversarial verification on the finished product")
old="s=s[:start]+\"\\n\"+s[end:]"
new="start=s.find(\"\\nconst applicationadjudicationGate=gate;\")\nend=s.find(\"\\nfunction deriveStageData\",start)\nif start<0 or end<0: raise SystemExit('runtime gate wrapper block disappeared before removal')\ns=s[:start]+\"\\n\"+s[end:]"
if old not in s: raise SystemExit('stale wrapper-removal statement not found')
s=s.replace(old,new,1)
p.write_text(s)
