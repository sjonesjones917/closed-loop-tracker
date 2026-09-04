from pathlib import Path
p=Path('controller-stage21-apply.py')
s=p.read_text()
old="CONVERGED:metrics.converged},{stage:18,source:'APPLICATION_DERIVATION',scope}"
new="CONVERGED:metrics.converged?'TRUE':'FALSE'},{stage:18,source:'APPLICATION_DERIVATION',scope}"
if old not in s:
    raise SystemExit('Stage 21 convergence CONVERGED patch marker missing')
s=s.replace(old,new,1)
s += r'''

dod_path=Path('verify-definition-of-done-invariants.mjs')
dod=dod_path.read_text()
old_matrix="['matrix-coverage',engineSource.includes('verificationCoverage:matrix.coverage')]"
new_matrix="['matrix-coverage',engineSource.includes(\"verificationMetric=closedMetricFromUniverse(project,{metricId:'stage18.verificationCoverage'\")&&engineSource.includes('verificationCoverage:verificationMetric.value')]"
if old_matrix not in dod:
    raise SystemExit('Definition-of-done verification-matrix proof marker missing')
dod_path.write_text(dod.replace(old_matrix,new_matrix,1))

workflow_path=Path('.github/workflows/pages.yml')
workflow=workflow_path.read_text()
if 'node verify-convergence.mjs' not in workflow:
    marker='node verify-corrected-iteration.mjs'
    if marker not in workflow:
        raise SystemExit('Pages workflow corrected-iteration marker missing')
    workflow=workflow.replace(marker,marker+'\n          node verify-convergence.mjs',1)
    workflow_path.write_text(workflow)
'''
p.write_text(s)
