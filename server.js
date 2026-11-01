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
    scores: {}, // socketId -> { name, score }
    activeScreenAdvert: null,
    activeMobileAdvert: null,
    settings: { 
        questionTime: 15,
        intermissionTime: 5 
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

// Robust Category Parser supporting option shuffling
function parseCategoryFile(filename) {
    const categoriesDir = path.join(__dirname, 'categories');
    let filePath = path.join(categoriesDir, filename);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(categoriesDir, filename + '.txt');
    }
    if (!fs.existsSync(filePath)) {
        console.warn(`Category file not found: ${filename}`);
        return [];
    }

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
            currentQ = { question: line.replace('#Q', '').trim(), options: [], answer: '' };
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

io.on('connection', (socket) => {
    socket.emit('state-update', gameState);

    socket.on('player-join', (playerName) => {
        const cleanName = playerName ? playerName.trim() : 'Anonymous';
        gameState.scores[socket.id] = { name: cleanName, score: 0 };
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
            const bonus = Math.floor((timeRemaining / gameState.timerMax) * 50);
            pointsEarned = 50 + Math.max(0, bonus);
            player.score += pointsEarned;
        }

        player.hasAnsweredCurrent = true;

        socket.emit('answer-result', { correct: isCorrect, points: pointsEarned });
        io.emit('state-update', gameState);
    });

    socket.on('add-round', (roundConfig) => {
        const questions = parseCategoryFile(roundConfig.genre);
        const selectedQuestions = questions.sort(() => 0.5 - Math.random()).slice(0, roundConfig.count || 10);
        
        gameState.playlist.push({
            name: roundConfig.name || roundConfig.genre,
            genre: roundConfig.genre,
            questions: selectedQuestions
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
        io.emit('state-update', gameState);
    });

    socket.on('start-round', () => {
        if (gameState.playlist.length === 0) return;
        if (timerInterval) clearInterval(timerInterval);
        if (leaderboardTimeout) clearTimeout(leaderboardTimeout);

        gameState.status = 'QUESTION';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.timerMax = gameState.settings.questionTime || 15;
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

    // Independent Advert Controls
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
    gameState.timerMax = gameState.settings.questionTime || 15;
    gameState.timer = gameState.timerMax;
    
    io.emit('state-update', gameState);
    startQuestionTimer();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`TriviaMania server running on http://localhost:${PORT}`);
});
