const API_TODAY="https://boatraceopenapi.github.io/api/v1/today.json";
const STADIUMS={1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"};
const COLORS=["#f3f3f3","#252525","#e34c4c","#3979d0","#eac84b","#45a66c"];
let data=null, selected=[], records=JSON.parse(localStorage.getItem("bn_records")||"[]"), currentVenue=null;
const $=id=>document.getElementById(id);
function page(name){document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===name));document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===name));window.scrollTo({top:0,behavior:"smooth"});}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>page(b.dataset.page)));
function yen(n){return Number(n||0).toLocaleString("ja-JP")+"円";}
function getStadiums(){return data?.programs?.stadiums||{};}
function getRaces(stadium){return stadium?.races||{};}
function stadiumEntries(){return Object.entries(getStadiums()).filter(([k,v])=>Object.keys(getRaces(v)).length);}
function setStatus(ok,msg){$("apiBadge").textContent=ok?"CONNECTED":"OFFLINE";$("apiBadge").style.color=ok?"#7ac7a0":"#e58c8c";$("apiMessage").textContent=msg;}
async function loadData(){
 $("apiMessage").textContent="公開データを取得しています…";$("apiBadge").textContent="LOADING";
 try{
  const res=await fetch(API_TODAY,{cache:"no-store"});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const json=await res.json();
  if(!json?.programs?.stadiums)throw new Error("データ形式を確認できません");
  data=json;autoLoadOdds();sessionStorage.setItem("bn_today",JSON.stringify({at:Date.now(),data}));
  setStatus(true,"本日の公開JSONを取得しました。データは約10分間隔で更新されますが、実際の反映には遅れが生じる場合があります。");
  $("dataUpdated").textContent="取得 "+new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});
  renderVenues();populateSelectors();renderStats();
 }catch(err){
  const cached=sessionStorage.getItem("bn_today");
  if(cached){try{data=JSON.parse(cached).data;setStatus(false,"最新データを取得できません。直近のセッション内キャッシュを表示しています。");renderVenues();populateSelectors();}catch{}}
  else setStatus(false,"データ取得に失敗しました。通信環境を確認して再取得してください。詳細: "+err.message);
 }
}
function renderVenues(){
 const entries=stadiumEntries();$("venueCount").textContent=entries.length;$("raceCount").textContent=entries.reduce((n,[,s])=>n+Object.keys(getRaces(s)).length,0);
 const host=$("venueList");host.innerHTML="";
 if(!entries.length){host.innerHTML='<div class="card status">本日の開催データはありません。</div>';return;}
 entries.forEach(([id,s])=>{
  const name=STADIUMS[Number(id)]||("競艇場 "+id),races=Object.entries(getRaces(s));
  const div=document.createElement("div");div.className="card";
  const head=document.createElement("div");head.className="row";head.innerHTML=`<div><div class="eyebrow">STADIUM ${String(id).padStart(2,"0")}</div><h3 style="margin:5px 0 0">${name}</h3></div><span class="badge">${races.length} RACES</span>`;div.append(head);
  const grid=document.createElement("div");grid.className="grid2";
  races.forEach(([rn,r])=>{const b=document.createElement("button");b.className="race-card";b.style.textAlign="left";b.innerHTML=`<div class="row"><b>${rn}R</b><span class="tiny muted">${r.closed_at?String(r.closed_at).slice(11,16):"締切時刻未取得"}</span></div><div class="tiny muted" style="margin-top:5px">${r.title||"レース情報"}</div>`;b.addEventListener("click",()=>{setSelectors(id,rn);page("races");renderRace();});grid.append(b);});div.append(grid);host.append(div);
 });
}
function fillSelect(el,items,selected){el.innerHTML="";items.forEach(([v,label])=>{const o=document.createElement("option");o.value=v;o.textContent=label;el.append(o)});if(selected!==undefined)el.value=String(selected);}
function populateSelectors(){
 const entries=stadiumEntries().map(([id])=>[id,STADIUMS[Number(id)]||("競艇場 "+id)]);
 ["venueSelect","aiVenue","manualVenue"].forEach(id=>fillSelect($(id),entries));
 updateRaceOptions("venueSelect","raceSelect");updateRaceOptions("aiVenue","aiRace");updateRaceOptions("manualVenue","manualRace");
 ["venueSelect","aiVenue","manualVenue"].forEach(id=>$(id).addEventListener("change",()=>updateRaceOptions(id,id==="venueSelect"?"raceSelect":id==="aiVenue"?"aiRace":"manualRace")));
}
function updateRaceOptions(venueId,raceId){const s=getStadiums()[$(venueId).value];fillSelect($(raceId),Object.keys(getRaces(s)).map(x=>[x,x+"R"]));if(venueId==="venueSelect")renderRace();if(venueId==="aiVenue")oddsHeader("ai");}
function setSelectors(venue,race){$("venueSelect").value=venue;updateRaceOptions("venueSelect","raceSelect");$("raceSelect").value=race;}
function selectedRace(venueId,raceId){return getRaces(getStadiums()[$(venueId).value])?.[$(raceId).value];}
function lane(n){return `<span class="lane" style="background:${COLORS[Number(n)-1]||"#ddd"}">${n}</span>`;}

