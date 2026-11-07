import json,hashlib,pathlib,subprocess,tempfile,shutil,os
ROOT=pathlib.Path('/workspace/shared/clrt-source-review-pipeline'); NODE='/workspace/shared/npm-cache/_npx/d18f28baf1132559/node_modules/node/bin/node'; HEAD='a12c42814adf6a253cbcda825f6b211801f8d7ca'; BASE='ebf6a930d1e5ef2f9afaaf68631a318facee5181'; PREFIX=pathlib.Path('/workspace/shared/clrt-source-adoption-independent-review-pipeline'); SPEC='specification/closed-loop-reliability-controlling-implementation-specification.txt'
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_bytes())
checks=[];outputs={}
def check(name,fn):fn();checks.append({'name':name,'status':'PASS'})
def require(v):assert v

def run(name,script,cwd=ROOT,env=None,args=[]):
 e=dict(os.environ,GITHUB_ACTIONS='false',SOURCE_COMMIT=BASE);e.update(env or {})
 r=subprocess.run([NODE,script,*args],cwd=cwd,env=e,text=True,capture_output=True,timeout=150)
 outputs[name]={'status':r.returncode,'stdout':r.stdout,'stderr':r.stderr};return r

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
source=(ROOT/SPEC).read_bytes();lines=source.decode().split('\n'); sm=read('specification/closed-loop-specification-manifest.json');nm=read('specification/closed-loop-normative-requirements.json');decl=read('specification/requirement-evidence-bindings.json'); rec=read(decl['independentSourceReview']['reconciliationPath']); rev=read(decl['independentSourceReview']['sourceReviewPath']); ev=read(rec['mechanicalCandidateExclusionEvidence']['path']);a=read('verification/clrt-source-extraction-a-independent.json');b=read('verification/clrt-source-extraction-b.json');cross=read('verification/historical-source-relocation-crosswalk-20261014.json')
check('frozen identity and unchanged exact source',lambda:require(git('rev-parse','HEAD').decode().strip()==HEAD and source==git('show',BASE+':'+SPEC)==pathlib.Path('/workspace/shared/clrt-controlling-part-b.txt').read_bytes() and len(source)==309482 and sha(source)=='8b17763e915b9475898dad5d44e83a1c9552025c699ec28d24a3d12b9b0cf883'))
check('source-bearing commit is ancestor and manifest identifies its actual source',lambda:require(subprocess.run(['git','merge-base','--is-ancestor',BASE,HEAD],cwd=ROOT).returncode==0 and sm['sourceCommit']==nm['sourceCommit']==rec['sourceCommit']==BASE))
check('frozen A and B are byte-identical to original separately delivered outputs',lambda:require(all((ROOT/'verification'/f).read_bytes()==(pathlib.Path('/workspace/shared')/f).read_bytes() for f in ['clrt-source-extraction-a-independent.json','clrt-source-extraction-b.json'])))
for role in ['sourceReview','reconciliation']:
 check(role+' exact declaration digest',lambda role=role:require(sha((ROOT/decl['independentSourceReview'][role+'Path']).read_bytes())==decl['independentSourceReview'][role+'Sha256']))
check('reconciliation and exclusion links bind same exact frozen originals',lambda:require(all(sha((ROOT/'verification'/r['path']).read_bytes())==r['sha256'] for r in rec['frozenExtractionInputs']) and all(sha((ROOT/'verification'/ev[k]['path']).read_bytes())==ev[k]['sha256'] for k in ['independentReview','independentExtractorA']) and sha((ROOT/rec['mechanicalCandidateExclusionEvidence']['path']).read_bytes())==rec['mechanicalCandidateExclusionEvidence']['sha256']))
def pointer(obj,p):
 for t in p.strip('/').split('/'): obj=obj[int(t)] if isinstance(obj,list) else obj[t.replace('~1','/').replace('~0','~')]
 return obj

def normalized():
 assert rev['sourceContractFindings']==b['source_contract_findings'] and rev['exceptionsAndNonrequirements']==b['exceptions_and_nonrequirements'] and rev['sourceBlockAnchors']==b['source_block_anchors']
 assert rev['normalizationProvenance']['frozenSourceReviewSha256']==sha((ROOT/'verification/clrt-source-extraction-b.json').read_bytes())
 obs=[]
 for sec in rev['sections']:
  assert sec['source_sha256']==sha(('\n'.join(lines[sec['start_line']-1:sec['end_line']])+'\n').encode())
  for o in sec['observations']: assert o['obligation']==pointer(b,o['frozenReviewPointer']);obs.append(o['observation_id'])
 assert len(obs)==len(set(obs))==226
 assert set(obs)=={r['observationId'] for r in rec['observationResolutions']}
 assert b['completed_at_utc'] < rec['reconciledAt']
