/* =========================================================================
   CONFIG — edit this block to match your api_server.py
   ========================================================================= */
const CONFIG = {
  API_BASE_URL: 'http://127.0.0.1:8000/',
  STATUS_PATH: '/api/status',
  POLL_INTERVAL_MS: 2000,
  OFFLINE_AFTER_MS: 8000,
  FETCH_TIMEOUT_MS: 4000,
  LABELS: { videoEngine: 'Video Classifier', audioEngine: 'Audio Output Classifier' },
};

function normalizeLabel(value){
  if (value == null) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (['normal','clear','stable','none','nominal','safe'].some(k => text.includes(k))) return 'normal';
  if (['hazard','danger','threat','alarm','warning'].some(k => text.includes(k))) return 'hazard';
  if (['distress','panic','scream','urgent'].some(k => text.includes(k))) return 'distress';
  return text.replace(/[^a-z0-9]+/g, '_');
}

function collectScoreMap(source){
  const scores = {};
  const walk = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, val]) => {
        const label = normalizeLabel(key);
        if (label) {
          const num = Number(val);
          if (Number.isFinite(num)) scores[label] = num;
        }
        walk(val);
      });
    }
  };
  walk(source);
  return scores;
}

function pickAudioLabel(raw, audioSource){
  const scoreMap = collectScoreMap(audioSource);
  if (Object.keys(scoreMap).length) {
    const entries = Object.entries(scoreMap).filter(([, score]) => Number.isFinite(score));
    if (entries.length) {
      const [bestLabel] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best), entries[0]);
      return bestLabel;
    }
  }

  const directSources = [
    raw?.audio_output,
    raw?.audioOutput,
    raw?.audio_output_data,
    raw?.audio_data,
    raw?.audio,
    raw?.result,
    raw?.data,
    raw?.output,
    raw?.classification,
    raw?.label,
    raw?.audio_classification,
    raw?.audio_label,
  ];

  for (const candidate of directSources) {
    if (candidate == null) continue;
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const label = normalizeLabel(candidate);
      if (label) return label;
    }
    if (typeof candidate === 'object') {
      const nested = candidate.classification ?? candidate.class ?? candidate.label ?? candidate.output ?? candidate.status;
      if (nested != null) {
        const label = normalizeLabel(nested);
        if (label) return label;
      }
    }
  }

  return 'unknown';
}

function pickAudioConfidence(raw, audioSource, label){
  const scoreMap = collectScoreMap(audioSource);
  if (label && Number.isFinite(scoreMap[label])) return scoreMap[label];

  const directSources = [
    raw?.audio_confidence,
    raw?.audio_conf,
    raw?.confidence,
    raw?.score,
    raw?.audio?.confidence,
    raw?.audio?.score,
    raw?.audio_output?.confidence,
    raw?.audio_output_data?.confidence,
    raw?.audio_output?.score,
    raw?.audio_output_data?.score,
  ];

  for (const candidate of directSources) {
    const num = Number(candidate);
    if (Number.isFinite(num)) return Math.max(0, Math.min(1, num));
  }

  return null;
}

