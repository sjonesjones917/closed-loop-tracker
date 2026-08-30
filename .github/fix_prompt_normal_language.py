from pathlib import Path
p=Path('prompt-engine.js');s=p.read_text();s=s.replace('semantically exhausted and represented without loss','fully exhausted and represented without loss');p.write_text(s)
