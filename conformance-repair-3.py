from pathlib import Path
p=Path('verify-ingestion.mjs')
s=p.read_text()
old="    const collection=writableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||writableCollections.find(name=>schema.recordAgentFields(name).length);"
new="    const createableCollections=writableCollections.filter(name=>schema.RECORD_SCHEMAS[name]?.commitPolicy!==schema.COLLECTION_POLICIES.UPDATE_RESERVED);\n    const collection=createableCollections.find(name=>name!=='blockers'&&schema.recordAgentFields(name).length)||createableCollections.find(name=>schema.recordAgentFields(name).length);"
if new not in s:
    if old not in s: raise SystemExit('ingestion fixture collection-selection anchor missing')
    s=s.replace(old,new,1)
p.write_text(s)
