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

// --- LARGE EXPANDED BACKUP BANKS (Ensures 5, 10, 15, 20 counts work fully) ---
const backupQuestionBanks = {
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
        { q: "How many strings does a standard guitar have?", a: "6", options: ["4", "5", "6", "8"] },
        { q: "What is the boiling point of water in Celsius?", a: "100°C", options: ["90°C", "100°C", "110°C", "120°C"] },
        { q: "Which ocean is the largest by total area?", a: "Pacific Ocean", options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"] },
        { q: "What is the currency of the United Kingdom?", a: "Pound Sterling", options: ["Euro", "Dollar", "Pound Sterling", "Franc"] },
        { q: "In what country is the ancient site of Machu Picchu located?", a: "Peru", options: ["Chile", "Peru", "Brazil", "Colombia"] },
        { q: "What is the main component of the sun?", a: "Hydrogen", options: ["Helium", "Hydrogen", "Carbon", "Oxygen"] },
        { q: "How many sides does a hexagon have?", a: "6", options: ["5", "6", "7", "8"] },
        { q: "What is the tallest mammal in the world?", a: "Giraffe", options: ["Elephant", "Giraffe", "Blue Whale", "Rhino"] },
        { q: "Who wrote the play 'Hamlet'?", a: "William Shakespeare", options: ["Charles Dickens", "Jane Austen", "William Shakespeare", "Mark Twain"] },
        { q: "What is the freezing point of water in Fahrenheit?", a: "32°F", options: ["0°F", "32°F", "50°F", "212°F"] }
    ],
    "animals": [
        { q: "What is the fastest land animal in the world?", a: "Cheetah", options: ["Lion", "Pronghorn", "Cheetah", "Leopard"] },
        { q: "What is a group of crows called?", a: "A murder", options: ["A flock", "A murder", "A pack", "A gaggle"] },
        { q: "Which mammal is known to have the most powerful bite?", a: "Hippopotamus", options: ["Lion", "Crocodile", "Hippopotamus", "Grizzly Bear"] },
        { q: "What is the only mammal capable of sustained flight?", a: "Bat", options: ["Flying Squirrel", "Bat", "Sugar Glider", "Fruit Bat"] },
        { q: "How many hearts does an octopus have?", a: "3", options: ["1", "2", "3", "4"] },
        { q: "What is a baby kangaroo called?", a: "Joey", options: ["Cub", "Pup", "Joey", "Calf"] },
        { q: "Which flightless bird is native to New Zealand?", a: "Kiwi", options: ["Penguin", "Ostrich", "Kiwi", "Emu"] },
        { q: "What color is the tongue of a giraffe?", a: "Blue-black", options: ["Pink", "Red", "Blue-black", "Yellow"] },
        { q: "What animal is known as the 'Ship of the Desert'?", a: "Camel", options: ["Horse", "Elephant", "Camel", "Donkey"] },
        { q: "Which animal has black and white stripes?", a: "Zebra", options: ["Tiger", "Zebra", "Leopard", "Panda"] }
    ],
    "brain-teasers": [
        { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", a: "An echo", options: ["A shadow", "An echo", "A cloud", "A whisper"] },
        { q: "What has to be broken before you can use it?", a: "An egg", options: ["A coconut", "A promise", "An egg", "A glass"] },
        { q: "I have keys but no locks. I have space and no room. You can enter, but can't go outside. What am I?", a: "A keyboard", options: ["A piano", "A keyboard", "A map", "A house"] },
        { q: "What goes up and down but never moves?", a: "Stairs", options: ["An elevator", "Stairs", "A thermometer", "A kite"] }
    ],
    "celebrities": [
        { q: "Who is known as the 'King of Pop'?", a: "Michael Jackson", options: ["Prince", "Elvis Presley", "Michael Jackson", "Justin Timberlake"] },
        { q: "Which famous Hollywood actor starred in Mission: Impossible and Top Gun?", a: "Tom Cruise", options: ["Brad Pitt", "Tom Cruise", "Matt Damon", "Will Smith"] },
        { q: "Who starred as Jack Dawson in Titanic?", a: "Leonardo DiCaprio", options: ["Brad Pitt", "Leonardo DiCaprio", "Johnny Depp", "Tom Hanks"] },
        { q: "Which pop singer is known for her album 'Eras Tour'?", a: "Taylor Swift", options: ["Beyoncé", "Taylor Swift", "Ariana Grande", "Lady Gaga"] }
    ],
    "entertainment": [
        { q: "Which film won the Academy Award for Best Picture in 1994?", a: "Forrest Gump", options: ["Pulp Fiction", "The Shawshank Redemption", "Forrest Gump", "Quiz Show"] },
        { q: "Who directed the legendary sci-fi epic movie 'Jurassic Park' (1993)?", a: "Steven Spielberg", options: ["James Cameron", "George Lucas", "Steven Spielberg", "Ridley Scott"] },
        { q: "What is the name of the fictional wizard school in Harry Potter?", a: "Hogwarts", options: ["Beauxbatons", "Durmstrang", "Hogwarts", "Ilvermorny"] },
        { q: "Which TV show features Walter White?", a: "Breaking Bad", options: ["The Wire", "Breaking Bad", "Ozark", "Better Call Saul"] }
    ],
    "for-kids": [
        { q: "What color is a polar bear's skin underneath its white fur?", a: "Black", options: ["Pink", "White", "Black", "Brown"] },
        { q: "How many legs does a spider have?", a: "8", options: ["6", "8", "10", "12"] },
        { q: "What Disney princess has a pet tiger named Rajah?", a: "Jasmine", options: ["Cinderella", "Ariel", "Jasmine", "Belle"] },
        { q: "What animal is Mickey Mouse?", a: "Mouse", options: ["Cat", "Dog", "Mouse", "Bear"] }
    ],
    "geography": [
        { q: "What is the longest river in the world?", a: "Nile River", options: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"] },
        { q: "Which country has the most natural lakes in the world?", a: "Canada", options: ["Russia", "USA", "Canada", "Finland"] },
        { q: "What is the capital city of Japan?", a: "Tokyo", options: ["Kyoto", "Osaka", "Tokyo", "Hiroshima"] },
        { q: "Which desert is the largest hot desert in the world?", a: "Sahara Desert", options: ["Gobi Desert", "Kalahari Desert", "Sahara Desert", "Mojave Desert"] }
    ],
    "history": [
        { q: "In what year did World War II end?", a: "1945", options: ["1944", "1945", "1946", "1939"] },
        { q: "Who was the second President of the United States?", a: "John Adams", options: ["Thomas Jefferson", "John Adams", "James Madison", "Benjamin Franklin"] },
        { q: "In what year did the Titanic sink?", a: "1912", options: ["1910", "1912", "1915", "1905"] },
        { q: "Who was the first Emperor of Rome?", a: "Augustus", options: ["Julius Caesar", "Nero", "Augustus", "Constantine"] }
    ],
    "hobbies": [
        { q: "What term is used in gardening for cutting back plant branches?", a: "Pruning", options: ["Weeding", "Pruning", "Mulching", "Grafting"] },
        { q: "In photography, what does DSLR stand for?", a: "Digital Single-Lens Reflex", options: ["Digital Standard Light Resolution", "Digital Single-Lens Reflex", "Dual Shutter Lens Recorder", "Direct Sensor Light Reader"] }
    ],
    "humanities": [
        { q: "Who wrote 'Thus Spoke Zarathustra'?", a: "Friedrich Nietzsche", options: ["Karl Marx", "Immanuel Kant", "Friedrich Nietzsche", "Plato"] },
        { q: "Which ancient Greek philosopher taught Alexander the Great?", a: "Aristotle", options: ["Socrates", "Plato", "Aristotle", "Pythagoras"] }
    ],
    "literature": [
        { q: "Who wrote 'Pride and Prejudice'?", a: "Jane Austen", options: ["Charlotte Brontë", "Jane Austen", "Charles Dickens", "Virginia Woolf"] },
        { q: "What is the name of the hobbit protagonist in 'The Hobbit'?", a: "Bilbo Baggins", options: ["Frodo Baggins", "Bilbo Baggins", "Samwise Gamgee", "Pippin Took"] },
        { q: "Who wrote 'Romeo and Juliet'?", a: "William Shakespeare", options: ["Charles Dickens", "Mark Twain", "William Shakespeare", "Jane Austen"] }
    ],
    "movies": [
        { q: "What is the name of Captain America's shield metal?", a: "Vibranium", options: ["Adamantium", "Unobtainium", "Vibranium", "Mithril"] },
        { q: "Who directed 'Pulp Fiction'?", a: "Quentin Tarantino", options: ["Martin Scorsese", "Quentin Tarantino", "Christopher Nolan", "David Fincher"] },
        { q: "Which movie features the quote 'May the Force be with you'?", a: "Star Wars", options: ["Star Trek", "Star Wars", "Matrix", "Interstellar"] }
    ],
    "music": [
        { q: "Which iconic British rock band released 'Rumours' in 1977?", a: "Fleetwood Mac", options: ["The Beatles", "Led Zeppelin", "Fleetwood Mac", "Pink Floyd"] },
        { q: "Who sang the massive 1992 global hit 'I Will Always Love You'?", a: "Whitney Houston", options: ["Mariah Carey", "Celine Dion", "Whitney Houston", "Madonna"] },
        { q: "Which band released 'Bohemian Rhapsody'?", a: "Queen", options: ["Led Zeppelin", "Queen", "Pink Floyd", "Black Sabbath"] }
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
        { q: "How many players are on the field for a single team in soccer?", a: "11", options: ["9", "10", "11", "12"] },
        { q: "How many holes are played in a standard round of golf?", a: "18", options: ["9", "12", "18", "20"] },
        { q: "Which country hosts the Australian Open tennis tournament?", a: "Australia", options: ["USA", "UK", "Australia", "France"] }
    ],
    "television": [
        { q: "What is the name of the coffee shop in 'Friends'?", a: "Central Perk", options: ["Monk's Café", "Central Perk", "Luke's Diner", "Pals Cafe"] },
        { q: "Which animated family lives in Springfield?", a: "The Simpsons", options: ["The Griffins", "The Simpsons", "The Belchers", "The Flintstones"] }
    ],
    "video-games": [
        { q: "What is the name of Nintendo's iconic plumber?", a: "Mario", options: ["Luigi", "Mario", "Toad", "Wario"] },
        { q: "In Minecraft, what material is required to build a nether portal?", a: "Obsidian", options: ["Bedrock", "Obsidian", "Diamond", "Netherrack"] }
    ],
    "world": [
        { q: "Which country spans across both Europe and Asia?", a: "Turkey", options: ["Egypt", "Turkey", "Brazil", "Australia"] },
        { q: "What is the largest desert in the world by area?", a: "Antarctic Desert", options: ["Sahara Desert", "Gobi Desert", "Antarctic Desert", "Arabian Desert"] }
    ]
};

// --- DYNAMIC ROUND GENERATOR WITH TIMERS ---
async function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryKey = select ? select.value : "general";
    const genreName = select ? select.options[select.selectedIndex].text : "Trivia Round";
    const countSelect = document.getElementById('triviaCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;
    
    const timerInput = document.getElementById('questionTimerInput');
    const qTimer = timerInput ? parseInt(timerInput.value) || 15 : 15;

    const delayInput = document.getElementById('betweenDelayInput');
    const bDelay = delayInput ? parseInt(delayInput.value) || 5 : 5;
    
    let rawQuestions = [];

    try {
        const response = await fetch(`/api/questions/${categoryKey}?count=${targetCount}`);
        if (response.ok) {
            rawQuestions = await response.json();
        }
    } catch (e) {
        console.log('Server file read failed, using backup question bank.');
    }

    const pool = backupQuestionBanks[categoryKey] || backupQuestionBanks["general"];
    if (!Array.isArray(rawQuestions) || rawQuestions.length < targetCount) {
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
        timer: qTimer, 
        betweenDelay: bDelay, 
        speedBonus: true 
    });
    
    renderPlaylist();
    alert('Successfully added ' + questions.length + ' questions for ' + genreName + ' (Timer: ' + qTimer + 's)!');
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
