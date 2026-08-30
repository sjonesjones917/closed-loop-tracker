from pathlib import Path
p=Path('tools/apply-exhaustive-intake-patch.py')
s=p.read_text()
start=s.index('old="""case 1:{')
end=s.index("p.write_text(s)", start)+len("p.write_text(s)")
replacement=r'''new_case1="""case 1:{
      if(!String(project.job.CURRENT_INPUT_VERSION||'').trim())reasons.push('A current User Job Input version is required.');
      if(!String(project.job.EXACT_USER_OBJECTIVE_VERBATIM||'').trim())reasons.push('Verbatim User Job Input is required.');
      requireAccepted();
      for(const name of ['EXACT_DELIVERABLE_REQUESTED','ASSUMPTIONS','UNKNOWN_INFORMATION','INPUT_SET_CONTENTS'])if(project.job[name]===undefined||project.job[name]===null||String(project.job[name]).trim()==='')reasons.push(`Stage 01 required field ${name} is missing.`);
      const accounting=evaluateIntakeCoverage(project,project.job.INPUT_SET_CONTENTS);if(!accounting.complete)reasons.push(...accounting.errors);
      if(unresolvedHumanRequests(project,1).length)reasons.push('Stage 01 has unresolved blocking human-authority questions.');
      const latest=changes.at(-1),confirmed=safe(project.projectData.stageConfirmations).some(item=>Number(item.stage)===1&&item.confirmed===true&&!item.invalidatedBy&&item.acceptedChangeId===latest?.changeId&&item.inputVersion===project.job.CURRENT_INPUT_VERSION);
      if(!confirmed)reasons.push('Human confirmation bound to the current accepted change and input version is required.');
      break;
    }"""
new_case3="""case 3:{
      requireAccepted();const sourceIds=all('sources').map(record=>recordId(record,'sources')),noSource=upper(project.stages[2]?.agentData?.SOURCE_APPLICABILITY_DETERMINATION)==='NO_APPLICABLE_EXTERNAL_SOURCE',data=project.stages[3]?.agentData||{};
      if(!sourceIds.length&&!noSource)reasons.push('Stage 03 cannot proceed without a current Stage 02 source set or valid no-source determination.');
      if(sourceIds.length){requireCount('research',1);const researched=new Set(collection('research').map(record=>String(recordValue(record,'SOURCE_ID')||record.relationships?.SOURCE_ID||''))),missing=sourceIds.filter(id=>!researched.has(id));if(missing.length)reasons.push(`Research is missing for source(s): ${missing.join(', ')}.`);if(!truth(data.ALL_KNOWN_CONTROLLING_SOURCES_EXAMINED))reasons.push('Stage 03 has not established that all known controlling sources were examined.');if(!truth(data.SECOND_CONFLICT_AND_EXCEPTION_PASS_COMPLETED))reasons.push('Stage 03 second conflict and exception pass is not complete.');if(numeric(data.LATEST_PASS_NUMBER)<2)reasons.push('Stage 03 requires at least two documented research passes when applicable sources exist.');if(!falsey(data.NEW_MATERIAL_CATEGORY_FOUND_IN_LATEST_PASS))reasons.push('Stage 03 latest pass still found a new material category; research is not exhausted.');}
      const gaps=String(data.RESEARCH_GAPS_AND_BLOCKERS||'').trim();if(gaps&&!['NONE','NOT APPLICABLE','N/A'].includes(upper(gaps)))reasons.push('Stage 03 research gaps or blockers remain unresolved.');
      break;
    }"""
gate_anchor=s.index('const requireAccepted=')
switch_pos=s.index('switch(stage){',gate_anchor)
case1=s.index('case 1:{',switch_pos)
case2=s.index('case 2:',case1)
s=s[:case1]+new_case1+'\n    '+s[case2:]
gate_anchor=s.index('const requireAccepted=')
switch_pos=s.index('switch(stage){',gate_anchor)
case3=s.index('case 3:{',switch_pos)
case4=s.index('case 4:',case3)
s=s[:case3]+new_case3+'\n    '+s[case4:]
p.write_text(s)'''
s=s[:start]+replacement+s[end:]
p.write_text(s)
print('Converted Stage 1 and Stage 3 patching to structural switch-case replacement.')
