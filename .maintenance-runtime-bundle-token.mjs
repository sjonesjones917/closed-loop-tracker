import fs from 'node:fs';

function replaceOnce(text,search,replacement,label){
  const first=text.indexOf(search);
  const second=first<0?-1:text.indexOf(search,first+search.length);
  if(first<0)throw new Error(`${label}: expected source text was not found.`);
  if(second>=0)throw new Error(`${label}: expected source text was not unique.`);
  return text.slice(0,first)+replacement+text.slice(first+search.length);
}

{
  const path='index.html';
  const oldToken='runtime-a7f92c6d14b8e301';
  const newToken='runtime-064505bfed79599c';
  let text=fs.readFileSync(path,'utf8');
  const count=text.split(oldToken).length-1;
  if(count!==8)throw new Error(`Expected 8 stale runtime tokens; found ${count}.`);
  text=text.split(oldToken).join(newToken);
  fs.writeFileSync(path,text);
}

{
  const path='verify-prompt-semantics.mjs';
  let text=fs.readFileSync(path,'utf8');
  text=replaceOnce(
    text,
    "  'Never ask for information merely because a later stage will need it',",
    "  'when any of these are foreseeable human-specific inputs for the requested patent outcome and are not already supplied, ask the human for them conversationally during Stage 01',\n  'A later-needed unknown is not by itself a Stage 01 blocker',",
    'Stage 01 practical intake regression');
  fs.writeFileSync(path,text);
}