/* v12: 公開データに含まれる3連単オッズ。未取得時は数字を表示しない。 */
function trifectaRows(){const p=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)if(a!==b&&a!==c&&b!==c)p.push(a+'-'+b+'-'+c);return p;}
const ODDS_ENDPOINT='https://lamrongol.github.io/BoatraceOdds/v3/';
let separateOdds=null,separateOddsDate='',separateOddsFetchedAt=null,oddsLoading=null,oddsError='';
function jstOddsDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function trifectaOdds(venue,race){
 if(separateOddsDate!==jstOddsDate()||!Array.isArray(separateOdds?.odds))return null;
 const found=separateOdds.odds.find(x=>Number(x.stadium_number)===Number(venue)&&Number(x.number)===Number(race)&&x.date===separateOddsDate);
 return found?.trifecta_odds||null;
}
async function loadSeparateOdds(force=false){
 const date=jstOddsDate();
 if(!force&&separateOdds&&separateOddsDate===date)return;
 if(oddsLoading)return oddsLoading;
 oddsLoading=(async()=>{
  const d=date.replaceAll('-',''),url=ODDS_ENDPOINT+d.slice(0,4)+'/'+d+'.json';
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const result=await response.json();
  if(!Array.isArray(result?.odds))throw new Error('データ形式が違います');
  separateOdds=result;separateOddsDate=date;separateOddsFetchedAt=new Date();oddsError='';
 })();
 try{await oddsLoading;}catch(e){oddsError=e.message;throw e;}finally{oddsLoading=null;}
}
function refreshOddsViews(){if($('raceOddsPanel'))oddsHeader('race');if($('aiOddsPanel'))oddsHeader('ai');renderTicketOdds();}
function autoLoadOdds(){loadSeparateOdds().then(refreshOddsViews).catch(refreshOddsViews);}

function oddsValue(table,pick){const [a,b,c]=pick.split('-');const v=table?.[a]?.[b]?.[c];const n=Number(v);return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)&&n>0?n:null;}
function oddsHeader(kind){
 const ai=kind==='ai',el=$(ai?'aiOddsPanel':'raceOddsPanel');if(!el)return;
 const v=$(ai?'aiVenue':'venueSelect').value,r=$(ai?'aiRace':'raceSelect').value,t=trifectaOdds(v,r);
 const count=t?trifectaRows().filter(p=>oddsValue(t,p)!==null).length:0;
 el.innerHTML='<div class="notice"><div class="row"><b>3連単オッズ '+(ai?'｜AI LAB':'｜全120通り')+'</b><button class="ghost" style="padding:8px;font-size:12px">↻ オッズ更新</button></div><div class="tiny muted" style="margin-top:7px">'+(count?count+'/120通り取得'+(separateOddsFetchedAt?' · 取得 '+separateOddsFetchedAt.toLocaleTimeString('ja-JP'):''):(oddsError?'取得できません：'+oddsError:'オッズ未取得'))+' · 非公式データ（約30分間隔・遅延あり）</div></div>';
 el.querySelector('button').addEventListener('click',async()=>{const btn=el.querySelector('button');btn.disabled=true;btn.textContent='取得中…';try{await loadSeparateOdds(true);}catch(e){}refreshOddsViews();});
 if(!ai)renderAllOdds();
}
function renderAllOdds(){
 const host=$('raceOddsPanel');if(!host)return;
 const t=trifectaOdds($('venueSelect').value,$('raceSelect').value);if(!t)return;
 const wrap=document.createElement('div');wrap.style.marginTop='10px';
 const sel=document.createElement('select');sel.className='field';[['popular','人気順'],['high','高オッズ順'],['boat','艇番順']].forEach(([v,label])=>{let o=document.createElement('option');o.value=v;o.textContent=label;sel.append(o)});
 const list=document.createElement('div');list.style.cssText='max-height:420px;overflow:auto;margin-top:8px';
 const draw=()=>{const rows=trifectaRows().map(p=>({p,o:oddsValue(t,p)}));if(sel.value==='popular')rows.sort((a,b)=>(a.o??Infinity)-(b.o??Infinity));if(sel.value==='high')rows.sort((a,b)=>(b.o??-1)-(a.o??-1));list.innerHTML=rows.map(x=>'<div class="ticket"><b>'+x.p+'</b><div style="text-align:right"><b>'+(x.o===null?'—':x.o.toFixed(1)+'倍')+'</b><div class="tiny muted">100円 → '+(x.o===null?'—':yen(Math.round(x.o*100)))+'</div></div></div>').join('');};
 sel.addEventListener('change',draw);wrap.append(sel,list);host.append(wrap);draw();
}
function renderTicketOdds(){
 const host=$('ticketResult');if(!host)return;
 const t=trifectaOdds($('aiVenue').value,$('aiRace').value);
 host.querySelectorAll('[data-ticket-odds]').forEach(el=>{const o=oddsValue(t,el.dataset.ticketOdds);el.textContent=o===null?'オッズ未取得':o.toFixed(1)+'倍 · 100円→'+yen(Math.round(o*100));});
}

