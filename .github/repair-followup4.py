from pathlib import Path

path = Path('prompt-engine.js')
text = path.read_text()
old = "function buildPromptRecord(stageOrDefinition,state,options={}){const stage=Number(stageOrDefinition?.number||stageOrDefinition);if(!Number.isInteger(stage)||stage<1||stage>schema.STAGE_COUNT)throw new Error(`Stage must be 1 through ${schema.STAGE_COUNT}.`);assertPromptPrerequisites(stage,state);if(stage===4)assertStage4UpstreamExhausted(state);"
new = "function buildPromptRecord(stageOrDefinition,state,options={}){const stage=Number(stageOrDefinition?.number||stageOrDefinition);if(!Number.isInteger(stage)||stage<1||stage>schema.STAGE_COUNT)throw new Error(`Stage must be 1 through ${schema.STAGE_COUNT}.`);if(stage===4)assertStage4UpstreamExhausted(state);else assertPromptPrerequisites(stage,state);"
if old not in text:
    raise AssertionError('Prompt prerequisite ordering fragment was not found.')
path.write_text(text.replace(old, new, 1))
print('Stage 04 now checks its complete Stage 01 + Stage 03 upstream closure before generic predecessor gating.')
