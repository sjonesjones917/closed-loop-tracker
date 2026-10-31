import json,pathlib,subprocess,tempfile,os,hashlib
root=pathlib.Path('/workspace/shared/clrt-source-review-pipeline');node='/workspace/shared/npm-cache/_npx/d18f28baf1132559/node_modules/node/bin/node';source_commit='ebf6a930d1e5ef2f9afaaf68631a318facee5181';sha=lambda b:hashlib.sha256(b).hexdigest()
result={}
with tempfile.TemporaryDirectory(prefix='clrt-pipeline-acceptance-gate-') as temp:
 p=pathlib.Path(temp)
 subprocess.run(['bash','-o','pipefail','-c',f'git archive a12c42814adf6a253cbcda825f6b211801f8d7ca | tar -x -C {temp}'],cwd=root,check=True)
 def read(f):return json.loads((p/f).read_bytes())
 def write(f,obj):
  data=(json.dumps(obj,indent=2)+'\n').encode();(p/f).write_bytes(data);return sha(data)
 decl=read('specification/requirement-evidence-bindings.json');d=decl['independentSourceReview'];rp=d['sourceReviewPath'];cp=d['reconciliationPath'];r=read(rp);c=read(cp)
 # Synthetic assertion of atomicity is solely to reach the next gate. This fixture
 # is not independent evidence and is deleted; it must not support any acceptance.
 r['atomic_requirement_completeness_established']=True;c['atomicManifestCompletenessClaim']=True;c['sourceReviewSha256']=write(rp,r);d['sourceReviewSha256']=c['sourceReviewSha256'];d['reconciliationSha256']=write(cp,c);write('specification/requirement-evidence-bindings.json',decl)
 out=subprocess.run([node,'specification-governance-core.mjs'],cwd=p,env=dict(os.environ,SOURCE_COMMIT=source_commit,GITHUB_ACTIONS='false'),text=True,capture_output=True,timeout=150)
 result={'fixtureScope':'ISOLATED_SYNTHETIC_ATOMIC_FLAGS_TO_REACH_CONTRACT_GATE_ONLY','status':out.returncode,'stdout':out.stdout,'stderr':out.stderr,'acceptanceEvidenceClaim':False}
 assert out.returncode==1 and 'Source-contract acceptance remains blocked by unresolved UNDEFINED_* findings' in out.stderr
 assert 'Atomic normative-requirement completeness remains unproven' not in out.stderr
 result['result']='PASS';result['finding']='Unresolved candidate contract findings still block after the atomic flag gate.'
pathlib.Path('/workspace/shared/clrt-source-adoption-independent-review-pipeline-gates.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['stdout','stderr']},indent=2))
