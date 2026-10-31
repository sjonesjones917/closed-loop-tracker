import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Independent Section15 literals. Human information is entered through the
// normal Job form; no test writes canonical project state or stage mirrors.
export const HUMAN_JOB_CONTROL_VALUES=Object.freeze({
 JOB_TITLE:'  Exact synthetic title é🙂  ',
 JOB_OWNER:'  Synthetic owner Ω  ',
 EXACT_USER_OBJECTIVE_VERBATIM:'  Prepare a signed inventory.\nKeep this second line exactly.  ',
 SUPPLIED_MATERIALS_INVENTORY:'  supplied-note.txt\nNo file bytes supplied in this focused check.  ',
 REQUIRED_OUTPUT_FORMAT:'  UTF-8 plain text  ',
 DEADLINE_OR_TEMPORAL_SCOPE:'  As of 2026-10-06; no invented deadline.  ',
 DESIRED_SOURCE_COUNT:7,
 KNOWN_AUTHORITATIVE_SOURCES:'  The supplied governing text; no additional authority claim.  ',
 AVAILABLE_TOOLS:'  Local text editor\nAuthorized browser viewing  ',
 PROHIBITED_ACTIONS:'  Do not upload project data.\nDo not infer consent.  ',
 EXPLICIT_USER_REQUIREMENTS:'  Preserve exact text.\n\nKeep the empty line.  '
});
const fields=Object.keys(HUMAN_JOB_CONTROL_VALUES);
const values=project=>Object.fromEntries(fields.map(field=>[field,project.job[field]]));
// These payload keys are ASCII, with only JSON strings, integers, objects and
// arrays. This independent encoder does not ask the application for its hash.
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
function assertInputVersion(project,expected,changedFields){
 const row=project.projectData.inputVersions.at(-1);assert.ok(row,'HUMAN_JOB_VERSION_PRESENT_ORACLE');
 for(const [field,value]of Object.entries(expected))assert.deepEqual(row.payload[field],value,'HUMAN_JOB_VERSION_VALUE_ORACLE: '+field);
 assert.equal(row.operator,'HUMAN_OPERATOR','HUMAN_JOB_OPERATOR_ORACLE');
 assert.equal(row.version,project.job.CURRENT_INPUT_VERSION,'HUMAN_JOB_CURRENT_VERSION_ORACLE');
 assert.equal(row.sha256,createHash('sha256').update(JSON.stringify(ordered(row.payload))).digest('hex'),'HUMAN_JOB_RAW_PAYLOAD_HASH_ORACLE');
 assert.deepEqual([...row.changedFields].sort(),[...changedFields].sort(),'HUMAN_JOB_CHANGED_FIELDS_ORACLE');
 const event=project.projectData.history.findLast(event=>event.type==='USER_JOB_INPUT_VERSIONED'&&event.recordId===row.inputVersionId);
 assert.ok(event,'HUMAN_JOB_HISTORY_BINDING_ORACLE');assert.equal(event.version,row.version);assert.equal(event.sha256,row.sha256);assert.deepEqual(event.changedFields,row.changedFields);
 return {inputVersionId:row.inputVersionId,version:row.version,sha256:row.sha256,changedFields:row.changedFields,operator:row.operator,eventId:event.eventId};
}
export async function verifyHumanJobControls(browser,record=()=>{}){
 await browser.click('#new-project');const created=await browser.readProject();
 for(const [field,value]of Object.entries(HUMAN_JOB_CONTROL_VALUES))await browser.fill('[data-job="'+field+'"]',String(value));
 await browser.click('#save-job');const first=await browser.readProject();
 assert.deepEqual(values(first),HUMAN_JOB_CONTROL_VALUES,'HUMAN_JOB_SAVE_VALUES_ORACLE');
 assert.deepEqual(first.projectData.humanDecisions,created.projectData.humanDecisions,'HUMAN_JOB_NO_INVENTED_PURPOSE_ORACLE');
 assert.deepEqual(first.stages[1].humanData,created.stages[1].humanData,'HUMAN_JOB_CANONICAL_PATH_ORACLE');
 const firstVersion=assertInputVersion(first,HUMAN_JOB_CONTROL_VALUES,fields);
 await browser.reload();const firstReload=await browser.readProject();
 assert.deepEqual(values(firstReload),HUMAN_JOB_CONTROL_VALUES,'HUMAN_JOB_RELOAD_VALUES_ORACLE');
 assert.deepEqual(firstReload.projectData.inputVersions,first.projectData.inputVersions,'HUMAN_JOB_RELOAD_HISTORY_ORACLE');
 assertInputVersion(firstReload,HUMAN_JOB_CONTROL_VALUES,fields);
 await browser.click('[data-view="Project"]');
 const edited={...HUMAN_JOB_CONTROL_VALUES,JOB_TITLE:'  Revised title  ',JOB_OWNER:'  Revised owner  ',EXACT_USER_OBJECTIVE_VERBATIM:'  Revised human objective\nKeep history of the earlier objective.  ',DESIRED_SOURCE_COUNT:null};
 const changed=['JOB_TITLE','JOB_OWNER','EXACT_USER_OBJECTIVE_VERBATIM','DESIRED_SOURCE_COUNT'];
 for(const field of changed)await browser.fill('[data-job="'+field+'"]',edited[field]===null?'':String(edited[field]));
 await browser.click('#save-job');const second=await browser.readProject();
 assert.deepEqual(values(second),edited,'HUMAN_JOB_EDIT_VALUES_ORACLE');
 assert.equal(second.projectData.inputVersions.length,first.projectData.inputVersions.length+1,'HUMAN_JOB_APPEND_VERSION_ORACLE');
 assert.deepEqual(second.projectData.inputVersions.slice(0,-1),first.projectData.inputVersions,'HUMAN_JOB_PRESERVE_EARLIER_INPUT_ORACLE');
 // A blank number control is canonical null. Its raw input payload records
 // the entered blank string; the intake manifest hash is a separate identity.
 const secondVersion=assertInputVersion(second,{...edited,DESIRED_SOURCE_COUNT:''},changed);
 assert.notEqual(secondVersion.version,firstVersion.version,'HUMAN_JOB_NEW_VERSION_ORACLE');
 assert.deepEqual(second.projectData.humanDecisions,created.projectData.humanDecisions,'HUMAN_JOB_EDIT_NO_INVENTED_PURPOSE_ORACLE');
 await browser.reload();const secondReload=await browser.readProject();
 assert.deepEqual(values(secondReload),edited,'HUMAN_JOB_EDIT_RELOAD_ORACLE');
 assert.deepEqual(secondReload.projectData.inputVersions,second.projectData.inputVersions,'HUMAN_JOB_EDIT_RELOAD_HISTORY_ORACLE');
 await browser.click('[data-view="Project"]');
 const visible=await browser.evaluate('Object.fromEntries([...document.querySelectorAll("[data-job]")].map(node=>[node.dataset.job,node.value]))');
 for(const field of fields)assert.equal(visible[field],edited[field]===null?'':String(edited[field]),'HUMAN_JOB_RELOADED_CONTROL_ORACLE: '+field);
 await browser.click('#save-job');const noop=await browser.readProject();
 assert.deepEqual(values(noop),edited,'HUMAN_JOB_NOOP_VALUES_ORACLE');
 assert.deepEqual(noop.projectData.inputVersions,secondReload.projectData.inputVersions,'HUMAN_JOB_NOOP_VERSION_ORACLE');
 const result={checkId:'human-job-controls.save-reload',fields:[...fields],firstVersion,secondVersion,normalUiOnly:true,nativeIndexedDbReload:true,appendOnlyInputHistory:true,noOpDoesNotVersion:true,syntheticHuman:true,physicalDevice:false,jobId:noop.job.JOB_ID,passed:true};
 record('All eleven human Job fields preserve exact values and version provenance through normal save/edit/reload',result);return result;
}
