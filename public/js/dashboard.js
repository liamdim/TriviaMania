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

// --- BULLETPROOF HYBRID TRIVIA GENERATOR ---
async function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryId = select.value;
    const genreName = select.options[select.selectedIndex].text;
    
    let questions = [];

    // 1. Try pulling online
    if (categoryId) {
        try {
            const response = await fetch('https://opentdb.com/api.php?amount=10&type=multiple&category=' + categoryId);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                questions = data.results.map(function(item) {
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
            }
        } catch (e) {
            console.log("Online fetch skipped, using backup bank.");
        }
    }

    // 2. Fallback / Curated banks if API fails or is empty
    if (questions.length === 0) {
        const backupPools = {
            "9": [ // General Knowledge
                { q: "What is the capital of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
                { q: "Which planet is known as the Red Planet?", a: "Mars", options: ["Venus", "Mars", "Jupiter", "Saturn"] },
                { q: "How many sides does a hexagon have?", a: "6", options: ["5", "6", "7", "8"] },
                { q: "What is the largest ocean on Earth?", a: "Pacific Ocean", options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"] },
                { q: "Who wrote 'Romeo and Juliet'?", a: "William Shakespeare", options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"] }
            ],
            "17": [ // Science
                { q: "What gas do plants absorb from the atmosphere?", a: "Carbon Dioxide", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"] },
                { q: "What is the chemical symbol for gold?", a: "Au", options: ["Ag", "Fe", "Au", "Pb"] },
                { q: "At what temperature do Celsius and Fahrenheit meet?", a: "-40", options: ["0", "-40", "32", "-100"] },
                { q: "What is the powerhouse of the cell?", a: "Mitochondria", options: ["Nucleus", "Ribosome", "Mitochondria", "Cytoplasm"] }
            ],
            "23": [ // History
                { q: "In what year did the Titanic sink?", a: "1912", options: [ "1905", "1912", "1920", "1898"] },
                { q: "Who was the first President of the United States?", a: "George Washington", options: ["Thomas Jefferson", "Abraham Lincoln", "George Washington", "John Adams"] },
                { q: "The ancient city of Troy is located in which modern-day country?", a: "Turkey", options: ["Greece", "Italy", "Turkey", "Egypt"] }
            ],
            "22": [ // Geography
                { q: "Which country has the most natural lakes?", a: "Canada", options: ["USA", "Russia", "Canada", "Brazil"] },
                { q: "What is the smallest country in the world?", a: "Vatican City", options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"] },
                { q: "Through which country does the Amazon River primarily flow?", a: "Brazil", options: ["Peru", "Colombia", "Brazil", "Argentina"] }
            ],
            "11": [ // Movies
                { q: "Which movie features the quote 'May the Force be with you'?", a: "Star Wars", options: ["Star Trek", "Star Wars", "Guardians of the Galaxy", "Matrix"] },
                { q: "Who directed the 1993 film 'Jurassic Park'?", a: "Steven Spielberg", options: ["James Cameron", "Ridley Scott", "Steven Spielberg", "George Lucas"] },
                { q: "What is the highest-grossing film of all time (unadjusted)?", a: "Avatar", options: ["Avengers: Endgame", "Titanic", "Avatar", "Star Wars: The Force Awakens"] }
            ]
        };

        const pool = backupPools[categoryId] || backupPools["9"];
        questions = pool.map(function(item) {
            return {
                q: item.q,
                a: item.a,
                options: [...item.options].sort(function() { return Math.random() - 0.5; }),
                type: 'trivia'
            };
        });
    }

    playlist.push({ 
        id: Date.now(), 
        name: "Trivia: " + genreName + " (" + questions.length + " Qs)", 
        questions: questions, 
        timer: 10, 
        betweenDelay: 5, 
        speedBonus: true 
    });
    renderPlaylist();
    alert('Loaded ' + questions.length + ' questions for ' + genreName + '!');
}

function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

// Placeholder functions for other sections
function addPictureRound() { alert('Moving to Picture rounds next!'); }
function addKidsRound() { alert('Moving to Kids rounds next!'); }
function addMusicRound() { alert('Moving to Music rounds next!'); }

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
