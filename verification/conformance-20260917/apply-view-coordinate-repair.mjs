import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const digest=text=>createHash('sha256').update(text).digest('hex');
const repairs=[
 {path:'app-core.js',before:'63afb14670ce5414acb6b9b5eec526848f2021934089e7db111852cb17db6bcf',after:'36c8fde670bc96e5b5aaac4265cd1a338122f8123b22ed3c2ebc357f696558db',replacements:[
  ['function render(){if(!current)return;',"let renderedViewIdentity=null;\nfunction render(){if(!current)return;const viewIdentity=JSON.stringify([current.job.JOB_ID,current.activeView,current.activeStage]);const enteringView=renderedViewIdentity!==viewIdentity;renderedViewIdentity=viewIdentity;"],
  ["updateStageHelp();wire();wireDetails();paintOperatorAction();document.dispatchEvent(new Event('closed-loop-rendered'));}","updateStageHelp();wire();wireDetails();paintOperatorAction();if(enteringView&&!restoringHistory)window.scrollTo(0,0);document.dispatchEvent(new Event('closed-loop-rendered'));}"]
 ]},
 {path:'test-project-store-runtime.mjs',before:'0429d7268f0cb5667df57111378714796a52c625a50b5a2aab646efd7aeb2de0',after:'98507e273360fcdfd2abde4ca3cbece5b2b0a1e625b665800a1d2c925f7983da',replacements:[['atob,setTimeout,queueMicrotask','atob,setTimeout,clearTimeout,queueMicrotask']]}
];
const prepared=repairs.map(repair=>{let text=fs.readFileSync(repair.path,'utf8');assert.equal(digest(text),repair.before,`${repair.path}: source changed; do not overwrite independent work`);for(const [before,after]of repair.replacements){assert.equal(text.split(before).length-1,1,`${repair.path}: ambiguous repair anchor`);text=text.replace(before,after);}assert.equal(digest(text),repair.after,`${repair.path}: unexpected corrected bytes`);return {...repair,text};});
for(const repair of prepared)fs.writeFileSync(repair.path,repair.text);
console.log(JSON.stringify({schema:'closed-loop-authored-repair/1',requirements:['VIEW-COORDINATE-TRANSITION','HISTORY-VM-TIMER-DEPENDENCIES'],changes:prepared.map(({path,before,after})=>({path,before,after})),contractTextModified:false,visualCssModified:false,verificationRequired:true},null,2));
