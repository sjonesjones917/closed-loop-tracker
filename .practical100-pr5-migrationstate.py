from pathlib import Path

# Legacy completion is converted once into current canonical accepted state; legacy records remain audit-only.
p=Path('app-core.js');s=p.read_text()
needle="p.activeStage=raw.currentStage||1;p.activeView='Overview';return ensureState(p);"
insert="""const importedStageOne=raw.stageRecords?.['1']||raw.stageRecords?.[1]||raw.stageStates?.['1']||raw.stageStates?.[1]||{};if(String(importedStageOne.status||'').toUpperCase()==='COMPLETE'){engine.ensureShape(p);const acceptedChangeId=`IMPORTED-STAGE-01-${String(raw.jobId||p.job.JOB_ID)}`,instructionId=`IMPORTED-INSTRUCTION-STAGE-01-${String(raw.jobId||p.job.JOB_ID)}`,contextSignature=globalThis.closedLoopHash.sha256Value({jobId:p.job.JOB_ID,inputVersion:p.job.CURRENT_INPUT_VERSION,stage:1,migration:'human-project/30'}),rawOutput=safe(raw.generatedOutputs).find(x=>Number(x.stage)===1),rawResponseId=rawOutput?.rawResponseId||rawOutput?.outputId||'MIGRATION-ARCHIVE';if(!safe(p.projectData.acceptedChanges).some(x=>x.changeId===acceptedChangeId))p.projectData.acceptedChanges.push({changeId:acceptedChangeId,jobId:p.job.JOB_ID,stage:1,responseType:'DATA_PROPOSAL',status:'COMMITTED',rawResponseId,promptId:instructionId,contextSignature,inputVersion:p.job.CURRENT_INPUT_VERSION,createdAt:raw.dateOpened||new Date().toISOString(),source:'DETERMINISTIC_MIGRATION',migrationSchema:'human-project/30'});p.stages[1].agentData={EXACT_DELIVERABLE_REQUESTED:p.job.EXACT_DELIVERABLE_REQUESTED||'',ASSUMPTIONS:p.job.ASSUMPTIONS||'',UNKNOWN_INFORMATION:p.job.UNKNOWN_INFORMATION||'',INPUT_SET_CONTENTS:p.job.INPUT_SET_CONTENTS||''};p.stages[1].acceptedDataChangeIds=[acceptedChangeId];p.stages[1].acceptedResponseIds=[acceptedChangeId];if(!safe(p.projectData.stageConfirmations).some(x=>x.stage===1&&x.acceptedChangeId===acceptedChangeId&&!x.invalidatedBy))engine.recordStageConfirmation(p,1,true,'Imported historical human confirmation preserved as current canonical Stage 01 authority.','MIGRATION_IMPORT',{acceptedChangeId,inputVersion:p.job.CURRENT_INPUT_VERSION,instructionId,contextSignature,operatorLabel:'MIGRATION_IMPORT'});}p.activeStage=raw.currentStage||1;p.activeView='Overview';return ensureState(p);"""
assert needle in s;s=s.replace(needle,insert,1);p.write_text(s)

# Current gates never read legacy stageRecords.
p=Path('workflow-engine.js');s=p.read_text()
old="""    case 1:{
      const retainedHistorical=project.isRetainedTestProject&&project.stages[1].status==='COMPLETE'&&project.projectData.stageRecords?.[1];
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      if(!retainedHistorical){
        requireAccepted();
        const confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy);
        if(!confirmed)reasons.push('Human confirmation that the represented objective and deliverable match intent is required.');
      }
      break;
    }"""
new="""    case 1:{
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);
      if(!confirmed)reasons.push('Human confirmation bound to the current accepted change and input version is required.');
      break;
    }"""
assert old in s;s=s.replace(old,new,1)
p.write_text(s)
