// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileStatus = document.getElementById('file-status');
const dashboardView = document.getElementById('dashboard-view');
const chatView = document.getElementById('chat-view');
const navItems = document.querySelectorAll('.nav-item');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const aiInsights = document.getElementById('ai-insights');
const chartsContainer = document.getElementById('charts-container');
const exportBtn = document.getElementById('export-btn');

// State
let lastSummary = null;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    // Entrance Animations
    gsap.from(".sidebar", { x: -50, opacity: 0, duration: 1, ease: "power3.out" });
    gsap.from(".top-bar", { y: -20, opacity: 0, duration: 1, delay: 0.2, ease: "power3.out" });
    gsap.from(".stat-card", { y: 30, opacity: 0, duration: 0.8, stagger: 0.1, delay: 0.4, ease: "power3.out" });

    // Load Persistence
    const savedMeta = localStorage.getItem('last_upload_meta');
    if (savedMeta) {
        const meta = JSON.parse(savedMeta);
        fileStatus.innerHTML = `📁 Last session: <strong>${meta.filename}</strong>`;
        updateStats(meta);
    }
});

// --- NAVIGATION ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');

        // Update UI
        navItems.forEach(ni => ni.classList.remove('active'));
        item.classList.add('active');

        // Switch Views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(target).classList.add('active');

        // Animate new view
        gsap.from(`#${target} > *`, { y: 20, opacity: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" });
    });
});

// --- FILE UPLOAD ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, preventDefaults, false));
function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('active')));
['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('active')));

dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
    if (files.length > 0) uploadFile(files[0]);
}

async function uploadFile(file) {
    fileStatus.innerHTML = `<span class="pulse">Uploading ${file.name}...</span>`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:8000/upload', { method: 'POST', body: formData });
        const data = await response.json();

        if (response.ok) {
            processUploadSuccess(data);
        } else {
            fileStatus.innerHTML = `<span style="color: #f87171">Upload Failed: ${data.detail}</span>`;
        }
    } catch (error) {
        fileStatus.innerHTML = `<span style="color: #f87171">Connection Error.</span>`;
    }
}

function processUploadSuccess(data) {
    const meta = data.metadata;
    localStorage.setItem('last_upload_meta', JSON.stringify(meta));

    fileStatus.innerHTML = `✅ <strong>${meta.filename}</strong> Loaded`;
    exportBtn.style.display = 'block';
    document.getElementById('download-data-btn').style.display = 'block';

    updateStats(meta);
    renderCharts(data.charts);
    generateAIInsights(data.summary);

    // Bounce effect on cards
    gsap.to(".stat-card", { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1 });
}

async function downloadData() {
    try {
        const response = await fetch('http://localhost:8000/download');
        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "cleaned_data.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        alert("Failed to download data: " + e.message);
    }
}


function updateStats(meta) {
    animateValue('stat-rows', 0, meta.rows || 0, 1000);
    animateValue('stat-cols', 0, meta.columns?.length || 0, 800);
    document.getElementById('stat-dupes').innerText = 'Auto-Cleaned';
}

// --- VISUALIZATION ---
function renderCharts(charts) {
    chartsContainer.innerHTML = '';
    if (!charts || charts.length === 0) {
        chartsContainer.innerHTML = '<div class="empty-state">No chartable data found.</div>';
        return;
    }

    charts.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'glass-card chart-item';
        div.style.height = '400px';
        chartsContainer.appendChild(div);

        const chart = echarts.init(div, 'dark');
        const option = c.type === 'bar' ? getBarOption(c) : getPieOption(c);
        chart.setOption(option);

        gsap.from(div, { opacity: 0, scale: 0.9, duration: 0.6, delay: 0.2 * i });
    });
}

function getBarOption(c) {
    return {
        title: { text: c.title, textStyle: { color: '#f8fafc', fontFamily: 'Outfit' } },
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        xAxis: { data: c.labels, axisLabel: { color: '#94a3b8' } },
        yAxis: { splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
        series: [{ type: 'bar', data: c.values, itemStyle: { color: '#6366f1', borderRadius: [5, 5, 0, 0] } }]
    };
}

function getPieOption(c) {
    return {
        title: { text: c.title, textStyle: { color: '#f8fafc', fontFamily: 'Outfit' } },
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item' },
        series: [{
            type: 'pie', radius: ['40%', '70%'],
            itemStyle: { borderRadius: 10, borderColor: '#0f172a', borderWidth: 2 },
            data: c.labels.map((l, i) => ({ name: l, value: c.values[i] }))
        }]
    };
}

// --- AI ENGINE ---
async function generateAIInsights(summary) {
    aiInsights.innerHTML = '<div class="pulse">AI Analyst is generating insights...</div>';

    try {
        const resp = await fetch('http://localhost:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary })
        });
        const data = await resp.json();
        aiInsights.innerHTML = parseMarkdown(data.insights);
        gsap.from(aiInsights, { opacity: 0, duration: 1 });
    } catch (e) {
        aiInsights.innerHTML = "Insights unavailable.";
    }
}

async function sendMessage() {
    const question = chatInput.value.trim();
    if (!question) return;
    chatInput.value = '';

    addChatMessage('user', question);
    const loadingId = addChatMessage('ai', 'Thinking...', true);

    try {
        const resp = await fetch('http://localhost:8000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await resp.json();
        updateChatMessage(loadingId, data.answer);
    } catch (e) {
        updateChatMessage(loadingId, "Connection error.");
    }
}

function addChatMessage(role, text, isPulse = false) {
    const id = Date.now();
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}-bubble ${isPulse ? 'pulse' : ''}`;
    div.id = `msg-${id}`;
    div.innerHTML = parseMarkdown(text);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    gsap.from(div, { x: role === 'user' ? 20 : -20, opacity: 0, duration: 0.4 });
    return id;
}

function updateChatMessage(id, text) {
    const el = document.getElementById(`msg-${id}`);
    el.classList.remove('pulse');
    el.innerHTML = parseMarkdown(text);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- UTILS ---
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function parseMarkdown(t) {
    return t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^\* (.*?)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '<br><br>');
}

chatInput.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
