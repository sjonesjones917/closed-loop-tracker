from pathlib import Path

p=Path('workbook.js'); s=p.read_text()
s=s.replace("2:['SOURCE_SET_VERSION','AUTHORITY_HIERARCHY','SOURCE_RECORDS','SOURCE_CONFLICT_RECORDS','KNOWN_CONTROLLING_SOURCES_EXAMINED','UNRESOLVED_CONTROLLING_CONFLICTS','STAGE_DECISION','DECISION_EVIDENCE']", "2:['SOURCE_SET_VERSION','AUTHORITY_HIERARCHY','SOURCE_RECORDS','SOURCE_CONFLICT_RECORDS','KNOWN_CONTROLLING_SOURCES_EXAMINED','EXTERNAL_SOURCE_APPLICABILITY_DETERMINATION','NO_APPLICABLE_EXTERNAL_SOURCE_EVIDENCE','UNRESOLVED_CONTROLLING_CONFLICTS','STAGE_DECISION','DECISION_EVIDENCE']")
s=s.replace('"KNOWN_CONTROLLING_SOURCES_EXAMINED"\n    ],', '"KNOWN_CONTROLLING_SOURCES_EXAMINED",\n      "EXTERNAL_SOURCE_APPLICABILITY_DETERMINATION",\n      "NO_APPLICABLE_EXTERNAL_SOURCE_EVIDENCE"\n    ],',1)
p.write_text(s)

p=Path('workflow-schema.js'); s=p.read_text()
old='"2":{"AUTHORITY_HIERARCHY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE"'
new='"2":{"AUTHORITY_HIERARCHY":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"EXTERNAL_SOURCE_APPLICABILITY_DETERMINATION":{"closedProperties":null,"enumValues":["APPLICABLE_EXTERNAL_SOURCES_FOUND","NO_APPLICABLE_EXTERNAL_SOURCE"],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"NO_APPLICABLE_EXTERNAL_SOURCE_EVIDENCE":{"closedProperties":null,"enumValues":[],"normalizerKey":null,"nullable":false,"valueType":"STRING"},"DECISION_EVIDENCE"'
assert old in s
p.write_text(s.replace(old,new,1))

p=Path('workflow-engine.js'); s=p.read_text()
old="""    case 2:
      requireAccepted();requireCount('sources',1,'At least one inspected independent external governing source is required.');
      for(const source of collection('sources'))reasons.push(...schema.sourceClassificationIssues(recordFields(source)).map(issue=>`${recordId(source,'sources')}: ${issue}`));
      if(collection('sourceConflicts').some(record=>['UNRESOLVED','BLOCKED','UNKNOWN','OPEN'].includes(upper(recordValue(record,'RESOLUTION_STATUS')))))reasons.push('An external-source conflict remains unresolved or blocked.');
      break;
    case 3:{
      requireAccepted();requireCount('research',1);
      const sourceIds=all('sources').map(record=>recordId(record,'sources'));
      const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')));
      const missing=sourceIds.filter(id=>!researched.has(id));
      if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);
      break;
    }"""
new="""    case 2:{
      requireAccepted();const stageData=project.stages[2]?.agentData||{};const applicability=upper(stageData.EXTERNAL_SOURCE_APPLICABILITY_DETERMINATION);const noSource=applicability==='NO_APPLICABLE_EXTERNAL_SOURCE';
      if(noSource){if(collection('sources').length)reasons.push('A no-applicable-source determination cannot coexist with current external source records.');if(!String(stageData.NO_APPLICABLE_EXTERNAL_SOURCE_EVIDENCE||'').trim())reasons.push('Evidence is required for NO_APPLICABLE_EXTERNAL_SOURCE.');}
      else requireCount('sources',1,'At least one inspected independent external governing source is required unless NO_APPLICABLE_EXTERNAL_SOURCE is established with evidence.');
      for(const source of collection('sources'))reasons.push(...schema.sourceClassificationIssues(recordFields(source)).map(issue=>`${recordId(source,'sources')}: ${issue}`));
      if(collection('sourceConflicts').some(record=>['UNRESOLVED','BLOCKED','UNKNOWN','OPEN'].includes(upper(recordValue(record,'RESOLUTION_STATUS')))))reasons.push('An external-source conflict remains unresolved or blocked.');
      break;
    }
    case 3:{
      requireAccepted();const stage2Data=project.stages[2]?.agentData||{};const noSource=upper(stage2Data.EXTERNAL_SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE';
      const sourceIds=all('sources').map(record=>recordId(record,'sources'));
      if(!noSource)requireCount('research',1);
      if(noSource&&sourceIds.length)reasons.push('Stage 02 no-source determination conflicts with current source records.');
      const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||'')));
      const missing=sourceIds.filter(id=>!researched.has(id));
      if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);
      break;
    }"""
assert old in s
p.write_text(s.replace(old,new,1))

p=Path('verify-complete.mjs'); s=p.read_text()
anchor='// Explicit workflow gates cannot be bypassed by manual assertions.\n'
insert="""// Stage 02/03 support an evidence-backed no-applicable-external-source path without fabricating authority.\n{\n  const p=project('JOB-NO-EXTERNAL-SOURCE');p.job.EXACT_USER_OBJECTIVE_VERBATIM='Create a self-contained fictional poem.';p.stages[1].status='COMPLETE';\n  p.projectData.acceptedChanges.push({changeId:'CHANGE-NOSOURCE-2',stage:2,status:'COMMITTED',responseType:'DATA_PROPOSAL'});p.stages[2].agentData={EXTERNAL_SOURCE_APPLICABILITY_DETERMINATION:'NO_APPLICABLE_EXTERNAL_SOURCE',NO_APPLICABLE_EXTERNAL_SOURCE_EVIDENCE:'The requested creative work has no external governing authority.'};\n  assert(engine.gate(2,p).complete,'Evidence-backed Stage 02 no-source determination was rejected.');p.stages[2].status='COMPLETE';\n  p.projectData.acceptedChanges.push({changeId:'CHANGE-NOSOURCE-3',stage:3,status:'COMMITTED',responseType:'DATA_PROPOSAL'});assert(engine.gate(3,p).complete,'Stage 03 forced fabricated research after a valid no-source determination.');\n  p.stages[2].agentData.NO_APPLICABLE_EXTERNAL_SOURCE_EVIDENCE='';assert(!engine.gate(2,p).complete,'No-source determination was accepted without evidence.');\n}\n\n"""
assert anchor in s
p.write_text(s.replace(anchor,insert+anchor,1))
