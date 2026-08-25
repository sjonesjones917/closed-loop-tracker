from pathlib import Path
import re

p=Path('project-store.js');s=p.read_text()
marker='function clearLegacy(storage=globalThis.localStorage){'
assert marker in s
helper="function archiveMigrationPayload(project,archive){if(!project||typeof project!=='object')throw new TypeError('A project is required.');project.projectData=project.projectData&&typeof project.projectData==='object'?project.projectData:{};project.projectData.migrationArchives=Array.isArray(project.projectData.migrationArchives)?project.projectData.migrationArchives:[];const record={...clone(archive),operational:false};project.projectData.migrationArchives.push(record);return record;}\n"
if 'function archiveMigrationPayload(' not in s:s=s.replace(marker,helper+marker,1)
match=re.search(r"globalThis\.closedLoopProjectStore=Object\.freeze\(\{(.*?)\}\);",s,re.S)
assert match
body=match.group(1)
if 'archiveMigrationPayload' not in body:body='archiveMigrationPayload,'+body
s=s[:match.start(1)]+body+s[match.end(1):]
p.write_text(s)

p=Path('workflow-engine.js');s=p.read_text()
marker='function registerGeneratedPrompt(project,promptRecord){'
assert marker in s
helper=r'''function recordMigratedAcceptedChange(project,record){ensureShape(project);if(!record?.changeId)throw new Error('A migrated accepted change requires an identity.');const existing=safe(project.projectData.acceptedChanges).find(x=>x.changeId===record.changeId);if(existing)return existing;const value={...clone(record),source:'DETERMINISTIC_MIGRATION'};project.projectData.acceptedChanges.push(value);addHistory(project,'MIGRATED_ACCEPTED_CHANGE_RECORDED',{stage:Number(value.stage),recordId:value.changeId,migrationSchema:value.migrationSchema||'UNKNOWN'});return value;}

'''
if 'function recordMigratedAcceptedChange(' not in s:s=s.replace(marker,helper+marker,1)
match=re.search(r"globalThis\.closedLoopWorkflowEngine=Object\.freeze\(\{(.*?)\}\);",s,re.S)
assert match
body=match.group(1)
if 'recordMigratedAcceptedChange' not in body:body='recordMigratedAcceptedChange,'+body
s=s[:match.start(1)]+body+s[match.end(1):]
p.write_text(s)

p=Path('app-core.js');s=p.read_text()
s=s.replace("p.projectData.migrationArchives=safe(p.projectData.migrationArchives);p.projectData.migrationArchives.push({kind:'ORIGINAL_IMPORT_PAYLOAD',operational:false,payload:clone(raw)});","projectStore.archiveMigrationPayload(p,{kind:'ORIGINAL_IMPORT_PAYLOAD',payload:clone(raw)});",1)
s=s.replace("if(r.status==='COMPLETE'||Object.keys(r).some(k=>k!=='status'))p.projectData.migrationArchives.push({kind:'LEGACY_STAGE_RECORD',stage:n,operational:false,payload:clone(r)});","if(r.status==='COMPLETE'||Object.keys(r).some(k=>k!=='status'))projectStore.archiveMigrationPayload(p,{kind:'LEGACY_STAGE_RECORD',stage:n,payload:clone(r)});",1)
old=re.search(r"if\(!safe\(p\.projectData\.acceptedChanges\)\.some\(x=>x\.changeId===acceptedChangeId\)\)p\.projectData\.acceptedChanges\.push\(\{changeId:acceptedChangeId,.*?migrationSchema:'human-project/30'\}\);",s,re.S)
if old:
    record=old.group(0)
    inside=record[record.index('push({')+5:-2]
    s=s[:old.start()]+f"engine.recordMigratedAcceptedChange(p,{inside});"+s[old.end():]
remaining=re.findall(r"projectData(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])\.push\s*\(",s)
assert not remaining, f'Direct projectData pushes remain in app-core.js: {remaining}'
p.write_text(s)
