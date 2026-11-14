import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createVerifierRuntime} from './verifier-runtime.mjs';

// Independent literals come from §39.12, not from the runtime being checked.
export function verifyUiAcceptanceContract(schema){
 const contract=schema.UI_ACCEPTANCE_REGISTRY;
 assert.ok(contract,'UI_ACCEPTANCE_REGISTRY_ORACLE: the measurable UI contract must have one declared owner.');
 const plain=value=>JSON.parse(JSON.stringify(value));
 assert.deepEqual(plain(contract.viewports),[{width:320,height:568},{width:393,height:852},{width:1280,height:800}],'UI_ACCEPTANCE_VIEWPORT_ORACLE');
 assert.deepEqual(plain(contract.measurements),{browserZoomPercent:100,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetWidthPx:44,minimumTouchTargetHeightPx:44,minimumInlineLinkLineHeightPx:44,horizontalOverflowTolerancePx:1},'UI_ACCEPTANCE_MEASUREMENT_ORACLE');
 assert.deepEqual(plain(contract.focusTargets),{VALIDATION_FAILURE:'VALIDATION_REPORT_HEADING',EXECUTION_BLOCKER:'BLOCKER_HEADING',PROPOSAL_READY:'PROPOSAL_HEADING',NATIVE_RESULT_READY:'RESULT_HEADING',INVALID_HUMAN_ANSWER:'FIRST_INVALID_CONTROL',COLLAPSED_CONTENT:'ITS_TOGGLE'},'UI_ACCEPTANCE_FOCUS_ORACLE');
 for(const [key,expected]of Object.entries({keyboardOrder:'DOM_ORDER',focusTrap:'MODAL_ONLY',visibleFocusRequired:true,expandedContent:'TOGGLE_AND_EXPANDED_HEADING_VISIBLE',primaryActionPosition:'FIRST_VIEWPORT_AFTER_PAGE_HEADING_BEFORE_LONG_DETAILS',longValues:'WRAP_OR_SCROLL_INSIDE_BOUNDED_DETAIL_REGION',fileControls:'WITHIN_PARENT'}))assert.equal(contract[key],expected,'UI_ACCEPTANCE_POSTCONDITION_ORACLE: '+key);
 for(const value of [contract,contract.viewports,...contract.viewports,contract.measurements,contract.focusTargets])assert.ok(Object.isFrozen(value),'UI_ACCEPTANCE_IMMUTABLE_ORACLE');
 const conforming={horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44};
 assert.deepEqual(plain(schema.uiAcceptanceMeasurementIssues(conforming)),[],'UI_ACCEPTANCE_VALID_CONTROL_ORACLE');
 const cases=[];
 for(const [field,value,code]of [['horizontalOverflowPx',1.01,'HORIZONTAL_OVERFLOW_INVALID'],['minimumPrimaryTextPx',15.99,'PRIMARY_TEXT_FLOOR_INVALID'],['minimumSecondaryTextPx',13.99,'SECONDARY_TEXT_FLOOR_INVALID'],['minimumTouchTargetPx',43.99,'TOUCH_TARGET_FLOOR_INVALID']]){
  for(const bad of [value,undefined,null,'44',Infinity,NaN]){const observed=schema.uiAcceptanceMeasurementIssues({...conforming,[field]:bad});assert.ok(observed.some(row=>row.code===code),'UI_ACCEPTANCE_FALSE_ACCEPTANCE_ORACLE: '+field+' '+String(bad));cases.push({field,value:String(bad),code,result:'PASS'});}
 }
 assert.equal(schema.uiAcceptanceMeasurementIssues({...conforming,horizontalOverflowPx:1}).length,0,'UI_ACCEPTANCE_OVERFLOW_TOLERANCE_ORACLE');
 assert.ok(schema.uiAcceptanceMeasurementIssues({...conforming,horizontalOverflowPx:-0.01}).some(row=>row.code==='HORIZONTAL_OVERFLOW_INVALID'),'UI_ACCEPTANCE_NEGATIVE_OVERFLOW_ORACLE');
 return {caseId:'UI_ACCEPTANCE_REGISTRY',result:'PASS',requirements:['39.12'],cases,synthetic:true,actualBrowser:false,physicalDeviceAcceptance:false};
}

export async function verifyUiAcceptancePresentation(schema,source=fs.readFileSync('app-core.js','utf8')){
 const begin=source.indexOf('async function recordMobileAcceptanceMeasurements()'),end=source.indexOf('\nfunction prepareMobileActorEvidence()',begin);
 assert.ok(begin>=0&&end>begin,'UI_ACCEPTANCE_CONSUMER_OWNER_ORACLE');
 const cases=[];
 for(const [name,measurements,expected,focusWorks=true,liveWorks=true]of [
  ['conforming',{horizontalOverflowPx:1,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},'PASS'],
  ['overflow',{horizontalOverflowPx:1.01,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},'FAIL'],
  ['primary text',{horizontalOverflowPx:0,minimumPrimaryTextPx:15.99,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},'FAIL'],
  ['metadata',{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:13.99,minimumTouchTargetPx:44},'FAIL'],
  ['touch target',{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:43.99},'FAIL'],
  ['invalid measurement',{horizontalOverflowPx:-1,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},'FAIL'],
  ['focus failed',{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},'FAIL',false,true],
  ['announcement failed',{horizontalOverflowPx:0,minimumPrimaryTextPx:16,minimumSecondaryTextPx:14,minimumTouchTargetPx:44},'FAIL',true,false]
 ]){
  const receipts=[],errors=[],document={activeElement:null},panel={id:'mobile-acceptance-panel',setAttribute(){},focus(){if(focusWorks)document.activeElement=panel;}},live={id:'app-live-status',textContent:'',getAttribute:name=>liveWorks&&name==='role'?'status':null};let consultations=0;
  const runtime=createVerifierRuntime({schema:{...schema,uiAcceptanceMeasurementIssues(value){consultations++;return schema.uiAcceptanceMeasurementIssues(value);}},document,sessionBoundMobileAcceptanceTarget:()=>({challenge:'SYNTHETIC',mobileAcceptanceTargetId:'SYNTHETIC'}),measureMobileAcceptance:()=>measurements,$:selector=>selector==='#mobile-acceptance-panel'?panel:live,announce:message=>{live.textContent=message;},acceptanceSession:{runtimeCountsByTab:{}},saveAcceptanceSession:async()=>{},mobileRuntimeFindings:()=>({runtimeExceptions:0,unhandledRejections:0}),TAB_INSTANCE_ID:'SYNTHETIC',current:{activeView:'Workflow',activeStage:1},recordMobileOperation:async(kind,observation,options)=>receipts.push({kind,observation,...options}),reportActionFailure:error=>errors.push(error)});
  createVerifierRuntime.loadScript(runtime,source.slice(begin,end)+'\nglobalThis.observe=recordMobileAcceptanceMeasurements;');await runtime.observe();
  assert.equal(errors.length,0,errors.map(error=>error.stack).join('\n'));assert.equal(consultations,1,'UI_ACCEPTANCE_SHARED_OWNER_ORACLE');
  assert.equal(receipts.find(row=>row.kind==='ACCESSIBILITY_AND_OVERFLOW_VERIFIED')?.result,expected,'UI_ACCEPTANCE_PRESENTATION_ORACLE: '+name);
  cases.push({name,expected,result:'PASS'});
 }
 return {caseId:'UI_ACCEPTANCE_PRESENTATION',cases,synthetic:true,actualBrowser:false};
}
