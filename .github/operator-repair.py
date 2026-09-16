"""One-use, digest-checked transport of the locally tested operator repair.
The publishing workflow removes this file from the resulting product tree.
"""
import hashlib
from pathlib import Path

expected = {
    'app-core.js': ('d3f57c674655e75d29796f1d89f0f3b660faa8cf6cb41c6f20d299119a16b255', 'a2856c31eefbe7a55ee07447abfaa74f1cf3272703e2e2e7b86a2d7c8adbb1a8'),
    'verify-complete-operator-journey.mjs': ('f01716608d7e37840dd1870f701e17762836ac9c44ef63ae755f1545be099822', '510989d4bd6c93d8aa1c4fdb3faba807ffee20c6459ddbf8d130fbe48671876e'),
    'verify-operator-action-lifecycle.mjs': ('c6bfc694aee769ea8462dcd2eb1b70c91469b544a1e35b3667d035d58c5c3f0c', '626c3798c610d9ac298bc639f19a4006529cb791a29954c56925ddc3916635cb'),
    'verify-operator-control-state-fault.mjs': ('51d0be6141d5722a1e97ae62cfbd087854d956cc4f98582ac45de3e98ed305b5', '9c623d786897e9713be7562ff247c0b0b6b985b9343111bfd13828e2c7986ad9'),
}
original = {}
for name, (before, after) in expected.items():
    raw = Path(name).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == before, 'Unexpected input: ' + name
    original[name] = raw.decode('utf-8')
result = dict(original)

def replace(name, before, after):
    assert result[name].count(before) == 1, 'Non-unique repair anchor in ' + name
    result[name] = result[name].replace(before, after)

app = 'app-core.js'
replace(app, '''return `<div class="panel next-action-panel" id="next-required-action" tabindex="-1"><h2 class="section-title">${esc(action.heading||'Next required action')}</h2><p class="section-intro"><strong>Who acts:</strong> ${esc(actionActor(action))}</p><div class="notice ''', '''return `<div class="panel next-action-panel"><div id="next-required-action" tabindex="-1"><h2 class="section-title">${esc(action.heading||'Next required action')}</h2><p class="section-intro"><strong>Stage ${String(stage).padStart(2,'0')} · Current state:</strong> ${esc(current.job.CURRENT_STATE||current.stages?.[stage]?.status||'Not recorded')}<br><strong>Who acts:</strong> ${esc(actionActor(action))}</p>${button?`<div class="button-row">${button}</div>`:''}</div><div class="notice ''')
replace(app, '''</div>${button?`<div class="button-row">${button}</div>`:''}<details class="record-card"><summary>Advanced action details''', '''</div><details class="record-card"><summary>Advanced action details''')
replace(app, "nextActionMarkup(displayedStageAction(n).actionType==='CONFIRM_STAGE_ONE_INTENT',n)", 'nextActionMarkup(true,n)')
replace(app, 'const automatic=n===22&&nativeStage22Tests().length?', "const primary=displayedStageAction(n),automatic=n===22&&nativeStage22Tests().length&&!(primary.actionType==='RUN_APP_TESTS'&&primary.primaryButton)?")
replace(app, 'external=stagePlanItems(n,selectedOperation(n)).some(', "external=!(['AI_REVIEW','EXTERNAL_AGENT_TOOL','EXTERNAL_SYSTEM'].includes(primary.actionType)&&primary.primaryButton&&primary.primaryButton!=='Export instruction file')&&stagePlanItems(n,selectedOperation(n)).some(")
replace(app, "$('#next-required-action > .notice')", "$('.next-action-panel > .notice')")
replace(app, 'writeBrowserEntry(historyState.activeId,view);render();window.scrollTo(0,0);', "writeBrowserEntry(historyState.activeId,view);render();if(current.activeView==='Workflow')focusAfterAction($('#next-required-action'));else window.scrollTo(0,0);")
for message in ["'human answers saved'", "'intent confirmation saved'", "'fresh context saved'", "'ten run slots reserved'", "'convergence calculated'", "'unchanged confirmation calculated'", "current.activeStage===19?'unchanged candidate verified':'candidate frozen'", "'unchanged confirmation iteration started'", "'baseline frozen'", "'product execution reserved'"]:
    before = 'announce(' + message + ');render();'
    replace(app, before, before + "focusAfterAction($('#next-required-action'));")