check('all 226 normalized observations preserve actual original B semantic strings and source ranges',normalized)
expected_ex=[5565,5566,5567,5568,5569,5570,5573,5574,5575];mandatory=[5578,5596,5597,*range(5599,5610),5611]
check('only nine reviewed metadata candidates excluded; all 15 independently derived mandatory Section 51 lines preserved',lambda:require([r['line'] for r in ev['mechanicalCandidateExclusions']]==expected_ex and ev['mandatoryPreservedLines']==mandatory and all(nm['sourceLineCoverage'][i-1]['status']=='NONNORMATIVE' and not nm['sourceLineCoverage'][i-1]['normativeRequirementIds'] for i in expected_ex) and all(nm['sourceLineCoverage'][i-1]['status']=='NORMATIVE_REQUIREMENT' and any(r['sourceLocation']['startLine']==i for r in nm['requirements']) for i in mandatory)))
check('truthful source coverage versus atomic completeness and no accepted conformance',lambda:require(nm['omissionChallenge']['independentReviewEvidence']['semanticSourceCoverageEstablished'] is True and nm['omissionChallenge']['independentReviewEvidence']['semanticCompletenessEstablished'] is False and nm['omissionChallenge']['independentReviewEvidence']['atomicRequirementCompletenessEstablished'] is False and sm['challengeAndReconciliation']['sourceCoverageOnly'] is True and sm['challengeAndReconciliation']['atomicRequirementCompletenessEstablished'] is False and len(nm['requirements'])==4198 and not any(r['currentDisposition']=='CONFORMANT_PROVEN' for r in nm['requirements'])))
check('six unresolved candidates retained verbatim without any approved amendment or promoted evidence',lambda:require(nm['omissionChallenge']['unresolvedContractFindings']==rec['unresolvedContractFindings'] and len(rec['unresolvedContractFindings'])==6 and all(r['approvalStatus']=='NOT_REQUESTED_OR_GRANTED_BY_THIS_WORKER' for r in rec['unresolvedContractFindings']) and not decl['approvedClarifications'] and not decl['approvedAmendments'] and not decl['requirements'] and not nm['approvedAmendments']))
def crosswalk():
 old=json.loads(git('show',cross['historicalCommit']+':'+cross['priorManifestPath']));oldmap={r['normativeRequirementId']:r for r in old['requirements']};seen=set(); counts={}
 assert len(oldmap)==len(cross['crosswalk'])==4066
 assert sha(git('show',cross['historicalCommit']+':'+cross['priorManifestPath']))==cross['priorManifestFileSha256']
 for r in cross['crosswalk']:
  oid=r['priorNormativeRequirementId'];assert oid not in seen;seen.add(oid);prior=oldmap[oid];assert prior['sourceLocation']==r['priorSourceLocation'] and prior['controllingText']==r['priorControllingText'];assert r['atomicEquivalenceEstablished'] is False and r['proofRenewed'] is False
  counts[r['relation']]=counts.get(r['relation'],0)+1
  if r['relation']!='ABSENT_OR_CHANGED_IN_TARGET_SOURCE':
   assert sha(lines[r['targetSourceLine']-1].encode())==r['targetRawLineSha256']==r['priorRawLineSha256'];assert nm['sourceLineCoverage'][r['targetSourceLine']-1]['normativeRequirementIds']==r['targetSourceTraceIds']
 assert counts==cross['summary']=={'EXACT_LINE_NOW_CLASSIFIED_NONNORMATIVE':10,'EXACT_SOURCE_LINE_RELOCATION':4020,'ABSENT_OR_CHANGED_IN_TARGET_SOURCE':36}
 assert cross['semanticAtomicEquivalenceEstablished'] is False and cross['implementationConformanceClaim'] is False
check('all 4066 historical crosswalk rows retain identities and no atomic/proof promotion',crosswalk)
check('no runtime source or build-state changes',lambda:require(not git('diff','--name-only',BASE,HEAD,'--','*.js','*.html','*.css','.github','package.json','package-lock.json','verification/closed-loop-build-state.json').strip()))
for s in ['generate-specification-governance.mjs','review-specification-coverage.mjs','specification-governance-core.mjs','test-specification-source-adoption.mjs','test-specification-source-classifications.mjs','verify-specification-governance.mjs']:
 r=run('syntax '+s,'--check',args=[s]);check('syntax '+s,lambda r=r:require(r.returncode==0))
manifestpaths=['specification/closed-loop-specification-manifest.json','specification/closed-loop-normative-requirements.json'];before=[(ROOT/p).read_bytes() for p in manifestpaths]
for s in ['test-specification-source-adoption.mjs','test-specification-source-classifications.mjs','generate-specification-governance.mjs']:
 r=run(s,s);check(s+' passes',lambda r=r:require(r.returncode==0));check(s+' preserves committed manifests',lambda:require(before==[(ROOT/p).read_bytes() for p in manifestpaths]))
for s in ['specification-governance-core.mjs','verify-specification-governance.mjs']:
 r=run(s,s);check(s+' rejects specifically missing atomic completeness after source controls',lambda r=r:require(r.returncode==1 and 'Atomic normative-requirement completeness remains unproven' in r.stderr and '"mutationCount": 19' in (r.stdout+r.stderr)));check(s+' leaves committed manifests unchanged',lambda:require(before==[(ROOT/p).read_bytes() for p in manifestpaths]))
# Further JS helper challenges alter a rehashed disposable evidence descriptor so
# failure is due to independent source checks, not just outer inventory mismatch.
r=run('fresh rehashed exclusion challenges','/workspace/shared/clrt-source-adoption-independent-review-pipeline-challenges.mjs');check('fresh rehashed exclusion challenges pass',lambda:require(r.returncode==0))
report={'result':'ACCEPT','scope':'SOURCE_ONLY_PIPELINE_DELTA','head':HEAD,'base':BASE,'node':subprocess.check_output([NODE,'--version'],text=True).strip(),'checks':checks,'checkCount':len(checks),'outputs':outputs,'fullGovernanceAcceptance':False,'atomicCompletenessAccepted':False,'sixContractCandidatesAdjudicated':False}
PREFIX.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='outputs'},indent=2))
