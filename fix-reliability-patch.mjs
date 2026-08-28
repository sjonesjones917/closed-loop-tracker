import fs from 'node:fs';
const path='apply-reliability-patch.mjs';
let source=fs.readFileSync(path,'utf8');

const broken="},id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields};chains.push(fields);chains[chains.length-1]={id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields};";
const repaired="};chains.push({id:fields.CHAIN_ID,stage:29,active:true,scope:currentScope(project),fields:{...fields},...fields});";
if(!source.includes(broken))throw new Error('Expected evidence-chain patch-generator defect was not found.');
source=source.replace(broken,repaired);

function encodeRawTemplate(callMarker,endAnchor){
  const callStart=source.indexOf(callMarker);
  if(callStart<0)throw new Error(`Missing embedded-test call marker: ${callMarker}`);
  const rawStart=source.indexOf('String.raw`',callStart);
  if(rawStart<0)throw new Error(`Missing raw template after: ${callMarker}`);
  const bodyStart=rawStart+'String.raw`'.length;
  const anchorStart=source.indexOf(endAnchor,bodyStart);
  if(anchorStart<0)throw new Error(`Missing embedded-test end anchor: ${endAnchor}`);
  const closingBacktick=anchorStart+1;
  if(source[closingBacktick]!=='`')throw new Error(`Expected closing raw-template backtick for: ${callMarker}`);
  const body=source.slice(bodyStart,closingBacktick);
  source=source.slice(0,rawStart)+JSON.stringify(body)+source.slice(closingBacktick+1);
}

encodeRawTemplate("complete=appendOnce(complete,'deterministicReliabilityRouting:true'","\n`);\nwrite('verify-complete.mjs',complete);");
encodeRawTemplate("semantics=appendOnce(semantics,'contextLeakageRegression:true'","\n`);\nwrite('verify-prompt-semantics.mjs',semantics);");

const executionBlockNeedle="`const APPLICATION_TEST_EXECUTORS=Object.freeze({});\\n\\n${sourceOf(applicationTestCapabilities";
const executionActions="const TEST_EXECUTION_ACTIONS=Object.freeze({APPLICATION_DETERMINISTIC:'No operator execution is required only when the exact REQUIRED_CAPABILITY names a registered application-native test executor.',EXTERNAL_AGENT_TOOL:'Use a capable external agent/tool environment.',INDEPENDENT_AGENT_REVIEW:'Use a fresh independent reviewer context.',HUMAN_INSPECTION:'Perform the irreducible human inspection.',EXTERNAL_SYSTEM:'Use the declared external system and preserve its evidence.',UNAVAILABLE:'The required capability is unavailable and remains blocking.'});";
const executionBlockReplacement="`const APPLICATION_TEST_EXECUTORS=Object.freeze({});\\n"+executionActions+"\\n\\n${sourceOf(applicationTestCapabilities";
if(!source.includes(executionBlockNeedle))throw new Error('Expected execution-plan replacement template was not found.');
source=source.replace(executionBlockNeedle,executionBlockReplacement);

const overStrictCustody="verified=artifacts.filter(item=>upper(recordValue(item,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED'&&Number(recordValue(item,'BYTE_SIZE'))>=0&&/^[a-f0-9]{64}$/i.test(String(recordValue(item,'SHA256')||'')))";
const canonicalCustody="verified=artifacts.filter(item=>upper(recordValue(item,'AVAILABILITY'))==='BYTES_PERSISTED_AND_VERIFIED')";
if(!source.includes(overStrictCustody))throw new Error('Expected over-strict execution-routing custody predicate was not found.');
source=source.replace(overStrictCustody,canonicalCustody);

const enrichedItemNeedle="requiredArtifactIds:artifact.artifactIds,requiredArtifactNames";
const compatibleItem="artifactRequirements:artifact.artifactRequirements,evidenceIds:artifact.evidenceIds,artifactIds:artifact.artifactIds,requiredArtifactIds:artifact.artifactIds,requiredArtifactNames";
if(!source.includes(enrichedItemNeedle))throw new Error('Expected enriched execution-plan item shape was not found.');
source=source.replace(enrichedItemNeedle,compatibleItem);

fs.writeFileSync(path,source);
console.log('Patch generator repaired with additive execution-plan compatibility aliases.');
