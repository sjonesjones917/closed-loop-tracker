from pathlib import Path

def rep(text,old,new,label):
    if old not in text: raise SystemExit(f'missing patch anchor: {label}')
    return text.replace(old,new,1)

p=Path('workflow-schema.js');s=p.read_text()
s=rep(s,"'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'","'TEST_ID','REQ_ID','TEST_TYPE','EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS','EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC_SHA256','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'",'tests record includes canonical executable hash')
s=rep(s,"EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC:Object.freeze", "EXECUTABLE_SPEC_VERSION:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC_SHA256:Object.freeze({valueType:VALUE_TYPES.STRING,enumValues:[],nullable:true,normalizerKey:null,closedProperties:null}),\n    EXECUTABLE_SPEC:Object.freeze",'Test IR hash field type')
p.write_text(s)

p=Path('response-ingestion.js');s=p.read_text()
anchor="""      const fields={...workflow.applicationInitialFields(collection),...clone(proposed.fields||{})};
      fields[definition.idField]=id;"""
replacement="""      const fields={...workflow.applicationInitialFields(collection),...clone(proposed.fields||{})};
      fields[definition.idField]=id;
      if(collection==='tests'&&String(fields.EXECUTABLE_KIND||'').toUpperCase()==='TEST_IR'){
        fields.EXECUTABLE_SPEC_VERSION=schema.TEST_IR.version;
        fields.EXECUTABLE_SPEC_SHA256=hash.sha256Value(fields.EXECUTABLE_SPEC);
      }"""
s=rep(s,anchor,replacement,'application derives Test IR version and hash')
p.write_text(s)

p=Path('verify-test-runtime.mjs');s=p.read_text()
anchor="assert.equal(runtime.supports(test),true);"
replacement="assert.equal(runtime.supports(test),true);assert.equal(applyKindForTest?.never,undefined);" if False else anchor
# Static guard that canonical proposal construction derives app-owned identity.
s=s.replace("console.log(JSON.stringify({genericTestIr:true,stage04CanonicalInputBoundary:true},null,2));", "const ingestionSource=fs.readFileSync('response-ingestion.js','utf8');assert.ok(ingestionSource.includes('fields.EXECUTABLE_SPEC_VERSION=schema.TEST_IR.version'),'application must derive Test IR version');assert.ok(ingestionSource.includes('fields.EXECUTABLE_SPEC_SHA256=hash.sha256Value(fields.EXECUTABLE_SPEC)'),'application must derive Test IR hash');\nconsole.log(JSON.stringify({genericTestIr:true,stage04CanonicalInputBoundary:true},null,2));",1)
p.write_text(s)