line_edits = {
'verify-complete-operator-journey.mjs': [
(13, 14, "const report={basis:'SYNTHETIC_EXTERNAL_COUNTERPART_WITH_ACTUAL_BROWSER_FILE_TRANSPORT',humanIndependenceEstablished:false,physicalDeviceAcceptance:false,viewportChecks:[],stages:[],operations:[],failures:[],complete:false};\n"),
(48, 49, r'''  // Independent fresh browser contexts exercise the real Save -> Workflow ->
  // Export path at both additional required sizes. This is responsive Chrome,
  // not a physical-device or independent-human acceptance assertion.
  for(const [width,height]of [[320,568],[1280,800]]){
    const check=await createOperatorBrowser({directory:path.join(directory,'viewport-'+width),width,height});
    try{
      await check.click('#new-project');
      await check.fill('[data-job="JOB_TITLE"]','Operator action viewport '+width);
      await check.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]',OBJECTIVE);
      await check.click('#save-job');
      assert.equal(await check.visible('#next-required-action'),true,'The actionable summary must fit the '+width+'px viewport after Save');
      assert.equal(await check.visible('#next-required-action #next-export-prompt-file'),true,'The actual export control, not merely its heading, must be visible at '+width+'px');
      const view=await check.inspect(1);
      assert.match(view.action,/Current state:/);
      assert.match(view.action,/Who acts:/);
      const [file]=await check.download('#next-export-prompt-file');
      const members=readStoreArchive(file.bytes);
      assert.ok(members.some(member=>member.canonicalPath==='instruction.txt'));
      assert.ok(members.some(member=>member.canonicalPath==='manifest.json'));
      await check.click('[data-view="Project"]');
      await check.click('[data-view="Workflow"]');
      assert.equal(await check.visible('#next-required-action'),true,'Workflow navigation lost the next action at '+width+'px');
      assert.equal(await check.visible('#next-export-prompt-file'),true,'Workflow navigation lost the primary control at '+width+'px');
      assert.equal(check.exceptions().length,0,'Viewport check raised a browser exception');
      report.viewportChecks.push({width,height,result:'PASS',view,exportSha256:file.sha256,events:check.events});preserveReport();
    }finally{await check.close();}
  }
  await browser.click('#new-project');await browser.fill('[data-job="JOB_TITLE"]','Complete operator journey');await browser.fill('[data-job="EXACT_USER_OBJECTIVE_VERBATIM"]',OBJECTIVE);await browser.click('#save-job');assert.equal(await browser.evaluate(`document.querySelector('[data-view="Workflow"]')?.getAttribute('aria-selected')==='true'`),true,'Saving project information did not advance to Workflow.');assert.equal(await browser.visible('#next-required-action'),true,'Saving project information did not place the next required action in the viewport.');assert.equal(await browser.visible('#next-required-action #next-export-prompt-file'),true,'The actual Stage 01 export control is not inside the visible next-action region.');await saved();
''')],
'verify-operator-action-lifecycle.mjs': [
(13, 13, r'''const workflowActionCall=source.slice(source.indexOf('function workflow(')).match(/\$\{(nextActionMarkup\([^}]+\))\}/)?.[1];
'''),
(29, 29, r'''    markup:(action,stage=1)=>{
      current={job:{JOB_ID:'DISPOSABLE-UI',CURRENT_STATE:'IN PROGRESS',CURRENT_STAGE:String(stage)},activeStage:stage,stages:{[stage]:{status:'IN PROGRESS'}}};
      displayedStageAction=()=>action;nativeStage22Tests=()=>[{}];selectedOperation=()=> 'COMPLETE';
      stagePlanItems=()=>[{executionMode:'AI_REVIEW',operatorAction:'REVIEW'}];
      const call=${JSON.stringify(workflowActionCall)};
      if(!call)throw new Error('Workflow has no operational action rendering call');
      const markup=Function('nextActionMarkup','displayedStageAction','n','return '+call)(nextActionMarkup,displayedStageAction,stage);
      return {markup,purpose:stagePurposeMarkup(stage)};
    },
'''),
(80, 81, r'''
// Execute the actual workflow's nextActionMarkup invocation, not a re-created
// argument. A false primary flag used to hide every control except confirmation.
// These are DOM-markup ownership checks; viewport geometry is checked by Chrome
// in verify-complete-operator-journey.mjs, not inferred from this VM.
const primaryControls=[
 ['CONTINUE_AGENT_CONVERSATION','Export instruction file','next-export-prompt-file',1],
 ['AI_REVIEW','Export instruction file','next-export-prompt-file',23],
 ['EXTERNAL_AGENT_TOOL','Export instruction file','next-export-prompt-file',21],
 ['RUN_APP_TESTS','Run automatic tests','run-native-tests',22],
 ['CALCULATE_CONVERGENCE','Calculate convergence','calculate-stage18-convergence',18],
 ['CALCULATE_UNCHANGED_CONFIRMATION','Calculate confirmation','calculate-stage19-confirmation',19],
 ['CALCULATE_RELEASE','Calculate release','calculate-stage27-release',27],
 ['BUILD_EVIDENCE_CHAINS','Build evidence chains','build-evidence-chains',29],
 ['FREEZE_CANDIDATE','Freeze candidate','next-freeze-candidate',10],
 ['FREEZE_DELIVERY_CANDIDATE','Freeze delivery candidate','freeze-delivery-candidate',25],
 ['RESERVE_RUN_BATCH','Reserve ten runs','next-reserve-run-batch',11],
 ['BEGIN_UNCHANGED_CONFIRMATION','Begin unchanged confirmation','next-begin-unchanged-confirmation',19],
 ['FREEZE_BASELINE','Freeze baseline','next-freeze-baseline',20],
 ['REGISTER_PRODUCTION_CONTEXT','Register production context','next-register-production-context',21],
 ['RESERVE_PRODUCT_EXECUTION','Reserve product execution','next-reserve-product-execution',21],
 ['HUMAN_INSPECTION','Record observation','record-human-inspection',22],
 ['CONFIRM_STAGE_ONE_INTENT','Confirm captured intent','confirm-stage-one',1],
 ['CAPTURE_DELIVERY_INTENT','Record delivery intent','capture-delivery-intent',30],
 ['CALCULATE_TERMINAL','Calculate terminal state','calculate-stage30-terminal',30],
 ['EXPORT_PRE_DELIVERY_CHECKPOINT','Export recovery checkpoint','export-pre-delivery-checkpoint',30],
 ['EXPORT_OR_SHARE_AUTHORIZED_ARTIFACTS','Export authorized files','export-authorized-artifacts',30],
 ['AI_REVIEW','Download verification package','download-execution-package',23],
 ['EXTERNAL_SYSTEM','Download verification package','download-execution-package',22],
];
for(const [actionType,primaryButton,id,stage]of primaryControls){
 const action={actionType,primaryButton,heading:'Perform the current action',explanation:'LONG-EXPLANATION '.repeat(300),operation:'COMPLETE',filesToSend:[],filesToWithhold:[],expectedReturnFiles:[],canonicalStateChanged:true,acceptedChange:'ACCEPTED-1',downstreamInvalidated:[23],newPromptRequired:true};
 const {markup,purpose}=context.ui.markup(action,stage),combined=markup+purpose;
 const occurrences=[...combined.matchAll(/id="([^" ]+)"/g)].map(match=>match[1]);
 assert.equal(occurrences.filter(value=>value===id).length,1,`PRIMARY_ACTION_ORACLE: ${actionType} must own exactly one live primary control ${id}`);
 const regionStart=markup.indexOf('id="next-required-action"'),control=markup.indexOf('id="'+id+'"'),explanation=markup.indexOf('<div class="notice');
 assert.ok(regionStart>=0&&control>regionStart&&control<explanation,`PRIMARY_ACTION_ORACLE: ${actionType} buried the control after unbounded explanation`);
 assert.match(markup.slice(regionStart,control),/Current state:/,'Current state must be adjacent to the primary control');
 assert.match(markup.slice(regionStart,control),/Who acts:/,'Actor must be adjacent to the primary control');
 for(const label of ['Canonical State Changed','Accepted Change','Downstream Invalidated','New Prompt Required'])assert.ok(markup.includes(label),`Required outcome accounting was removed: ${label}`);
 assert.ok(markup.includes('Advanced action details'),'Audit disclosure must be retained');
 cases.push({caseId:'UI-WORKFLOW-PRIMARY-'+actionType,stage,control:id,uniqueControl:true,beforeLongDetails:true,result:'PASS'});
}
console.log(JSON.stringify({schema:'closed-loop-executed-cases/1',synthetic:true,environment:'Node VM with delayed operation and frame boundary',scope:'Shared action binding and production workflow markup ownership; not browser layout or stage-by-stage file-transport acceptance.',cases},null,2));
''')],
'verify-operator-control-state-fault.mjs': [
(16, 17, r'''
 const primaryFaults=[
  ['workflow-hides-current-control','nextActionMarkup(true,n)',"nextActionMarkup(displayedStageAction(n).actionType==='CONFIRM_STAGE_ONE_INTENT',n)"],
  ['duplicate-native-action',"&&!(primary.actionType==='RUN_APP_TESTS'&&primary.primaryButton)",'' ],
 ];
 const primaryResults=[];
 for(const [name,before,after]of primaryFaults){
  assert.equal(source.split(before).length,2,'Primary control fault anchor must be unique: '+name);
  fs.writeFileSync(mutant,source.replace(before,after));
  const failure=spawnSync(process.execPath,['verify-operator-action-lifecycle.mjs'],{encoding:'utf8',env:{...process.env,APP_SOURCE:mutant},maxBuffer:8*1024*1024});
  assert.notEqual(failure.status,0,'The production primary-action defect escaped its regression: '+name);
  assert.match(failure.stderr,/PRIMARY_ACTION_ORACLE:/,'Failure must come from the primary-action oracle, not unrelated setup');
  primaryResults.push({name,result:'PASS',mutantExitCode:failure.status});
 }
 console.log(JSON.stringify({synthetic:true,actualBrowser:false,environment:'Node VM executes a temporary production UI implementation fault',cases:[{name:'Removing the current-state update restores obsolete Undo availability and is detected',result:'PASS',mutantExitCode:run.status},...primaryResults]},null,2));
''')],
}
for name, edits in line_edits.items():
    lines = original[name].splitlines(keepends=True)
    for start, end, text in reversed(edits):
        lines[start:end] = text.splitlines(keepends=True)
    result[name] = ''.join(lines)

# Validate all outputs before writing any one of them.
for name, text in result.items():
    actual = hashlib.sha256(text.encode('utf-8')).hexdigest()
    assert actual == expected[name][1], 'Output differs from locally tested bytes: ' + name + ' ' + actual
for name, text in result.items():
    Path(name).write_bytes(text.encode('utf-8'))
    print(name, expected[name][1])
