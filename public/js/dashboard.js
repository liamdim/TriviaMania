function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(function(el) {
        el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(function(el) {
        el.classList.remove('active');
    });
    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.classList.add('active');
    }
    if (btn) {
        btn.classList.add('active');
    }
}

const socket = io();
let playlist = [];
let latestPlayersState = {};

// --- DYNAMIC ROUND GENERATOR FETCHING FROM SERVER TEXT FILES ---
async function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryKey = select ? select.value : "general";
    const genreName = select ? select.options[select.selectedIndex].text : "Trivia Round";
    const countSelect = document.getElementById('triviaCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;
    
    try {
        const response = await fetch(`/api/questions/${categoryKey}?count=${targetCount}`);
        const questionsData = await response.json();
        
        if (!Array.isArray(questionsData) || questionsData.length === 0) {
            alert('Could not load questions for this category. Make sure the text file exists in your categories folder.');
            return;
        }

        const questions = questionsData.map(function(item) {
            return {
                q: item.q,
                a: item.a,
                options: [...item.options].sort(function() { return Math.random() - 0.5; }),
                type: 'trivia'
            };
        });

        playlist.push({ 
            id: Date.now(), 
            name: genreName + " (" + questions.length + " Qs)", 
            questions: questions, 
            timer: 15, 
            betweenDelay: 5, 
            speedBonus: true 
        });
        
        renderPlaylist();
        alert('Successfully loaded ' + questions.length + ' questions from ' + genreName + ' text file!');
    } catch (e) {
        console.error(e);
        alert('Error fetching questions from server.');
    }
}

function addKidsRound() { alert('Use the main Trivia dropdown for all categories!'); }
function addMusicRound() { alert('Use the main Trivia dropdown for all categories!'); }
function addPictureRound() { alert('Picture rounds are streamlined.'); }

// Control & Action Handlers
function sendAction(action) { socket.emit('hostAction', { action: action }); }
function pushAdvert(target) { socket.emit('hostAction', { action: 'pushAdvert', payload: { target: target } }); alert('Advert action triggered.'); }
function hideAdvert(target) { socket.emit('hostAction', { action: 'hideAdvert', payload: { target: target } }); alert('Advert hidden.'); }
function toggleTipJar() { socket.emit('hostAction', { action: 'toggleTipJar' }); }
function togglePoll() { socket.emit('hostAction', { action: 'togglePoll' }); }

function saveSettings() {
    const titleInput = document.getElementById('eventTitleInput');
    socket.emit('hostAction', { action: 'updateSettings', payload: { eventTitle: titleInput ? titleInput.value : '' } });
    alert('Settings saved.');
}

function exportLeaderboardCSV() {
    const sorted = Object.values(latestPlayersState).sort(function(a, b) { return b.score - a.score; });
    if (sorted.length === 0) return alert('No players to export!');
    
    let csv = 'Rank,Team Name,Score\n';
    sorted.forEach(function(p, idx) { csv += (idx + 1) + ',"' + p.name + '",' + p.score + '\n'; });

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
    if (document.getElementById('playlistCount')) { document.getElementById('playlistCount').textContent = playlist.length; }
    
    if (playlist.length === 0) {
        if (container) container.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No rounds in playlist yet.</p>';
        if (queueEl) queueEl.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No rounds loaded in queue yet.</p>';
        return;
    }
    
    let html = '';
    playlist.forEach(function(round, index) {
        html += '<div class="playlist-card"><div><strong>' + (index + 1) + '. ' + round.name + '</strong></div><div><button class="btn-play" style="padding: 6px 12px; margin-top:0; font-size: 12px;" onclick="loadRound(' + index + ')">📂 Load</button><button class="btn-danger" onclick="deleteRound(' + index + ')">Delete</button></div></div>';
    });
    
    if (container) container.innerHTML = html;
    if (queueEl) queueEl.innerHTML = html;
}

function loadRound(index) {
    const round = playlist[index];
    socket.emit('hostAction', { action: 'loadRound', payload: round });
    alert('Loaded "' + round.name + '" into game queue!');
}

function deleteRound(index) {
    playlist.splice(index, 1);
    renderPlaylist();
}

socket.on('updatePlayers', function(players) {
    latestPlayersState = players;
    var countEl = document.getElementById('playerCount');
    if (countEl) countEl.textContent = Object.keys(players).length;
    
    var listEl = document.getElementById('hostScoreList');
    if (listEl && Object.keys(players).length > 0) {
        var sorted = Object.values(players).sort(function(a, b) { return b.score - a.score; });
        var html = '';
        sorted.forEach(function(p, idx) {
            html += '<div class="score-row"><span>' + (idx + 1) + '. ' + p.avatar + ' <strong>' + p.name + '</strong></span><span style="color:var(--accent);">' + p.score + ' pts</span></div>';
        });
        listEl.innerHTML = html;
    }
});
