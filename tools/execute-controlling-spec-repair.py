from pathlib import Path

root=Path(__file__).resolve().parents[1]
repair=root/'tools/apply-controlling-spec-fix.py'
src=repair.read_text(encoding='utf-8')

strict="s = replace_regex(s, r\"const APPLICATION_TEST_EXECUTORS=Object\\.freeze\\(\\{\\}\\);\\nfunction applicationTestCapabilities\\(\\)\\{return Object\\.freeze\\(Object\\.keys\\(APPLICATION_TEST_EXECUTORS\\)\\);\\}\", \"function applicationTestCapabilities(){const runtime=globalThis.closedLoopTestRuntime;return Object.freeze(runtime?.capabilities?Array.from(runtime.capabilities()):[]);}\", 'native capability authority')"
adapted="""runtime_caps=\"function applicationTestCapabilities(){const runtime=globalThis.closedLoopTestRuntime;return Object.freeze(runtime?.capabilities?Array.from(runtime.capabilities()):[]);}\"\nhardcoded_caps=\"function applicationTestCapabilities(){return Object.freeze([schema.TEST_IR.capability]);}\"\nif hardcoded_caps in s:\n    s=s.replace(hardcoded_caps,runtime_caps,1)\nelif runtime_caps in s:\n    pass\nelse:\n    legacy=r\"const APPLICATION_TEST_EXECUTORS=Object\\.freeze\\(\\{\\}\\);\\nfunction applicationTestCapabilities\\(\\)\\{return Object\\.freeze\\(Object\\.keys\\(APPLICATION_TEST_EXECUTORS\\)\\);\\}\"\n    updated,count=re.subn(legacy,runtime_caps,s,count=1)\n    if count:\n        s=updated\n"""
if strict not in src:
    raise SystemExit('native capability repair anchor missing')
src=src.replace(strict,adapted,1)

src=src.replace("valueType:VALUE_TYPES.STRING_ARRAY", "valueType:'STRING_ARRAY'")
src=src.replace("valueType:VALUE_TYPES.STRING", "valueType:'STRING'")
src=src.replace("valueType:VALUE_TYPES.OBJECT", "valueType:'OBJECT'")
src=src.replace("valueType:VALUE_TYPES.ENUM", "valueType:'STRING'")

exec(compile(src,str(repair),'exec'),{'__file__':str(repair),'__name__':'__main__'})
for rel in ['tools/execute-controlling-spec-repair.py','.github/workflows/apply-controlling-spec-fix-v2.yml','repair-diagnostic.log']:
    p=root/rel
    if p.exists(): p.unlink()
