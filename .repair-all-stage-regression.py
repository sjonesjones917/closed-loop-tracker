from pathlib import Path
p=Path('verify-all-stage-prompts.mjs')
s=p.read_text()
s=s.replace('PERSISTED HUMAN ANSWERS — OPERATIVE CANONICAL USER INPUT','PERSISTED HUMAN ANSWERS — ALREADY SUPPLIED; DO NOT ASK AGAIN')
start=s.index('const stageTokens={')
end=s.index('};\nlet promptCount=0;',start)+2
replacement="""const stageTokens={
  1:['ONE-TIME INTENT FILE INTAKE','INTAKE_ACCOUNTING'],
  3:['RESEARCH COVERAGE MANIFEST','RESEARCH_ACCOUNTING'],
  4:['STAGE 04 OBLIGATION MANIFEST','OBLIGATION_ACCOUNTING'],
  6:['TEST IR']
};"""
s=s[:start]+replacement+s[end:]
p.write_text(s)
