/* GitHub morning predictions: separate read-only RECORD tracker. No bn_records writes. */
(()=> {
 const $=id=>document.getElementById(id), host=$('morningTracker');
 if(!host)return;
 const date=$('morningDate'), refresh=$('morningRefresh'), status=$('morningStatus'), totals=$('morningTotals'), venues=$('morningVenues');
 const jst=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const field=t=>parts.find(p=>p.type===t)?.value;return [field('year'),field('month'),field('day')].join('-');};
 date.value=jst();
 const money=n=>Number(n||0).toLocaleString('ja-JP')+'円';
 const valid=p=>Array.isArray(p)&&p.length&&p.every(x=>/^[1-6]-[1-6]-[1-6]$/.test(String(x.combination||''))&&Number.isInteger(Number(x.amount))&&Number(x.amount)>0);
 const resultsUrl=d=>'https://boatraceopenapi.github.io/api/v1/'+d.slice(0,4)+'/'+d.replace(/-/g,'')+'.json';
 let loading=false;
 async function update(){
  if(loading)return;
  const d=date.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){status.textContent='開催日を選択してください。';return;}
  loading=true;refresh.disabled=true;status.textContent='朝の予想と最新結果を照合中…';
  try{
   const pred=await fetch('./data/auto/'+d+'.json?t='+Date.now(),{cache:'no-store'});
   if(!pred.ok)throw Error(pred.status===404?'この日の朝の予想は未保存です':'予想取得 HTTP '+pred.status);
   const doc=await pred.json();if(doc.date!==d||!Array.isArray(doc.races)||!doc.races.length)throw Error('指定日の朝の予想データがありません（ファイル日付または形式を確認してください）');
   if(date.value!==d)return; // Ignore a stale response after date selection changes.
   let live=null,liveError='';
   try{const res=await fetch(resultsUrl(d)+'?t='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);live=await res.json();if(!live?.programs?.stadiums)throw Error('結果形式が不正です');}
   catch(e){liveError=e.message;}
   const rows=doc.races.map(r=>{
    const race=live?.programs?.stadiums?.[String(r.venue)]?.races?.[String(r.race)];
    const p=race?.date===d?race?.result?.payouts?.trifecta:null;
    const payoutList=valid(p)?p:(Array.isArray(r.result?.winningCombinations)&&valid(r.result.winningCombinations)?r.result.winningCombinations:null);
    const picks=Array.isArray(r.picks)?r.picks:[];
    if(!payoutList)return {r,done:false,hits:[],stake:0,returned:0};
    const paid=new Map(payoutList.map(x=>[x.combination,Number(x.amount)]));
    const hits=picks.filter(x=>paid.has(x.pick)).map(x=>({pick:x.pick,stake:Number(x.stake)||0,odds:paid.get(x.pick),returned:Math.round(paid.get(x.pick)*(Number(x.stake)||0)/100)}));
    return {r,done:true,hits,stake:picks.reduce((a,x)=>a+(Number(x.stake)||0),0),returned:hits.reduce((a,x)=>a+x.returned,0)};
   });
   const done=rows.filter(x=>x.done),stake=done.reduce((a,x)=>a+x.stake,0),returned=done.reduce((a,x)=>a+x.returned,0),hits=done.reduce((a,x)=>a+x.hits.length,0);
   if(date.value!==d)return;
   totals.replaceChildren();
   const summary=document.createElement('div');summary.className='grid2';
   [['朝の予想',rows.length+'レース'],['結果確定',done.length+' / '+rows.length],['的中数',hits+'点'],['回収率',stake?(returned/stake*100).toFixed(1)+'%':'—'],['仮想購入額（確定分）',money(stake)],['仮想払戻',money(returned)]].forEach(([k,v])=>{const el=document.createElement('div');el.className='card';const small=document.createElement('div');small.className='tiny muted';small.textContent=k;const strong=document.createElement('b');strong.style.fontSize='22px';strong.textContent=v;el.append(small,strong);summary.append(el);});
   totals.append(summary);venues.replaceChildren();
   const groups=new Map();rows.forEach(x=>{const k=Number(x.r.venue);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x);});
   [...groups].sort((a,b)=>a[0]-b[0]).forEach(([v,items])=>{
    const group=document.createElement('details');group.className='card';group.style.marginTop='10px';
    const title=document.createElement('summary');title.style.cursor='pointer';
    title.textContent=(typeof STADIUMS!=='undefined'?STADIUMS[v]:null||'場'+v)+'　'+items.filter(x=>x.done).length+'/'+items.length+'R確定　的中'+items.reduce((a,x)=>a+x.hits.length,0)+'点';
    group.append(title);
    items.sort((a,b)=>Number(a.r.race)-Number(b.r.race)).forEach(x=>{
     const line=document.createElement('div');line.className='status';line.style.cssText='padding:8px 0;border-bottom:1px solid var(--line)';
     const h=x.hits.map(p=>p.pick+'（'+money(p.returned)+'）').join('、');
     line.textContent=x.r.race+'R：'+(x.done?(h?'🎯 '+h:'不的中'):'未確定')+(x.done?' ／ 払戻 '+money(x.returned):'');
     group.append(line);
    });venues.append(group);
   });
   status.textContent=d+' の朝の予想 '+rows.length+'Rを読み込み済み ／ 最終確認 '+new Date().toLocaleTimeString('ja-JP')+' ／ '+(liveError?'公開結果の取得不可（GitHub保存済み結果のみ反映）：'+liveError:'最新の公開結果を確認')+' ／ 予想は読み取り専用・購入額は仮想';
  }catch(e){if(date.value===d){status.textContent='朝の自動予想を表示できません（'+d+'）：'+e.message+'。再読み込み後も続く場合は、このエラーを確認してください。';totals.replaceChildren();venues.replaceChildren();}}
  finally{loading=false;refresh.disabled=false;if(date.value!==d)update();}
 }
 refresh.addEventListener('click',update);date.addEventListener('change',()=>{if(!loading)update();else status.textContent='日付を変更しました。現在の取得が終わり次第、自動的に再取得します。';});
 let last='';setInterval(()=>{if(document.visibilityState==='visible'&&host.closest('.page')?.classList.contains('active')&&date.value===jst()){const slot=Math.floor(Date.now()/300000);if(last!==String(slot)){last=String(slot);update();}}},30000);
 document.querySelectorAll('[data-page="records"]').forEach(b=>b.addEventListener('click',()=>{if(!totals.childElementCount)update();}));
 update();
})();