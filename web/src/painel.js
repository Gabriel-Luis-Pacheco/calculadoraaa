(() => {
'use strict';
const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];
const escape = v => String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const UF_CODES={AC:12,AL:27,AM:13,AP:16,BA:29,CE:23,DF:53,ES:32,GO:52,MA:21,MG:31,MS:50,MT:51,PA:15,PB:25,PE:26,PI:22,PR:41,RJ:33,RN:24,RO:11,RR:14,RS:43,SC:42,SE:28,SP:35,TO:17};
const tools={
 impacto:{name:'Simulador de impacto',subtitle:'Premissas e comparativos em uma única tela.'},
 regular:{name:'Regime Regular',subtitle:'Cálculos de CBS, IBS e IS pelo motor Java.'},
 simples:{name:'Simples Nacional',subtitle:'Cálculo e classificação tributária por atividade.'},
 pedagio:{name:'Pedágio',subtitle:'Rateio por trecho com regras do Regime Regular.'},
 nfse:{name:'NFS-e',subtitle:'Bases, indicadores e locais de incidência.'},
 bases:{name:'Bases especiais',subtitle:'Cálculos auxiliares de mercadorias e Imposto Seletivo.'},
 consultas:{name:'Consultas fiscais',subtitle:'Pesquisa de tabelas, classificações e vigências.'},
 xml:{name:'XML fiscal',subtitle:'Gerar e conferir arquivos XML.'}
};
const states={current:'impacto',framesLoaded:new Set(['impacto']),nfse:'indicador',pending:new Set()};
const today=()=>{
 const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const get=k=>d.find(x=>x.type===k)?.value;
 return get('year')+'-'+get('month')+'-'+get('day');
};
function setStatus(heading,subheading){
 $('status-head').textContent=heading;
 $('status-sub').textContent=subheading;
}
function navigate(name,{history=true}={}){
 if(!tools[name])name='impacto';
 states.current=name;
 for(const b of $$('[data-tool]')){
  const active=b.dataset.tool===name;b.classList.toggle('active',active);
  if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
 for(const pane of $$('[data-pane]'))pane.hidden=pane.dataset.pane!==name;
 $('active-title').textContent=tools[name].name;
 $('footer-current').textContent=tools[name].name;
 $('system-badge').textContent='Código Receita Federal · MIT';
 setStatus(name==='simples'?'Simples Nacional usa um motor Java próprio.':'Painel compacto com resultado sempre à vista.',tools[name].subtitle);
 if(['impacto','regular','simples','xml'].includes(name)){
  const frame=$('frame-'+name);
  if(frame&&!states.framesLoaded.has(name)){
   states.framesLoaded.add(name);
   frame.addEventListener('load',()=>{
    if(name==='xml')setTimeout(()=>{try{frame.contentDocument?.querySelector('[data-page="xml"]')?.click()}catch{}},80);
   },{once:true});
   frame.src=frame.dataset.src;
  }
 }
 if(history) {
  const url=new URL(location.href);
  url.searchParams.set('f',name);
  historyReplace(url.pathname+url.search+url.hash);
 }
}
function historyReplace(href){try{window.history.replaceState(null,'',href)}catch{}}
$$('[data-tool]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.tool)));
$('help-toggle').addEventListener('click',()=>{$('help').hidden=!$('help').hidden});
$('help-close').addEventListener('click',()=>{$('help').hidden=true});
$('compact-toggle').addEventListener('click',()=>{
 const compact=$('.app-shell').classList.toggle('compact');
 $('compact-toggle').setAttribute('aria-pressed',String(compact));
 $('compact-toggle').textContent=compact?'Tela compacta':'Altura livre';
});
function installUFs(select){if(!select)return;const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecione';select.append(placeholder);for(const uf of Object.keys(UF_CODES).sort()){const option=document.createElement('option');option.value=uf;option.textContent=uf;select.append(option)}select.value='RS'}
$$('[data-uf]').forEach(installUFs);
for(const field of ['nfse-data','lookup-data'])$(field).value=today();
$('nfse-ano').value=today().slice(0,4);
$('base-ano').value=today().slice(0,4);
const now=new Date();$('ped-data').value=now.toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(' ','T');

function safeMoney(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n):String(v??'—')}
function numeric(value,label,{required=false,max=null,integer=false}={}){
 let raw=String(value??'').trim().replace(/\s/g,'');
 if(!raw){if(required)throw Error('Informe '+label+'.');return null}
 if(!/^\d+(?:[,.]\d+)*(?:[,.]\d+)?$/.test(raw))throw Error(label+': use apenas números e separadores.');
 if(raw.includes(','))raw=raw.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(?:\.\d{3})+$/.test(raw))raw=raw.replace(/\./g,'');
 const n=Number(raw);
 if(!Number.isFinite(n)||n<0||(max!==null&&n>max)||(integer&&!Number.isInteger(n)))throw Error(label+': valor inválido.');
 if(!integer && raw.includes('.') && raw.split('.')[1].length>2)throw Error(label+': use no máximo duas casas decimais.');
 return integer?String(n):n.toFixed(2);
}
function digits(value,number,label,{optional=false}={}){
 const t=String(value??'').trim();
 if(optional&&!t)return '';
 if(!new RegExp('^\\d{'+number+'}$').test(t))throw Error(label+' precisa ter '+number+' dígitos.');
 return t;
}
function requiredDate(value){const d=String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('Informe a data da operação.');return d}
function cash(label,value){return '<div class="result-metric"><span>'+escape(label)+'</span><strong>'+escape(safeMoney(value))+'</strong></div>'}
function heading(text,note=''){return '<div class="result-card"><h3>'+escape(text)+'</h3>'+(note?'<p>'+escape(note)+'</p>':'')+'</div>'}
function errorHTML(message){return '<div class="error-box">'+escape(message)+'</div>'}
function showError(id,e){$(id).innerHTML=errorHTML(e.message||e)}
function setPending(button,on){button.disabled=on;button.setAttribute('aria-busy',String(on))}
async function callAPI(route,{method='GET',params={},body=null}={}){
 const query=new URLSearchParams({route});
 for(const [k,v]of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')query.set(k,String(v));
 const r=await fetch('/api/rtc?'+query.toString(),{
  method,cache:'no-store',headers:method==='POST'?{'Content-Type':'text/plain;charset=UTF-8'}:{},
  body:method==='POST'?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(58000)
 });
 const raw=await r.text();
 let data;try{data=JSON.parse(raw)}catch{data={detail:raw.slice(0,150)}}
 if(!r.ok)throw Error(data.detail||data.message||data.error||'O motor fiscal não concluiu a operação (HTTP '+r.status+').');
 return {data,warning:r.headers.get('x-warning-dados-simulados')};
}
const labelMap={
 codigo:'Código',descricao:'Descrição',sigla:'Sigla',nome:'Nome',nomeMunicipio:'Município',
 uf:'UF',municipio:'Município IBGE',numero:'Número',baseCalculo:'Base de cálculo',
 valor:'Valor',cst:'CST',cClassTrib:'Classificação tributária',ncm:'NCM',nbs:'NBS',
 valido:'Combinação válida',dataInicio:'Início da vigência',dataFim:'Fim da vigência',
 aliquota:'Alíquota',vIBS:'IBS',vCBS:'CBS',vIS:'Imposto Seletivo',total:'Total',
 codigoMunicipio:'Código IBGE',quantidade:'Quantidade',codigoUf:'Código da UF'
};
const friendlyKey=key=>labelMap[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,x=>x.toUpperCase());
function flattenScalar(data){
 return Object.entries(data).filter(([,v])=>v===null||['string','number','boolean'].includes(typeof v)).slice(0,30);
}
function listResult(data,{limit=75,depth=0}={}){
 if(data===null||data===undefined)return '<p>Consulta sem dados retornados.</p>';
 if(Array.isArray(data)){
  if(!data.length)return '<p>Não há registros para os filtros informados.</p>';
  const rows=data.slice(0,limit);
  const cells=rows.map((x,i)=>{
   if(x===null||typeof x!=='object')return '<li><strong>'+escape(i+1)+'.</strong> '+escape(x)+'</li>';
   const pairs=flattenScalar(x);
   const title=x.descricao||x.nome||x.codigo||x.cClassTrib||x.ncm||'Registro '+(i+1);
   const details=pairs.filter(([k])=>!['descricao','nome'].includes(k)).slice(0,8).map(([k,v])=>'<b>'+escape(friendlyKey(k))+':</b> '+escape(v)).join(' · ');
   return '<li><strong>'+escape(title)+'</strong><div>'+details+'</div></li>';
  }).join('');
  return '<div class="result-card"><h3>'+escape(data.length)+' registros encontrados</h3><p>Exibindo '+rows.length+' primeiro(s) registro(s).</p><ul class="result-list">'+cells+'</ul></div>';
 }
 if(typeof data!=='object')return heading('Resultado',String(data));
 const scalar=flattenScalar(data);
 const metrics=scalar.length?'<div class="result-grid">'+scalar.map(([k,v])=>'<div class="result-metric"><span>'+escape(friendlyKey(k))+'</span><strong>'+escape(v===null?'—':typeof v==='boolean'?(v?'Sim':'Não'):String(v))+'</strong></div>').join('')+'</div>':'';
 const nested=Object.entries(data).filter(([,v])=>v&&typeof v==='object');
 return metrics+(depth<2?nested.slice(0,8).map(([key,v])=>heading(friendlyKey(key))+listResult(v,{limit:Math.min(limit,25),depth:depth+1})).join(''):'');
}
function result(id,title,data,{warning=null}={}){
 const label=warning?'<p class="state-pill warn">O motor indicou valores simulados; confirme a vigência.</p>':'';
 $(id).innerHTML=heading(title)+label+listResult(data);
}

let trechoCount=0;
function addTrecho(values={}){
 if($('trechos').children.length>=30)throw Error('Limite de 30 trechos por operação.');
 const element=$('trecho-template').content.firstElementChild.cloneNode(true);
 element.dataset.num=String(++trechoCount);
 const select=element.querySelector('[data-name="uf"]');installUFs(select);
 for(const [k,v] of Object.entries(values)){const el=element.querySelector('[data-name="'+k+'"]');if(el)el.value=v}
 element.querySelector('.delete-trecho').addEventListener('click',()=>{if($('trechos').children.length<=1)return;element.remove();numberTrechos()});
 $('trechos').append(element);numberTrechos();
}
function numberTrechos(){for(const [i,x] of [...$('trechos').children].entries()){x.querySelector('.trecho-head strong').textContent='Trecho '+String(i+1).padStart(2,'0');x.querySelector('.delete-trecho').hidden=$('trechos').children.length===1}}
addTrecho();
$('add-trecho').addEventListener('click',()=>{try{addTrecho()}catch(e){showError('pedagio-result',e)}});
$('pedagio-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const button=e.submitter||$('pedagio-form').querySelector('button[type="submit"]');
 try{
  const date=$('ped-data').value;
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date))throw Error('Informe data e hora de emissão do pedágio.');
  const body={
   dataHoraEmissao:date+':00'+$('ped-offset').value,
   codigoMunicipioOrigem:Number(digits($('ped-ibge').value,7,'IBGE de origem')),
   ufMunicipioOrigem:$('ped-uf').value,
   cst:digits($('ped-cst').value,3,'CST'),
   cClassTrib:digits($('ped-classe').value,6,'cClassTrib'),
   baseCalculo:numeric($('ped-base').value,'Base do pedágio',{required:true}),
   trechos:[...$('trechos').children].map((el,i)=>({
    numero:i+1,
    municipio:Number(digits(el.querySelector('[data-name="municipio"]').value,7,'IBGE do trecho '+(i+1))),
    uf:el.querySelector('[data-name="uf"]').value,
    extensao:numeric(el.querySelector('[data-name="extensao"]').value,'Extensão do trecho '+(i+1),{required:true})
   }))
  };
  if(!body.ufMunicipioOrigem||body.trechos.some(t=>!t.uf))throw Error('Selecione a UF da origem e de cada trecho.');
  setPending(button,true);
  const {data,warning}=await callAPI('pedagio',{method:'POST',body});
  const total=data.total||{};
  const parts=Array.isArray(data.trechos)?data.trechos:[];
  let output=heading('Cálculo concluído','Consulte base, extensão e os tributos por trecho. As regras são do motor Java.');
  output+=warning?'<p class="state-pill warn">Alíquotas simuladas conforme aviso do motor.</p>':'';
  output+='<div class="result-grid">'+(data.baseCalculo!=null?cash('Base da operação',data.baseCalculo):'')+
   (data.extensaoTotal!=null?'<div class="result-metric"><span>Extensão total</span><strong>'+escape(data.extensaoTotal)+' km</strong></div>':'')+'</div>';
  output+=heading('Total dos tributos')+listResult(total,{depth:1});
  output+=heading('Trechos')+listResult(parts,{depth:1});
  $('pedagio-result').innerHTML=output;
 }catch(err){showError('pedagio-result',err)}
 finally{setPending(button,false)}
});

