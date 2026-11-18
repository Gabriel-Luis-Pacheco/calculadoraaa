// Public proxy for the Receita Federal's independent Simples Nacional Java engine.
// All calculations run in the Java motor. No tax rule is implemented in this proxy.
export const config = { maxDuration: 60 };

const READ_ROUTES = new Set([
  'versao',
  'calculadora/simples-nacional/atividades',
  'calculadora/observabilidade/simples-nacional/erros',
]);
const POST_ROUTES = new Set(['calculadora/observabilidade/simples-nacional']);
const ACTIVITY_RE = /^calculadora\/simples-nacional\/atividades\/\d{2}$/;
const COUNTS = new Map();

function failure(res,status,code,detail) {
  res.status(status).json({code,detail});
}
function sameOrigin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && !['same-origin','none'].includes(site)) return false;
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return origin.protocol === 'https:' && origin.host === host;
  } catch {return false}
}
function rateLimit(req,res) {
  const ip = String(req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,100);
  const key = ip+':'+req.method;
  const now = Date.now();
  let item = COUNTS.get(key);
  if (!item || now>item.until) { item={count:0,until:now+60000}; COUNTS.set(key,item); }
  item.count++;
  if(COUNTS.size>3000) {
    for(const [k,v] of COUNTS) {if(v.until<now)COUNTS.delete(k)}
    if(COUNTS.size>3000)COUNTS.delete(COUNTS.keys().next().value);
  }
  if (item.count > (req.method === 'POST' ? 24 : 90)) {
    res.setHeader('Retry-After','60');
    failure(res,429,'RATE_LIMIT','Muitas consultas. Tente novamente em um minuto.');
    return false;
  }
  return true;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','POST'].includes(req.method)) return failure(res,405,'METHOD_NOT_ALLOWED','Método não aceito.');
  const route=req.query.route;
  const allowed=typeof route==='string' && route.length<=140 &&
    (req.method==='GET' ? (READ_ROUTES.has(route)||ACTIVITY_RE.test(route)) : POST_ROUTES.has(route));
  if (!allowed) return failure(res,400,'INVALID_ROUTE','Consulta não permitida.');
  if (req.method==='POST' && !sameOrigin(req)) return failure(res,403,'INVALID_ORIGIN','Envie o cálculo pelo site.');
  if(!rateLimit(req,res))return;
  const base=process.env.RTC_SIMPLES_ENGINE_URL;
  if(!base) return failure(res,503,'SIMPLES_NOT_DEPLOYED','O motor Java de Simples Nacional ainda não foi implantado. O código está disponível no repositório.');
  let target;
  try {
    const url=new URL(base);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('bad url');
    target=new URL(url.pathname.replace(/\/+$/,'')+'/'+route,url.origin);
    for(const [k,v] of Object.entries(req.query)){
      if(k==='route')continue;
      if(!/^[a-zA-Z][a-zA-Z0-9]{0,35}$/.test(k)||typeof v!=='string'||v.length>150)return failure(res,400,'INVALID_QUERY','Parâmetro inválido.');
      target.searchParams.set(k,v);
    }
  }catch{return failure(res,503,'INVALID_ENGINE_URL','Endereço do motor Simples Nacional mal configurado.')}
  let body;
  if (req.method==='POST'){
    body=typeof req.body==='string'?req.body:req.body==null?'':JSON.stringify(req.body);
    if(Buffer.byteLength(body)>250000)return failure(res,413,'TOO_MANY_ITEMS','Operação excede o limite de tamanho.');
    try{const j=JSON.parse(body);if(!j||!Array.isArray(j.itens)||j.itens.length>100)throw Error('invalid');}
    catch{return failure(res,400,'BAD_OPERATION','Informe os itens da operação em formato válido.')}
  }
  const headers={Accept:'application/json'};
  if(req.method==='POST')headers['Content-Type']='application/json';
  if(process.env.RTC_SIMPLES_ENGINE_SHARED_KEY)headers['X-RTC-Engine-Key']=process.env.RTC_SIMPLES_ENGINE_SHARED_KEY;
  try{
    const r=await fetch(target,{method:req.method,headers,body,signal:AbortSignal.timeout(48000),redirect:'error'});
    const text=await r.text(),ct=r.headers.get('content-type')||'';
    if(r.status>=500||ct.includes('text/html')){
      res.setHeader('Retry-After','20');
      return failure(res,503,'ENGINE_STARTING','O motor do Simples Nacional está indisponível ou iniciando. Seus dados permanecem na tela.');
    }
    if(text.length>3_000_000)return failure(res,413,'RESPONSE_TOO_LARGE','A resposta excedeu o tamanho esperado.');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.status(r.status).send(text);
  }catch(e){
    console.warn('Simples engine unavailable:',e?.name||'unknown');
    res.setHeader('Retry-After','20');
    failure(res,503,'ENGINE_STARTING','O motor do Simples Nacional não respondeu. Tente novamente quando estiver disponível.');
  }
}