function renderRace(){
 const r=selectedRace("venueSelect","raceSelect");if(!r){$("raceDetail").textContent="レースデータがありません。";return;}
 const racers=r.racers||{},preview=r.preview||{},pr=preview.racers||{};
 let html=`<div class="eyebrow">${STADIUMS[Number(r.stadium_number)]||"BOAT RACE"} / ${r.race_number}R</div><h3 style="margin:6px 0">${r.title||"出走表"}</h3><div class="tiny muted">締切 ${r.closed_at||"未取得"} · ${r.distance||1800}m</div>`;
 for(let n=1;n<=6;n++){const x=racers[n]||{},p=pr[n]||{};html+=`<div class="boatrow"><div>${lane(n)}<b>${x.name||"選手情報なし"}</b><div class="tiny muted" style="margin:4px 0 0 37px">${x.number||""} · ${x.rank_number_source||""}</div></div><div style="text-align:right"><b>${x.national_win_rate??"-"}</b><div class="tiny muted">全国勝率</div></div></div><div class="tiny muted" style="padding:4px 0 7px 37px">当地 ${x.local_win_rate??"-"} · M2連率 ${x.motor_top_2_percent??"-"}% · 平均ST ${x.average_start_timing??"-"} · 展示 ${p.exhibition_time??"-"}</div>`;}
 const w=preview.wind_speed,wh=preview.wave_height;html+=`<div class="notice">直前情報：風速 ${w??"-"}m · 波高 ${wh??"-"}cm · 展示タイム・進入は取得できた項目のみ表示します。</div>`;
 $("raceDetail").innerHTML=html;oddsHeader("race");
}
function metric(x,key){const v=x?.[key];if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function scoreRace(r){
 const racers=r?.racers||{},preview=r?.preview||{},pr=preview.racers||{};
 const weights={national_win_rate:.24,local_win_rate:.18,motor_top_2_percent:.20,average_start_timing:.14,exhibition_time:.14,local_top_3_percent:.10};
 const laneBase=[.17,.09,.04,0,-.04,-.08];
 const rows=[];
 for(let n=1;n<=6;n++){
  const x=racers[n]||{},p=pr[n]||{};
  const fields=[
   [metric(x,'national_win_rate'),.24,v=>Math.max(0,Math.min(1,v/9))],
   [metric(x,'local_win_rate'),.18,v=>Math.max(0,Math.min(1,v/9))],
   [metric(x,'motor_top_2_percent'),.20,v=>Math.max(0,Math.min(1,v/70))],
   [metric(x,'average_start_timing'),.14,v=>Math.max(0,Math.min(1,(.30-v)/.25))],
   [metric(p,'exhibition_time'),.14,v=>Math.max(0,Math.min(1,(7.4-v)/1.0))],
   [metric(x,'local_top_3_percent'),.10,v=>Math.max(0,Math.min(1,v/85))]
  ];
  const valid=fields.filter(([v])=>v!==null&&v>0);
  const total=valid.reduce((sum,[,w])=>sum+w,0);
  const base=total?valid.reduce((sum,[v,w,f])=>sum+w*f(v),0)/total:.5;
  const score=base+laneBase[n-1];
  rows.push({n,name:x.name||'選手情報なし',score,parts:valid.length,coverage:Math.round(total*100),stats:x});
 }
 return rows.sort((a,b)=>b.score-a.score);
}
function v13Combinations(r,venue,race){
 const ranked=scoreRace(r),t=trifectaOdds(venue,race);
 const entries=permutations3(ranked).map(([a,b,c])=>{
  const raw=Math.exp(3.5*(a.score*.53+b.score*.30+c.score*.17)+(.16*(a.n===1)));
  return {pick:a.n+'-'+b.n+'-'+c.n,raw,boats:[a.n,b.n,c.n]};
 });
 const sum=entries.reduce((n,x)=>n+x.raw,0);
 return entries.map(x=>{
  const probability=x.raw/sum,odds=oddsValue(t,x.pick);
  return {...x,probability,odds,ev:odds?probability*odds:null};
 });
}
function renderAnalysis(){oddsHeader("ai");
 const r=selectedRace("aiVenue","aiRace");if(!r){$("analysisResult").textContent="対象レースがありません。";return;}
 const scores=scoreRace(r),max=scores[0]?.score||1;
 $("analysisResult").innerHTML=`<div class="eyebrow">V13 REFERENCE SCORE · NOT WIN PROBABILITY</div>`+scores.map((x,i)=>`<div class="boatrow"><div>${lane(x.n)}<b>${x.name}</b><div class="tiny muted">${x.parts}項目で評価</div></div><div style="width:43%;text-align:right"><b class="gold">${x.score.toFixed(2)}</b><div style="height:5px;background:#283547;border-radius:8px;margin-top:5px"><div style="height:5px;width:${Math.max(2,x.score/max*100)}%;background:linear-gradient(90deg,#a98548,#e2c88f);border-radius:8px"></div></div></div></div>`).join("")+`<div class="notice">スコアは出走表・取得できた直前情報を単純加重した参考値です。オッズ、展開、気象の変化、欠損値を十分に補正していません。的中確率や利益を保証するものではありません。</div>`;
}
let generatedTickets=[];
function permutations3(items){const out=[];for(const a of items)for(const b of items)if(b.n!==a.n)for(const c of items)if(c.n!==a.n&&c.n!==b.n)out.push([a,b,c]);return out;}
function generateTickets(){
 const r=selectedRace('aiVenue','aiRace');
 if(!r){$('ticketResult').innerHTML='<div class="notice">対象レースのデータがありません。</div>';return;}
 const ranked=scoreRace(r);
 if(ranked.length!==6||ranked.every(x=>x.parts===0)){$('ticketResult').innerHTML='<div class="notice">選手データが不足しているため、買い目を作成できません。</div>';return;}
 const venueId=$('aiVenue').value,raceId=$('aiRace').value;
 const combos=v13Combinations(r,venueId,raceId),hasOdds=combos.some(x=>x.odds!==null);
 // 期待値を過信しないよう、確率順位を主体にしてオッズ情報は控えめに反映。
 const rankedCombos=combos.map(x=>{
  const appeal=hasOdds&&x.ev!==null?Math.max(-1,Math.min(1,Math.log(Math.max(.01,x.ev)))):0;
  return {...x,priority:Math.log(x.probability)+.4*appeal};
 }).sort((a,b)=>b.priority-a.priority);
 const count=Math.max(1,Math.min(120,Number($('ticketCount').value)||10)),unit=Number($('ticketUnit').value);
 generatedTickets=rankedCombos.slice(0,count).map((x,i)=>({...x,rank:i+1,category:i===0?'本命':i<4?'対抗':'押さえ・穴',stake:unit}));
 const total=unit*generatedTickets.length,venueName=STADIUMS[Number(venueId)]||'競艇場';
 $('ticketResult').innerHTML='<div class="row" style="margin:12px 0"><b>'+venueName+' '+raceId+'R · v13参考予想</b><span class="badge">'+count+'点 / '+yen(total)+'</span></div>'+
 generatedTickets.map(x=>'<div class="ticket"><div><span class="ticket-rank">'+x.category+' · '+x.rank+'番目</span><b>'+x.pick+'</b><div class="tiny muted">モデル内の相対比率 '+(x.probability*100).toFixed(2)+'%（未検証）</div><div class="tiny muted" data-ticket-odds="'+x.pick+'">オッズ未取得</div>'+(x.ev!==null?'<div class="tiny muted">参考期待倍率 '+x.ev.toFixed(2)+'（未検証）</div>':'')+'</div><span class="muted">'+yen(x.stake)+'</span></div>').join('')+
 '<div class="notice">v13試験版：能力・当地・モーター・ST・展示・枠を組み合わせています。相対比率は過去データで校正した的中確率ではありません。'+(hasOdds?'取得できた非公式オッズを控えめに反映しています。':'オッズ未取得のため配当妙味は評価していません。')+' 利益や的中は保証しません。</div><button id="saveAutoTickets" class="btn" style="margin-top:12px">この'+count+'点を予想記録に保存</button><div id="autoSaveMessage" class="status"></div>';
 renderTicketOdds();
 $('saveAutoTickets').addEventListener('click',()=>{
  const stamp=new Date().toISOString();
  generatedTickets.forEach(x=>records.push({type:'auto',venue:venueId,venueName,race:raceId,kind:'3連単・v13参考案',pick:x.pick,stake:x.stake,createdAt:stamp,hit:false,payout:0}));
  localStorage.setItem('bn_records',JSON.stringify(records));renderStats();$('autoSaveMessage').textContent=generatedTickets.length+'点を記録に保存しました。';
 });
}
function buildBoatChoices(){for(let n=1;n<=6;n++){const b=document.createElement("button");b.className="pick";b.dataset.boat=n;b.innerHTML=lane(n);b.addEventListener("click",()=>{if(selected.includes(n))selected=selected.filter(x=>x!==n);else if(selected.length<3)selected.push(n);else selected=[n];paintChoices();});$("boatChoices").append(b);}}
function paintChoices(){document.querySelectorAll("[data-boat]").forEach(b=>b.classList.toggle("selected",selected.includes(Number(b.dataset.boat))));$("selectedText").textContent=selected.length?selected.join(" → ")+" ("+selected.length+"/3)":"1着・2着・3着の順に3艇選択してください。";}
function saveRecord(record){records.push({...record,createdAt:new Date().toISOString(),hit:false,payout:0});localStorage.setItem("bn_records",JSON.stringify(records));renderStats();page("records");}
// v11: 日付をJSTで固定し、別日の同一場・同一Rを混同しない。
function recordJstDate(x){
 if(x.raceDate&&/^\d{4}-\d{2}-\d{2}$/.test(x.raceDate))return x.raceDate;
 if(!x.createdAt)return null;
 const d=new Date(x.createdAt);
 return Number.isNaN(d.getTime())?null:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
async function getOfficialLikeResult(date,venue,race){
 const compact=date.replace(/-/g,'');
 const url=`https://boatraceopenapi.github.io/api/v1/${compact.slice(0,4)}/${compact}.json`;
 const res=await fetch(url,{cache:'no-store'});
 if(!res.ok)throw new Error('公開データ HTTP '+res.status);
 const json=await res.json();
 const r=json?.programs?.stadiums?.[String(venue)]?.races?.[String(race)];
 if(!r||r.date!==date)return null;
 const payouts=r.result?.payouts?.trifecta;
 if(!Array.isArray(payouts)||!payouts.length)return null;
 const valid=payouts.map(p=>({combination:String(p.combination||''),amount:Number(p.amount)}))
  .filter(p=>/^[1-6]-[1-6]-[1-6]$/.test(p.combination)&&new Set(p.combination.split('-')).size===3&&Number.isInteger(p.amount)&&p.amount>0);
 if(valid.length!==payouts.length)return null;
 return valid;
}
async function autoSettleRace(items,venue,race,name){
 const dates=[...new Set(items.map(o=>recordJstDate(o.record)))];
 if(dates.length!==1||!dates[0]){alert('開催日を特定できません。手動で一括入力してください。');return;}
 const date=dates[0];
 try{
  const payouts=await getOfficialLikeResult(date,venue,race);
  if(!payouts){alert(`${name} ${race}R（${date}）の確定払戻が未公開、または取得できません。手動入力を使ってください。`);return;}
  const detail=payouts.map(p=>`${p.combination}：${yen(p.amount)}`).join(' / ');
  if(!confirm(`${name} ${race}R（${date}）\n公開データの3連単：${detail}\n\n${items.length}件の予想に結果を反映しますか？\n※非公式データです。公式結果も確認してください。`))return;
  items.forEach(({record:x})=>{
   const hit=payouts.find(p=>p.combination===x.pick);
   x.actualResult=payouts.map(p=>p.combination).join(' / ');
   x.hit=!!hit;x.payout=hit?Math.round(hit.amount*Number(x.stake||0)/100):0;
   x.resultEntered=true;x.resultSource='unofficial-api';
  });
  localStorage.setItem('bn_records',JSON.stringify(records));renderStats();
  alert(`${name} ${race}R の${items.length}件を反映しました。`);
 }catch(e){alert('自動取得に失敗しました。通信を確認するか手動入力してください。 '+e.message);}
}
async function settleAllPending(){
 const button=$('settleAllPending'),status=$('settleAllStatus');
 const pending=records.filter(x=>x.resultEntered!==true);
 if(!pending.length){status.textContent='未入力の予想はありません。';return;}
 const groups=new Map();
 for(const x of pending){
  const date=recordJstDate(x),venue=String(x.venue??''),race=String(x.race??'');
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!venue||!race)continue;
  const key=date+'|'+venue+'|'+race;
  if(!groups.has(key))groups.set(key,{date,venue,race,items:[]});
  groups.get(key).items.push(x);
 }
 if(!groups.size){status.textContent='日付・場・レース番号が確認できる未入力データがありません。';return;}
 if(!confirm(groups.size+'レース（'+pending.length+'件の未入力予想）を照合します。確定結果が取得できた分だけ反映しますか？'))return;
 button.disabled=true;
 const dateCache=new Map();let done=0,hit=0,failed=0,unavailable=0;
 try{
  for(const group of groups.values()){
   status.textContent='照合中 '+(done+failed+unavailable+1)+' / '+groups.size+'レース…';
   try{
    let daily=dateCache.get(group.date);
    if(!daily){
     const compact=group.date.replace(/-/g,''),url='https://boatraceopenapi.github.io/api/v1/'+compact.slice(0,4)+'/'+compact+'.json';
     const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);
     daily=await res.json();dateCache.set(group.date,daily);
    }
    const rr=daily?.programs?.stadiums?.[group.venue]?.races?.[group.race];
    const payouts=rr?.date===group.date?rr?.result?.payouts?.trifecta:null;
    if(!Array.isArray(payouts)||!payouts.length){unavailable++;continue;}
    const valid=payouts.map(p=>({combination:String(p.combination||''),amount:Number(p.amount)})).filter(p=>/^[1-6]-[1-6]-[1-6]$/.test(p.combination)&&new Set(p.combination.split('-')).size===3&&Number.isInteger(p.amount)&&p.amount>0);
    if(valid.length!==payouts.length){unavailable++;continue;}
    for(const x of group.items){
     const match=valid.find(p=>p.combination===x.pick);
     x.actualResult=valid.map(p=>p.combination).join(' / ');
     x.hit=!!match;x.payout=match?Math.round(match.amount*Number(x.stake||0)/100):0;
     x.resultEntered=true;x.resultSource='unofficial-api';
     hit+=Number(!!match);
    }
    done++;
    localStorage.setItem('bn_records',JSON.stringify(records));
   }catch(e){failed++;}
  }
  renderStats();
  $('settleAllStatus').textContent='照合完了：'+done+'レース反映・'+hit+'点的中 / 結果未公開 '+unavailable+'レース / 通信エラー '+failed+'レース。既存の結果は変更していません。';
 }finally{button.disabled=false;}
}
function renderStats(){
 const total=records.reduce((a,x)=>a+Number(x.stake||0),0);
 const settled=records.filter(x=>x.resultEntered===true);
 const hits=settled.filter(x=>x.hit===true).length;
 const returned=settled.reduce((a,x)=>a+Number(x.payout||0),0);
 const settledStake=settled.reduce((a,x)=>a+Number(x.stake||0),0);
 const recovery=settledStake?returned/settledStake*100:0;
 $("savedCount").textContent=records.length;$("recordCount").textContent=records.length;$("recordStake").textContent=yen(total);
 $("hitCount").textContent=settled.length?`${hits} / ${settled.length}（${(hits/settled.length*100).toFixed(1)}%）`:"未入力";
 $("recovery").textContent=settled.length?`${recovery.toFixed(1)}%`:"未入力";
 $("recordPayout").textContent=yen(returned);
 const host=$("history");host.innerHTML="";
 if(!records.length){host.textContent="まだ記録がありません。";return;}
 // 買い目を選択してまとめて削除（チェック式）
 const selectedForDelete=new Set();
 const toolbar=document.createElement("div");
 toolbar.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 12px";
 const selectionCount=document.createElement("span");
 selectionCount.className="tiny muted";
 selectionCount.textContent="削除する買い目を選択してください";
 const selectAll=document.createElement("button");
 selectAll.className="ghost";
 selectAll.style.cssText="padding:8px 10px;font-size:12px";
 selectAll.textContent="表示中をすべて選択";
 const clearSelection=document.createElement("button");
 clearSelection.className="ghost";
 clearSelection.style.cssText="padding:8px 10px;font-size:12px";
 clearSelection.textContent="選択解除";
 const deleteSelected=document.createElement("button");
 deleteSelected.className="ghost";
 deleteSelected.style.cssText="border-color:#8d4b59;color:#e59aa5;padding:8px 10px;font-size:12px";
 deleteSelected.textContent="選択した予想を削除";
 deleteSelected.disabled=true;
 const updateSelectionUI=()=>{
  selectionCount.textContent=`選択中：${selectedForDelete.size}件`;
  deleteSelected.disabled=selectedForDelete.size===0;
  deleteSelected.style.opacity=deleteSelected.disabled?".45":"1";
 };
 selectAll.addEventListener("click",()=>{
  records.forEach(x=>selectedForDelete.add(x));
  host.querySelectorAll('input[data-delete-pick="1"]').forEach(c=>c.checked=true);
  updateSelectionUI();
 });
 clearSelection.addEventListener("click",()=>{
  selectedForDelete.clear();
  host.querySelectorAll('input[data-delete-pick="1"]').forEach(c=>c.checked=false);
  updateSelectionUI();
 });
 deleteSelected.addEventListener("click",()=>{
  if(!selectedForDelete.size)return;
  if(!confirm(`選択した ${selectedForDelete.size}件の予想を削除します。よろしいですか？`))return;
  records=records.filter(x=>!selectedForDelete.has(x));
  localStorage.setItem("bn_records",JSON.stringify(records));renderStats();
 });
 toolbar.append(selectionCount,selectAll,clearSelection,deleteSelected);host.append(toolbar);updateSelectionUI();
 // 競艇場 → レース → 買い目。競艇場・レースごとに折りたたみ可能
 const venues=new Map();
 records.forEach((x,index)=>{
  const venueKey=String(x.venue??x.venueName??"unknown");
  if(!venues.has(venueKey))venues.set(venueKey,{id:Number(x.venue)||999,name:x.venueName||"競艇場",races:new Map()});
  const v=venues.get(venueKey),raceKey=String(x.race||"-");
  if(!v.races.has(raceKey))v.races.set(raceKey,[]);
  v.races.get(raceKey).push({record:x,index});
 });
 [...venues.values()].sort((a,b)=>a.id-b.id).forEach(v=>{
  const venueBox=document.createElement("section");
  venueBox.className="card";venueBox.style.cssText="margin-top:14px;padding:0;overflow:hidden";
  const venueTop=document.createElement("div");
  venueTop.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px 0";
  const venueTitle=document.createElement("b");venueTitle.textContent=v.name;
  const venueDelete=document.createElement("button");venueDelete.className="ghost";
  venueDelete.style.cssText="border-color:#8d4b59;color:#e59aa5;padding:7px 9px;font-size:12px;min-height:32px;white-space:nowrap";
  venueDelete.textContent="場ごと削除";
  venueDelete.addEventListener("click",()=>{
   const groupItems=[...v.races.values()].flat();
   if(!confirm(`${v.name} の予想 ${groupItems.length}件をすべて削除しますか？`))return;
   const removeSet=new Set(groupItems.map(o=>o.record));
   records=records.filter(x=>!removeSet.has(x));
   localStorage.setItem("bn_records",JSON.stringify(records));renderStats();
  });
  venueTop.append(venueTitle,venueDelete);venueBox.append(venueTop);
  const venueDetails=document.createElement("details");
  venueDetails.open=false;
  const venueSummary=document.createElement("summary");
  venueSummary.style.cssText="display:flex;align-items:center;justify-content:flex-end;gap:10px;cursor:pointer;list-style:none;padding:8px 14px 14px;min-height:44px;font-weight:700";
  const raceTotal=[...v.races.values()].reduce((n,a)=>n+a.length,0);
  const venueBadge=document.createElement("span");venueBadge.className="badge";
  venueBadge.textContent=`${v.races.size}レース・${raceTotal}点　⌄`;
  venueSummary.append(venueBadge);venueDetails.append(venueSummary);
  const venueContent=document.createElement("div");venueContent.style.cssText="padding:0 12px 12px";
  [...v.races.entries()].sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([race,items])=>{
   const raceBox=document.createElement("div");
   raceBox.style.cssText="margin-top:10px;padding:0 10px;border:1px solid var(--line);border-radius:14px;background:rgba(7,13,23,.28);overflow:hidden";
   const raceDetails=document.createElement("details");raceDetails.open=false;
   const raceHead=document.createElement("summary");
   raceHead.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;list-style:none;padding:13px 2px;font-weight:700";
   const raceNumber=race.split('|')[0],raceDate=race.split('|')[1];
   const raceTitle=document.createElement("b");raceTitle.textContent=`${raceNumber}R (${raceDate})`;
   const raceTotal=items.reduce((n,o)=>n+Number(o.record.stake||0),0);
   const raceBadge=document.createElement("span");raceBadge.className="tiny muted";
   raceBadge.textContent=`${items.length}点・合計 ${yen(raceTotal)}　⌄`;
   raceHead.append(raceTitle,raceBadge);raceDetails.append(raceHead);
   const raceContent=document.createElement("div");
   items.forEach(({record:x,index},i)=>{
    const wrap=document.createElement("div");
    wrap.style.cssText=`display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:11px 0;${i<items.length-1?'border-bottom:1px solid var(--line)':''}`;
    const info=document.createElement("div");info.style.cssText="min-width:0;display:flex;flex-direction:column;gap:4px";
    const pickLine=document.createElement("div");pickLine.style.cssText="display:flex;align-items:center;gap:9px;flex-wrap:wrap";
    const pickCheck=document.createElement("input");
    pickCheck.type="checkbox";pickCheck.dataset.deletePick="1";
    pickCheck.checked=selectedForDelete.has(x);
    pickCheck.setAttribute("aria-label",`${v.name} ${raceNumber}R ${x.pick}を削除対象に選択`);
    pickCheck.style.cssText="width:19px;height:19px;accent-color:#c7a35d;flex:0 0 auto";
    pickCheck.addEventListener("change",()=>{
     if(pickCheck.checked)selectedForDelete.add(x);else selectedForDelete.delete(x);
     updateSelectionUI();
    });
    const pick=document.createElement("b");pick.style.cssText="font-size:16px;letter-spacing:.04em";pick.textContent=x.pick;
    const amount=document.createElement("span");amount.className="tiny muted";amount.textContent=yen(x.stake);
    pickLine.append(pickCheck,pick,amount);
    const status=document.createElement("div");status.className="tiny muted";
    status.textContent=x.resultEntered?`3連単・結果 ${x.actualResult}・${x.hit?"的中":"不的中"}・払戻 ${yen(x.payout)}`:`3連単・${x.kind||"予想"}・結果未入力`;
    info.append(pickLine,status);wrap.append(info);
    const actions=document.createElement("div");actions.style.cssText="display:flex;gap:5px;align-items:center;flex-shrink:0";
    const btn=document.createElement("button");btn.className="ghost";btn.style.cssText="white-space:nowrap;padding:7px 9px;font-size:12px;min-height:34px";btn.textContent=x.resultEntered?"結果修正":"結果入力";
    btn.addEventListener("click",()=>{
     const actual=prompt("実際の3連単結果を入力（例：1-2-3）",x.actualResult||"");
     if(actual===null)return;
     const normalized=actual.trim().replace(/[＞→ー－]/g,"-").replace(/\s/g,"");
     if(!/^[1-6]-[1-6]-[1-6]$/.test(normalized)||new Set(normalized.split("-")).size!==3){alert("1-2-3 の形式で、異なる艇番を3つ入力してください。");return;}
     const payoutText=prompt("この予想1点の払戻額（円・外れなら0）",String(x.payout||0));
     if(payoutText===null)return;
     const payout=Number(payoutText);
     if(!Number.isFinite(payout)||payout<0){alert("0以上の金額を入力してください。");return;}
     x.actualResult=normalized;x.hit=x.pick===normalized;x.payout=payout;x.resultEntered=true;
     localStorage.setItem("bn_records",JSON.stringify(records));renderStats();
    });
    const del=document.createElement("button");del.className="ghost";del.style.cssText="white-space:nowrap;padding:7px 9px;font-size:12px;min-height:34px;border-color:#8d4b59;color:#e59aa5";del.textContent="削除";
    del.addEventListener("click",()=>{if(!confirm(`${v.name} ${raceNumber}R の買い目「${x.pick}」を削除しますか？`))return;records.splice(index,1);localStorage.setItem("bn_records",JSON.stringify(records));renderStats();});
    actions.append(btn,del);wrap.append(actions);raceContent.append(wrap);
   });
   raceDetails.append(raceContent);
   const raceActions=document.createElement("div");
   raceActions.style.cssText="display:flex;justify-content:flex-end;padding:0 0 10px";
   const deleteRace=document.createElement("button");deleteRace.className="ghost";
   deleteRace.style.cssText="border-color:#8d4b59;color:#e59aa5;padding:6px 9px;font-size:12px;min-height:30px";
   deleteRace.textContent="このレースを一括削除";
   deleteRace.addEventListener("click",()=>{
    if(!confirm(`${v.name} ${raceNumber}R の予想 ${items.length}件をすべて削除しますか？`))return;
    const removeSet=new Set(items.map(o=>o.record));
    records=records.filter(x=>!removeSet.has(x));
    localStorage.setItem("bn_records",JSON.stringify(records));renderStats();
   });
   // v10: レース単位の結果入力。全買い目を一度に照合する。
   const enterRace=document.createElement("button");
   enterRace.className="ghost";
   enterRace.style.cssText="padding:7px 9px;font-size:12px;min-height:34px;margin-right:8px";
   enterRace.textContent=items.every(o=>o.record.resultEntered)?"レース結果を修正":"このレースの結果を一括入力";
   enterRace.addEventListener("click",()=>{
    const existing=items.find(o=>o.record.resultEntered);
    const raw=prompt(`${v.name} ${raceNumber}R の確定3連単を入力（例：1-2-3）`,existing?.record.actualResult||"");
    if(raw===null)return;
    const result=raw.trim().replace(/[＞→ー－－]/g,"-").replace(/\\s/g,"");
    if(!/^[1-6]-[1-6]-[1-6]$/.test(result)||new Set(result.split("-")).size!==3){
     alert("異なる艇番を 1-2-3 の形式で入力してください。");return;
    }
    const prior=items.find(o=>o.record.resultEntered&&o.record.hit&&o.record.actualResult===result);
    const defaultDividend=prior&&Number(prior.record.stake)>0?String(Math.round(Number(prior.record.payout)*100/Number(prior.record.stake))):"0";
    const dividendText=prompt("3連単の公式払戻金（100円あたり・円）を入力。的中なしでも入力してください。",defaultDividend);
    if(dividendText===null)return;
    const dividend=Number(dividendText.replace(/[,，円\\s]/g,""));
    if(!Number.isFinite(dividend)||dividend<0||!Number.isInteger(dividend)){
     alert("払戻金は0以上の整数で入力してください。");return;
    }
    const winners=items.filter(o=>o.record.pick===result).length;
    if(winners&&dividend===0&&!confirm("的中する買い目がありますが払戻金が0円です。このまま登録しますか？"))return;
    if(!confirm(`${v.name} ${raceNumber}R：結果 ${result}、100円あたり払戻 ${yen(dividend)}。${items.length}件に反映しますか？`))return;
    items.forEach(({record:x})=>{
     x.actualResult=result;
     x.hit=x.pick===result;
     x.payout=x.hit?Math.round(dividend*Number(x.stake||0)/100):0;
     x.resultEntered=true;
    });
    localStorage.setItem("bn_records",JSON.stringify(records));
    renderStats();
    alert(`${v.name} ${raceNumber}R の${items.length}件を更新しました。`);
   });
   raceActions.style.flexWrap="wrap";
   raceActions.style.gap="6px";
   const autoRace=document.createElement('button');
   autoRace.className='ghost';autoRace.style.cssText='padding:7px 9px;font-size:12px;min-height:34px';
   autoRace.textContent='結果を自動取得';
   autoRace.addEventListener('click',async()=>{
    autoRace.disabled=true;autoRace.textContent='取得中…';
    try{await autoSettleRace(items,v.id,raceNumber,v.name);}finally{autoRace.disabled=false;autoRace.textContent='結果を自動取得';}
   });
   raceActions.append(autoRace);
   raceActions.append(enterRace);
   raceActions.append(deleteRace);
   raceBox.append(raceDetails,raceActions);venueContent.append(raceBox);
  });
  venueDetails.append(venueContent);venueBox.append(venueDetails);host.append(venueBox);
 });
}
$("runAnalysis").addEventListener("click",renderAnalysis);
$("buildTickets").addEventListener("click",generateTickets);
$("saveManual").addEventListener("click",()=>{if(selected.length!==3){$("manualMessage").textContent="3艇を順番に選択してください。";return;}const stake=Number($("stake").value);if(!Number.isFinite(stake)||stake<100){$("manualMessage").textContent="金額は100円以上で入力してください。";return;}const venue=$("manualVenue");saveRecord({type:"manual",venue:venue.value,venueName:STADIUMS[Number(venue.value)]||venue.selectedOptions[0]?.textContent,race:$("manualRace").value,kind:"3連単",pick:selected.join("-"),stake});selected=[];paintChoices();$("manualMessage").textContent="予想を保存しました。";});
$("reload").addEventListener("click",loadData);
$("venueSelect").addEventListener("change",renderRace);$("raceSelect").addEventListener("change",renderRace);

