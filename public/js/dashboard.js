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
    if (usedQuestionHistory.length > 800) {
        usedQuestionHistory = usedQuestionHistory.slice(-800);
    }
    localStorage.setItem('triviamania_history', JSON.stringify(usedQuestionHistory));
}

// --- MASTER QUESTION BANKS FOR ALL 20 OPENTRIVIAQA CATEGORIES ---
const masterTriviaBanks = {
    "general": [
        { q: "What is the capital city of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
        { q: "Which chemical element has the symbol 'Au'?", a: "Gold", options: ["Silver", "Gold", "Copper", "Argon"] },
        { q: "How many bones are in the adult human body?", a: "206", options: ["200", "206", "214", "198"] },
        { q: "What is the hardest natural substance on Earth?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Quartz"] },
        { q: "Which planet in our solar system is the largest?", a: "Jupiter", options: ["Saturn", "Jupiter", "Neptune", "Earth"] },
        { q: "In what year did the American Apollo 11 mission land on the moon?", a: "1969", options: ["1967", "1969", "1971", "1965"] }
    ],
    "animals": [
        { q: "What is the fastest land animal in the world?", a: "Cheetah", options: ["Lion", "Pronghorn", "Cheetah", "Leopard"] },
        { q: "What is a group of crows called?", a: "A murder", options: ["A flock", "A murder", "A pack", "A gaggle"] },
        { q: "Which mammal is known to have the most powerful bite?", a: "Hippopotamus", options: ["Lion", "Crocodile", "Hippopotamus", "Grizzly Bear"] },
        { q: "What is the only mammal capable of sustained flight?", a: "Bat", options: ["Flying Squirrel", "Bat", "Sugar Glider", "Fruit Bat"] }
    ],
    "brain-teasers": [
        { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", a: "An echo", options: ["A shadow", "An echo", "A cloud", "A whisper"] },
        { q: "What has to be broken before you can use it?", a: "An egg", options: ["A coconut", "A promise", "An egg", "A glass"] },
        { q: "I have keys but no locks. I have space and no room. You can enter, but can't go outside. What am I?", a: "A keyboard", options: ["A piano", "A keyboard", "A map", "A house"] }
    ],
    "celebrities": [
        { q: "Who is known as the 'King of Pop'?", a: "Michael Jackson", options: ["Prince", "Elvis Presley", "Michael Jackson", "Justin Timberlake"] },
        { q: "Which famous Hollywood actor starred in Mission: Impossible and Top Gun?", a: "Tom Cruise", options: ["Brad Pitt", "Tom Cruise", "Matt Damon", "Will Smith"] }
    ],
    "entertainment": [
        { q: "Which film won the Academy Award for Best Picture in 1994?", a: "Forrest Gump", options: ["Pulp Fiction", "The Shawshank Redemption", "Forrest Gump", "Quiz Show"] },
        { q: "Who directed the legendary sci-fi epic movie 'Jurassic Park' (1993)?", a: "Steven Spielberg", options: ["James Cameron", "George Lucas", "Steven Spielberg", "Ridley Scott"] }
    ],
    "for-kids": [
        { q: "What color is a polar bear's skin underneath its white fur?", a: "Black", options: ["Pink", "White", "Black", "Brown"] },
        { q: "How many legs does a spider have?", a: "8", options: ["6", "8", "10", "12"] }
    ],
    "geography": [
        { q: "What is the longest river in the world?", a: "Nile River", options: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"] },
        { q: "Which country has the most natural lakes in the world?", a: "Canada", options: ["Russia", "USA", "Canada", "Finland"] }
    ],
    "history": [
        { q: "In what year did World War II end?", a: "1945", options: ["1944", "1945", "1946", "1939"] },
        { q: "Who was the second President of the United States?", a: "John Adams", options: ["Thomas Jefferson", "John Adams", "James Madison", "Benjamin Franklin"] }
    ],
    "hobbies": [
        { q: "What term is used in gardening for the practice of cutting back plant branches to encourage growth?", a: "Pruning", options: ["Weeding", "Pruning", "Mulching", "Grafting"] },
        { q: "In photography, what does 'DSLR' stand for?", a: "Digital Single-Lens Reflex", options: ["Digital Standard Light Resolution", "Digital Single-Lens Reflex", "Dual Shutter Lens Recorder", "Direct Sensor Light Reader"] }
    ],
    "humanities": [
        { q: "Who wrote the philosophical work 'Thus Spoke Zarathustra'?", a: "Friedrich Nietzsche", options: ["Karl Marx", "Immanuel Kant", "Friedrich Nietzsche", "Plato"] },
        { q: "Which ancient Greek philosopher was the teacher of Alexander the Great?", a: "Aristotle", options: ["Socrates", "Plato", "Aristotle", "Pythagoras"] }
    ],
    "literature": [
        { q: "Who wrote the novel 'Pride and Prejudice'?", a: "Jane Austen", options: ["Charlotte Brontë", "Jane Austen", "Charles Dickens", "Virginia Woolf"] },
        { q: "What is the name of the hobbit protagonist in J.R.R. Tolkien's 'The Hobbit'?", a: "Bilbo Baggins", options: ["Frodo Baggins", "Bilbo Baggins", "Samwise Gamgee", "Pippin Took"] }
    ],
    "movies": [
        { q: "What is the name of the fictional metal that Captain America's shield is made of?", a: "Vibranium", options: ["Adamantium", "Unobtainium", "Vibranium", "Mithril"] },
        { q: "Who directed the 1994 cult classic crime film 'Pulp Fiction'?", a: "Quentin Tarantino", options: ["Martin Scorsese", "Quentin Tarantino", "Christopher Nolan", "David Fincher"] }
    ],
    "music": [
        { q: "Which iconic British rock band released the 1977 album 'Rumours'?", a: "Fleetwood Mac", options: ["The Beatles", "Led Zeppelin", "Fleetwood Mac", "Pink Floyd"] },
        { q: "Who sang the massive 1992 global hit 'I Will Always Love You'?", a: "Whitney Houston", options: ["Mariah Carey", "Celine Dion", "Whitney Houston", "Madonna"] }
    ],
    "people": [
        { q: "Who invented the practical incandescent light bulb?", a: "Thomas Edison", options: ["Nikola Tesla", "Thomas Edison", "Alexander Graham Bell", "Benjamin Franklin"] },
        { q: "Who was the first woman to fly solo across the Atlantic Ocean?", a: "Amelia Earhart", options: ["Bessie Coleman", "Amelia Earhart", "Valentina Tereshkova", "Harriet Quimby"] }
    ],
    "religion-faith": [
        { q: "In what city was the Prophet Muhammad born?", a: "Mecca", options: ["Medina", "Jerusalem", "Mecca", "Cairo"] },
        { q: "What is the holy book of Islam called?", a: "Quran", options: ["Bible", "Torah", "Quran", "Vedas"] }
    ],
    "science-technology": [
        { q: "What does CPU stand for in computer hardware?", a: "Central Processing Unit", options: ["Computer Personal Unit", "Central Processing Unit", "Core Processing Utility", "Central Program Utility"] },
        { q: "What is the chemical symbol for gold?", a: "Au", options: ["Ag", "Au", "Pb", "Fe"] }
    ],
    "sports": [
        { q: "How many players are on the field for a single team in a standard soccer match?", a: "11", options: ["9", "10", "11", "12"] },
        { q: "How many holes are played in a standard round of golf?", a: "18", options: ["9", "12", "18", "20"] }
    ],
    "television": [
        { q: "What is the name of the coffee shop frequented by the characters in the sitcom 'Friends'?", a: "Central Perk", options: ["Monk's Café", "Central Perk", "Luke's Diner", "Pals Cafe"] },
        { q: "Which animated TV family lives in the town of Springfield?", a: "The Simpsons", options: ["The Griffins", "The Simpsons", "The Belchers", "The Flintstones"] }
    ],
    "video-games": [
        { q: "What is the name of the plumber protagonist in Nintendo's iconic video game series?", a: "Mario", options: ["Luigi", "Mario", "Toad", "Wario"] },
        { q: "In the game Minecraft, what material is required to build a nether portal?", a: "Obsidian", options: ["Bedrock", "Obsidian", "Diamond", "Netherrack"] }
    ],
    "world": [
        { q: "Which country spans across both Europe and Asia?", a: "Turkey", options: ["Egypt", "Turkey", "Brazil", "Australia"] },
        { q: "What is the largest desert in the world by area?", a: "Antarctic Desert", options: ["Sahara Desert", "Gobi Desert", "Antarctic Desert", "Arabian Desert"] }
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
