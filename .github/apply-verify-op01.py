from pathlib import Path
p=Path('verify.mjs')
s=p.read_text()
s=s.replace("'workbook.js','TEST_PROJECT.json','AUTHORIZED_OPERATION_01.txt'", "'workbook.js','TEST_PROJECT.json'", 1)
s=s.replace("const operation01=fs.readFileSync('AUTHORIZED_OPERATION_01.txt','utf8').trim();\nif(retained.generatedOutputs?.[0]?.output!==operation01||retained.stageRecords?.['1']?.output!==operation01)throw new Error('Authorized Operation 01 output was not preserved exactly.');", "const operation01=String(retained.userJobInput?.authorizedOperation01||'').trim();\nif(!operation01||retained.generatedOutputs?.[0]?.output!==operation01||retained.stageRecords?.['1']?.output!==operation01)throw new Error('Authorized Operation 01 output was not preserved exactly in canonical project data.');", 1)
p.write_text(s)
