// Public fiscal interface. The Render engine key stays server-side.
 // Each serverless instance uses an in-memory, best-effort abuse limiter.

export const config={maxDuration:60};

const ALLOWED_GET=/^(?:dados-abertos\/[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+){0,5}|observabilidade\/erros|xml\/(?:generate|validate))$/;
const ALLOWED_POST=new Set([
 'regime-geral','observabilidade/regime-geral',
 'base-calculo/base-calculo-unificada',
 'base-calculo/base-calculo-unificada-nfse',
 'base-calculo/base-calculo-is','base-calculo/base-calculo-cibs',
 'xml/generate','xml/validate'
]);

const usage = new Map();
const WINDOW_MS = 60_000;
const MAX_USAGE_BUCKETS = 5000;
function limitRequests(req) {
 const raw = req.headers['x-vercel-forwarded-for'] ||
   req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
 const ip = String(Array.isArray(raw)?raw[0]:raw).split(',')[0].trim().slice(0,90);
 const key = ip + ':' + req.method;
 const now = Date.now();
 let bucket = usage.get(key);
 if (!bucket || now >= bucket.until) {
  bucket = { count:0, until:now+WINDOW_MS };
  usage.set(key,bucket);
 }
 bucket.count++;
 if(usage.size>MAX_USAGE_BUCKETS){
  for(const [k,value] of usage) if(value.until<now)usage.delete(k);
  if(usage.size>MAX_USAGE_BUCKETS)usage.delete(usage.keys().next().value);
 }
 return bucket.count <= (req.method==='POST'?24:90);
}
function sameOriginPost(req){
 const site=req.headers['sec-fetch-site'];
 if(site && site!=='same-origin' && site!=='none')return false;
 const origin=req.headers.origin;
 if(!origin)return true;
 try {
  const u = new URL(origin);
  const host=req.headers['x-forwarded-host'] || req.headers.host;
  return (u.protocol==='https:' || u.hostname==='localhost') &&
    u.host === host;
 } catch {return false}
}
function fail(res,status,code,detail) {
 return res.status(status).json({code,detail});
}

export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method))return fail(res,405,'METHOD_NOT_ALLOWED','Método não permitido.');
 const route=req.query?.route;
 if(typeof route!=='string'||route.length>180||
  !(req.method==='GET'?ALLOWED_GET.test(route):ALLOWED_POST.has(route)))
  return fail(res,400,'INVALID_ROUTE','Consulta não permitida.');
 // No browser login: any visitor may use the safe, allowlisted routes.
 // This key is injected exclusively by the server to protect the Render engine.
 const backendToken=process.env.RTC_ENGINE_SHARED_KEY;
 if(!backendToken || backendToken.length<32)
  return fail(res,503,'ENGINE_PROTECTION_REQUIRED','Motor fiscal não configurado.');
 if(req.method==='POST'&&!sameOriginPost(req))
  return fail(res,403,'BAD_ORIGIN','Envie o cálculo pelo site oficial.');
 if(!limitRequests(req)){
  res.setHeader('Retry-After','60');
  return fail(res,429,'RATE_LIMIT','Muitas consultas em pouco tempo. Tente novamente em um minuto.');
 }
 let remote;
 try {
  const base=new URL(process.env.RTC_OFFICIAL_ENGINE_URL||'');
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!base.pathname.endsWith('/api/calculadora'))
   throw Error('Invalid URL');
  remote=new URL(base.href.replace(/\/+$/,'')+'/'+route);
 } catch {return fail(res,503,'ENGINE_URL_INVALID','Endereço do motor fiscal não configurado.')}
 for(const [k,v]of Object.entries(req.query||{})) {
  if(k==='route')continue;
  if(!/^[a-zA-Z]{1,45}$/.test(k)||typeof v!=='string'||v.length>120)
   return fail(res,400,'BAD_QUERY','Parâmetro de consulta inválido.');
  remote.searchParams.set(k,v);
 }
 let body;
 if(req.method==='POST'){
  body=typeof req.body==='string'?req.body:Buffer.isBuffer(req.body)?req.body.toString('utf8'):req.body!=null?JSON.stringify(req.body):'';
  if(Buffer.byteLength(body,'utf8')>900000)return fail(res,413,'PAYLOAD_TOO_LARGE','Arquivo ou operação excede o tamanho permitido.');
 }
 try{
  const upstream=await fetch(remote,{
   method:req.method,
   headers:{
    'Accept':route==='xml/generate'?'application/xml':'application/json',
    'Content-Type':route==='xml/validate'?'application/xml':'application/json',
    'X-RTC-Engine-Key':backendToken
   },
   body,signal:AbortSignal.timeout(47000),redirect:'error'
  });
  const txt=await upstream.text();
  const ct=(upstream.headers.get('content-type')||'').toLowerCase();
  if(upstream.status>=500||ct.includes('text/html')||txt.startsWith('<html')||txt.startsWith('<!DOCTYPE html')){
   res.setHeader('Retry-After','20');
   console.warn('RTC unavailable',upstream.status,ct.slice(0,50));
   return fail(res,503,'ENGINE_STARTING','O motor Java está indisponível ou iniciando no Render. No plano gratuito, isso pode levar alguns minutos. Seus dados preenchidos foram preservados.');
  }
  if(txt.length>4_000_000)return fail(res,413,'RESPONSE_TOO_LARGE','A consulta retornou dados demais. Utilize uma pesquisa mais específica.');
  const warning=upstream.headers.get('x-warning-dados-simulados');
  if(warning)res.setHeader('X-Warning-Dados-Simulados',warning.slice(0,300));
  res.setHeader('Content-Type',(upstream.headers.get('content-type')||'application/json').split(';')[0]);
  res.setHeader('X-RTC-Origin','Receita Federal RTC open source, self-hosted');
  return res.status(upstream.status).send(txt);
 }catch(e){
  console.error('RTC connection error',e?.name||'unknown');
  res.setHeader('Retry-After','20');
  return fail(res,503,'ENGINE_STARTING','O motor Java não respondeu. Pode estar iniciando no Render. Aguarde e tente novamente; os campos preenchidos foram preservados.');
 }
}