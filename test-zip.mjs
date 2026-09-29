// Independent test decoder for the specification's STORE-only ZIP profile.
// This deliberately does not call the application's archive writer.
export function readStoreArchive(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder('utf-8',{fatal:true}),entries=[];
  const check=(condition,message)=>{if(!condition)throw new Error('ZIP_PROFILE: '+message);};
  const u16=offset=>view.getUint16(offset,true),u32=offset=>view.getUint32(offset,true);
  const crc32=data=>{let crc=-1;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^-1)>>>0;};
  let offset=0;
  while(offset+30<=bytes.length&&u32(offset)===0x04034b50){
    check(u16(offset+4)===20&&u16(offset+6)===0x800&&u16(offset+8)===0,'version, flags, or compression');
    check(u16(offset+10)===0&&u16(offset+12)===33&&u16(offset+28)===0,'timestamp or extra fields');
    const size=u32(offset+18),length=u16(offset+26),start=offset+30+length,nameBytes=bytes.slice(offset+30,start),canonicalPath=decoder.decode(nameBytes);
    check(size===u32(offset+22)&&start+size<=bytes.length,'member length');
    check(canonicalPath&&!canonicalPath.endsWith('/')&&!canonicalPath.includes('\\')&&!canonicalPath.startsWith('/')&&!/^[A-Za-z]:/.test(canonicalPath)&&canonicalPath.split('/').every(part=>part&&part!=='.'&&part!=='..'),'unsafe member name');
    const previous=entries.at(-1)?.nameBytes;
    if(previous){let comparison=0;for(let index=0;index<Math.min(previous.length,nameBytes.length);index++)if(previous[index]!==nameBytes[index]){comparison=previous[index]-nameBytes[index];break;}if(!comparison)comparison=previous.length-nameBytes.length;check(comparison<0,'duplicate or unordered member');}
    const data=bytes.slice(start,start+size),crc=u32(offset+14);check(crc32(data)===crc,'member CRC');
    entries.push({canonicalPath,bytes:data,offset,nameBytes,crc});offset=start+size;
  }
  const centralOffset=offset;
  for(const entry of entries){
    check(offset+46<=bytes.length&&u32(offset)===0x02014b50,'missing central directory entry');
    check(u16(offset+4)===20&&u16(offset+6)===20&&u16(offset+8)===0x800&&u16(offset+10)===0&&u16(offset+12)===0&&u16(offset+14)===33,'central profile');
    check(u32(offset+16)===entry.crc&&u32(offset+20)===entry.bytes.length&&u32(offset+24)===entry.bytes.length&&u32(offset+42)===entry.offset,'central member identity');
    check(u16(offset+30)===0&&u16(offset+32)===0&&u16(offset+34)===0&&u16(offset+36)===0&&u32(offset+38)===0,'central extras, comments, disk, or permissions');
    const length=u16(offset+28);check(decoder.decode(bytes.slice(offset+46,offset+46+length))===entry.canonicalPath,'central member name');offset+=46+length;
  }
  check(offset+22===bytes.length&&u32(offset)===0x06054b50,'end record or trailing bytes');
  check(u16(offset+4)===0&&u16(offset+6)===0&&u16(offset+8)===entries.length&&u16(offset+10)===entries.length&&u32(offset+12)===offset-centralOffset&&u32(offset+16)===centralOffset&&u16(offset+20)===0,'end record identity');
  return entries.map(({canonicalPath,bytes})=>({canonicalPath,bytes}));
}
