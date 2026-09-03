import fs from 'node:fs';
const path='test-runtime.js';
let text=fs.readFileSync(path,'utf8');
const anchor="function validateRegex(pattern,flags=''){";
if(!text.includes(anchor))throw new Error('strict JSON insertion anchor not found');
const strictJson=String.raw`function strictJsonPreflight(text){
  const source=String(text);let i=0;const length=source.length;
  const error=message=>fail('INVALID_JSON',message+' at character '+i+'.',STATUS.UNDETERMINED);
  const ws=()=>{while(i<length&&/[\x20\t\r\n]/.test(source[i]))i++;};
  const stringToken=()=>{
    if(source[i]!=='"')error('Expected JSON string');
    const start=i++;let escaped=false;
    while(i<length){
      const code=source.charCodeAt(i),ch=source[i++];
      if(code<=0x1f)error('Unescaped control character in JSON string');
      if(escaped){
        if(ch==='u'){
          const hex=source.slice(i,i+4);if(!/^[0-9a-fA-F]{4}$/.test(hex))error('Invalid JSON unicode escape');i+=4;
        }else if(!'"\\/bfnrt'.includes(ch))error('Invalid JSON escape');
        escaped=false;continue;
      }
      if(ch==='\\'){escaped=true;continue;}
      if(ch==='"'){
        const raw=source.slice(start,i);
        try{return JSON.parse(raw);}catch{error('Invalid JSON string');}
      }
    }
    error('Unterminated JSON string');
  };
  const numberToken=()=>{
    const match=/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(source.slice(i));
    if(!match||match.index!==0)error('Invalid JSON number');
    const raw=match[0];i+=raw.length;
    if(/[.eE]/.test(raw))fail('UNSUPPORTED_JSON_NUMBER','PARSE_JSON requires exact numeric semantics; non-integer JSON number '+raw+' is unsupported.',STATUS.UNDETERMINED);
    const value=Number(raw);
    if(!Number.isSafeInteger(value)||Object.is(value,-0))fail('UNSUPPORTED_JSON_NUMBER','PARSE_JSON numeric token '+raw+' is outside the finite safe-integer domain.',STATUS.UNDETERMINED);
  };
  let parseValue;
  const parseObject=()=>{
    i++;ws();const keys=new Set();
    if(source[i]==='}'){i++;return;}
    while(i<length){
      ws();const key=stringToken();
      if(keys.has(key))fail('DUPLICATE_JSON_MEMBER','PARSE_JSON rejects duplicate object member '+key+'.',STATUS.UNDETERMINED);
      keys.add(key);ws();if(source[i++]!==':')error('Expected colon');parseValue();ws();
      if(source[i]==='}'){i++;return;}if(source[i++]!==',')error('Expected comma');
    }
    error('Unterminated object');
  };
  const parseArray=()=>{
    i++;ws();if(source[i]===']'){i++;return;}
    while(i<length){parseValue();ws();if(source[i]===']'){i++;return;}if(source[i++]!==',')error('Expected comma');}
    error('Unterminated array');
  };
  parseValue=()=>{
    ws();if(i>=length)error('Expected value');const ch=source[i];
    if(ch==='"'){stringToken();return;}if(ch==='{'){parseObject();return;}if(ch==='['){parseArray();return;}
    for(const token of ['true','false','null'])if(source.startsWith(token,i)){i+=token.length;return;}
    if(ch==='-'||/[0-9]/.test(ch)){numberToken();return;}error('Invalid value');
  };
  ws();parseValue();ws();if(i!==length)error('Trailing JSON content');
}
`;
text=text.replace(anchor,strictJson+anchor);
const from="case 'PARSE_JSON':{try{return {value:safeJsonValue(JSON.parse(input.text))};}catch(error){if(error instanceof RuntimeError)throw error;fail('INVALID_JSON','JSON parsing failed: '+error.message,'UNDETERMINED');}}";
const to="case 'PARSE_JSON':{strictJsonPreflight(input.text);try{return {value:safeJsonValue(JSON.parse(input.text))};}catch(error){if(error instanceof RuntimeError)throw error;fail('INVALID_JSON','JSON parsing failed: '+error.message,'UNDETERMINED');}}";
if(!text.includes(from))throw new Error('PARSE_JSON repair target not found');
text=text.replace(from,to);
fs.writeFileSync(path,text);
console.log('strict Test IR JSON parser repair applied');
