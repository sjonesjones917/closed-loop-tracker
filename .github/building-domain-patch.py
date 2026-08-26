from pathlib import Path
import hashlib,re

p=Path('prompt-engine.js'); text=p.read_text()
needle='- SOFTWARE / MULTI-FILE SYSTEM: reason over the complete supplied file tree or manifest and the relevant interfaces, data models, dependencies, build/deploy/test constraints, migrations, security, observability, configuration, and operational boundaries. When repository or runtime access is unavailable, produce a complete implementation-ready multi-file specification or patch plan with exact logical files/components, responsibilities, interfaces, changes, and acceptance tests instead of claiming files were changed.\n- PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE:'
replacement='- SOFTWARE / MULTI-FILE SYSTEM: reason over the complete supplied file tree or manifest and the relevant interfaces, data models, dependencies, build/deploy/test constraints, migrations, security, observability, configuration, and operational boundaries. When repository or runtime access is unavailable, produce a complete implementation-ready multi-file specification or patch plan with exact logical files/components, responsibilities, interfaces, changes, and acceptance tests instead of claiming files were changed.\n- BUILDING / ARCHITECTURE / AEC: establish the project location and authority having jurisdiction, adopted code editions and local amendments, occupancy/use, construction type, height/area limits, zoning/site constraints, structural design criteria, fire/life-safety, accessibility, energy, MEP and other applicable discipline requirements, permit/submittal requirements, required drawings/specifications/calculations, inspections, and dependencies. Distinguish legally adopted requirements from model-code text, guidance, owner criteria, and design recommendations. Use current controlling jurisdictional authority where applicable and never invent site facts, occupancy, loads, code edition, approval status, professional determinations, or permit facts; request missing human-only facts or return the appropriate unresolved state.\n- PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE:'
if text.count(needle)!=1: raise SystemExit(f'building prompt insertion point count={text.count(needle)}')
p.write_text(text.replace(needle,replacement,1))

p=Path('verify-prompt-semantics.mjs'); text=p.read_text()
needle="  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');"
replacement="  if(!record.prompt.includes('SOFTWARE / MULTI-FILE SYSTEM'))issues.push('SOFTWARE_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('BUILDING / ARCHITECTURE / AEC')||!record.prompt.includes('authority having jurisdiction')||!record.prompt.includes('adopted code editions and local amendments')||!record.prompt.includes('Distinguish legally adopted requirements from model-code text'))issues.push('BUILDING_DOMAIN_RULE_MISSING');\n  if(!record.prompt.includes('PHYSICAL / MECHANICAL / CAD / CAM / CNC / ADDITIVE'))issues.push('PHYSICAL_ENGINEERING_DOMAIN_RULE_MISSING');"
if text.count(needle)!=1: raise SystemExit('building semantic assertion insertion point mismatch')
p.write_text(text.replace(needle,replacement,1))

runtime_files=['workbook.js','hash.js','workflow-schema.js','workflow-engine.js','prompt-engine.js','response-ingestion.js','project-store.js','app-core.js']
def blob_sha(path):
    data=Path(path).read_bytes(); return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
identity='runtime-'+hashlib.sha256(''.join(f'{name}:{blob_sha(name)}\n' for name in runtime_files).encode()).hexdigest()[:16]
p=Path('index.html'); text=p.read_text()
for name in runtime_files:
    pattern=rf'(<script\s+defer\s+src="{re.escape(name)}\?v=)[^"]+("\s*></script>)'
    text,count=re.subn(pattern,rf'\g<1>{identity}\g<2>',text,count=1)
    if count!=1: raise SystemExit(f'cache token update failed for {name}')
p.write_text(text)
print(identity)
