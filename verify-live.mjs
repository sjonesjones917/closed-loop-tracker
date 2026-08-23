const base=process.env.PAGE_URL||'http://127.0.0.1:4173/';
for(const file of ['index.html','app.js','workbook.js','TEST_PROJECT.json']){
  const response=await fetch(new URL(file,base),{cache:'no-store'});
  if(!response.ok)throw new Error(`${file} returned ${response.status}`);
  const text=await response.text();
  if(!text.length)throw new Error(`${file} is empty`);
}
const project=await (await fetch(new URL('TEST_PROJECT.json',base),{cache:'no-store'})).json();
if(project.schema!=='closed-loop-project/30'||Object.keys(project.stageRecords||{}).length!==30)throw new Error('Live retained project is not the complete 30-stage ordinary job.');
if(!project.userEntries?.[0]?.objective?.includes('GEN-042'))throw new Error('Live retained project identity is wrong.');
console.log('live application files and retained project are reachable');
