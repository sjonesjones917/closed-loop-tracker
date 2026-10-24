import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createOperatorBrowser} from './operator-browser-driver.mjs';

// A disposable native IndexedDB/Chrome-process control, not application
// acceptance. The minimal document provides only the driver's ready boundary.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'operator-browser-close-'));
const server=http.createServer((_request,response)=>{response.setHeader('content-type','text/html');response.end('<!doctype html><title>Disposable process-closure control</title><main id="app">Synthetic IndexedDB closure control</main><script>globalThis.closedLoopAppReady=true;</script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/',original=path.join(directory,'original'),replay=path.join(directory,'replay');let browser;
try{
 browser=await createOperatorBrowser({url,directory:original});
 const persisted=await browser.evaluate(`new Promise((resolve,reject)=>{const request=indexedDB.open('synthetic-close-control',1);request.onupgradeneeded=()=>request.result.createObjectStore('bytes');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('bytes','readwrite');tx.objectStore('bytes').put(new Uint8Array([0,255,128,13,10]),'sentinel');tx.oncomplete=()=>{db.close();resolve(true);};tx.onabort=()=>reject(tx.error);};})`);assert.equal(persisted,true);
 const closure=await browser.close();browser=null;assert.equal(closure.terminal,true);assert.equal(closure.exitObserved,true);assert.equal(closure.stdioClosed,true);assert.throws(()=>process.kill(closure.pid,0),{code:'ESRCH'});assert.equal(path.resolve(closure.profile),path.join(original,'profile'));assert.ok(closure.browserVersion&&closure.closedAt&&closure.exitedAt);assert.ok(Date.parse(closure.closedAt)>=Date.parse(closure.exitedAt));
 fs.mkdirSync(replay);fs.cpSync(path.join(original,'profile'),path.join(replay,'profile'),{recursive:true,verbatimSymlinks:true});
 for(const name of ['SingletonLock','SingletonCookie','SingletonSocket'])fs.rmSync(path.join(replay,'profile',name),{force:true});
 browser=await createOperatorBrowser({url,directory:replay});
 const actual=await browser.evaluate(`new Promise((resolve,reject)=>{const request=indexedDB.open('synthetic-close-control',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('bytes','readonly'),read=tx.objectStore('bytes').get('sentinel');read.onsuccess=()=>resolve(Array.from(read.result));read.onerror=()=>reject(read.error);tx.oncomplete=()=>db.close();};})`);assert.deepEqual(actual,[0,255,128,13,10]);
 const final=await browser.close();assert.equal(final.stdioClosed,true);assert.equal(final.exitObserved,true);assert.deepEqual(await browser.close(),final);browser=null;assert.throws(()=>process.kill(final.pid,0),{code:'ESRCH'});
 console.log(JSON.stringify({passed:true,synthetic:true,applicationAcceptance:false,actualBrowser:true,browserVersion:closure.browserVersion,cases:['owned-process-terminal-before-copy','committed-indexeddb-bytes-survive-profile-reopen','repeated-close-preserves-terminal-identity']}));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});}
