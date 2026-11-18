(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const moneyBR = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  const s = String(value).replace(',', '.').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return '—';
  const neg = s.startsWith('-') ? '-' : '';
  const [int, dec=''] = s.replace('-', '').split('.');
  return neg + 'R$ ' + int.replace(/\B(?=(\d{3})+(?!\d))/g,'.') + ',' + (dec+'00').slice(0,2);
};
const decimalBR = value => {
  const s = String(value??'').trim();
  if (!s) return '—';
  return s.replace('.',',');
};
const escapeHTML = str => String(str??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const icon = name => '<svg aria-hidden="true"><use href="#ic-'+name+'"/></svg>';
const uniqueId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g,'');
  return (Date.now().toString(16) + Math.floor(Math.random()*1e9).toString(16)).padEnd(32,'0').slice(0,32);
};
function invalidateStrict(){state.lastStrict=null;state.lastXml='';const save=$('xml-save');if(save)save.disabled=true}
const initialItem = () => ({kind:'produto',ncm:'',nbs:'',cst:'',cClassTrib:'',base:'',quantity:'',unit:'',cbs:'',ibsUf:'',ibsMun:'',hasIS:false,isCst:'',isClass:'',isBase:'',isAmount:'',isQuantity:'',isUnit:'',isAdValorem:'',isAdRem:''});
const sampleItems = () => ([
 {kind:'produto',ncm:'10063021',nbs:'',cst:'200',cClassTrib:'200003',base:'100,00',quantity:'20',unit:'KG',cbs:'8,8',ibsUf:'0,05',ibsMun:'0,05',hasIS:false,isCst:'',isClass:'',isBase:'',isAmount:'',isQuantity:'',isUnit:'',isAdValorem:'',isAdRem:''},
 {kind:'servico',ncm:'',nbs:'122011200',cst:'200',cClassTrib:'200028',base:'1200,00',quantity:'',unit:'',cbs:'8,8',ibsUf:'0,05',ibsMun:'0,05',hasIS:false,isCst:'',isClass:'',isBase:'',isAmount:'',isQuantity:'',isUnit:'',isAdValorem:'',isAdRem:''}
]);
const state={page:'operacao',authorized:true,connected:false,busy:false,pageResults:{},items:[initialItem()],result:null,resultKind:null,lastStrict:null,lastXml:'',xmlUpload:null,lookupRows:[],lookupPage:0,sequence:0};

const baseDefs = [
 ['vProd','Valor dos produtos / serviços','1000,00'],
 ['vFrete','Frete','50,00'],
 ['vSeg','Seguro','20,00'],
 ['vOutro','Outras despesas','10,00'],
 ['vDesc','Desconto incondicional','50,00'],
 ['vIS','Imposto Seletivo (IS)','30,00'],
 ['vII','Imposto de importação (II)','0,00'],
 ['vICMS','ICMS','180,00'],
 ['vFCP','Fundo de Combate à Pobreza (FCP)','10,00'],
 ['vPIS','PIS','9,25'],
 ['vCOFINS','COFINS','46,25'],
 ['vICMSUFDest','ICMS para UF de destino','0,00'],
 ['vFCPUFDest','FCP para UF de destino','0,00'],
 ['vICMSMono','ICMS monofásico','0,00'],
 ['vISSQN','ISSQN (apenas serviços)','0,00']
];
const nfseDefs = [
 ['vServ','Valor dos serviços','1000,00'],
 ['vDescIncond','Desconto incondicional','50,00'],
 ['vISSQN','ISSQN destacado','30,00'],
 ['vPIS','PIS','9,25'],
 ['vCOFINS','COFINS','46,25']
];
const nfseLocacaoDefs = [
 ['pCopropriedade','Copropriedade (%)','100'],
 ['vTotOper','Valor total da locação','5000,00'],
 ['vDescIncondTot','Desconto total','500,00'],
 ['somaAjustesLocImoveis','Total dos ajustes de locação','100,00']
];
const demoBase={vProd:'1000,00',vFrete:'50,00',vSeg:'20,00',vOutro:'10,00',vDesc:'50,00',vIS:'30,00',vICMS:'180,00',vFCP:'10,00',vPIS:'9,25',vCOFINS:'46,25'};
const fields = defs => defs.map(([key,label,placeholder]) => '<label class="field">'+escapeHTML(label)+'<input type="text" data-money="'+escapeHTML(key)+'" inputmode="decimal" autocomplete="off" placeholder="'+escapeHTML(placeholder)+'" aria-label="'+escapeHTML(label)+'"></label>').join('');
$('base-money-fields').innerHTML=fields(baseDefs);
$('nfse-money-fields').innerHTML=fields(nfseDefs);
$('nfse-locacao-grid').innerHTML=fields(nfseLocacaoDefs);

