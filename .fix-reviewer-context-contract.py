from pathlib import Path
p=Path('workflow-schema.js')
s=p.read_text()

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected one match, found {n}')
    s=s.replace(old,new,1)

one('''  "meaningResults": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "PRODUCT_LOCATION",''','''  "meaningResults": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "REVIEWER_CONTEXT_ID",
      "PRODUCT_LOCATION",''','meaning ownership')
one('''  "adversarialResults": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "ATTACK",''','''  "adversarialResults": {
    "human": [],
    "humanDecision": [],
    "agent": [
      "REVIEWER_CONTEXT_ID",
      "ATTACK",''','adversarial ownership')
one("required:['TEST_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION'],relationships:{REQ_ID:'requirements',TEST_ID:'tests',PRODUCT_ID:'products',DEFECT_ID:'defects'}",
    "required:['TEST_ID','REVIEWER_CONTEXT_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION'],relationships:{REQ_ID:'requirements',TEST_ID:'tests',PRODUCT_ID:'products',REVIEWER_CONTEXT_ID:'freshContexts',DEFECT_ID:'defects'}",
    'meaning required relationship')
one("required:['ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','SEVERITY','EVIDENCE'],relationships:{PRODUCT_ID:'products',TEST_ID:'tests',REG_ID:'regressions',DEFECT_ID:'defects'}",
    "required:['REVIEWER_CONTEXT_ID','ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','SEVERITY','EVIDENCE'],relationships:{PRODUCT_ID:'products',TEST_ID:'tests',REG_ID:'regressions',REVIEWER_CONTEXT_ID:'freshContexts',DEFECT_ID:'defects'}",
    'adversarial required relationship')
p.write_text(s)
