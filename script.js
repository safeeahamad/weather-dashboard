
const API_KEY = 'c4db9dadbb424f83a3352838252911';
const BASE_CURR = 'https://api.weatherapi.com/v1';
let lastData = null;
let fxEnabled = true;

const $ = id => document.getElementById(id);
const el = (tag, props={}) => Object.assign(document.createElement(tag), props);

const defaultCity = 'Delhi india';

document.addEventListener('DOMContentLoaded',()=>{
  $('searchBtn').addEventListener('click', ()=> fetchAndRender($('cityInput').value || defaultCity));
  $('cityInput').addEventListener('keyup',e=>{ if(e.key==='Enter') $('searchBtn').click() });
  $('modeToggle').addEventListener('click', toggleMode);
  $('locBtn').addEventListener('click', useGeo);
  $('downloadBtn').addEventListener('click', ()=> {
    if(!lastData) return alert('No data yet');
    const blob = new Blob([JSON.stringify(lastData, null, 2)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='weather.json'; a.click();
  });

  $('cityInput').value = defaultCity;
  fetchAndRender(defaultCity);
});

async function fetchAndRender(q){
  try{
    const url = `${BASE_CURR}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(q)}&days=3&aqi=yes&alerts=no`;
    const res = await fetch(url);
    const data = await res.json();
    if(data.error){ alert(data.error.message || 'API error'); return; }
    lastData = data;
    renderAll(data);
  } catch(err){
    console.error(err); alert('Network error fetching weather');
  }
}

function renderAll(data){
  $('locLine').innerText = `${data.location.name}, ${data.location.region || data.location.country}`;
  $('localTime').innerText = `Local: ${data.location.localtime}`;
  const cur = data.current;
  $('tempMain').innerText = `${cur.temp_c.toFixed(1)}°C`;
  $('feelsText').innerText = `Feels: ${cur.feelslike_c.toFixed(1)}°C`;
  $('conditionText').innerText = cur.condition.text;
  $('windShort').innerText = `Wind: ${cur.wind_kph} kph ${cur.wind_dir}`;
  $('humidityVal').innerText = cur.humidity + '%';
  $('cloudVal').innerText = cur.cloud + '%';
  $('uvVal').innerText = cur.uv;
  $('pressureVal').innerText = cur.pressure_mb + ' hPa';
  $('visVal').innerText = cur.vis_km + ' km';
  $('precipVal').innerText = cur.precip_mm + ' mm';
  $('gustVal').innerText = `Gust: ${cur.gust_kph} kph`;
  $('lastUpdated').innerText = `Updated: ${cur.last_updated}`;
  $('condShort').innerText = cur.condition.text;
  renderSVGIcon('miniIcon', cur.condition.code, cur.is_day);

  renderSVGIcon('mainIcon', cur.condition.code, cur.is_day, {size:100});

  const aqi = data.current.air_quality || {};
  renderAQIGauge('aqiGauge', aqi);
  renderCompass('windCompass', cur.wind_degree || 0);

  renderForecast(data.forecast.forecastday);

  const hours = makeHourlySeries(data);
  drawHourlyChart('hourlyChart', hours);

  setEffectsForCondition(cur.condition.text.toLowerCase());
}

function makeHourlySeries(data){
  const nowLocal = new Date(data.location.localtime.replace(' ','T'));
  let hrs = [];
  data.forecast.forecastday.forEach(day => {
    day.hour.forEach(h => hrs.push({
      time: h.time, temp: h.temp_c, humidity: h.humidity, iconCode: h.condition.code
    }));
  });
  hrs.sort((a,b)=> new Date(a.time) - new Date(b.time));
  const idx = hrs.findIndex(h => new Date(h.time) >= nowLocal);
  const slice = idx>=0 ? hrs.slice(idx, idx+24) : hrs.slice(0,24);
  return slice;
}


function renderForecast(arr){
  const wrap = $('forecastWrap');
  wrap.innerHTML = '';
  arr.forEach(day=>{
    const dBox = el('div',{className:'day'});
    const date = new Date(day.date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    dBox.innerHTML = `
      <div style="font-weight:700">${date}</div>
      <div style="margin:8px 0"><div class="small-icon" id=""></div></div>
      <div style="font-size:14px">${day.day.condition.text}</div>
      <div style="margin-top:8px;font-weight:700">${day.day.maxtemp_c.toFixed(1)}° / ${day.day.mintemp_c.toFixed(1)}°</div>
      <div style="font-size:12px;margin-top:6px;opacity:0.85">Chance precip: ${day.day.daily_chance_of_rain || 0}%</div>
    `;
    wrap.appendChild(dBox);
    const innerIcon = dBox.querySelector('.small-icon');
    renderSVGIconElement(innerIcon, day.day.condition.code, 1);
  });
}


function drawHourlyChart(canvasId, hours){
  const canvas = $(canvasId);
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const w = canvas.clientWidth, h = canvas.clientHeight;
  const padding = {l:40, r:10, t:24, b:36};
  const gw = w - padding.l - padding.r, gh = h - padding.t - padding.b;

  const temps = hours.map(h=>h.temp);
  const hums = hours.map(h=>h.humidity);
  const labels = hours.map(h=> new Date(h.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));

  const tMax = Math.max(...temps)+2;
  const tMin = Math.min(...temps)-2;

  ctx.clearRect(0,0,w,h);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.l, padding.t);
  ctx.lineTo(padding.l, padding.t+gh);
  ctx.lineTo(padding.l+gw, padding.t+gh);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  temps.forEach((val,i)=>{
    const x = padding.l + (i/(temps.length-1))*gw;
    const y = padding.t + ((tMax - val)/(tMax - tMin))*gh;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.strokeStyle = 'rgba(255,180,80,0.95)';
  ctx.lineWidth=2.5; ctx.stroke();

  const grad = ctx.createLinearGradient(0,padding.t,0,padding.t+gh);
  grad.addColorStop(0,'rgba(255,180,80,0.22)');
  grad.addColorStop(1,'rgba(255,180,80,0.03)');
  ctx.lineTo(padding.l+gw, padding.t+gh); ctx.lineTo(padding.l, padding.t+gh); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.restore();

  const barW = Math.max(6, gw / temps.length * 0.6);
  hums.forEach((val,i)=>{
    const x = padding.l + (i/(temps.length-1))*gw - barW/2;
    const barH = (val/100)*gh;
    const y = padding.t + gh - barH;
    ctx.fillStyle = 'rgba(100,180,255,0.22)';
    ctx.fillRect(x, y, barW, barH);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px Inter, sans-serif';

  labels.forEach((lab,i)=>{
    if(i%3===0){
      const x = padding.l + (i/(labels.length-1))*gw;
      ctx.fillText(lab, x-18, padding.t+gh+18);
    }
  });

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px Inter, sans-serif';
  const ticks = 4;
  for(let i=0;i<=ticks;i++){
    const val = (tMin + (i/ticks)*(tMax-tMin));
    const y = padding.t + ((tMax - val)/(tMax - tMin))*gh;
    ctx.fillText(val.toFixed(0)+'°', 6, y+4);
  }

  ctx.fillStyle = 'rgba(255,180,80,0.95)'; ctx.fillRect(w-110,8,10,6);
  ctx.fillStyle = 'rgba(100,180,255,0.85)'; ctx.fillRect(w-110,26,10,6);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText('Temp', w-92, 14); ctx.fillText('Humidity', w-92, 34);
}


function renderAQIGauge(svgId, aqi){
  const svg = $(svgId);
  svg.innerHTML = '';
  const val = (aqi && (aqi.pm2_5 || aqi.pm10 || aqi.co)) ? Math.round((aqi.pm2_5 || aqi.pm10 || 0)) : 0;
  const size = 100; const cx = 50, cy = 60, r = 30;

  svg.innerHTML = `
    <defs>
      <linearGradient id="g1" x1="0" x2="1">
        <stop offset="0" stop-color="#4caf50"/>
        <stop offset="0.5" stop-color="#ffeb3b"/>
        <stop offset="1" stop-color="#f44336"/>
      </linearGradient>
    </defs>
    <text x="50" y="18" text-anchor="middle" font-size="11" fill="currentColor">AQI</text>
    <path d="${describeArc(cx,cy,r, -140, 40)}" stroke="#222" stroke-width="10" fill="none" opacity="0.18"/>
    <path id="gaugeArc" d="${describeArc(cx,cy,r, -140, -140 + ((val>300?300:val)/300)*180)}" stroke="url(#g1)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <text x="50" y="70" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor">${val}</text>
    <text x="50" y="86" text-anchor="middle" font-size="10" fill="currentColor">PM2.5</text>
  `;
}

function polarToCartesian(cx,cy,r,angle){
  const a = (angle-90) * Math.PI/180.0;
  return {x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a))};
}
function describeArc(cx,cy,r,startAngle,endAngle){
  const start = polarToCartesian(cx,cy,r,endAngle);
  const end = polarToCartesian(cx,cy,r,startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", r, r, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}


function renderCompass(svgId, deg){
  const svg = $(svgId);
  svg.innerHTML = `
    <circle cx="50" cy="50" r="40" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)"/>
    <g transform="translate(50 50) rotate(${deg})">
      <path d="M0,-30 L8,0 L0,-10 L-8,0 Z" fill="${getComputedStyle(document.body).color ? 'white' : 'white'}"/>
    </g>
    <text x="50" y="92" text-anchor="middle" font-size="10" fill="currentColor">Wind °</text>
  `;
}


function renderSVGIcon(containerId, code, is_day, opts={}){
  const elc = $(containerId);
  if(!elc) return;
  elc.innerHTML = '';
  renderSVGIconElement(elc, code, is_day, opts);
}
function renderSVGIconElement(parentEl, code, is_day=1, opts={}){
  
  const rainCodes = [365, 356, 293, 302, 308, 311, 314];
  const snowCodes = [371, 335, 332, 338, 350];
  const thunderCodes = [200, 201, 202, 210, 211, 212, 221, 230, 231, 232];
  const fogCodes = [1135, 1147];
  let type='sun';
  if(thunderCodes.includes(code)) type='thunder';
  else if(rainCodes.includes(code) || (code>=300 && code<532)) type='rain';
  else if(snowCodes.includes(code) || (code>=600 && code<700)) type='snow';
  else if(fogCodes.includes(code)) type='fog';
  else if(code===1000 || code===1003 || code===1006 || code===1009) {
    if(code===1000 && is_day) type='sun';
    else if(code===1003) type='partly';
    else if(code===1006) type='cloud';
    else type='cloud';
  } else if(code>=1000) type='sun';

  const size = opts.size || 48;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 64 64');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.style.display='block';

  if(type==='sun'){
    svg.innerHTML = `
      <g>
        <circle cx="32" cy="26" r="10" fill="url(#sg)" />
        <g stroke="rgba(0,0,0,0.06)" stroke-width="2">
          <line x1="32" y1="6" x2="32" y2="0" stroke="rgba(255,255,255,0.6)"/>
        </g>
      </g>
      <defs><radialGradient id="sg"><stop offset="0" stop-color="#fff7c2"/><stop offset="1" stop-color="#ffd27a"/></radialGradient></defs>
    `;
  } else if(type==='partly'){
    svg.innerHTML = `
      <g>
        <ellipse cx="28" cy="30" rx="12" ry="8" fill="rgba(255,255,255,0.92)"/>
        <g transform="translate(6,2)"><circle cx="36" cy="18" r="8" fill="#fff7c2"/></g>
      </g>
    `;
  } else if(type==='cloud'){
    svg.innerHTML = `
      <g fill="rgba(255,255,255,0.9)">
        <ellipse cx="28" cy="34" rx="12" ry="8"/>
        <ellipse cx="38" cy="30" rx="10" ry="7"/>
        <ellipse cx="20" cy="32" rx="8" ry="6"/>
      </g>
    `;
  } else if(type==='rain' || type==='thunder'){
    svg.innerHTML = `
      <g fill="rgba(255,255,255,0.94)">
        <ellipse cx="28" cy="28" rx="12" ry="8"/>
        <ellipse cx="38" cy="24" rx="10" ry="7"/>
      </g>
      <g id="raindrops"></g>
    `;

    for(let i=0;i<6;i++){
      const d = document.createElementNS(ns,'path');
      const x = 14 + i*6;
      d.setAttribute('d', `M${x} 40 q2 6 4 0`); 
      d.setAttribute('stroke','rgba(173,216,230,0.9)');
      d.setAttribute('stroke-width','2');
      d.setAttribute('fill','none');
      d.style.opacity = 0.9;
      svg.querySelector('#raindrops').appendChild(d);

      d.animate([
        {transform:'translateY(-2px)', opacity:1},
        {transform:'translateY(8px)', opacity:0.1}
      ], {duration:800 + i*80, iterations:Infinity, delay: i*60});
    }
  } else if(type==='snow'){
    svg.innerHTML = `
      <g fill="rgba(255,255,255,0.95)">
        <ellipse cx="28" cy="28" rx="12" ry="8"/>
        <ellipse cx="38" cy="24" rx="10" ry="7"/>
      </g>
      <g id="snows"></g>
    `;
    for(let i=0;i<6;i++){
      const s = document.createElementNS(ns,'text');
      s.setAttribute('x', 12 + i*6);
      s.setAttribute('y', 42);
      s.setAttribute('font-size', '10');
      s.setAttribute('fill', 'rgba(255,255,255,0.95)');
      s.textContent = '❄';
      svg.querySelector('#snows').appendChild(s);
      s.animate([
        {transform:'translateY(0)', opacity:1},
        {transform:'translateY(8px)', opacity:0.2}
      ], {duration:1400 + i*120, iterations:Infinity, delay:i*60});
    }
  } else if(type==='fog'){
    svg.innerHTML = `
      <g fill="rgba(255,255,255,0.85)">
        <rect x="10" y="30" width="44" height="6" rx="3"/>
        <rect x="6" y="38" width="52" height="6" rx="3"/>
      </g>
    `;
  }

  parentEl.innerHTML = '';
  parentEl.appendChild(svg);
}


const fxCanvas = $('fxCanvas');
const fxCtx = fxCanvas.getContext('2d');
let particles = [];
let fxType = 'none';
let lastFrame = 0;

function resizeFX(){
  fxCanvas.width = innerWidth * devicePixelRatio;
  fxCanvas.height = innerHeight * devicePixelRatio;
  fxCanvas.style.width = innerWidth + 'px';
  fxCanvas.style.height = innerHeight + 'px';
  fxCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
addEventListener('resize', resizeFX);
resizeFX();


function setEffectsForCondition(cond){
  cond = cond.toLowerCase();
  if(cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle')) setFX('rain');
  else if(cond.includes('snow') || cond.includes('sleet') ) setFX('snow');
  else if(cond.includes('storm') || cond.includes('thunder')) setFX('storm');
  else if(cond.includes('fog') || cond.includes('mist')) setFX('fog');
  else if(cond.includes('cloud') || cond.includes('overcast')) setFX('cloud');
  else setFX('none');
}

function setFX(type){
  fxType = type;
  particles = [];
  if(type==='rain'){
    for(let i=0;i<220;i++) particles.push(makeDrop());
  } else if(type==='snow'){
    for(let i=0;i<160;i++) particles.push(makeSnow());
  } else if(type==='cloud'){
    for(let i=0;i<18;i++) particles.push(makeCloud());
  } else if(type==='storm'){
    for(let i=0;i<260;i++) particles.push(makeDrop());
  } else {
    particles = [];
  }
}

function makeDrop(){ return {x: Math.random()*innerWidth, y: Math.random()*-innerHeight, vy: 6+Math.random()*8, len: 8+Math.random()*10, alpha:0.6+Math.random()*0.4}; }
function makeSnow(){ return {x: Math.random()*innerWidth, y: Math.random()*-innerHeight, vy: 0.4+Math.random()*1.2, r:1+Math.random()*2, vx: -0.5+Math.random()*1}; }
function makeCloud(){ return {x: Math.random()*innerWidth, y: Math.random()*innerHeight*0.2, scale:0.6+Math.random()*1.2, vx:0.2+Math.random()*0.6}; }



function useGeo(){
  if(!navigator.geolocation) return alert('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude, longitude} = pos.coords;
    fetchAndRender(`${latitude},${longitude}`);
  }, err => alert('Location access denied'));
}


function setThemeForCondition(cond){
  cond = cond.toLowerCase();
  const body = document.body;
  if(cond.includes('rain') || cond.includes('shower')){
    body.style.background = 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)';
  } else if(cond.includes('snow')){
    body.style.background = 'linear-gradient(135deg,#e6f0ff,#cfe9ff)';
  } else if(cond.includes('clear') || cond.includes('sun')){
    body.style.background = 'linear-gradient(135deg,#fff9c4,#ffd27a)';
    body.style.color='black';
  } else if(cond.includes('cloud')){
    body.style.background = 'linear-gradient(135deg,#304352,#d7d2cc)';
  } else {
    body.style.background = '';
  }
}


let lightMode = false;
function toggleMode(){
  lightMode = !lightMode;
  if(lightMode) document.documentElement.classList.add('light'), document.body.classList.add('light');
  else document.documentElement.classList.remove('light'), document.body.classList.remove('light');
}


function setEffectsForCondition(cond){
  setThemeForCondition(cond);
  if(cond.includes('rain') || cond.includes('drizzle')) setFX('rain');
  else if(cond.includes('snow') || cond.includes('sleet')) setFX('snow');
  else if(cond.includes('storm') || cond.includes('thunder')) setFX('storm');
  else if(cond.includes('cloud') || cond.includes('overcast')) setFX('cloud');
  else if(cond.includes('fog') || cond.includes('mist') ) setFX('fog');
  else setFX('none');
}

