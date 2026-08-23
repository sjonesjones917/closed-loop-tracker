const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
for(const file of ['index.html','app.js','workbook.js','TEST_PROJECT.json']){
  const response=await fetch(new URL(file,base),{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const text=await response.text();
  if(!text.length)throw new Error(`${file} is empty`);
}
const project=await (await fetch(new URL('TEST_PROJECT.json',base),{cache:'no-store'})).json();
if(project.schema!=='human-project/30'||Object.keys(project.stageRecords||{}).length!==30)throw new Error('Live test project is not the complete 30-stage job.');
if(!project.userJobInput?.objective?.includes('GEN-042')||!/maintenance handoff/i.test(project.userJobInput.objective))throw new Error('Live test-project identity is wrong.');
if((project.generatedPrompts||[]).length!==30||(project.generatedOutputs||[]).length!==30)throw new Error('Live test project does not expose all stage instructions and outputs.');
console.log('live application files and complete real test project are reachable');