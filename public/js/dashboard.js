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

// --- COMPREHENSIVE FALLBACK QUESTION BANKS ---
const backupQuestionBanks = {
    "general": [
        { q: "What is the capital city of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
        { q: "Which chemical element has the symbol 'Au'?", a: "Gold", options: ["Silver", "Gold", "Copper", "Argon"] },
        { q: "How many bones are in the adult human body?", a: "206", options: ["200", "206", "214", "198"] },
        { q: "What is the hardest natural substance on Earth?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Quartz"] },
        { q: "Which planet in our solar system is the largest?", a: "Jupiter", options: ["Saturn", "Jupiter", "Neptune", "Earth"] },
        { q: "In what year did the American Apollo 11 mission land on the moon?", a: "1969", options: ["1967", "1969", "1971", "1965"] }
    ],
    "movies": [
        { q: "Which film won the Academy Award for Best Picture in 1994?", a: "Forrest Gump", options: ["Pulp Fiction", "The Shawshank Redemption", "Forrest Gump", "Quiz Show"] },
        { q: "Who directed the legendary sci-fi epic movie 'Jurassic Park' (1993)?", a: "Steven Spielberg", options: ["James Cameron", "George Lucas", "Steven Spielberg", "Ridley Scott"] },
        { q: "What is the name of the fictional metal that Captain America's shield is made of?", a: "Vibranium", options: ["Adamantium", "Unobtainium", "Vibranium", "Mithril"] },
        { q: "Who directed the 1994 cult classic crime film 'Pulp Fiction'?", a: "Quentin Tarantino", options: ["Martin Scorsese", "Quentin Tarantino", "Christopher Nolan", "David Fincher"] }
    ],
    "history": [
        { q: "In what year did World War II end?", a: "1945", options: ["1944", "1945", "1946", "1939"] },
        { q: "Who was the second President of the United States?", a: "John Adams", options: ["Thomas Jefferson", "John Adams", "James Madison", "Benjamin Franklin"] },
        { q: "In what year did the Great Fire of London take place?", a: "1666", options: ["1066", "1215", "1666", "1805"] },
        { q: "Who was the British Prime Minister during most of World War II?", a: "Winston Churchill", options: ["Neville Chamberlain", "Winston Churchill", "Clement Attlee", "Anthony Eden"] }
    ],
    "geography": [
        { q: "What is the longest river in the world?", a: "Nile River", options: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"] },
        { q: "Which country has the most natural lakes in the world?", a: "Canada", options: ["Russia", "USA", "Canada", "Finland"] },
        { q: "What is the highest mountain peak in the United Kingdom?", a: "Ben Nevis", options: ["Snowdon", "Scafell Pike", "Ben Nevis", "Slieve Donard"] }
    ],
    "sports": [
        { q: "How many players are on the field for a single team in a standard soccer match?", a: "11", options: ["9", "10", "11", "12"] },
        { q: "How many holes are played in a standard round of golf?", a: "18", options: ["9", "12", "18", "20"] },
        { q: "Which English football club has won the most top-flight league titles?", a: "Manchester United", options: ["Liverpool", "Manchester United", "Arsenal", "Manchester City"] }
    ],
    "music": [
        { q: "Which iconic British rock band released the 1977 album 'Rumours'?", a: "Fleetwood Mac", options: ["The Beatles", "Led Zeppelin", "Fleetwood Mac", "Pink Floyd"] },
        { q: "Who sang the massive 1992 global hit 'I Will Always Love You'?", a: "Whitney Houston", options: ["Mariah Carey", "Celine Dion", "Whitney Houston", "Madonna"] },
        { q: "Which band released the iconic rock anthem 'Bohemian Rhapsody'?", a: "Queen", options: ["Led Zeppelin", "Queen", "Pink Floyd", "Black Sabbath"] }
    ]
};

// --- DYNAMIC ROUND GENERATOR ---
async function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryKey = select ? select.value : "general";
    const genreName = select ? select.options[select.selectedIndex].text : "Trivia Round";
    const countSelect = document.getElementById('triviaCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;
    
    let rawQuestions = [];

    try {
        const response = await fetch(`/api/questions/${categoryKey}?count=${targetCount}`);
        if (response.ok) {
            rawQuestions = await response.json();
        }
    } catch (e) {
        console.log('Server file read failed, using backup question bank.');
    }

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        const pool = backupQuestionBanks[categoryKey] || backupQuestionBanks["general"];
        rawQuestions = [...pool];
    }

    const shuffled = [...rawQuestions].sort(function() { return Math.random() - 0.5; });
    const selected = shuffled.slice(0, targetCount);

    const questions = selected.map(function(item) {
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
    alert('Successfully added ' + questions.length + ' questions for ' + genreName + ' to playlist!');
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
    const countEl = document.getElementById('playlistCount');
    if (countEl) { countEl.textContent = playlist.length; }
    
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
    if (!round) return alert('Round not found!');
    
    socket.emit('hostAction', { action: 'loadRound', payload: round });
    alert('Loaded "' + round.name + '" into live game queue! Check your Projector Display tab.');
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
