from pathlib import Path
import re
p=Path('verify-prompt-semantics.mjs')
text=p.read_text()

old="const required1=[/job definition and clarification only/i,/authorized human job input/i,/limited intake inspection is Stage 01 job-definition work/i,/do not classify, validate, rank, establish provenance for, or determine authority\\/currency\\/conflicts among supplied materials here/i];"
new="const required1=[/complete human-authority intake/i,/enumerated every current controlled human-input unit/i,/classify every supplied unit exactly once/i];"
if old not in text:
    raise SystemExit('Stage 01 locality required1 anchor missing')
text=text.replace(old,new,1)

start='// stage01-practical-intake-regression-v1\n'
end='\n\n// demonstrated-stage01-output-contract-regression-v2'
a=text.find(start)
b=text.find(end,a)
if a<0 or b<0:
    raise SystemExit('Stage 01 practical-intake fixture block bounds missing')
replacement="""// stage01-subject-neutral-patent-fixture-v3
{
 const p=baseProject();
 p.job.EXACT_USER_OBJECTIVE_VERBATIM='I need a patent application for my project';
 p.job.SUPPLIED_MATERIALS_INVENTORY='MAINFRAME_INVENTION_DISCLOSURE.zip';
 const r=prompts.buildPromptRecord(1,p);
 for(const token of [
  'I need a patent application for my project',
  'MAINFRAME_INVENTION_DISCLOSURE.zip',
  'BLOCKING_NOW',
  'ASK_NOW_NONBLOCKING',
  'LATER_RESOLVABLE',
  'humanInputRequestContract',
  'temporaryKey',
  'whyRequired',
  'affectedStageFields',
  'answerType',
  'allowedValues',
  'Do not invent requestKey, required, whyNeeded, expectedAnswer'
 ])if(!r.prompt.includes(token))throw new Error('Stage 01 subject-neutral patent fixture is missing generic intake behavior or actual fixture context: '+token);
 if(!/classify every supplied unit exactly once/i.test(r.prompt))throw new Error('Stage 01 subject-neutral fixture does not require exactly-once supplied-unit classification.');
 if(!/derive the complete foreseeable set of (?:genuinely )?human-only questions from the actual (?:user|project) request, accessible supplied materials, and current canonical context/i.test(r.prompt))throw new Error('Stage 01 subject-neutral fixture does not derive human-only questions from actual project context.');
 const source=fs.readFileSync('prompt-engine.js','utf8');
 for(const forbidden of ['PATENT / REGULATED FILING','intended jurisdiction(s)','filing route or application type','inventor identity','government funding','joint-research circumstances'])if(source.includes(forbidden))throw new Error('Patent fixture leaked into the runtime prompt engine as a project-subject branch: '+forbidden);
 if(r.prompt.includes('Treat any human-supplied files, links, references, records, or other materials as opaque authorized inputs'))throw new Error('Stage 01 still treats supplied human material as opaque instead of usable intake.');
}
"""
text=text[:a]+replacement+text[b:]

# Actual one-time capture is proven separately by verify-intake-obligation-accounting.mjs,
# which requires originalIntentFileReattachmentRequired=false and an empty Stage 04 intent-file handoff.
# This fixture tests subject-neutral Stage 01 intake behavior without depending on capitalization or one prose sentence.
p.write_text(text)