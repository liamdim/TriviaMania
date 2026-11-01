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
    activeAdvert: null,
    settings: { questionTime: 15 }
};

let timerInterval = null;

// Endpoint to fetch all available categories dynamically from the folder
app.get('/api/categories', (req, res) => {
    const categoriesDir = path.join(__dirname, 'categories');
    if (!fs.existsSync(categoriesDir)) {
        return res.json([]);
    }
    try {
        const files = fs.readdirSync(categoriesDir);
        // Clean filenames (remove extension if any are left over)
        const categories = files
            .filter(file => fs.statSync(path.join(categoriesDir, file)).isFile())
            .map(file => file.replace(/\.[^/.]+$/, ''));
        res.json(categories);
    } catch (err) {
        console.error('Error reading categories directory:', err);
        res.json([]);
    }
});

// Custom Parser for #Q and ^ text category files (supports extensionless filenames)
function parseCategoryFile(filename) {
    const cleanName = filename.replace('.txt', '');
    const filePath = path.join(__dirname, 'categories', cleanName);
    
    if (!fs.existsSync(filePath)) {
        console.warn(`Category file not found: ${filePath}`);
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
            if (currentQ) questions.push(currentQ);
            currentQ = {
                question: line.replace('#Q', '').trim(),
                options: [],
                answer: ''
            };
        } else if (line.startsWith('^')) {
            if (currentQ) {
                currentQ.answer = line.replace('^', '').trim();
            }
        } else if (/^[A-D]\s/.test(line) || /^[A-D]\./.test(line)) {
            if (currentQ) {
                const optText = line.replace(/^[A-D][\.\s]+/, '').trim();
                currentQ.options.push(optText);
            }
        }
    }
    if (currentQ) questions.push(currentQ);
    return questions;
}

// Socket.io Connection Handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
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

        const isCorrect = answer.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
        
        if (isCorrect && !player.hasAnsweredCurrent) {
            const bonus = Math.floor((timeRemaining / gameState.timerMax) * 50);
            const pointsEarned = 50 + Math.max(0, bonus);
            player.score += pointsEarned;
            player.hasAnsweredCurrent = true;
            socket.emit('answer-result', { correct: true, points: pointsEarned });
        } else {
            socket.emit('answer-result', { correct: false, points: 0 });
        }
        io.emit('state-update', gameState);
    });

    // Host Controls: Add Round to Playlist
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

    // Host Controls: Reorder Playlist (Move Up/Down)
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

    // Host Controls: Delete Round from Playlist
    socket.on('delete-round', (index) => {
        gameState.playlist.splice(index, 1);
        io.emit('state-update', gameState);
    });

    // Host Controls: Clear Entire Playlist
    socket.on('clear-playlist', () => {
        gameState.playlist = [];
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.status = 'IDLE';
        io.emit('state-update', gameState);
    });

    // Host Controls: Start / Resume Game
    socket.on('start-round', () => {
        if (gameState.playlist.length === 0) return;
        gameState.status = 'LOBBY';
        io.emit('state-update', gameState);
    });

    // Host Controls: Launch Question from Lobby / Next Question
    socket.on('next-question', () => {
        const round = gameState.playlist[gameState.currentRoundIndex];
        if (!round) return;

        Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);

        if (gameState.currentQuestionIndex >= round.questions.length) {
            gameState.status = 'LEADERBOARD';
            io.emit('state-update', gameState);
            return;
        }

        gameState.status = 'QUESTION';
        gameState.timerMax = gameState.settings.questionTime || 15;
        gameState.timer = gameState.timerMax;
        
        io.emit('state-update', gameState);
        startQuestionTimer();
    });

    // Host Controls: Pause / Stop Game (Without wiping scores)
    socket.on('stop-game', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'PAUSED';
        io.emit('state-update', gameState);
    });

    // Host Controls: Full Restart / Reset Game
    socket.on('stop-reset', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'IDLE';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.activeAdvert = null;
        gameState.scores = {};
        io.emit('state-update', gameState);
    });

    // Host Controls: Broadcast Advert
    socket.on('broadcast-advert', (adData) => {
        gameState.activeAdvert = adData;
        io.emit('state-update', gameState);
    });

    // Host Controls: Hide Advert
    socket.on('hide-advert', () => {
        gameState.activeAdvert = null;
        io.emit('state-update', gameState);
    });

    socket.on('disconnect', () => {
        delete gameState.scores[socket.id];
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
                gameState.status = 'LEADERBOARD';
                gameState.currentQuestionIndex++;
                io.emit('state-update', gameState);
            }
        }
    }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`TriviaMania server running on http://localhost:${PORT}`);
});
