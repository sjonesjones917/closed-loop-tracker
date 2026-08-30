from pathlib import Path

def rw(path, fn):
    p=Path(path); p.write_text(fn(p.read_text()))

def require(cond,msg):
    if not cond: raise SystemExit(msg)

# Prompt engine: Stage 1 is generic but must derive project-specific human-only questions.
def patch_prompt(t):
    old="Ask only genuinely human-only questions. Never ask for information already present in User Job Input, an available supplied artifact, a prior answer, or canonical project memory."
    new="Ask only genuinely human-only questions. Derive subject-specific human-authority questions from the user's actual request, accessible supplied materials, and current canonical context; do not use a hard-coded project-subject catalogue. Never ask for information already present in User Job Input, an available supplied artifact, a prior answer, or canonical project memory."
    if old in t: t=t.replace(old,new,1)
    require(new in t,'Stage 01 project-derived question algorithm missing')
    anchor=" const d=core.STAGES[stage-1],existing=(state?.projectData?.generatedPrompts||[]).filter(x=>Number(x.stage)===stage),activeExisting=existing.filter(x=>!x.invalidatedBy&&x.promptEngineVersion===PROMPT_ENGINE_VERSION);const operation=options.operation||schema.STAGE_CONTRACTS[stage].operations[0];if(!schema.STAGE_CONTRACTS[stage].operations.includes(operation))throw new Error(`Operation ${operation} is not valid for Stage ${stage}.`);\n"
    guard=" const d=core.STAGES[stage-1],existing=(state?.projectData?.generatedPrompts||[]).filter(x=>Number(x.stage)===stage),activeExisting=existing.filter(x=>!x.invalidatedBy&&x.promptEngineVersion===PROMPT_ENGINE_VERSION);const operation=options.operation||schema.STAGE_CONTRACTS[stage].operations[0];if(!schema.STAGE_CONTRACTS[stage].operations.includes(operation))throw new Error(`Operation ${operation} is not valid for Stage ${stage}.`);\n if(stage===4&&Number(state?.job?.CURRENT_STAGE||0)===4){const stage1=state?.stages?.[1],stage3=state?.stages?.[3];if(stage1?.status!=='COMPLETE'||stage1?.invalidatedBy||stage3?.status!=='COMPLETE'||stage3?.invalidatedBy)throw new Error('Stage 04 prompt cannot be generated until Stage 01 and Stage 03 are complete and current.');}\n"
    if "Stage 04 prompt cannot be generated until Stage 01 and Stage 03 are complete and current." not in t:
        require(anchor in t,'Stage 04 prompt gate insertion anchor missing')
        t=t.replace(anchor,guard,1)
    return t
rw('prompt-engine.js',patch_prompt)

# Semantic regression suite: remove no-op mutant and eliminate old hard-coded specialist expectations.
def patch_semantic(t):
    t=t.replace("  {...original,prompt:original.prompt.replace('withhold prior outputs','include prior outputs')},\n",'')
    t=t.replace("  {...original,prompt:original.prompt.replaceAll('withhold prior outputs','include prior outputs')},\n",'')
    old=""" const p=baseProject();const r=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});if(!r.prompt.includes('audit, repair, migration, or modification of an existing target'))throw new Error('Existing-target audit/repair boundary is missing.');
 if(!r.prompt.includes('STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY')||!/supplied invention disclosure/.test(r.prompt)||!/supplied repository or file materials/.test(r.prompt)||!/human-supplied project location/.test(r.prompt)||!/supplied geometry\\/specifications/.test(r.prompt))throw new Error('Stage 01 specialist intake adaptation is missing.');
 if(/STAGE 0[23]|Stage 0[23] may|Research only the current accepted Stage 02|Build the independent external source inventory|Stage 02 owns source\\/material/.test(r.prompt))throw new Error('Stage 01 contains future Stage 02/03 work.');
"""
    new=""" const p=baseProject();const r=prompts.buildPromptRecord(1,p,{operation:'COMPLETE'});if(!r.prompt.includes('audit, repair, migration, or modification of an existing target'))throw new Error('Existing-target audit/repair boundary is missing.');
 if(!r.prompt.includes("Derive subject-specific human-authority questions from the user's actual request, accessible supplied materials, and current canonical context; do not use a hard-coded project-subject catalogue"))throw new Error('Stage 01 does not derive project-specific human-only questions from current project authority.');
 if(/STAGE 0[23]|Stage 0[23] may|Research only the current accepted Stage 02|Build the independent external source inventory|Stage 02 owns source\\/material/.test(r.prompt))throw new Error('Stage 01 contains future Stage 02/03 work.');
"""
    if old in t: t=t.replace(old,new,1)
    # Also remove any residual console declaration that presents specialist domains as runtime architecture.
    t=t.replace(",specialistDomains:['patent','software-multifile','building-aec','physical-engineering-cad-cam-cnc-additive']",",subjectNeutralStage1:true")
    # Add direct Stage 4 prerequisite regression before contract tests.
    marker="// Contract identity must bind the complete stage/record validation contract, not only field names.\n"
    block="""// Stage 04 cannot produce a current executable prompt from incomplete Stage 01 or Stage 03 state.
{
 const p=baseProject();p.job.CURRENT_STAGE=4;p.stages[1].status='COMPLETE';p.stages[3].status='IN PROGRESS';
 let blocked=false;try{prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});}catch(error){blocked=/Stage 01 and Stage 03 are complete and current/.test(String(error.message));}
 if(!blocked)throw new Error('Stage 04 prompt generator accepted incomplete Stage 03.');
 p.stages[3].status='COMPLETE';const r=prompts.buildPromptRecord(4,p,{operation:'COMPLETE'});
 if(!r.prompt.includes('STAGE 04 COMPLETE CANONICAL INPUT UNION — DO NOT ASK THE USER TO RESUPPLY IT')||!r.prompt.includes('APPLICATION OBLIGATION MANIFEST — ACCOUNT FOR EVERY ID'))throw new Error('Stage 04 complete-state prompt does not contain the complete canonical union and obligation manifest.');
}

"""
    if block not in t:
        require(marker in t,'Stage 04 prompt regression insertion marker missing')
        t=t.replace(marker,block+marker,1)
    # Hard-coded domain runtime expectations must be gone.
    for obsolete in ['Stage 01 specialist intake adaptation is missing.','STAGE 01 DOMAIN INTAKE ADAPTATION — CLARIFY AND NORMALIZE ONLY']:
        require(obsolete not in t,'obsolete domain assertion remains: '+obsolete)
    return t
rw('verify-prompt-semantics.mjs',patch_semantic)

# Permanent capture-once regression must explicitly assert the new prerequisite gate and generic Stage 1 algorithm.
def patch_capture(t):
    inserts=[
      "a(p.includes(\"Derive subject-specific human-authority questions from the user's actual request, accessible supplied materials, and current canonical context; do not use a hard-coded project-subject catalogue\"),'Stage 01 generic project-derived question algorithm missing');",
      "a(p.includes('Stage 04 prompt cannot be generated until Stage 01 and Stage 03 are complete and current.'),'Stage 04 upstream completion gate missing');"
    ]
    marker="a(p.includes('Exhaustively research every current accepted Stage 02'),'Stage 03 exhaustion absent');\n"
    require(marker in t,'capture regression marker missing')
    for line in inserts:
      if line not in t: t=t.replace(marker,marker+line+'\n',1)
    return t
rw('verify-intent-capture.mjs',patch_capture)

print('Stage 01 exhaustive generic intake and Stage 04 upstream prompt gate installed')
