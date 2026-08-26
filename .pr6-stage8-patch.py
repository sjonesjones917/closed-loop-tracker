from pathlib import Path
p=Path('response-ingestion.js')
s=p.read_text()
old="""      if(reference.tempKey){
        const target=responseRecordIndex.get(String(reference.tempKey));
        if(!target)issues.push(issue('UNRESOLVED_RELATIONSHIP',`${path}/relationships/${pointerEscape(name)}`,`Temporary relationship ${reference.tempKey} does not exist.`));
        else if(target.collection!==expectedCollection)issues.push(issue('WRONG_RELATIONSHIP_TYPE',`${path}/relationships/${pointerEscape(name)}`,`${name} must refer to ${expectedCollection}, not ${target.collection}.`));
      }else if(reference.recordId){"""
new="""      if(reference.tempKey){
        const target=responseRecordIndex.get(String(reference.tempKey));
        const evidenceTarget=expectedCollection==='evidenceRecords'?evidenceIndex.get(String(reference.tempKey)):null;
        if(!target&&!evidenceTarget)issues.push(issue('UNRESOLVED_RELATIONSHIP',`${path}/relationships/${pointerEscape(name)}`,`Temporary relationship ${reference.tempKey} does not exist.`));
        else if(target&&target.collection!==expectedCollection)issues.push(issue('WRONG_RELATIONSHIP_TYPE',`${path}/relationships/${pointerEscape(name)}`,`${name} must refer to ${expectedCollection}, not ${target.collection}.`));
      }else if(reference.recordId){"""
assert old in s
p.write_text(s.replace(old,new,1))
