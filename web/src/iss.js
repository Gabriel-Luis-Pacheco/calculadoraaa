const UF = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
import { RS_CITIES, CAMPO_BOM_SERVICES } from './iss-rs-bundle.js';
const SOURCE = 'https://www.gov.br/nfse/pt-br/biblioteca/aliquotas';
const CODES_SOURCE = 'https://www.gov.br/nfse/pt-br/mei-e-demais-empresas/codigos-de-tributacao-nacional-nbs';
const SERVICE_LABELS = {
  '01.01.01.000':'Análise e desenvolvimento de sistemas',
  '01.02.01.000':'Programação',
  '01.03.01.000':'Processamento de dados e sistemas',
  '01.03.02.000':'Armazenamento e hospedagem de dados e sistemas',
  '01.04.01.000':'Elaboração de programas e aplicativos',
  '01.05.01.000':'Licenciamento de softwares',
  '01.06.01.000':'Assessoria e consultoria em informática',
  '01.07.01.000':'Suporte técnico e manutenção de sistemas',
  '01.08.01.000':'Criação e manutenção de sites',
  '01.09.01.000':'Disponibilização de conteúdo de áudio online',
  '01.09.02.000':'Disponibilização de vídeos, imagens e textos online'
};
const labelService = code => SERVICE_LABELS[code] ? `${SERVICE_LABELS[code]} — ${code}` : code;
const TODAY = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
let ctx = { uf:'', ibge:'', service:'', date:TODAY(), mode:'auto' };
let mountId = 0;
let cachedCities = new Map();
let cachedMunicipio = new Map();

