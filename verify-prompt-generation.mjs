import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const failures=[];
const required=[
  ['Stage 8 generation control','data-generate-production-instruction'],
  ['Stage 9 generation control','data-generate-preflighted-instruction'],
  ['Production prompt field',"area('promptText','Generated production prompt / instruction'"],
  ['Stage 8 generator','function generateProductionInstruction()'],
  ['Stage 9 generator','function generatePreflightedInstruction()'],
  ['Prompt constructor','function buildProductionPrompt('],
  ['Stage 8 hard completion gate','Stage 8 requires an actual generated production prompt.'],
  ['Stage 9 hard completion gate','Stage 9 requires a separately versioned preflighted production prompt.'],
  ['Stage 9 instruction collection',"9:['productionInstructions','preflightReviews']"]
];
for(const [name,needle] of required)if(!html.includes(needle))failures.push(`${name} missing: ${needle}`);
if(failures.length){console.error(JSON.stringify({status:'FAIL',failures},null,2));process.exit(1)}
console.log(JSON.stringify({status:'PASS',stage8PromptGeneration:true,stage9PreflightedPromptGeneration:true,hardCompletionGates:true},null,2));
