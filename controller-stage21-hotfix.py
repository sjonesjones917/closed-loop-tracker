from pathlib import Path
p=Path('controller-stage21-apply.py')
s=p.read_text()
old="CONVERGED:metrics.converged},{stage:18,source:'APPLICATION_DERIVATION',scope}"
new="CONVERGED:metrics.converged?'TRUE':'FALSE'},{stage:18,source:'APPLICATION_DERIVATION',scope}"
if old not in s:
    raise SystemExit('Stage 21 convergence CONVERGED patch marker missing')
p.write_text(s.replace(old,new,1))