$$('[data-nfse]').forEach(b=>b.addEventListener('click',()=>{
 states.nfse=b.dataset.nfse;
 $$('[data-nfse]').forEach(x=>x.classList.toggle('active',x===b));
 $('nfse-indicador').hidden=states.nfse==='base';
 $('nfse-base').hidden=states.nfse!=='base';
 $('nfse-submit').innerHTML=({indicador:'Validar indicador',local:'Consultar local da operação',base:'Calcular base da NFS-e'})[states.nfse]+' <span>→</span>';
 $('nfse-result').innerHTML=heading('Nova consulta','Preencha os campos e clique no botão de ação.');
}));
$('nfse-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const button=e.submitter||$('nfse-submit');try{
  let route,body,params,method='POST';
  if(states.nfse==='base'){
   route='nfse/base-calculo';
   body={
    anoFatoGerador:Number(numeric($('nfse-ano').value,'Ano do fato gerador',{required:true,integer:true})),
    valorServico:numeric($('nfse-valor').value,'Valor do serviço',{required:true}),
    descontoIncondicional:numeric($('nfse-desconto').value,'Desconto')||'0.00',
    vCalcReeRepRes:numeric($('nfse-reembolso').value,'Reembolsos')||'0.00',
    vCalcDedRedIBSCBS:numeric($('nfse-deducoes').value,'Deduções')||'0.00',
    iss:numeric($('nfse-iss').value,'ISS')||'0.00',
    pis:numeric($('nfse-pis').value,'PIS')||'0.00',
    cofins:numeric($('nfse-cofins').value,'COFINS')||'0.00'
   };
  } else {
   const cIndOp=digits($('nfse-indop').value,6,'cIndOp');
   const dataOcorrenciaFatoGerador=requiredDate($('nfse-data').value);
   if(states.nfse==='local'){
    route='nfse/local-operacao';method='GET';
    params={cIndOp,dataOcorrenciaFatoGerador};
   }else{
    route='nfse/indicador-operacao/validate';
    body={cIndOp,dataOcorrenciaFatoGerador,
     cClassTrib:digits($('nfse-classe').value,6,'cClassTrib'),
     nbs:digits($('nfse-nbs').value,9,'NBS')};
    const code=$('nfse-tribnac').value.trim();
    if(code&&!/^(?:\d{4}|\d{6})$/.test(code))throw Error('Código nacional precisa ter 4 ou 6 dígitos.');
    if(code)body.cTribNac=code;
   }
  }
  setPending(button,true);
  const {data,warning}=await callAPI(route,{method,body,params});
  if(route.endsWith('/validate')&&typeof data?.valido==='boolean'){
   $('nfse-result').innerHTML='<span class="state-pill '+(data.valido?'':'bad')+'">'+(data.valido?'Combinação válida':'Combinação inválida')+'</span>'+listResult(data);
  } else result('nfse-result','Resposta do motor',data,{warning});
 }catch(err){showError('nfse-result',err)}
 finally{setPending(button,false)}
});
const BASE_FIELDS={
 valorBem:'Valor do bem',ajusteAcrescimos:'Acréscimos',juros:'Juros',multas:'Multas',encargos:'Encargos',
 frete:'Frete',freteCobrado:'Frete cobrado',impostoSeletivo:'Imposto Seletivo',
 outrosTributos:'Outros tributos',demaisImportancias:'Demais valores e seguros',
 icms:'ICMS',iss:'ISS',pis:'PIS',pisImportacao:'PIS Importação',
 cofins:'COFINS',cofinsImportacao:'COFINS Importação',cosip:'COSIP',ipi:'IPI',
 descontoIncondicional:'Desconto incondicional',bonificacao:'Bonificações',devolucaoVendas:'Devoluções'
};
const EXTRAS={
 'cbs-ibs-mercadorias':['valorBem','ajusteAcrescimos','juros','multas','encargos','frete','impostoSeletivo','outrosTributos','demaisImportancias','icms','iss','pis','pisImportacao','cofins','cofinsImportacao','cosip','ipi','descontoIncondicional'],
 'is-mercadorias':['valorBem','ajusteAcrescimos','juros','multas','encargos','freteCobrado','outrosTributos','demaisImportancias','icms','iss','cosip','ipi','descontoIncondicional','bonificacao','devolucaoVendas']
};
function mountBaseFields(){
 const prior=Object.fromEntries([...$('base-fields').querySelectorAll('[data-base-key]')].map(x=>[x.dataset.baseKey,x.value]));
 const keys=EXTRAS[$('base-tipo').value];
 $('base-fields').replaceChildren();
 for(const key of keys){
  const label=document.createElement('label');label.textContent=BASE_FIELDS[key];
  const input=document.createElement('input');input.dataset.baseKey=key;
  input.inputMode='decimal';input.placeholder='0,00';input.value=prior[key]||'';
  label.append(input);$('base-fields').append(label);
 }
}
$('base-tipo').addEventListener('change',mountBaseFields);
mountBaseFields();
$('base-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.submitter||$('base-form').querySelector('button[type="submit"]');
 try{
  const key=$('base-tipo').value;
  const body={anoFatoGerador:Number(numeric($('base-ano').value,'Ano',{required:true,integer:true}))};
  for(const input of $('base-fields').querySelectorAll('[data-base-key]'))body[input.dataset.baseKey]=numeric(input.value,BASE_FIELDS[input.dataset.baseKey])||'0.00';
  setPending(button,true);
  const {data,warning}=await callAPI('base-calculo/'+key,{method:'POST',body});
  result('base-result','Base tributária calculada',data,{warning});
 }catch(err){showError('base-result',err)}finally{setPending(button,false)}
});

