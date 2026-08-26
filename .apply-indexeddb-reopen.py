from pathlib import Path
import hashlib,re
p=Path('project-store.js');s=p.read_text()
old="""let databasePromise=null;
function openDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(Object.assign(new Error('IndexedDB is required by the supported browser contract.'),{code:'INDEXEDDB_REQUIRED'}));
  if(databasePromise)return databasePromise;
  databasePromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'jobId'});if(!db.objectStoreNames.contains(ARTIFACTS))db.createObjectStore(ARTIFACTS,{keyPath:'artifactId'});if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB open failed.'));req.onblocked=()=>reject(Object.assign(new Error('IndexedDB upgrade is blocked by another tab.'),{code:'INDEXEDDB_BLOCKED'}));
  });
  return databasePromise;
}"""
new="""let databasePromise=null,databaseConnection=null;
function invalidateDatabase(db){if(databaseConnection===db){databaseConnection=null;databasePromise=null;}}
function openDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(Object.assign(new Error('IndexedDB is required by the supported browser contract.'),{code:'INDEXEDDB_REQUIRED'}));
  if(databaseConnection)return Promise.resolve(databaseConnection);
  if(databasePromise)return databasePromise;
  let opening=null;
  opening=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(PROJECTS))db.createObjectStore(PROJECTS,{keyPath:'jobId'});if(!db.objectStoreNames.contains(ARTIFACTS))db.createObjectStore(ARTIFACTS,{keyPath:'artifactId'});if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'});};
    req.onsuccess=()=>{const db=req.result;databaseConnection=db;db.onversionchange=()=>{invalidateDatabase(db);try{db.close();}catch{}};db.onclose=()=>invalidateDatabase(db);resolve(db);};
    req.onerror=()=>{if(databasePromise===opening)databasePromise=null;reject(req.error||new Error('IndexedDB open failed.'));};
    req.onblocked=()=>{if(databasePromise===opening)databasePromise=null;reject(Object.assign(new Error('IndexedDB upgrade is blocked by another tab.'),{code:'INDEXEDDB_BLOCKED'}));};
  });
  databasePromise=opening;
  return opening;
}"""
if s.count(old)!=1: raise SystemExit(f'project-store anchor count={s.count(old)}')
p.write_text(s.replace(old,new,1))
runtime=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def gitblob(path):
 b=Path(path).read_bytes();return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
manifest=''.join(f'{f}:{gitblob(f)}\n' for f in runtime).encode();token='runtime-'+hashlib.sha256(manifest).hexdigest()[:16]
q=Path('index.html');html=q.read_text();html,n=re.subn(r'(src="(?:workbook|hash|workflow-schema|workflow-engine|prompt-engine|response-ingestion|project-store|app-core)\.js\?v=)runtime-[a-f0-9]{16}(\")',rf'\g<1>{token}\2',html)
if n!=8: raise SystemExit(f'expected 8 runtime token replacements, got {n}')
q.write_text(html)
