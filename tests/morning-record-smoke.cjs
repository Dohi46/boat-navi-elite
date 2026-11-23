const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('morning-record.js', 'utf8');
new vm.Script(source);
function node(tag='div') {
 return {tag, children:[], style:{}, classList:{contains:()=>true}, textContent:'', value:'', disabled:false,
  append(...xs){this.children.push(...xs)}, replaceChildren(...xs){this.children=[...xs]},
  addEventListener(name,fn){(this.events??={})[name]=fn}, closest(){return this},
  get childElementCount(){return this.children.length}};
}
// Build API fixtures without deeply nested inline object literals.
function liveResponse(date, trifecta) {
 return {ok:true,json:async()=>({programs:{stadiums:{'1':{races:{'1':{date,result:{payouts:{trifecta}}}}}}}})};
}
async function runCase({date='2026-11-19', savedDate=date, results=null, missing=false, apiResponses=[]}) {
 const ids=Object.fromEntries(['morningTracker','morningDate','morningRefresh','morningStatus','morningTotals','morningVenues'].map(x=>[x,node()]));
 const document={getElementById:id=>ids[id],createElement:node,querySelectorAll:()=>[],visibilityState:'visible'};
 const daily={date:savedDate,races:[{venue:1,race:1,picks:[{pick:'1-2-3',stake:100},{pick:'1-3-2',stake:100}],result:results}]};
 const calls=[];
 const fetch=async url=>{calls.push(url);if(url.startsWith('./data/auto/'))return {ok:!missing,status:missing?404:200,json:async()=>daily};const response=apiResponses.shift();return (typeof response==='function'?response():response) ?? {ok:false,status:503};};
 const ctx={document,fetch,Intl,Date,Number,String,Map,Array,Error,Math,AbortController,setTimeout,clearTimeout,setInterval:()=>0,STADIUMS:{1:'桐生'}};
 vm.runInNewContext(source,ctx);
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(ids.morningDate.value.length,10);
 ids.morningDate.value=date;
 ids.morningRefresh.events.click();
 await new Promise(resolve=>setTimeout(resolve,20));
 return {ids,calls};
}
(async()=>{
 const a=await runCase({results:null});
 assert.match(a.ids.morningVenues.children[0].children[1].textContent,/朝の買い目 1-2-3、1-3-2/);
 assert.match(a.ids.morningVenues.children[0].children[1].textContent,/結果未判定（中止・取得待ち含む）/);
 const b=await runCase({results:{winningCombinations:[{combination:'1-2-3',amount:2500}]}});
 assert.match(b.ids.morningVenues.children[0].children[1].textContent,/🎯 1-2-3/);
 assert.match(b.ids.morningVenues.children[0].children[1].textContent,/2,500円/);
 const retry=await runCase({results:null,apiResponses:[{ok:false,status:503},liveResponse('2026-11-19',[{combination:'1-2-3',amount:2500}])]});
 assert.match(retry.ids.morningVenues.children[0].children[1].textContent,/🎯 1-2-3/);
 assert.ok(retry.calls.filter(x=>x.startsWith('https://boatraceopenapi.github.io/')).length>=2);
 const networkRecovery=await runCase({results:null,apiResponses:[()=>Promise.reject(new Error('network unavailable')),liveResponse('2026-11-19',[{combination:'1-2-3',amount:2500}])]});
 assert.match(networkRecovery.ids.morningVenues.children[0].children[1].textContent,/🎯 1-2-3/);
 assert.equal(networkRecovery.calls.filter(x=>x.startsWith('https://boatraceopenapi.github.io/')).length,2);
 const malformedRecovery=await runCase({results:null,apiResponses:[{ok:true,json:async()=>({unexpected:true})},liveResponse('2026-11-19',[{combination:'1-2-3',amount:2500}])]});
 assert.match(malformedRecovery.ids.morningVenues.children[0].children[1].textContent,/🎯 1-2-3/);
 assert.equal(malformedRecovery.calls.filter(x=>x.startsWith('https://boatraceopenapi.github.io/')).length,2);
 const fallback=await runCase({results:{winningCombinations:[{combination:'1-2-3',amount:2500}]},apiResponses:[{ok:false,status:503},{ok:false,status:503},{ok:false,status:503}]});
 assert.match(fallback.ids.morningVenues.children[0].children[1].textContent,/🎯 1-2-3/);
 assert.match(fallback.ids.morningStatus.textContent,/GitHub保存済み結果のみ反映/);
 assert.equal(fallback.calls.filter(x=>x.startsWith('https://boatraceopenapi.github.io/')).length,3);
 const wrongDate=await runCase({results:null,apiResponses:[liveResponse('2026-11-18',[{combination:'1-2-3',amount:2500}])]});
 assert.match(wrongDate.ids.morningVenues.children[0].children[1].textContent,/結果未判定/);
 const staleFallback=await runCase({results:{winningCombinations:[{combination:'1-2-3',amount:2500}]},apiResponses:[liveResponse('2026-11-18',[{combination:'1-3-2',amount:9000}])]});
 assert.match(staleFallback.ids.morningVenues.children[0].children[1].textContent,/🎯 1-2-3/);
 assert.doesNotMatch(staleFallback.ids.morningVenues.children[0].children[1].textContent,/1-3-2（/);
 const partial=await runCase({results:{winningCombinations:[{combination:'1-2-3',amount:2500}]},apiResponses:[{ok:true,json:async()=>({programs:{stadiums:{'2':{races:{}}}}})}]});
 assert.match(partial.ids.morningVenues.children[0].children[1].textContent,/🎯 1-2-3/);
 const malformed=await runCase({results:{winningCombinations:[{combination:'1-2-3',amount:2500}]},apiResponses:[liveResponse('2026-11-19',[{combination:'1-2-3',amount:0}])]});
 assert.match(malformed.ids.morningVenues.children[0].children[1].textContent,/🎯 1-2-3/);
 const emptyPayout=await runCase({results:null,apiResponses:[liveResponse('2026-11-19',[])]});
 assert.match(emptyPayout.ids.morningVenues.children[0].children[1].textContent,/結果未判定/);
 assert.doesNotMatch(emptyPayout.ids.morningVenues.children[0].children[1].textContent,/中止確定/);
 const c=await runCase({missing:true});
 assert.match(c.ids.morningStatus.textContent,/未生成/);
 const d=await runCase({savedDate:'2026-11-18'});
 assert.match(d.ids.morningStatus.textContent,/指定日の朝の予想データがありません/);
 const e=await runCase({results:{winningCombinations:[{combination:'3-4-2',amount:3500}]}});
 assert.match(e.ids.morningVenues.children[0].children[1].textContent,/不的中/);
 assert.match(e.ids.morningVenues.children[0].children[1].textContent,/朝の買い目 1-2-3、1-3-2/);
 assert.equal(e.ids.morningTotals.children[0].children.length,7);
 console.log('PASS: syntax, retry after 503, network rejection and invalid schema, saved fallback after 3 failures, stale live date, partial live venue, pending picks, settled hits, misses, totals, missing file, wrong date');
})().catch(e=>{console.error(e);process.exitCode=1});
