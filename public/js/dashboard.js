function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    btn.classList.add('active');
}

const socket = io();
let playlist = [];
let latestPlayersState = {};

const backupQuestionBanks = {
    "general": [
        { q: "What is the capital city of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
        { q: "Which chemical element has the symbol 'Au'?", a: "Gold", options: ["Silver", "Gold", "Copper", "Argon"] },
        { q: "How many bones are in the adult human body?", a: "206", options: ["200", "206", "214", "198"] },
        { q: "What is the hardest natural substance on Earth?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Quartz"] },
        { q: "Which planet in our solar system is the largest?", a: "Jupiter", options: ["Saturn", "Jupiter", "Neptune", "Earth"] },
        { q: "In what year did the Apollo 11 mission land on the moon?", a: "1969", options: ["1967", "1969", "1971", "1965"] }
    ],
    "movies": [
        { q: "Which film won Best Picture in 1994?", a: "Forrest Gump", options: ["Pulp Fiction", "The Shawshank Redemption", "Forrest Gump", "Quiz Show"] },
        { q: "Who directed 'Jurassic Park' (1993)?", a: "Steven Spielberg", options: ["James Cameron", "George Lucas", "Steven Spielberg", "Ridley Scott"] }
    ]
};

async function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryKey = select ? select.value : "general";
    const genreName = select ? select.options[select.selectedIndex].text : "Trivia Round";
    const countSelect = document.getElementById('triviaCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;
    
    const qTimer = parseInt(document.getElementById('questionTimerInput').value) || 15;
    const bDelay = parseInt(document.getElementById('betweenDelayInput').value) || 5;
    
    let rawQuestions = [];
    try {
        const response = await fetch(`/api/questions/${categoryKey}?count=${targetCount}`);
        if (response.ok) {
            rawQuestions = await response.json();
        }
    } catch (e) {
        console.log('Using local backup questions.');
    }

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        rawQuestions = backupQuestionBanks[categoryKey] || backupQuestionBanks["general"];
    }

    const shuffled = [...rawQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, targetCount);

    const questions = selected.map(item => ({
        q: item.q,
        a: item.a,
        options: [...item.options].sort(() => Math.random() - 0.5),
        type: 'trivia'
    }));

    playlist.push({ 
        id: Date.now(), 
        name: genreName + " (" + questions.length + " Qs)", 
        questions: questions, 
        timer: qTimer, 
        betweenDelay: bDelay, 
        speedBonus: true 
    });
    
    renderPlaylist();
    alert('Successfully added ' + questions.length + ' questions for ' + genreName + '!');
}

function sendAction(action) { socket.emit('hostAction', { action: action }); }

function getSavedAds() {
    try { return JSON.parse(localStorage.getItem('trivia_saved_ads')) || []; } catch(e) { return []; }
}

function saveNewAdvert() {
    const title = document.getElementById('advertTitleInput').value;
    const target = document.getElementById('advertTargetInput').value;
    const fileInput = document.getElementById('advertImageInput');
    
    const pushToStorage = (imgData) => {
        const ads = getSavedAds();
        ads.push({ id: Date.now(), title, target, image: imgData });
        try {
            localStorage.setItem('trivia_saved_ads', JSON.stringify(ads));
            renderSavedAds();
            alert('Advert saved to library successfully!');
        } catch(err) {
            alert('Storage limit reached! Try a smaller image.');
        }
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const maxDim = 800;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxDim) { height *= maxDim / width; width = maxDim; }
                } else {
                    if (height > maxDim) { width *= maxDim / height; height = maxDim; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                pushToStorage(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        pushToStorage('');
    }
}

function renderSavedAds() {
    const container = document.getElementById('savedAdsContainer');
    const quickSelect = document.getElementById('quickAdSelect');
    const ads = getSavedAds();
    
    if (quickSelect) {
        let qHtml = '<option value="">-- Choose Ad --</option>';
        ads.forEach(ad => {
            qHtml += `<option value="${ad.id}">${ad.title} (${ad.target})</option>`;
        });
        quickSelect.innerHTML = qHtml;
    }

    if (!container) return;
    if (ads.length === 0) {
        container.innerHTML = '<p style="color:var(--muted); font-size:12px;">No stored adverts found.</p>';
        return;
    }
    let html = '';
    ads.forEach(ad => {
        let thumb = ad.image ? `<img src="${ad.image}" style="width:40px; height:30px; object-fit:cover; border-radius:4px; margin-right:8px; vertical-align:middle;">` : '';
        html += `<div class="ad-item"><span>${thumb}<strong>${ad.title}</strong> (${ad.target})</span><div><button class="btn-play" style="padding:4px 8px; font-size:11px;" onclick="broadcastAd(${ad.id})">📺 Broadcast</button><button class="btn-danger" onclick="deleteAd(${ad.id})">Delete</button></div></div>`;
    });
    container.innerHTML = html;
}

function broadcastAd(id) {
    const ads = getSavedAds();
    const ad = ads.find(a => a.id == id);
    if (!ad) return alert('Advert not found!');
    socket.emit('hostAction', { action: 'pushAdvert', payload: { title: ad.title, target: ad.target, image: ad.image } });
    alert('Broadcasting "' + ad.title + '"!');
}

function quickBroadcastAd() {
    const quickSelect = document.getElementById('quickAdSelect');
    if (!quickSelect || !quickSelect.value) return alert('Please select an ad from the dropdown first!');
    broadcastAd(quickSelect.value);
}

function deleteAd(id) {
    let ads = getSavedAds();
    ads = ads.filter(a => a.id != id);
    localStorage.setItem('trivia_saved_ads', JSON.stringify(ads));
    renderSavedAds();
}

function hideAdvert() {
    socket.emit('hostAction', { action: 'hideAdvert' });
    alert('Advert hidden.');
}

function triggerCustomPoll(isActive) {
    const q = document.getElementById('pollQuestionInput').value;
    const opts = document.getElementById('pollOptionsInput').value;
    socket.emit('hostAction', { 
        action: 'updatePoll', 
        payload: { active: isActive, question: q, options: opts } 
    });
    alert(isActive ? 'Poll launched to all mobile players!' : 'Poll closed.');
}

function saveSettings() {
    const title = document.getElementById('eventTitleInput').value;
    socket.emit('hostAction', { action: 'updateSettings', payload: { eventTitle: title } });
    alert('Settings saved.');
}

function exportLeaderboardCSV() {
    const sorted = Object.values(latestPlayersState).sort((a, b) => b.score - a.score);
    if (sorted.length === 0) return alert('No players to export!');
    
    let csv = 'Rank,Team Name,Score\n';
    sorted.forEach((p, idx) => { csv += (idx + 1) + ',"' + p.name + '",' + p.score + '\n'; });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'TriviaMania_Leaderboard.csv');
    a.click();
}

