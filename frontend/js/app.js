const API_BASE = "http://localhost:8000";

// Elements
const customCursor = document.getElementById('custom-cursor');
const cursorRing = document.getElementById('cursor-ring');
const landingView = document.getElementById('landing-view');
const appShell = document.getElementById('app-shell');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileStatus = document.getElementById('file-status');
const fileMeta = document.getElementById('file-meta');
const aiInsights = document.getElementById('ai-insights');
const chartsContainer = document.getElementById('charts-container');
const statRows = document.getElementById('stat-rows');
const statCols = document.getElementById('stat-cols');

document.addEventListener('DOMContentLoaded', () => {
    initCursor();
    initAnimations();
    initNebula();
    initNavigation();
    initParticles();
});

function initParticles() {
    const container = document.getElementById('particle-container');
    const count = 50;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 2 + 1;
        Object.assign(p.style, {
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            background: '#fff',
            borderRadius: '50%',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.5
        });
        container.appendChild(p);
        gsap.to(p, {
            y: `+=${Math.random() * 200 - 100}`,
            x: `+=${Math.random() * 200 - 100}`,
            opacity: 0,
            duration: Math.random() * 3 + 2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        });
    }
}


// --- AMBIENCE ---
function initNebula() {
    gsap.to(".glow-1", { x: "20vw", y: "10vh", duration: 15, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".glow-2", { x: "-10vw", y: "-20vh", duration: 20, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".glow-3", { x: "10vw", y: "5vh", duration: 12, repeat: -1, yoyo: true, ease: "sine.inOut" });
}

function initCursor() {
    document.addEventListener('mousemove', e => {
        gsap.to(customCursor, { x: e.clientX, y: e.clientY, duration: 0.1 });
        gsap.to(cursorRing, { x: e.clientX - 20, y: e.clientY - 20, duration: 0.3 });
    });

    document.querySelectorAll('button, a, .nav-item, #drop-zone').forEach(el => {
        el.onmouseenter = () => gsap.to(cursorRing, { scale: 1.5, borderColor: '#fff' });
        el.onmouseleave = () => gsap.to(cursorRing, { scale: 1, borderColor: 'rgba(255,255,255,0.3)' });
    });
}

function initAnimations() {
    gsap.from(".hero h1", { opacity: 0, y: 100, duration: 1.5, ease: "expo.out" });
    gsap.from(".hero p", { opacity: 0, y: 30, duration: 1.2, delay: 0.5, ease: "power3.out" });
    gsap.from(".cta-group", { opacity: 0, scale: 0.8, duration: 1, delay: 0.8, ease: "back.out(1.7)" });

    gsap.utils.toArray(".reveal").forEach(el => {
        gsap.to(el, {
            scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none reverse" },
            opacity: 1, y: 0, duration: 1, ease: "expo.out"
        });
    });
}

// --- NAVIGATION ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.sub-view');

    navItems.forEach((item, idx) => {
        item.onclick = () => {
            navItems.forEach(i => { i.classList.remove('active'); i.style.color = 'var(--text-muted)'; i.style.background = 'transparent'; });
            item.classList.add('active');
            item.style.color = '#fff';
            item.style.background = 'rgba(255,255,255,0.05)';

            const targetId = ['dashboard-content', 'chat-content', 'predictions-content'][idx];
            views.forEach(v => {
                v.style.display = 'none';
                v.classList.remove('active');
                if (v.id === targetId) {
                    v.style.display = targetId === 'chat-content' ? 'flex' : 'block';
                    setTimeout(() => v.classList.add('active'), 10);
                }
            });
        };
    });
}

function switchToApp() {
    gsap.to(landingView, {
        opacity: 0, scale: 0.9, duration: 0.8, onComplete: () => {
            landingView.style.display = 'none';
            appShell.style.display = 'grid';
            gsap.from(appShell, { opacity: 0, duration: 1 });
            gsap.from(".sidebar", { x: -50, opacity: 0, duration: 1, ease: "expo.out" });
        }
    });
}

// --- CORE LOGIC ---
['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.style.background = 'rgba(255,255,255,0.05)'));
['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.style.background = 'transparent'));
dropZone.onclick = () => fileInput.click();
fileInput.onchange = e => e.target.files.length && uploadFile(e.target.files[0]);

async function uploadFile(file) {
    fileStatus.innerText = "Ingesting Data...";
    const formData = new FormData();
    formData.append('file', file);

    try {
        const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const data = await resp.json();
        if (resp.ok) renderDashboard(data);
        else alert(data.detail);
    } catch (e) {
        fileStatus.innerText = "Endpoint Error";
    }
}

function renderDashboard(data) {
    const meta = data.metadata;
    fileStatus.innerText = meta.filename;
    fileMeta.innerText = `${meta.rows.toLocaleString()} Active Rows • System Optimized`;

    document.getElementById('download-data-btn').style.display = 'flex';
    document.getElementById('export-btn').style.display = 'flex';

    animateValue(statRows, 0, meta.rows, 2000);
    animateValue(statCols, 0, meta.columns.length, 1200);

    renderPreviewTable(data.preview || [], meta.columns);
    generateAIInsights(data.summary);
    renderCharts(data.charts);
    generatePredictions(data.summary);
}

function renderPreviewTable(rows, columns) {
    const table = document.getElementById('data-preview');
    table.innerHTML = `<thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
    const tbody = document.createElement('tbody');
    rows.slice(0, 10).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = columns.map(c => `<td>${row[c] !== null ? row[c] : '—'}</td>`).join('');
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

async function generateAIInsights(summary) {
    aiInsights.innerHTML = '<div class="pulse">Analyst is observing patterns...</div>';
    try {
        const resp = await fetch(`${API_BASE}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) });
        const data = await resp.json();
        aiInsights.innerHTML = data.insights.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    } catch (e) { aiInsights.innerHTML = "Analysis delayed."; }
}

