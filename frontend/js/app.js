// --- CONFIGURATION ---
const API_BASE = "http://localhost:8000";

// --- DOM ELEMENTS ---
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

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initAnimations();
    initCursor();
    initNavigation();
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.sub-view');

    navItems.forEach((item, idx) => {
        item.addEventListener('click', () => {
            // Update nav active state
            navItems.forEach(ni => ni.classList.remove('active'));
            item.classList.add('active');

            // Switch views
            const targetId = ['dashboard-content', 'chat-content', 'predictions-content'][idx];
            views.forEach(v => {
                v.style.display = 'none';
                if (v.id === targetId) {
                    v.style.display = targetId === 'chat-content' ? 'flex' : 'block';
                    gsap.from(v, { opacity: 0, y: 10, duration: 0.4 });
                }
            });
        });
    });
}

function initAnimations() {

    gsap.from(".hero h1", { opacity: 0, y: 50, duration: 1, ease: "power4.out" });
    gsap.from(".hero p", { opacity: 0, y: 30, duration: 1, delay: 0.3, ease: "power3.out" });
    gsap.from(".cta-group", { opacity: 0, y: 20, duration: 1, delay: 0.6, ease: "power3.out" });

    // Feature reveals on scroll
    gsap.utils.toArray(".reveal").forEach(el => {
        gsap.to(el, {
            scrollTrigger: {
                trigger: el,
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            opacity: 1, y: 0, duration: 1, ease: "expo.out"
        });
    });

    setupPipelineAnim();
}


function initCursor() {
    document.addEventListener('mousemove', (e) => {
        gsap.to(customCursor, { x: e.clientX, y: e.clientY, duration: 0.1 });
        gsap.to(cursorRing, { x: e.clientX - 13, y: e.clientY - 13, duration: 0.3 });
    });

    const clickables = document.querySelectorAll('button, a, .nav-item, #drop-zone');
    clickables.forEach(el => {
        el.addEventListener('mouseenter', () => {
            gsap.to(cursorRing, { scale: 1.5, borderColor: '#00E5FF', backgroundColor: 'rgba(0,229,255,0.1)', duration: 0.3 });
        });
        el.addEventListener('mouseleave', () => {
            gsap.to(cursorRing, { scale: 1, borderColor: '#6C63FF', backgroundColor: 'transparent', duration: 0.3 });
        });
    });
}

// --- VIEW MANAGEMENT ---
function switchToApp() {
    gsap.to(landingView, {
        opacity: 0,
        y: -100,
        duration: 0.8,
        ease: "power4.in",
        onComplete: () => {
            landingView.style.display = 'none';
            appShell.style.display = 'grid';
            gsap.from(appShell, { opacity: 0, duration: 1 });
            gsap.from(".sidebar", { x: -30, opacity: 0, duration: 1, ease: "expo.out" });
        }
    });
}

// --- DATA PROCESSING ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, preventDefaults, false));
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.style.borderColor = '#00E5FF'));
['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.style.borderColor = 'var(--glass-border)'));

dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
dropZone.onclick = () => fileInput.click();

function handleFiles(files) {
    if (files.length > 0) uploadFile(files[0]);
}

async function uploadFile(file) {
    fileStatus.innerText = "Analyzing Dataset...";
    fileMeta.innerText = `Uploader processing ${file.name}`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const data = await response.json();

        if (response.ok) {
            renderDashboard(data);
        } else {
            fileStatus.innerText = "Analysis Failed";
            fileMeta.innerText = data.detail;
        }
    } catch (error) {
        fileStatus.innerText = "Connection Error";
        fileMeta.innerText = "Ensure API server is live on Port 8000";
    }
}

function renderDashboard(data) {
    const meta = data.metadata;
    fileStatus.innerText = meta.filename;
    fileMeta.innerText = `${meta.rows.toLocaleString()} Rows detected • Managed via AI Pro`;

    // Reveal buttons
    document.getElementById('download-data-btn').style.display = 'block';
    document.getElementById('export-btn').style.display = 'block';

    // Animate Stats
    animateValue(statRows, 0, meta.rows, 1500);
    animateValue(statCols, 0, meta.columns.length, 1000);

    renderPreviewTable(data.preview || [], meta.columns);
    // AI Insights
    generateAIInsights(data.summary);

    // Visuals
    renderCharts(data.charts);
    generatePredictions(data.summary);

    // Staggered reveal of dashboard widgets
    gsap.from(".stat-widget", { opacity: 0, y: 30, stagger: 0.2, duration: 1, ease: "expo.out" });
}

