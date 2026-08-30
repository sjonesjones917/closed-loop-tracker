from pathlib import Path

p=Path('verify-ingestion.mjs')
s=p.read_text()
anchor="""  for(const collection of allowedCollections){
    const spec=schema.RECORD_SCHEMAS[collection];
    const fields={};
    for(const field of spec.agentFields)fields[field]=recordValue(collection,field);
    const relationships={};
    const item={tempKey:`tmp-${collection}`,fields,relationships,evidenceRefs:[]};
    records[collection]=[item];
  }
"""
if anchor not in s: raise SystemExit('validEnvelope record loop anchor missing')
replacement=anchor+"""  if(stage===4&&Array.isArray(records.requirements)&&records.requirements.length){
    const manifest=engine.obligationManifest(p);
    const template=records.requirements[0];
    records.requirements=manifest.items.map((obligation,index)=>({
      ...template,
      tempKey:`tmp-requirements-${index+1}`,
      fields:{...template.fields,OBLIGATION:String(obligation.text||obligation.obligationId),USER_INPUT_RELATIONSHIP:obligation.obligationId}
    }));
  }
"""
s=s.replace(anchor,replacement,1)
p.write_text(s)
