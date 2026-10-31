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
    },
    advert: { active: false, title: '', image: '', target: 'none' },
    poll: { active: false, question: 'What is your favorite pub drink?', options: ['Beer / Cider', 'Wine / Prosecco', 'Cocktails', 'Soft Drinks'], votes: {} }
};

let players = {};
let questionInterval = null;
let delayTimeout = null;

const backupQuestionBanks = {
    "general": [
        { q: "What is the capital city of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
        { q: "Which chemical element has the symbol 'Au'?", a: "Gold", options: ["Silver", "Gold", "Copper", "Argon"] },
        { q: "How many bones are in the adult human body?", a: "206", options: ["200", "206", "214", "198"] },
        { q: "What is the hardest natural substance on Earth?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Quartz"] },
        { q: "Which planet in our solar system is the largest?", a: "Jupiter", options: ["Saturn", "Jupiter", "Neptune", "Earth"] },
        { q: "In what year did the Apollo 11 mission land on the moon?", a: "1969", options: ["1967", "1969", "1971", "1965"] }
    ],
    "movies": [
        { q: "Which film won Best Picture in 1994?", a: "Forrest Gump", options: ["Pulp Fiction", "The Shawshank Redemption", "Forrest Gump", "Quiz Show"] },
        { q: "Who directed 'Jurassic Park' (1993)?", a: "Steven Spielberg", options: ["James Cameron", "George Lucas", "Steven Spielberg", "Ridley Scott"] }
    ]
};

app.get('/api/questions/:category', (req, res) => {
    const category = req.params.category;
    const count = parseInt(req.query.count) || 10;
    const filePath = path.join(__dirname, 'categories', `${category}.txt`);

    if (!fs.existsSync(filePath)) {
        const pool = backupQuestionBanks[category] || backupQuestionBanks["general"];
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return res.json(shuffled.slice(0, count));
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            const pool = backupQuestionBanks[category] || backupQuestionBanks["general"];
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            return res.json(shuffled.slice(0, count));
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
            questions = backupQuestionBanks[category] || backupQuestionBanks["general"];
        }

        const shuffled = questions.sort(() => Math.random() - 0.5);
        res.json(shuffled.slice(0, count));
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
    socket.emit('pollUpdate', gameState.poll);
    socket.emit('updatePlayers', players);
    
    // Send current advert state immediately upon connection
    if (gameState.advert.active) {
        socket.emit('advertUpdate', gameState.advert);
    }

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            name: data.name || 'Anonymous Team',
            avatar: data.avatar || '🎯',
            score: 0
        };
        io.emit('updatePlayers', players);
    });

    socket.on('submitVote', (data) => {
        if (socket.id && players[socket.id]) {
            gameState.poll.votes[socket.id] = { name: players[socket.id].name, vote: data.vote };
            io.emit('pollUpdate', gameState.poll);
        }
    });

    socket.on('hostAction', (data) => {
        if (data.action === 'loadRound') {
            if (questionInterval) clearInterval(questionInterval);
            if (delayTimeout) clearTimeout(delayTimeout);
            gameState.currentRound = data.payload;
            gameState.currentQuestionIndex = 0;
            gameState.status = 'question';
            startQuestionTimer();
        } else if (data.action === 'restart') {
            if (questionInterval) clearInterval(questionInterval);
            if (delayTimeout) clearTimeout(delayTimeout);
            gameState.currentQuestionIndex = 0;
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
        } else if (data.action === 'pushAdvert') {
            gameState.advert = { 
                active: true, 
                title: data.payload.title || 'Sponsor Ad', 
                image: data.payload.image || '', 
                target: data.payload.target || 'both' 
            };
            io.emit('advertUpdate', gameState.advert);
        } else if (data.action === 'hideAdvert') {
            gameState.advert.active = false;
            io.emit('advertUpdate', gameState.advert);
        } else if (data.action === 'updatePoll') {
            if (data.payload && data.payload.question) {
                const optList = typeof data.payload.options === 'string' 
                    ? data.payload.options.split(',').map(s => s.trim()).filter(Boolean) 
                    : (data.payload.options || ['Yes', 'No']);
                
                if (!data.payload.active) {
                    gameState.poll.active = false;
                } else {
                    gameState.poll = { 
                        active: true, 
                        question: data.payload.question, 
                        options: optList,
                        votes: {} 
                    };
                }
                io.emit('pollUpdate', gameState.poll);
            }
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
