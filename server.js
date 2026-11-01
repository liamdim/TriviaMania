const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

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
let answeredThisQuestion = new Set();

const backupQuestionBanks = {
    "general": [
        { q: "What is the capital city of Australia?", a: "Canberra", options: ["Sydney", "Melbourne", "Canberra", "Brisbane"] },
        { q: "Which chemical element has the symbol 'Au'?", a: "Gold", options: ["Silver", "Gold", "Copper", "Argon"] },
        { q: "How many bones are in the adult human body?", a: "206", options: ["200", "206", "214", "198"] },
        { q: "What is the hardest natural substance on Earth?", a: "Diamond", options: ["Gold", "Iron", "Diamond", "Quartz"] },
        { q: "Which planet in our solar system is the largest?", a: "Jupiter", options: ["Saturn", "Jupiter", "Neptune", "Earth"] },
        { q: "In what year did the Apollo 11 mission land on the moon?", a: "1969", options: ["1967", "1969", "1971", "1965"] },
        { q: "What is the primary ingredient in traditional guacamole?", a: "Avocado", options: ["Tomato", "Avocado", "Lime", "Peas"] },
        { q: "Which artist painted the ceiling of the Sistine Chapel?", a: "Michelangelo", options: ["Leonardo da Vinci", "Raphael", "Michelangelo", "Donatello"] },
        { q: "What is the capital of Canada?", a: "Ottawa", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"] },
        { q: "Which gas makes up the majority of Earth's atmosphere?", a: "Nitrogen", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"] },
        { q: "How many strings does a standard guitar have?", a: "6", options: ["4", "5", "6", "8"] },
        { q: "What is the boiling point of water in Celsius?", a: "100°C", options: ["90°C", "100°C", "110°C", "120°C"] },
        { q: "Which ocean is the largest by total area?", a: "Pacific Ocean", options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"] },
        { q: "What is the currency of the United Kingdom?", a: "Pound Sterling", options: ["Euro", "Dollar", "Pound Sterling", "Franc"] },
        { q: "In what country is Machu Picchu located?", a: "Peru", options: ["Chile", "Peru", "Brazil", "Colombia"] },
        { q: "What is the main component of the sun?", a: "Hydrogen", options: ["Helium", "Hydrogen", "Carbon", "Oxygen"] },
        { q: "How many sides does a hexagon have?", a: "6", options: ["5", "6", "7", "8"] },
        { q: "What is the tallest mammal in the world?", a: "Giraffe", options: ["Elephant", "Giraffe", "Blue Whale", "Rhino"] },
        { q: "Who wrote the play 'Hamlet'?", a: "William Shakespeare", options: ["Charles Dickens", "Jane Austen", "William Shakespeare", "Mark Twain"] },
        { q: "What is the freezing point of water in Fahrenheit?", a: "32°F", options: ["0°F", "32°F", "50°F", "212°F"] }
    ],
    "movies": [
        { q: "Which film won Best Picture in 1994?", a: "Forrest Gump", options: ["Pulp Fiction", "The Shawshank Redemption", "Forrest Gump", "Quiz Show"] },
        { q: "Who directed 'Jurassic Park' (1993)?", a: "Steven Spielberg", options: ["James Cameron", "George Lucas", "Steven Spielberg", "Ridley Scott"] },
        { q: "What is Captain America's shield made of?", a: "Vibranium", options: ["Adamantium", "Unobtainium", "Vibranium", "Mithril"] }
    ]
};

app.get('/api/questions/:category', (req, res) => {
    let category = req.params.category.toLowerCase().trim();
    const count = parseInt(req.query.count) || 10;
    
    let filePath = path.join(__dirname, 'categories', `${category}.txt`);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'categories', `${category.replace(/-/g, '_')}.txt`);
    }
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'categories', `${category.replace(/_/g, '-')}.txt`);
    }

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
    answeredThisQuestion.clear();
    
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

    socket.on('submitAnswer', (data) => {
        if (!players[socket.id] || answeredThisQuestion.has(socket.id)) return;
        
        const qIndex = gameState.currentQuestionIndex || 0;
        const currentRound = gameState.currentRound;
        if (!currentRound || !currentRound.questions || !currentRound.questions[qIndex]) return;

        const currentQ = currentRound.questions[qIndex];
        const isCorrect = data.answer.trim() === currentQ.a.trim();

        if (isCorrect) {
            answeredThisQuestion.add(socket.id);
            const maxTimer = currentRound.timer || 15;
            const timeLeft = gameState.timer || 0;
            const earnedPoints = Math.round(50 + (50 * (timeLeft / maxTimer)));
            
            players[socket.id].score += earnedPoints;
            io.emit('updatePlayers', players);
            socket.emit('answerResult', { correct: true, points: earnedPoints });
        } else {
            answeredThisQuestion.add(socket.id);
            socket.emit('answerResult', { correct: false, points: 0 });
        }
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
