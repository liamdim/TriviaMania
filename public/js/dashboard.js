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

// --- ANTI-REPEAT QUESTION HISTORY TRACKER ---
let usedQuestionHistory = JSON.parse(localStorage.getItem('triviamania_history') || '[]');

function filterUnusedQuestions(pool) {
    const fresh = pool.filter(item => !usedQuestionHistory.includes(item.q));
    if (fresh.length < pool.length * 0.2) {
        usedQuestionHistory = [];
        localStorage.setItem('triviamania_history', JSON.stringify([]));
        return pool;
    }
    return fresh;
}

function markQuestionsAsUsed(questions) {
    questions.forEach(item => {
        if (!usedQuestionHistory.includes(item.q)) {
            usedQuestionHistory.push(item.q);
        }
    });
    if (usedQuestionHistory.length > 500) {
        usedQuestionHistory = usedQuestionHistory.slice(-500);
    }
    localStorage.setItem('triviamania_history', JSON.stringify(usedQuestionHistory));
}

// --- MASSIVE OPENTRIVIAQA MASTER DATASET ---
const masterTriviaBanks = {
    "general": [
        { q: "What is the capital city of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
        { q: "Which chemical element has the symbol 'Au'?", a: "Gold", options: ["Silver", "Gold", "Copper", "Argon"] },
        { q: "How many bones are in the adult human body?", a: "206", options: ["200", "206", "214", "198"] },
        { q: "What is the hardest natural substance on Earth?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Quartz"] },
        { q: "Which planet in our solar system is the largest?", a: "Jupiter", options: ["Saturn", "Jupiter", "Neptune", "Earth"] },
        { q: "In what year did the American Apollo 11 mission land on the moon?", a: "1969", options: ["1967", "1969", "1971", "1965"] },
        { q: "What is the primary ingredient in traditional guacamole?", a: "Avocado", options: ["Tomato", "Avocado", "Lime", "Peas"] },
        { q: "Which artist painted the ceiling of the Sistine Chapel?", a: "Michelangelo", options: ["Leonardo da Vinci", "Raphael", "Michelangelo", "Donatello"] },
        { q: "What is the capital of Canada?", a: "Ottawa", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"] },
        { q: "Which gas makes up the majority of Earth's atmosphere?", a: "Nitrogen", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"] },
        { q: "What is the speed of light in a vacuum approximately?", a: "300,000 km/s", options: ["150,000 km/s", "300,000 km/s", "1,000,000 km/s", "30,000 km/s"] },
        { q: "Who wrote the novel 'Pride and Prejudice'?", a: "Jane Austen", options: ["Charlotte Brontë", "Jane Austen", "Charles Dickens", "Virginia Woolf"] },
        { q: "What is the smallest country in the world by land area?", a: "Vatican City", options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"] },
        { q: "Which ocean is the largest on Earth?", a: "Pacific Ocean", options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"] },
        { q: "What is the currency of Japan?", a: "Yen", options: ["Yuan", "Won", "Yen", "Ringgit"] }
    ],
    "entertainment": [
        { q: "Which film won the Academy Award for Best Picture in 1994?", a: "Forrest Gump", options: ["Pulp Fiction", "The Shawshank Redemption", "Forrest Gump", "Quiz Show"] },
        { q: "Who directed the legendary sci-fi epic movie 'Jurassic Park' (1993)?", a: "Steven Spielberg", options: ["James Cameron", "George Lucas", "Steven Spielberg", "Ridley Scott"] },
        { q: "What is the name of the fictional wizard school in the Harry Potter series?", a: "Hogwarts", options: ["Beauxbatons", "Durmstrang", "Hogwarts", "Ilvermorny"] },
        { q: "Which actor played Jack Dawson in the 1997 blockbuster film 'Titanic'?", a: "Leonardo DiCaprio", options: ["Brad Pitt", "Matt Damon", "Leonardo DiCaprio", "Johnny Depp"] },
        { q: "What is the name of the main fictional continent where Game of Thrones takes place?", a: "Westeros", options: ["Essos", "Westeros", "Middle-earth", "Narnia"] },
        { q: "Which animated movie features a friendly ghost named Casper?", a: "Casper", options: ["Beetlejuice", "Ghostbusters", "Casper", "Coraline"] },
        { q: "Who voiced the character of Woody in Pixar's Toy Story?", a: "Tom Hanks", options: ["Tim Allen", "Tom Hanks", "Billy Crystal", "Robin Williams"] },
        { q: "Which television series features Walter White, a chemistry teacher turned drug kingpin?", a: "Breaking Bad", options: ["The Wire", "Breaking Bad", "Ozark", "Better Call Saul"] }
    ],
    "science": [
        { q: "What is the chemical formula for water?", a: "H2O", options: ["CO2", "H2O", "NaCl", "O2"] },
        { q: "At what temperature do Celsius and Fahrenheit scales read the same?", a: "-40", options: ["0", "-32", "-40", "100"] },
        { q: "What is the powerhouse of the cell?", a: "Mitochondria", options: ["Nucleus", "Ribosome", "Mitochondria", "Cytoplasm"] },
        { q: "Which planet is known as the Red Planet?", a: "Mars", options: ["Venus", "Mars", "Jupiter", "Mercury"] },
        { q: "What gas do plants absorb from the atmosphere for photosynthesis?", a: "Carbon Dioxide", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Helium"] },
        { q: "What is the study of weather called?", a: "Meteorology", options: ["Geology", "Meteorology", "Astronomy", "Ecology"] },
        { q: "Which vitamin is synthesized in the skin when exposed to sunlight?", a: "Vitamin D", options: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin B12"] }
    ],
    "sports": [
        { q: "How many players are on the field for a single team in a standard soccer match?", a: "11", options: ["9", "10", "11", "12"] },
        { q: "In which sport do competitors race for the yellow jersey?", a: "Cycling (Tour de France)", options: ["Formula 1", "Cycling (Tour de France)", "Marathon", "Sailing"] },
        { q: "How many holes are played in a standard round of golf?", a: "18", options: ["9", "12", "18", "20"] },
        { q: "Which country hosts the Australian Open tennis tournament?", a: "Australia", options: ["United States", "UK", "Australia", "France"] },
        { q: "In American football, how many points is a touchdown worth without an extra point?", a: "6", options: ["3", "6", "7", "4"] },
        { q: "What is the national sport of Canada?", a: "Lacrosse (Summer) / Ice Hockey (Winter)", options: ["Ice Hockey", "Baseball", "Lacrosse (Summer) / Ice Hockey (Winter)", "Curling"] }
    ],
    "history": [
        { q: "In what year did World War II end?", a: "1945", options: ["1944", "1945", "1946", "1939"] },
        { q: "Who was the second President of the United States?", a: "John Adams", options: ["Thomas Jefferson", "John Adams", "James Madison", "Benjamin Franklin"] },
        { q: "The ancient city of Carthage was located in which modern-day country?", a: "Tunisia", options: ["Egypt", "Greece", "Tunisia", "Italy"] },
        { q: "Which empire built the ancient road system known as the Appian Way?", a: "Roman Empire", options: ["Greek Empire", "Roman Empire", "Persian Empire", "Ottoman Empire"] },
        { q: "Who discovered America in 1492?", a: "Christopher Columbus", options: ["Amerigo Vespucci", "Ferdinand Magellan", "Christopher Columbus", "Vasco da Gama"] }
    ]
};

// --- UNIVERSAL TRIVIA ROUND GENERATOR ---
function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryKey = select ? select.value : "general";
    const genreName = select ? select.options[select.selectedIndex].text : "Trivia Round";
    const countSelect = document.getElementById('triviaCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;
    
    const pool = masterTriviaBanks[categoryKey] || masterTriviaBanks["general"];
    
    // Filter against anti-repeat history
    const availablePool = filterUnusedQuestions(pool);
    const shuffled = [...availablePool].sort(function() { return Math.random() - 0.5; });
    const selected = shuffled.slice(0, targetCount);

    const questions = selected.map(function(item) {
        return {
            q: item.q,
            a: item.a,
            options: [...item.options].sort(function() { return Math.random() - 0.5; }),
            type: 'trivia'
        };
    });

    markQuestionsAsUsed(selected);

    playlist.push({ 
        id: Date.now(), 
        name: genreName + " (" + questions.length + " Qs)", 
        questions: questions, 
        timer: 15, 
        betweenDelay: 5, 
        speedBonus: true 
    });
    
    renderPlaylist();
    alert('Successfully loaded ' + questions.length + ' fresh questions for ' + genreName + '!');
}

// Bypassed/Placeholder sections to keep dashboard clean
function addKidsRound() { alert('Use the main Trivia dropdown for all OpenTriviaQA rounds!'); }
function addMusicRound() { alert('Use the main Trivia dropdown for all OpenTriviaQA rounds!'); }
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
