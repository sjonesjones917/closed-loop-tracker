import pathlib

path=pathlib.Path('verify-spec-grounded-route-oracle.mjs')
text=path.read_text()
old="const af=Object.values(d.fieldDefinitions).find(x=>x.producer===schema.PRODUCER.AGENT)?.name,id=`ORACLE-${c}-CURRENT`,sid=`ORACLE-${c}-STALE`,f={[d.idField]:id},sf={[d.idField]:sid};if(af){f[af]=`CURRENT-ORACLE-${c}`;sf[af]=`STALE-ORACLE-${c}`;}"
new="const af=Object.values(d.fieldDefinitions).find(x=>x.producer===schema.PRODUCER.AGENT)?.name,id=`ORACLE-${c}-CURRENT`,sid=`ORACLE-${c}-STALE`,f={[d.idField]:id},sf={[d.idField]:sid};if(af){f[af]=`CURRENT-ORACLE-${c}`;sf[af]=`STALE-ORACLE-${c}`;}if(c==='defects'){f.OBSERVED_FAILURE='CURRENT-ORACLE-defects-observed';f.EXPECTED_CONDITION='CURRENT-ORACLE-defects-expected';sf.OBSERVED_FAILURE='STALE-ORACLE-defects-observed';sf.EXPECTED_CONDITION='STALE-ORACLE-defects-expected';}"
if text.count(old)!=1:
    raise SystemExit(f'Expected one oracle sentinel constructor; found {text.count(old)}')
path.write_text(text.replace(old,new,1))
