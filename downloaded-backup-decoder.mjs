// Independent verifier transport decoder prototype. It does not import the app
// parser and does not select, normalize, or discard any JSON member.
import {Readable} from 'node:stream';
import {createGunzip} from 'node:zlib';
import {StringDecoder} from 'node:string_decoder';
import {constants as bufferConstants} from 'node:buffer';

const CHUNK_BYTES=65536;
const whitespace=char=>char===' '||char==='\t'||char==='\r'||char==='\n';
const delimiter=char=>whitespace(char)||char===','||char===']'||char==='}'||char===':'||char==='['||char==='{';
const own=(object,key,value)=>Object.defineProperty(object,key,{value,enumerable:true,writable:true,configurable:true});
function limit(value,fallback,name){if(value===undefined)return fallback;if(!Number.isSafeInteger(value)||value<1)throw new RangeError(name+' must be a positive safe integer.');return value;}
function resourceError(message){return Object.assign(new RangeError(message),{code:'BACKUP_DECODE_RESOURCE_LIMIT'});}
class JsonMemberParser {
 constructor(options){
  this.maxStringCodeUnits=limit(options.maxStringCodeUnits,bufferConstants.MAX_STRING_LENGTH,'maxStringCodeUnits');
  this.maxValues=limit(options.maxValues,Number.MAX_SAFE_INTEGER,'maxValues');
  this.stack=[];this.root=undefined;this.done=false;this.mode=null;this.offset=0;this.values=0;this.stringCodeUnits=0;this.maxDepth=0;
 }
 syntax(message){throw new SyntaxError('Downloaded backup JSON: '+message+' at UTF-16 offset '+this.offset+'.');}
 count(){if(++this.values>this.maxValues)throw resourceError('Downloaded backup exceeds the configured JSON value count.');}
 accept(value,counted=false){
  if(!counted)this.count();const parent=this.stack.at(-1);
  if(!parent){if(this.done)this.syntax('more than one root value');this.root=value;this.done=true;return;}
  if(parent.kind==='array'){if(parent.state!=='value'&&parent.state!=='valueOrEnd')this.syntax('unexpected array value');parent.value.push(value);parent.state='commaOrEnd';}
  else{if(parent.state!=='value')this.syntax('unexpected object value');own(parent.value,parent.key,value);parent.key=null;parent.state='commaOrEnd';}
 }
 open(kind){this.count();this.stack.push({kind,value:kind==='array'?[]:{},state:kind==='array'?'valueOrEnd':'keyOrEnd',key:null});this.maxDepth=Math.max(this.maxDepth,this.stack.length);}
 close(){const frame=this.stack.pop();this.accept(frame.value,true);}
 beginString(key){this.mode='string';this.stringKey=key;this.parts=[];this.part='';this.units=0;this.escape=false;this.unicodeDigits=null;}
 append(text){if(!text)return;this.units+=text.length;if(this.units>this.maxStringCodeUnits||this.units>bufferConstants.MAX_STRING_LENGTH)throw resourceError('A downloaded backup JSON string exceeds the supported string length.');if(this.part.length+text.length>CHUNK_BYTES){if(this.part)this.parts.push(this.part);this.part='';}this.part+=text;}
 finishString(){const value=this.parts.length?[...this.parts,this.part].join(''):this.part;this.stringCodeUnits+=value.length;this.parts=null;this.part='';this.mode=null;if(this.stringKey){const frame=this.stack.at(-1);frame.key=value;frame.state='colon';}else this.accept(value);}
 finishAtom(){let value;try{value=JSON.parse(this.atom);}catch{this.syntax('invalid primitive token');}if(value!==null&&typeof value!=='boolean'&&typeof value!=='number')this.syntax('invalid primitive token');this.atom='';this.mode=null;this.accept(value);}
 feed(text){
  let index=0;const special=/["\\\u0000-\u001f]/g;
  while(index<text.length){
   if(this.mode==='string'){
    if(this.unicodeDigits!==null){const char=text[index];if(!/[0-9a-fA-F]/.test(char))this.syntax('invalid Unicode escape');this.unicodeDigits+=char;index++;this.offset++;if(this.unicodeDigits.length===4){this.append(String.fromCharCode(parseInt(this.unicodeDigits,16)));this.unicodeDigits=null;}continue;}
    if(this.escape){const char=text[index++];this.offset++;this.escape=false;if(char==='u'){this.unicodeDigits='';continue;}const escapes={'"':'"','\\':'\\','/':'/','b':'\b','f':'\f','n':'\n','r':'\r','t':'\t'};if(!Object.hasOwn(escapes,char))this.syntax('invalid string escape');this.append(escapes[char]);continue;}
    special.lastIndex=index;const match=special.exec(text),end=match?match.index:text.length;this.append(text.slice(index,end));this.offset+=end-index;index=end;if(!match)continue;
    const char=text[index++];this.offset++;if(char==='"'){this.finishString();continue;}if(char==='\\'){this.escape=true;continue;}this.syntax('unescaped control character in string');
   }
   if(this.mode==='atom'){
    const start=index;while(index<text.length&&!delimiter(text[index]))index++;this.atom+=text.slice(start,index);this.offset+=index-start;if(this.atom.length>this.maxStringCodeUnits)throw resourceError('A downloaded backup primitive token exceeds the supported length.');if(index<text.length)this.finishAtom();else continue;
   }
   const char=text[index];if(whitespace(char)){index++;this.offset++;continue;}
   const frame=this.stack.at(-1);
   if(!frame&&this.done)this.syntax('trailing non-whitespace after root value');
   if(frame?.kind==='object'&&(frame.state==='keyOrEnd'||frame.state==='key')){
    if(char==='}'&&frame.state==='keyOrEnd'){index++;this.offset++;this.close();continue;}
    if(char!=='"')this.syntax('object member name must be a string');index++;this.offset++;this.beginString(true);continue;
   }
   if(frame?.state==='colon'){if(char!==':')this.syntax('missing colon after member name');frame.state='value';index++;this.offset++;continue;}
   if(frame?.state==='commaOrEnd'){
    if(char===','){frame.state=frame.kind==='array'?'value':'key';index++;this.offset++;continue;}
    if(char===(frame.kind==='array'?']':'}')){index++;this.offset++;this.close();continue;}
    this.syntax('expected comma or container end');
   }
   if(frame?.kind==='array'&&frame.state==='valueOrEnd'&&char===']'){index++;this.offset++;this.close();continue;}
   if(char==='{'){index++;this.offset++;this.open('object');continue;}
   if(char==='['){index++;this.offset++;this.open('array');continue;}
   if(char==='"'){index++;this.offset++;this.beginString(false);continue;}
   if(char==='-'||(char>='0'&&char<='9')||char==='t'||char==='f'||char==='n'){this.mode='atom';this.atom='';continue;}
   this.syntax('expected JSON value');
  }
 }
 finish(){if(this.mode==='atom')this.finishAtom();if(this.mode==='string')this.syntax('unterminated string');if(this.stack.length)this.syntax('unterminated container');if(!this.done)this.syntax('missing JSON value');return this.root;}
}

export async function parseDownloadedBackupJson(chunks,options={}){
 const maxExpandedBytes=limit(options.maxExpandedBytes,Number.MAX_SAFE_INTEGER,'maxExpandedBytes'),parser=new JsonMemberParser(options),decoder=new StringDecoder('utf8');
 let expandedBytes=0,parseError=null;
 // Remember syntax failures while draining the gzip iterator: the old path
 // completed gunzip before JSON.parse, so a later gzip/CRC error must win.
 for await(const bytes of chunks){
  if(!(bytes instanceof Uint8Array))throw new TypeError('Downloaded backup parser chunks must be UTF-8 byte arrays.');
  expandedBytes+=bytes.byteLength;if(!Number.isSafeInteger(expandedBytes)||expandedBytes>maxExpandedBytes)throw resourceError('Downloaded backup exceeds the configured expanded-byte bound.');
  if(!parseError){try{parser.feed(decoder.write(Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength)));}catch(error){if(error.code==='BACKUP_DECODE_RESOURCE_LIMIT')throw error;parseError=error;}}
  options.onProgress?.({expandedBytes,values:parser.values,stringCodeUnits:parser.stringCodeUnits,maxDepth:parser.maxDepth});
 }
 if(parseError)throw parseError;
 parser.feed(decoder.end());const result=parser.finish();options.onProgress?.({expandedBytes,values:parser.values,stringCodeUnits:parser.stringCodeUnits,maxDepth:parser.maxDepth,complete:true});return result;
}

export async function decodeDownloadedBackup(bytes,options={}){
 if(!(bytes instanceof Uint8Array))throw new TypeError('Downloaded backup must be compressed bytes.');
 const source=Readable.from((function*(){for(let offset=0;offset<bytes.byteLength;offset+=CHUNK_BYTES)yield bytes.subarray(offset,offset+CHUNK_BYTES);})()),gunzip=createGunzip({chunkSize:CHUNK_BYTES});
 source.pipe(gunzip);
 try{return await parseDownloadedBackupJson(gunzip,options);}finally{source.destroy();gunzip.destroy();}
}
