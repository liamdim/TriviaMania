const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let gameState = {
    status: 'IDLE',
    currentRoundIndex: 0,
    playlist: [],
    currentQuestionIndex: 0,
    timer: 0,
    timerMax: 15,
    scores: {},
    mutedPlayers: {},
    chatEnabled: true,
    chatHistory: [],
    activeScreenAdvert: null,
    activeMobileAdvert: null,
    venueDetails: 'Welcome to Trivia Night!',
    welcomeHeader: 'Welcome to TriviaMania!',
    mobileWaitingText: 'Waiting for host to start game...',
    customEmojis: ['🔥', '🍻', '👏', '😂', '🎉', '💡'],
    announcement: { active: false, text: '' },
    settings: { 
        questionTime: 15,
        intermissionTime: 5,
        countdownSound: true 
    }
};

let timerInterval = null;

const badWords = [
    'damn', 'hell', 'shit', 'fuck', 'bitch', 'crap', 'ass', 
    'bastard', 'cunt', 'dick', 'piss', 'cock', 'prick', 'wanker', 'arse'
];

function sanitizeText(text) {
    if (!text) return '';
    let clean = text.trim();
    badWords.forEach(word => {
        const regex = new RegExp('\\b' + word + '\\b', 'gi');
        clean = clean.replace(regex, '****');
    });
    return clean;
}

app.get('/api/categories', (req, res) => {
    const categoriesDir = path.join(__dirname, 'categories');
    if (!fs.existsSync(categoriesDir)) return res.json([]);
    try {
        const files = fs.readdirSync(categoriesDir);
        const categories = files
            .filter(file => fs.statSync(path.join(categoriesDir, file)).isFile())
            .map(file => file.replace(/\.[^/.]+$/, ''));
        res.json(categories);
    } catch (err) {
        res.json([]);
    }
});

app.get('/api/beatiq/tracks', (req, res) => {
    try {
        function findFile(dir, filename) {
            if (!fs.existsSync(dir)) return null;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        if (file === 'node_modules' || file === '.git') continue;
                        const found = findFile(fullPath, filename);
                        if (found) return found;
                    } else if (file === filename) {
                        return fullPath;
                    }
                } catch (e) {}
            }
            return null;
        }

        const foundPath = findFile(__dirname, 'curatedTracks.json');
        if (foundPath) {
            const rawData = fs.readFileSync(foundPath, 'utf8');
            const data = JSON.parse(rawData);
            return res.json(data);
        }
        return res.json([]);
    } catch (err) {
        return res.json([]);
    }
});

function parseCategoryFile(filename) {
    const categoriesDir = path.join(__dirname, 'categories');
    let filePath = path.join(categoriesDir, filename);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(categoriesDir, filename + '.txt');
    }
    if (!fs.existsSync(filePath)) return [];

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split(/\r?\n/);
    const questions = [];
    let currentQ = null;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith('#Q')) {
            if (currentQ) {
                currentQ.options.sort(() => 0.5 - Math.random());
                questions.push(currentQ);
            }
            currentQ = { question: line.replace('#Q', '').trim(), options: [], answer: '', fastestPlayerId: null };
        } else if (line.startsWith('^')) {
            if (currentQ) currentQ.answer = line.replace('^', '').trim();
        } else if (/^[A-D]\s/.test(line) || /^[A-D]\./.test(line)) {
            if (currentQ) {
                const optText = line.replace(/^[A-D][\.\s]+/, '').trim();
                currentQ.options.push(optText);
            }
        }
    }
    if (currentQ) {
        currentQ.options.sort(() => 0.5 - Math.random());
        questions.push(currentQ);
    }
    return questions;
}

function getCurrentRoundTimer() {
    const round = gameState.playlist[gameState.currentRoundIndex];
    if (round && round.timer) return round.timer;
    return gameState.settings.questionTime || 15;
}

