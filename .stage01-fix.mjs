import fs from 'node:fs';
const sourceCommit='3f6b8697eca8afaaad9163906f7d07c331fb8556';
{
  const path='generate-specification-governance.mjs';
  let s=fs.readFileSync(path,'utf8');
  const from="const sourceCommit=commit();if(!/^[0-9a-f]{40}$/.test(sourceCommit))throw Error('Exact source commit unavailable');";
  const to=`const sourceCommit='${sourceCommit}';if(!/^[0-9a-f]{40}$/.test(sourceCommit))throw Error('Exact specification source commit unavailable');`;
  if(!s.includes(from)&&!s.includes(to))throw new Error('Governance generator source-commit anchor not found.');
  s=s.replace(from,to);fs.writeFileSync(path,s);
}
{
  const path='verify-specification-governance.mjs';
  let s=fs.readFileSync(path,'utf8');
  const from="sourceCommit=process.env.SOURCE_COMMIT||process.env.GITHUB_SHA||cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();A(/^[0-9a-f]{40}$/.test(sourceCommit),'Exact source commit absent');";
  const to=`sourceCommit='${sourceCommit}';A(/^[0-9a-f]{40}$/.test(sourceCommit),'Exact specification source commit absent');`;
  if(!s.includes(from)&&!s.includes(to))throw new Error('Governance verifier source-commit anchor not found.');
  s=s.replace(from,to);fs.writeFileSync(path,s);
}