function renderCharts(charts) {
    chartsContainer.innerHTML = '';
    charts.forEach((c, i) => {
        const el = document.createElement('div');
        el.className = 'pipeline-step';
        el.style.gridColumn = i < 2 ? 'span 6' : 'span 4';
        el.style.height = '400px';
        chartsContainer.appendChild(el);
        const chart = echarts.init(el, 'dark');
        chart.setOption(getChartOption(c));
    });
}

function getChartOption(c) {
    const isBar = c.type === 'bar';
    return {
        title: { text: c.title, textStyle: { color: '#fff', fontSize: 14 } },
        backgroundColor: 'transparent',
        xAxis: isBar ? { data: c.labels } : { show: false },
        yAxis: isBar ? { splitLine: { show: false } } : { show: false },
        series: [{
            type: c.type,
            data: isBar ? c.values : c.labels.map((l, i) => ({ name: l, value: c.values[i] })),
            itemStyle: { borderRadius: 10, color: '#8E75FF' },
            radius: ['40%', '70%'],
            label: { show: !isBar }
        }]
    };
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    const container = document.getElementById('chat-messages');
    container.innerHTML += `<div class="user-bubble" style="background:rgba(255,255,255,0.05); align-self:flex-end; padding:1.5rem; border-radius:12px; margin-bottom:1rem;">${msg}</div>`;
    input.value = '';
    const aiDiv = document.createElement('div');
    aiDiv.className = 'pulse';
    aiDiv.innerText = 'AI Thinking...';
    container.appendChild(aiDiv);

    const resp = await fetch(`${API_BASE}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: msg }) });
    const data = await resp.json();
    aiDiv.classList.remove('pulse');
    aiDiv.innerHTML = `<div style="background:rgba(142,117,255,0.1); padding:2rem; border-radius:12px; border:1px solid var(--glass-border); line-height:1.6; margin-bottom:1rem;">${data.answer}</div>`;
    container.scrollTop = container.scrollHeight;
}

// Prediction Logic ...
async function generatePredictions(summary) {
    const container = document.getElementById('prediction-container');
    const resp = await fetch(`${API_BASE}/predict`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary }) });
    const data = await resp.json();
    container.innerHTML = '';
    data.columns.forEach((col, i) => {
        const div = document.createElement('div');
        div.className = 'pipeline-step';
        div.style.height = '350px';
        container.appendChild(div);
        const chart = echarts.init(div, 'dark');
        chart.setOption({
            title: { text: `Projected: ${col}`, textStyle: { color: 'var(--gemini-cyan)' } },
            backgroundColor: 'transparent',
            xAxis: { type: 'category', data: [...data.historical[i].map((_, idx) => `T-${5 - idx}`), ...data.predicted[i].map((_, idx) => `P+${idx + 1}`)] },
            yAxis: { show: false },
            series: [
                { type: 'line', data: data.historical[i], smooth: true, lineStyle: { color: '#8E75FF', width: 3 } },
                { type: 'line', data: [...data.historical[i].slice(-1), ...data.predicted[i]], smooth: true, lineStyle: { type: 'dashed', color: 'var(--gemini-cyan)', width: 3 } }
            ]
        });
    });
}

function animateValue(el, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        el.innerText = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}
