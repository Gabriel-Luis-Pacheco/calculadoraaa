import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import regular from '../web/api/rtc.js';
import simples from '../web/api/simples.js';
import iss from '../web/api/iss.js';
function request(method,route,other={}){
 return {method,query:route?{route,...other.query}:{...other.query},headers:{host:'rtc.test',...other.headers},body:other.body,socket:{remoteAddress:other.ip||'198.51.100.38'}};
}
function response(){
 return {statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;return this},status(n){this.statusCode=n;return this},json(x){this.body=x;return this},send(x){this.body=x;return this}};
}
test('Regime Regular official API routes, private engine key and rejected mutations',async()=>{
 const old=globalThis.fetch;
 process.env.RTC_OFFICIAL_ENGINE_URL='https://regular.example/api/calculadora';
 process.env.RTC_ENGINE_SHARED_KEY='super-secret-for-fiscal-java-engine-123';
 let forwarded;
 globalThis.fetch=async(url,opts)=>{forwarded={url:String(url),opts};return new Response('{"version":"1.6.1"}',{status:200,headers:{'content-type':'application/json'}})};
 try{
  for(const route of ['dados-abertos/versao','nfse/indicador-operacao','nfse/local-operacao','dados-abertos/classificacoes-tributarias/ncm-aplicavel']){
   const res=response();await regular(request('GET',route,{query:{data:'2027-01-01'}}),res);
   assert.equal(res.statusCode,200,route);
  }
  for(const route of ['regime-geral','observabilidade/regime-geral','base-calculo/is-mercadorias','base-calculo/cbs-ibs-mercadorias','nfse/base-calculo','nfse/indicador-operacao/validate','pedagio']){
   const res=response();await regular(request('POST',route,{body:{id:'abc',itens:[]},headers:{origin:'https://rtc.test'}}),res);
   assert.equal(res.statusCode,200,route);
  }
  assert.equal(forwarded.opts.headers['X-RTC-Engine-Key'],process.env.RTC_ENGINE_SHARED_KEY);
  const denied=response();await regular(request('GET','admin/remove'),denied);
  assert.equal(denied.statusCode,400);
  const cross=response();await regular(request('POST','pedagio',{headers:{origin:'https://attacker.example'},body:{}}),cross);
  assert.equal(cross.statusCode,403);
 }finally{globalThis.fetch=old}
});
test('Simples Nacional proxy accepts public official DTO and blocks invalid requests',async()=>{
 const old=globalThis.fetch;
 delete process.env.RTC_SIMPLES_ENGINE_URL;
 let res=response();
 await simples(request('GET','versao'),res);
 assert.equal(res.statusCode,503);assert.equal(res.body.code,'SIMPLES_NOT_DEPLOYED');
 process.env.RTC_SIMPLES_ENGINE_URL='https://simple.example/api';
 process.env.RTC_SIMPLES_ENGINE_SHARED_KEY='internal-simple-secret';
 let forwarded;
 globalThis.fetch=async(url,opts)=>{forwarded={url:String(url),opts};return new Response('{"objetos":[],"total":{}}',{status:200,headers:{'content-type':'application/json'}})};
 try{
  res=response();await simples(request('GET','calculadora/simples-nacional/atividades',{query:{data:'2027-01-01',tpDoc:'55'}}),res);
  assert.equal(res.statusCode,200);
  assert.match(forwarded.url,/api\/calculadora\/simples-nacional\/atividades/);
  res=response();await simples(request('POST','calculadora/observabilidade/simples-nacional',{
   headers:{origin:'https://rtc.test'},body:{id:'test',data:'2027-03-15',CRT:'1',itens:[{numero:1,cAtivSN:'01',cClassTrib:'000001',baseCalculo:'1000.00'}]}
  }),res);
  assert.equal(res.statusCode,200);
  assert.equal(forwarded.opts.headers['X-RTC-Engine-Key'],'internal-simple-secret');
  assert.match(forwarded.opts.body,/"cClassTrib":"000001"/);
  res=response();await simples(request('POST','calculadora/observabilidade/simples-nacional',{headers:{'sec-fetch-site':'cross-site'},body:{itens:[{}]}}),res);
  assert.equal(res.statusCode,403);
  res=response();await simples(request('POST','calculadora/observabilidade/simples-nacional',{body:{itens:[]}}),res);
  assert.equal(res.statusCode,200);
  res=response();await simples(request('GET','calculadora/admin/delete'),res);
  assert.equal(res.statusCode,400);
 }finally{globalThis.fetch=old}
});
function tinyZip(){
 const name=Buffer.from('RS.csv');
 const csv=Buffer.from('codigo_ibge;uf;nome_municipio;codigo_servico;incidencia;aliquota;dt_ini;dt_fim\n4300034;RS;Aceguá;01.01.01.000;01.01.01.000;5;2026-01-01T00:00:00;\n','utf8');
 const deflate=deflateRawSync(csv);
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(8,8);local.writeUInt32LE(deflate.length,18);local.writeUInt32LE(csv.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(8,10);central.writeUInt32LE(deflate.length,20);central.writeUInt32LE(csv.length,24);central.writeUInt16LE(name.length,28);
 const size=central.length+name.length,offset=local.length+name.length+deflate.length;
 const eocd=Buffer.alloc(22);eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(1,8);eocd.writeUInt16LE(1,10);eocd.writeUInt32LE(size,12);eocd.writeUInt32LE(offset,16);
 return Buffer.concat([local,name,deflate,central,name,eocd]);
}
test('ISS API returns health and municipality/service from official CSV ZIP structure',async()=>{
 let res=response();await iss(request('GET',null,{query:{health:'1'}}),res);
 assert.equal(res.statusCode,200);assert.equal(res.body.extraction,'2026-09-03');
 res=response();await iss(request('GET',null,{query:{uf:'ZZ'}}),res);assert.equal(res.statusCode,400);
 const old=globalThis.fetch;
 const zip=tinyZip();
 globalThis.fetch=async()=>new Response(zip,{status:200,headers:{'content-type':'application/zip'}});
 try{
  res=response();await iss(request('GET',null,{query:{uf:'RS'}}),res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body.cities,[['4300034','Aceguá']]);
  res=response();await iss(request('GET',null,{query:{uf:'RS',ibge:'4300034'}}),res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body.services,[['01.01.01.000','5','2026-01-01','']]);
 }finally{globalThis.fetch=old}
});
