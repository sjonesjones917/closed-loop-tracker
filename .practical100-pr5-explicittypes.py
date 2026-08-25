from pathlib import Path
import subprocess, json, re

# Evaluate the already verified schema once during integration, then check the resolved metadata into the runtime source.
node=r'''
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
globalThis.crypto=crypto.webcrypto;globalThis.Event=class Event{constructor(type){this.type=type;}};globalThis.dispatchEvent=()=>true;globalThis.addEventListener=()=>{};
for(const file of ['workbook.js','hash.js','workflow-schema.js'])vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const s=globalThis.closedLoopWorkflowSchema;
const clean=d=>({valueType:d.valueType,enumValues:Array.isArray(d.enumValues)?d.enumValues:[],nullable:Boolean(d.nullable),normalizerKey:d.normalizerKey??d.normalizer??null,closedProperties:d.closedProperties??null});
const stage=Object.fromEntries(Object.entries(s.STAGE_FIELDS).map(([n,defs])=>[n,Object.fromEntries(Object.entries(defs).map(([k,d])=>[k,clean(d)]))]));
const record=Object.fromEntries(Object.entries(s.RECORD_SCHEMAS).map(([c,def])=>[def.prefix,Object.fromEntries(Object.entries(def.fieldDefinitions).map(([k,d])=>[k,clean(d)]))]));
process.stdout.write(JSON.stringify({stage,record}));
'''
run=subprocess.run(['node','-e',node],check=True,capture_output=True,text=True)
ledger=json.loads(run.stdout)
stage_json=json.dumps(ledger['stage'],separators=(',',':'),sort_keys=True)
record_json=json.dumps(ledger['record'],separators=(',',':'),sort_keys=True)

p=Path('workflow-schema.js');s=p.read_text()
# Remove the prior name-pattern type inference function.
s=re.sub(r"function explicitValueType\(name,producer,isRelationship=false\)\{.*?\}\n","",s,count=1,flags=re.S)
marker='function ownerFromPartition(partition,name,label){'
assert marker in s
constants=f"const EXPLICIT_STAGE_FIELD_TYPES=Object.freeze({stage_json});\nconst EXPLICIT_RECORD_FIELD_TYPES=Object.freeze({record_json});\n"
s=s.replace(marker,constants+marker,1)
# Remove obsolete producer/type regex fallback declarations; ownership is now only the explicit partitions.
s=re.sub(r"const HUMAN_STAGE_FIELDS=Object\.freeze\(\{.*?const APPLICATION_STAGE_SUMMARY_PATTERN=.*?;\n\n","",s,count=1,flags=re.S)
# Use the exact stage ledger.
match=re.search(r"function stageFieldDefinition\(stage,name\)\{.*?\n\}",s,re.S)
assert match
stage_fn=r'''function stageFieldDefinition(stage,name){
  const producer=stageFieldProducer(stage,name),type=EXPLICIT_STAGE_FIELD_TYPES[String(stage)]?.[name];if(!type)throw new Error(`Stage ${stage} field ${name} has no explicit type metadata.`);
  return field(name,producer,{requiredAtStage:stage,valueType:type.valueType,enumValues:type.enumValues,nullable:type.nullable,normalizerKey:type.normalizerKey,closedProperties:type.closedProperties,derivationKey:producer===PRODUCER.APPLICATION?`stage${String(stage).padStart(2,'0')}.${name}`:null,responsePath:producer===PRODUCER.AGENT?`/stageData/${name}`:null,help:producer===PRODUCER.APPLICATION?'Read-only; recalculated by the application.':''});
}'''
s=s[:match.start()]+stage_fn+s[match.end():]
# Use the exact record ledger.
old="const producer=ownerFromPartition(ownership,name,title);\n    definitions[name]=field(name,producer,{requiredAtStage:stage,responsePath:producer===PRODUCER.AGENT?`/records/{collection}/*/fields/${name}`:null,valueType:explicitValueType(name,producer,relSet.has(name)),derivationKey:producer===PRODUCER.APPLICATION?`record.${prefix}.${name}`:null,provenanceRequired:producer===PRODUCER.AGENT?provenanceRequired:false});"
new="const producer=ownerFromPartition(ownership,name,title),type=EXPLICIT_RECORD_FIELD_TYPES[prefix]?.[name];if(!type)throw new Error(`${title} field ${name} has no explicit type metadata.`);\n    definitions[name]=field(name,producer,{requiredAtStage:stage,responsePath:producer===PRODUCER.AGENT?`/records/{collection}/*/fields/${name}`:null,valueType:type.valueType,enumValues:type.enumValues,nullable:type.nullable,normalizerKey:type.normalizerKey,closedProperties:type.closedProperties,derivationKey:producer===PRODUCER.APPLICATION?`record.${prefix}.${name}`:null,provenanceRequired:producer===PRODUCER.AGENT?provenanceRequired:false});"
assert old in s
s=s.replace(old,new,1)
p.write_text(s)
