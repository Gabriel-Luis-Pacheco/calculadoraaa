(() => {
'use strict';
const $ = id => document.getElementById(id);
const state = { count:0, activities:[], csv:[], busy:false, checking:false, healthTries:0, healthTimer:null };
const escapeHTML = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const real = value => Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});
const money = value => value===undefined||value===null||value===''?'—':real(value);

function todayBrazil(){
 const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const get = type => parts.find(x=>x.type===type)?.value||'';
 return [get('year'),get('month'),get('day')].join('-');
}
$('data').value=todayBrazil();
function updateCRT(){
 $('regime-wrap').hidden=$('crt').value!=='3';
}
$('crt').addEventListener('change',updateCRT);
updateCRT();

function newItem(values={}){
 const items=$('items');
 if(items.children.length>=30) return setMessage('Limite de 30 itens por operação nesta interface.');
 const article=$('item-template').content.firstElementChild.cloneNode(true);
 article.dataset.itemId=String(++state.count);
 for(const [key,value] of Object.entries(values)){
  const input=article.querySelector('[name="'+key+'"]');
  if(input) input.value=value;
 }
 article.querySelector('.delete-item').addEventListener('click',()=>{
  if($('items').children.length===1) { setMessage('Mantenha ao menos um item.'); return }
  article.remove();renumber();
 });
 items.append(article);renumber();
 return article;
}
function renumber(){
 for(const [i,article] of [...$('items').children].entries()){
  article.querySelector('.item-heading').textContent='Item '+String(i+1).padStart(2,'0');
  article.querySelector('.delete-item').hidden=$('items').children.length===1;
 }
}
newItem();
$('add-item').addEventListener('click',()=>newItem());

function setMessage(message){
 $('activities-message').textContent=message;
}
function status(kind,title,description){
 const label=kind==='ready'?'Motor do Simples disponível':kind==='setup'?'Motor ainda não configurado':'Motor Simples indisponível';
 $('status-text').textContent=kind==='ready'?'Motor conectado':kind==='setup'?'Motor não configurado':'Motor indisponível';
 $('check-motor').className='status '+(kind==='ready'?'ready':kind==='setup'?'error':'');
 $('engine-warning').hidden=kind==='ready';
 $('engine-warning').dataset.state=kind;
 if(kind==='ready'){state.healthTries=0;clearTimeout(state.healthTimer);state.healthTimer=null;}
 $('warning-title').textContent=title||label;
 $('warning-text').textContent=description||'Você pode preencher os campos enquanto a conexão é restabelecida.';
}
function messageFromResponse(x){
 if(typeof x==='string')return x.slice(0,240);
 if(!x)return 'Resposta inesperada.';
 return x.detail||x.message||x.title||x.code||'O motor não conseguiu processar a solicitação.';
}
async function request(route,{method='GET',params={},body=null}={}){
 const query=new URLSearchParams({route,...params});
 let response,txt;
 try{
  response=await fetch('/api/simples?'+query.toString(),{
   method,cache:'no-store',headers:method==='POST'?{'Content-Type':'application/json'}:{},
   body:method==='POST'?JSON.stringify(body):undefined,
   signal:AbortSignal.timeout(56000)
  });
  txt=await response.text();
 }catch(e){status('sleep','Motor do Simples não respondeu','O Java pode estar iniciando. Nenhum campo preenchido foi descartado.');throw new Error('Falha de comunicação com o motor fiscal.')}
 let data;try{data=JSON.parse(txt)}catch{throw new Error('O servidor retornou uma resposta não reconhecida.')}
 if(!response.ok){
  if(data?.code==='SIMPLES_NOT_DEPLOYED')status('setup','Motor do Simples ainda não implantado',messageFromResponse(data));
  else if(response.status===503)status('sleep','Motor Simples indisponível ou iniciando',messageFromResponse(data));
  throw new Error(messageFromResponse(data));
 }
 status('ready');
 return data;
}
function scheduleHealthRetry(){
 if(state.healthTimer || $('engine-warning').dataset.state==='ready')return;
 const delay=Math.min(45000,15000+state.healthTries*5000);
 state.healthTries++;
 state.healthTimer=setTimeout(()=>{state.healthTimer=null;checkHealth()},delay);
}
async function checkHealth(){
 if(state.checking)return;
 state.checking=true;
 clearTimeout(state.healthTimer);state.healthTimer=null;
 $('status-text').textContent='Verificando motor…';
 try{await request('versao');}
 catch(e){
  if(!['setup','sleep'].includes($('engine-warning').dataset.state||'')){
   status('sleep','Motor aguardando conexão',e.message);
  }
 }finally{
  state.checking=false;
  if($('engine-warning').dataset.state!=='ready')scheduleHealthRetry();
 }
}
$('check-motor').addEventListener('click',()=>{state.healthTries=0;checkHealth()});
$('retry').addEventListener('click',()=>{state.healthTries=0;checkHealth()});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&$('engine-warning').dataset.state!=='ready')checkHealth();
});
checkHealth();

