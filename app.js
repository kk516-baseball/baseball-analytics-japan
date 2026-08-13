'use strict';

/* ======================================================
   UTILITIES
====================================================== */
function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function hashStr(s){
  let h=0;
  for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i); h|=0;}
  return h;
}
function rng(...parts){ return mulberry32(hashStr(parts.join('|'))); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function round(v,d=0){ const m=Math.pow(10,d); return Math.round(v*m)/m; }
function avg3(v){ // .xxx style, no leading 0
  if(v==null||isNaN(v)) return '---';
  let s=v.toFixed(3);
  return v<1 ? s.replace(/^0/,'') : s;
}
function dec(v,d=2){ return (v==null||isNaN(v)) ? '---' : v.toFixed(d); }
function pct(v,d=1){ return (v==null||isNaN(v)) ? '---' : (v*100).toFixed(d)+'%'; }
function man(v){ return v==null ? '非公開' : Math.round(v).toLocaleString('ja-JP')+'万円(推定)'; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ======================================================
   TEAMS & VENUES
====================================================== */
const TEAMS=[
  {id:'YG',name:'読売ジャイアンツ',short:'巨人',league:'セ',venue:'東京ドーム'},
  {id:'HT',name:'阪神タイガース',short:'阪神',league:'セ',venue:'阪神甲子園球場'},
  {id:'HC',name:'広島東洋カープ',short:'広島',league:'セ',venue:'MAZDA Zoom-Zoom スタジアム広島'},
  {id:'DB',name:'横浜DeNAベイスターズ',short:'DeNA',league:'セ',venue:'横浜スタジアム'},
  {id:'SW',name:'東京ヤクルトスワローズ',short:'ヤクルト',league:'セ',venue:'明治神宮野球場'},
  {id:'CD',name:'中日ドラゴンズ',short:'中日',league:'セ',venue:'バンテリンドーム ナゴヤ'},
  {id:'SH',name:'福岡ソフトバンクホークス',short:'ソフトバンク',league:'パ',venue:'福岡PayPayドーム'},
  {id:'OB',name:'オリックス・バファローズ',short:'オリックス',league:'パ',venue:'京セラドーム大阪'},
  {id:'LM',name:'千葉ロッテマリーンズ',short:'ロッテ',league:'パ',venue:'ZOZOマリンスタジアム'},
  {id:'SL',name:'埼玉西武ライオンズ',short:'西武',league:'パ',venue:'ベルーナドーム'},
  {id:'RE',name:'東北楽天ゴールデンイーグルス',short:'楽天',league:'パ',venue:'楽天モバイルパーク宮城'},
  {id:'NF',name:'北海道日本ハムファイターズ',short:'日本ハム',league:'パ',venue:'エスコンフィールドHOKKAIDO'}
];
const TEAM_MAP=Object.fromEntries(TEAMS.map(t=>[t.id,t]));
const ICONIC_VENUES=['阪神甲子園球場','東京ドーム','バンテリンドーム ナゴヤ'];
const YEARS=[2022,2023,2024];
const MONTHS=[4,5,6,7,8,9];

function ageIn(p,year){ return year-p.birthYear; }
function teamOf(p){ return TEAM_MAP[p.team]; }
function level(p){ return 0.7+rng(p.id,'level')()*0.6; }

/* ======================================================
   STATS ACCESSORS
   Base season stats (statsOf) are REAL, taken from REAL_STATS.
   得点圏打率／被打率／QS率 are not published by NPB, so they
   are always returned as null ("---" in the UI).
====================================================== */
function statsOf(p,year){
  const raw=REAL_STATS[p.id] && REAL_STATS[p.id][year];
  if(!raw) return null;
  if(p.posType==='B'){
    const pa=raw.ab+raw.bb;
    return {
      ab:raw.ab, h:raw.h, hr:raw.hr, rbi:raw.rbi, obp:raw.obp, slg:raw.slg, ops:raw.ops,
      avg:raw.h/raw.ab, risp:null,
      kRate: pa? raw.so/pa : null, bbRate: pa? raw.bb/pa : null
    };
  }
  return {
    era:raw.era, wins:raw.w, losses:raw.l, ip:raw.ip, so:raw.so, bb:raw.bb, h:raw.h,
    whip:raw.whip, kbb:raw.kbb, k9: raw.ip? raw.so/(raw.ip/9) : null,
    avgAgainst:null, qsRate:null
  };
}
// Baseline used only for the illustrative (simulated) splits below —
// falls back to a player's multi-year average, or a league-average
// default when no official season is on record (e.g. below qualification).
function playerBaseline(p){
  const stats=REAL_STATS[p.id]||{};
  if(p.posType==='B'){
    const avgs=YEARS.map(y=>stats[y]).filter(Boolean).map(s=>s.h/s.ab);
    return avgs.length? avgs.reduce((a,b)=>a+b,0)/avgs.length : 0.260;
  }
  const eras=YEARS.map(y=>stats[y]).filter(Boolean).map(s=>s.era);
  return eras.length? eras.reduce((a,b)=>a+b,0)/eras.length : 3.60;
}

/* ======================================================
   ILLUSTRATIVE SPLITS (simulated) — 対戦成績・球場成績・月別成績・
   二軍成績 are not published by NPB in aggregated form, so these
   are seeded, deterministic simulations built around each player's
   real seasonal baseline, for demonstration purposes only.
====================================================== */
function monthlyStats(p,year){
  const seed=hashStr(p.id);
  const base=playerBaseline(p);
  if(p.posType==='B'){
    return MONTHS.map(m=>{
      const r=rng(p.id,year,'month',m);
      const wave=Math.sin((m+seed%6)*0.9)*0.045;
      const ab=Math.round(58+r()*46);
      const avg=clamp(base+wave+(r()-0.5)*0.05,0.120,0.430);
      const h=Math.round(ab*avg);
      const hr=Math.round(r()*5.4*level(p));
      return {month:m,ab,h,avg:ab? h/ab:0,hr};
    });
  }
  return MONTHS.map(m=>{
    const r=rng(p.id,year,'month',m);
    const wave=Math.sin((m+seed%6)*0.9)*0.9;
    const ip=round(12+r()*15,1);
    const era=clamp(base+wave+(r()-0.5)*0.9,1.00,7.80);
    return {month:m,ip,era};
  });
}
function venueStats(p,year){
  const home=teamOf(p).venue;
  const list=Array.from(new Set([home,...ICONIC_VENUES]));
  const base=playerBaseline(p);
  return list.map(v=>{
    const r=rng(p.id,year,'venue',v);
    if(p.posType==='B'){
      const ab=Math.round(18+r()*66);
      const avg=clamp(base+(r()-0.5)*0.09,0.120,0.430);
      const h=Math.round(ab*avg);
      const hr=Math.round(r()*3.6*level(p));
      return {venue:v,isHome:v===home,ab,h,avg:ab? h/ab:0,hr};
    }
    const ip=round(4+r()*24,1);
    const era=clamp(base+(r()-0.5)*1.7,1.00,8.00);
    return {venue:v,isHome:v===home,ip,era};
  });
}
function homeAwaySplit(p,year){
  const base=playerBaseline(p);
  if(p.posType==='B'){
    const rH=rng(p.id,year,'home'),rA=rng(p.id,year,'away');
    return {
      home:{avg:clamp(base+0.014+(rH()-0.5)*0.03,0.150,0.400)},
      away:{avg:clamp(base-0.010+(rA()-0.5)*0.03,0.150,0.400)}
    };
  }
  const rH=rng(p.id,year,'home2'),rA=rng(p.id,year,'away2');
  return {
    home:{era:clamp(base-0.24+(rH()-0.5)*0.6,1.20,6.80)},
    away:{era:clamp(base+0.20+(rA()-0.5)*0.6,1.20,6.80)}
  };
}
function hasFarmRecord(p,year){ return rng(p.id,year,'hasfarm')()<0.6; }
function farmStats(p,year){
  const r=rng(p.id,year,'farm');
  if(p.posType==='B'){
    const ab=Math.round(28+r()*140);
    const avg=clamp(0.230+(r()-0.5)*0.10,0.150,0.410);
    const h=Math.round(ab*avg);
    const hr=Math.round(r()*9);
    return {ab,h,avg:ab? h/ab:0,hr};
  }
  const ip=round(5+r()*58,1);
  const era=clamp(2.00+(r()-0.5)*3.1,0.70,6.60);
  const so=Math.round(ip*(0.7+r()*0.55));
  return {ip,era,so};
}
function matchupStats(batter,pitcher){
  const r=rng(batter.id,pitcher.id,'matchup');
  const ab=Math.round(3+r()*22);
  const diff=level(batter)-level(pitcher);
  const avg=clamp(0.255+diff*0.10+(r()-0.5)*0.14,0.000,0.650);
  const h=Math.round(ab*avg);
  const hr=Math.round(r()*Math.min(3,Math.floor(ab/8))*(diff>0?1:0.35));
  const bb=Math.round(r()*3);
  const so=Math.round(r()*ab*0.32);
  return {ab,h,hr,bb,so,avg:ab? h/ab:0};
}
function teamStats(team,year){
  const r=rng(team.id,year,'teamstat');
  const runsScored=Math.round(430+r()*230);
  const runsAllowed=Math.round(430+(1-r())*230);
  const ops=round(clamp(0.640+(r()-0.5)*0.10,0.580,0.800),3);
  const era=round(clamp(3.60+(r()-0.5)*1.2,2.60,4.90),2);
  const fpct=round(clamp(0.975+(r()-0.5)*0.014,0.963,0.991),3);
  let wins=Math.round(clamp(58+r()*32,45,95));
  let losses=Math.max(30,143-wins-Math.round(r()*10));
  return {runsScored,runsAllowed,ops,era,fpct,wins,losses};
}

/* ======================================================
   STATE
====================================================== */
const STATE={
  tab:'search',
  year:2024,
  searchFilters:{name:'',team:'',pos:'',school:'',draftRound:'',salaryMax:70000,detailedOnly:''},
  listType:'B',
  listYear:2024,
  sortKey:null, sortDir:-1,
  rankCategory:'ops',
  rankYear:2024,
  teamA:'YG', teamB:'HT', teamYear:2024,
  cmpA:'p01', cmpB:'p09', cmpYear:2024,
  mBat:'p18', mPit:'p09',
  modalPlayer:null, modalTab:'career'
};

const TABS=[
  {id:'search',label:'選手検索',num:'01'},
  {id:'stats',label:'成績一覧',num:'02'},
  {id:'ranking',label:'ランキング',num:'03'},
  {id:'teamcmp',label:'チーム比較',num:'04'},
  {id:'playercmp',label:'選手比較',num:'05'},
  {id:'matchup',label:'対戦成績',num:'06'}
];

/* ======================================================
   RENDER: TABBAR / HERO STATS
====================================================== */
function renderHeroStats(){
  const el=document.getElementById('heroStats');
  const nb=PLAYERS.filter(p=>p.posType==='B').length;
  const np=PLAYERS.filter(p=>p.posType==='P').length;
  el.innerHTML=[
    {n:TEAMS.length,l:'球団数'},
    {n:PLAYERS.length,l:'収録選手'},
    {n:nb,l:'野手'},
    {n:np,l:'投手'}
  ].map(s=>`<div class="hero-stat"><div class="n">${s.n}</div><div class="l">${s.l}</div></div>`).join('');
}
function renderTabbar(){
  const el=document.getElementById('tabbar');
  el.innerHTML=TABS.map(t=>`<button class="tab-btn ${STATE.tab===t.id?'active':''}" data-tab="${t.id}"><span class="num">${t.num}</span>${t.label}</button>`).join('');
  el.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{STATE.tab=b.dataset.tab; renderApp();}));
}

