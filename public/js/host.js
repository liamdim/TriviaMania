const socket = io();

function toggleGlobalChat() {
    const enabled = document.getElementById('globalChatToggle').checked;
    socket.emit('toggle-chat', enabled);
}

function playSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'tick') {
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
            osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.24);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        }
    } catch (e) {}
}

function playHostSound(type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();

        if (type === 'buzzer') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, ctx.currentTime);
            osc.frequency.setValueAtTime(90, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'fanfare') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + (i * 0.12));
                gain.gain.setValueAtTime(0.15, ctx.currentTime + (i * 0.12));
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i * 0.12) + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + (i * 0.12));
                osc.stop(ctx.currentTime + (i * 0.12) + 0.3);
            });
        } else if (type === 'drumroll') {
            for (let i = 0; i < 8; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(120 + Math.random() * 30, ctx.currentTime + (i * 0.05));
                gain.gain.setValueAtTime(0.08, ctx.currentTime + (i * 0.05));
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i * 0.05) + 0.04);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + (i * 0.05));
                osc.stop(ctx.currentTime + (i * 0.05) + 0.04);
            }
        } else if (type === 'applause') {
            const bufferSize = ctx.sampleRate * 0.5;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1000;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start();
        }
    } catch (e) {}
}

function sendAnnouncement() {
    const text = document.getElementById('announcementInput').value.trim();
    socket.emit('update-announcement', { active: true, text });
    alert('Announcement broadcasted to all mobile screens!');
}

function clearAnnouncement() {
    document.getElementById('announcementInput').value = '';
    socket.emit('update-announcement', { active: false, text: '' });
}

function sendHostChat() {
    const input = document.getElementById('hostChatInput');
    const msg = input.value.trim();
    if (!msg) return;
    socket.emit('player-chat', msg);
    input.value = '';
}

function appendHostChatMessage(name, text) {
    const chatLog = document.getElementById('hostChatLog');
    if (chatLog) {
        if (chatLog.children.length === 1 && chatLog.children[0].style.fontStyle === 'italic') {
            chatLog.innerHTML = '';
        }
        const msgEl = document.createElement('div');
        msgEl.innerHTML = `<span style="color: var(--accent); font-weight: bold;">${name}:</span> ${text}`;
        chatLog.appendChild(msgEl);
        chatLog.scrollTop = chatLog.scrollHeight;
    }
}

socket.on('chat-message', (data) => {
    appendHostChatMessage(data.name, data.text);
});

function switchTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (element) {
        element.classList.add('active');
    } else {
        const btn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        if (btn) btn.classList.add('active');
    }
}

const playerUrl = window.location.origin + '/player.html';
document.getElementById('playerJoinUrl').innerText = playerUrl;
new QRCode(document.getElementById("qr-container"), {
    text: playerUrl,
    width: 200,
    height: 200
});

