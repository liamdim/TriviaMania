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
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 50 * 1024 * 1024 // 50MB limit for image and file uploads
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
    settings: { questionTime: 15 }
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

// --- AI QUIZ GENERATOR ENDPOINT ---
app.post('/api/generate-ai-quiz', async (req, res) => {
    const { topic, count = 10, difficulty = 'medium' } = req.body;
    
    try {
        const prompt = `Generate a ${difficulty} difficulty pub trivia round about "${topic}" containing exactly ${count} questions.
        You MUST format your response strictly as plain text using the following format for each question, with no extra conversational filler or markdown code blocks:
        
        #Q [Insert clear, factually accurate question here]
        A. [First option]
        B. [Second option]
        C. [Third option]
        D. [Fourth option]
        ^ [Exact correct option text from above]
        
        Ensure all questions make complete factual sense, have distinct answers, and avoid ambiguity.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        const textOutput = response.text;
        res.json({ success: true, raw: textOutput });
    } catch (err) {
        console.error('AI Generation Error:', err);
        res.status(500).json({ success: false, error: 'Failed to generate AI questions.' });
    }
});

// --- LOAD LOCAL CATEGORIES FROM "categories" FOLDER ---
app.get('/api/load-categories', (req, res) => {
    const catsDir = path.join(__dirname, 'categories');
    
    if (!fs.existsSync(catsDir)) {
        fs.mkdirSync(catsDir, { recursive: true });
        return res.json({ success: true, categories: [] });
    }

    fs.readdir(catsDir, (err, files) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Could not read categories directory.' });
        }

        const categories = [];
        files.forEach(file => {
            if (path.extname(file).toLowerCase() === '.json') {
                try {
                    const filePath = path.join(catsDir, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const parsed = JSON.parse(content);
                    categories.push({
                        filename: file,
                        name: parsed.name || path.basename(file, '.json'),
                        questions: parsed.questions || []
                    });
                } catch (e) {
                    console.error(`Error parsing category file ${file}:`, e);
                }
            }
        });

        res.json({ success: true, categories });
    });
});

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

    socket.on('update-projector-text', ({ header, details }) => {
        if (header !== undefined) gameState.welcomeHeader = sanitizeText(header);
        if (details !== undefined) gameState.venueDetails = sanitizeText(details);
        io.emit('state-update', gameState);
    });

    socket.on('update-lobby-settings', (settings) => {
        if (settings) {
            gameState.lobbySettings.showFact = !!settings.showFact;
            gameState.lobbySettings.factText = sanitizeText(settings.factText);
            gameState.lobbySettings.showPoll = !!settings.showPoll;
            gameState.lobbySettings.pollQuestion = sanitizeText(settings.pollQuestion);
            if (Array.isArray(settings.pollOptions)) {
                gameState.lobbySettings.pollOptions = settings.pollOptions.map(o => sanitizeText(o));
            }
        }
        io.emit('state-update', gameState);
    });

    socket.on('trigger-new-poll', () => {
        triggerNewPoll();
    });

    socket.on('update-custom-emojis', (emojis) => {
        if (Array.isArray(emojis) && emojis.length > 0) {
            gameState.customEmojis = emojis.slice(0, 10).map(e => sanitizeText(e));
            io.emit('state-update', gameState);
        }
    });

    socket.on('save-new-advert', (adObj) => {
        if (adObj && (adObj.text || adObj.image)) {
            gameState.adverts.push({
                text: sanitizeText(adObj.text || ''),
                image: adObj.image || ''
            });
            io.emit('state-update', gameState);
        }
    });

    socket.on('delete-advert', (index) => {
        if (gameState.adverts && gameState.adverts[index]) {
            gameState.adverts.splice(index, 1);
            io.emit('state-update', gameState);
        }
    });

    socket.on('broadcast-advert-screen', (adData) => {
        gameState.activeScreenAdvert = adData ? { text: sanitizeText(adData.text), image: adData.image || '' } : null;
        io.emit('state-update', gameState);
    });

    socket.on('broadcast-advert-mobile', (adData) => {
        gameState.activeMobileAdvert = adData ? { text: sanitizeText(adData.text), image: adData.image || '' } : null;
        io.emit('state-update', gameState);
    });

    socket.on('hide-advert-screen', () => {
        gameState.activeScreenAdvert = null;
        io.emit('state-update', gameState);
    });

    socket.on('hide-advert-mobile', () => {
        gameState.activeMobileAdvert = null;
        io.emit('state-update', gameState);
    });

    socket.on('add-custom-picture-round', (roundObj) => {
        if (!roundObj || !roundObj.questions || roundObj.questions.length === 0) return;
        gameState.playlist.push({
            name: roundObj.name || '🖼️ Custom Round',
            genre: 'Custom Round',
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

            Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);
            triggerNewPoll();
            io.emit('state-update', gameState);
            startQuestionTimer();
        } else {
            gameState.status = 'LEADERBOARD';
            io.emit('state-update', gameState);
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
        disconnectedPlayers = {};
        triggerNewPoll();
        io.emit('state-update', gameState);
    });

    socket.on('disconnect', () => {
        delete gameState.mutedPlayers[socket.id];
        io.emit('state-update', gameState);
    });
});

function getCurrentRoundTimer() {
    const round = gameState.playlist[gameState.currentRoundIndex];
    if (round && round.timer) return parseInt(round.timer);
    return gameState.settings.questionTime || 15;
}

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
