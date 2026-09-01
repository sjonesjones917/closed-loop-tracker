const DEFAULT_COMMAND_TIMEOUT_MS=30000;

function timeoutValue(name,fallback){
  const value=Number(process.env[name]||fallback);
  if(!Number.isSafeInteger(value)||value<1000)throw new Error(`${name} must be an integer of at least 1000 milliseconds.`);
  return value;
}

export function boundedBrowserCommand(promise,label,timeoutMs=timeoutValue('BROWSER_COMMAND_TIMEOUT_MS',DEFAULT_COMMAND_TIMEOUT_MS)){
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} exceeded ${timeoutMs}ms.`)),timeoutMs);});
  return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
}

export async function fetchJsonWithTimeout(url,options={}){
  const timeoutMs=timeoutValue('BROWSER_COMMAND_TIMEOUT_MS',DEFAULT_COMMAND_TIMEOUT_MS),controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error(`Fetch ${url} exceeded ${timeoutMs}ms.`)),timeoutMs);
  try{
    const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal,response=await fetch(url,{...options,signal});
    if(!response.ok)throw new Error(`${url} -> ${response.status}`);
    return response.json();
  }finally{clearTimeout(timer);}
}

function childRunning(child){return child.exitCode===null&&child.signalCode===null;}
function waitForExit(child,timeoutMs){
  if(!childRunning(child))return Promise.resolve();
  return Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,timeoutMs))]);
}

export function guardBrowserProcess(child){
  const forceKill=()=>{if(childRunning(child)){try{child.kill('SIGKILL');}catch{}}};
  const stopForSignal=signal=>{forceKill();process.exit(signal==='SIGINT'?130:143);};
  const onSigint=()=>stopForSignal('SIGINT'),onSigterm=()=>stopForSignal('SIGTERM');
  process.once('SIGINT',onSigint);process.once('SIGTERM',onSigterm);
  let teardownPromise=null;
  return function teardownBrowser(){
    if(teardownPromise)return teardownPromise;
    process.off('SIGINT',onSigint);process.off('SIGTERM',onSigterm);
    teardownPromise=(async()=>{
      if(childRunning(child)){try{child.kill('SIGTERM');}catch{}await waitForExit(child,1000);}
      if(childRunning(child)){forceKill();await waitForExit(child,1500);}
      if(childRunning(child))throw new Error('Chrome did not exit after SIGTERM and SIGKILL teardown.');
    })();
    return teardownPromise;
  };
}
