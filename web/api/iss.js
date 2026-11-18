// Consulta pública de alíquotas de ISS, extração NFS-e 2026-09-03.
// Arquivo oficial: https://www.gov.br/nfse/pt-br/biblioteca/aliquotas
// Esta base é um snapshot, NÃO substitui consulta à legislação municipal atual.
import {inflateRawSync} from 'node:zlib';
export const config = {maxDuration:60};
const UF = new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
const URL_ZIP='https://www.gov.br/nfse/pt-br/biblioteca/aliquotas/aliquotas-municipios-20260903-extr1.zip';
const EXTRACTION='2026-09-03';
let zipPromise;
const stateCache=new Map();

function error(res,code,message,status=400){return res.status(status).json({error:message,code,extraction:EXTRACTION})}
function getZIP(){
 if(!zipPromise){
  zipPromise=(async()=>{
   const response=await fetch(URL_ZIP,{
    headers:{'User-Agent':'Mozilla/5.0 (compatible; RTC-ISS/1.0; consulta fiscal)','Referer':'https://www.gov.br/nfse/pt-br/biblioteca/aliquotas','Accept':'application/zip,application/octet-stream'},
    signal:AbortSignal.timeout(37000)
   });
   if(!response.ok)throw Error('A base oficial de ISS não respondeu (HTTP '+response.status+').');
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length<1000||bytes.length>40_000_000)throw Error('Arquivo oficial possui tamanho inesperado.');
   return bytes;
  })().catch(e=>{zipPromise=null;throw e});
 }
 return zipPromise;
}
function extractState(zip,uf){
 const eocdSig=0x06054b50,centralSig=0x02014b50,localSig=0x04034b50;
 let eocd=-1;
 for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--){
  if(zip.readUInt32LE(i)===eocdSig){eocd=i;break}
 }
 if(eocd<0)throw Error('Estrutura ZIP oficial inválida.');
 const n=zip.readUInt16LE(eocd+10),offset=zip.readUInt32LE(eocd+16);
 let pos=offset;
 for(let i=0;i<n;i++){
  if(zip.readUInt32LE(pos)!==centralSig)throw Error('Cabeçalho ZIP inválido.');
  const compression=zip.readUInt16LE(pos+10),compressed=zip.readUInt32LE(pos+20);
  const uncompressed=zip.readUInt32LE(pos+24);
  const nameLen=zip.readUInt16LE(pos+28),extraLen=zip.readUInt16LE(pos+30),commentLen=zip.readUInt16LE(pos+32);
  const local=zip.readUInt32LE(pos+42),name=zip.toString('utf8',pos+46,pos+46+nameLen);
  pos+=46+nameLen+extraLen+commentLen;
  if(name===uf+'.csv'||name.endsWith('/'+uf+'.csv')){
   if(uncompressed>50_000_000)throw Error('Base estadual maior que o esperado.');
   if(zip.readUInt32LE(local)!==localSig)throw Error('Entrada ZIP inválida.');
   const dataStart=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
   const slice=zip.subarray(dataStart,dataStart+compressed);
   const raw=compression===8?inflateRawSync(slice):compression===0?slice:null;
   if(!raw)throw Error('Algoritmo ZIP não suportado.');
   return raw.toString('utf8').replace(/^\uFEFF/,'');
  }
 }
 throw Error('UF não encontrada no arquivo da NFS-e.');
}
function parse(csv,uf){
 const cities=new Map(),servicesByCity=new Map(),lines=csv.split(/\r?\n/);
 const header=lines[0].split(';');
 const names=['codigo_ibge','uf','nome_municipio','codigo_servico','incidencia','aliquota','dt_ini','dt_fim'];
 const at=Object.fromEntries(names.map(n=>[n,header.indexOf(n)]));
 if(names.some(n=>at[n]<0))throw Error('Layout do CSV oficial inesperado.');
 for(let i=1;i<lines.length;i++){
  if(!lines[i])continue;
  const c=lines[i].split(';'),ibge=c[at.codigo_ibge],name=c[at.nome_municipio];
  if(!/^\d{7}$/.test(ibge)||!name||c[at.uf]!==uf)continue;
  cities.set(ibge,name);
  const rate=(c[at.aliquota]||'').trim().replace(',','.');
  const service=(c[at.codigo_servico]||'').trim();
  if(!/^\d+(?:\.\d+)?$/.test(rate)||!/^\d{2}\.\d{2}\.\d{2}\.\d{3}$/.test(service))continue;
  let rows=servicesByCity.get(ibge);
  if(!rows){rows=[];servicesByCity.set(ibge,rows)}
  rows.push([service,rate,(c[at.dt_ini]||'').slice(0,10),(c[at.dt_fim]||'').slice(0,10)]);
 }
 return {
  cities:[...cities].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')),
  servicesByCity
 };
}
async function getState(uf){
 if(stateCache.has(uf))return stateCache.get(uf);
 const loading=getZIP().then(zip=>parse(extractState(zip,uf),uf)).catch(e=>{stateCache.delete(uf);throw e});
 stateCache.set(uf,loading);
 while(stateCache.size>2){const key=stateCache.keys().next().value; if(key!==uf)stateCache.delete(key);else break}
 return loading;
}
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=172800');
 if(req.method!=='GET')return error(res,'METHOD_NOT_ALLOWED','Esta consulta aceita somente GET.',405);
 if(req.query.health==='1')return res.status(200).json({ok:true,source:URL_ZIP,extraction:EXTRACTION});
 const uf=typeof req.query.uf==='string'?req.query.uf.toUpperCase():'';
 if(!UF.has(uf))return error(res,'INVALID_UF','UF não informada ou inválida.');
 const ibge=req.query.ibge;
 if(ibge!==undefined&&(typeof ibge!=='string'||!/^\d{7}$/.test(ibge)))return error(res,'INVALID_IBGE','Informe o código IBGE com 7 dígitos.');
 try{
  const state=await getState(uf);
  if(!ibge)return res.status(200).json({uf,extraction:EXTRACTION,cities:state.cities});
  if(!state.cities.some(row=>row[0]===ibge))return error(res,'CITY_NOT_FOUND','Município ausente na extração oficial.',404);
  const services=state.servicesByCity.get(ibge)||[];
  return res.status(200).json({uf,ibge,municipio:state.cities.find(x=>x[0]===ibge)[1],extraction:EXTRACTION,services});
 }catch(e){
  console.warn('ISS official data unavailable:',e?.message?.slice(0,180));
  res.setHeader('Cache-Control','no-store');
  return error(res,'SOURCE_UNAVAILABLE','Não foi possível consultar a base oficial de ISS. Informe a alíquota manualmente e confira a legislação municipal.',503);
 }
}
