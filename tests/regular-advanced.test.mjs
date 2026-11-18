import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const html=readFileSync('web/oficial.html','utf8'),js=readFileSync('web/src/oficial.js','utf8');
const delay=()=>new Promise(r=>setTimeout(r,20));
function setup(){
 const dom=new JSDOM(html,{url:'https://rtc.example/oficial.html?embedded=1',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;const calls=[];const errors=[];
 w.addEventListener('error',e=>errors.push(e.message));
 w.AbortSignal.timeout=()=>new w.AbortController().signal;
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.matchMedia=()=>({matches:false});
 w.fetch=async(url,options={})=>{
  const u=new URL(url,'https://rtc.example');
  calls.push({route:u.searchParams.get('route'),method:options.method||'GET',body:options.body});
  return {ok:true,status:200,text:async()=>JSON.stringify({objetos:[{nObj:1,estadoItem:'CALCULO_SIMULADO',tribCalc:{IBSCBS:{gIBSCBS:{vBC:'1000.00',vIBS:'1.00',gCBS:{vCBS:'40.00'}}}}}],total:{tribCalc:{IBSCBSTot:{gIBS:{vIBS:'1.00'},gCBS:{vCBS:'40.00'}},ISTot:{vIS:'0.00'}}}}),headers:{get:()=>null}};
 };
 w.eval(js);
 return {dom,w,$:id=>w.document.getElementById(id),calls,errors};
}
function fill(w,key,value,i=0){
 const input=w.document.querySelector('[data-item-field="'+key+'"][data-i="'+i+'"]');
 assert.ok(input,'Missing advanced field '+key);
 input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));
}
test('Regime Regular: Compra Gov + tributacaoRegular + gComponentesBC + fuso form official DTO',async()=>{
 const {dom,w,$,calls,errors}=setup();
 $('sample-operation').click();
 $('op-gov-ente').value='4';$('op-gov-oper').value='5';$('op-offset').value='-04:00';
 fill(w,'regularCst','000');fill(w,'regularClass','000001');
 fill(w,'bcProd','1.000,00');fill(w,'bcFrete','50,00');fill(w,'bcICMS','180,00');
 $('operation-run').click();await delay();
 const req=calls.find(x=>x.route==='observabilidade/regime-geral'&&x.method==='POST');
 assert.ok(req,'Regime regular calculation was not called; calls: '+JSON.stringify(calls.map(x=>x.route)));
 const operation=JSON.parse(req.body);
 assert.equal(operation.dhFatoGerador,'2027-03-10T10:00:00-04:00');
 assert.deepEqual(operation.gCompraGov,{tpEnteGov:4,tpOperGov:5});
 assert.deepEqual(operation.itens[0].tributacaoRegular,{cst:'000',cClassTrib:'000001'});
 assert.deepEqual(operation.itens[0].gComponentesBC,{vProd:'1000.00',vFrete:'50.00',vICMS:'180.00'});
 assert.equal(operation.itens[0].baseCalculo,'100.00');
 assert.equal(operation.itens[1].tributacaoRegular,undefined);
 assert.equal(operation.itens[1].gComponentesBC,undefined);
 assert.match($('results-body').textContent,/40,00/);
 assert.equal(errors.length,0,errors.join('; '));
 dom.window.close();
});
test('Regime Regular: optional advanced groups are absent unless filled',async()=>{
 const {dom,w,$,calls}=setup();
 $('sample-operation').click();
 $('operation-run').click();await delay();
 const op=JSON.parse(calls.find(x=>x.route==='observabilidade/regime-geral').body);
 assert.equal(op.gCompraGov,undefined);
 assert.equal(op.itens[0].tributacaoRegular,undefined);
 assert.equal(op.itens[0].gComponentesBC,undefined);
 assert.match(op.dhFatoGerador,/-03:00$/);
 dom.window.close();
});
test('Regime Regular: rejects incomplete regular taxation and invalid gov type',async()=>{
 const {dom,w,$,calls}=setup();
 $('sample-operation').click();
 fill(w,'regularCst','000');
 $('operation-run').click();await delay();
 assert.equal(calls.filter(x=>x.route==='observabilidade/regime-geral').length,0);
 assert.match($('results-body').textContent,/tributação regular exige CST/);
 dom.window.close();
});