function mapResponse(raw) {
  const statusLike = raw && (raw.prediction || raw.confidence || raw.microphone || raw.listening || raw.status || raw.today);
  if (statusLike) {
    const audioLabel = normalizeLabel(raw.prediction ?? raw.audio_prediction ?? raw.classification ?? raw.label ?? raw.audio_output ?? raw.output ?? raw.audio ?? raw.result);
    const audioConfidence = numOrNull(raw.confidence ?? raw.audio_confidence ?? raw.score ?? raw.audio_score);
    return {
      nodeId: raw.node_id ?? raw.node ?? raw.device_id ?? raw.id ?? '—',
      timestamp: raw.timestamp ?? Date.now(),
      video: {
        label: 'unavailable',
        confidence: null,
        updatedAt: Date.now(),
      },
      audio: {
        label: audioLabel ?? 'unknown',
        confidence: audioConfidence,
        updatedAt: toMs(raw.timestamp ?? Date.now()),
      },
    };
  }

  const video = raw.video || raw.video_data || {};
  const audioSource = raw.audio || raw.audio_output || raw.audio_output_data || raw.audio_data || raw.output || raw.data || raw.result || raw;
  const audioLabel = pickAudioLabel(raw, audioSource);
  return {
    nodeId: raw.node_id ?? raw.device_id ?? raw.node ?? raw.id ?? '—',
    timestamp: raw.timestamp ?? Date.now(),
    video: {
      label: normalizeLabel(video.classification ?? video.class ?? video.label ?? raw.video_class ?? raw.video_label ?? raw.video_status ?? raw.video_output ?? 'unknown') ?? 'unknown',
      confidence: numOrNull(video.confidence ?? raw.video_confidence ?? raw.video_score),
      updatedAt: toMs(video.timestamp ?? raw.video_timestamp ?? raw.timestamp),
    },
    audio: {
      label: audioLabel,
      confidence: pickAudioConfidence(raw, audioSource, audioLabel),
      updatedAt: toMs(raw.audio_timestamp ?? raw.timestamp),
    },
  };
}
function numOrNull(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
function toMs(v){
  if (v == null) return Date.now();
  const n = Number(v);
  if (!Number.isFinite(n)) return Date.now();
  return n < 2e10 ? n * 1000 : n;
}

function severityOf(label){
  if (!label) return 'offline';
  const l = String(label).toLowerCase();
  if (['normal','clear','stable','none','nominal','no_'].some(k => l.includes(k))) return 'safe';
  if (['fire','critical','danger','distress','hazard','scream'].some(k => l.includes(k))) return 'critical';
  if (['fall','warn','caution','down','anomaly'].some(k => l.includes(k))) return 'warn';
  return 'warn';
}
function prettyLabel(label){
  if (!label) return 'UNKNOWN';
  return String(label).replace(/_/g,' ').toUpperCase();
}

const els = id => document.getElementById(id);
let lastVideoLabel = null, lastAudioLabel = null, lastPollOk = 0, eventCount = 0;

function buildWave(){
  const wave = els('wave');
  wave.innerHTML = '';
  for (let i=0;i<24;i++){
    const s = document.createElement('span');
    s.style.animationDelay = (Math.random()*1.1).toFixed(2)+'s';
    s.style.animationDuration = (0.8+Math.random()*0.7).toFixed(2)+'s';
    wave.appendChild(s);
  }
}
buildWave();

function setCard(prefix, data, connected){
  const sev = connected ? severityOf(data.label) : 'offline';
  els(prefix+'Pill').textContent = connected ? sev.toUpperCase() : 'OFFLINE';
  els(prefix+'Pill').className = 'pill ' + sev;
  els(prefix+'Label').textContent = connected ? prettyLabel(data.label) : 'NO SIGNAL';
  els(prefix+'Label').className = 'label-lg ' + sev;
  els(prefix+'Sub').textContent = connected
    ? (sev === 'safe' ? 'No anomalies in current window' : 'Review recommended')
    : 'Awaiting data from sentry node';
  els(prefix+'ConfNum').textContent = (connected && data.confidence != null) ? Math.round(data.confidence*100)+'%' : '—';
  els(prefix+'ConfBar').style.width = (connected && data.confidence != null) ? Math.round(data.confidence*100)+'%' : '0%';
  els(prefix+'Updated').textContent = connected ? ('updated '+formatAgo(data.updatedAt)) : 'updated —';
  els(prefix+'RingCore').style.color = 'var(--'+(sev==='offline' ? (prefix==='video'?'video':'audio') : sev)+')';

  if (prefix === 'audio') {
    els('wave').classList.toggle('alert', connected && sev === 'critical');
  }
}

function setBanner(connected, video, audio){
  const banner = els('banner');
  let sev = 'safe', title = 'All systems normal', sub = 'Video and audio channels nominal.';
  if (!connected){
    sev = 'offline'; title = 'Sentry node offline'; sub = 'No response from the API within the expected window.';
  } else if (severityOf(video.label) === 'critical'){
    sev='critical'; title='Critical: '+prettyLabel(video.label); sub='Video model flagged a critical event.';
  } else if (severityOf(audio.label) === 'critical'){
    sev='critical'; title='Critical: '+prettyLabel(audio.label); sub='Audio model flagged a critical event.';
  } else if (severityOf(video.label) === 'warn'){
    sev='warn'; title='Attention: '+prettyLabel(video.label); sub='Video model flagged a caution-level event.';
  } else if (severityOf(audio.label) === 'warn'){
    sev='warn'; title='Attention: '+prettyLabel(audio.label); sub='Audio model flagged a caution-level event.';
  }
  banner.className = 'banner ' + sev;
  els('bannerTitle').textContent = title;
  els('bannerSub').textContent = sub;
  const iconPaths = {
    safe: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
    warn: '<path d="M12 8v4M12 16h.01M10.3 3.86l-8.2 14.2A1.5 1.5 0 0 0 3.5 20h17a1.5 1.5 0 0 0 1.4-1.94L13.7 3.86a1.5 1.5 0 0 0-2.4 0Z"/>',
    critical: '<path d="M12 8v4M12 16h.01M10.3 3.86l-8.2 14.2A1.5 1.5 0 0 0 3.5 20h17a1.5 1.5 0 0 0 1.4-1.94L13.7 3.86a1.5 1.5 0 0 0-2.4 0Z"/>',
    offline: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  };
  els('bannerIcon').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[sev]+'</svg>';
}

function pushEvent(source, label){
  const sev = severityOf(label);
  els('eventsEmpty')?.remove();
  const row = document.createElement('div');
  row.className = 'event-row ' + sev;
  row.innerHTML = `
    <div class="event-src ${source}">${source === 'video'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>'}</div>
    <div class="event-msg">${source === 'video' ? 'Video' : 'Audio'} model → ${prettyLabel(label)}</div>
    <div class="event-time">${new Date().toLocaleTimeString()}</div>`;
  els('eventsList').prepend(row);
  eventCount++;
  els('eventsMeta').textContent = eventCount + ' logged';
  const rows = els('eventsList').children;
  if (rows.length > 30) els('eventsList').removeChild(rows[rows.length-1]);
}

function formatAgo(ms){
  const s = Math.max(0, Math.round((Date.now()-ms)/1000));
  if (s < 2) return 'just now';
  if (s < 60) return s+'s ago';
  const m = Math.floor(s/60);
  return m+'m ago';
}

let isDemo = false, demoTimer = null;

async function poll(){
  if (isDemo) return;
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), CONFIG.FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(CONFIG.API_BASE_URL + CONFIG.STATUS_PATH, {signal: ctrl.signal});
    clearTimeout(t);
    if (!res.ok) throw new Error('bad status');
    const raw = await res.json();
    lastPollOk = Date.now();
    render(mapResponse(raw), true);
  } catch (e) {
    clearTimeout(t);
    render(null, (Date.now()-lastPollOk) < CONFIG.OFFLINE_AFTER_MS);
  }
}

