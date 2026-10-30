function switchTab(tabId, btn) {
    var contents = document.querySelectorAll('.tab-content');
    for (var i = 0; i < contents.length; i++) {
        contents[i].classList.remove('active');
    }
    var buttons = document.querySelectorAll('.tab-btn');
    for (var j = 0; j < buttons.length; j++) {
        buttons[j].classList.remove('active');
    }
    var target = document.getElementById('tab-' + tabId);
    if (target) {
        target.classList.add('active');
    }
    if (btn) {
        btn.classList.add('active');
    }
}

const socket = io();
let playlist = [];

function sendAction(action) {
    socket.emit('hostAction', { action: action });
}

function pushAdvert(target) {
    alert('Advert feature ready.');
}

function hideAdvert(target) {
    alert('Advert hidden.');
}

function toggleTipJar() {
    socket.emit('hostAction', { action: 'toggleTipJar' });
}

function togglePoll() {
    socket.emit('hostAction', { action: 'togglePoll' });
}

function saveSettings() {
    alert('Settings saved.');
}

function savePollSettings() {
    alert('Poll saved.');
}

function exportLeaderboardCSV() {
    alert('Leaderboard exported.');
}

function addCustomRoundToPlaylist() {
    alert('Custom round added.');
}

function addPictureRoundToPlaylist() {
    alert('Picture round added.');
}

function addTriviaToPlaylist() {
    alert('Trivia round added.');
}

function addKidsRoundToPlaylist() {
    alert('Kids round added.');
}

function addCuratedMusicRound() {
    alert('Music round added.');
}

function loadRound(index) {
    alert('Round loaded.');
}

function deleteRound(index) {
    playlist.splice(index, 1);
}

socket.on('updatePlayers', function(players) {
    var countEl = document.getElementById('playerCount');
    if (countEl) {
        countEl.textContent = Object.keys(players).length;
    }
});
