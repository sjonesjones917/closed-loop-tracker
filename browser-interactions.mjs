// Test-only browser interaction authority. A DOM click can activate a hidden
// control; operator verification must use a visible, unobstructed hit target.
import assert from 'node:assert/strict';

async function evaluate(cdp,expression){
  const result=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result?.value;
}
async function pointFor(cdp,selector){
  return evaluate(cdp,`(async()=>{
    const node=document.querySelector(${JSON.stringify(selector)});
    if(!node||!node.isConnected)return {error:'MISSING_CONTROL'};
    if(node.matches(':disabled')||node.closest('[inert]')||node.getAttribute('aria-disabled')==='true')return {error:'DISABLED_CONTROL'};
    const closed=[];
    for(let parent=node.parentElement;parent;parent=parent.parentElement){
      if(parent.tagName==='DETAILS'&&!parent.open&&!parent.querySelector(':scope > summary')?.contains(node))closed.push(parent);
    }
    if(closed.length){
      const summary=closed.at(-1).querySelector(':scope > summary');
      if(!summary)return {error:'INACCESSIBLE_DISCLOSURE'};
      const parts=[];for(let n=summary;n&&n.nodeType===1;n=n.parentElement){
        if(n.id){parts.unshift('#'+CSS.escape(n.id));break;}
        parts.unshift(n.tagName.toLowerCase()+':nth-child('+([...(n.parentElement?.children||[])].indexOf(n)+1)+')');
      }
      return {disclosure:parts.join(' > ')};
    }
    for(let parent=node;parent;parent=parent.parentElement){
      const style=getComputedStyle(parent);
      if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return {error:'HIDDEN_CONTROL'};
    }
    node.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(!node.isConnected)return {error:'CONTROL_CHANGED'};
    const r=node.getBoundingClientRect();
    const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
    if(right<=left||bottom<=top)return {error:'HIDDEN_CONTROL'};
    for(const [dx,dy] of [[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75]]){
      const x=left+(right-left)*dx,y=top+(bottom-top)*dy,hit=document.elementFromPoint(x,y);
      if(hit&&(hit===node||node.contains(hit)))return {x,y};
    }
    return {error:'OBSTRUCTED_CONTROL'};
  })()`);
}
async function pointer(cdp,point){
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y});
}
export async function visibleControl(cdp,selector){
  const opened=new Set();
  for(;;){
    const point=await pointFor(cdp,selector);
    assert.ok(point&&!point.error,`${point?.error||'CONTROL_UNAVAILABLE'}: ${selector}`);
    if(!point.disclosure)return point;
    assert.ok(!opened.has(point.disclosure),`DISCLOSURE_DID_NOT_OPEN: ${selector}`);
    opened.add(point.disclosure);
    await pointer(cdp,await visibleControl(cdp,point.disclosure));
  }
}
export async function clickVisibleControl(cdp,selector){
  await pointer(cdp,await visibleControl(cdp,selector));
}
export async function fillVisibleControl(cdp,selector,value){
  await visibleControl(cdp,selector);
  // Setting a value is a test transport convenience, not physical keyboard
  // acceptance. Visibility and enabled state must still be established.
  return evaluate(cdp,`(()=>{
    const node=document.querySelector(${JSON.stringify(selector)});
    if(!node||node.matches(':disabled')||node.readOnly)throw new Error('FIELD_NOT_EDITABLE');
    node.value=${JSON.stringify(String(value))};
    node.dispatchEvent(new Event('input',{bubbles:true}));
    node.dispatchEvent(new Event('change',{bubbles:true}));
    return node.value;
  })()`);
}