function exportRecordsBackup(){
 try{
  const raw=localStorage.getItem('bn_records')||'[]';
  const saved=JSON.parse(raw);
  if(!Array.isArray(saved))throw new Error('保存形式が不正です');
  const payload={app:'BOAT NAVI ELITE',format:'bn-records-backup',version:1,exportedAt:new Date().toISOString(),count:saved.length,records:saved};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='boat-navi-records-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  $('backupStatus').textContent=saved.length+'件のバックアップファイルを作成しました。iPhoneの「ファイル」に保存されたか確認してください。';
 }catch(e){$('backupStatus').textContent='バックアップに失敗しました：'+e.message;}
}
async function importRecordsBackup(event){
 const input=event.target, file=input.files?.[0];
 if(!file)return;
 try{
  if(file.size>20*1024*1024)throw new Error('ファイルが大きすぎます');
  const payload=JSON.parse(await file.text());
  if(payload?.format!=='bn-records-backup'||payload.version!==1||!Array.isArray(payload.records)||payload.count!==payload.records.length)throw new Error('BOAT NAVI ELITEのバックアップ形式ではありません');
  if(!payload.records.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.pick==='string'&&typeof x.stake==='number'&&Number.isFinite(x.stake)))throw new Error('記録データが不正です');
  const current=JSON.parse(localStorage.getItem('bn_records')||'[]');
  if(!Array.isArray(current))throw new Error('現在の記録形式が不正です');
  if(!confirm('バックアップ '+payload.records.length+'件を復元します。現在の'+current.length+'件は上書きされます。先に現在の記録をバックアップしましたか？'))return;
  localStorage.setItem('bn_records',JSON.stringify(payload.records));
  records=payload.records;
  renderStats();
  $('backupStatus').textContent=payload.records.length+'件を復元しました。';
 }catch(e){$('backupStatus').textContent='復元できませんでした：'+e.message;}
 finally{input.value='';}
}
$('exportRecords')?.addEventListener('click',exportRecordsBackup);
$('importRecords')?.addEventListener('change',importRecordsBackup);

