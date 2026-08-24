(()=>{'use strict';
const style=document.createElement('style');
style.id='mobile-usability-scale';
style.dataset.revision='closed-loop-usability-20260824-r2';
style.textContent=`
/* Phone-first usability floor: readable supporting text and thumb-safe controls. */
.brand-kicker{font-size:11px!important;line-height:1.2!important}
.brand p{font-size:12.5px!important;line-height:1.4!important}
.project-select label,.progress-line strong{font-size:11px!important}
.project-select select{height:auto!important;min-height:44px!important;font-size:13px!important;padding:8px 30px 8px 10px!important}
.header-actions button,.file-button,.view-tabs button,.button-row button,.compact-button,.record-card button,.stage-card button,.stage-jumpbar button{min-height:44px!important;max-height:none!important;font-size:12px!important;padding:8px 11px!important}
.stage-nav{grid-template-columns:44px minmax(0,1fr) 44px!important;gap:8px!important}
.stage-nav button{width:44px!important;height:44px!important;min-height:44px!important}
.stage-nav select{height:auto!important;min-height:44px!important;font-size:12px!important}
input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea,select{min-height:44px!important;font-size:13px!important}
.check input{width:22px!important;height:22px!important}
.hero p,.section-intro,.notice,.field label,.group-label,.field .help,.check span,.stage-number,.stage-name,.stage-meta,.record-card>summary,.record-key,.record-value,.empty-state,.workflow-disclosure>summary,.workflow-disclosure>summary strong,.stage-action-strip,.project-field-group>summary,.project-field-group>summary span:last-child,.record-tools label{font-size:12px!important;line-height:1.45!important}
.status{min-height:28px!important;font-size:11px!important;padding:4px 8px!important}
.fact span{font-size:11px!important;line-height:1.3!important}
.fact strong{font-size:15px!important;line-height:1.3!important}
.prompt,.code-text{font-size:12px!important;line-height:1.5!important}
.record-card>summary,.project-field-group>summary,.workflow-disclosure>summary{min-height:44px!important;align-items:center!important;padding-top:10px!important;padding-bottom:10px!important}
@media(max-width:620px){
  .header-actions{flex-wrap:wrap!important;overflow:visible!important;gap:6px!important}
  .header-actions button{flex:1 1 calc(50% - 3px)!important;width:auto!important}
  .view-tabs{gap:6px!important}
  .button-row{gap:6px!important}
  .button-row>button{flex:1 1 auto!important}
  .stage-jumpbar{gap:6px!important}
  .facts,.overview-counts,.grid-2,.grid-3{grid-template-columns:1fr!important}
  .hero-top{display:block!important}
  .panel,.hero{padding:12px!important}
  .fact{padding:10px!important}
}
`;
const promote=()=>{if(document.head&&document.head.lastElementChild!==style)document.head.append(style);};
promote();
document.addEventListener('DOMContentLoaded',promote,{once:true});
window.addEventListener('load',promote,{once:true});
})();
