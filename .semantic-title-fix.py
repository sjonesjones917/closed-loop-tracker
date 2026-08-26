from pathlib import Path
p=Path('verify.mjs');s=p.read_text();old="'Freeze the Production Baseline','Generate the Finished Product','Run Deterministic Verification on the Finished Product'";new="'Freeze the Production Baseline','Generate the Confirmed Deliverable','Run Deterministic Verification on the Finished Product'";assert s.count(old)==1;s=s.replace(old,new,1);p.write_text(s)
