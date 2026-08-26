from pathlib import Path
p=Path('verify-complete.mjs')
s=p.read_text()
old="const p=project('JOB-STAGE24-EXACT');p.job.CURRENT_PRODUCT_ID='PRODUCT-24';p.stages[24].agentData.ATTACKS_EXECUTED=['CATEGORY-A','CATEGORY-B'];"
new="const p=project('JOB-STAGE24-EXACT');p.job.CURRENT_PRODUCT_ID='PRODUCT-24';p.stages[23].status='COMPLETE';p.stages[24].agentData.ATTACKS_EXECUTED=['CATEGORY-A','CATEGORY-B'];"
if old not in s:
    raise SystemExit('Stage 24 focused-proof fixture anchor missing')
p.write_text(s.replace(old,new,1))
