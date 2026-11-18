import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('web/painel.html','utf8'),js=readFileSync('web/src/painel.js','utf8');
const css=readFileSync('web/styles-painel.css','utf8'),embed=readFileSync('web/styles-embed.css','utf8');
const sleep=()=>new Promise(r=>setTimeout(r,20));
function setup(){
 const d=new JSDOM(html,{url:'https://rtc.example/painel',runScripts:'outside-only',pretendToBeVisual:true});
 d.window.AbortSignal.timeout=()=>new d.window.AbortController().signal;
 const calls=[];d.window.fetch=async(u,opts={})=>{const url=new URL(u,'https://rtc.example'),route=url.searchParams.get('route');calls.push({url,route,opts});
 const data=route==='pedagio'?{baseCalculo:'200.00',extensaoTotal:'10.00',total:{cbs:'2.00'},trechos:[{numero:1,municipio:4314902}]}:route==='nfse/indicador-operacao/validate'?{valido:true}:route==='nfse/base-calculo'?{baseCalculo:'950.00'}:route==='nfse/local-operacao'?{codigo:'100301',descricao:'Local'}:{baseCalculo:'105.00'};
 return{ok:true,status:200,text:async()=>JSON.stringify(data),headers:{get:()=>null}}};
 d.window.eval(js);
 return {dom:d,w:d.window,$:id=>d.window.document.getElementById(id),calls};
}
test('Painel em um viewport: oito ferramentas, sem recriação dos formulários ou necessidade de outra aba',()=>{
 const {dom,w,$}=setup();
 assert.equal(w.document.querySelectorAll('[data-tool]').length,8);
 assert.equal(w.document.querySelector('.app-shell').classList.contains('compact'),true);
 assert.match(css,/height:100dvh/);
 assert.match(embed,/html\.embedded .main-content/);
 for(const name of ['impacto','regular','simples','pedagio','nfse','bases','consultas','xml']){
  w.document.querySelector('[data-tool="'+name+'"]').click();
  assert.equal(w.document.querySelectorAll('[data-pane]:not([hidden])').length,1);
  assert.equal(w.document.querySelector('[data-pane="'+name+'"]').hidden,false);
 }
 assert.equal($('frame-regular').getAttribute('src'),'/oficial.html?embedded=1');
 assert.equal($('frame-simples').getAttribute('src'),'/simples.html?embedded=1');
 assert.equal($('frame-xml').getAttribute('src'),'/oficial.html?embedded=1');
 const frame=$('frame-regular');
 w.document.querySelector('[data-tool="simples"]').click();
 w.document.querySelector('[data-tool="regular"]').click();
 assert.equal($('frame-regular'),frame);
 $('compact-toggle').click();assert.equal(w.document.querySelector('.app-shell').classList.contains('compact'),false);
 $('compact-toggle').click();assert.equal(w.document.querySelector('.app-shell').classList.contains('compact'),true);
 dom.window.close();
});
test('Pedágio envia DTO Java com município, zona UTC e trechos',async()=>{
 const {dom,w,$,calls}=setup();
 $('ped-data').value='2027-03-10T10:00';$('ped-uf').value='RS';$('ped-ibge').value='4314902';$('ped-base').value='200,00';$('ped-cst').value='000';$('ped-classe').value='000002';
 const tr=$('trechos').firstElementChild;tr.querySelector('[data-name="uf"]').value='RS';tr.querySelector('[data-name="municipio"]').value='4314902';tr.querySelector('[data-name="extensao"]').value='10,00';
 $('pedagio-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep();
 const req=calls.at(-1);assert.equal(req.route,'pedagio');const body=JSON.parse(req.opts.body);
 assert.equal(body.codigoMunicipioOrigem,4314902);
 assert.equal(body.dataHoraEmissao,'2027-03-10T10:00:00-03:00');
 assert.deepEqual(body.trechos,[{numero:1,municipio:4314902,uf:'RS',extensao:'10.00'}]);
 assert.match($('pedagio-result').textContent,/200/);
 dom.window.close();
});
test('NFS-e: validação, local e base utilizam contratos distintos',async()=>{
 const {dom,w,$,calls}=setup();
 $('nfse-data').value='2027-03-15';$('nfse-indop').value='100301';$('nfse-classe').value='620001';$('nfse-nbs').value='115021000';
 $('nfse-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep();
 assert.equal(calls.at(-1).route,'nfse/indicador-operacao/validate');
 assert.deepEqual(JSON.parse(calls.at(-1).opts.body),{cIndOp:'100301',dataOcorrenciaFatoGerador:'2027-03-15',cClassTrib:'620001',nbs:'115021000'});
 assert.match($('nfse-result').textContent,/válida/);
 w.document.querySelector('[data-nfse="local"]').click();$('nfse-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep();
 assert.equal(calls.at(-1).route,'nfse/local-operacao');
 assert.equal(calls.at(-1).url.searchParams.get('cIndOp'),'100301');
 w.document.querySelector('[data-nfse="base"]').click();$('nfse-ano').value='2027';$('nfse-valor').value='1.000,00';
 $('nfse-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep();
 assert.equal(calls.at(-1).route,'nfse/base-calculo');
 assert.equal(JSON.parse(calls.at(-1).opts.body).valorServico,'1000.00');
 dom.window.close();
});
test('Bases auxiliares e consulta estadual do motor oficial',async()=>{
 const {dom,w,$,calls}=setup();
 $('base-ano').value='2027';
 $('base-fields').querySelector('[data-base-key="valorBem"]').value='105,00';
 $('base-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep();
 assert.equal(calls.at(-1).route,'base-calculo/cbs-ibs-mercadorias');
 assert.equal(JSON.parse(calls.at(-1).opts.body).valorBem,'105.00');
 $('base-tipo').value='is-mercadorias';$('base-tipo').dispatchEvent(new w.Event('change'));
 assert.ok($('base-fields').querySelector('[data-base-key="bonificacao"]'));
 $('base-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep();
 assert.equal(calls.at(-1).route,'base-calculo/is-mercadorias');
 const o=[...$('lookup-route').options].find(x=>x.textContent==='Alíquota por UF');
 assert.ok(o);$('lookup-route').value=o.value;$('lookup-route').dispatchEvent(new w.Event('change'));
 $('lookup-uf').value='RS';$('lookup-data').value='2027-03-15';
 $('lookup-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep();
 assert.equal(calls.at(-1).route,'dados-abertos/aliquota-uf');
 assert.equal(calls.at(-1).url.searchParams.get('codigoUf'),'43');
 assert.equal(calls.at(-1).url.searchParams.get('siglaUf'),null);
 dom.window.close();
});