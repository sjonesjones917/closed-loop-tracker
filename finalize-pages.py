from pathlib import Path
import subprocess

main = subprocess.check_output(['git','show','origin/main:.github/workflows/pages.yml'], text=True)
t = main

syntax_anchor = '          node --check verify-test-runtime.mjs\n'
syntax_insert = '''          node --check verify-test-runtime.mjs
          node --check verify-test-runtime-v3.mjs
          node --check verify-test-runtime-limits.mjs
          node --check verify-v3-contract.mjs
          node --check verify-v3-migration.mjs
          node --check verify-v3-definition-of-done.mjs
          node --check verify-zero-loss-accounting.mjs
          node --check verify-all-stage-prompts.mjs
          node --check verify-user-prompt-invariants.mjs
'''
if syntax_anchor not in t:
    raise SystemExit('syntax anchor missing')
t = t.replace(syntax_anchor, syntax_insert, 1)

runtime_anchor = '''      - name: Verify generic deterministic Test IR runtime
        run: node verify-test-runtime.mjs
'''
runtime_insert = '''      - name: Verify generic deterministic Test IR runtime
        run: |
          node verify-test-runtime.mjs
          node verify-test-runtime-v3.mjs
          node verify-test-runtime-limits.mjs
      - name: Verify /3 contracts, migration, zero-loss accounting, and all stage prompts
        run: |
          node verify-v3-contract.mjs
          node verify-v3-migration.mjs
          node verify-zero-loss-accounting.mjs
          node verify-all-stage-prompts.mjs
          node verify-user-prompt-invariants.mjs
          node verify-v3-definition-of-done.mjs
'''
if runtime_anchor not in t:
    raise SystemExit('runtime anchor missing')
t = t.replace(runtime_anchor, runtime_insert, 1)

deploy_anchor = '      - run: node build-test-project.mjs && node verify-test-runtime.mjs && node verify-one-time-intent-intake.mjs && node verify-hash.mjs && node verify.mjs && node verify-ingestion.mjs && node verify-complete.mjs && node verify-full-cycle.mjs && node verify-prompt-semantics.mjs && node verify-semantic-invariant.mjs && node verify-definition-of-done.mjs && node verify-project-lifecycle.mjs\n'
deploy_insert = '      - run: node build-test-project.mjs && node verify-test-runtime.mjs && node verify-test-runtime-v3.mjs && node verify-test-runtime-limits.mjs && node verify-v3-contract.mjs && node verify-v3-migration.mjs && node verify-zero-loss-accounting.mjs && node verify-all-stage-prompts.mjs && node verify-user-prompt-invariants.mjs && node verify-v3-definition-of-done.mjs && node verify-one-time-intent-intake.mjs && node verify-hash.mjs && node verify.mjs && node verify-ingestion.mjs && node verify-complete.mjs && node verify-full-cycle.mjs && node verify-prompt-semantics.mjs && node verify-semantic-invariant.mjs && node verify-definition-of-done.mjs && node verify-project-lifecycle.mjs\n'
if deploy_anchor not in t:
    raise SystemExit('deploy proof anchor missing')
t = t.replace(deploy_anchor, deploy_insert, 1)

Path('.github/workflows/pages.yml').write_text(t)
