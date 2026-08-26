from pathlib import Path

app=Path('app-core.js')
verify=Path('verify-complete.mjs')
text=app.read_text()
old="if(next.stages[1].status==='COMPLETE'&&!next.isRetainedTestProject){const id=engine.allocateInfrastructureId(next,'HUMAN-INPUT-CHANGE','changes');engine.invalidateDownstream(next,1,id,'User Job Input changed after Stage 01 completion.');}"
new="if(next.stages[1].status==='COMPLETE'&&!next.isRetainedTestProject)engine.invalidateStageForAuthorityChange(next,{stage:1,reason:'User Job Input changed after Stage 01 completion.',operatorLabel:'HUMAN_OPERATOR'});"
if text.count(old)!=1: raise SystemExit(f'Expected one stale Stage 1 save route, found {text.count(old)}')
app.write_text(text.replace(old,new,1))

v=verify.read_text()
marker='// Authoritative User Job Input changes after Stage 01 completion must invalidate Stage 01 itself, not only downstream work.'
if marker not in v:
    block=r'''// Authoritative User Job Input changes after Stage 01 completion must invalidate Stage 01 itself, not only downstream work.
{
  const appSource=fs.readFileSync('app-core.js','utf8');
  assert(appSource.includes("invalidateStageForAuthorityChange(next,{stage:1,reason:'User Job Input changed after Stage 01 completion.'"),'User Job Input edit path does not invalidate Stage 01 authority.');
  assert(!appSource.includes("invalidateDownstream(next,1,id,'User Job Input changed after Stage 01 completion.'"),'User Job Input edit still leaves stale Stage 01 accepted authority current.');
  const p=project('JOB-STAGE1-INPUT-CHANGE');
  p.stages[1].status='COMPLETE';p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:'OLD DELIVERABLE'};p.stages[1].acceptedData={EXACT_DELIVERABLE_REQUESTED:'OLD DELIVERABLE'};p.stages[1].acceptedDataChangeIds=['CHANGE-STAGE1-OLD'];p.stages[1].acceptedResponseIds=['RAW-STAGE1-OLD'];
  p.projectData.acceptedChanges.push({changeId:'CHANGE-STAGE1-OLD',stage:1,status:'COMMITTED',responseType:'DATA_PROPOSAL',rawResponseId:'RAW-STAGE1-OLD'});
  p.projectData.stageConfirmations.push({confirmationId:'CONFIRM-STAGE1-OLD',stage:1,acceptedChangeId:'CHANGE-STAGE1-OLD',confirmed:true});
  p.stages[2].status='COMPLETE';const source=record('sources',2,{TITLE:'Old source',ISSUING_ORGANIZATION_OR_AUTHOR:'Authority',SOURCE_TYPE:'OFFICIAL_STANDARD',PUBLICATION_ORIGIN:'Authority',URL_REFERENCE:'https://example.invalid/old',AUTHORITY_LEVEL:'PRIMARY',AUTHORITY_ROLE:'GOVERNING',RELEVANCE:'old',APPLICABLE_PORTIONS:'old',INSPECTION_STATUS:'INSPECTED',CURRENCY_STATUS:'CURRENT',SUPERSESSION_STATUS:'NOT SUPERSEDED',CONTROLLING_STATE:'CONTROLLING'},'SOURCE-OLD-INPUT');p.projectData.sources.push(source);
  engine.invalidateStageForAuthorityChange(p,{stage:1,reason:'User Job Input changed after Stage 01 completion.',operatorLabel:'VERIFY'});
  assert(p.stages[1].status!=='COMPLETE'&&!Object.keys(p.stages[1].agentData||{}).length&&!Object.keys(p.stages[1].acceptedData||{}).length,'Stage 01 remained complete with stale normalized input after authoritative input change.');
  assert(p.projectData.acceptedChanges[0].invalidatedBy&&p.projectData.stageConfirmations[0].invalidatedBy,'Old Stage 01 acceptance or human confirmation remained current.');
  assert(source.active===false&&source.invalidatedBy,'Downstream Stage 02 evidence remained current after Stage 01 authority changed.');
}

'''
    anchor='// Explicit workflow gates cannot be bypassed by manual assertions.'
    if anchor not in v: raise SystemExit('verify-complete insertion anchor missing')
    v=v.replace(anchor,block+anchor,1)
    verify.write_text(v)
