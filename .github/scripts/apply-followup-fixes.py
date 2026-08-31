from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one replacement target, found {count}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "prompt-engine.js",
    "Never ask the human to repeat available project facts or reattach the original Stage 01 intent file.",
    "For avoidance of doubt, never ask the user to repeat available project facts or reattach the original Stage 01 intent file.",
)
replace_once(
    "prompt-engine.js",
    "Never ask the human to repeat, retype, summarize, resend, reopen, or reattach project information already present in current User Job Input, accepted Stage 01 capture, accepted canonical records, accessible canonical artifacts, or authorized research.",
    "The application has already captured it; never ask the human to repeat, retype, summarize, resend, reopen, or reattach it. This prohibition applies to project information already present in current User Job Input, accepted Stage 01 capture, accepted canonical records, accessible canonical artifacts, or authorized research.",
)
replace_once(
    "prompt-engine.js",
    "HUMAN COLLABORATION MODE — APPLIES TO EVERY EXTERNAL-AGENT STAGE",
    "HUMAN COLLABORATION MODE — APPLIES TO EVERY STAGE",
)
replace_once(
    "prompt-engine.js",
    "For every unit whose kind is SUPPLIED_MATERIAL, use the exact file identified by artifactId/filename/SHA-256 in that manifest and the FILES YOU MUST RECEIVE handoff. extractedStatements must enumerate all materially relevant human-authority content found in that file; do not return only a material-reference statement when the file contains substantive project facts, requirements, constraints, decisions, prohibitions, requested outputs, acceptance conditions, or unresolved human-only issues.",
    "For every SUPPLIED_MATERIAL metadata unit, preserve the exact material identity and inspect the exact file identified by artifactId/filename/SHA-256 when it is listed in FILES YOU MUST RECEIVE. For every SUPPLIED_MATERIAL_CONTENT unit, classify the exact application-captured content directly and do not ask the human to retype, summarize, reopen, resend, or reattach that material. extractedStatements must enumerate all materially relevant human-authority content; do not return only a material-reference statement when substantive project facts, requirements, constraints, decisions, prohibitions, requested outputs, acceptance conditions, or unresolved human-only issues are present.",
)

engine = Path("workflow-engine.js")
text = engine.read_text()
old = """      const unsupportedApplication=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='APPLICATION_DETERMINISTIC'&&!applicationTestSupported(test));
      if(unsupportedApplication.length)reasons.push(`${unsupportedApplication.length} mandatory test definition(s) claim APPLICATION_DETERMINISTIC without a registered application-native executor.`);
      // Stage 06 proves the verification definition is complete, not that future execution inputs already exist.
      // Exact byte readiness remains fail-closed in testExecutionPlan() at the execution stage.
      break;"""
new = """      const unsupportedApplication=mandatoryTests.filter(test=>upper(recordValue(test,'EXECUTION_MODE'))==='APPLICATION_DETERMINISTIC'&&!applicationTestSupported(test));
      if(unsupportedApplication.length)reasons.push(`${unsupportedApplication.length} mandatory test definition(s) claim APPLICATION_DETERMINISTIC without a registered application-native executor.`);
      const executionPlan=testExecutionPlan(project),mandatoryPlanItems=executionPlan.items.filter(item=>mandatoryIds.has(item.requirementId)),missingArtifacts=mandatoryPlanItems.filter(item=>!item.artifactReady);
      if(missingArtifacts.length)reasons.push(`${missingArtifacts.length} mandatory test definition(s) have required artifact bytes missing or no longer application-verified.`);
      break;"""
if text.count(old) != 1:
    raise SystemExit(f"workflow-engine.js: Stage 06 artifact-readiness target count {text.count(old)}")
engine.write_text(text.replace(old, new, 1))
