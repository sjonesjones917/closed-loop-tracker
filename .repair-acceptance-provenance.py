from pathlib import Path

path = Path('.github/workflows/pages.yml')
text = path.read_text(encoding='utf-8')

old_lifecycle = """      - name: Workflow, gates, full cycle, and lifecycle
        run: |
          set -euo pipefail
          node verify-complete.mjs
          node verify-full-cycle.mjs
          node verify-definition-of-done.mjs
          node verify-v3-definition-of-done.mjs
          node verify-project-lifecycle.mjs

      - name: Prompt semantics and leakage
"""
new_lifecycle = """      - name: Workflow, gates, and full cycle
        run: |
          set -euo pipefail
          node verify-complete.mjs
          node verify-full-cycle.mjs
          node verify-definition-of-done.mjs
          node verify-v3-definition-of-done.mjs

      - name: Project lifecycle and application-owned controls
        run: |
          set -euo pipefail
          node verify-project-lifecycle.mjs

      - name: Prompt semantics and leakage
"""
if old_lifecycle in text:
    text = text.replace(old_lifecycle, new_lifecycle, 1)
elif new_lifecycle not in text:
    raise SystemExit('Lifecycle proof-step boundary was not found exactly once.')

old_commands = """          node verify-ingestion.mjs > /tmp/ingestion.out
          node verify-stage01-intake-closure.mjs > /tmp/stage01.out
          node verify-zero-loss-accounting.mjs > /tmp/zero-loss.out
"""
new_commands = """          node verify-ingestion.mjs > /tmp/ingestion.out
          node verify-stage01-intake-closure.mjs > /tmp/stage01.out
          node verify-zero-loss-accounting.mjs > /tmp/zero-loss.out
          node verify-full-cycle.mjs > /tmp/full-cycle.json
"""
if new_commands not in text:
    if text.count(old_commands) != 1:
        raise SystemExit(f'Acceptance proof command boundary count: {text.count(old_commands)}')
    text = text.replace(old_commands, new_commands, 1)

old_parse = """          const definition=JSON.parse(fs.readFileSync('/tmp/definition.json','utf8'));
          const v3=JSON.parse(fs.readFileSync('/tmp/v3.json','utf8'));
          const ingestionText=fs.readFileSync('/tmp/ingestion.out','utf8');
"""
new_parse = """          const definition=JSON.parse(fs.readFileSync('/tmp/definition.json','utf8'));
          const v3=JSON.parse(fs.readFileSync('/tmp/v3.json','utf8'));
          const stage01=JSON.parse(fs.readFileSync('/tmp/stage01.out','utf8'));
          const zeroLoss=JSON.parse(fs.readFileSync('/tmp/zero-loss.out','utf8'));
          const fullCycle=JSON.parse(fs.readFileSync('/tmp/full-cycle.json','utf8'));
          const ingestionText=fs.readFileSync('/tmp/ingestion.out','utf8');
          const stage01RawInputAccounting=Number(Boolean(stage01.stage01IntakeClosure&&stage01.currentManifestBound&&stage01.incompleteAccountingRejected));
          const stage01RequiredFileInspectionAccounting=Number(Boolean(stage01.artifactIdentityBound&&stage01.currentManifestBound&&stage01.incompleteAccountingRejected));
          const stage01AcceptedSemanticMappingCoverage=Number(Boolean(zeroLoss.zeroLossStage01&&zeroLoss.incompleteIntakeRejected));
          const stage04ObligationAccounting=Number(Boolean(zeroLoss.zeroLossStage04&&zeroLoss.completeStage03ResearchUnion&&zeroLoss.incompleteObligationRejected));
"""
if new_parse not in text:
    if text.count(old_parse) != 1:
        raise SystemExit(f'Acceptance proof parser boundary count: {text.count(old_parse)}')
    text = text.replace(old_parse, new_parse, 1)

replacements = {
    '            stage01RawInputAccounting:1,': '            stage01RawInputAccounting,',
    '            stage01RequiredFileInspectionAccounting:1,': '            stage01RequiredFileInspectionAccounting,',
    '            stage01AcceptedSemanticMappingCoverage:1,': '            stage01AcceptedSemanticMappingCoverage,',
    '            stage04ObligationAccounting:1,': '            stage04ObligationAccounting,',
    '            stagesCompleted:30,': '            stagesCompleted:Number(fullCycle.stagesCompleted||0),',
    '            deployedByteIdentity:true,': "            deployedByteIdentity:process.env.LIVE_RESULT==='success',",
    '            localChromiumAcceptance:true,': "            localChromiumAcceptance:process.env.TEST_RESULT==='success',",
    '            deployedChromiumAcceptance:true,': "            deployedChromiumAcceptance:process.env.LIVE_RESULT==='success',",
}
for old, new in replacements.items():
    if new not in text:
        if text.count(old) != 1:
            raise SystemExit(f'Acceptance replacement boundary count for {old.strip()}: {text.count(old)}')
        text = text.replace(old, new, 1)

old_tag = """          git tag -f "$TAG" "$GITHUB_SHA"
          git push --force origin "refs/tags/$TAG"
"""
new_tag = """          EXISTING="$(git ls-remote --tags origin "refs/tags/$TAG" | awk '{print $1}')"
          if [ -n "$EXISTING" ]; then
            test "$EXISTING" = "$GITHUB_SHA"
          else
            git tag "$TAG" "$GITHUB_SHA"
            git push origin "refs/tags/$TAG"
          fi
"""
if new_tag not in text:
    if text.count(old_tag) != 1:
        raise SystemExit(f'Release-tag replacement boundary count: {text.count(old_tag)}')
    text = text.replace(old_tag, new_tag, 1)

path.write_text(text, encoding='utf-8')
