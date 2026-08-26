from pathlib import Path
s=Path('workflow-schema.js').read_text()
def rep(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected one match, found {n}')
    s=s.replace(old,new,1)
rep('''      "MEANING_REVIEW_ID",\n      "REQ_ID",\n      "PRODUCT_ID",''','''      "MEANING_REVIEW_ID",\n      "REQ_ID",\n      "TEST_ID",\n      "PRODUCT_ID",''','meaning ownership')
rep('''      "ATTACK_ID",\n      "PRODUCT_ID",\n      "DEFECT_ID"''','''      "ATTACK_ID",\n      "PRODUCT_ID",\n      "TEST_ID",\n      "REG_ID",\n      "DEFECT_ID"''','adversarial ownership')
rep("'MEANING_REVIEW_ID','REQ_ID','PRODUCT_ID','PRODUCT_LOCATION'","'MEANING_REVIEW_ID','REQ_ID','TEST_ID','PRODUCT_ID','PRODUCT_LOCATION'",'meaning fields')
rep("required:['PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING'","required:['TEST_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING'",'meaning required')
rep("relationships:{REQ_ID:'requirements',PRODUCT_ID:'products',DEFECT_ID:'defects'}}),\n  adversarialResults", "relationships:{REQ_ID:'requirements',TEST_ID:'tests',PRODUCT_ID:'products',DEFECT_ID:'defects'}}),\n  adversarialResults",'meaning relationships')
rep("'ATTACK_ID','PRODUCT_ID','ATTACK','METHOD'","'ATTACK_ID','PRODUCT_ID','TEST_ID','REG_ID','ATTACK','METHOD'",'adversarial fields')
rep("relationships:{PRODUCT_ID:'products',DEFECT_ID:'defects'}}),\n  representationInspections", "relationships:{PRODUCT_ID:'products',TEST_ID:'tests',REG_ID:'regressions',DEFECT_ID:'defects'}}),\n  representationInspections",'adversarial relationships')
marker="const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({\n"
addition="""const RECORD_FIELD_TYPE_OVERRIDES=Object.freeze({
  'TEST':Object.freeze({TEST_TYPE:Object.freeze({valueType:'STRING',enumValues:Object.freeze(['DETERMINISTIC','MEANING','ADVERSARIAL']),nullable:false,normalizerKey:null,closedProperties:null})}),
  'MEANING-REVIEW':Object.freeze({TEST_ID:Object.freeze({valueType:'REFERENCE',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
  'ATTACK':Object.freeze({TEST_ID:Object.freeze({valueType:'REFERENCE',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null}),REG_ID:Object.freeze({valueType:'REFERENCE',enumValues:Object.freeze([]),nullable:false,normalizerKey:null,closedProperties:null})}),
"""
rep(marker,addition,'type override marker')
Path('workflow-schema.js').write_text(s)