function numeric(input,{label,decimals=2,required=false,maximum=null}={}){
 const raw=input.value.trim();
 input.removeAttribute('aria-invalid');
 if(!raw){
  if(required){input.setAttribute('aria-invalid','true');input.focus();throw new Error('Preencha '+label+'.')}
  return null;
 }
 let numberText=raw.replace(/\s/g,'');
 if(!/^[0-9.,]+$/.test(numberText)){input.setAttribute('aria-invalid','true');input.focus();throw new Error(label+': use somente números e separadores decimais.')}
 if(numberText.includes(',')){
  numberText=numberText.replace(/\./g,'').replace(',','.');
 }else if((numberText.match(/\./g)||[]).length>1){
  if(!/^\d{1,3}(?:\.\d{3})+$/.test(numberText))throw new Error(label+': número inválido.');
  numberText=numberText.replace(/\./g,'');
 }else if(decimals===2&&/^\d{1,3}\.\d{3}$/.test(numberText)){
  numberText=numberText.replace('.','');
 }
 const value=Number(numberText);
 if(!Number.isFinite(value)||value<0||(maximum!==null&&value>maximum)||!Number.isInteger(Math.round(value*10**decimals))){
  input.setAttribute('aria-invalid','true');input.focus();throw new Error(label+': valor fora do intervalo permitido.');
 }
 if(numberText.includes('.')&&numberText.split('.')[1].length>decimals){
  input.setAttribute('aria-invalid','true');input.focus();throw new Error(label+': informe no máximo '+decimals+' casas decimais.');
 }
 return value.toFixed(decimals);
}
function readItem(article,i){
 const input = name=>article.querySelector('[name="'+name+'"]');
 const cls=input('classe').value.trim();
 if(!/^\d{6}$/.test(cls)){input('classe').focus();input('classe').setAttribute('aria-invalid','true');throw new Error('Item '+(i+1)+': cClassTrib deve ter 6 dígitos.')}
 const activity=input('atividade').value.trim();
 if(activity&&!/^\d{2}$/.test(activity)){input('atividade').focus();throw new Error('Item '+(i+1)+': código de atividade deve ter 2 dígitos.')}
 const out={
  numero:i+1,
  cClassTrib:cls,
  baseCalculo:numeric(input('base'),{label:'base de cálculo do item '+(i+1),required:true}),
  valorImpostoSeletivo:numeric(input('is'),{label:'Imposto Seletivo do item '+(i+1)})||'0.00'
 };
 if(activity)out.cAtivSN=activity;
 const ibs=numeric(input('ibs'),{label:'alíquota IBS do item '+(i+1),decimals:4,maximum:100});
 const cbs=numeric(input('cbs'),{label:'alíquota CBS do item '+(i+1),decimals:4,maximum:100});
 if(ibs!==null)out.pIBSSN=ibs;
 if(cbs!==null)out.pCBSSN=cbs;
 return out;
}
function operation(){
 const date=$('data').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Selecione a data do fato gerador.');
 const CRT=$('crt').value;
 const items=[...$('items').children].map(readItem);
 if(!items.length)throw new Error('Adicione um item para calcular.');
 const result={id:Date.now().toString(16).padStart(24,'0'),versao:'2.0.0',data:date,tpDoc:$('tp-doc').value,CRT,itens:items};
 if(CRT==='3')result.tpRegimeIBSCBS=$('tp-regime').value;
 if($('ente').value)result.tpEnteGov=$('ente').value;
 return result;
}
$('load-activities').addEventListener('click',async()=>{
 const btn=$('load-activities');btn.disabled=true;btn.textContent='Consultando…';
 try{
  const list=await request('calculadora/simples-nacional/atividades',{
   params:{data:$('data').value,tpDoc:$('tp-doc').value}
  });
  if(!Array.isArray(list))throw new Error('O catálogo não retornou uma lista válida.');
  state.activities=list;
  const datalist=$('atividades-list');
  datalist.replaceChildren();
  for(const item of list){
   const option=document.createElement('option');
   option.value=String(item.codigo||'');
   option.label=String(item.descricao||'').slice(0,130)+(item.disponivel===false?' · indisponível para o documento':'');
   datalist.append(option);
  }
  setMessage(list.length+' atividades oficiais consultadas. Digite o código de dois dígitos e selecione a atividade sugerida pelo navegador. A compatibilidade final será validada pelo motor.');
 }catch(e){setMessage('Não foi possível consultar as atividades: '+e.message)}
 finally{btn.disabled=false;btn.textContent='Consultar atividades'}
});

