import fs from 'node:fs';
for(const name of fs.readdirSync('.').filter(name=>/^verify.*\.mjs$/.test(name))){
  let s=fs.readFileSync(name,'utf8'),before=s;
  s=s.replaceAll('schema:schema.RESPONSE_SCHEMA,jobId:','schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:');
  s=s.replaceAll('schema:schema.RESPONSE_SCHEMA,\n    jobId:','schema:schema.RESPONSE_SCHEMA,\n    contractProfileId:schema.CONTRACT_PROFILE_ID,\n    jobId:');
  if(s!==before)fs.writeFileSync(name,s);
}
fs.unlinkSync(new URL(import.meta.url));