let toastHandle;
let healthBusy=false,retryTimer=null,retryAttempts=0;
function toast(msg){const box=$('toast');box.textContent=msg;box.hidden=false;clearTimeout(toastHandle);toastHandle=setTimeout(()=>box.hidden=true,4400)}
function statusConnection(status,label){
 const btn=$('connection-trigger');
 btn.classList.toggle('connected',status);
 $('connection-label').textContent=label;
 state.connected=status;
 const banner=$('engine-notice'), title=$('engine-notice-title'),info=$('engine-notice-text'),action=$('engine-notice-action');
 if(status){banner.hidden=true;return}
 banner.hidden=false;
 banner.dataset.state='starting';
 title.textContent='Conexão automática com o motor fiscal';
 info.textContent='O serviço Java está iniciando ou indisponível. No plano gratuito do Render, a inicialização pode levar alguns minutos. Seus campos ficam disponíveis e são preservados.';
 action.textContent='Verificar novamente';
}
function setLoading(on){
 state.busy=on;
 $$('button.primary-button').forEach(b=>b.disabled=on);
}
function scheduleEngineCheck(){
 if(state.connected||retryTimer||retryAttempts>=18)return;
 retryTimer=setTimeout(()=>{retryTimer=null;checkEngine()},16000);
}
async function checkEngine(){
 if(healthBusy)return;
 healthBusy=true;retryAttempts++;
 statusConnection(false,'Verificando motor…');
 try{
  const r=await fetch('/api/rtc?route=dados-abertos%2Fversao',{
   cache:'no-store',signal:AbortSignal.timeout(20000)
  });
  if(r.ok){
   clearTimeout(retryTimer);retryTimer=null;retryAttempts=0;
   statusConnection(true,'Motor conectado');
  }else{
   statusConnection(false,'Motor iniciando…');
   scheduleEngineCheck();
  }
 }catch{
  statusConnection(false,'Motor iniciando…');
  scheduleEngineCheck();
 }finally{healthBusy=false}
}
$('engine-notice-action').addEventListener('click',()=>{
 retryAttempts=0;clearTimeout(retryTimer);retryTimer=null;checkEngine();
});
function getMessage(payload,fallback){
 if(typeof payload === 'string')return payload.slice(0,600);
 if(!payload || typeof payload!=='object')return fallback;
 if(payload.detail && typeof payload.detail==='string')return payload.detail;
 if(payload.message && typeof payload.message==='string')return payload.message;
 if(payload.title && typeof payload.title==='string')return payload.title;
 if(payload.erro)return String(payload.erro);
 if(payload.code)return 'Código de erro: '+payload.code;
 return fallback;
}
async function api(route,{method='GET',body=null,params={}}={}){
 if(state.busy)return null;
 setLoading(true);
 try{
  const qs=new URLSearchParams({route,...params});
  const response=await fetch('/api/rtc?'+qs.toString(),{
   method,cache:'no-store',
   headers:method==='POST'?{'Content-Type':'text/plain;charset=UTF-8'}:{},
   body:method==='POST'?body:null,signal:AbortSignal.timeout(58000)
  });
  const text=await response.text();
  let data;try{data=JSON.parse(text)}catch{data=text}
  if(!response.ok){
   if([502,503,504].includes(response.status)){
    statusConnection(false,'Motor iniciando…');scheduleEngineCheck();
    showError('Motor fiscal indisponível no momento',
      {detail:'O motor Java pode estar iniciando no Render. Não é necessário entrar nem informar senha: a conexão é automática. Os campos preenchidos continuam na tela.'},response.status);
    return null;
   }
   showError('Não foi possível concluir a operação',data,response.status);
   return null;
  }
  statusConnection(true,'Motor conectado');
  return {data,warning:response.headers.get('x-warning-dados-simulados'),status:response.status};
 }catch{
  statusConnection(false,'Motor iniciando…');scheduleEngineCheck();
  showError('Não foi possível comunicar com o motor fiscal',
   {detail:'O serviço não respondeu. Pode estar iniciando no Render. A conexão é automática; seus dados foram mantidos.'},0);
  return null;
 }finally{setLoading(false)}
}
function showResult(title,html,{kind,data,meta='',csvRows=[]}={}){
 state.result=data;state.resultKind=kind;state.csvRows=csvRows;
 $('results').hidden=false;
 $('results-title').textContent=title;
 $('results-meta').textContent=meta||'Resposta recebida do motor RTC conectado.';
 $('results-body').innerHTML='<div class="result-section-inner">'+html+'</div>';
 $('results-csv').disabled=csvRows.length===0;
 $('results-raw').disabled=data==null;
 state.pageResults[state.page]={title,html,kind,data,meta,csvRows};
 $('results').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function showError(title,payload,httpStatus=0){
 let details = [];
 if(payload && typeof payload==='object'){
  if(Array.isArray(payload.errors))details=payload.errors;
  else if(Array.isArray(payload.erros))details=payload.erros;
  else if(Array.isArray(payload.violations))details=payload.violations;
 }
 const errString=details.slice(0,10).map(o=>'<li>'+escapeHTML(getMessage(o,'Inconsistência informada pelo motor.'))+'</li>').join('');
 const msg=getMessage(payload,'Verifique os dados preenchidos e tente novamente.');
 const note=httpStatus?'HTTP '+httpStatus+' · O motor não retornou cálculo válido.':'Nenhum tributo calculado.';
 showResult(title,'<div class="result-error"><strong>'+escapeHTML(msg)+'</strong><span>'+escapeHTML(note)+'</span>'+(errString?'<ul>'+errString+'</ul>':'')+'</div>',{kind:'error',data:payload,meta:'Corrija os dados ou verifique a disponibilidade do serviço.'});
}

function itemField(i,key,label,ph,extra=''){
 return '<label class="field '+extra+'">'+escapeHTML(label)+'<input type="text" data-item-field="'+escapeHTML(key)+'" data-i="'+i+'" inputmode="'+(/^(?:ncm|nbs|cst|cClassTrib|unit|isUnit|isClass|isCst)$/.test(key)?'text':'decimal')+'" autocomplete="off" value="'+escapeHTML(state.items[i][key]||'')+'" placeholder="'+escapeHTML(ph)+'"></label>';
}
function cardHTML(item,i){
 const is2027=Number($('op-date').value.slice(0,4))>=2027;
 const nomenclature=item.kind==='produto'?'ncm':'nbs';
 const rateForm='<div class="item-subgroup rates-wrap"'+(is2027?'':' hidden')+'><div class="item-subgroup-header"><h4>Alíquotas nominais informadas (%)</h4></div><p>Obrigatórias para operações de 2027 em diante. O resultado será identificado como simulado.</p><div class="item-fields">'+itemField(i,'cbs','CBS','8,8')+itemField(i,'ibsUf','IBS estadual','0,05')+itemField(i,'ibsMun','IBS municipal','0,05')+'</div></div>';
 const isForm='<div class="item-subgroup is-box"'+(item.hasIS?'':' hidden')+'><div class="item-subgroup-header"><h4>Imposto Seletivo</h4><span class="eyebrow">SE APLICÁVEL</span></div><p>Preencha apenas para operações sujeitas ao IS, conforme classificação e vigência.</p><div class="item-fields">'+itemField(i,'isCst','CST do IS','000')+itemField(i,'isClass','Classificação do IS','000001')+itemField(i,'isBase','Base de cálculo do IS (R$)','150,00')+itemField(i,'isAmount','IS informado (R$)','15,00')+itemField(i,'isQuantity','Quantidade para IS','12')+itemField(i,'isUnit','Unidade do IS','LT')+(is2027?itemField(i,'isAdValorem','Alíquota ad valorem (%)','10'): '')+(is2027?itemField(i,'isAdRem','Alíquota ad rem','0,50'): '')+'</div></div>';
 return '<article class="item-card" data-item="'+i+'"><div class="item-card-head"><span class="item-ident"><span class="item-number">'+String(i+1).padStart(2,'0')+'</span><strong>Item '+(i+1)+'</strong></span>'+(state.items.length>1?'<button class="delete-item" type="button" data-remove="'+i+'">'+icon('trash')+' Remover</button>':'')+'</div><div class="item-fields">'+
 '<div class="field"><span>Tipo de item</span><div class="switch-kind"><button type="button" class="kind-button" data-kind="produto" data-i="'+i+'" aria-pressed="'+(item.kind==='produto')+'">Produto / mercadoria</button><button type="button" class="kind-button" data-kind="servico" data-i="'+i+'" aria-pressed="'+(item.kind==='servico')+'">Serviço</button></div></div>'+
 itemField(i,nomenclature,item.kind==='produto'?'NCM do produto (8 dígitos)':'NBS do serviço (9 dígitos)',item.kind==='produto'?'10063021':'122011200')+
 itemField(i,'cst','CST IBS/CBS (3 dígitos)','200')+
 itemField(i,'cClassTrib','Classificação tributária — cClassTrib','200028')+
 itemField(i,'base','Base de cálculo IBS/CBS (R$)','1.200,00','base-wide')+
 itemField(i,'quantity','Quantidade (opcional)','1')+
 itemField(i,'unit','Unidade (opcional)','UN')+'</div><div class="item-assist-row"><button type="button" class="inline-lookup" data-lookup-item="'+i+'">Conferir classificação tributária na base oficial ↗</button></div>'+
 rateForm + '<button class="is-toggle" type="button" data-is-toggle="'+i+'" aria-expanded="'+item.hasIS+'">'+icon(item.hasIS?'x':'plus')+(item.hasIS?' Retirar Imposto Seletivo':' Informar Imposto Seletivo')+'</button>'+isForm+'</article>';
}
function renderItems(){
 $('items-host').innerHTML=state.items.map(cardHTML).join('');
 $('item-count').textContent=String(state.items.length);
 updateReview();
}
function updateReview(){
 const d=$('op-date').value;
 const m=/^\d{4}-\d{2}-\d{2}$/.test(d)?d.split('-'):null;
 $('review-date').textContent=m?m[2]+'/'+m[1]+'/'+m[0]:'—';
 $('review-location').textContent=$('op-uf').value+' · '+($('op-city').value||'—');
 $('review-items').textContent=state.items.length+' '+(state.items.length===1?'item':'itens');
 $('review-rates').textContent=d && Number(d.slice(0,4))>=2027?'Obrigatórias (simulação)':'Conforme base do motor';
}
$('items-host').addEventListener('input',e=>{
 const target=e.target;
 const i=Number(target.dataset.i),field=target.dataset.itemField;
 if(!Number.isInteger(i)||!field||!state.items[i])return;
 state.items[i][field]=target.value;invalidateStrict();target.removeAttribute('aria-invalid');
});
$('items-host').addEventListener('click',e=>{
 const kind=e.target.closest('[data-kind]');
 if(kind){invalidateStrict();const i=Number(kind.dataset.i);state.items[i].kind=kind.dataset.kind;state.items[i].ncm='';state.items[i].nbs='';renderItems();return}
 const rm=e.target.closest('[data-remove]');
 if(rm){invalidateStrict();state.items.splice(Number(rm.dataset.remove),1);renderItems();return}
 const is=e.target.closest('[data-is-toggle]');
 if(is){invalidateStrict();state.items[Number(is.dataset.isToggle)].hasIS=!state.items[Number(is.dataset.isToggle)].hasIS;renderItems();return}
 const lookup=e.target.closest('[data-lookup-item]');
 if(lookup){const i=Number(lookup.dataset.lookupItem);$('lookup-kind').value='classificacoes-tributarias/cbs-ibs/class-trib/';$('lookup-code').value=state.items[i]?.cClassTrib||'';updateLookup();switchPage('consultas');toast('Classificação preenchida para conferência.');return}
});
function addItem(){if(state.items.length>=50){toast('Limite de 50 itens por operação nesta interface.');return}invalidateStrict();state.items.push(initialItem());renderItems();$('items-host').lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'})}
$('add-item').addEventListener('click',addItem);$('add-item-bottom').addEventListener('click',addItem);
$('sample-operation').addEventListener('click',()=>{$('op-date').value='2027-03-10';$('op-time').value='10:00';$('op-uf').value='RS';$('op-city').value='4314902';$('op-doc').value='';state.items=sampleItems();invalidateStrict();renderItems();toast('Exemplo da documentação preenchido. Alíquotas de simulação.')});
['op-date','op-time','op-uf','op-city','op-doc'].forEach(id=>$(id).addEventListener('change',()=>{invalidateStrict();if(id==='op-date'){renderItems()}else updateReview()}));
$('op-city').addEventListener('input',()=>{invalidateStrict();updateReview()});
function numberString(value,{field='Valor',allowBlank=true,fraction=2,maxInteger=13,percent=false}={}){
 const raw=String(value??'').trim().replace(/\s/g,'');
 if(raw===''){if(allowBlank)return null;throw Error('Preencha '+field+'.')}
 let candidate=raw;
 if(raw.includes(',')) candidate=raw.replace(/\./g,'').replace(',','.');
 else if((fraction<=2 && /^\d{1,3}\.\d{3}$/.test(raw)) || /^\d{1,3}(?:\.\d{3}){2,}$/.test(raw))candidate=raw.replace(/\./g,'');
 if(!/^\d+(?:\.\d+)?$/.test(candidate))throw Error('Confira '+field+': informe um número válido e não negativo.');
 const [whole,frac='']=candidate.split('.');
 if(whole.length>maxInteger || frac.length>fraction)throw Error('Confira '+field+': limite de '+maxInteger+' dígitos inteiros e '+fraction+' decimais.');
 if(percent && (Number(candidate)>100))throw Error('A alíquota de '+field+' não pode ultrapassar 100%.');
 return candidate;
}
function makeOperation(){
 const d=$('op-date').value,tm=$('op-time').value,uf=$('op-uf').value,city=$('op-city').value.trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!/^\d{2}:\d{2}$/.test(tm))throw Error('Informe data e horário do fato gerador.');
 if(!/^\d{7}$/.test(city))throw Error('O município precisa ter 7 dígitos do código IBGE.');
 if(!/^[A-Z]{2}$/.test(uf))throw Error('Selecione uma UF.');
 if(!state.items.length)throw Error('Inclua pelo menos um item.');
 const year=Number(d.slice(0,4));
 const items=state.items.map((item,i)=>{
  const num=i+1;
  const nomenclature=item.kind==='produto'?'ncm':'nbs';
  const value=item[nomenclature].trim();
  if(!new RegExp('^\\d{'+(item.kind==='produto'?8:9)+'}$').test(value))throw Error('Item '+num+': informe '+(item.kind==='produto'?'NCM com 8':'NBS com 9')+' dígitos.');
  if(!/^\d{3}$/.test(item.cst))throw Error('Item '+num+': CST deve conter 3 dígitos.');
  if(!/^\d{6}$/.test(item.cClassTrib))throw Error('Item '+num+': cClassTrib deve conter 6 dígitos.');
  const o={numero:num,[nomenclature]:value,cst:item.cst,cClassTrib:item.cClassTrib};
  const base=numberString(item.base,{field:'base de cálculo do item '+num,allowBlank:item.hasIS});
  if(base!==null)o.baseCalculo=base;
  const quantity=numberString(item.quantity,{field:'quantidade do item '+num,fraction:4,maxInteger:11});
  if(quantity!==null)o.quantidade=quantity;
  if(item.unit.trim())o.unidade=item.unit.trim().slice(0,30);
  if(item.hasIS){
   if(!/^\d{3}$/.test(item.isCst)||!/^\d{6}$/.test(item.isClass))throw Error('Item '+num+': informe CST e classificação do Imposto Seletivo.');
   o.impostoSeletivo={cst:item.isCst,cClassTrib:item.isClass,baseCalculo:numberString(item.isBase,{field:'base do Imposto Seletivo do item '+num,allowBlank:false})};
   const amount=numberString(item.isAmount,{field:'IS informado do item '+num});
   if(amount!==null)o.impostoSeletivo.impostoInformado=amount;
   const q=numberString(item.isQuantity,{field:'quantidade do IS do item '+num,fraction:4,maxInteger:11});
   if(q!==null)o.impostoSeletivo.quantidade=q;
   if(item.isUnit.trim())o.impostoSeletivo.unidade=item.isUnit.trim().slice(0,30);
  }
  if(year>=2027){
   o.aliquotasNominais={
    cbs:numberString(item.cbs,{field:'CBS do item '+num,allowBlank:false,fraction:4,maxInteger:3,percent:true}),
    ibsEstadual:numberString(item.ibsUf,{field:'IBS estadual do item '+num,allowBlank:false,fraction:4,maxInteger:3,percent:true}),
    ibsMunicipal:numberString(item.ibsMun,{field:'IBS municipal do item '+num,allowBlank:false,fraction:4,maxInteger:3,percent:true})
   };
   if(item.hasIS){
    const adValorem=numberString(item.isAdValorem,{field:'IS ad valorem do item '+num,fraction:4,maxInteger:3,percent:true});
    const adRem=numberString(item.isAdRem,{field:'IS ad rem do item '+num,fraction:4,maxInteger:13});
    if(adValorem!==null||adRem!==null){o.aliquotasNominais.impostoSeletivo={};if(adValorem!==null)o.aliquotasNominais.impostoSeletivo.adValorem=adValorem;if(adRem!==null)o.aliquotasNominais.impostoSeletivo.adRem=adRem}
   }
  }
  return o;
 });
 const o={id:uniqueId(),versao:'1.0.0',dhFatoGerador:d+'T'+tm+':00-03:00',municipio:Number(city),uf};
 const doc=$('op-doc').value;if(doc)o.tpDoc=Number(doc);
 o.itens=items;
 return o;
}

function itemStateLabel(s){
 const map={CALCULADO:'Calculado',CALCULO_SIMULADO:'Simulado',INCONSISTENCIA_ENTRADA:'Inconsistência',NAO_IMPLEMENTADO:'Não implementado',FALHA_TECNICA:'Falha técnica'};
 return map[s]||'Em análise';
}
function itemStateClass(s){
 if(s==='CALCULADO')return 'ok';if(s==='CALCULO_SIMULADO')return 'sim';return 'error';
}
function showOperation(response,strict){
 const obj=response.data||{};
 const docs=Array.isArray(obj.objetos)?obj.objetos:[];
 const tot=obj.total?.tribCalc||{};
 const ibscbs=tot.IBSCBSTot||{};
 const gibs=ibscbs.gIBS||{};
 const is=tot.ISTot||{};
 const sim=docs.some(x=>x.estadoItem==='CALCULO_SIMULADO')||!!response.warning && response.warning!=='0';
 const broken=docs.filter(x=>!['CALCULADO','CALCULO_SIMULADO'].includes(x.estadoItem));
 const good=docs.length-broken.length;
 const status='<span class="status-pill '+(broken.length?'error':sim?'sim':'ok')+'">'+(broken.length?broken.length+' item(ns) com pendência':sim?'RESULTADO SIMULADO':'CÁLCULO DO MOTOR')+'</span><span class="outcome-note">'+(sim?'Alíquotas nominais informadas — não caracteriza apuração definitiva.': 'Retorno calculado pelo motor RTC.')+'</span>';
 const metrics='<div class="result-metrics"><div class="metric featured"><small>Valor CBS</small><strong>'+moneyBR(ibscbs.gCBS?.vCBS)+'</strong><p>Total dos itens processados</p></div><div class="metric"><small>Valor IBS</small><strong>'+moneyBR(gibs.vIBS)+'</strong><p>Estadual + municipal</p></div><div class="metric"><small>Imposto Seletivo</small><strong>'+moneyBR(is.vIS)+'</strong><p>Quando aplicável</p></div></div>';
 let table='<h3 class="result-subtitle">Conferência por item</h3><div class="result-table-wrapper"><table class="result-table"><thead><tr><th>Item</th><th>Situação</th><th class="num-cell">CBS</th><th class="num-cell">IBS</th><th class="num-cell">IS</th></tr></thead><tbody>';
 const csv=[['Item','Situação','CBS (R$)','IBS (R$)','IS (R$)','Observações']];
 for(const item of docs){
  const tc=item.tribCalc||{};const ib=tc.IBSCBS?.gIBSCBS||{};
  const cbs=ib.gCBS?.vCBS,ibs=ib.vIBS,selective=tc.IS?.vIS||tc.IS?.gIS?.vIS;
  const errors=Array.isArray(item.erros)?item.erros:[];
  table+='<tr><td><b>'+escapeHTML(item.nObj)+'</b></td><td><span class="status-pill '+itemStateClass(item.estadoItem)+'">'+escapeHTML(itemStateLabel(item.estadoItem))+'</span></td><td class="num-cell">'+moneyBR(cbs)+'</td><td class="num-cell">'+moneyBR(ibs)+'</td><td class="num-cell">'+moneyBR(selective)+'</td></tr>';
  csv.push([item.nObj,itemStateLabel(item.estadoItem),cbs||'',ibs||'',selective||'',errors.map(x=>x.detail||x.title).join(' | ')]);
 }
 table+='</tbody></table></div>';
 const compositions=docs.map(x=>{
  const t=x.tribCalc?.IBSCBS?.gIBSCBS;
  if(!t)return '';
  const rows=[
   ['CST',x.tribCalc?.IBSCBS?.CST||state.items[(x.nObj||1)-1]?.cst],
   ['Classificação',x.tribCalc?.IBSCBS?.cClassTrib||state.items[(x.nObj||1)-1]?.cClassTrib],
   ['Base IBS/CBS',moneyBR(t.vBC)],
   ['CBS nominal',decimalBR(t.gCBS?.pCBS)+'%'],
   ['CBS efetiva',decimalBR(t.gCBS?.gRed?.pAliqEfet)+'%'],
   ['IBS estadual',moneyBR(t.gIBSUF?.vIBSUF)],
   ['IBS municipal',moneyBR(t.gIBSMun?.vIBSMun)],
   ['Redução de alíquota',decimalBR(t.gCBS?.gRed?.pRedAliq)+'%']
  ].filter(([,v])=>v!=='—'&&v!==undefined&&v!=='—%');
  return '<details class="result-detail"><summary>Item '+escapeHTML(x.nObj)+' · Ver composição do cálculo</summary><dl class="result-field-list">'+rows.map(([k,v])=>'<div><dt>'+escapeHTML(k)+'</dt><dd>'+escapeHTML(v)+'</dd></div>').join('')+'</dl></details>';
 }).filter(Boolean);
 if(compositions.length)table+='<h3 class="result-subtitle">Composição dos tributos</h3><div class="result-list">'+compositions.join('')+'</div>';
 let notices='';
 if(broken.length){
  notices='<h3 class="result-subtitle">Itens que exigem atenção</h3><div class="result-list">'+broken.map(x=>'<details class="result-detail" open><summary>Item '+escapeHTML(x.nObj)+' · '+escapeHTML(itemStateLabel(x.estadoItem))+'</summary><div class="result-bullets">'+(x.erros||[]).map(err=>'<p>'+escapeHTML((err.title?err.title+': ':'')+(err.detail||err.code||'Verifique o enquadramento.'))+'</p>').join('')+'</div></details>').join('')+'</div>';
 }
 const memo=docs.some(x=>x.memoriaCalculo)?'<details class="result-detail"><summary>Memória de cálculo informada pelo motor</summary>'+docs.filter(x=>x.memoriaCalculo).map(x=>'<p><strong>Item '+escapeHTML(x.nObj)+'</strong> — '+escapeHTML(typeof x.memoriaCalculo==='string'?x.memoriaCalculo:'Memória estruturada disponível no arquivo técnico.')+'</p>').join('')+'</details>':'';
 showResult('Resultado da operação', '<div class="outcome-top">'+status+'</div>'+metrics+table+notices+memo,{kind:'operation',data:obj,csvRows:csv,meta:good+' de '+docs.length+' itens calculados ou simulados · '+(strict?'Cálculo integral':'Verificação por item')});
 if(strict && broken.length===0)state.lastStrict=obj;
}
async function runOperation(strict=false){
 let op;try{op=makeOperation()}catch(e){showError('Confira os dados informados',e.message);return}
 const r=await api(strict?'regime-geral':'observabilidade/regime-geral',{method:'POST',body:JSON.stringify(op)});
 if(r)showOperation(r,strict);
}
$('operation-run').addEventListener('click',()=>runOperation(false));
$('strict-run').addEventListener('click',()=>runOperation(true));

function prepareBaseFields(){
 Object.entries(demoBase).forEach(([k,v])=>{const el=$('base-money-fields').querySelector('[data-money="'+k+'"]');if(el)el.value=v});
 $('base-year').value='2027';$('base-doc').value='55';$('base-nature').value='bem';document.querySelector('input[name="base-mode"][value="nfe"]').checked=true;setBaseMode();toast('Exemplo da Receita preenchido. Confira ano, vigência e valores antes de calcular.');
}
$('base-sample').addEventListener('click',prepareBaseFields);
function setBaseMode(){
 const nfse=document.querySelector('[name="base-mode"]:checked')?.value==='nfse';
 $('base-nfe-fields').hidden=nfse;$('base-nfse-fields').hidden=!nfse;
}
function setNfseOptions(){
 const sn=Number($('nfse-simples').value);
 $('nfse-regime-wrap').hidden=sn!==3&&sn!==4;
 const loc=$('nfse-status').value==='locacao9903';
 $('nfse-locacao-fields').hidden=!loc;
}
$$('[name="base-mode"]').forEach(r=>r.addEventListener('change',setBaseMode));
$('nfse-simples').addEventListener('change',setNfseOptions);
$('nfse-status').addEventListener('change',setNfseOptions);
function collectMoney(container,defs,mandatory=[]){
 const res={};
 for (const [key,label] of defs){
  const el=container.querySelector('[data-money="'+key+'"]');
  const val=numberString(el?.value,{field:label,allowBlank:!mandatory.includes(key),fraction:key==='pCopropriedade'?4:2});
  if(val!==null)res[key]=val;
 }
 return res;
}
function makeBase(){
 const nfse=document.querySelector('[name="base-mode"]:checked')?.value==='nfse';
 if(!nfse){
  const year=Number($('base-year').value);if(!Number.isInteger(year)||year<2026||year>2100)throw Error('Informe um ano do fato gerador a partir de 2026.');
  return {route:'base-calculo/base-calculo-unificada',input:{anoFatoGerador:year,tipoDocumento:Number($('base-doc').value),natureza:$('base-nature').value,...collectMoney($('base-money-fields'),baseDefs,['vProd'])}};
 }
 const year=Number($('nfse-year').value),sn=Number($('nfse-simples').value),situation=$('nfse-status').value;
 if(!Number.isInteger(year)||year<2026||year>2100)throw Error('Informe um ano do fato gerador a partir de 2026.');
 if(situation==='locacao9903'&&(sn===2||sn===3))throw Error('A modalidade de locação de imóveis não é permitida para MEI ou optante ME/EPP nessa regra do motor.');
 const input={anoFatoGerador:year,opSimpNac:sn,situacao:situation,...collectMoney($('nfse-money-fields'),nfseDefs,['vServ'])};
 if(sn===3||sn===4)input.regApIBSCBSSN=Number($('nfse-regime').value);
 if(situation==='locacao9903')input.locacao=collectMoney($('nfse-locacao-grid'),nfseLocacaoDefs,nfseLocacaoDefs.map(x=>x[0]));
 return {route:'base-calculo/base-calculo-unificada-nfse',input};
}
$('base-run').addEventListener('click',async()=>{
 let d;try{d=makeBase()}catch(e){showError('Revise a base de cálculo',e.message);return}
 const r=await api(d.route,{method:'POST',body:JSON.stringify(d.input)});
 if(!r)return;
 const out=r.data;
 let html='<div class="outcome-top"><span class="status-pill ok">BASE CALCULADA</span><span class="outcome-note">Valores apurados pelo motor conforme a vigência dos componentes informados.</span></div>';
 const values=[
 ['baseRG','Base · Regime Geral','IBS/CBS'],
 ['baseIS','Base · Imposto Seletivo','IS'],
 ['baseSN','Base · Simples Nacional','SN']
 ];
 const available=values.filter(([k])=>out&&Object.hasOwn(out,k));
 if(available.length){
  html+='<div class="result-metrics">'+available.map(([k,l,sub])=>'<div class="metric '+(k==='baseRG'?'featured':'')+'"><small>'+l+'</small><strong>'+moneyBR(out[k])+'</strong><p>'+sub+'</p></div>').join('')+'</div>';
 }else{
  const entries=Object.entries(out||{}).filter(([,v])=>typeof v==='number'||typeof v==='string');
  html+='<dl class="result-field-list">'+entries.map(([k,v])=>'<div><dt>'+escapeHTML(humanKey(k))+'</dt><dd>'+escapeHTML(v)+'</dd></div>').join('')+'</dl>';
 }
 if(Array.isArray(out.avisos)&&out.avisos.length)html+='<h3 class="result-subtitle">Avisos sobre vigência</h3><ul class="result-bullets">'+out.avisos.map(x=>'<li>'+escapeHTML(x)+'</li>').join('')+'</ul>';
 showResult('Bases de cálculo',html,{kind:'base',data:out,csvRows:[['Base','Valor'],...available.map(([k,l])=>[l,out[k]])],meta:'Cálculo da '+(d.route.endsWith('nfse')?'NFS-e':'NF-e / NFC-e')+' · Ano '+d.input.anoFatoGerador});
});

const lookupNeeds={ncm:['ncm',/^\d{2,8}$/,'Informe de 2 a 8 dígitos de NCM'],nbs:['nbs',/^\d{9}$/,'Informe NBS com 9 dígitos'],'nbs-aplicaveis':['cClassTrib',/^\d{6}$/,'Informe cClassTrib com 6 dígitos'],'aliquota-uf':['codigoUf',/^\d{2}$/,'Informe o código numérico de UF (RS: 43)'],'aliquota-municipio':['codigoMunicipio',/^\d{7}$/,'Informe o código IBGE com 7 dígitos'],'ufs/municipios':['siglaUf',/^[A-Z]{2}$/,'Informe a sigla da UF (ex.: RS)']};
function updateLookup(){
 const kind=$('lookup-kind').value;
 const need=kind.endsWith('/') || Object.hasOwn(lookupNeeds,kind);
 $('lookup-code-wrap').hidden=!need;
 $('lookup-date-wrap').hidden=kind==='versao'||kind==='ufs'||kind==='ufs/municipios';
 const code=$('lookup-code');
 const names={'ncm':'Ex.: 10063021','nbs':'Ex.: 122011200','nbs-aplicaveis':'Ex.: 200028','aliquota-uf':'Ex.: 43','aliquota-municipio':'Ex.: 4314902','ufs/municipios':'Ex.: RS'};
 code.placeholder=names[kind]||'Ex.: 200028';
 code.inputMode=kind==='ufs/municipios'?'text':'numeric';
}
$('lookup-kind').addEventListener('change',updateLookup);updateLookup();
function humanKey(k){
 const d={codigo:'Código',descricao:'Descrição',nome:'Nome',sigla:'Sigla',codigoSituacaoTributaria:'CST',codigoClassificacaoTributaria:'cClassTrib',descricaoClassificacaoTributaria:'Classificação tributária',descricaoSituacaoTributaria:'Situação tributária',tipoAliquota:'Tipo de alíquota',descricaoTratamentoTributario:'Tratamento tributário',nomenclatura:'Nomenclatura',percentualReducao:'Redução',pRedAliq:'Redução de alíquota',fundamentacaoLegal:'Fundamentação legal',baseLegal:'Base legal',dataInicioVigencia:'Início da vigência',dataFimVigencia:'Fim da vigência',versaoApp:'Versão do motor',versaoDb:'Versão da base de dados',ambiente:'Ambiente',municipio:'Município',uf:'UF'};
 return d[k]||k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
}
function makeLookup(){
 const kind=$('lookup-kind').value,code=$('lookup-code').value.trim().toUpperCase(),date=$('lookup-date').value;
 let route='dados-abertos/'+kind,params={};
 if(kind==='versao'||kind==='ufs')return {route,params};
 if(kind==='ufs/municipios'){
  if(!/^[A-Z]{2}$/.test(code))throw Error('Informe a sigla da UF, como RS.');
  return {route,params:{siglaUf:code}};
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Informe a data de referência.');
 params.data=date;
 if(kind.endsWith('/')){
  if(!/^\d{6}$/.test(code))throw Error('Informe o cClassTrib com 6 dígitos.');
  route+=code;
 }else if(Object.hasOwn(lookupNeeds,kind)){
  const [key,regex,error]=lookupNeeds[kind];if(!regex.test(code))throw Error(error+'.');params[key]=code;
 }
 return {route,params};
}
function lookupTable(rows,page){
 if(!rows.length)return '<div class="result-empty">A consulta não retornou registros para os filtros informados.</div>';
 const offset=page*25,subset=rows.slice(offset,offset+25);
 let keys=Object.keys(subset[0]).filter(k=>['codigo','descricao','nome','sigla','codigoSituacaoTributaria','codigoClassificacaoTributaria','descricaoClassificacaoTributaria','descricaoSituacaoTributaria','tipoAliquota','descricaoTratamentoTributario','ncm','nbs'].includes(k));
 if(!keys.length) keys=Object.keys(subset[0]).slice(0,5).filter(k=>typeof subset[0][k]!=='object');
 keys=keys.slice(0,5);
 if(!keys.length)return '<div class="result-empty">Registros retornados, mas sem colunas simples para exibição. Use o download técnico para conferência.</div>';
 let html='<div class="result-table-wrapper"><table class="result-table"><thead><tr>'+keys.map(k=>'<th>'+escapeHTML(humanKey(k))+'</th>').join('')+'</tr></thead><tbody>';
 for(const row of subset) html+='<tr>'+keys.map(k=>'<td>'+escapeHTML(row[k]??'—')+'</td>').join('')+'</tr>';
 return html+'</tbody></table></div><div class="result-pager"><button id="lookup-prev" type="button" '+(page===0?'disabled':'')+'>← Anterior</button><span>'+Math.min(offset+1,rows.length)+'–'+Math.min(offset+25,rows.length)+' de '+rows.length+' registros</span><button id="lookup-next" type="button" '+(offset+25>=rows.length?'disabled':'')+'>Próxima →</button></div>';
}
function showLookupResult(data,kind){
 state.lookupRows=Array.isArray(data)?data:[];
 state.lookupPage=0;
 if(Array.isArray(data)){
  const csv=data.length?[Object.keys(data[0]),...data.map(o=>Object.keys(data[0]).map(k=>typeof o[k]==='object'?JSON.stringify(o[k]):o[k]))]:[];
  showResult('Registros da consulta','<div class="outcome-top"><span class="status-pill ok">CONSULTA CONCLUÍDA</span><span class="outcome-note">'+data.length+' registro(s) retornado(s) pela base fiscal.</span></div><div id="lookup-table-host">'+lookupTable(data,0)+'</div>',{kind:'lookup',data,csvRows:csv,meta:$('lookup-kind').selectedOptions[0].textContent+' · Base do motor RTC'});
 }else if(data&&typeof data==='object'){
  const pairs=Object.entries(data).filter(([,v])=>v!==null&&typeof v!=='object');
  const name=data.descricao||data.nome||data.descricaoTratamentoTributario;
  const heading='<div class="outcome-top"><span class="status-pill ok">INFORMAÇÃO LOCALIZADA</span></div>'+(data.codigo?'<div class="lookup-highlight"><strong>'+escapeHTML(data.codigo)+'</strong><span>'+escapeHTML(name||'Registro tributário')+'</span></div>':'');
  const csv=[['Campo','Valor'],...pairs.map(([k,v])=>[humanKey(k),String(v)])];
  showResult('Detalhes do enquadramento',heading+'<dl class="result-field-list">'+pairs.map(([k,v])=>'<div><dt>'+escapeHTML(humanKey(k))+'</dt><dd>'+escapeHTML(v)+'</dd></div>').join('')+'</dl>',{kind:'lookup',data,csvRows:csv,meta:'Consulta individual · '+$('lookup-kind').selectedOptions[0].textContent});
 }else showResult('Resposta da consulta','<div class="result-empty">'+escapeHTML(String(data))+'</div>',{kind:'lookup',data,meta:'Retorno do motor'});
}
$('lookup-run').addEventListener('click',async()=>{
 let d;try{d=makeLookup()}catch(e){showError('Confira a consulta',e.message);return}
 const r=await api(d.route,{params:d.params});if(r)showLookupResult(r.data,d.route);
});
$('results-body').addEventListener('click',e=>{
 if(e.target?.id==='lookup-prev')state.lookupPage=Math.max(0,state.lookupPage-1);
 else if(e.target?.id==='lookup-next')state.lookupPage+=1;
 else return;
 const host=$('lookup-table-host');
 if(host)host.innerHTML=lookupTable(state.lookupRows,state.lookupPage);
});

function updateXml(){
 const gen=document.querySelector('[name="xml-mode"]:checked')?.value==='generate';
 $('xml-upload-wrap').hidden=gen;
 $('xml-generate-wrap').hidden=!gen;
 $('xml-sub-wrap').hidden=gen;
 $('xml-run').innerHTML=(gen?'Gerar XML':'Validar XML')+' '+icon('arrow');
 $('xml-generate-hint').innerHTML=state.lastStrict?'Cálculo integral disponível. O XML será gerado a partir do último resultado completo, sem edição manual.':'Faça um <b>cálculo integral</b> em “Calcular operação” antes de gerar o XML.';
}
$$('[name="xml-mode"]').forEach(x=>x.addEventListener('change',updateXml));
$('xml-file').addEventListener('change',async e=>{
 const f=e.target.files?.[0];if(!f)return;
 if(f.size>900000){toast('O arquivo deve ter no máximo 900 KB.');e.target.value='';return}
 if(!/\.xml$/i.test(f.name)){toast('Selecione um arquivo XML.');e.target.value='';return}
 state.xmlUpload=await f.text();
 $('selected-file').textContent=f.name+' · '+Math.ceil(f.size/1024)+' KB';
});
$('xml-run').addEventListener('click',async()=>{
 const gen=document.querySelector('[name="xml-mode"]:checked')?.value==='generate';
 const tipo=$('xml-kind').value,sub=$('xml-sub').value;
 if(gen&&!state.lastStrict){toast('Primeiro execute o Cálculo integral da operação.');switchPage('operacao');return}
 if(!gen&&!state.xmlUpload){toast('Selecione o arquivo XML que deseja validar.');return}
 const r=await api(gen?'xml/generate':'xml/validate',{method:'POST',params:gen?{tipo}:{tipo,subtipo:sub},body:gen?JSON.stringify(state.lastStrict):state.xmlUpload});
 if(!r)return;
 const value=r.data;
 if(gen){
  let xml=typeof value==='string'?value:value?.xml||'';
  if(typeof xml!=='string'||!xml.trim().startsWith('<')){showError('O XML não foi gerado','O motor não retornou um documento XML. Confira o resultado e o modelo fiscal.');return}
  state.lastXml=xml;
  $('xml-save').disabled=false;
  showResult('XML tributário gerado','<div class="outcome-top"><span class="status-pill ok">ARQUIVO GERADO</span><span class="outcome-note">XML produzido pelo motor a partir do último cálculo integral.</span></div><div class="result-empty">O documento está pronto para download. Para conferir o XSD, selecione “Validar arquivo XML” e envie o documento.</div>',{kind:'xml',data:{status:'XML gerado',tipo},meta:'Grupo tributário gerado · '+xml.length+' caracteres',csvRows:[['Modelo','Status'],[tipo,'XML gerado']]});
 }else{
  const valid=value===true||value==='true'||value?.valido===true||value?.valid===true;
  showResult('Validação de XML','<div class="outcome-top"><span class="status-pill '+(valid?'ok':'sim')+'">'+(valid?'XML VÁLIDO':'RETORNO DA VALIDAÇÃO')+'</span></div><div class="result-empty">'+(valid?'O motor confirmou a conformidade do XML com o esquema XSD informado.':'O motor retornou: '+escapeHTML(typeof value==='string'?value:JSON.stringify(value)))+'</div>',{kind:'xml',data:value,meta:'Validação XSD executada na infraestrutura fiscal',csvRows:[['Verificação','Resultado'],['XML',valid?'Válido':'Consultar retorno']]});
 }
});
$('xml-save').addEventListener('click',()=>{
 if(!state.lastXml)return;
 download('rtc-grupo-tributario.xml',state.lastXml,'application/xml');
});

function download(filename,content,mime){
 const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function csvField(v){
 let s=String(v??'');
 // Protect CSV files against spreadsheet formula injection.
 if(/^[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
$('results-csv').addEventListener('click',()=>{
 if(!state.csvRows?.length){toast('Nenhum registro para exportar.');return}
 download('rtc-resultado-'+new Date().toISOString().slice(0,10)+'.csv','\ufeff'+state.csvRows.map(r=>r.map(csvField).join(';')).join('\r\n'),'text/csv;charset=utf-8');
});
$('results-raw').addEventListener('click',()=>{
 if(state.result==null){toast('Nenhum dado disponível.');return}
 const str=typeof state.result==='string'?state.result:JSON.stringify(state.result,null,2);
 download('rtc-dados-tecnicos.json',str,'application/json;charset=utf-8');
});

const pageTitles={operacao:'Calcular operação',bases:'Base de cálculo',consultas:'Consulta tributária',xml:'Conferir XML',referencias:'Fontes e orientação'};
function switchPage(p){
 state.page=p;
 $$('[data-page]').forEach(btn=>{
  const active=btn.dataset.page===p;
  btn.classList.toggle('active',active);
  if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
 });
 $$('[data-screen]').forEach(el=>el.classList.toggle('active',el.dataset.screen===p));
 $('top-section').textContent=pageTitles[p]||'Operação';
 const saved=state.pageResults[p];
 if(saved){
  state.result=saved.data;state.resultKind=saved.kind;state.csvRows=saved.csvRows;
  $('results-title').textContent=saved.title;
  $('results-meta').textContent=saved.meta||'Resposta do motor RTC.';
  $('results-body').innerHTML='<div class="result-section-inner">'+saved.html+'</div>';
  $('results-csv').disabled=!saved.csvRows?.length;
  $('results-raw').disabled=saved.data==null;
  $('results').hidden=false;
 }else $('results').hidden=true;
 window.scrollTo({top:0,behavior:'auto'});
 if(p==='xml')updateXml();
}
$$('[data-page]').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.page)));
$('connection-trigger').addEventListener('click',()=>{
 retryAttempts=0;clearTimeout(retryTimer);retryTimer=null;checkEngine();
});
function localFiscalDate(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const pick=n=>parts.find(x=>x.type===n)?.value;
 return [pick('year'),pick('month'),pick('day')].join('-');
}
const today=localFiscalDate();
if(/^\d{4}-\d{2}-\d{2}$/.test(today)){$('op-date').value=today;$('lookup-date').value=today;$('base-year').value=today.slice(0,4);$('nfse-year').value=today.slice(0,4)}
setBaseMode();setNfseOptions();renderItems();
statusConnection(false,'Verificando motor…');
checkEngine();
})();