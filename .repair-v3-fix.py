from pathlib import Path
import re
p=Path('.repair-v3.py')
s=p.read_text()
s=s.replace("EXECUTABLE_SPEC.steps[${index}] uses unsupported operation ${String(step.op)}.","Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.")
# Requirements currently order STATUS before NOTES; patch the requirements record locally instead of relying on one exact adjacency.
s=s.replace("rep('workflow-schema.js',\"'SEVERITY','NOTES','STATUS'\",\"'SEVERITY','NOTES','OBLIGATION_INPUT_IDS','STATUS'\",1)","s2=read('workflow-schema.js');aa=s2.index('requirements:recordSchema');bb=s2.index('requirementResolutions:recordSchema',aa);cc=s2[aa:bb];cc=cc.replace(\"'SEVERITY','STATUS','NOTES'\",\"'SEVERITY','STATUS','NOTES','OBLIGATION_INPUT_IDS'\",1);s2=s2[:aa]+cc+s2[bb:];write('workflow-schema.js',s2)")
# TEST_IR is frozen; export operation schemas separately instead of mutating the frozen object.
s=s.replace("TEST_IR.operationSchemas=TEST_IR_OPERATION_SCHEMAS;\n","")
s=s.replace("schema.TEST_IR.operationSchemas||{}","schema.TEST_IR_OPERATION_SCHEMAS||{}")
# Add the operation schema registry to the public schema export and bump schema implementation identity.
anchor="write('workflow-schema.js',s)\n\n# workflow-engine.js"
extra="s=read('workflow-schema.js');s=s.replace(\"version:'closed-loop-workflow-schema/2'\",\"version:'closed-loop-workflow-schema/3'\",1);s=s.replace(\"CONFLICT_POLICIES,TEST_IR,validateTestIRSpec\",\"CONFLICT_POLICIES,TEST_IR,TEST_IR_OPERATION_SCHEMAS,validateTestIRSpec\",1);write('workflow-schema.js',s)\n\n# workflow-engine.js"
if anchor not in s: raise SystemExit('workflow schema export anchor missing')
s=s.replace(anchor,extra,1)
p.write_text(s)
print('repair script hardened for current source')
