from pathlib import Path
import hashlib,re
p=Path('.github/workflows/pages.yml');s=p.read_text()
pairs=[
("          node verify-data-route-closure.mjs\n          node verify-infrastructure-route-closure.mjs","          node verify-data-route-closure.mjs\n          node verify-current-scope-regressions.mjs\n          node verify-infrastructure-route-closure.mjs"),
("          node verify-data-route-closure.mjs > /tmp/data-route.json\n          node verify-infrastructure-route-closure.mjs > /tmp/infrastructure-route.json","          node verify-data-route-closure.mjs > /tmp/data-route.json\n          node verify-current-scope-regressions.mjs > /tmp/current-scope.json\n          node verify-infrastructure-route-closure.mjs > /tmp/infrastructure-route.json"),
("          const dataRoute=JSON.parse(fs.readFileSync('/tmp/data-route.json','utf8'));\n          const infrastructureRoute=","          const dataRoute=JSON.parse(fs.readFileSync('/tmp/data-route.json','utf8'));\n          const currentScope=JSON.parse(fs.readFileSync('/tmp/current-scope.json','utf8'));\n          const infrastructureRoute="),
("          if(dataRoute.dataRouteClosure!=='PASS')throw new Error('Canonical data-route closure proof did not pass.');","          if(dataRoute.dataRouteClosure!=='PASS'||dataRoute.allOperationPromptsBuilt!==true)throw new Error('Canonical data-route closure proof did not build and verify every operation prompt.');\n          if(currentScope.currentScopeRegressions!=='PASS')throw new Error('Current-scope regression proof did not pass.');"),
("            routeOperationsChecked:dataRoute.operationsChecked,","            routeOperationsChecked:dataRoute.operationsChecked,\n            routePromptRoutesChecked:dataRoute.promptRoutesChecked,\n            routeAllOperationPromptsBuilt:dataRoute.allOperationPromptsBuilt,"),
("            routeHumanExperiencePromptContract:dataRoute.humanExperiencePromptContract,","            routeHumanExperiencePromptContract:dataRoute.humanExperiencePromptContract,\n            stage11IterationRouteCurrent:currentScope.stage11IterationRoute,\n            stage28CurrentIdentityOnly:currentScope.stage28CurrentIdentityOnly,\n            stage29CurrentEvidenceChainsOnly:currentScope.stage29CurrentEvidenceChainsOnly,\n            blockerScopePreservedAndStaleExcluded:currentScope.blockerScopePreservedAndStaleExcluded,")]
for old,new in pairs:
 n=s.count(old)
 if n!=1:raise SystemExit(f'CI anchor {n}: {old[:40]}')
 s=s.replace(old,new,1)
p.write_text(s)
files=['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def blob(path):
 b=Path(path).read_bytes();return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
token='runtime-'+hashlib.sha256(''.join(f'{f}:{blob(f)}\n' for f in files).encode()).hexdigest()[:16]
p=Path('index.html');h=p.read_text();h2=re.sub(r'(?<=\?v=)runtime-[A-Za-z0-9-]+',token,h)
if h2==h:raise SystemExit('build token unchanged')
p.write_text(h2);print(token)
