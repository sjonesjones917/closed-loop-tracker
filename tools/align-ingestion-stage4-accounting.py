from pathlib import Path

p=Path('verify-ingestion.mjs')
s=p.read_text()
anchor="""  return {
    schema:schema.RESPONSE_SCHEMA,
"""
if anchor not in s: raise SystemExit('validEnvelope return anchor missing')
insert="""  if(stage===4){
    const manifest=engine.obligationManifest(p);
    const def=schema.RECORD_SCHEMAS.requirements;
    records.requirements=manifest.items.map((obligation,index)=>{
      const fields={};
      for(const name of def.required){if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=safeValue(name);}
      fields.OBLIGATION=String(obligation.text||obligation.obligationId);
      fields.USER_INPUT_RELATIONSHIP=obligation.obligationId;
      return {tempKey:`tmp-requirements-${index+1}`,fields,relationships:{},evidenceRefs:['evidence-1']};
    });
  }
"""
s=s.replace(anchor,insert+anchor,1)
p.write_text(s)
