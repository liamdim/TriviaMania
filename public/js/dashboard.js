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

async function fetchTriviaQuestions(amount, category) {
    let url = 'https://opentdb.com/api.php?amount=' + amount + '&type=multiple';
    if (category) {
        url += '&category=' + category;
    }
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results.map(function(item) {
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
        console.error("Error fetching trivia:", e);
    }
    return [{ q: "What is the capital of France?", a: "Paris", options: ["London", "Paris", "Berlin", "Madrid"], type: 'trivia' }];
}

function addKidsRoundToPlaylist() {
    const kidsPool = [
        { q: "What kind of animal is Simba in The Lion King?", a: "Lion", options: ["Tiger", "Lion", "Leopard", "Cheetah"] },
        { q: "In Frozen, what is the name of Elsa and Anna's kingdom?", a: "Arendelle", options: ["Corona", "Arendelle", "Atlantis", "Agrabah"] },
        { q: "What color is Mickey Mouse's shorts?", a: "Red", options: ["Blue", "Yellow", "Red", "Green"] },
        { q: "What is the name of Andy's cowboy toy in Toy Story?", a: "Woody", options: ["Buzz", "Woody", "Rex", "Slinky"] },
        { q: "Which Pokémon is a yellow electric mouse?", a: "Pikachu", options: ["Charmander", "Squirtle", "Pikachu", "Bulbasaur"] },
        { q: "What fruit do minions love the most?", a: "Banana", options: ["Apple", "Banana", "Strawberry", "Orange"] },
        { q: "What is the name of the sponge who lives in a pineapple under the sea?", a: "SpongeBob SquarePants", options: ["Patrick Star", "SpongeBob SquarePants", "Squidward", "Mr. Krabs"] },
        { q: "In Harry Potter, what is the name of Harry's pet owl?", a: "Hedwig", options: ["Crookshanks", "Scabbers", "Hedwig", "Fang"] },
        { q: "What superhero wears a red and blue suit and climbs walls?", a: "Spider-Man", options: ["Batman", "Superman", "Iron Man", "Spider-Man"] },
        { q: "What color are the spots on a traditional ladybug?", a: "Black", options: ["White", "Yellow", "Black", "Blue"] }
    ];
    kidsPool.sort(function() { return Math.random() - 0.5; });
    const count = parseInt(document.getElementById('questionCountSelect').value);
    const questions = kidsPool.slice(0, count).map(function(item) {
        return {
            q: item.q,
            a: item.a,
            options: [...item.options].sort(function() { return Math.random() - 0.5; }),
            type: 'trivia'
        };
    });

    const timer = parseInt(document.getElementById('timerSelect').value);
    const betweenDelay = parseInt(document.getElementById('delaySelect').value);
    const speedBonus = document.getElementById('speedBonusCheckbox').checked;

    playlist.push({ id: Date.now(), name: "Kids & Cartoons (" + questions.length + " Qs)", questions, timer, betweenDelay, speedBonus });
    renderPlaylist();
    renderHostQueue();
    alert('Added Kids & Cartoons round!');
}

function addCuratedMusicRound() {
    const type = document.getElementById('curatedMusicSelect').value;
    const selectEl = document.getElementById('curatedMusicSelect');
    const genreName = selectEl.options[selectEl.selectedIndex].text;

    const musicLibraries = {
        classic_rock: [
            { q: "Name the artist / band performing this track", a: "Queen", options: ["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/36/53/b7/3653b7c8-7013-8898-7240-23a595c2f5d9/mza_10795287019777178351.m43.aac" },
            { q: "Name the artist / band performing this track", a: "The Beatles", options: ["The Rolling Stones", "The Beatles", "The Who", "The Kinks"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/c6/8e/3c/c68e3c6a-4d2c-8824-3458-1f6b814674d8/mza_11674482098716327668.m43.aac" },
            { q: "Name the artist / band performing this track", a: "Aerosmith", options: ["Guns N' Roses", "AC/DC", "Aerosmith", "Van Halen"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview112/v4/4a/12/3b/4a123b32-901d-5b62-3482-3e2849818817/mza_1416752044810756778.m43.aac" }
        ],
        80s_hits: [
            { q: "Name the artist / band performing this track", a: "Michael Jackson", options: ["Prince", "George Michael", "Michael Jackson", "Lionel Richie"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/d2/88/ef/d288efd1-5544-245f-4a33-2a3162319ef5/mza_7143997193635392817.m43.aac" },
            { q: "Name the artist / band performing this track", a: "Wham!", options: ["Duran Duran", "Culture Club", "Wham!", "Spandau Ballet"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/48/43/d3/4843d3e2-b80c-6869-7987-a2f01f84524c/mza_11942186716075654326.m43.aac" }
        ],
        90s_hits: [
            { q: "Name the artist / band performing this track", a: "Spice Girls", options: ["All Saints", "TLC", "Spice Girls", "Destiny's Child"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/21/3c/6d/213c6d54-1b12-bc78-685a-0d927c32e541/mza_1632731876547185347.m43.aac" },
            { q: "Name the artist / band performing this track", a: "Oasis", options: ["Blur", "Pulp", "Oasis", "Suede"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/e5/22/a9/e522a945-31a8-8687-32b5-5c123491f245/mza_1583920194871927384.m43.aac" }
        ],
        motown: [
            { q: "Name the artist / band performing this track", a: "Stevie Wonder", options: ["Marvin Gaye", "Stevie Wonder", "Smokey Robinson", "Curtis Mayfield"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/64/34/23/643423b4-52d8-2198-4c18-971842340284/mza_1028491827471928374.m43.aac" }
        ],
        kids_tv: [
            { q: "Name the TV show or cartoon theme song", a: "PAW Patrol", options: ["Peppa Pig", "PAW Patrol", "Fireman Sam", "Bob the Builder"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/99/88/77/99887766-5544-3322-1111-000022223333/mza_1234567890123456789.m43.aac" }
        ]
    };

    let questions = musicLibraries[type] || musicLibraries.classic_rock;
    questions = questions.map(function(item) {
        return {
            q: item.q,
            a: item.a,
            options: [...item.options].sort(function() { return Math.random() - 0.5; }),
            audioUrl: item.audioUrl,
            type: 'music'
        };
    });

    const timer = parseInt(document.getElementById('timerSelect').value);
    const betweenDelay = parseInt(document.getElementById('delaySelect').value);
    const speedBonus = document.getElementById('speedBonusCheckbox').checked;

    playlist.push({ id: Date.now(), name: "Music: " + genreName + " (" + questions.length + " Qs)", questions, timer, betweenDelay, speedBonus });
    renderPlaylist();
    renderHostQueue();
    alert('Added curated music round "' + genreName + '"!');
}

function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

const socket = io();
let playlist = [];
let storedAdvertBase64 = null;
let latestPlayersState = {};

document.addEventListener('DOMContentLoaded', function() {
    const imgInput = document.getElementById('imageUploadInput');
    if (imgInput) {
        imgInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    storedAdvertBase64 = e.target.result;
                    const preview = document.getElementById('imagePreview');
                    preview.src = storedAdvertBase64;
                    preview.style.display = 'block';
                    document.getElementById('uploadStatus').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

function pushAdvert(target) {
    if (!storedAdvertBase64) {
        alert('Please select an image file in the Adverts & Media tab first!');
        return;
    }
    const advertTitle = document.getElementById('advertTitleInput').value.trim();
    const showAdvertQR = document.getElementById('showAdvertQRCheckbox').checked;

    socket.emit('hostAction', { 
        action: 'pushAdvert', 
        payload: { image: storedAdvertBase64, target, advertTitle, showAdvertQR } 
    });
    alert('Advert pushed to ' + target + '!');
}

function hideAdvert(target) {
    socket.emit('hostAction', { action: 'hideAdvert', payload: { target } });
    alert('Advert hidden from ' + target + '.');
}

function toggleTipJar() {
    socket.emit('hostAction', { action: 'toggleTipJar' });
    alert('Tip Jar toggled on/off for players!');
}

function togglePoll() {
    socket.emit('hostAction', { action: 'togglePoll' });
    alert('Pre-Game Poll toggled on/off!');
}

function saveSettings() {
    const eventTitle = document.getElementById('eventTitleInput').value.trim();
    const welcomeMessage = document.getElementById('welcomeMessageInput').value.trim();
    const bannerText = document.getElementById('bannerTextInput').value.trim();
    const tipJarUrl = document.getElementById('tipJarUrlInput').value.trim();
    socket.emit('hostAction', { action: 'updateSettings', payload: { eventTitle, welcomeMessage, bannerText, tipJarUrl } });
    alert('Settings saved and broadcasted successfully!');
}

function savePollSettings() {
    const pollQuestion = document.getElementById('pollQuestionInput').value.trim();
    const optionsRaw = document.getElementById('pollOptionsInput').value.trim();
    const pollOptions = optionsRaw.split(',').map(function(o) { return o.trim(); }).filter(Boolean);
    socket.emit('hostAction', { action: 'updateSettings', payload: { pollQuestion, pollOptions } });
    alert('Poll updated and broadcasted!');
}

function exportLeaderboardCSV() {
    const sorted = Object.values(latestPlayersState).sort(function(a, b) { return b.score - a.score; });
    if (sorted.length === 0) return alert('No players to export!');
    
    let csv = 'Rank,Team Name,Score\n';
    sorted.forEach(function(p, idx) {
        csv += (idx + 1) + ',"' + p.name + '",' + p.score + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'TriviaMania_Leaderboard.csv');
    a.click();
}

function addCustomRoundToPlaylist() {
    const name = document.getElementById('customRoundName').value.trim() || "Custom Round";
    const rawText = document.getElementById('customRoundText').value.trim();
    const timer = parseInt(document.getElementById('timerSelect').value);
    const betweenDelay = parseInt(document.getElementById('delaySelect').value);
    const speedBonus = document.getElementById('speedBonusCheckbox').checked;

    if (!rawText) return alert('Please paste questions!');

    const lines = rawText.split('\n');
    const questions = [];
    lines.forEach(function(line) {
        const parts = line.split('|');
        if (parts.length >= 3) {
            const q = parts[0].trim();
            const a = parts[1].trim();
            const options = parts[2].split(',').map(function(o) { return o.trim(); });
            if (!options.includes(a)) options.push(a);
            questions.push({ q, a, options: options.sort(function() { return Math.random() - 0.5; }), type: 'trivia' });
        }
    });

    playlist.push({ id: Date.now(), name: name + " (" + questions.length + " Qs)", questions, timer, betweenDelay, speedBonus });
    renderPlaylist();
    renderHostQueue();
    alert('Added custom round "' + name + '"!');
}

function addPictureRoundToPlaylist() {
    const name = document.getElementById('picRoundName').value.trim() || "Picture Round";
    const rawText = document.getElementById('picRoundText').value.trim();
    const timer = parseInt(document.getElementById('timerSelect').value);
    const betweenDelay = parseInt(document.getElementById('delaySelect').value);
    const speedBonus = document.getElementById('speedBonusCheckbox').checked;

    if (!rawText) return alert('Please paste picture questions!');

    const lines = rawText.split('\n');
    const questions = [];
    lines.forEach(function(line) {
        const parts = line.split('|');
        if (parts.length >= 3) {
            const imageUrl = parts[0].trim();
            const a = parts[1].trim();
            const options = parts[2].split(',').map(function(o) { return o.trim(); });
            if (!options.includes(a)) options.push(a);
            
            const q = '<img src="' + imageUrl + '" style="max-height:280px; max-width:80vw; border-radius:12px; border:2px solid var(--accent); display:block; margin: 0 auto 10px auto;" alt="Picture Round"><div style="font-size:20px;">Identify what or who is shown above:</div>';
            
            questions.push({ q, a, options: options.sort(function() { return Math.random() - 0.5; }), type: 'picture' });
        }
    });

    playlist.push({ id: Date.now(), name: name + " (" + questions.length + " Qs)", questions, timer, betweenDelay, speedBonus });
    renderPlaylist();
    renderHostQueue();
    alert('Added picture round "' + name + '"!');
}

async function addTriviaToPlaylist() {
    const count = parseInt(document.getElementById('questionCountSelect').value);
    const timer = parseInt(document.getElementById('timerSelect').value);
    const betweenDelay = parseInt(document.getElementById('delaySelect').value);
    const speedBonus = document.getElementById('speedBonusCheckbox').checked;
    const categoryId = document.getElementById('categorySelect').value;
    const categoryName = categoryId ? document.getElementById('categorySelect').options[document.getElementById('categorySelect').selectedIndex].text : "General";
    
    const questions = await fetchTriviaQuestions(count, categoryId);
    playlist.push({ id: Date.now(), name: "Trivia: " + categoryName + " (" + questions.length + " Qs)", questions, timer, betweenDelay, speedBonus });
    renderPlaylist();
    renderHostQueue();
}

function renderPlaylist() {
    const container = document.getElementById('playlistContainer');
    document.getElementById('playlistCount').textContent = playlist.length;
    if (playlist.length === 0) {
        container.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No rounds in playlist yet.</p>';
        return;
    }
    container.innerHTML = '';
    playlist.forEach(function(round, index) {
        container.innerHTML += '<div class="playlist-card"><div><strong>' + (index + 1) + '. ' + round.name + '</strong> ' + (round.speedBonus ? '⚡(Turbo)' : '') + '</div><div><button class="btn-play" style="padding: 6px 12px; margin-top:0; font-size: 12px;" onclick="loadRound(' + index + ')">📂 Load</button><button class="btn-danger" onclick="deleteRound(' + index + ')">Delete</button></div></div>';
    });
}

function renderHostQueue() {
    const queueEl = document.getElementById('hostPlaylistQueue');
    if (playlist.length === 0) {
        queueEl.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No rounds loaded in queue yet.</p>';
        return;
    }
    queueEl.innerHTML = '';
    playlist.forEach(function(round, index) {
        queueEl.innerHTML += '<div class="playlist-card"><div><strong>' + (index + 1) + '. ' + round.name + '</strong></div><button class="btn-play" style="padding: 4px 10px; margin-top:0; font-size: 11px; width:auto;" onclick="loadRound(' + index + ')">Load</button></div>';
    });
}

function loadRound(index) {
    const round = playlist[index];
    socket.emit('hostAction', { action: 'loadRound', payload: { name: round.name, questions: round.questions, timer: round.timer, betweenDelay: round.betweenDelay, speedBonus: round.speedBonus } });
    alert('Loaded "' + round.name + '"!');
}

function deleteRound(index) {
    playlist.splice(index, 1);
    renderPlaylist();
    renderHostQueue();
}

function sendAction(action) {
    socket.emit('hostAction', { action });
}

socket.on('syncState', function(state) {
    if (state.eventTitle) document.getElementById('eventTitleInput').value = state.eventTitle;
    if (state.welcomeMessage) document.getElementById('welcomeMessageInput').value = state.welcomeMessage;
    if (state.bannerText) document.getElementById('bannerTextInput').value = state.bannerText;
    if (state.tipJarUrl) document.getElementById('tipJarUrlInput').value = state.tipJarUrl;
    if (state.pollQuestion) document.getElementById('pollQuestionInput').value = state.pollQuestion;
    if (state.pollOptions) document.getElementById('pollOptionsInput').value = state.pollOptions.join(', ');
});

socket.on('updatePlayers', function(players) {
    latestPlayersState = players;
    const listEl = document.getElementById('hostScoreList');
    const countEl = document.getElementById('playerCount');
    const sortedPlayers = Object.values(players).sort(function(a, b) { return b.score - a.score; });
    countEl.textContent = sortedPlayers.length;

    if (sortedPlayers.length === 0) {
        listEl.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No teams connected yet.</p>';
        return;
    }

    listEl.innerHTML = '';
    sortedPlayers.forEach(function(p, idx) {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1) + '.';
        listEl.innerHTML += '<div class="score-row"><span>' + medal + ' ' + p.avatar + ' <strong>' + p.name + '</strong> <em style="color:var(--muted); font-size:12px;">"' + p.motto + '"</em></span><span style="color: var(--accent); font-weight:bold; font-size:16px;">' + p.score + ' pts</span></div>';
    });
});
