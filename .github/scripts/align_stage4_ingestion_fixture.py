from pathlib import Path

path=Path('verify-ingestion.mjs')
data=path.read_text()
old="""  if(stage===1)records.intentStatements=[{tempKey:'intent-statement-1',fields:{SOURCE_MATERIAL:'authorized human job input',SOURCE_LOCATION:'verbatim request',EXACT_STATEMENT:'Verify the closed-loop response ingestion path.',STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}];
  if(!Object.keys(stageData).length&&stage!==1){
"""
new="""  if(stage===1){
    const units=promptRecord.contextManifest?.intakeCoverageManifest?.units||[];
    records.intentStatements=units.map((unit,index)=>({tempKey:`intent-statement-${index+1}`,fields:{SOURCE_MATERIAL:unit.unitId,SOURCE_LOCATION:unit.sourceLocation,EXACT_STATEMENT:unit.rawValue,STATEMENT_KIND:'REQUIREMENT',REQUIREMENT_RELEVANCE:'REQUIREMENT',NORMATIVE_FORCE:'MUST',DEPENDENCIES:'NONE',EXCEPTIONS:'NONE',CONFLICTS:'NONE',NOTES:'Controlled Stage 01 fixture'},relationships:{},evidenceRefs:['evidence-1']}));
  }
  if(stage===4){
    const entries=promptRecord.contextManifest?.obligationManifest?.entries||[],target=entries[0];
    records.obligationDispositions=entries.map((entry,index)=>({tempKey:`obligation-disposition-${index+1}`,fields:{OBLIGATION_ID:entry.obligationId,DISPOSITION:index===0?'REQUIREMENT':'RETAINED_CONTEXT',REASON:index===0?'Compiled into the controlled atomic requirement.':'Retained as nonnormative controlled context.'},relationships:{},evidenceRefs:['evidence-1']}));
    if(target){
      const def=schema.RECORD_SCHEMAS.requirements,fields={};
      for(const name of def.required)if(def.fieldDefinitions[name]?.producer===schema.PRODUCER.AGENT)fields[name]=name==='OBLIGATION_IDS'?[target.obligationId]:valueForDefinition(def.fieldDefinitions[name]);
      records.requirements=[{tempKey:'requirement-1',fields,relationships:{},evidenceRefs:['evidence-1']}];
    }
  }
  if(!Object.keys(stageData).length&&stage!==1&&stage!==4){
"""
if old not in data:
    raise SystemExit('expected Stage 01 ingestion fixture was not found')
path.write_text(data.replace(old,new,1))
Path(__file__).unlink(missing_ok=True)