function renderPreviewTable(rows, columns) {
    const table = document.getElementById('data-preview');
    table.innerHTML = `<thead><tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
    const tbody = document.createElement('tbody');
    rows.slice(0, 8).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = columns.map(c => `<td>${row[c] !== null ? row[c] : '-'}</td>`).join('');
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

async function generatePredictions(summary) {
    const container = document.getElementById('prediction-container');
    container.innerHTML = '<div class="pulse">Running Predictive Models...</div>';

    try {
        const resp = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary })
        });
        const data = await resp.json();
        renderPredictionCharts(data);
    } catch (e) {
        container.innerHTML = "Predictive analysis unavailable for this dataset.";
    }
}

function renderPredictionCharts(data) {
    const container = document.getElementById('prediction-container');
    container.innerHTML = '';

    data.columns.forEach((col, i) => {
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.gridColumn = 'span 6';
        div.style.height = '300px';
        container.appendChild(div);

        const chart = echarts.init(div, 'dark');
        const hist = data.historical[i];
        const pred = data.predicted[i];

        chart.setOption({
            title: { text: `Forecast: ${col}`, textStyle: { fontSize: 13, color: 'var(--text-muted)' } },
            backgroundColor: 'transparent',
            xAxis: { type: 'category', data: [...hist.map((_, idx) => `T-${5 - idx}`), ...pred.map((_, idx) => `F+${idx + 1}`)] },
            yAxis: { type: 'value', splitLine: { show: false } },
            series: [
                {
                    name: 'History', type: 'line', data: hist, smooth: true,
                    lineStyle: { color: 'var(--primary)', width: 3 }
                },
                {
                    name: 'Forecast', type: 'line', data: [...hist.slice(-1), ...pred], smooth: true,
                    lineStyle: { type: 'dashed', color: 'var(--cyan)', width: 3 }
                }
            ]
        });
    });
}


async function generateAIInsights(summary) {
    aiInsights.innerHTML = '<div class="pulse">AI Engine is thinking...</div>';
    try {
        const resp = await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary })
        });
        const data = await resp.json();
        aiInsights.innerHTML = parseMarkdown(data.insights);
        gsap.from(aiInsights, { opacity: 0, y: 10, duration: 1 });
    } catch (e) {
        aiInsights.innerHTML = "Insights currently unavailable.";
    }
}

function renderCharts(charts) {
    chartsContainer.innerHTML = '';
    charts.forEach((c, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'glass-card visual-widget reveal';
        wrap.style.gridColumn = charts.length === 1 ? 'span 12' : (i < 2 ? 'span 6' : 'span 4');
        chartsContainer.appendChild(wrap);

        const chart = echarts.init(wrap, 'dark');
        const option = c.type === 'bar' ? getBarOption(c) : getPieOption(c);
        chart.setOption(option);

        gsap.to(wrap, { opacity: 1, y: 0, duration: 1, delay: 0.2 * i });
        window.addEventListener('resize', () => chart.resize());
    });
}

// --- CHART THEMES ---
function getBarOption(c) {
    return {
        title: { text: c.title, textStyle: { color: '#fff', fontFamily: 'Outfit', fontSize: 16 } },
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(11, 16, 38, 0.9)', borderColor: 'var(--primary)' },
        xAxis: { data: c.labels, axisLabel: { color: 'var(--text-muted)' } },
        yAxis: { splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, axisLabel: { color: 'var(--text-muted)' } },
        series: [{
            type: 'bar',
            data: c.values,
            itemStyle: {
                borderRadius: [8, 8, 0, 0],
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#6C63FF' },
                    { offset: 1, color: '#00E5FF' }
                ])
            }
        }]
    };
}

function getPieOption(c) {
    return {
        title: { text: c.title, textStyle: { color: '#fff', fontFamily: 'Outfit', fontSize: 16 } },
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item' },
        series: [{
            type: 'pie', radius: ['40%', '75%'],
            itemStyle: { borderRadius: 12, borderColor: '#0B1026', borderWidth: 4 },
            label: { show: false },
            data: c.labels.map((l, idx) => ({
                name: l,
                value: c.values[idx],
                itemStyle: { color: idx === 0 ? '#6C63FF' : (idx === 1 ? '#00E5FF' : '#FF7AF6') }
            }))
        }]
    };
}

// --- UTILS ---
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

function parseMarkdown(t) {
    return t.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--cyan)">$1</strong>')
        .replace(/^\* (.*?)$/gm, '• $1<br>')
        .replace(/\n\n/g, '<br><br>');
}
// --- CHAT LOGIC ---
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-messages');
    const question = input.value.trim();

    if (!question) return;

    // Add user bubble
    const userDiv = document.createElement('div');
    userDiv.className = 'user-bubble';
    userDiv.innerText = question;
    container.appendChild(userDiv);
    input.value = '';

    // Add AI loading bubble
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-bubble pulse';
    aiDiv.innerText = 'AI is exploring matching patterns...';
    container.appendChild(aiDiv);
    container.scrollTop = container.scrollHeight;

    try {
        const resp = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await resp.json();

        aiDiv.classList.remove('pulse');
        aiDiv.innerHTML = `<p>${data.answer || "I'm sorry, I couldn't process that."}</p>`;

        if (data.query) {
            aiDiv.innerHTML += `<div style="font-size: 0.7rem; color: var(--cyan); margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 0.5rem; font-family: monospace;">Query Executed: ${data.query}</div>`;
        }
        gsap.from(aiDiv, { x: -20, opacity: 0, duration: 0.5 });
    } catch (e) {
        aiDiv.innerText = "Connection lost. Please ensure the backend is running.";
    }
    container.scrollTop = container.scrollHeight;
}

// Enhance Existing initAnimations with Pipeline
function setupPipelineAnim() {
    const pipelineSteps = document.querySelectorAll('#how-it-works .glass-card');
    pipelineSteps.forEach((step, i) => {
        gsap.from(step, {
            scrollTrigger: {
                trigger: step,
                start: "top 90%",
                toggleActions: "play none none reverse"
            },
            x: i % 2 === 0 ? -50 : 50,
            opacity: 0,
            scale: 0.9,
            duration: 0.8,
            ease: "back.out(1.7)"
        });
    });
}
