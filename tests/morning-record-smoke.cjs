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
async function runCase({date='2026-11-19', savedDate=date, results=null, missing=false}) {
 const ids=Object.fromEntries(['morningTracker','morningDate','morningRefresh','morningStatus','morningTotals','morningVenues'].map(x=>[x,node()]));
 const document={getElementById:id=>ids[id],createElement:node,querySelectorAll:()=>[],visibilityState:'visible'};
 const daily={date:savedDate,races:[{venue:1,race:1,picks:[{pick:'1-2-3',stake:100},{pick:'1-3-2',stake:100}],result:results}]};
 const calls=[];
 const fetch=async url=>{calls.push(url);if(url.startsWith('./data/auto/'))return {ok:!missing,status:missing?404:200,json:async()=>daily};return {ok:false,status:503}};
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
 const c=await runCase({missing:true});
 assert.match(c.ids.morningStatus.textContent,/未生成/);
 const d=await runCase({savedDate:'2026-11-18'});
 assert.match(d.ids.morningStatus.textContent,/指定日の朝の予想データがありません/);
 const e=await runCase({results:{winningCombinations:[{combination:'3-4-2',amount:3500}]}});
 assert.match(e.ids.morningVenues.children[0].children[1].textContent,/不的中/);
 assert.match(e.ids.morningVenues.children[0].children[1].textContent,/朝の買い目 1-2-3、1-3-2/);
 assert.equal(e.ids.morningTotals.children[0].children.length,7);
 console.log('PASS: syntax, pending picks, settled hits, misses, totals, missing file, wrong date');
})().catch(e=>{console.error(e);process.exitCode=1});