function render(data, connected){
  els('connDot').className = 'conn-dot ' + (connected ? 'live' : 'down');
  els('connText').textContent = connected ? 'Live' : 'Reconnecting…';
  els('demoBtn').style.display = connected ? 'none' : 'inline-block';
  els('bannerTime').style.display = connected ? 'block' : 'none';

  const video = data ? data.video : {label:null, confidence:null, updatedAt:null};
  const audio = data ? data.audio : {label:null, confidence:null, updatedAt:null};

  setCard('video', video, connected);
  setCard('audio', audio, connected);
  setBanner(connected, video, audio);

  els('videoEngine').textContent = CONFIG.LABELS.videoEngine;
  els('audioEngine').textContent = CONFIG.LABELS.audioEngine;
  if (data && data.nodeId) els('nodeId').textContent = data.nodeId;
  if (connected) els('bannerTime').textContent = 'as of ' + new Date().toLocaleTimeString();

  if (connected){
    if (video.label && video.label !== lastVideoLabel){ if (lastVideoLabel !== null) pushEvent('video', video.label); lastVideoLabel = video.label; }
    if (audio.label && audio.label !== lastAudioLabel){ if (lastAudioLabel !== null) pushEvent('audio', audio.label); lastAudioLabel = audio.label; }
  }
}

const DEMO_STATES = [
  {node_id:'pi5-ward-a', video:{classification:'normal', confidence:0.97}, audio:{classification:'normal', confidence:0.94}},
  {node_id:'pi5-ward-a', video:{classification:'normal', confidence:0.95}, audio:{classification:'normal', confidence:0.90}},
  {node_id:'pi5-ward-a', video:{classification:'fall_detected', confidence:0.88}, audio:{classification:'normal', confidence:0.91}},
  {node_id:'pi5-ward-a', video:{classification:'fire', confidence:0.93}, audio:{classification:'distress', confidence:0.86}},
  {node_id:'pi5-ward-a', video:{classification:'normal', confidence:0.96}, audio:{classification:'distress', confidence:0.82}},
  {node_id:'pi5-ward-a', video:{classification:'normal', confidence:0.98}, audio:{classification:'normal', confidence:0.93}},
];
function startDemo(){
  isDemo = true; els('demoBtn').textContent = 'Stop demo preview';
  let i = 0;
  const step = () => { render(mapResponse(DEMO_STATES[i % DEMO_STATES.length]), true); i++; };
  step();
  demoTimer = setInterval(step, 3200);
}
function stopDemo(){
  isDemo = false; els('demoBtn').textContent = 'Preview with demo data';
  if (demoTimer) clearInterval(demoTimer);
  lastPollOk = 0; lastVideoLabel = null; lastAudioLabel = null;
  render(null, false);
}
els('demoBtn').addEventListener('click', () => { isDemo ? stopDemo() : startDemo(); });

setInterval(() => { els('clock').textContent = new Date().toLocaleTimeString(); }, 1000);

els('apiUrlText').textContent = CONFIG.API_BASE_URL + CONFIG.STATUS_PATH;
els('pollText').textContent = (CONFIG.POLL_INTERVAL_MS/1000) + 's';

render(null, false);
poll();
setInterval(poll, CONFIG.POLL_INTERVAL_MS);
