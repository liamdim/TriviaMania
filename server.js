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

// Game State
let gameState = {
    status: 'IDLE', // IDLE, LOBBY, QUESTION, LEADERBOARD, PAUSED
    currentRoundIndex: 0,
    playlist: [],
    currentQuestionIndex: 0,
    timer: 0,
    timerMax: 15,
    scores: {}, // socketId -> { name, score, streak }
    activeScreenAdvert: null,
    activeMobileAdvert: null,
    venueDetails: 'Welcome to Trivia Night!',
    announcement: { active: false, text: '' },
    settings: { 
        questionTime: 15,
        intermissionTime: 5,
        countdownSound: true 
    }
};

let timerInterval = null;
let leaderboardTimeout = null;

// Endpoint to fetch categories dynamically
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

// Endpoint to load BeatIQ music tracks & genres
app.get('/api/beatiq/tracks', (req, res) => {
    try {
        const curatedTracksPath = path.join(__dirname, 'data', 'curatedTracks.json');
        if (fs.existsSync(curatedTracksPath)) {
            const data = JSON.parse(fs.readFileSync(curatedTracksPath, 'utf8'));
            return res.json(data);
        }
        res.json([]);
    } catch (err) {
        res.json([]);
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
        const cleanName = playerName ? playerName.trim() : 'Anonymous';
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

        const isCorrect = answer.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
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

    // Add BeatIQ Music round into main playlist
    socket.on('add-beatiq-round', (roundConfig) => {
        const selectedTracks = roundConfig.tracks || [];
        const allArtists = selectedTracks.map(t => t.artist);

        const questions = selectedTracks.map((t) => {
            const wrongArtists = allArtists.filter(a => a !== t.artist).sort(() => 0.5 - Math.random()).slice(0, 3);
            while (wrongArtists.length < 3) {
                wrongArtists.push('Alternative Artist ' + (wrongArtists.length + 1));
            }
            const options = [t.artist, ...wrongArtists].sort(() => 0.5 - Math.random());

            return {
                question: `🎧 Listen to the snippet: Which artist or band performed "${t.title}"?`,
                options: options,
                answer: t.artist,
                fastestPlayerId: null,
                audioPreviewUrl: t.previewUrl || null,
                spotifyUrl: t.spotifyUrl || null
            };
        });

        gameState.playlist.push({
            name: `🎵 Music: ${roundConfig.name}`,
            genre: 'BeatIQ Music',
            timer: 20,
            questions: questions
        });
        io.emit('state-update', gameState);
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
        gameState.venueDetails = details;
        io.emit('state-update', gameState);
    });

    socket.on('update-announcement', (announcementData) => {
        gameState.announcement = announcementData;
        io.emit('announcement-update', gameState.announcement);
    });

    socket.on('send-emoji', (emoji) => {
        io.emit('player-emoji', { id: socket.id, emoji });
    });

    socket.on('start-round', () => {
        if (gameState.playlist.length === 0) return;
        if (timerInterval) clearInterval(timerInterval);
        if (leaderboardTimeout) clearTimeout(leaderboardTimeout);

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
        if (leaderboardTimeout) clearTimeout(leaderboardTimeout);
        gameState.status = 'PAUSED';
        io.emit('state-update', gameState);
    });

    socket.on('stop-reset', () => {
        if (timerInterval) clearInterval(timerInterval);
        if (leaderboardTimeout) clearTimeout(leaderboardTimeout);
        gameState.status = 'IDLE';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.activeScreenAdvert = null;
        gameState.activeMobileAdvert = null;
        gameState.scores = {};
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
        io.emit('state-update', gameState);
    });
});

function startQuestionTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (leaderboardTimeout) clearTimeout(leaderboardTimeout);

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

    const isLastQuestion = gameState.currentQuestionIndex + 1 >= round.questions.length && 
                           gameState.currentRoundIndex + 1 >= gameState.playlist.length;

    gameState.status = 'LEADERBOARD';
    io.emit('state-update', gameState);

    if (isLastQuestion) return;

    const intermissionMs = (gameState.settings.intermissionTime || 5) * 1000;
    leaderboardTimeout = setTimeout(() => {
        advanceToNextQuestion();
    }, intermissionMs);
}

function advanceToNextQuestion() {
    if (timerInterval) clearInterval(timerInterval);
    if (leaderboardTimeout) clearTimeout(leaderboardTimeout);

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
    console.log(`TriviaMania server running on http://localhost:${PORT}`);
});
