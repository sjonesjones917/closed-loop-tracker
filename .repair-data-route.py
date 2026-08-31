from pathlib import Path

p=Path('workflow-engine.js')
s=p.read_text()
old="const source=scopeRule?recordsForScope(project,'requirements',scopeRule):records(project,'requirements');"
new="const source=scopeRule?recordsForScope(project,'requirements',scopeRule):recordsForCurrentScope(project,'requirements');"
if old not in s: raise SystemExit('mandatoryRequirements target not found')
s=s.replace(old,new,1)
old="function confirmedDefects(project){\n  return records(project,'defects').filter(record=>{"
new="function confirmedDefects(project,{allScopes=false}={}){\n  const source=allScopes?records(project,'defects'):records(project,'defects').filter(record=>!record?.scope||Object.keys(record.scope).length===0||scopeMatches(record,currentScope(project)));\n  return source.filter(record=>{"
if old not in s: raise SystemExit('confirmedDefects target not found')
s=s.replace(old,new,1)
for old,new in [
("defects=confirmedDefects(project),baselineEvent=history.find", "defects=confirmedDefects(project,{allScopes:true}),baselineEvent=history.find"),
("case 30:{requireAccepted();const defects=confirmedDefects(project),regs=records(project,'regressions')", "case 30:{requireAccepted();const defects=confirmedDefects(project,{allScopes:true}),regs=records(project,'regressions')"),
("case 30:{const defects=records(project,'defects',{active:false}),confirmed=confirmedDefects(project),regs=records(project,'regressions',{active:false})", "case 30:{const defects=records(project,'defects',{active:false}),confirmed=confirmedDefects(project,{allScopes:true}),regs=records(project,'regressions',{active:false})")]:
    if old not in s: raise SystemExit('all-scope defect target not found: '+old[:50])
    s=s.replace(old,new,1)
