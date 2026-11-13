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
  data=json;sessionStorage.setItem("bn_today",JSON.stringify({at:Date.now(),data}));
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
function updateRaceOptions(venueId,raceId){const s=getStadiums()[$(venueId).value];fillSelect($(raceId),Object.keys(getRaces(s)).map(x=>[x,x+"R"]));if(venueId==="venueSelect")renderRace();}
function setSelectors(venue,race){$("venueSelect").value=venue;updateRaceOptions("venueSelect","raceSelect");$("raceSelect").value=race;}
function selectedRace(venueId,raceId){return getRaces(getStadiums()[$(venueId).value])?.[$(raceId).value];}
function lane(n){return `<span class="lane" style="background:${COLORS[Number(n)-1]||"#ddd"}">${n}</span>`;}
function renderRace(){
 const r=selectedRace("venueSelect","raceSelect");if(!r){$("raceDetail").textContent="レースデータがありません。";return;}
 const racers=r.racers||{},preview=r.preview||{},pr=preview.racers||{};
 let html=`<div class="eyebrow">${STADIUMS[Number(r.stadium_number)]||"BOAT RACE"} / ${r.race_number}R</div><h3 style="margin:6px 0">${r.title||"出走表"}</h3><div class="tiny muted">締切 ${r.closed_at||"未取得"} · ${r.distance||1800}m</div>`;
 for(let n=1;n<=6;n++){const x=racers[n]||{},p=pr[n]||{};html+=`<div class="boatrow"><div>${lane(n)}<b>${x.name||"選手情報なし"}</b><div class="tiny muted" style="margin:4px 0 0 37px">${x.number||""} · ${x.rank_number_source||""}</div></div><div style="text-align:right"><b>${x.national_win_rate??"-"}</b><div class="tiny muted">全国勝率</div></div></div><div class="tiny muted" style="padding:4px 0 7px 37px">当地 ${x.local_win_rate??"-"} · M2連率 ${x.motor_top_2_percent??"-"}% · 平均ST ${x.average_start_timing??"-"} · 展示 ${p.exhibition_time??"-"}</div>`;}
 const w=preview.wind_speed,wh=preview.wave_height;html+=`<div class="notice">直前情報：風速 ${w??"-"}m · 波高 ${wh??"-"}cm · 展示タイム・進入は取得できた項目のみ表示します。</div>`;
 $("raceDetail").innerHTML=html;
}
function scoreRace(r){
 const racers=r?.racers||{},pr=r?.preview?.racers||{};let rows=[];
 for(let n=1;n<=6;n++){const x=racers[n]||{},p=pr[n]||{};const vals=[x.national_win_rate,x.local_win_rate,x.motor_top_2_percent,x.average_start_timing,p.exhibition_time].map(Number);
 const [nat,local,motor,st,ex]=vals;
 // Simple transparent weighted score. Missing fields are excluded and weights re-normalized.
 let parts=[];if(Number.isFinite(nat)&&nat>0)parts.push([nat*4,4]);if(Number.isFinite(local)&&local>0)parts.push([local*2,2]);if(Number.isFinite(motor)&&motor>=0)parts.push([motor*.045,2]);if(Number.isFinite(st)&&st>0)parts.push([(0.25-st)*12,1]);if(Number.isFinite(ex)&&ex>0)parts.push([(7-ex)*5,1]);
 const score=parts.length?parts.reduce((a,b)=>a+b[0],0)/parts.reduce((a,b)=>a+b[1],0):0;
 rows.push({n,name:x.name||"選手情報なし",score,parts:parts.length,stats:x});}
 return rows.sort((a,b)=>b.score-a.score);
}
function renderAnalysis(){
 const r=selectedRace("aiVenue","aiRace");if(!r){$("analysisResult").textContent="対象レースがありません。";return;}
 const scores=scoreRace(r),max=scores[0]?.score||1;
 $("analysisResult").innerHTML=`<div class="eyebrow">REFERENCE SCORE · NOT WIN PROBABILITY</div>`+scores.map((x,i)=>`<div class="boatrow"><div>${lane(x.n)}<b>${x.name}</b><div class="tiny muted">${x.parts}項目で評価</div></div><div style="width:43%;text-align:right"><b class="gold">${x.score.toFixed(2)}</b><div style="height:5px;background:#283547;border-radius:8px;margin-top:5px"><div style="height:5px;width:${Math.max(2,x.score/max*100)}%;background:linear-gradient(90deg,#a98548,#e2c88f);border-radius:8px"></div></div></div></div>`).join("")+`<div class="notice">スコアは出走表・取得できた直前情報を単純加重した参考値です。オッズ、展開、気象の変化、欠損値を十分に補正していません。的中確率や利益を保証するものではありません。</div>`;
}
let generatedTickets=[];
function permutations3(items){const out=[];for(const a of items)for(const b of items)if(b.n!==a.n)for(const c of items)if(c.n!==a.n&&c.n!==b.n)out.push([a,b,c]);return out;}
function generateTickets(){
 const r=selectedRace("aiVenue","aiRace");
 if(!r){$("ticketResult").innerHTML='<div class="notice">対象レースのデータがありません。</div>';return;}
 const ranked=scoreRace(r);
 if(ranked.length!==6||ranked.every(x=>x.parts===0)){$("ticketResult").innerHTML='<div class="notice">選手データが不足しているため、買い目を作成できません。</div>';return;}
 const byLane=new Map(ranked.map(x=>[x.n,x]));
 // 参考スコアを艇間比較用に0〜1へ正規化。枠番補正も小さく加える簡易ルール。
 const vals=ranked.map(x=>x.score),min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
 const laneBonus={1:.18,2:.10,3:.04,4:0,5:-.04,6:-.08};
 const combos=permutations3(ranked).map(([a,b,c])=>{
  const norm=x=>(x.score-min)/range;
  const value=norm(a)*.52+norm(b)*.30+norm(c)*.18+laneBonus[a.n];
  return {pick:`${a.n}-${b.n}-${c.n}`,value,boats:[a.n,b.n,c.n]};
 }).sort((a,b)=>b.value-a.value);
 const count=Number($("ticketCount").value),unit=Number($("ticketUnit").value);
 generatedTickets=combos.slice(0,count).map((x,i)=>({...x,rank:i+1,category:i===0?"本命":i<4?"対抗":"押さえ・穴",stake:unit}));
 const total=unit*generatedTickets.length;
 const venueId=$("aiVenue").value,venueName=STADIUMS[Number(venueId)]||"競艇場";
 $("ticketResult").innerHTML=`<div class="row" style="margin:12px 0"><b>${venueName} ${$("aiRace").value}R</b><span class="badge">${count}点 / ${yen(total)}</span></div>`+
 generatedTickets.map(x=>`<div class="ticket"><div><span class="ticket-rank">${x.category} · ${x.rank}番目</span><b>${x.pick}</b></div><span class="muted">${yen(x.stake)}</span></div>`).join("")+
 `<div class="notice">順位スコアと簡易的な1コース補正で並べた買い目候補です。オッズ・進入変化・選手コメント等は十分に反映していません。確率や期待値を示すものではありません。</div><button id="saveAutoTickets" class="btn" style="margin-top:12px">この${count}点を予想記録に保存</button><div id="autoSaveMessage" class="status"></div>`;
 $("saveAutoTickets").addEventListener("click",()=>{
  const stamp=new Date().toISOString();
  generatedTickets.forEach(x=>records.push({type:"auto",venue:venueId,venueName,race:$("aiRace").value,kind:"3連単・自動案",pick:x.pick,stake:x.stake,createdAt:stamp,hit:false,payout:0}));
  localStorage.setItem("bn_records",JSON.stringify(records));renderStats();$("autoSaveMessage").textContent=`${generatedTickets.length}点を記録に保存しました。`;
 });
}
function buildBoatChoices(){for(let n=1;n<=6;n++){const b=document.createElement("button");b.className="pick";b.dataset.boat=n;b.innerHTML=lane(n);b.addEventListener("click",()=>{if(selected.includes(n))selected=selected.filter(x=>x!==n);else if(selected.length<3)selected.push(n);else selected=[n];paintChoices();});$("boatChoices").append(b);}}
function paintChoices(){document.querySelectorAll("[data-boat]").forEach(b=>b.classList.toggle("selected",selected.includes(Number(b.dataset.boat))));$("selectedText").textContent=selected.length?selected.join(" → ")+" ("+selected.length+"/3)":"1着・2着・3着の順に3艇選択してください。";}
function saveRecord(record){records.push({...record,createdAt:new Date().toISOString(),hit:false,payout:0});localStorage.setItem("bn_records",JSON.stringify(records));renderStats();page("records");}
function renderStats(){const total=records.reduce((a,x)=>a+Number(x.stake||0),0);$("savedCount").textContent=records.length;$("recordCount").textContent=records.length;$("recordStake").textContent=yen(total);$("hitCount").textContent=records.filter(x=>x.hit).length;$("recovery").textContent="--";$("history").innerHTML=records.length?records.slice().reverse().map(x=>`<div class="boatrow"><div><b>${x.venueName} ${x.race}R</b><div class="tiny muted">${x.kind} · ${x.pick}</div><div class="tiny muted">${new Date(x.createdAt).toLocaleString("ja-JP")}</div></div><b>${yen(x.stake)}</b></div>`).join(""):"まだ記録がありません。";}
$("runAnalysis").addEventListener("click",renderAnalysis);
$("buildTickets").addEventListener("click",generateTickets);
$("saveManual").addEventListener("click",()=>{if(selected.length!==3){$("manualMessage").textContent="3艇を順番に選択してください。";return;}const stake=Number($("stake").value);if(!Number.isFinite(stake)||stake<100){$("manualMessage").textContent="金額は100円以上で入力してください。";return;}const venue=$("manualVenue");saveRecord({type:"manual",venue:venue.value,venueName:STADIUMS[Number(venue.value)]||venue.selectedOptions[0]?.textContent,race:$("manualRace").value,kind:"3連単",pick:selected.join("-"),stake});selected=[];paintChoices();$("manualMessage").textContent="予想を保存しました。";});
$("reload").addEventListener("click",loadData);
$("venueSelect").addEventListener("change",renderRace);$("raceSelect").addEventListener("change",renderRace);
buildBoatChoices();renderStats();loadData();
