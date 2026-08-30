from pathlib import Path
p=Path('.repair-v3.py')
s=p.read_text()
s=s.replace("EXECUTABLE_SPEC.steps[${index}] uses unsupported operation ${String(step.op)}.","Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.")
s=s.replace("rep('workflow-schema.js',\"'SEVERITY','NOTES','STATUS'\",\"'SEVERITY','NOTES','OBLIGATION_INPUT_IDS','STATUS'\",1)","s2=read('workflow-schema.js');aa=s2.index('requirements:recordSchema');bb=s2.index('requirementResolutions:recordSchema',aa);cc=s2[aa:bb];cc=cc.replace(\"'SEVERITY','STATUS','NOTES'\",\"'SEVERITY','STATUS','NOTES','OBLIGATION_INPUT_IDS'\",1);s2=s2[:aa]+cc+s2[bb:];write('workflow-schema.js',s2)")
s=s.replace("TEST_IR.operationSchemas=TEST_IR_OPERATION_SCHEMAS;\n","")
s=s.replace("schema.TEST_IR.operationSchemas||{}","schema.TEST_IR_OPERATION_SCHEMAS||{}")
# Normal Python triple-quoted patch strings must emit JS regex backslashes, not control characters.
s=s.replace("split(/\\r?\\n+/)","split(/\\\\r?\\\\n+/)")
# Append export correction after the main patch has materialized workflow-schema.js.
s += """\n# Final workflow-schema public export correction.\n_sc=read('workflow-schema.js')\n_sc=_sc.replace(\"version:'closed-loop-workflow-schema/2'\",\"version:'closed-loop-workflow-schema/3'\",1)\n_sc=_sc.replace(\"CONFLICT_POLICIES,TEST_IR,validateTestIRSpec\",\"CONFLICT_POLICIES,TEST_IR,TEST_IR_OPERATION_SCHEMAS,validateTestIRSpec\",1)\nwrite('workflow-schema.js',_sc)\n"""
p.write_text(s)
print('repair script hardened for current source')
