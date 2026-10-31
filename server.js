const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let gameState = {
    status: 'lobby',
    currentRound: null,
    currentQuestionIndex: 0,
    timer: 15,
    scores: {},
    settings: {
        eventTitle: 'TriviaMania Live Event'
    }
};

let players = {};
let questionInterval = null;
let delayTimeout = null;

app.get('/api/questions/:category', (req, res) => {
    const category = req.params.category;
    const count = parseInt(req.query.count) || 10;
    const filePath = path.join(__dirname, 'categories', `${category}.txt`);

    if (!fs.existsSync(filePath)) {
        return res.status(204).send();
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(204).send();
        }

        const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let questions = [];

        for (let i = 0; i < lines.length; i++) {
            if (i + 4 < lines.length) {
                let possibleQ = {
                    q: lines[i],
                    options: [lines[i+1], lines[i+2], lines[i+3], lines[i+4]],
                    a: lines[i+1]
                };
                if (possibleQ.q && possibleQ.options.length === 4) {
                    questions.push(possibleQ);
                    i += 4;
                }
            }
        }

        const shuffled = questions.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);

        res.json(selected);
    });
});

function startQuestionTimer() {
    if (questionInterval) clearInterval(questionInterval);
    if (delayTimeout) clearTimeout(delayTimeout);
    
    if (!gameState.currentRound || !gameState.currentRound.questions) return;
    
    let roundTimer = gameState.currentRound.timer || 15;
    gameState.timer = roundTimer;
    gameState.status = 'question';
    
    io.emit('gameStateUpdate', gameState);

    questionInterval = setInterval(() => {
        roundTimer--;
        gameState.timer = roundTimer;
        io.emit('timerUpdate', gameState.timer);

        if (roundTimer <= 0) {
            clearInterval(questionInterval);
            io.emit('revealAnswer');

            // Automatically advance to next question after the delay period
            const betweenDelay = (gameState.currentRound.betweenDelay || 5) * 1000;
            delayTimeout = setTimeout(() => {
                advanceToNextQuestion();
            }, betweenDelay);
        }
    }, 1000);
}

function advanceToNextQuestion() {
    if (gameState.currentRound && gameState.currentRound.questions) {
        if (gameState.currentQuestionIndex < gameState.currentRound.questions.length - 1) {
            gameState.currentQuestionIndex++;
            startQuestionTimer();
        } else {
            if (questionInterval) clearInterval(questionInterval);
            if (delayTimeout) clearTimeout(delayTimeout);
            gameState.status = 'finished';
            io.emit('gameStateUpdate', gameState);
        }
    }
}

io.on('connection', (socket) => {
    socket.emit('gameStateUpdate', gameState);

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            name: data.name || 'Anonymous Team',
            avatar: data.avatar || '🎯',
            score: 0
        };
        io.emit('updatePlayers', players);
    });

    socket.on('hostAction', (data) => {
        if (data.action === 'loadRound') {
            if (questionInterval) clearInterval(questionInterval);
            if (delayTimeout) clearTimeout(delayTimeout);
            gameState.currentRound = data.payload;
            gameState.currentQuestionIndex = 0;
            gameState.status = 'question';
            startQuestionTimer();
        } else if (data.action === 'nextQuestion') {
            if (questionInterval) clearInterval(questionInterval);
            if (delayTimeout) clearTimeout(delayTimeout);
            advanceToNextQuestion();
        } else if (data.action === 'resume') {
            startQuestionTimer();
        } else if (data.action === 'pause') {
            if (questionInterval) clearInterval(questionInterval);
            if (delayTimeout) clearTimeout(delayTimeout);
            gameState.status = 'paused';
            io.emit('gamePaused');
        } else if (data.action === 'reveal') {
            if (questionInterval) clearInterval(questionInterval);
            if (delayTimeout) clearTimeout(delayTimeout);
            io.emit('revealAnswer');
        } else if (data.action === 'updateSettings') {
            if (data.payload && data.payload.eventTitle) {
                gameState.settings.eventTitle = data.payload.eventTitle;
                io.emit('updateSettings', gameState.settings);
            }
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('updatePlayers', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`TriviaMania running on port ${PORT}`);
});
