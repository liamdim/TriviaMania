const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let samplePolls = [
    { question: 'What is your team’s pre-trivia drink of choice?', options: ['Beer 🍺', 'Cocktail 🍸', 'Wine 🍷', 'Soft Drink 🥤'] },
    { question: 'Which decade had the absolute best music?', options: ['70s 🕺', '80s 🎸', '90s 📼', '00s 🎧'] },
    { question: 'How confident is your team tonight?', options: ['Total Winners 🏆', 'Just for Fun 🍻', 'Clueless 🤷', 'Robbed Last Week 😡'] },
    { question: 'What is the best pub snack?', options: ['Crisps 🥔', 'Nuts 🥜', 'Pork Crackling 🥓', 'None / Just Drinks 🍻'] }
];

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
    venueDetails: 'Get your phones ready to play!',
    welcomeHeader: 'Welcome to TriviaMania!',
    customEmojis: ['🔥', '🍻', '👏', '😂', '🎉', '💡'],
    adverts: [
        { text: '🍻 Bar Sponsor Special: Enjoy drink deals at the counter tonight!', image: '' },
        { text: '🎵 Next Week Preview: Don’t miss our special Quiz Night!', image: '' }
    ],
    lobbySettings: {
        showFact: true,
        factText: 'Did you know? The pub record score is 480 points!',
        showPoll: true,
        pollQuestion: samplePolls[0].question,
        pollOptions: samplePolls[0].options,
        votes: {}
    },
    settings: { questionTime: 15 },
    playerBingoCards: {}
};

let timerInterval = null;
let disconnectedPlayers = {};

function triggerNewPoll() {
    const randomPoll = samplePolls[Math.floor(Math.random() * samplePolls.length)];
    gameState.lobbySettings.pollQuestion = randomPoll.question;
    gameState.lobbySettings.pollOptions = randomPoll.options;
    gameState.lobbySettings.votes = {};
    io.emit('state-update', gameState);
}

const badWords = ['damn', 'hell', 'shit', 'fuck', 'bitch', 'crap', 'ass', 'bastard', 'cunt', 'dick', 'piss', 'cock', 'prick', 'wanker', 'arse'];

function sanitizeText(text) {
    if (!text) return '';
    let clean = text.trim();
    badWords.forEach(word => {
        const regex = new RegExp('\\b' + word + '\\b', 'gi');
        clean = clean.replace(regex, '****');
    });
    return clean;
}

function calculateSimilarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    let longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    let costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (s1.length > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function checkBingoWin(marked) {
    const lines = [
        [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
        [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
        [0,6,12,18,24], [4,8,12,16,20]
    ];
    return lines.some(line => line.every(index => marked[index]));
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

function parseCategoryFile(filename) {
    const categoriesDir = path.join(__dirname, 'categories');
    let filePath = path.join(categoriesDir, filename);
    if (!fs.existsSync(filePath)) filePath = path.join(categoriesDir, filename + '.txt');
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
    return questions.sort(() => 0.5 - Math.random());
}

function getCurrentRoundTimer() {
    const round = gameState.playlist[gameState.currentRoundIndex];
    if (round && round.timer) return parseInt(round.timer);
    return gameState.settings.questionTime || 15;
}

io.on('connection', (socket) => {
    socket.emit('state-update', gameState);

    socket.on('player-join', (playerName) => {
        const cleanName = sanitizeText(playerName) || 'Anonymous';
        if (disconnectedPlayers[cleanName]) {
            clearTimeout(disconnectedPlayers[cleanName].timeout);
            gameState.scores[socket.id] = disconnectedPlayers[cleanName].playerData;
            delete disconnectedPlayers[cleanName];
        } else {
            gameState.scores[socket.id] = { name: cleanName, score: 0, streak: 0 };
        }
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
        const cleanAns = (answer || '').trim().toLowerCase();
        const correctAnswer = (currentQ.answer || '').trim().toLowerCase();

        if (currentQ.options && currentQ.options.length > 0) {
            isCorrect = cleanAns === correctAnswer;
        } else {
            const similarity = calculateSimilarity(cleanAns, correctAnswer);
            isCorrect = similarity >= 0.78 || cleanAns === correctAnswer;
        }

        let pointsEarned = 0;
        if (isCorrect) {
            if (!currentQ.fastestPlayerId) currentQ.fastestPlayerId = socket.id;
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

        socket.emit('answer-result', { 
            correct: isCorrect, 
            points: pointsEarned, 
            streak: player.streak, 
            correctAnswer: currentQ.answer,
            isFastest: currentQ.fastestPlayerId === socket.id 
        });
        io.emit('state-update', gameState);
    });

    // Native Music Bingo Round Handler
    socket.on('add-music-bingo-round', (data) => {
        const eventName = data.eventName || 'Music Bingo';
        const tracks = data.tracks || [];
        
        if (tracks.length === 0) return;

        const questions = tracks.map(track => ({
            gameType: 'music-bingo',
            question: `🎵 MUSIC BINGO: Listen & mark your card!`,
            answer: track,
            options: [],
            fastestPlayerId: null
        }));

        gameState.playlist.push({
            name: '🎵 ' + eventName,
            genre: 'Music Bingo',
            timer: 30,
            questions: questions,
            isMusicBingo: true,
            trackPool: tracks
        });

        io.emit('state-update', gameState);
        socket.emit('music-bingo-added', { success: true });
    });

    socket.on('poll-vote', (option) => {
        if (!gameState.lobbySettings.votes) gameState.lobbySettings.votes = {};
        gameState.lobbySettings.votes[socket.id] = option;
        io.emit('state-update', gameState);
    });

    socket.on('mute-player', (targetId) => {
        gameState.mutedPlayers[targetId] = true;
        io.emit('state-update', gameState);
    });

    socket.on('unmute-player', (targetId) => {
        delete gameState.mutedPlayers[targetId];
        io.emit('state-update', gameState);
    });

    socket.on('add-round', (roundConfig) => {
        const questions = parseCategoryFile(roundConfig.genre);
        const selectedQuestions = questions.slice(0, roundConfig.count || 10);
        
        gameState.playlist.push({
            name: roundConfig.name || roundConfig.genre,
            genre: roundConfig.genre,
            timer: 15,
            questions: selectedQuestions
        });
        io.emit('state-update', gameState);
    });

    socket.on('add-custom-picture-round', (roundObj) => {
        if (!roundObj || !roundObj.questions || roundObj.questions.length === 0) return;
        gameState.playlist.push({
            name: roundObj.name || '🖼️ Picture Round',
            genre: 'Picture Round',
            timer: 20,
            questions: roundObj.questions
        });
        io.emit('state-update', gameState);
    });

    socket.on('player-chat', (message) => {
        if (gameState.mutedPlayers[socket.id]) return;
        const player = gameState.scores[socket.id];
        const name = player ? player.name : 'Player';
        const cleanMsg = sanitizeText(message);
        if (cleanMsg) io.emit('chat-message', { name: name, text: cleanMsg });
    });

    socket.on('host-chat-broadcast', (message) => {
        const cleanMsg = sanitizeText(message);
        if (!cleanMsg) return;
        io.emit('chat-message', { name: 'HOST 📢', text: cleanMsg });
    });

    socket.on('move-round', ({ index, direction }) => {
        if (!gameState.playlist || gameState.playlist.length === 0) return;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < gameState.playlist.length) {
            const item = gameState.playlist.splice(index, 1)[0];
            gameState.playlist.splice(targetIndex, 0, item);
            io.emit('state-update', gameState);
        }
    });

    socket.on('delete-round', (index) => {
        if (!gameState.playlist) return;
        gameState.playlist.splice(index, 1);
        if (gameState.currentRoundIndex >= gameState.playlist.length) {
            gameState.currentRoundIndex = Math.max(0, gameState.playlist.length - 1);
        }
        io.emit('state-update', gameState);
    });

    socket.on('clear-playlist', () => {
        gameState.playlist = [];
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        io.emit('state-update', gameState);
    });

    socket.on('start-round', () => {
        if (gameState.playlist.length === 0) return;
        if (timerInterval) clearInterval(timerInterval);

        gameState.status = 'QUESTION';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.timerMax = getCurrentRoundTimer();
        gameState.timer = gameState.timerMax;
        
        // Auto-generate music bingo cards if starting a music bingo round
        const activeRound = gameState.playlist[gameState.currentRoundIndex];
        if (activeRound && activeRound.isMusicBingo) {
            const trackPool = activeRound.trackPool || [];
            Object.keys(gameState.scores).forEach(socketId => {
                let shuffledTracks = [...trackPool].sort(() => 0.5 - Math.random());
                let cardTracks = shuffledTracks.slice(0, 24);
                cardTracks.splice(12, 0, '★ FREE SPACE ★');
                gameState.playerBingoCards[socketId] = {
                    card: cardTracks,
                    marked: Array(25).fill(false)
                };
                gameState.playerBingoCards[socketId].marked[12] = true;
            });
            io.emit('music-bingo-cards-assigned', gameState.playerBingoCards);
        }

        Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);
        io.emit('state-update', gameState);
        startQuestionTimer();
    });

    socket.on('start-next-round', () => {
        if (timerInterval) clearInterval(timerInterval);
        if (gameState.currentRoundIndex + 1 < gameState.playlist.length) {
            gameState.currentRoundIndex++;
            gameState.currentQuestionIndex = 0;
            gameState.status = 'QUESTION';
            gameState.timerMax = getCurrentRoundTimer();
            gameState.timer = gameState.timerMax;

            const activeRound = gameState.playlist[gameState.currentRoundIndex];
            if (activeRound && activeRound.isMusicBingo) {
                const trackPool = activeRound.trackPool || [];
                Object.keys(gameState.scores).forEach(socketId => {
                    let shuffledTracks = [...trackPool].sort(() => 0.5 - Math.random());
                    let cardTracks = shuffledTracks.slice(0, 24);
                    cardTracks.splice(12, 0, '★ FREE SPACE ★');
                    gameState.playerBingoCards[socketId] = {
                        card: cardTracks,
                        marked: Array(25).fill(false)
                    };
                    gameState.playerBingoCards[socketId].marked[12] = true;
                });
                io.emit('music-bingo-cards-assigned', gameState.playerBingoCards);
            }

            Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);
            triggerNewPoll();
            io.emit('state-update', gameState);
            startQuestionTimer();
        } else {
            gameState.status = 'LEADERBOARD';
            io.emit('state-update', gameState);
        }
    });

    // Mark tile handler for players tapping their digital bingo cards
    socket.on('mark-bingo-tile', (index) => {
        if (!gameState.playerBingoCards || !gameState.playerBingoCards[socket.id]) return;
        let playerCard = gameState.playerBingoCards[socket.id];
        
        if (index >= 0 && index < 25) {
            playerCard.marked[index] = !playerCard.marked[index];
            if (checkBingoWin(playerCard.marked)) {
                io.emit('bingo-winner', { name: gameState.scores[socket.id].name });
            }
            socket.emit('bingo-card-updated', playerCard);
        }
    });

    socket.on('next-question', () => {
        advanceToNextQuestion();
    });

    socket.on('stop-game', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'PAUSED';
        triggerNewPoll();
        io.emit('state-update', gameState);
    });

    socket.on('restart-game', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'IDLE';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        triggerNewPoll();
        Object.values(gameState.scores).forEach(p => {
            p.score = 0; p.streak = 0; p.hasAnsweredCurrent = false;
        });
        io.emit('state-update', gameState);
    });

    socket.on('stop-reset', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'IDLE';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.scores = {};
        gameState.mutedPlayers = {};
        gameState.playerBingoCards = {};
        disconnectedPlayers = {};
        triggerNewPoll();
        io.emit('state-update', gameState);
    });

    socket.on('disconnect', () => {
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
                advanceToNextQuestion();
            }
        }
    }, 1000);
}

function advanceToNextQuestion() {
    if (timerInterval) clearInterval(timerInterval);

    const round = gameState.playlist[gameState.currentRoundIndex];
    if (!round || !round.questions) return;

    Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);

    gameState.currentQuestionIndex++;

    if (gameState.currentQuestionIndex >= round.questions.length) {
        gameState.status = 'INTERMISSION';
        triggerNewPoll();
        io.emit('state-update', gameState);
        return;
    }

    gameState.status = 'QUESTION';
    gameState.timerMax = getCurrentRoundTimer();
    gameState.timer = gameState.timerMax;
    
    io.emit('state-update', gameState);
    startQuestionTimer();
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log('TriviaMania server running on port ' + PORT);
});
