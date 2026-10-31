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

// Game State
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

// --- SAFE API ENDPOINT FOR QUESTIONS ---
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

        if (questions.length === 0) {
            for (let i = 0; i < lines.length; i += 2) {
                if (lines[i] && lines[i+1]) {
                    questions.push({
                        q: lines[i],
                        a: lines[i+1],
                        options: [lines[i+1], "Option A", "Option B", "Option C"]
                    });
                }
            }
        }

        const shuffled = questions.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);

        res.json(selected);
    });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

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
            gameState.currentRound = data.payload;
            gameState.currentQuestionIndex = 0;
            gameState.status = 'question';
            io.emit('gameResumed', gameState);
            console.log('Round loaded:', data.payload.name);
        } else if (data.action === 'resume') {
            gameState.status = 'question';
            io.emit('gameResumed', gameState);
        } else if (data.action === 'pause') {
            gameState.status = 'paused';
            io.emit('gamePaused');
        } else if (data.action === 'reveal') {
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
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`TriviaMania running on port ${PORT}`);
});
