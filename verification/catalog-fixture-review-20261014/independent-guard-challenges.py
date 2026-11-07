from pathlib import Path
import subprocess,json
p=Path('verification-evidence.mjs');original=p.read_text();rows=[]
mutants=[('atomic-scope-guard-bypass',"if(!scope||scope.sha256!==atomicObligationSha256(scope)||binding.atomicObligationSha256!==scope.sha256||coverage.atomicObligationSha256!==scope.sha256||binding.normativeRequirementId!==requirement.normativeRequirementId)reject('ATOMIC_PROOF_SCOPE_BINDING_MISMATCH');",'', 'verifyNativeResultAuthorityCatalogConsumers'),('atomic-statement-context-guard-bypass',"if(!isDeepStrictEqual(coverage.contextSourceLocations,scope?.contextSourceLocations)||!isDeepStrictEqual(coverage.sourceSpans,scope?.sourceSpans)||coverage.reviewedAtomicStatement!==scope?.statement)reject('ATOMIC_PROOF_PROPOSITION_OR_CONTEXT_MISMATCH');",'', 'verifyStage01RoleCatalogConsumers')]
try:
 for name,before,after,fn in mutants:
  assert original.count(before)==1;p.write_text(original.replace(before,after));r=subprocess.run(['node','--input-type=module','-e',f"import {{{fn}}} from './test-normative-catalog-consumers.mjs';{fn}();"],capture_output=True,text=True);rows.append({'mutant':name,'detected':r.returncode!=0,'exitCode':r.returncode,'error':r.stderr[-2000:], 'interpretation':'Atomic digest bypass must fail; statement/context guard alone remains defended by declaration/review digest mismatch.'});p.write_text(original)
finally:p.write_text(original)
assert rows[0]['detected']
Path('/workspace/shared/catalog-fixture-independent-mutants.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows))
