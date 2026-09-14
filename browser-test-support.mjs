// Playwright's waitForFunction polls a synchronous predicate. An async
// predicate is a truthy Promise, so it can finish before stored state matches.
// Await each database observation in the test runner and require literal true.
export async function waitForStored(page,predicate,argument,{timeout=90000}={}){
  const end=Date.now()+timeout;let actual;
  do{actual=await page.evaluate(predicate,argument);if(actual===true)return;await page.waitForTimeout(50);}while(Date.now()<end);
  throw new Error('Stored application state did not reach the required condition. Last observation: '+JSON.stringify(actual));
}
