from pathlib import Path
p=Path('.repair-v3.py')
s=p.read_text()
s=s.replace('import re\n','import re\nimport json\n',1)
s=s.replace("EXECUTABLE_SPEC.steps[${index}] uses unsupported operation ${String(step.op)}.","Step ${index} uses unsupported operation ${String(step.op||'UNKNOWN')}.")
s=s.replace("rep('workflow-schema.js',\"'SEVERITY','NOTES','STATUS'\",\"'SEVERITY','NOTES','OBLIGATION_INPUT_IDS','STATUS'\",1)","s2=read('workflow-schema.js');aa=s2.index('requirements:recordSchema');bb=s2.index('requirementResolutions:recordSchema',aa);cc=s2[aa:bb];cc=cc.replace(\"'SEVERITY','STATUS','NOTES'\",\"'SEVERITY','STATUS','NOTES','OBLIGATION_INPUT_IDS'\",1);s2=s2[:aa]+cc+s2[bb:];write('workflow-schema.js',s2)")
s=s.replace("TEST_IR.operationSchemas=TEST_IR_OPERATION_SCHEMAS;\n","")
s=s.replace("schema.TEST_IR.operationSchemas||{}","schema.TEST_IR_OPERATION_SCHEMAS||{}")
s=s.replace("split(/\\r?\\n+/)","split(/\\\\r?\\\\n+/)")
s=s.replace(".replace('CUSTOM_PIPELINE','TEST_IR')",".replace('CUSTOM_PIPELINE','TEST_IR').replace('Revise the Responsible Layer','Correct the Root Cause').replace('REVISE THE RESPONSIBLE LAYER','CORRECT THE ROOT CAUSE')")
s += """\n# Preserve the retained historical Stage 01 response exactly from its authoritative fixture.\n_tp=json.loads(read('TEST_PROJECT.json'))\n_op=read('AUTHORIZED_OPERATION_01.txt').strip()\nif _tp.get('generatedOutputs'):\n    _tp['generatedOutputs'][0]['output']=_op\nif _tp.get('stageRecords',{}).get('1') is not None:\n    _tp['stageRecords']['1']['output']=_op\nwrite('TEST_PROJECT.json',json.dumps(_tp,indent=2,ensure_ascii=False))\n# Final workflow-schema public export correction.\n_sc=read('workflow-schema.js')\n_sc=_sc.replace(\"version:'closed-loop-workflow-schema/2'\",\"version:'closed-loop-workflow-schema/3'\",1)\n_sc=_sc.replace(\"CONFLICT_POLICIES,TEST_IR,validateTestIRSpec\",\"CONFLICT_POLICIES,TEST_IR,TEST_IR_OPERATION_SCHEMAS,validateTestIRSpec\",1)\nwrite('workflow-schema.js',_sc)\n"""
p.write_text(s)
print('repair script hardened for current source')
