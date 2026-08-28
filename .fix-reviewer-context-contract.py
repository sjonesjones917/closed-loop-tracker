from pathlib import Path
p=Path('workflow-schema.js')
s=p.read_text()

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected one match, found {n}')
    s=s.replace(old,new,1)

# The preceding semantic patch already adds REVIEWER_CONTEXT_ID to the Stage 23/24 AGENT ownership partitions.
# Here, bind that reported reference into each record's closed field set, required set, and typed relationship.
one("'MEANING_REVIEW_ID','REQ_ID','TEST_ID','PRODUCT_ID','PRODUCT_LOCATION'",
    "'MEANING_REVIEW_ID','REQ_ID','TEST_ID','PRODUCT_ID','REVIEWER_CONTEXT_ID','PRODUCT_LOCATION'",
    'meaning record field')
one("'ATTACK_ID','PRODUCT_ID','TEST_ID','REG_ID','ATTACK'",
    "'ATTACK_ID','PRODUCT_ID','TEST_ID','REG_ID','REVIEWER_CONTEXT_ID','ATTACK'",
    'adversarial record field')
one("required:['TEST_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION'],relationships:{REQ_ID:'requirements',TEST_ID:'tests',PRODUCT_ID:'products',DEFECT_ID:'defects'}",
    "required:['TEST_ID','REVIEWER_CONTEXT_ID','PRODUCT_LOCATION','EXTERNAL_SOURCE_EVIDENCE','REQUIRED_MEANING','OBSERVED_MEANING','EVIDENCE_BASED_COMPARISON','DETERMINATION'],relationships:{REQ_ID:'requirements',TEST_ID:'tests',PRODUCT_ID:'products',REVIEWER_CONTEXT_ID:'freshContexts',DEFECT_ID:'defects'}",
    'meaning required relationship')
one("required:['ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','SEVERITY','EVIDENCE'],relationships:{PRODUCT_ID:'products',TEST_ID:'tests',REG_ID:'regressions',DEFECT_ID:'defects'}",
    "required:['REVIEWER_CONTEXT_ID','ATTACK','METHOD','EXPECTED_BEHAVIOR','ACTUAL_RESULT','DETERMINATION','SEVERITY','EVIDENCE'],relationships:{PRODUCT_ID:'products',TEST_ID:'tests',REG_ID:'regressions',REVIEWER_CONTEXT_ID:'freshContexts',DEFECT_ID:'defects'}",
    'adversarial required relationship')
p.write_text(s)
