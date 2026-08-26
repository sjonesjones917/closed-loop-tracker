from pathlib import Path
import re
p=Path('workflow-engine.js'); s=p.read_text()
pattern=re.compile(r"    case 22:\{.*?    case 25:\{",re.S)
if len(list(pattern.finditer(s)))!=1: raise SystemExit('Expected exactly one Stage 22-24 gate block.')
new="""    case 22:{
      requireAccepted();
      const mandatoryIds=new Set(mandatoryRequirements(project,currentScope(project)).map(requirementId));
      const expected=recordsForCurrentScope(project,'tests').filter(test=>mandatoryIds.has(testRequirementId(test))&&upper(recordValue(test,'TEST_TYPE'))==='DETERMINISTIC'&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(test,'STATUS')||'READY')));
      const results=recordsForCurrentScope(project,'deterministicResults'),counts=new Map();
      for(const result of results){const id=String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||'');counts.set(id,(counts.get(id)||0)+1);}
      const expectedIds=new Set(expected.map(test=>recordId(test,'tests'))),missing=[...expectedIds].filter(id=>counts.get(id)!==1),unexpected=results.filter(result=>!expectedIds.has(String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||'')));
      if(missing.length)reasons.push('Exactly one deterministic result is required for each applicable deterministic test: '+missing.join(', ')+'.');
      if(unexpected.length)reasons.push('Unexpected deterministic results exist outside the current applicable deterministic-test set.');
      if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A deterministic finished-product verification is violated or undetermined.');
      break;
    }
    case 23:{
      requireAccepted();
      const mandatoryIds=new Set(mandatoryRequirements(project,currentScope(project)).map(requirementId));
      const expected=recordsForCurrentScope(project,'tests').filter(test=>mandatoryIds.has(testRequirementId(test))&&upper(recordValue(test,'TEST_TYPE'))==='MEANING'&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(test,'STATUS')||'READY')));
      const expectedById=new Map(expected.map(test=>[recordId(test,'tests'),test])),expectedIds=new Set(expectedById.keys()),results=recordsForCurrentScope(project,'meaningResults'),counts=new Map();
      for(const result of results){const id=String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||'');counts.set(id,(counts.get(id)||0)+1);}
      const missing=[...expectedIds].filter(id=>counts.get(id)!==1),unexpected=results.filter(result=>!expectedIds.has(String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||''))),mismatched=results.filter(result=>{const test=expectedById.get(String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||''));return test&&String(recordValue(result,'REQ_ID')||result.relationships?.REQ_ID||'')!==testRequirementId(test);});
      if(missing.length)reasons.push('Exactly one meaning review is required for every current applicable meaning test: '+missing.join(', ')+'.');
      if(unexpected.length)reasons.push('Unexpected meaning-review records exist outside the current meaning-test set.');
      if(mismatched.length)reasons.push('A meaning-review requirement identity does not match its controlling Stage 6 test.');
      if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('A meaning verification is violated or undetermined.');
      break;
    }
    case 24:{
      requireAccepted();
      const mandatoryIds=new Set(mandatoryRequirements(project,currentScope(project)).map(requirementId));
      const expectedTests=recordsForCurrentScope(project,'tests').filter(test=>mandatoryIds.has(testRequirementId(test))&&upper(recordValue(test,'TEST_TYPE'))==='ADVERSARIAL'&&!['RETIRED','BLOCKED','NOT READY'].includes(upper(recordValue(test,'STATUS')||'READY')));
      const expectedTestIds=new Set(expectedTests.map(test=>recordId(test,'tests')));
      const expectedRegs=records(project,'regressions').filter(reg=>upper(recordValue(reg,'ACTIVE_RETIRED_STATE')||'ACTIVE')!=='RETIRED'&&upper(recordValue(reg,'APPLICABILITY')||'APPLICABLE')!=='NOT APPLICABLE');
      const expectedRegIds=new Set(expectedRegs.map(reg=>recordId(reg,'regressions'))),results=recordsForCurrentScope(project,'adversarialResults'),testCounts=new Map(),regCounts=new Map();
      for(const result of results){const testId=String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||''),regId=String(recordValue(result,'REG_ID')||result.relationships?.REG_ID||'');if(testId)testCounts.set(testId,(testCounts.get(testId)||0)+1);if(regId)regCounts.set(regId,(regCounts.get(regId)||0)+1);}
      const missingTests=[...expectedTestIds].filter(id=>testCounts.get(id)!==1),missingRegs=[...expectedRegIds].filter(id=>regCounts.get(id)!==1),orphan=results.filter(result=>!String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||'')&&!String(recordValue(result,'REG_ID')||result.relationships?.REG_ID||'')),unexpected=results.filter(result=>{const testId=String(recordValue(result,'TEST_ID')||result.relationships?.TEST_ID||''),regId=String(recordValue(result,'REG_ID')||result.relationships?.REG_ID||'');return (testId&&!expectedTestIds.has(testId))||(regId&&!expectedRegIds.has(regId));});
      if(!expectedTestIds.size)reasons.push('At least one current mandatory adversarial verification test must be defined at Stage 6.');
      if(missingTests.length)reasons.push('Exactly one adversarial result is required for every current applicable adversarial test: '+missingTests.join(', ')+'.');
      if(missingRegs.length)reasons.push('Exactly one adversarial regression challenge is required for every active applicable permanent regression: '+missingRegs.join(', ')+'.');
      if(orphan.length)reasons.push('Every adversarial result must identify the Stage 6 adversarial test or permanent regression it challenges.');
      if(unexpected.length)reasons.push('Unexpected adversarial results exist outside the current required adversarial/regression set.');
      if(results.some(record=>upper(recordValue(record,'DETERMINATION'))!=='SATISFIED'))reasons.push('Adversarial verification found a violated, failed, or undetermined result.');
      break;
    }
    case 25:{"""
s=pattern.sub(new,s,count=1)
p.write_text(s)
