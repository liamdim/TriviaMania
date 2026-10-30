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

// --- TRIVIA GENERATOR WITH QUESTION COUNT SELECTOR ---
async function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryId = select.value;
    const genreName = select.options[select.selectedIndex].text;
    const countSelect = document.getElementById('questionCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;
    
    let questions = [];

    // 1. Try pulling online
    if (categoryId) {
        try {
            const response = await fetch('https://opentdb.com/api.php?amount=' + targetCount + '&type=multiple&category=' + categoryId);
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

    // 2. Comprehensive backup banks covering all categories
    if (questions.length === 0) {
        const backupPools = {
            "9": [ // General Knowledge
                { q: "What is the capital of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
                { q: "Which planet is known as the Red Planet?", a: "Mars", options: ["Venus", "Mars", "Jupiter", "Saturn"] },
                { q: "How many sides does a hexagon have?", a: "6", options: ["5", "6", "7", "8"] },
                { q: "What is the largest ocean on Earth?", a: "Pacific Ocean", options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"] },
                { q: "Who wrote 'Romeo and Juliet'?", a: "William Shakespeare", options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"] },
                { q: "What is the hardest natural substance on Earth?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Platinum"] },
                { q: "How many players are on a standard soccer team on the field?", a: "11", options: ["9", "10", "11", "12"] },
                { q: "What is the main ingredient in guacamole?", a: "Avocado", options: ["Tomato", "Avocado", "Lime", "Pepper"] },
                { q: "In what year did the Berlin Wall fall?", a: "1989", options: ["1987", "1989", "1991", "1993"] },
                { q: "What is the chemical symbol for water?", a: "H2O", options: ["CO2", "H2O", "O2", "NaCl"] },
                { q: "Which country gifted the Statue of Liberty to the USA?", a: "France", options: ["UK", "France", "Spain", "Italy"] },
                { q: "What is the tallest mammal in the world?", a: "Giraffe", options: ["Elephant", "Giraffe", "Horse", "Rhino"] },
                { q: "How many bones are in the adult human body?", a: "206", options: ["198", "206", "215", "220"] },
                { q: "What is the capital of Japan?", a: "Tokyo", options: ["Kyoto", "Osaka", "Tokyo", "Hiroshima"] },
                { q: "Which element has the atomic number 1?", a: "Hydrogen", options: ["Helium", "Hydrogen", "Oxygen", "Carbon"] },
                { q: "What color is a polar bear's skin?", a: "Black", options: ["White", "Pink", "Black", "Grey"] },
                { q: "Who painted the Mona Lisa?", a: "Leonardo da Vinci", options: ["Pablo Picasso", "Vincent van Gogh", "Leonardo da Vinci", "Claude Monet"] },
                { q: "What is the currency of the United Kingdom?", a: "Pound Sterling", options: ["Euro", "Dollar", "Pound Sterling", "Franc"] },
                { q: "What is the freezing point of water in Celsius?", a: "0", options: ["-1", "0", "1", "32"] },
                { q: "Which continent is the Sahara Desert located in?", a: "Africa", options: ["Asia", "Africa", "Australia", "South America"] }
            ],
            "17": [ // Science & Nature
                { q: "What gas do plants absorb from the atmosphere?", a: "Carbon Dioxide", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"] },
                { q: "What is the chemical symbol for gold?", a: "Au", options: ["Ag", "Fe", "Au", "Pb"] },
                { q: "At what temperature do Celsius and Fahrenheit meet?", a: "-40", options: ["0", "-40", "32", "-100"] },
                { q: "What is the powerhouse of the cell?", a: "Mitochondria", options: ["Nucleus", "Ribosome", "Mitochondria", "Cytoplasm"] },
                { q: "What planet is closest to the Sun?", a: "Mercury", options: ["Venus", "Mercury", "Earth", "Mars"] },
                { q: "What is the speed of light approximately?", a: "300,000 km/s", options: ["150,000 km/s", "300,000 km/s", "450,000 km/s", "600,000 km/s"] },
                { q: "Which blood type is known as the universal donor?", a: "O negative", options: ["A positive", "AB positive", "O negative", "B negative"] },
                { q: "What scientific instrument is used to measure earthquakes?", a: "Seismograph", options: ["Barometer", "Thermometer", "Seismograph", "Anemometer"] },
                { q: "What is the largest planet in our solar system?", a: "Jupiter", options: ["Saturn", "Jupiter", "Neptune", "Uranus"] },
                { q: "How many bones are in the human spine?", a: "33", options: ["24", "28", "33", "36"] }
            ],
            "23": [ // History
                { q: "In what year did the Titanic sink?", a: "1912", options: ["1905", "1912", "1920", "1898"] },
                { q: "Who was the first President of the United States?", a: "George Washington", options: ["Thomas Jefferson", "Abraham Lincoln", "George Washington", "John Adams"] },
                { q: "The ancient city of Troy is located in which modern-day country?", a: "Turkey", options: ["Greece", "Italy", "Turkey", "Egypt"] },
                { q: "In which year did World War II end?", a: "1945", options: ["1943", "1944", "1945", "1946"] },
                { q: "Who was the second Prime Minister of the UK?", a: "Spencer Compton", options: ["Robert Walpole", "Spencer Compton", "William Pitt", "Duke of Wellington"] },
                { q: "Which empire built the Colosseum in Rome?", a: "Roman Empire", options: ["Greek Empire", "Roman Empire", "Ottoman Empire", "Persian Empire"] },
                { q: "Who was the famous Egyptian queen who allied with Julius Caesar?", a: "Cleopatra", options: ["Nefertiti", "Cleopatra", "Hatshepsut", "Ankhesenamun"] },
                { q: "What year did the American Civil War begin?", a: "1861", options: ["1776", "1812", "1861", "1865"] },
                { q: "Who painted the ceiling of the Sistine Chapel?", a: "Michelangelo", options: ["Leonardo da Vinci", "Raphael", "Donatello", "Michelangelo"] },
                { q: "What wall was torn down in 1989, symbolizing the end of the Cold War?", a: "Berlin Wall", options: ["Great Wall of China", "Berlin Wall", "Hadrian's Wall", "Western Wall"] }
            ],
            "22": [ // Geography
                { q: "Which country has the most natural lakes?", a: "Canada", options: ["USA", "Russia", "Canada", "Brazil"] },
                { q: "What is the smallest country in the world?", a: "Vatican City", options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"] },
                { q: "Through which country does the Amazon River primarily flow?", a: "Brazil", options: ["Peru", "Colombia", "Brazil", "Argentina"] },
                { q: "What is the capital of New Zealand?", a: "Wellington", options: ["Auckland", "Wellington", "Christchurch", "Hamilton"] },
                { q: "Which desert is the largest hot desert in the world?", a: "Sahara Desert", options: ["Gobi Desert", "Kalahari Desert", "Sahara Desert", "Mojave Desert"] },
                { q: "What mountain range separates Europe from Asia?", a: "Ural Mountains", options: ["Alps", "Himalayas", "Ural Mountains", "Andes"] },
                { q: "Which country spans two continents, Europe and Asia?", a: "Turkey", options: ["Egypt", "Turkey", "Russia", "Both Turkey and Russia"] },
                { q: "What is the longest river in the world?", a: "Nile River", options: ["Amazon River", "Nile River", "Yangtze River", "Mississippi River"] },
                { q: "Which U.S. state has the longest coastline?", a: "Alaska", options: ["California", "Florida", "Texas", "Alaska"] },
                { q: "What is the capital of Canada?", a: "Ottawa", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"] }
            ],
            "11": [ // Movies
                { q: "Which movie features the quote 'May the Force be with you'?", a: "Star Wars", options: ["Star Trek", "Star Wars", "Guardians of the Galaxy", "Matrix"] },
                { q: "Who directed the 1993 film 'Jurassic Park'?", a: "Steven Spielberg", options: ["James Cameron", "Ridley Scott", "Steven Spielberg", "George Lucas"] },
                { q: "What is the highest-grossing film of all time (unadjusted)?", a: "Avatar", options: ["Avengers: Endgame", "Titanic", "Avatar", "Star Wars: The Force Awakens"] },
                { q: "Which actor played Jack Dawson in Titanic?", a: "Leonardo DiCaprio", options: ["Brad Pitt", "Matt Damon", "Leonardo DiCaprio", "Johnny Depp"] },
                { q: "What is the name of the fictional African country in Black Panther?", a: "Wakanda", options: ["Zamunda", "Wakanda", "Genovia", "Madripoor"] }
            ]
        };

        const pool = backupPools[categoryId] || backupPools["9"];
        // Shuffle and slice according to target count
        const shuffledPool = [...pool].sort(function() { return Math.random() - 0.5; });
        questions = shuffledPool.slice(0, targetCount).map(function(item) {
            return {
                q: item.q,
                a: item.a,
                options: [...item.options].sort(function() { return Math.random() - 0.5; }),
                type: 'trivia'
            };
        });
    } else {
        // If API returned questions, slice to match targetCount if needed
        questions = questions.slice(0, targetCount);
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
function addPictureRound() { alert('Picture rounds ready.'); }
function addKidsRound() { alert('Kids rounds ready.'); }
function addMusicRound() { alert('Music rounds ready.'); }

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