function renderPlaylist() {
    const container = document.getElementById('playlistContainer');
    const queueEl = document.getElementById('hostPlaylistQueue');
    const countEl = document.getElementById('playlistCount');
    if (countEl) countEl.textContent = playlist.length;
    
    if (playlist.length === 0) {
        if (container) container.innerHTML = '<p style="color: var(--muted); font-size: 13px;">No rounds in playlist yet.</p>';
        if (queueEl) queueEl.innerHTML = '<p style="color: var(--muted); font-size: 13px;">No rounds loaded in queue yet.</p>';
        return;
    }
    
    let html = '';
    playlist.forEach((round, index) => {
        html += `<div class="playlist-card"><div><strong>${index + 1}. ${round.name}</strong></div><div><button class="btn-play" style="padding: 4px 10px; margin-top:0; font-size: 11px;" onclick="loadRound(${index})">📂 Load</button><button class="btn-danger" onclick="deleteRound(${index})">Delete</button></div></div>`;
    });
    
    if (container) container.innerHTML = html;
    if (queueEl) queueEl.innerHTML = html;
}

function loadRound(index) {
    const round = playlist[index];
    if (!round) return alert('Round not found!');
    socket.emit('hostAction', { action: 'loadRound', payload: round });
    alert('Loaded "' + round.name + '" into live game queue!');
}

function deleteRound(index) {
    playlist.splice(index, 1);
    renderPlaylist();
}

socket.on('updatePlayers', function(players) {
    latestPlayersState = players;
    const countEl = document.getElementById('playerCount');
    if (countEl) countEl.textContent = Object.keys(players).length;
    
    const listEl = document.getElementById('hostScoreList');
    if (listEl) {
        if (Object.keys(players).length === 0) {
            listEl.innerHTML = '<p style="color: var(--muted); font-size: 13px;">No teams connected yet.</p>';
        } else {
            const sorted = Object.values(players).sort((a, b) => b.score - a.score);
            let html = '';
            sorted.forEach((p, idx) => {
                html += `<div class="score-row"><span>${idx + 1}. ${p.avatar} <strong>${p.name}</strong></span><span style="color:var(--accent);">${p.score} pts</span></div>`;
            });
            listEl.innerHTML = html;
        }
    }
});

socket.on('pollUpdate', function(poll) {
    const votesListEl = document.getElementById('hostPollVotesList');
    if (!votesListEl) return;

    if (!poll.active || !poll.votes || Object.keys(poll.votes).length === 0) {
        votesListEl.innerHTML = '<p style="color: var(--muted); font-size: 13px;">No votes recorded yet.</p>';
        return;
    }

    let html = '';
    Object.values(poll.votes).forEach(v => {
        html += `<div class="score-row"><span><strong>${v.name}</strong></span><span style="color:var(--accent);">${v.vote}</span></div>`;
    });
    votesListEl.innerHTML = html;
});

window.onload = function() {
    renderSavedAds();
};
