import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('web/simples.html','utf8');
const js=readFileSync('web/src/simples.js','utf8');
const css=readFileSync('web/styles-simples.css','utf8');
const mockResult={
 oper:{data:'2027-03-15',tpDoc:'55',CRT:'1'},
 objetos:[
  {nObj:1,estadoItem:'CALCULADO',tribCalc:{vRBSNitem:'1250.00',vBC:'1250.00',vIBSSN:'15.63',vCBSSN:'34.38',totalItem:'50.01'},erros:[]}
 ],
 total:{vRBSNtot:'1250.00',vBC:'1250.00',vIBSSNtot:'15.63',vCBSSNtot:'34.38',totalTributos:'50.01'}
};
function wait(ms=15){return new Promise(r=>setTimeout(r,ms))}
test('Simples Nacional: guided interface, auto connection, official request schema and results',async()=>{
 const dom=new JSDOM(html,{url:'https://rtc.test/simples',pretendToBeVisual:true,runScripts:'outside-only'});
 const w=dom.window;
 const calls=[];
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.matchMedia=()=>({matches:true});
 w.AbortSignal.timeout=()=>new w.AbortController().signal;
 w.fetch=async(input,opts={})=>{
  const u=new URL(input,'https://rtc.test');
  calls.push({route:u.searchParams.get('route'),params:u.searchParams,body:opts.body,method:opts.method||'GET'});
  let data,status=200;
  if(calls.at(-1).route==='versao')data={versao:'0.0.6'};
  else if(calls.at(-1).route==='calculadora/simples-nacional/atividades')data=[
   {codigo:'01',descricao:'Comércio e revenda',disponivel:true},
   {codigo:'09',descricao:'Atividades sujeitas ao Fator R',disponivel:true}
  ];
  else if(calls.at(-1).route==='calculadora/observabilidade/simples-nacional')data=mockResult;
  else{status=400;data={detail:'unknown'}}
  return{ok:status===200,status,text:async()=>JSON.stringify(data)};
 };
 const errors=[];w.addEventListener('error',e=>errors.push(e.message));
 const $=id=>w.document.getElementById(id);
 w.eval(js);
 await wait();
 assert.equal($('status-text').textContent,'Motor conectado');
 assert.equal(w.document.querySelectorAll('.item-card').length,1);
 assert.equal($('regime-wrap').hidden,true);
 $('load-activities').click();await wait();
 assert.equal($('atividades-list').children.length,2);
 $('data').value='2027-03-15';
 $('crt').value='1';
 const item=$('items').querySelector('.item-card');
 for(const [name,value] of [['atividade','01'],['classe','000001'],['base','1.250,00'],['is','0,00'],['ibs','1,25'],['cbs','2,75']]){
  item.querySelector('[name="'+name+'"]').value=value;
 }
 $('simples-form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));await wait();
 const posted=calls.find(x=>x.method==='POST');
 assert.equal(posted.route,'calculadora/observabilidade/simples-nacional');
 const operation=JSON.parse(posted.body);
 assert.equal(operation.CRT,'1');assert.equal(operation.tpDoc,'55');assert.equal(operation.data,'2027-03-15');
 assert.equal(operation.itens.length,1);
 assert.deepEqual({...operation.itens[0]},{numero:1,cClassTrib:'000001',baseCalculo:'1250.00',valorImpostoSeletivo:'0.00',cAtivSN:'01',pIBSSN:'1.2500',pCBSSN:'2.7500'});
 assert.equal($('results').hidden,false);
 assert.match($('result-content').textContent,/50,01/);
 assert.match($('result-content').textContent,/15,63/);
 $('crt').value='3';$('crt').dispatchEvent(new w.Event('change'));
 assert.equal($('regime-wrap').hidden,false);
 $('add-item').click();
 assert.equal($('items').children.length,2);
 assert.equal(w.document.querySelector('#connect-dialog'),null);
 assert.equal(errors.length,0,errors.join(' | '));
 assert.match(css,/grid-template-columns:260px minmax\(0,1fr\)/);
 assert.match(css,/\[hidden\]\{display:none!important\}/);
 w.close();
});
test('HTML keeps Regime Regular and original simulator accessible',()=>{
 assert.match(html,/href="\/oficial"/);
 assert.match(html,/href="\/"/);
 assert.match(html,/id="simples-form"/);
 assert.doesNotMatch(html,/type="password"/);
});
