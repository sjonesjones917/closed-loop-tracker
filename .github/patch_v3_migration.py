from pathlib import Path
p=Path('workbook.js'); s=p.read_text()
anchor="  if(p.schema!=='human-project/30')throw new Error(`Unsupported project schema: ${p.schema||'MISSING'}`);"
if "p.schema==='closed-loop-project/2'" not in s:
    if anchor not in s: raise SystemExit('migration anchor missing')
    block="""  if(p.schema==='closed-loop-project/2'&&p.workflow===WORKFLOW_ID&&Number(p.stageCount)===STAGE_COUNT){
    const migrated=JSON.parse(JSON.stringify(p));
    const original=JSON.parse(JSON.stringify(p));
    migrated.schema=PROJECT_SCHEMA;migrated.workflow=WORKFLOW_ID;migrated.stageCount=STAGE_COUNT;migrated.revision=Number.isInteger(migrated.revision)?migrated.revision:0;
    migrated.projectData=migrated.projectData&&typeof migrated.projectData==='object'?migrated.projectData:{};
    migrated.projectData.migrationArchives=Array.isArray(migrated.projectData.migrationArchives)?migrated.projectData.migrationArchives:[];
    migrated.projectData.historicalImportRecords=Array.isArray(migrated.projectData.historicalImportRecords)?migrated.projectData.historicalImportRecords:[];
    migrated.projectData.migrationArchives.push({kind:'MIGRATION_SOURCE',schema:'closed-loop-project/2',preservedAt:new Date().toISOString(),payload:original});
    if(migrated.projectData.stageRecords&&Object.keys(migrated.projectData.stageRecords).length){migrated.projectData.historicalImportRecords.push({kind:'LEGACY_STAGE_RECORDS',schema:'closed-loop-project/2',records:JSON.parse(JSON.stringify(migrated.projectData.stageRecords))});migrated.projectData.stageRecords={};}
    if(migrated.projectData.fullProject&&Object.keys(migrated.projectData.fullProject).length){migrated.projectData.migrationArchives.push({kind:'LEGACY_NESTED_PROJECT',schema:'closed-loop-project/2',preservedAt:new Date().toISOString(),payload:JSON.parse(JSON.stringify(migrated.projectData.fullProject))});delete migrated.projectData.fullProject;}
    for(const prompt of Array.isArray(migrated.projectData.generatedPrompts)?migrated.projectData.generatedPrompts:[])if(!prompt.invalidatedBy)prompt.invalidatedBy='PROJECT_SCHEMA_MIGRATED_TO_V3';
    for(const proposal of Array.isArray(migrated.projectData.responseProposals)?migrated.projectData.responseProposals:[])if(!proposal.invalidatedBy&&String(proposal.status||'').startsWith('PENDING')){proposal.invalidatedBy='PROJECT_SCHEMA_MIGRATED_TO_V3';proposal.status='STALE';}
    if(!migrated.stages||Object.keys(migrated.stages).length!==STAGE_COUNT)throw new Error('Project /2 to /3 migration requires exactly 30 stages.');
    return migrated;
  }
"""
    s=s.replace(anchor,block+anchor,1)
p.write_text(s)
Path('verify-v3-migration.mjs').write_text(r'''import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync('workbook.js','utf8');const sandbox={console,crypto:globalThis.crypto,TextEncoder,Event:class Event{constructor(type){this.type=type}},dispatchEvent(){},structuredClone:globalThis.structuredClone};sandbox.globalThis=sandbox;vm.runInNewContext(code,sandbox);
const c=sandbox.closedLoopCore;const old=c.createBlankState('JOB-MIGRATION');old.schema='closed-loop-project/2';old.projectData.rawResponses=[{id:'RAW-OLD',schema:'closed-loop-stage-response/2'}];old.projectData.responseProposals=[{proposalId:'P-OLD',status:'PENDING_OPERATOR_REVIEW'}];old.projectData.generatedPrompts=[{promptId:'PROMPT-OLD'}];old.projectData.artifacts=[{id:'ART-OLD',fields:{ARTIFACT_ID:'ART-OLD'}}];
const m=c.migrateState(old);if(m.schema!=='closed-loop-project/3')throw new Error('migration did not produce /3');if(m.stages==null||Object.keys(m.stages).length!==30)throw new Error('stage count lost');if(!m.projectData.rawResponses.some(x=>x.id==='RAW-OLD'))throw new Error('raw response lost');if(!m.projectData.artifacts.some(x=>x.id==='ART-OLD'))throw new Error('artifact identity lost');if(!m.projectData.migrationArchives.some(x=>x.schema==='closed-loop-project/2'))throw new Error('original payload not archived');if(!m.projectData.generatedPrompts[0].invalidatedBy)throw new Error('old prompt remained current');if(m.projectData.responseProposals[0].status!=='STALE')throw new Error('old pending proposal remained current');console.log('verify-v3-migration: PASS');
''')
print('patch_v3_migration: complete')
