from pathlib import Path

p=Path('project-store.js')
s=p.read_text()
old="""    idsByCollection.set(collection,seen);\n  }\n  for(const [collection,definition] of Object.entries(schemaApi.RECORD_SCHEMAS))for(const record of Array.isArray(project.projectData?.[collection])?project.projectData[collection]:[])for(const [fieldName,targetCollection] of Object.entries(definition.relationships||{})){"""
new="""    idsByCollection.set(collection,seen);\n  }\n  const ingestion=globalThis.closedLoopResponseIngestion;\n  if(!ingestion?.validateValue)issues.push('Response-ingestion value validator is required for canonical project integrity validation.');\n  else for(const [collection,definition] of Object.entries(schemaApi.RECORD_SCHEMAS))for(const record of Array.isArray(project.projectData?.[collection])?project.projectData[collection]:[]){const id=engine.recordId(record,collection)||'UNKNOWN',nested=record?.fields&&typeof record.fields==='object'&&!Array.isArray(record.fields)?record.fields:null;for(const [fieldName,fieldDefinition] of Object.entries(definition.fieldDefinitions||{})){const nestedPresent=Boolean(nested&&Object.prototype.hasOwnProperty.call(nested,fieldName)),topPresent=Object.prototype.hasOwnProperty.call(record||{},fieldName);if(!nestedPresent&&!topPresent)continue;if(nestedPresent&&topPresent&&!equivalent(nested[fieldName],record[fieldName]))issues.push(`${collection} record ${id} has contradictory mirrored value for ${fieldName}.`);const value=engine.recordValue(record,fieldName),fieldIssues=[];ingestion.validateValue(fieldDefinition,value,`/${collection}/${id}/${fieldName}`,fieldIssues);for(const item of fieldIssues)issues.push(`${collection} record ${id} field ${fieldName}: ${item.message}`);}}\n  for(const [collection,definition] of Object.entries(schemaApi.RECORD_SCHEMAS))for(const record of Array.isArray(project.projectData?.[collection])?project.projectData[collection]:[])for(const [fieldName,targetCollection] of Object.entries(definition.relationships||{})){"""
if s.count(old)!=1: raise SystemExit(f'project-store target count={s.count(old)}')
p.write_text(s.replace(old,new,1))

p=Path('verify.mjs')
s=p.read_text()
marker='// IMPORT_FIELD_CONTRACT_INTEGRITY'
if marker not in s:
    s += r'''

// IMPORT_FIELD_CONTRACT_INTEGRITY
{
 const p=core.createBlankState('JOB-IMPORT-FIELD-CONTRACT');engine.ensureShape(p);engine.recalculate(p);
 const id='REQ-IMPORT-TYPE-BAD',fields={REQ_ID:id,OBLIGATION:123};p.projectData.requirements.push({id,stage:4,active:true,scope:{requirementsVersion:'REQUIREMENTS-v001'},fields,...fields});
 const badType=store.validateProjectIntegrity(p,{verifyDerived:false});
 if(badType.valid||!badType.issues.some(x=>x.includes('OBLIGATION')&&x.includes('Expected STRING')))throw new Error('Canonical import integrity accepted a wrong-typed record field.');
 p.projectData.requirements=[];const mirrored={REQ_ID:'REQ-IMPORT-MIRROR',OBLIGATION:'nested canonical'};p.projectData.requirements.push({id:'REQ-IMPORT-MIRROR',stage:4,active:true,scope:{requirementsVersion:'REQUIREMENTS-v001'},fields:mirrored,REQ_ID:'REQ-IMPORT-MIRROR',OBLIGATION:'contradictory top-level'});
 const badMirror=store.validateProjectIntegrity(p,{verifyDerived:false});
 if(badMirror.valid||!badMirror.issues.some(x=>x.includes('contradictory mirrored value for OBLIGATION')))throw new Error('Canonical import integrity accepted contradictory mirrored record values.');
}
'''
p.write_text(s)