old="""function actionEnvelope(project,stage,values={}){
  const receipt=actionReceiptState(project,stage);
  const action={
    actionType:'PASTE_FINAL_JSON',heading:'Complete the current stage',explanation:'Return the current final structured response and any required returned files.',primaryButton:null,secondaryAction:null,
    filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],blockingReason:null,
    ...receipt,...values
  };
  if(!ACTION_TYPES.includes(action.actionType))throw new Error('Unknown operational action type: '+action.actionType+'.');
  action.filesToSend=safe(action.filesToSend);action.filesToWithhold=safe(action.filesToWithhold);action.expectedReturnFiles=safe(action.expectedReturnFiles);action.downstreamInvalidated=safe(action.downstreamInvalidated);
  return action;
}
"""
new="""function actionEnvelope(project,stage,values={}){
  const receipt=actionReceiptState(project,stage),stageDefinition=core.STAGES?.[Number(stage)-1],operatorChecks=safe(stageDefinition?.humanChecklist||stageDefinition?.completionGate);
  const action={
    actionType:'PASTE_FINAL_JSON',heading:'Complete the current stage',explanation:'Return the current final structured response and any required returned files.',primaryButton:null,secondaryAction:null,
    filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],operatorChecks,blockingReason:null,
    ...receipt,...values
  };
  if(!ACTION_TYPES.includes(action.actionType))throw new Error('Unknown operational action type: '+action.actionType+'.');
  action.filesToSend=safe(action.filesToSend);action.filesToWithhold=safe(action.filesToWithhold);action.expectedReturnFiles=safe(action.expectedReturnFiles);action.operatorChecks=safe(action.operatorChecks);action.downstreamInvalidated=safe(action.downstreamInvalidated);
  return action;
}
"""
if old not in s: raise SystemExit('actionEnvelope target not found')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('app-core.js')
s=p.read_text()
old="function currentNextAction(){const value=current?.job?.NEXT_REQUIRED_ACTION;if(value&&typeof value==='object'&&!Array.isArray(value))return value;return {actionType:'PASTE_FINAL_JSON',heading:'Next required action',explanation:String(value||'No next action recorded.'),primaryButton:null,secondaryAction:null,filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],blockingReason:null,canonicalStateChanged:false,acceptedChange:null,downstreamInvalidated:[],newPromptRequired:false};}"
new="function currentNextAction(){const value=current?.job?.NEXT_REQUIRED_ACTION;if(value&&typeof value==='object'&&!Array.isArray(value))return value;return {actionType:'PASTE_FINAL_JSON',heading:'Next required action',explanation:String(value||'No next action recorded.'),primaryButton:null,secondaryAction:null,filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],operatorChecks:[],blockingReason:null,canonicalStateChanged:false,acceptedChange:null,downstreamInvalidated:[],newPromptRequired:false};}"
if old not in s: raise SystemExit('currentNextAction target not found')
s=s.replace(old,new,1)
old='${send}${withhold}${returns}${humanCapture}<div class="record-rows action-certainty">'
new='${send}${withhold}${returns}${humanCapture}${safe(action.operatorChecks).length?`<details class="record-card operator-checks"><summary>Double-check before you continue<span>${safe(action.operatorChecks).length} checks</span></summary><div class="record-body"><ul>${safe(action.operatorChecks).map(item=>`<li>${esc(item)}</li>`).join(\'\')}</ul></div></details>`:\'\'}<div class="record-rows action-certainty">'
if old not in s: raise SystemExit('next-action markup target not found')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('verify-human-stage-walkthrough.mjs')
s=p.read_text()
old="    const picker=document.querySelector('#stage-picker');if(!picker)throw new Error('Stage picker is missing after opening Workflow.');\n    const reached=[];"
new="    const picker=document.querySelector('#stage-picker');if(!picker)throw new Error('Stage picker is missing after opening Workflow.');\n    const operatorChecks=document.querySelector('#next-required-action .operator-checks');if(!operatorChecks)throw new Error('Current operator action does not expose the compact double-check guide.');\n    const checkSummary=operatorChecks.querySelector('summary');if(!checkSummary||!checkSummary.textContent.includes('Double-check before you continue'))throw new Error('Operator double-check guide is not clearly labeled.');\n    if(operatorChecks.open)throw new Error('Operator double-check guide must be collapsed by default to avoid visual overload.');\n    const reached=[];"
if old not in s: raise SystemExit('browser walkthrough target not found')
s=s.replace(old,new,1)
old="return {stages:30,prompts:checked.length,first:checked[0],last:checked.at(-1),uiStagesReached:reached.length,oneTimeSupply:true,promptVisualBaseline:true};"
new="return {stages:30,prompts:checked.length,first:checked[0],last:checked.at(-1),uiStagesReached:reached.length,oneTimeSupply:true,promptVisualBaseline:true,operatorDoubleCheckGuide:true};"
if old not in s: raise SystemExit('browser result target not found')
s=s.replace(old,new,1)
old="if(result?.stages!==30||result?.uiStagesReached!==30||result?.prompts<30||result?.oneTimeSupply!==true||result?.promptVisualBaseline!==true)"
new="if(result?.stages!==30||result?.uiStagesReached!==30||result?.prompts<30||result?.oneTimeSupply!==true||result?.promptVisualBaseline!==true||result?.operatorDoubleCheckGuide!==true)"
if old not in s: raise SystemExit('browser final assertion target not found')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('.github/workflows/pages.yml')
s=p.read_text()
anchor="""          node verify-v3-definition-of-done.mjs

      - name: Project lifecycle and application-owned controls
"""
insert="""          node verify-v3-definition-of-done.mjs
          node verify-data-route-closure.mjs

      - name: Project lifecycle and application-owned controls
"""
if anchor not in s: raise SystemExit('CI route-proof anchor not found')
s=s.replace(anchor,insert,1)
status_anchor="""          kill \"$SERVER_PID\" 2>/dev/null || true
          trap - EXIT

  deploy:
"""
status_insert="""          kill \"$SERVER_PID\" 2>/dev/null || true
          trap - EXIT

      - name: Publish required PR test status after complete acceptance
        if: github.event_name == 'pull_request' && success()
        env:
          GH_TOKEN: ${{ github.token }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          REPOSITORY: ${{ github.repository }}
        run: |
          set -euo pipefail
          test -n \"$HEAD_SHA\"
          curl --fail-with-body --silent --show-error \\
            -X POST \\
            -H \"Authorization: Bearer $GH_TOKEN\" \\
            -H \"Accept: application/vnd.github+json\" \\
            -H \"X-GitHub-Api-Version: 2022-11-28\" \\
            \"https://api.github.com/repos/$REPOSITORY/statuses/$HEAD_SHA\" \\
            -d '{\"state\":\"success\",\"context\":\"test\",\"description\":\"Complete controlling acceptance passed\"}'

  deploy:
"""
if status_anchor not in s: raise SystemExit('required-status anchor not found')
s=s.replace(status_anchor,status_insert,1)
p.write_text(s)
