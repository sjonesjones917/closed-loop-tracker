from pathlib import Path
p=Path('verify-prompt-semantics.mjs')
s=p.read_text()
old="const capture=(n,next)=>{const re=new RegExp('\\n'+n+\":'(.*?)',\\n\"+next+\":'\",'s');const m=source.match(re);if(!m)throw new Error('Cannot isolate Stage '+n+' procedure');return m[1];};"
new="const capture=(n,next)=>{const start=source.indexOf('\\n'+n+':');const end=source.indexOf('\\n'+next+':',start+1);if(start<0||end<0)throw new Error('Cannot isolate Stage '+n+' procedure');return source.slice(start,end);};"
if old not in s: raise SystemExit('stage-boundary capture target not found')
s=s.replace(old,new,1)
p.write_text(s)