io.on('connection', (socket) => {
    socket.emit('state-update', gameState);
    socket.emit('announcement-update', gameState.announcement);

    socket.on('player-join', (playerName) => {
        const cleanName = sanitizeText(playerName) || 'Anonymous';
        gameState.scores[socket.id] = { name: cleanName, score: 0, streak: 0 };
        io.emit('state-update', gameState);
    });

    socket.on('submit-answer', ({ answer, timeRemaining }) => {
        if (gameState.status !== 'QUESTION') return;
        const player = gameState.scores[socket.id];
        if (!player) return;

        const currentRound = gameState.playlist[gameState.currentRoundIndex];
        if (!currentRound || !currentRound.questions) return;

        const currentQ = currentRound.questions[gameState.currentQuestionIndex];
        if (!currentQ) return;

        if (player.hasAnsweredCurrent) return;

        let isCorrect = false;
        if (currentQ.gameType === 'lingo') {
            isCorrect = answer.trim().toUpperCase() === currentQ.answer.trim().toUpperCase();
        } else if (currentQ.gameType === 'higher-lower') {
            isCorrect = answer.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
        } else {
            isCorrect = answer.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
        }

        let pointsEarned = 0;

        if (isCorrect) {
            if (!currentQ.fastestPlayerId) {
                currentQ.fastestPlayerId = socket.id;
            }
            const isFastest = currentQ.fastestPlayerId === socket.id;

            player.streak = (player.streak || 0) + 1;
            const streakMultiplier = player.streak >= 3 ? 1.5 : (player.streak >= 2 ? 1.25 : 1.0);
            
            const timeBonus = Math.floor((timeRemaining / gameState.timerMax) * 40);
            const speedBonus = isFastest ? 25 : 0;
            
            pointsEarned = Math.round((50 + Math.max(0, timeBonus) + speedBonus) * streakMultiplier);
            player.score += pointsEarned;
        } else {
            player.streak = 0;
        }

        player.hasAnsweredCurrent = true;

        socket.emit('answer-result', { correct: isCorrect, points: pointsEarned, streak: player.streak, isFastest: currentQ.fastestPlayerId === socket.id });
        io.emit('state-update', gameState);
    });

    socket.on('add-round', (roundConfig) => {
        const questions = parseCategoryFile(roundConfig.genre);
        const selectedQuestions = questions.sort(() => 0.5 - Math.random()).slice(0, roundConfig.count || 10);
        
        gameState.playlist.push({
            name: roundConfig.name || roundConfig.genre,
            genre: roundConfig.genre,
            timer: roundConfig.timer ? parseInt(roundConfig.timer) : null,
            questions: selectedQuestions
        });
        io.emit('state-update', gameState);
    });

    socket.on('add-beatiq-round', (roundConfig) => {
        let allTracks = [];
        try {
            function findFile(dir, filename) {
                if (!fs.existsSync(dir)) return null;
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory()) {
                            if (file === 'node_modules' || file === '.git') continue;
                            const found = findFile(fullPath, filename);
                            if (found) return found;
                        } else if (file === filename) {
                            return fullPath;
                        }
                    } catch (e) {}
                }
                return null;
            }

            const foundPath = findFile(__dirname, 'curatedTracks.json');
            if (foundPath) {
                allTracks = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
            }
        } catch (err) {}

        const targetGenre = roundConfig.genre;
        const requestedCount = parseInt(roundConfig.questionCount || roundConfig.count || 10);
        
        let genreFilteredTracks = allTracks.filter(t => t.genre === targetGenre);
        let trackPool = genreFilteredTracks.length >= requestedCount ? genreFilteredTracks : allTracks;
        
        const selectedTracks = [...trackPool].sort(() => 0.5 - Math.random()).slice(0, requestedCount);
        const allArtists = allTracks.map(t => t.artist);

        const questions = selectedTracks.map((t) => {
            const wrongArtists = allArtists.filter(a => a !== t.artist).sort(() => 0.5 - Math.random()).slice(0, 3);
            while (wrongArtists.length < 3) {
                wrongArtists.push('Alternative Artist ' + (wrongArtists.length + 1));
            }
            const options = [t.artist, ...wrongArtists].sort(() => 0.5 - Math.random());

            return {
                question: '🎧 Listen to the snippet: Which artist or band performed "' + t.title + '"?',
                options: options,
                answer: t.artist,
                fastestPlayerId: null,
                audioPreviewUrl: t.previewUrl || null,
                spotifyUrl: t.spotifyUrl || null
            };
        });

        gameState.playlist.push({
            name: '🎵 Music: ' + roundConfig.name,
            genre: 'BeatIQ (' + targetGenre + ')',
            timer: 20,
            questions: questions
        });
        io.emit('state-update', gameState);
    });

    socket.on('add-minigame-round', (config) => {
        let questions = [];
        if (config.type === 'lingo') {
            const lingoWords = [
                { word: 'SHARK', hint: 'Ocean predator with a dorsal fin' },
                { word: 'MUSIC', hint: 'Organized sound and melody' },
                { word: 'HOUSE', hint: 'A building for human habitation' },
                { word: 'PLANT', hint: 'Living organism that produces oxygen' },
                { word: 'TRAIN', hint: 'Railway transport vehicle' },
                { word: 'BEACH', hint: 'Sandy shore by the ocean' },
                { word: 'LIGHT', hint: 'Electromagnetic radiation visible to the eye' },
                { word: 'SPACE', hint: 'The boundless three-dimensional extent' },
                { word: 'PIZZA', hint: 'Popular Italian baked flatbread dish' },
                { word: 'MONEY', hint: 'Medium of exchange for goods and services' },
                { word: 'WATER', hint: 'Essential clear liquid for all living things' },
                { word: 'DRINK', hint: 'Liquid refreshment ordered at a pub' },
                { word: 'QUEEN', hint: 'Royal female monarch or legendary rock band' },
                { word: 'PARTY', hint: 'A social gathering for celebration' },
                { word: 'DANCE', hint: 'Move rhythmically to music' },
                { word: 'STAGE', hint: 'Platform where performers stand' }
            ];
            const selected = [...lingoWords].sort(() => 0.5 - Math.random()).slice(0, config.count || 5);
            questions = selected.map(item => ({
                gameType: 'lingo',
                question: '🔤 LINGO ROUND: Guess the 5-letter word! Hint: ' + item.hint,
                answer: item.word,
                options: [],
                fastestPlayerId: null
            }));
        } else if (config.type === 'scramble') {
            const scrambleItems = [
                { word: 'BEATLES', scrambled: 'S E T A E B L' },
                { word: 'QUEEN', scrambled: 'E E N Q U' },
                { word: 'LONDON', scrambled: 'D O N N O L' },
                { word: 'GUITAR', scrambled: 'R T I A U G' },
                { word: 'KARAOKE', scrambled: 'K O R A A E K' },
                { word: 'TRIVIA', scrambled: 'I V A I R T' },
                { word: 'CHELSEA', scrambled: 'E H S E L A C' },
                { word: 'WHISKEY', scrambled: 'E Y K I S H W' },
                { word: 'RADIOHEAD', scrambled: 'H A D O R E I A D' },
                { word: 'PYRAMID', scrambled: 'M I D A R Y P' },
                { word: 'FOOTBALL', scrambled: 'L B A L T O O F' },
                { word: 'DIAMOND', scrambled: 'N O M D A I D' }
            ];
            const selected = [...scrambleItems].sort(() => 0.5 - Math.random()).slice(0, config.count || 5);
            questions = selected.map(item => {
                const wrongPool = scrambleItems.filter(i => i.word !== item.word).map(i => i.word);
                const wrongOpts = wrongPool.sort(() => 0.5 - Math.random()).slice(0, 3);
                const options = [item.word, ...wrongOpts].sort(() => 0.5 - Math.random());
                return {
                    gameType: 'scramble',
                    question: '🔀 WORD SCRAMBLE: Unscramble these letters: [ ' + item.scrambled + ' ]',
                    answer: item.word,
                    options: options,
                    fastestPlayerId: null
                };
            });
        } else if (config.type === 'higher-lower') {
            const hlItems = [
                { fact: 'Average population of London (Millions)', options: ['Higher', 'Lower'], answer: 'Higher' },
                { fact: 'Number of keys on a standard piano (88)', options: ['Higher', 'Lower'], answer: '88' },
                { fact: 'Year the first iPhone was released (2007)', options: ['Higher', 'Lower'], answer: '2007' },
                { fact: 'Boiling point of water in Celsius (100°C)', options: ['Higher', 'Lower'], answer: '100' },
                { fact: 'Number of squares on a chessboard (64)', options: ['Higher', 'Lower'], answer: '64' },
                { fact: 'Average runtime of a feature film in minutes (~120)', options: ['Higher', 'Lower'], answer: '120' }
            ];
            const selected = [...hlItems].sort(() => 0.5 - Math.random()).slice(0, config.count || 5);
            questions = selected.map(item => ({
                gameType: 'higher-lower',
                question: '⬆️ HIGHER OR LOWER: ' + item.fact,
                answer: item.answer,
                options: item.options,
                fastestPlayerId: null
            }));
        } else if (config.type === 'tenable') {
            const tenableItems = [
                { category: 'Top 5 Most Populous Countries in the World', answer: 'China', options: ['China', 'Brazil', 'Canada', 'Australia'] },
                { category: 'Top 5 Largest US States by Area', answer: 'Alaska', options: ['Alaska', 'Texas', 'California', 'Florida'] },
                { category: 'Top 5 Most Watched Sports Globally', answer: 'Football (Soccer)', options: ['Football (Soccer)', 'Rugby', 'Golf', 'Badminton'] },
                { category: 'Top 5 Best-Selling Music Artists of All Time', answer: 'The Beatles', options: ['The Beatles', 'Adele', 'Ed Sheeran', 'Justin Bieber'] }
            ];
            const selected = [...tenableItems].sort(() => 0.5 - Math.random()).slice(0, config.count || 5);
            questions = selected.map(item => ({
                gameType: 'tenable',
                question: '🔟 TENABLE: Name a top entry in this category: ' + item.category,
                answer: item.answer,
                options: item.options.sort(() => 0.5 - Math.random()),
                fastestPlayerId: null
            }));
        } else if (config.type === 'one-percent') {
            const opItems = [
                { q: 'What single word can go before "shoes", "case", and "string"?', answer: 'Suit', options: ['Suit', 'Boot', 'Bag', 'Coat'] },
                { q: 'If you have a square with sides of 4cm, what is its total area in cm²?', answer: '16', options: ['16', '8', '12', '20'] },
                { q: 'Which of these numbers is the odd one out: 27, 64, 125, 144, 216?', answer: '144', options: ['144', '27', '64', '125'] },
                { q: 'What comes next in the sequence: O, T, T, F, F, S, S, E...?', answer: 'N', options: ['N', 'T', 'E', 'O'] }
            ];
            const selected = [...opItems].sort(() => 0.5 - Math.random()).slice(0, config.count || 5);
            questions = selected.map(item => ({
                gameType: 'one-percent',
                question: '🧠 THE 1% CLUB BRAINTEASER: ' + item.q,
                answer: item.answer,
                options: item.options.sort(() => 0.5 - Math.random()),
                fastestPlayerId: null
            }));
        }

        if (questions.length > 0) {
            gameState.playlist.push({
                name: config.name || '🎮 Game Show: ' + config.type.toUpperCase(),
                genre: 'Mini-Game (' + config.type + ')',
                timer: 25,
                questions: questions
            });
            io.emit('state-update', gameState);
        }
    });

    socket.on('move-round', ({ index, direction }) => {
        if (direction === 'up' && index > 0) {
            const temp = gameState.playlist[index];
            gameState.playlist[index] = gameState.playlist[index - 1];
            gameState.playlist[index - 1] = temp;
        } else if (direction === 'down' && index < gameState.playlist.length - 1) {
            const temp = gameState.playlist[index];
            gameState.playlist[index] = gameState.playlist[index + 1];
            gameState.playlist[index + 1] = temp;
        }
        io.emit('state-update', gameState);
    });

    socket.on('delete-round', (index) => {
        gameState.playlist.splice(index, 1);
        io.emit('state-update', gameState);
    });

    socket.on('clear-playlist', () => {
        gameState.playlist = [];
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.status = 'IDLE';
        io.emit('state-update', gameState);
    });

    socket.on('update-settings', (newSettings) => {
        if (newSettings.questionTime) gameState.settings.questionTime = parseInt(newSettings.questionTime);
        if (newSettings.intermissionTime) gameState.settings.intermissionTime = parseInt(newSettings.intermissionTime);
        if (newSettings.countdownSound !== undefined) gameState.settings.countdownSound = newSettings.countdownSound;
        io.emit('state-update', gameState);
    });

    socket.on('update-venue-details', (details) => {
        gameState.venueDetails = sanitizeText(details);
        io.emit('state-update', gameState);
    });

    socket.on('update-welcome-header', (headerText) => {
        gameState.welcomeHeader = sanitizeText(headerText);
        io.emit('state-update', gameState);
    });

    socket.on('update-mobile-waiting', (waitingText) => {
        gameState.mobileWaitingText = sanitizeText(waitingText);
        io.emit('state-update', gameState);
    });

    socket.on('update-custom-emojis', (emojisArray) => {
        gameState.customEmojis = emojisArray;
        io.emit('state-update', gameState);
    });

    socket.on('toggle-chat', (enabled) => {
        gameState.chatEnabled = enabled;
        io.emit('state-update', gameState);
    });

    socket.on('toggle-mute-player', (socketId) => {
        gameState.mutedPlayers[socketId] = !gameState.mutedPlayers[socketId];
        io.emit('state-update', gameState);
    });

    socket.on('update-announcement', (announcementData) => {
        gameState.announcement = {
            active: announcementData.active,
            text: sanitizeText(announcementData.text)
        };
        io.emit('announcement-update', gameState.announcement);
    });

    socket.on('send-emoji', (emoji) => {
        if (!gameState.chatEnabled) return;
        if (gameState.mutedPlayers[socket.id]) return;
        io.emit('player-emoji', { id: socket.id, emoji });
    });

    socket.on('player-chat', (message) => {
        if (!gameState.chatEnabled) return;
        if (gameState.mutedPlayers[socket.id]) return;
        
        const cleanMsg = sanitizeText(message);
        if (!cleanMsg) return;

        const player = gameState.scores[socket.id];
        const playerName = player ? player.name : 'Anonymous';

        const chatObj = { name: playerName, text: cleanMsg };
        gameState.chatHistory.push(chatObj);
        if (gameState.chatHistory.length > 30) gameState.chatHistory.shift();

        io.emit('chat-message', chatObj);
    });

    socket.on('start-round', () => {
        if (gameState.playlist.length === 0) return;
        if (timerInterval) clearInterval(timerInterval);

        gameState.status = 'QUESTION';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.timerMax = getCurrentRoundTimer();
        gameState.timer = gameState.timerMax;
        
        Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);
        io.emit('state-update', gameState);
        startQuestionTimer();
    });

    socket.on('next-question', () => {
        advanceToNextQuestion();
    });

    socket.on('stop-game', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'PAUSED';
        io.emit('stop-audio');
        io.emit('state-update', gameState);
    });

    socket.on('restart-game', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'IDLE';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        Object.values(gameState.scores).forEach(p => {
            p.score = 0;
            p.streak = 0;
            p.hasAnsweredCurrent = false;
        });
        io.emit('stop-audio');
        io.emit('state-update', gameState);
    });

    socket.on('stop-reset', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'IDLE';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.activeScreenAdvert = null;
        gameState.activeMobileAdvert = null;
        gameState.scores = {};
        gameState.mutedPlayers = {};
        gameState.chatHistory = [];
        io.emit('stop-audio');
        io.emit('state-update', gameState);
    });

    socket.on('broadcast-advert-screen', (adData) => {
        gameState.activeScreenAdvert = adData;
        io.emit('state-update', gameState);
    });

    socket.on('hide-advert-screen', () => {
        gameState.activeScreenAdvert = null;
        io.emit('state-update', gameState);
    });

    socket.on('broadcast-advert-mobile', (adData) => {
        gameState.activeMobileAdvert = adData;
        io.emit('state-update', gameState);
    });

    socket.on('hide-advert-mobile', () => {
        gameState.activeMobileAdvert = null;
        io.emit('state-update', gameState);
    });

    socket.on('disconnect', () => {
        delete gameState.scores[socket.id];
        delete gameState.mutedPlayers[socket.id];
        io.emit('state-update', gameState);
    });
});

function startQuestionTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (gameState.status === 'QUESTION') {
            gameState.timer--;
            io.emit('timer-tick', gameState.timer);

            if (gameState.timer <= 0) {
                clearInterval(timerInterval);
                triggerLeaderboardAndAutoAdvance();
            }
        }
    }, 1000);
}

function triggerLeaderboardAndAutoAdvance() {
    const round = gameState.playlist[gameState.currentRoundIndex];
    if (!round) return;

    gameState.status = 'LEADERBOARD';
    io.emit('stop-audio');
    io.emit('state-update', gameState);
}

function advanceToNextQuestion() {
    if (timerInterval) clearInterval(timerInterval);

    const round = gameState.playlist[gameState.currentRoundIndex];
    if (!round || !round.questions) return;

    Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);

    gameState.currentQuestionIndex++;

    if (gameState.currentQuestionIndex >= round.questions.length) {
        if (gameState.currentRoundIndex + 1 < gameState.playlist.length) {
            gameState.currentRoundIndex++;
            gameState.currentQuestionIndex = 0;
        } else {
            gameState.status = 'LEADERBOARD';
            io.emit('stop-audio');
            io.emit('state-update', gameState);
            return;
        }
    }

    gameState.status = 'QUESTION';
    gameState.timerMax = getCurrentRoundTimer();
    gameState.timer = gameState.timerMax;
    
    io.emit('state-update', gameState);
    startQuestionTimer();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('TriviaMania server running on port ' + PORT);
});