function renderResponse(data){
 const total=data?.total||{},objs=Array.isArray(data?.objetos)?data.objetos:[];
 const fields=[
  ['vRBSNtot','Receita bruta'],['vBC','Base de IBS/CBS'],['vIBSSNtot','IBS devido'],
  ['vCBSSNtot','CBS devida'],['totalIs','IS informado'],['totalTributos','Total dos tributos'],
  ['vIBSSNtotPendSusp','IBS pendente/suspenso'],['vCBSSNtotPendSusp','CBS pendente/suspensa']
 ];
 const present=fields.filter(([key])=>total[key]!==null&&total[key]!==undefined);
 const metricHTML=present.map(([key,label])=>
  '<div class="metric '+(key==='totalTributos'?'feature':'')+'"><small>'+escapeHTML(label)+'</small><strong>'+escapeHTML(money(total[key]))+'</strong></div>').join('');
 const statuses={CALCULADO:['Calculado',''],NAO_CALCULADO:['Não calculado','warn'],INCONSISTENCIA_ENTRADA:['Inconsistência','bad'],FALHA_TECNICA:['Falha técnica','bad'],NAO_IMPLEMENTADO:['Não implementado','warn']};
 const table=objs.map(item=>{
  const t=item.tribCalc||{},[label,color]=statuses[item.estadoItem]||[item.estadoItem||'Sem estado','warn'];
  return '<tr><td>'+escapeHTML(item.nObj)+'</td><td><span class="status-pill '+color+'">'+escapeHTML(label)+'</span></td><td>'+escapeHTML(money(t.vRBSNitem))+'</td><td>'+escapeHTML(money(t.vIBSSN))+'</td><td>'+escapeHTML(money(t.vCBSSN))+'</td><td>'+escapeHTML(money(t.totalItem))+'</td></tr>';
 }).join('');
 const issues=objs.flatMap(item=>(item.erros||[]).map(e=>({item:item.nObj,code:e.code||e.codigo||'',detail:e.detail||e.title||e.message||'Inconsistência identificada pelo motor.'})));
 const errorsHTML=issues.length?'<div class="item-errors"><strong>Itens com inconsistências</strong>'+issues.map(x=>'<p>Item '+escapeHTML(x.item)+' · '+escapeHTML(x.code)+': '+escapeHTML(x.detail)+'</p>').join('')+'</div>':'';
 $('result-content').innerHTML=(present.length?'<div class="metrics">'+metricHTML+'</div>':'<p>O motor não retornou totais para os itens informados.</p>')+
  (objs.length?'<div class="result-table-wrap"><table class="result-table"><thead><tr><th>Item</th><th>Situação</th><th>Receita bruta</th><th>IBS</th><th>CBS</th><th>Total</th></tr></thead><tbody>'+table+'</tbody></table></div>':'')+errorsHTML;
 const successful=objs.filter(x=>x.estadoItem==='CALCULADO').length;
 $('result-caption').textContent=successful+' de '+objs.length+' itens calculados. Itens não calculados ou com erro não entram em todos os totais; confira os estados individuais.';
 state.csv=[['Item','Estado','Receita bruta','IBS','CBS','Total'],...objs.map(x=>[x.nObj,x.estadoItem||'',x.tribCalc?.vRBSNitem??'',x.tribCalc?.vIBSSN??'',x.tribCalc?.vCBSSN??'',x.tribCalc?.totalItem??''])];
 $('results').hidden=false;
 $('results').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
$('simples-form').addEventListener('submit',async(e)=>{
 e.preventDefault();
 if(state.busy)return;
 let payload;try{payload=operation()}catch(err){$('result-content').textContent='';$('results').hidden=true;setMessage(err.message);return}
 state.busy=true;const btn=$('calculate');btn.disabled=true;btn.textContent='Calculando…';
 try{const data=await request('calculadora/observabilidade/simples-nacional',{method:'POST',body:payload});renderResponse(data)}
 catch(err){$('results').hidden=false;$('result-caption').textContent='Não foi possível realizar o cálculo.';$('result-content').innerHTML='<div class="item-errors">'+escapeHTML(err.message)+'. Os campos informados continuam disponíveis para nova tentativa.</div>';setMessage(err.message)}
 finally{state.busy=false;btn.disabled=false;btn.innerHTML='Calcular operação <span aria-hidden="true">→</span>'}
});
$('export-csv').addEventListener('click',()=>{
 if(!state.csv.length)return;
 const csv=state.csv.map(cols=>cols.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const blob=new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='rtc-simples-nacional-'+$('data').value+'.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
})();