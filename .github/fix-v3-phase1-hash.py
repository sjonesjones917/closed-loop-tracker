from pathlib import Path

# Application-derived Test IR metadata is assigned when the proposal becomes a
# canonical record. Recalculation must not mutate immutable accepted records.
p=Path('workflow-engine.js')
s=p.read_text(encoding='utf-8')
s=s.replace("function recalculate(project){\n  ensureShape(project);\n  normalizeCurrentTestIR(project);","function recalculate(project){\n  ensureShape(project);",1)
p.write_text(s,encoding='utf-8')

p=Path('response-ingestion.js')
s=p.read_text(encoding='utf-8')
old="      const fields={...workflow.applicationInitialFields(collection),...clone(proposed.fields||{})};\n      fields[definition.idField]=id;"
new="      const fields={...workflow.applicationInitialFields(collection),...clone(proposed.fields||{})};\n      if(collection==='tests'&&String(fields.EXECUTABLE_KIND||'').toUpperCase()==='TEST_IR'){fields.EXECUTABLE_SPEC_VERSION=schema.TEST_IR.version;fields.EXECUTABLE_SPEC_SHA256=hash.sha256Value(fields.EXECUTABLE_SPEC);}\n      fields[definition.idField]=id;"
if old not in s: raise SystemExit('canonical record construction boundary not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# The acceptance manifest must record the two application derivations explicitly.
# Add them alongside the existing application-initial-field derivations.
p=Path('response-ingestion.js')
s=p.read_text(encoding='utf-8')
needle="for(const [name,value] of Object.entries(workflow.applicationInitialFields(collection)))if(!Object.prototype.hasOwnProperty.call(proposed?.fields||{},name))changes.push({origin:'APPLICATION_DERIVATION',jsonPointer:null,rawValueHash:null,normalizerUsed:null,canonicalCollection:collection,canonicalRecordType:collection,canonicalRecordId:record.id,canonicalField:name,relationshipTargetId:null,evidenceIds:record.evidenceRefs||[],normalizedValue:clone(value),temporaryResponseKey:record.temporaryKey,derivationKey:`${collection}.initial.${name}`});"
replacement=needle+"if(collection==='tests'&&String(record.fields?.EXECUTABLE_KIND||'').toUpperCase()==='TEST_IR'){for(const name of ['EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC_SHA256'])changes.push({origin:'APPLICATION_DERIVATION',jsonPointer:null,rawValueHash:null,normalizerUsed:null,canonicalCollection:collection,canonicalRecordType:collection,canonicalRecordId:record.id,canonicalField:name,relationshipTargetId:null,evidenceIds:record.evidenceRefs||[],normalizedValue:clone(record.fields[name]),temporaryResponseKey:record.temporaryKey,derivationKey:`tests.${name}`});}"
if needle not in s: raise SystemExit('proposal derivation manifest boundary not found')
s=s.replace(needle,replacement,1)
p.write_text(s,encoding='utf-8')