const LOOKUPS=[
 {label:'CST e cClassTrib · CBS/IBS',route:'situacoes-tributarias/cbs-ibs',data:true},
 {label:'Classificações CBS/IBS',route:'classificacoes-tributarias/cbs-ibs',data:true},
 {label:'Uma classificação CBS/IBS por código',route:'classificacoes-tributarias/cbs-ibs/class-trib/{code}',data:true,code:'cClassTrib',len:6},
 {label:'Uma classificação IS por código',route:'classificacoes-tributarias/is/class-trib/{code}',data:true,code:'cClassTrib',len:6},
 {label:'Classificações Imposto Seletivo',route:'classificacoes-tributarias/imposto-seletivo',data:true},
 {label:'CST do Imposto Seletivo',route:'situacoes-tributarias/imposto-seletivo',data:true},
 {label:'NCM por código',route:'ncm',data:true,code:'ncm',len:8},
 {label:'NCM vigentes na data',route:'ncm/vigentes',data:true},
 {label:'NBS por código',route:'nbs',data:true,code:'nbs',len:9},
 {label:'Lista de NBS',route:'nbs/lista',data:true},
 {label:'NBS aplicáveis à classificação',route:'nbs-aplicaveis',data:true,code:'cClassTrib',len:6},
 {label:'NCM aplicável a cClassTrib?',route:'classificacoes-tributarias/ncm-aplicavel',dataArg:'dataOcorrenciaFatoGerador',code:'cClassTrib',len:6,extra:'ncm',extraLen:8},
 {label:'NBS aplicável a cClassTrib?',route:'classificacoes-tributarias/nbs-aplicavel',dataArg:'dataOcorrenciaFatoGerador',code:'cClassTrib',len:6,extra:'nbs',extraLen:9},
 {label:'Fundamentações legais',route:'fundamentacoes-legais',data:true},
 {label:'Alíquota da União',route:'aliquota-uniao',data:true},
 {label:'Alíquota por UF',route:'aliquota-uf',data:true,uf:true},
 {label:'Alíquota municipal',route:'aliquota-municipio',data:true,mun:true},
 {label:'Estados brasileiros',route:'ufs'},
 {label:'Municípios por UF',route:'ufs/municipios',uf:true},
 {label:'Tipos de documento fiscal',route:'dfe/grupos'},
 {label:'Tipos de atores',route:'ator/grupos'},
 {label:'Redutores de compras governamentais',route:'redutores-compra-governamental'},
 {label:'Transferências CBS',route:'transferencias-cbs'},
 {label:'Transferências IBS',route:'transferencias-ibs'},
 {label:'CST do IS (auxiliar)',route:'situacoes-tributarias/is',data:true},
 {label:'Indicadores NFS-e',route:'../nfse/indicador-operacao',dataArg:'dataOcorrenciaFatoGerador'},
 {label:'Locais de fornecimento NFS-e',route:'../nfse/locais-fornecimento'},
 {label:'Locais de incidência NFS-e',route:'../nfse/locais-incidencia'}
];
const lookupSelect=$('lookup-route');
LOOKUPS.forEach((opt,i)=>{const el=document.createElement('option');el.value=String(i);el.textContent=opt.label;lookupSelect.append(el)});
function lookupMode(){
 const spec=LOOKUPS[Number(lookupSelect.value)]||LOOKUPS[0];
 $('lookup-data-wrap').hidden=!(spec.data||spec.dataArg);
 $('lookup-code-wrap').hidden=!spec.code;
 $('lookup-extra-wrap').hidden=!spec.extra;
 $('lookup-uf-wrap').hidden=!spec.uf;
 $('lookup-mun-wrap').hidden=!spec.mun;
 $('lookup-code').placeholder=spec.code?friendlyKey(spec.code):'Código fiscal';
 $('lookup-extra').placeholder=spec.extra?friendlyKey(spec.extra):'Segundo código';
 $('lookup-description').textContent=spec.label+'. As informações são obtidas do banco de dados e da vigência do motor oficial; não há cálculo local.';
}
$('lookup-route').addEventListener('change',lookupMode);
lookupMode();
$('lookup-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=e.submitter||$('lookup-form').querySelector('button[type="submit"]');
 try{
  const spec=LOOKUPS[Number(lookupSelect.value)],params={};
  let route=spec.route;
  if(spec.data)params.data=requiredDate($('lookup-data').value);
  if(spec.dataArg)params[spec.dataArg]=requiredDate($('lookup-data').value);
  if(spec.code){
   const val=digits($('lookup-code').value,spec.len||6,friendlyKey(spec.code));
   if(route.includes('{code}'))route=route.replace('{code}',val);
   else params[spec.code]=val;
  }
  if(spec.extra)params[spec.extra]=digits($('lookup-extra').value,spec.extraLen||6,friendlyKey(spec.extra));
  if(spec.uf){const uf=$('lookup-uf').value;if(!uf)throw Error('Selecione a UF.');params[route==='dados-abertos/aliquota-uf'?'codigoUf':'siglaUf']=route==='aliquota-uf'?UF_CODES[uf]:uf}
  if(spec.mun)params.codigoMunicipio=digits($('lookup-mun').value,7,'Código IBGE');
  const fullRoute=route.startsWith('../nfse/')?route.slice(3):'dados-abertos/'+route;
  setPending(button,true);
  const {data,warning}=await callAPI(fullRoute,{params});
  result('lookup-result',spec.label,data,{warning});
 }catch(err){showError('lookup-result',err)}finally{setPending(button,false)}
});

const route=location.pathname.toLowerCase();
const initial=new URLSearchParams(location.search).get('f')||(route==='/simples'?'simples':route==='/oficial'?'regular':'impacto');
navigate(initial,{history:false});
window.addEventListener('popstate',()=>navigate(new URLSearchParams(location.search).get('f')||'impacto',{history:false}));
})();