from pathlib import Path
p=Path('workflow-schema.js');s=p.read_text()
a="  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null})}),\n  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:"
b="  '1':Object.freeze({DESIRED_SOURCE_COUNT:Object.freeze({valueType:'INTEGER',enumValues:Object.freeze([]),nullable:true,normalizerKey:null,closedProperties:null}),INTAKE_ACCOUNTING:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:"
if a not in s: raise SystemExit('stage type override anchor missing')
s=s.replace(a,b,1)
a="  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})})\n});"
b="  '2':Object.freeze({SOURCE_APPLICABILITY_DETERMINATION:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['APPLICABLE_SOURCES_ESTABLISHED','NO_APPLICABLE_EXTERNAL_SOURCE','UNDETERMINED']),nullable:false,normalizerKey:null,closedProperties:null})}),\n  '4':Object.freeze({OBLIGATION_ACCOUNTING:Object.freeze({valueType:'STRING',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})})\n});"
if a not in s: raise SystemExit('stage4 override anchor missing')
s=s.replace(a,b,1);p.write_text(s)