function openPrintableQR() {
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head><title>Printable QR - TriviaMania</title></head>
        <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center;">
            <h1>SCAN TO PLAY TRIVIAMANIA</h1>
            <div id="printqr" style="margin: 2rem;"></div>
            <p style="font-size:1.5rem; font-family:monospace;">${playerUrl}</p>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
                new QRCode(document.getElementById("printqr"), { text: "${playerUrl}", width: 300, height: 300 });
                window.onload = () => setTimeout(() => window.print(), 500);
            </script>
        </body>
        </html>
    `);
}

const venueInput = document.getElementById('venueDetailsInput');
venueInput.value = localStorage.getItem('triviamania_venue_details') || '';

const welcomeHeaderInput = document.getElementById('welcomeHeaderInput');
welcomeHeaderInput.value = localStorage.getItem('triviamania_welcome_header') || 'Welcome to TriviaMania!';

const mobileWaitingInput = document.getElementById('mobileWaitingInput');
mobileWaitingInput.value = localStorage.getItem('triviamania_mobile_waiting') || 'Waiting for host to start game...';

const customEmojisInput = document.getElementById('customEmojisInput');
customEmojisInput.value = localStorage.getItem('triviamania_custom_emojis') || '🔥, 🍻, 👏, 😂, 🎉, 💡';

function saveVenueDetails() {
    localStorage.setItem('triviamania_venue_details', venueInput.value);
    socket.emit('update-venue-details', venueInput.value);
}

function saveWelcomeHeader() {
    localStorage.setItem('triviamania_welcome_header', welcomeHeaderInput.value);
    socket.emit('update-welcome-header', welcomeHeaderInput.value);
}

function saveMobileWaiting() {
    localStorage.setItem('triviamania_mobile_waiting', mobileWaitingInput.value);
    socket.emit('update-mobile-waiting', mobileWaitingInput.value);
}

function saveCustomEmojis() {
    localStorage.setItem('triviamania_custom_emojis', customEmojisInput.value);
    const emojis = customEmojisInput.value.split(',').map(e => e.trim()).filter(Boolean);
    socket.emit('update-custom-emojis', emojis);
}

socket.on('connect', () => {
    if (venueInput.value) socket.emit('update-venue-details', venueInput.value);
    if (welcomeHeaderInput.value) socket.emit('update-welcome-header', welcomeHeaderInput.value);
    if (mobileWaitingInput.value) socket.emit('update-mobile-waiting', mobileWaitingInput.value);
    if (customEmojisInput.value) socket.emit('update-custom-emojis', customEmojisInput.value.split(',').map(e => e.trim()));
});

function copyPlayerLink() {
    navigator.clipboard.writeText(playerUrl);
    alert('Player mobile link copied!');
}

async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const categories = await res.json();
        const select = document.getElementById('triviaGenreSelect');
        if (categories.length > 0) {
            select.innerHTML = categories.map(cat => 
                `<option value="${cat}">${cat.replace(/-/g, ' ').toUpperCase()}</option>`
            ).join('');
        }
    } catch (err) {}
}
loadCategories();

function updateSettings() {
    const questionTime = document.getElementById('questionTimerSelect').value;
    const intermissionTime = document.getElementById('intermissionTimerSelect').value;
    const countdownSound = document.getElementById('countdownSoundToggle').checked;
    socket.emit('update-settings', { questionTime, intermissionTime, countdownSound });
}

function addRoundToPlaylist() {
    const genre = document.getElementById('triviaGenreSelect').value;
    const name = document.getElementById('roundNameInput').value;
    const count = parseInt(document.getElementById('questionCountSelect').value);
    const timer = document.getElementById('roundTimerSelect').value;
    if (!genre) { alert('Please select a category!'); return; }
    socket.emit('add-round', { genre, name, count, timer: timer ? parseInt(timer) : null });
    alert('Round added to playlist!');
}

async function addBeatIQRoundToMainPlaylist() {
    const genre = document.getElementById('beatiqGenreSelect').value;
    const name = document.getElementById('beatiqRoundName').value;
    const count = parseInt(document.getElementById('beatiqTrackCount').value);

    try {
        const res = await fetch('/api/beatiq/tracks');
        if (!res.ok) throw new Error('Network response was not ok');
        const allTracks = await res.json();
        if (!Array.isArray(allTracks) || allTracks.length === 0) {
            alert('Error: No tracks loaded. Check curatedTracks.json.');
            return;
        }
        let genreTracks = allTracks.filter(t => t.genre === genre);
        let trackPool = genreTracks.length >= count ? genreTracks : allTracks;
        const selectedTracks = [...trackPool].sort(() => 0.5 - Math.random()).slice(0, count);

        if (selectedTracks.length === 0) {
            alert(`No tracks found for this genre.`);
            return;
        }

        socket.emit('add-beatiq-round', { genre, name, questionCount: count });
        alert(`Successfully added "${name}" to your main playlist queue!`);
        switchTab('controls');
    } catch (err) {
        alert('Failed to connect to server or load BeatIQ tracks.');
    }
}

function updateMiniGameLabels() {
    const type = document.getElementById('miniGameTypeSelect').value;
    const nameInput = document.getElementById('miniGameRoundName');
    if (type === 'lingo') nameInput.value = 'Lingo Word Game Round';
    else if (type === 'scramble') nameInput.value = 'Word Scramble Anagram Round';
    else if (type === 'higher-lower') nameInput.value = 'Higher or Lower Prediction Round';
}

function addMiniGameRoundToPlaylist() {
    const type = document.getElementById('miniGameTypeSelect').value;
    const name = document.getElementById('miniGameRoundName').value;
    const count = parseInt(document.getElementById('miniGameCount').value);

    socket.emit('add-minigame-round', { type, name, count });
    alert(`Successfully added "${name}" to your main playlist queue!`);
    switchTab('controls');
}

let savedAds = JSON.parse(localStorage.getItem('triviamania_ads_v2') || '[]');

function saveNewAdvert() {
    const title = document.getElementById('adTitleInput').value;
    const fileInput = document.getElementById('adImageInput');

    if (!title) { alert('Please enter an advert title!'); return; }

    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

                try {
                    savedAds.push({ title, image: compressedDataUrl });
                    localStorage.setItem('triviamania_ads_v2', JSON.stringify(savedAds));
                    renderAdsLibrary();
                    document.getElementById('adTitleInput').value = '';
                    document.getElementById('adImageInput').value = '';
                    alert('Advert saved successfully!');
                } catch (err) { alert('Storage quota exceeded!'); }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        try {
            savedAds.push({ title, image: null });
            localStorage.setItem('triviamania_ads_v2', JSON.stringify(savedAds));
            renderAdsLibrary();
            document.getElementById('adTitleInput').value = '';
            alert('Advert saved successfully!');
        } catch (err) { alert('Storage quota exceeded!'); }
    }
}

function renderAdsLibrary() {
    const listDiv = document.getElementById('savedAdsList');
    const screenSelect = document.getElementById('screenAdSelect');
    const mobileSelect = document.getElementById('mobileAdSelect');
    const quickScreenSelect = document.getElementById('quickScreenAdSelect');
    const quickMobileSelect = document.getElementById('quickMobileAdSelect');

    const dropdownOptions = '<option value="">-- Choose Advert --</option>' + 
        savedAds.map((ad, idx) => `<option value="${idx}">${ad.title}</option>`).join('');

    screenSelect.innerHTML = dropdownOptions;
    mobileSelect.innerHTML = dropdownOptions;
    quickScreenSelect.innerHTML = dropdownOptions;
    quickMobileSelect.innerHTML = dropdownOptions;

    if (savedAds.length === 0) {
        listDiv.innerHTML = `<p style="color: var(--text-muted);">No saved adverts yet. Create one above!</p>`;
        return;
    }

    listDiv.innerHTML = savedAds.map((ad, idx) => `
        <div class="ad-item">
            <div><strong>${ad.title}</strong> ${ad.image ? '<span style="color: var(--success); font-size: 0.8rem;">(Has Image)</span>' : ''}</div>
            <div><button class="small danger" onclick="deleteSavedAd(${idx})">🗑 Delete</button></div>
        </div>
    `).join('');
}

function launchScreenAd() {
    const idx = document.getElementById('screenAdSelect').value;
    if (idx === "") { alert('Please select an advert!'); return; }
    socket.emit('broadcast-advert-screen', savedAds[idx]);
}

function launchMobileAd() {
    const idx = document.getElementById('mobileAdSelect').value;
    if (idx === "") { alert('Please select an advert!'); return; }
    socket.emit('broadcast-advert-mobile', savedAds[idx]);
}

function launchQuickScreenAd() {
    const idx = document.getElementById('quickScreenAdSelect').value;
    if (idx === "") { alert('Please select an advert!'); return; }
    socket.emit('broadcast-advert-screen', savedAds[idx]);
}

function launchQuickMobileAd() {
    const idx = document.getElementById('quickMobileAdSelect').value;
    if (idx === "") { alert('Please select an advert!'); return; }
    socket.emit('broadcast-advert-mobile', savedAds[idx]);
}

function deleteSavedAd(index) {
    savedAds.splice(index, 1);
    localStorage.setItem('triviamania_ads_v2', JSON.stringify(savedAds));
    renderAdsLibrary();
}

renderAdsLibrary();

socket.on('state-update', (state) => {
    document.getElementById('statusDisplay').innerText = state.status;
    
    if (state.chatEnabled !== undefined) {
        document.getElementById('globalChatToggle').checked = state.chatEnabled;
    }

    if (state.settings && state.settings.countdownSound !== undefined) {
        document.getElementById('countdownSoundToggle').checked = state.settings.countdownSound;
    }
    
    const previewBox = document.getElementById('hostPreviewBox');
    const currentRound = state.playlist[state.currentRoundIndex];
    if (currentRound && currentRound.questions) {
        const nextQIndex = state.status === 'QUESTION' ? state.currentQuestionIndex + 1 : state.currentQuestionIndex;
        const nextQ = currentRound.questions[nextQIndex];
        if (nextQ) {
            previewBox.innerHTML = `
                <p style="font-size: 1.1rem; font-weight: bold; margin-bottom: 0.4rem; color: var(--text);">Q${nextQIndex + 1} (${currentRound.name}): ${nextQ.question}</p>
                <p style="color: var(--success); font-size: 0.95rem;">Correct Answer: <strong>${nextQ.answer}</strong></p>
            `;
        } else {
            previewBox.innerHTML = `<p style="color: var(--warning);">End of current round reached!</p>`;
        }
    } else {
        previewBox.innerHTML = `<p style="color: var(--text-muted);">No active rounds in playlist.</p>`;
    }

    const tbody = document.querySelector('#playlistTable tbody');
    if (state.playlist.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="color: var(--text-muted);">No rounds added yet.</td></tr>`;
    } else {
        tbody.innerHTML = state.playlist.map((r, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${r.name}</td>
                <td>${r.genre} (${r.questions.length} Qs ${r.timer ? '• ' + r.timer + 's' : ''})</td>
                <td>
                    <button class="small" onclick="socket.emit('move-round', { index: ${idx}, direction: 'up' })">⬆</button>
                    <button class="small" onclick="socket.emit('move-round', { index: ${idx}, direction: 'down' })">⬇</button>
                    <button class="small danger" onclick="socket.emit('delete-round', ${idx})">❌</button>
                </td>
            </tr>
        `).join('');
    }

    const players = Object.entries(state.scores || {});
    document.getElementById('playerCount').innerText = players.length;
    const playersListDiv = document.getElementById('joinedPlayersList');
    if (players.length === 0) {
        playersListDiv.innerHTML = `<span style="color: var(--text-muted);">Waiting for players to join...</span>`;
    } else {
        playersListDiv.innerHTML = players.map(([id, p]) => {
            const isMuted = state.mutedPlayers && state.mutedPlayers[id];
            return `
                <span class="player-badge">
                    👤 ${p.name} (${p.score} pts)
                    <button class="small ${isMuted ? 'success' : 'warning'}" style="padding: 0.1rem 0.4rem; margin-left: 0.4rem;" onclick="socket.emit('toggle-mute-player', '${id}')">
                        ${isMuted ? 'Unmute' : 'Mute'}
                    </button>
                </span>
            `;
        }).join('');
    }

    const sortedPlayers = Object.values(state.scores || {}).sort((a, b) => b.score - a.score);
    const lbTbody = document.querySelector('#hostLeaderboardTable tbody');
    if (sortedPlayers.length === 0) {
        lbTbody.innerHTML = `<tr><td colspan="4" style="color: var(--text-muted);">No scores recorded yet.</td></tr>`;
    } else {
        lbTbody.innerHTML = sortedPlayers.map((p, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${p.name}</td>
                <td>🔥 x${p.streak || 0}</td>
                <td><strong>${p.score}</strong></td>
            </tr>
        `).join('');
    }
});
