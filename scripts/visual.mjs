import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
await mkdir('artifacts',{recursive:true});
const passed=[];
try{
 for(const width of [1920,1680,1440,1366,1100,1024,800,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/painel.html',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(250);
  const outer=await page.evaluate(()=>{
   const w=innerWidth,h=innerHeight,root=document.querySelector('.app-shell'),
   work=document.getElementById('workspace'),rect=work.getBoundingClientRect();
   return {width:w,height:h,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,
    viewportRoot:root.getBoundingClientRect().height,mainX:rect.x,mainY:rect.y,mainW:rect.width,mainH:rect.height,scrollY:scrollY};
  });
  assert.ok(outer.mainW>200,'Main workspace too small at '+width+' '+JSON.stringify(outer));
  assert.ok(outer.bodyWidth<=width+2,'Document horizontal overflow '+width+' '+JSON.stringify(outer));
  assert.ok(outer.bodyHeight<=900+2,'Document vertical scroll '+width+' '+JSON.stringify(outer));
  await page.locator('[data-tool="regular"]').click();
  const frame=page.frameLocator('#frame-regular');
  await frame.locator('.screen.active').waitFor({state:'visible',timeout:15000});
  await page.waitForTimeout(150);
  const layout=await page.locator('#frame-regular').evaluate(frame=>{
   const d=frame.contentDocument,sc=d.querySelector('.screen.active')?.getBoundingClientRect(),
     main=d.querySelector('.main-content')?.getBoundingClientRect(),res=d.getElementById('results')?.getBoundingClientRect();
   return{docWidth:d.documentElement.scrollWidth,docHeight:d.documentElement.scrollHeight,winWidth:frame.contentWindow.innerWidth,winHeight:frame.contentWindow.innerHeight,mainX:main.x,mainY:main.y,mainW:main.width,mainH:main.height,formX:sc.x,formY:sc.y,formW:sc.width,formH:sc.height,resultX:res.x,resultY:res.y};
  });
  assert.ok(layout.formY<120 && layout.formW>150,'Regular form clipped/under sidebar at '+width+': '+JSON.stringify(layout));
  assert.ok(layout.docWidth<=layout.winWidth+2,'Embedded regular horizontal overflow '+width+': '+JSON.stringify(layout));
  assert.ok(layout.docHeight<=layout.winHeight+2,'Embedded regular page scroll '+width+': '+JSON.stringify(layout));
  await page.locator('[data-tool="simples"]').click();
  const sm=page.frameLocator('#frame-simples');
  await sm.locator('#simples-form').waitFor({state:'visible',timeout:15000});
  const sim=await page.locator('#frame-simples').evaluate(frame=>{
   const d=frame.contentDocument,a=d.getElementById('simples-form').getBoundingClientRect();
   return {formY:a.y,formW:a.width,docWidth:d.documentElement.scrollWidth,winWidth:frame.contentWindow.innerWidth,docHeight:d.documentElement.scrollHeight,winHeight:frame.contentWindow.innerHeight}
  });
  assert.ok(sim.formW>150&&sim.formY<110,'Simples form not at top '+width+' '+JSON.stringify(sim));
  assert.ok(sim.docWidth<=sim.winWidth+2,'Simples page has horizontal scroll '+width+' '+JSON.stringify(sim));
  assert.ok(sim.docHeight<=sim.winHeight+2,'Simples page has vertical document scroll '+width+' '+JSON.stringify(sim));
  await page.locator('[data-tool="pedagio"]').click();
  const native=await page.locator('[data-pane="pedagio"]').evaluate(x=>{
   const a=x.querySelector('.form-side').getBoundingClientRect(),b=x.querySelector('.result-side').getBoundingClientRect();
   return{form:{x:a.x,y:a.y,w:a.width,h:a.height},result:{x:b.x,y:b.y,w:b.width,h:b.height}}
  });
  assert.ok(native.form.w>150&&native.result.w>150,'Native form/results clipped '+width+' '+JSON.stringify(native));
  if(width>800)assert.ok(native.result.x>native.form.x+native.form.w-1,'Result is not beside form '+width);
  else assert.ok(native.result.y>=native.form.y+native.form.h-1,'Mobile result is not below form '+width);
  assert.equal(errors.length,0,'JS runtime errors '+width+': '+errors.join('|'));
  if([1920,1366,1024,390].includes(width))await page.screenshot({path:'artifacts/rtc-panel-'+width+'.png',fullPage:false});
  passed.push({width,outer,regular:layout,simples:sim,native});
  await page.close();
 }
 console.log(JSON.stringify({passed:passed.length,viewports:passed.map(x=>({width:x.width,pageH:x.outer.bodyHeight,formY:x.regular.formY,resultX:x.native.result.x}))},null,2));
}finally{await browser.close()}