export function issLookupMarkup() {
  return `<details class="iss-lookup" id="iss-lookup" ${ctx.uf ? 'open' : ''}>
    <summary class="iss-toggle"><span>Consultar ISS por município e serviço</span><span class="iss-tag">Base NFS-e ↗</span></summary><div class="iss-body">
    <div class="iss-grid">
      <label>UF<select id="iss-uf"><option value="">Selecione</option>${UF.map(x => `<option value="${x}">${x}</option>`).join('')}</select></label>
      <label>Município<select id="iss-city" disabled><option value="">Selecione a UF</option></select></label>
      <label>Serviço (NFS-e)<select id="iss-service" disabled><option value="">Selecione o município</option></select></label>
      <label>Data de competência<input type="date" id="iss-date"></label>
    </div>
    <p id="iss-status" class="iss-status" role="status">Selecione UF, município e serviço para obter a alíquota.</p>
    <button class="iss-retry" type="button" id="iss-retry" hidden>Tentar consulta novamente</button>
    <small>Fonte: <a href="${SOURCE}" target="_blank" rel="noopener noreferrer">Alíquotas NFS-e</a> · <a href="${CODES_SOURCE}" target="_blank" rel="noopener noreferrer">Códigos dos serviços</a> · Extração 03/09/2026. Confira a classificação e o município de incidência. O ISS permanece editável.</small>
    </div>
  </details>`;
}
export function restoreISSHash(q) {
  ctx = {
    uf: UF.includes(q.get('issUf')) ? q.get('issUf') : '',
    ibge: /^\d{7}$/.test(q.get('issIbge') || '') ? q.get('issIbge') : '',
    service: /^\d{2}\.\d{2}\.\d{2}\.\d{3}$/.test(q.get('issServico') || '') ? q.get('issServico') : '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(q.get('issData') || '') ? q.get('issData') : TODAY(),
    mode: q.get('issManual') === '1' ? 'manual' : 'auto'
  };
}
export function writeISSHash(q) {
  if (ctx.uf) q.set('issUf',ctx.uf);
  if (ctx.ibge) q.set('issIbge',ctx.ibge);
  if (ctx.service) q.set('issServico',ctx.service);
  if (ctx.uf || ctx.ibge || ctx.service) q.set('issData',ctx.date);
  if (ctx.mode === 'manual' && ctx.service) q.set('issManual','1');
}
export function markISSManual() {
  ctx.mode = 'manual';
  const el = document.querySelector('#iss-status');
  if(el && ctx.service) { el.textContent='Alíquota alterada manualmente. Mude um filtro para consultar novamente.'; el.dataset.kind='info'; }
}
export function resetISS() {
  ctx = {uf:'',ibge:'',service:'',date:TODAY(),mode:'auto'};
}
async function load(url) {
  // Arquivo oficial carregado via API externa: nunca deixar o formulário pendente indefinidamente.
  const cacheKey='rtc-iss:extr20260903:'+url;
  try {
    const saved=sessionStorage.getItem(cacheKey);
    if(saved) return JSON.parse(saved);
  } catch {}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),16000);
  try {
    const res=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||'Consulta indisponível');
    try {sessionStorage.setItem(cacheKey,JSON.stringify(data))} catch {}
    return data;
  } catch(error) {
    if(error.name==='AbortError') throw new Error('O servidor demorou para responder. Tente novamente ou informe o ISS manualmente.');
    throw error;
  } finally {clearTimeout(timer)}
}
function option(v,text) {
  const el=document.createElement('option');
  el.value=v;el.textContent=text;return el;
}
function fillSelect(el, items, placeholder) {
  el.replaceChildren(option('',placeholder));
  for(const [v,text] of items) el.append(option(v,text));
  el.disabled = !items.length;
}
export function mountISSLookup(onRate, onContextChanged = () => {}) {
  const root=document.getElementById('iss-lookup');
  if (!root) return;
  const id=++mountId;
  const uf=root.querySelector('#iss-uf'), city=root.querySelector('#iss-city'),
        service=root.querySelector('#iss-service'), date=root.querySelector('#iss-date'),
        status=root.querySelector('#iss-status'), retry=root.querySelector('#iss-retry');
  const current=()=>id===mountId && root.isConnected;
  function message(t,kind='info'){ if(!current()) return;status.textContent=t;status.dataset.kind=kind;retry.hidden=true; }
  let rows=[];
  let cityRequest=0, ufRequest=0;
  const apply=()=>{
    if(!ctx.ibge || !ctx.service) { message('Selecione município e serviço. Até lá, o ISS permanece manual.'); return; }
    const valid=rows.filter(r=>r[0]===ctx.service && r[2] <= ctx.date && (!r[3] || r[3]>=ctx.date)).sort((a,b)=>b[2].localeCompare(a[2]));
    if (!valid.length) { message('Sem alíquota vigente para esse serviço e data. Confira o ISS manualmente.','warn'); return; }
    if(valid[0][1]===null || !Number.isFinite(valid[0][1])) { message('Alíquota não informada na base oficial. Preencha o ISS manualmente.','warn'); return; }
    const aliquota=valid[0][1];
    if (aliquota<0 || aliquota>100) {message('Valor oficial fora do intervalo esperado. Verifique manualmente.','warn');return;}
    message('ISS de '+aliquota.toLocaleString('pt-BR',{maximumFractionDigits:4})+'% aplicado automaticamente · vigência desde '+valid[0][2].split('-').reverse().join('/')+'.','ok');
    if(ctx.mode==='auto') onRate(aliquota);
    else message('ISS informado manualmente. Alíquota oficial: '+aliquota.toLocaleString('pt-BR')+'%.','info');
  };
  async function loadCity() {
    const ticket=++cityRequest;
    const selectedUf=ctx.uf, selectedIbge=ctx.ibge;
    rows=[];
    fillSelect(service,[],ctx.ibge?'Carregando serviços…':'Selecione o município');
    if(!ctx.ibge){message('Selecione o município.');return;}
    message('Consultando os serviços oficiais…');
    const key=ctx.uf+':'+ctx.ibge;
    try {
      let data;
      if (key==='RS:4303905') data={services:CAMPO_BOM_SERVICES};
      else {
        if(!cachedMunicipio.has(key)) cachedMunicipio.set(key,load('/api/iss?uf='+encodeURIComponent(ctx.uf)+'&ibge='+encodeURIComponent(ctx.ibge)));
        data=await cachedMunicipio.get(key);
      }
      if(!current() || ticket!==cityRequest || ctx.uf!==selectedUf || ctx.ibge!==selectedIbge) return;
      rows=data.services||[];
      const codes=[...new Set(rows.map(r=>r[0]))].sort();
      fillSelect(service,codes.map(code=>[code,labelService(code)]),'Selecione o serviço prestado');
      if(codes.includes(ctx.service)) service.value=ctx.service;
      else ctx.service='';
      apply();
    } catch(e) {
      cachedMunicipio.delete(key);
      if(current() && ticket===cityRequest && ctx.ibge===selectedIbge) {
        fillSelect(service,[], 'Consulta indisponível — tente novamente');
        message(e.message||'Não foi possível consultar a base oficial. Informe o ISS manualmente.','warn');
        retry.hidden=false;
      }
    }
  }
  async function loadUf() {
    const ticket=++ufRequest;
    ++cityRequest;
    const selectedUf=ctx.uf;
    fillSelect(city,[],ctx.uf?'Carregando municípios…':'Selecione a UF');
    fillSelect(service,[],'Selecione o município');
    if(!ctx.uf){ message('Selecione a UF para consultar o ISS.');return; }
    message('Carregando municípios da base oficial…');
    try {
      let data;
      if(ctx.uf==='RS') data={cities:RS_CITIES};
      else {
        if(!cachedCities.has(ctx.uf)) cachedCities.set(ctx.uf,load('/api/iss?uf='+encodeURIComponent(ctx.uf)));
        data=await cachedCities.get(ctx.uf);
      }
      if(!current() || ticket!==ufRequest || ctx.uf!==selectedUf) return;
      const list=data.cities||[];
      fillSelect(city,list,'Selecione o município');
      if(list.some(([code])=>code===ctx.ibge)) city.value=ctx.ibge;
      else ctx.ibge='';
      await loadCity();
    } catch(e) {
      cachedCities.delete(ctx.uf);
      if(current() && ticket===ufRequest && ctx.uf===selectedUf) {
        fillSelect(city,[], 'Consulta indisponível — escolha outra UF');
        message(e.message||'Consulta oficial indisponível. O ISS pode ser preenchido manualmente.','warn');
        retry.hidden=false;
      }
    }
  }
  retry.addEventListener('click',()=>{
    retry.hidden=true;
    if(ctx.ibge){cachedMunicipio.delete(ctx.uf+':'+ctx.ibge); loadCity();}
    else if(ctx.uf){cachedCities.delete(ctx.uf); loadUf();}
  });
  uf.value=ctx.uf;date.value=ctx.date;
  uf.addEventListener('change',()=>{ctx.uf=uf.value;ctx.ibge='';ctx.service='';ctx.mode='auto';onContextChanged();loadUf();});
  city.addEventListener('change',()=>{ctx.ibge=city.value;ctx.service='';ctx.mode='auto';onContextChanged();loadCity();});
  service.addEventListener('change',()=>{ctx.service=service.value;ctx.mode='auto';apply();onContextChanged();});
  date.addEventListener('change',()=>{if(date.value){ctx.date=date.value;ctx.mode='auto';apply();onContextChanged();}});
  if(ctx.uf) loadUf();
}