/* ======================================================
   MAIN APP RENDER
====================================================== */
function renderApp(){
  renderTabbar();
  const app=document.getElementById('app');
  if(STATE.tab==='search') app.innerHTML=viewSearch();
  else if(STATE.tab==='stats') app.innerHTML=viewStats();
  else if(STATE.tab==='ranking') app.innerHTML=viewRanking();
  else if(STATE.tab==='teamcmp') app.innerHTML=viewTeamCompare();
  else if(STATE.tab==='playercmp') app.innerHTML=viewPlayerCompare();
  else if(STATE.tab==='matchup') app.innerHTML=viewMatchup();
  bindView();
}

/* ---------- 01 選手検索 ---------- */
function filteredPlayers(){
  const f=STATE.searchFilters;
  return PLAYERS.filter(p=>{
    if(f.name && !p.name.includes(f.name)) return false;
    if(f.team && p.team!==f.team) return false;
    if(f.pos==='B'||f.pos==='P'){ if(p.posType!==f.pos) return false; }
    else if(f.pos && p.posDetail!==f.pos) return false;
    if(f.school && p.school!==f.school) return false;
    if(f.draftRound && String(p.draftRound)!==f.draftRound) return false;
    if(p.salary>f.salaryMax) return false;
    if(f.detailedOnly==='1' && !p.hasDetailedStats) return false;
    if(f.detailedOnly==='0' && p.hasDetailedStats) return false;
    return true;
  });
}
function viewSearch(){
  const f=STATE.searchFilters;
  const results=filteredPlayers();
  const posDetails=Array.from(new Set(PLAYERS.map(p=>p.posDetail)));
  const schools=Array.from(new Set(PLAYERS.map(p=>p.school))).filter(Boolean).sort();
  const draftRounds=Array.from(new Set(PLAYERS.map(p=>p.draftRound).filter(r=>r!=null))).sort((a,b)=>a-b);
  const detailedCount=PLAYERS.filter(p=>p.hasDetailedStats).length;
  return `
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">選手検索<span class="tag">SEARCH</span></div>
      <div class="panel-desc">名前・チーム・ポジション・年度・出身校・ドラフト順位・年俸で絞り込み（12球団${PLAYERS.length}名の基本情報。うち実在選手${detailedCount}名は2022〜2024年の詳細スタッツあり）</div>
    </div>
    <div class="grid cols-4" id="searchFields">
      <div class="field"><label>選手名</label><input type="text" id="f_name" value="${esc(f.name)}" placeholder="例: 村上"></div>
      <div class="field"><label>チーム</label><select id="f_team"><option value="">すべて</option>${TEAMS.map(t=>`<option value="${t.id}" ${f.team===t.id?'selected':''}>${t.short}</option>`).join('')}</select></div>
      <div class="field"><label>ポジション</label><select id="f_pos"><option value="">すべて</option><option value="B" ${f.pos==='B'?'selected':''}>野手（全体）</option><option value="P" ${f.pos==='P'?'selected':''}>投手（全体）</option>${posDetails.map(d=>`<option value="${d}" ${f.pos===d?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="field"><label>年度</label><select id="f_year">${YEARS.map(y=>`<option value="${y}" ${STATE.year===y?'selected':''}>${y}年</option>`).join('')}</select></div>
      <div class="field"><label>出身校</label><select id="f_school"><option value="">すべて</option>${schools.map(s=>`<option value="${esc(s)}" ${f.school===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
      <div class="field"><label>ドラフト順位</label><select id="f_draft"><option value="">すべて</option>${draftRounds.map(r=>`<option value="${r}" ${f.draftRound===String(r)?'selected':''}>${r}位</option>`).join('')}</select></div>
      <div class="field"><label>詳細スタッツ</label><select id="f_detailed"><option value="">すべて</option><option value="1" ${f.detailedOnly==='1'?'selected':''}>詳細スタッツあり</option><option value="0" ${f.detailedOnly==='0'?'selected':''}>基本情報のみ</option></select></div>
      <div class="field" style="grid-column:span 2;"><label>年俸上限（推定）：<span class="range-val" id="salaryLabel">${man(f.salaryMax)}</span></label>
        <div class="range-row"><input type="range" id="f_salary" min="0" max="70000" step="1000" value="${Math.min(f.salaryMax,70000)}"></div>
      </div>
    </div>
    <div class="btn-row"><button class="btn primary" id="btnSearch">この条件で検索</button><button class="btn ghost" id="btnReset">条件をリセット</button></div>
  </div>
  <div class="panel">
    <div class="result-meta">${results.length} 件ヒット（${STATE.year}年シーズン成績を表示。詳細スタッツは実在選手${detailedCount}名分のみNPB公式成績を使用）</div>
    ${results.length===0?`<div class="empty-note">条件に一致する選手が見つかりませんでした。条件を変えてお試しください。</div>`:`
    <div class="player-grid">
      ${results.map(p=>playerCardHtml(p,STATE.year)).join('')}
    </div>`}
  </div>`;
}
function playerCardHtml(p,year){
  const s=statsOf(p,year);
  const t=teamOf(p);
  const stat1 = !p.hasDetailedStats ? `<div class="pc-stat" style="grid-column:span 3;"><span style="color:var(--dim);">背番号${p.uniformNo??'---'}・詳細スタッツ未収録（基本情報のみ）</span></div>`
    : !s ? `<div class="pc-stat" style="grid-column:span 3;"><span style="color:var(--dim);">${year}年はデータなし（規定未到達など）</span></div>`
    : p.posType==='B' ? `<div class="pc-stat"><b>${avg3(s.avg)}</b><span>打率</span></div><div class="pc-stat"><b>${s.hr}</b><span>本塁打</span></div><div class="pc-stat"><b>${dec(s.ops,3)}</b><span>OPS</span></div>`
    : `<div class="pc-stat"><b>${dec(s.era,2)}</b><span>防御率</span></div><div class="pc-stat"><b>${s.wins}-${s.losses}</b><span>勝敗</span></div><div class="pc-stat"><b>${dec(s.whip,2)}</b><span>WHIP</span></div>`;
  return `<div class="player-card ${p.posType==='P'?'pitcher':''}" data-pid="${p.id}">
    <div class="pc-top"><div class="pc-name">${esc(p.name)}</div><div class="pc-pos">${esc(p.posDetail)}</div></div>
    <div class="pc-team">${esc(t.short)} ・ ${ageIn(p,year)}歳 ・ ${esc(p.bt)}</div>
    <div class="pc-stats">${stat1}</div>
  </div>`;
}

/* ---------- 02 成績一覧 ---------- */
const BAT_COLS=[
  {k:'avg',l:'打率',f:v=>avg3(v)},{k:'h',l:'安打',f:v=>v},{k:'hr',l:'本塁打',f:v=>v},{k:'rbi',l:'打点',f:v=>v},
  {k:'ops',l:'OPS',f:v=>dec(v,3)},{k:'obp',l:'出塁率',f:v=>avg3(v)},{k:'slg',l:'長打率',f:v=>avg3(v)},
  {k:'risp',l:'得点圏打率',f:v=>avg3(v)},{k:'kRate',l:'三振率',f:v=>pct(v)},{k:'bbRate',l:'四球率',f:v=>pct(v)}
];
const PIT_COLS=[
  {k:'era',l:'防御率',f:v=>dec(v,2)},{k:'wl',l:'勝敗',f:(v,row)=>`${row.wins}-${row.losses}`},{k:'whip',l:'WHIP',f:v=>dec(v,2)},
  {k:'k9',l:'奪三振率',f:v=>dec(v,2)},{k:'avgAgainst',l:'被打率',f:v=>avg3(v)},{k:'kbb',l:'K/BB',f:v=>dec(v,2)},{k:'qsRate',l:'QS率',f:v=>pct(v)}
];
function viewStats(){
  const cols=STATE.listType==='B'?BAT_COLS:PIT_COLS;
  const allOfType=PLAYERS.filter(p=>p.posType===STATE.listType && p.hasDetailedStats);
  let rows=allOfType.map(p=>({p,s:statsOf(p,STATE.listYear)})).filter(x=>x.s);
  const missingCount=allOfType.length-rows.length;
  const sk=STATE.sortKey || (STATE.listType==='B'?'ops':'era');
  rows.sort((a,b)=>{
    const av=sk==='wl'? a.s.wins-a.s.losses : a.s[sk];
    const bv=sk==='wl'? b.s.wins-b.s.losses : b.s[sk];
    return (av-bv)*STATE.sortDir;
  });
  return `
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">成績一覧<span class="tag">STATS</span></div>
      <div class="panel-desc">列見出しをクリックしてソート（NPB公式成績。詳細スタッツ収録済みの実在選手${allOfType.length}名が対象。${missingCount>0?`うち${missingCount}名は${STATE.listYear}年のデータなし（規定未到達・MLB在籍など）のため非表示`:'全員表示中'}）</div>
    </div>
    <div class="grid cols-2" style="align-items:end;">
      <div class="field"><label>表示対象</label>
        <div class="toggle-group"><button data-list-type="B" class="${STATE.listType==='B'?'active':''}">野手</button><button data-list-type="P" class="${STATE.listType==='P'?'active':''}">投手</button></div>
      </div>
      <div class="field"><label>年度</label><select id="statsYear">${YEARS.map(y=>`<option value="${y}" ${STATE.listYear===y?'selected':''}>${y}年</option>`).join('')}</select></div>
    </div>
    <div class="table-scroll" style="margin-top:14px;">
      <table class="stat-table">
        <thead><tr>
          <th>選手</th><th>チーム</th>
          ${cols.map(c=>`<th data-sort="${c.k}" class="${sk===c.k?'sort-active':''}">${c.l}${sk===c.k?(STATE.sortDir===1?' ▲':' ▼'):''}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${rows.map(({p,s},i)=>`<tr data-pid="${p.id}">
            <td><span class="rank-num">${i+1}</span>${esc(p.name)}</td>
            <td>${esc(teamOf(p).short)}</td>
            ${cols.map(c=>`<td>${c.f(s[c.k],s)}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ---------- 03 ランキング ---------- */
const RANK_DEFS={
  h:{label:'最多安打',type:'B',better:'desc',fmt:v=>v},
  hr:{label:'最多本塁打',type:'B',better:'desc',fmt:v=>v},
  ops:{label:'OPS',type:'B',better:'desc',fmt:v=>dec(v,3)},
  war:{label:'WAR(簡易指標)',type:'B',better:'desc',fmt:v=>dec(v,1)},
  era:{label:'防御率',type:'P',better:'asc',fmt:v=>dec(v,2)},
  whip:{label:'WHIP',type:'P',better:'asc',fmt:v=>dec(v,2)}
};
function simpleWAR(p,year){
  const s=statsOf(p,year);
  if(!s) return null;
  return (s.ops-0.700)*18;
}
function viewRanking(){
  const def=RANK_DEFS[STATE.rankCategory];
  const pool=PLAYERS.filter(p=>p.posType===def.type && p.hasDetailedStats);
  let rows=pool.map(p=>{
    const s=statsOf(p,STATE.rankYear);
    if(!s) return null;
    const val=STATE.rankCategory==='war'? simpleWAR(p,STATE.rankYear) : s[STATE.rankCategory];
    return {p,s,val};
  }).filter(x=>x && x.val!=null);
  rows.sort((a,b)=> def.better==='desc'? b.val-a.val : a.val-b.val);
  rows=rows.slice(0,10);
  return `
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">年度別ランキング<span class="tag">RANKING</span></div>
      <div class="panel-desc">部門・年度を選んでTOP10を表示（規定打席／規定投球回に到達した選手のみ。NPB公式成績）</div>
    </div>
    <div class="grid cols-2">
      <div class="field"><label>部門</label><select id="rankCat">${Object.entries(RANK_DEFS).map(([k,d])=>`<option value="${k}" ${STATE.rankCategory===k?'selected':''}>${d.label}</option>`).join('')}</select></div>
      <div class="field"><label>年度</label><select id="rankYear">${YEARS.map(y=>`<option value="${y}" ${STATE.rankYear===y?'selected':''}>${y}年</option>`).join('')}</select></div>
    </div>
    <div style="margin-top:16px;">
      ${rows.map((r,i)=>{
        const max=Math.max(...rows.map(x=>Math.abs(x.val)))||1;
        const w=Math.max(6,Math.abs(r.val)/max*100);
        return `<div class="bar-row" data-pid="${r.p.id}" style="cursor:pointer;">
          <div class="bl"><b style="color:var(--led-2);font-family:var(--mono);">${i+1}</b>&nbsp; ${esc(r.p.name)} <span class="pill" style="margin-left:4px;">${esc(teamOf(r.p).short)}</span></div>
          <div class="bar-track"><div class="bar-fill ${def.better==='asc'?'alt':''}" style="width:${w}%;"></div></div>
          <div class="bv">${def.fmt(r.val)}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ---------- 04 チーム比較 ---------- */
function viewTeamCompare(){
  const a=TEAM_MAP[STATE.teamA], b=TEAM_MAP[STATE.teamB];
  const sa=teamStats(a,STATE.teamYear), sb=teamStats(b,STATE.teamYear);
  const rows=[
    {l:'得点',ka:sa.runsScored,kb:sb.runsScored,better:'desc'},
    {l:'失点',ka:sa.runsAllowed,kb:sb.runsAllowed,better:'asc'},
    {l:'チームOPS',ka:sa.ops,kb:sb.ops,better:'desc',fmt:v=>dec(v,3)},
    {l:'チーム防御率',ka:sa.era,kb:sb.era,better:'asc',fmt:v=>dec(v,2)},
    {l:'守備率',ka:sa.fpct,kb:sb.fpct,better:'desc',fmt:v=>dec(v,3)},
    {l:'勝敗',ka:`${sa.wins}-${sa.losses}`,kb:`${sb.wins}-${sb.losses}`,noBar:true}
  ];
  return `
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">チーム比較<span class="tag">TEAM VS</span></div>
      <div class="panel-desc">得点・失点・OPS・防御率・守備率を並べて比較</div>
    </div>
    <div class="grid cols-3">
      <div class="field"><label>チームA</label><select id="teamA">${TEAMS.map(t=>`<option value="${t.id}" ${STATE.teamA===t.id?'selected':''}>${t.short}</option>`).join('')}</select></div>
      <div class="field"><label>チームB</label><select id="teamB">${TEAMS.map(t=>`<option value="${t.id}" ${STATE.teamB===t.id?'selected':''}>${t.short}</option>`).join('')}</select></div>
      <div class="field"><label>年度</label><select id="teamYear">${YEARS.map(y=>`<option value="${y}" ${STATE.teamYear===y?'selected':''}>${y}年</option>`).join('')}</select></div>
    </div>
    <div class="compare-vs" style="margin-top:16px;">
      <div class="compare-col"><h4>${esc(a.short)}</h4><div class="sub">${esc(a.venue)} ・ ${a.league}リーグ</div></div>
      <div class="vs-mid">VS</div>
      <div class="compare-col"><h4>${esc(b.short)}</h4><div class="sub">${esc(b.venue)} ・ ${b.league}リーグ</div></div>
    </div>
    <div style="margin-top:18px;">
      ${rows.map(r=>{
        if(r.noBar){
          return `<div class="bar-row"><div class="bl">${r.l}</div><div style="text-align:center;font-family:var(--mono);color:var(--dim);font-size:12px;">${r.ka} ／ ${r.kb}</div><div></div></div>`;
        }
        const fmt=r.fmt||(v=>v);
        const max=Math.max(r.ka,r.kb)||1;
        const wa=r.ka/max*100, wb=r.kb/max*100;
        const aWin=(r.better==='desc'? r.ka>=r.kb : r.ka<=r.kb);
        return `<div class="bar-row"><div class="bl">${r.l}</div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--dim);margin-bottom:2px;"><span>${esc(a.short)}</span><span>${esc(b.short)}</span></div>
            <div style="display:flex;gap:4px;">
              <div class="bar-track" style="flex:1;"><div class="bar-fill ${aWin?'':'alt'}" style="width:${wa}%;"></div></div>
              <div class="bar-track" style="flex:1;"><div class="bar-fill ${aWin?'alt':''}" style="width:${wb}%;margin-left:auto;"></div></div>
            </div>
          </div>
          <div class="bv" style="font-size:11px;">${fmt(r.ka)} / ${fmt(r.kb)}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ---------- 05 選手比較 ---------- */
function viewPlayerCompare(){
  const a=PLAYER_MAP[STATE.cmpA], b=PLAYER_MAP[STATE.cmpB];
  const sameType=a.posType===b.posType;
  const sa=statsOf(a,STATE.cmpYear), sb=statsOf(b,STATE.cmpYear);
  const cols= a.posType==='B'?BAT_COLS: PIT_COLS;
  const colsB= b.posType==='B'?BAT_COLS: PIT_COLS;
  return `
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">選手比較<span class="tag">HEAD TO HEAD</span></div>
      <div class="panel-desc">2選手のスタッツを並べて比較（異ポジションでも比較可能）</div>
    </div>
    <div class="grid cols-3">
      <div class="field"><label>選手A</label><select id="cmpA">${PLAYERS.map(p=>`<option value="${p.id}" ${STATE.cmpA===p.id?'selected':''}>${esc(p.name)}（${esc(teamOf(p).short)}）</option>`).join('')}</select></div>
      <div class="field"><label>選手B</label><select id="cmpB">${PLAYERS.map(p=>`<option value="${p.id}" ${STATE.cmpB===p.id?'selected':''}>${esc(p.name)}（${esc(teamOf(p).short)}）</option>`).join('')}</select></div>
      <div class="field"><label>年度</label><select id="cmpYear">${YEARS.map(y=>`<option value="${y}" ${STATE.cmpYear===y?'selected':''}>${y}年</option>`).join('')}</select></div>
    </div>
    <div class="compare-vs" style="margin-top:16px;">
      <div class="compare-col"><h4>${esc(a.name)}</h4><div class="sub">${esc(teamOf(a).short)} ・ ${esc(a.posDetail)} ・ ${ageIn(a,STATE.cmpYear)}歳</div>
        ${sa? cols.map(c=>`<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px dashed var(--border);"><span style="color:var(--dim);">${c.l}</span><b style="font-family:var(--mono);color:var(--led-2);">${c.f(sa[c.k],sa)}</b></div>`).join('') : `<p class="wave-note">${STATE.cmpYear}年のデータはありません（規定未到達・MLB在籍など）。</p>`}
      </div>
      <div class="vs-mid">VS</div>
      <div class="compare-col"><h4>${esc(b.name)}</h4><div class="sub">${esc(teamOf(b).short)} ・ ${esc(b.posDetail)} ・ ${ageIn(b,STATE.cmpYear)}歳</div>
        ${sb? colsB.map(c=>`<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px dashed var(--border);"><span style="color:var(--dim);">${c.l}</span><b style="font-family:var(--mono);color:var(--led-2);">${c.f(sb[c.k],sb)}</b></div>`).join('') : `<p class="wave-note">${STATE.cmpYear}年のデータはありません（規定未到達・MLB在籍など）。</p>`}
      </div>
    </div>
    ${(sa && sb && !sameType)?`<p class="wave-note" style="margin-top:12px;">※ 野手と投手の比較のため、各項目はそれぞれの成績体系で表示しています。</p>`:''}
  </div>`;
}

/* ---------- 06 対戦成績 ---------- */
function viewMatchup(){
  const batter=PLAYER_MAP[STATE.mBat], pitcher=PLAYER_MAP[STATE.mPit];
  const m=matchupStats(batter,pitcher);
  const batters=PLAYERS.filter(p=>p.posType==='B');
  const pitchers=PLAYERS.filter(p=>p.posType==='P');
  // チーム別成績（投手からみた対戦チーム打線の被打率イメージ） / 球場別
  const teamSplits=TEAMS.slice(0,6).map(t=>{
    const r=rng(pitcher.id,t.id,'teamsplit');
    const avg=clamp(pitcherAvgBase(pitcher)+ (r()-0.5)*0.08,0.150,0.360);
    return {team:t.short,avg};
  });
  const venueSplits=venueStats(pitcher,STATE.year);
  return `
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">対戦成績<span class="tag">MATCHUP</span></div>
      <div class="panel-desc">投手 VS 打者の通算対戦成績（対戦成績・チーム別被打率・球場別成績はNPBが公表していないため、実際のシーズン成績を基にしたシミュレーション値です）</div>
    </div>
    <div class="grid cols-2">
      <div class="field"><label>打者</label><select id="mBat">${batters.map(p=>`<option value="${p.id}" ${STATE.mBat===p.id?'selected':''}>${esc(p.name)}（${esc(teamOf(p).short)}）</option>`).join('')}</select></div>
      <div class="field"><label>投手</label><select id="mPit">${pitchers.map(p=>`<option value="${p.id}" ${STATE.mPit===p.id?'selected':''}>${esc(p.name)}（${esc(teamOf(p).short)}）</option>`).join('')}</select></div>
    </div>
    <div class="compare-vs" style="margin-top:16px;">
      <div class="compare-col"><h4>${esc(batter.name)}</h4><div class="sub">${esc(teamOf(batter).short)} ・ ${esc(batter.posDetail)}</div></div>
      <div class="vs-mid">VS</div>
      <div class="compare-col"><h4>${esc(pitcher.name)}</h4><div class="sub">${esc(teamOf(pitcher).short)} ・ 投手</div></div>
    </div>
    <div class="info-grid" style="margin-top:16px;">
      <div class="ig"><div class="k">通算打席（打数）</div><div class="v">${m.ab}</div></div>
      <div class="ig"><div class="k">対戦打率</div><div class="v">${avg3(m.avg)}</div></div>
      <div class="ig"><div class="k">安打</div><div class="v">${m.h}</div></div>
      <div class="ig"><div class="k">本塁打</div><div class="v">${m.hr}</div></div>
      <div class="ig"><div class="k">四球</div><div class="v">${m.bb}</div></div>
      <div class="ig"><div class="k">三振</div><div class="v">${m.so}</div></div>
    </div>
  </div>
  <div class="panel">
    <div class="panel-title" style="font-size:16px;">${esc(pitcher.name)} のチーム別 被打率</div>
    <div style="margin-top:10px;">
      ${teamSplits.map(t=>`<div class="bar-row"><div class="bl">${esc(t.team)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,t.avg*280)}%;"></div></div><div class="bv">${avg3(t.avg)}</div></div>`).join('')}
    </div>
  </div>
  <div class="panel">
    <div class="panel-title" style="font-size:16px;">${esc(pitcher.name)} の球場別成績</div>
    <div class="venue-list">
      ${venueSplits.map(v=>`<div class="venue-item"><div class="vn">${esc(v.venue)}${v.isHome?'<span class="home-tag">本拠地</span>':''}</div><div class="vv">防御率 ${dec(v.era,2)}（${v.ip}回）</div></div>`).join('')}
    </div>
  </div>`;
}
function pitcherAvgBase(p){ return clamp(0.290-level(p)*0.065,0.170,0.300); }

/* ======================================================
   PLAYER MODAL
====================================================== */
function openPlayerModal(id){
  STATE.modalPlayer=id;
  STATE.modalTab='career';
  renderModal();
  document.getElementById('modalBackdrop').classList.add('open');
}
function closeModal(){ document.getElementById('modalBackdrop').classList.remove('open'); }
const MODAL_TABS=[
  {id:'career',label:'年度比較'},
  {id:'monthly',label:'月別成績'},
  {id:'venue',label:'球場成績'},
  {id:'farm',label:'二軍成績'}
];
function renderModal(){
  const p=PLAYER_MAP[STATE.modalPlayer];
  if(!p) return;
  const t=teamOf(p);
  const box=document.getElementById('modalBox');
  box.innerHTML=`
    <div class="modal-head">
      <div>
        <div class="modal-name">${esc(p.name)}</div>
        <div class="modal-sub">${esc(t.name)} ・ ${p.uniformNo?'背番号'+esc(p.uniformNo)+' ・ ':''}${esc(p.posDetail)} ・ ${esc(p.bt)} ・ ${p.height?p.height+'cm':'身長非公開'}/${p.weight?p.weight+'kg':'体重非公開'}</div>
      </div>
      <button class="modal-close" id="modalCloseBtn">✕</button>
    </div>
    <div class="modal-body">
      <div class="info-grid">
        <div class="ig"><div class="k">出身校</div><div class="v" style="font-family:var(--body);">${p.school?esc(p.school):'非公開'}</div></div>
        <div class="ig"><div class="k">ドラフト</div><div class="v" style="font-family:var(--body);">${p.draftYear?p.draftYear+'年 '+(p.draftRound?p.draftRound+'位':'（詳細非公開）'):'非公開'}</div></div>
        <div class="ig"><div class="k">年俸</div><div class="v" style="font-family:var(--body);">${man(p.salary)}</div></div>
        <div class="ig"><div class="k">生年</div><div class="v" style="font-family:var(--body);">${p.birthYear}年生まれ</div></div>
      </div>
      ${!p.hasDetailedStats?`<p class="wave-note" style="margin-top:10px;">この選手は背番号・生年月日などの基本情報のみ収録しています（NPB公式ロースターに基づく）。詳細スタッツは実在選手50名分のみ収録しています。</p>`:''}
      ${p.note?`<p class="wave-note" style="margin-top:10px;">${esc(p.note)}</p>`:''}
      <div class="modal-tabs">
        ${MODAL_TABS.map(mt=>`<button class="modal-tab ${STATE.modalTab===mt.id?'active':''}" data-mtab="${mt.id}">${mt.label}</button>`).join('')}
      </div>
      <div id="modalSections"></div>
    </div>`;
  renderModalSections(p);
  box.querySelector('#modalCloseBtn').addEventListener('click',closeModal);
  box.querySelectorAll('.modal-tab').forEach(b=>b.addEventListener('click',()=>{STATE.modalTab=b.dataset.mtab; renderModal();}));
}
function renderModalSections(p){
  const wrap=document.getElementById('modalSections');
  if(STATE.modalTab==='career'){
    if(!p.hasDetailedStats){
      wrap.innerHTML=`<div class="empty-note">この選手の年度別詳細スタッツは未収録です（現在は実在選手50名分のみ収録）。基本情報（背番号・生年月日・身長体重など）は上部をご覧ください。</div>`;
      return;
    }
    const cols=p.posType==='B'?BAT_COLS:PIT_COLS;
    wrap.innerHTML=`<div class="table-scroll"><table class="stat-table">
      <thead><tr><th>年度</th><th>年齢</th>${cols.map(c=>`<th>${c.l}</th>`).join('')}</tr></thead>
      <tbody>${YEARS.map(y=>{
        const s=statsOf(p,y);
        if(!s) return `<tr><td>${y}</td><td>${ageIn(p,y)}</td><td colspan="${cols.length}" style="text-align:left;color:var(--dim);font-family:var(--body);">データなし（規定未到達・MLB在籍など）</td></tr>`;
        return `<tr><td>${y}</td><td>${ageIn(p,y)}</td>${cols.map(c=>`<td>${c.f(s[c.k],s)}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table></div>
      <p class="wave-note">NPB公式個人成績（規定打席・規定投球回に到達したシーズンのみ）。得点圏打率・被打率・QS率はNPBが公表していないため「---」表示です。</p>`;
  } else if(STATE.modalTab==='monthly'){
    const m=monthlyStats(p,STATE.year);
    const isB=p.posType==='B';
    const vals=m.map(x=> isB? x.avg : x.era);
    const meanV=vals.reduce((a,b)=>a+b,0)/vals.length;
    wrap.innerHTML=`
      <div class="month-row">
        ${m.map(x=>{
          const v= isB? x.avg : x.era;
          const cls= isB ? (v>=meanV?'up':'down') : (v<=meanV?'up':'down');
          return `<div class="month-cell ${cls}"><div class="m">${x.month}月</div><div class="v">${isB? avg3(x.avg): dec(x.era,2)}</div></div>`;
        }).join('')}
      </div>
      <p class="wave-note">${STATE.year}年シーズンの月別${isB?'打率':'防御率'}（実際のシーズン成績を基にしたシミュレーション値。NPBは月別成績を公式集計していません）。緑＝好調月、赤＝不調月の目安です。</p>`;
  } else if(STATE.modalTab==='venue'){
    const v=venueStats(p,STATE.year);
    const ha=homeAwaySplit(p,STATE.year);
    const isB=p.posType==='B';
    wrap.innerHTML=`
      <div class="venue-list">
        ${v.map(x=>`<div class="venue-item"><div class="vn">${esc(x.venue)}${x.isHome?'<span class="home-tag">本拠地</span>':''}</div>
          <div class="vv">${isB? `打率 ${avg3(x.avg)}（${x.ab}打数${x.h}安打・本塁打${x.hr}）` : `防御率 ${dec(x.era,2)}（${x.ip}回）`}</div></div>`).join('')}
      </div>
      <div class="grid cols-2" style="margin-top:14px;">
        <div class="ig" style="border:1px solid var(--border);border-radius:8px;padding:10px;"><div class="k" style="color:var(--dim);font-size:10px;">主催試合（ホーム）</div><div class="v" style="font-family:var(--mono);margin-top:3px;">${isB? avg3(ha.home.avg): dec(ha.home.era,2)}</div></div>
        <div class="ig" style="border:1px solid var(--border);border-radius:8px;padding:10px;"><div class="k" style="color:var(--dim);font-size:10px;">ビジター</div><div class="v" style="font-family:var(--mono);margin-top:3px;">${isB? avg3(ha.away.avg): dec(ha.away.era,2)}</div></div>
      </div>
      <p class="wave-note">球場別・ホーム/ビジター成績はNPBが公式集計を公表していないため、実際のシーズン成績を基にしたシミュレーション値です。</p>`;
  } else if(STATE.modalTab==='farm'){
    if(!hasFarmRecord(p,STATE.year)){
      wrap.innerHTML=`<div class="empty-note">${STATE.year}年シーズンの二軍出場記録はありません（一軍に定着したシーズンの可能性があります）。</div>`;
    } else {
      const fs=farmStats(p,STATE.year);
      const isB=p.posType==='B';
      wrap.innerHTML=`<div class="info-grid">
        ${isB?`
        <div class="ig"><div class="k">二軍打率</div><div class="v">${avg3(fs.avg)}</div></div>
        <div class="ig"><div class="k">打数</div><div class="v">${fs.ab}</div></div>
        <div class="ig"><div class="k">安打</div><div class="v">${fs.h}</div></div>
        <div class="ig"><div class="k">本塁打</div><div class="v">${fs.hr}</div></div>`:`
        <div class="ig"><div class="k">二軍防御率</div><div class="v">${dec(fs.era,2)}</div></div>
        <div class="ig"><div class="k">投球回</div><div class="v">${fs.ip}</div></div>
        <div class="ig"><div class="k">奪三振</div><div class="v">${fs.so}</div></div>`}
      </div>
      <p class="wave-note">イースタン/ウエスタン・リーグの二軍成績はNPB.jpで個別集計が公開されていないため、シミュレーション値です。若手・調整中の選手を見極める参考としてご利用ください。</p>`;
    }
  }
}

/* ======================================================
   BIND EVENTS PER VIEW
====================================================== */
function bindView(){
  // player card / row / bar clicks -> open modal
  document.querySelectorAll('[data-pid]').forEach(el=>{
    el.addEventListener('click',()=>openPlayerModal(el.dataset.pid));
  });

  if(STATE.tab==='search'){
    const $=id=>document.getElementById(id);
    $('btnSearch').addEventListener('click',()=>{
      STATE.searchFilters.name=$('f_name').value.trim();
      STATE.searchFilters.team=$('f_team').value;
      STATE.searchFilters.pos=$('f_pos').value;
      STATE.searchFilters.school=$('f_school').value;
      STATE.searchFilters.draftRound=$('f_draft').value;
      STATE.searchFilters.salaryMax=Number($('f_salary').value);
      STATE.searchFilters.detailedOnly=$('f_detailed').value;
      STATE.year=Number($('f_year').value);
      renderApp();
    });
    $('btnReset').addEventListener('click',()=>{
      STATE.searchFilters={name:'',team:'',pos:'',school:'',draftRound:'',salaryMax:70000,detailedOnly:''};
      renderApp();
    });
    $('f_salary').addEventListener('input',()=>{ $('salaryLabel').textContent=man(Number($('f_salary').value)); });
    $('f_name').addEventListener('keydown',e=>{ if(e.key==='Enter'){ $('btnSearch').click(); } });
  }

  if(STATE.tab==='stats'){
    document.querySelectorAll('[data-list-type]').forEach(b=>b.addEventListener('click',()=>{
      STATE.listType=b.dataset.listType; STATE.sortKey=null; renderApp();
    }));
    document.getElementById('statsYear').addEventListener('change',e=>{ STATE.listYear=Number(e.target.value); renderApp(); });
    document.querySelectorAll('[data-sort]').forEach(th=>th.addEventListener('click',()=>{
      const k=th.dataset.sort;
      if(STATE.sortKey===k){ STATE.sortDir*=-1; } else { STATE.sortKey=k; STATE.sortDir=-1; }
      renderApp();
    }));
  }

  if(STATE.tab==='ranking'){
    document.getElementById('rankCat').addEventListener('change',e=>{ STATE.rankCategory=e.target.value; renderApp(); });
    document.getElementById('rankYear').addEventListener('change',e=>{ STATE.rankYear=Number(e.target.value); renderApp(); });
  }

  if(STATE.tab==='teamcmp'){
    document.getElementById('teamA').addEventListener('change',e=>{ STATE.teamA=e.target.value; renderApp(); });
    document.getElementById('teamB').addEventListener('change',e=>{ STATE.teamB=e.target.value; renderApp(); });
    document.getElementById('teamYear').addEventListener('change',e=>{ STATE.teamYear=Number(e.target.value); renderApp(); });
  }

  if(STATE.tab==='playercmp'){
    document.getElementById('cmpA').addEventListener('change',e=>{ STATE.cmpA=e.target.value; renderApp(); });
    document.getElementById('cmpB').addEventListener('change',e=>{ STATE.cmpB=e.target.value; renderApp(); });
    document.getElementById('cmpYear').addEventListener('change',e=>{ STATE.cmpYear=Number(e.target.value); renderApp(); });
  }

  if(STATE.tab==='matchup'){
    document.getElementById('mBat').addEventListener('change',e=>{ STATE.mBat=e.target.value; renderApp(); });
    document.getElementById('mPit').addEventListener('change',e=>{ STATE.mPit=e.target.value; renderApp(); });
  }
}

/* ======================================================
   INIT
====================================================== */
document.getElementById('modalBackdrop').addEventListener('click',e=>{
  if(e.target.id==='modalBackdrop') closeModal();
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModal(); });

renderHeroStats();
renderApp();

