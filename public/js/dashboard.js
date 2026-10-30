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
let storedAdvertBase64 = null;
let latestPlayersState = {};

// --- LIVE STANDARD TRIVIA GENERATOR ---
async function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryId = select.value;
    const genreName = select.options[select.selectedIndex].text;
    
    let url = 'https://opentdb.com/api.php?amount=10&type=multiple';
    if (categoryId) {
        url += '&category=' + categoryId;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const questions = data.results.map(function(item) {
                const incorrect = item.incorrect_answers.map(function(ans) { return decodeHtml(ans); });
                const correct = decodeHtml(item.correct_answer);
                const uniqueOptions = [...new Set([...incorrect, correct])];
                while (uniqueOptions.length < 4 && incorrect.length > 0) {
                    uniqueOptions.push(incorrect[Math.floor(Math.random() * incorrect.length)]);
                }
                return {
                    q: decodeHtml(item.question),
                    a: correct,
                    options: uniqueOptions.sort(function() { return Math.random() - 0.5; }),
                    type: 'trivia'
                };
            });

            playlist.push({ 
                id: Date.now(), 
                name: "Trivia: " + genreName + " (" + questions.length + " Qs)", 
                questions: questions, 
                timer: 10, 
                betweenDelay: 5, 
                speedBonus: true 
            });
            renderPlaylist();
            alert('Successfully pulled 10 fresh questions for ' + genreName + '!');
            return;
        }
    } catch (e) {
        console.error("Error fetching trivia:", e);
    }
    alert('Could not fetch online trivia right now. Please try again!');
}

function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

// Placeholder functions for other tabs so they don't break
function addPictureRound() { alert('Picture section coming up next!'); }
function addKidsRound() { alert('Kids section coming up next!'); }
function addMusicRound() { alert('Music section coming up next!'); }

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
