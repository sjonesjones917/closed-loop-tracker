import fs from 'node:fs';
const path='.closed-loop-native-test-repair.mjs';
let s=fs.readFileSync(path,'utf8');
const anchor="console.log('Applied subject-neutral native Test IR and operator execution controls.');";
if(!s.includes(anchor))throw new Error('Repair script completion anchor is missing.');
const block=String.raw`
// Preserve the semantic regression suite while replacing obsolete pre-native assumptions with positive native-executor proof.
{
  const path='verify-prompt-semantics.mjs';let s=read(path);
  s=replaceOnce(s,
\` for(const field of ['EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS'])if(!test.fields.includes(field)||!test.required.includes(field)||test.fieldDefinitions[field]?.producer!==schema.PRODUCER.AGENT)throw new Error(\\\`TEST execution contract is missing agent field \\${field}.\\\`);\`,
\` for(const field of ['EXECUTION_MODE','REQUIRED_CAPABILITY','ARTIFACT_REQUIREMENTS'])if(!test.fields.includes(field)||!test.required.includes(field)||test.fieldDefinitions[field]?.producer!==schema.PRODUCER.AGENT)throw new Error(\\\`TEST execution contract is missing required agent field \\${field}.\\\`); for(const field of ['EXECUTABLE_KIND','EXECUTABLE_SPEC_VERSION','EXECUTABLE_SPEC','EXECUTABLE_INPUT_BINDINGS'])if(!test.fields.includes(field)||test.fieldDefinitions[field]?.producer!==schema.PRODUCER.AGENT)throw new Error(\\\`TEST native execution contract is missing agent field \\${field}.\\\`);\`,'semantic native TEST fields');
  s=replaceOnce(s,
\` if(engine.applicationTestCapabilities().length!==0)throw new Error('A native test capability was registered without a proven application executor test in this patch.');\`,
\` const nativeCapabilities=engine.applicationTestCapabilities();if(JSON.stringify(nativeCapabilities)!==JSON.stringify(['CLOSED_LOOP_TEST_IR_V1']))throw new Error('The application-native capability registry contains an unproven or unexpected executor: '+JSON.stringify(nativeCapabilities));if(!engine.applicationTestIrContract||engine.applicationTestIrContract().version!=='closed-loop-test-spec/1')throw new Error('The registered native capability does not expose the proven Test IR contract.');\`,'semantic native capability proof');
  s=replaceOnce(s,
\` if(!ui.includes('Invalid application executor claim')||!ui.includes('No registered application-native executor exists'))throw new Error('Operator UI does not fail unsupported application-native test claims closed.');\`,
\` if(!ui.includes('Verification is blocked')||!ui.includes('application-native tests')||!ui.includes('Run automatic verification'))throw new Error('Operator UI does not distinguish runnable native verification from blocked invalid native execution.');\`,'semantic native operator safety');
  write(path,s);
}

${anchor}`;
s=s.replace(anchor,block);
fs.writeFileSync(path,s);