$('settleAllPending')?.addEventListener('click',settleAllPending);
buildBoatChoices();renderStats();loadData();

// ページ本体を再取得。保存した予想（localStorage）は保持する。
async function refreshAppShell(){
 const btn=document.getElementById('refreshApp');
 if(btn){btn.disabled=true;btn.textContent='更新中…';}
 try{
  if('serviceWorker' in navigator){
   const reg=await navigator.serviceWorker.getRegistration();
   if(reg)await reg.update();
  }
  if('caches' in window){
   const keys=await caches.keys();
   await Promise.all(keys.filter(k=>k.startsWith('boat-navi-')).map(k=>caches.delete(k)));
  }
  window.location.replace('./index.html?refresh='+Date.now());
 }catch(err){
  if(btn){btn.disabled=false;btn.textContent='↻ 更新';}
  alert('更新できませんでした。通信を確認してもう一度お試しください。');
 }
}
document.getElementById('refreshApp')?.addEventListener('click',refreshAppShell);

/* v14 trial: data exploration only, v13 scoring remains unchanged */
(function(){
 const venue=$('courseStatsVenue'),button=$('courseStatsLoad'),status=$('courseStatsStatus'),result=$('courseStatsResult');
 if(!venue||!button)return;
 Object.entries(STADIUMS).forEach(([id,name])=>{const o=document.createElement('option');o.value=id;o.textContent=id.padStart(2,'0')+' '+name;venue.appendChild(o);});
 venue.value='12';
 const safeNumber=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
 button.addEventListener('click',async()=>{
  const id=venue.value.padStart(2,'0'),url='https://boatrace-db.jp/api/stadium/'+id+'/course/';
  status.textContent='公開データを確認中…';result.replaceChildren();button.disabled=true;
  try{
   const response=await fetch(url,{cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const obj=await response.json();
   if(!obj||typeof obj!=='object')throw new Error('データ形式を確認できません');
   const courses=Array.isArray(obj.courses)?obj.courses:[];
   const valid=courses.length>0&&courses.every(c=>Number.isInteger(Number(c.course))&&Number(c.course)>=1&&Number(c.course)<=6&&Number.isFinite(Number(c.win_rate)));
   if(!valid)throw new Error('コース統計の形式が想定と異なります');
   const period=document.createElement('div');period.className='status';
   period.textContent='集計期間：'+(obj.period?.from||'不明')+' 〜 '+(obj.period?.to||'不明')+' ／ 進入コース別の統計';
   const wrap=document.createElement('div');wrap.style.cssText='overflow-x:auto;margin-top:12px';
   const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;font-size:13px;min-width:310px';
   const head=document.createElement('thead');const hr=document.createElement('tr');
   ['コース','出走数','1着率','2連対率','3連対率'].forEach(t=>{const th=document.createElement('th');th.textContent=t;th.style.cssText='padding:10px 5px;border-bottom:1px solid #435064;text-align:center;white-space:nowrap';hr.appendChild(th);});head.appendChild(hr);table.appendChild(head);
   const body=document.createElement('tbody');
   const fmt=v=>Number.isFinite(Number(v))&&v!==null&&v!==undefined?Number(v).toFixed(1)+'%':'—';
   courses.slice().sort((a,b)=>Number(a.course)-Number(b.course)).forEach(c=>{
    const tr=document.createElement('tr');
    [String(c.course),String(c.starts??'—'),fmt(c.win_rate),fmt(c.place2_rate),fmt(c.place3_rate)].forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;td.style.cssText='padding:11px 5px;border-bottom:1px solid #293648;text-align:center;white-space:nowrap'+(i===2?';color:#dfbd75;font-weight:bold':'');tr.appendChild(td);});
    body.appendChild(tr);
   });table.appendChild(body);wrap.appendChild(table);
   const note=document.createElement('div');note.className='status';note.style.marginTop='12px';note.textContent='※1着率＝そのコースから出走した艇が1着になる割合。2連対率・3連対率はそれぞれ2着以内・3着以内の割合。予想ロジックには未反映です。';
   result.append(period,wrap,note);
   status.textContent=STADIUMS[Number(id)]+'のコース統計データを取得できました。';
  }catch(e){
   status.textContent='データを取得できませんでした（'+e.message+'）。公式サイトの場別データを確認してください。';
  }finally{button.disabled=false;}
 });
})();
