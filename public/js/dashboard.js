function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(function(el) {
        el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(function(el) {
        el.classList.remove('active');
    });
    document.getElementById('tab-' + tabId).classList.add('active');
    if (btn) {
        btn.classList.add('active');
    }
}

const socket = io();
let playlist = [];

function sendAction(action) {
    socket.emit('hostAction', { action: action });
}

function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const genreName = select.options[select.selectedIndex].text;
    playlist.push({ id: Date.now(), name: "Trivia: " + genreName, type: 'trivia', questions: [] });
    renderPlaylist();
    alert('Added Standard Trivia Round: ' + genreName);
}

function addPictureRound() {
    const select = document.getElementById('pictureGenreSelect');
    const genreName = select.options[select.selectedIndex].text;
    playlist.push({ id: Date.now(), name: "Picture: " + genreName, type: 'picture', questions: [] });
    renderPlaylist();
    alert('Added Picture Round: ' + genreName);
}

function addKidsRound() {
    const select = document.getElementById('kidsGenreSelect');
    const genreName = select.options[select.selectedIndex].text;
    playlist.push({ id: Date.now(), name: "Kids & Family: " + genreName, type: 'kids', questions: [] });
    renderPlaylist();
    alert('Added Kids Round: ' + genreName);
}

function addMusicRound() {
    const select = document.getElementById('musicGenreSelect');
    const genreName = select.options[select.selectedIndex].text;
    playlist.push({ id: Date.now(), name: "Music: " + genreName, type: 'music', questions: [] });
    renderPlaylist();
    alert('Added Music Round: ' + genreName);
}

function renderPlaylist() {
    const container = document.getElementById('playlistContainer');
    const queueEl = document.getElementById('hostPlaylistQueue');
    document.getElementById('playlistCount').textContent = playlist.length;
    
    if (playlist.length === 0) {
        container.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No rounds in playlist yet.</p>';
        if (queueEl) queueEl.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No rounds loaded in queue yet.</p>';
        return;
    }
    
    let html = '';
    playlist.forEach(function(round, index) {
        html += '<div class="playlist-card"><div><strong>' + (index + 1) + '. ' + round.name + '</strong></div><div><button class="btn-play" style="padding: 6px 12px; margin-top:0; font-size: 12px;" onclick="loadRound(' + index + ')">📂 Load</button><button class="btn-danger" onclick="deleteRound(' + index + ')">Delete</button></div></div>';
    });
    
    container.innerHTML = html;
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

function pushAdvert() { alert('Advert pushed.'); }
function hideAdvert() { alert('Advert hidden.'); }
function toggleTipJar() { alert('Tip jar toggled.'); }
function togglePoll() { alert('Poll toggled.'); }
function saveSettings() { alert('Settings saved.'); }
function exportLeaderboardCSV() { alert('Leaderboard exported.'); }

socket.on('updatePlayers', function(players) {
    var countEl = document.getElementById('playerCount');
    if (countEl) countEl.textContent = Object.keys(players).length;
});
