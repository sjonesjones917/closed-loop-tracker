from pathlib import Path
p=Path('project-store.js');s=p.read_text()
old="function writeAllLegacy(projects,storage){if(!storage)throw new Error('Legacy test storage is unavailable.');storage.setItem(LEGACY_KEYS[0],JSON.stringify(projects));return {changed:true};}"
new="function writeAllLegacy(projects,storage){if(!storage)throw new Error('Legacy test storage is unavailable.');const payload=JSON.stringify(projects),prior=storage.getItem(STORE_KEY);try{fault('before-final-write');storage.setItem(STORE_KEY,payload);fault('after-final-write');return {changed:prior!==payload};}catch(error){try{if(prior===null)storage.removeItem(STORE_KEY);else storage.setItem(STORE_KEY,prior);}catch{}throw error;}}"
assert old in s;s=s.replace(old,new,1);p.write_text(s)
