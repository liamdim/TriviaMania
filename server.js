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
    maxHttpBufferSize: 50 * 1024 * 1024
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let samplePolls = [
    { question: 'What is your team’s pre-trivia drink of choice?', options: ['Beer 🍺', 'Cocktail 🍸', 'Wine 🍷', 'Soft Drink 🥤'] },
    { question: 'Which decade had the absolute best music?', options: ['70s 🕺', '80s 🎸', '90s 📼', '00s 🎧'] },
    { question: 'How confident is your team tonight?', options: ['Total Winners 🏆', 'Just for Fun 🍻', 'Clueless 🤷', 'Robbed Last Week 😡'] },
    { question: 'What is the best pub snack?', options: ['Crisps 🥔', 'Nuts 🥜', 'Pork Crackling 🥓', 'None / Just Drinks 🍻'] },
    { question: 'Who is the most famous fictional wizard?', options: ['Gandalf 🧙‍♂️', 'Harry Potter ⚡', 'Merlin 📜', 'Dumbledore 🔮'] },
    { question: 'What superpower would you choose?', options: ['Invisibility 👻', 'Flight ✈️', 'Time Travel ⏳', 'Super Strength 💪'] }
];

let sampleFacts = [
    'Did you know? The pub record score is 480 points!',
    'Fun Fact: Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old!',
    'Did you know? Bananas are curved because they grow towards the sun against gravity.',
    'Trivia Fact: A group of flamingos is called a "flamboyance".',
    'Fun Fact: Earth is the only planet not named after a god or goddess.',
    'Did you know? Octopuses have three hearts and blue blood.',
    'Trivia Fact: Shakespeare invented over 1,700 words used in the English language today.',
    'Fun Fact: Sea otters hold hands while sleeping so they don’t drift apart.'
];

let usedFactsHistory = [];

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
        factText: sampleFacts[0],
        showPoll: true,
        pollQuestion: samplePolls[0].question,
        pollOptions: samplePolls[0].options,
        votes: {}
    },
    settings: { questionTime: 15 }
};

let timerInterval = null;
let disconnectedPlayers = {};
let categoryHistory = {};

function triggerNewPoll() {
    const randomPoll = samplePolls[Math.floor(Math.random() * samplePolls.length)];
    gameState.lobbySettings.pollQuestion = randomPoll.question;
    gameState.lobbySettings.pollOptions = randomPoll.options;
    gameState.lobbySettings.votes = {};
    gameState.lobbySettings.showPoll = true;
    io.emit('state-update', gameState);
}

function generateNewFact() {
    if (usedFactsHistory.length >= sampleFacts.length) {
        usedFactsHistory = [];
    }
    let availableFacts = sampleFacts.filter((_, idx) => !usedFactsHistory.includes(idx));
    let randomIndex = Math.floor(Math.random() * availableFacts.length);
    let originalIndex = sampleFacts.indexOf(availableFacts[randomIndex]);
    
    usedFactsHistory.push(originalIndex);
    gameState.lobbySettings.factText = sampleFacts[originalIndex];
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

app.post('/api/generate-ai-quiz', async (req, res) => {
    const { topic, count = 10, difficulty = 'medium' } = req.body;
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(400).json({ success: false, error: 'GEMINI_API_KEY is not set on the server.' });
        }
        const prompt = `Generate a ${difficulty} difficulty pub trivia round about "${topic}" containing exactly ${count} questions.
        You MUST format your response strictly as plain text using the following format for each question, with no extra conversational filler or markdown code blocks:
        
        #Q [Insert clear, factually accurate question here]
        A. [First option]
        B. [Second option]
        C. [Third option]
        D. [Fourth option]
        ^ [Exact correct option text from above]`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt
        });
        res.json({ success: true, raw: response.text });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/load-categories', (req, res) => {
    let catsDir = path.join(__dirname, 'categories');
    if (!fs.existsSync(catsDir)) catsDir = path.join(process.cwd(), 'categories');
    if (!fs.existsSync(catsDir)) {
        fs.mkdirSync(catsDir, { recursive: true });
        return res.json({ success: true, categories: [] });
    }

    fs.readdir(catsDir, (err, files) => {
        if (err) return res.status(500).json({ success: false, error: 'Could not read categories directory.' });
        const categories = [];
        files.forEach(file => {
            if (file.startsWith('.')) return;
            try {
                const filePath = path.join(catsDir, file);
                if (fs.statSync(filePath).isFile()) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    let questionsArr = [];
                    let categoryName = file.replace(/-/g, ' ').toUpperCase();
                    try {
                        const parsed = JSON.parse(content);
                        if (Array.isArray(parsed)) questionsArr = parsed;
                        else if (parsed.questions) { questionsArr = parsed.questions; categoryName = parsed.name || categoryName; }
                    } catch (e) {
                        // parse text
                        const lines = content.split(/\r?\n/);
                        let curQ = null;
                        lines.forEach(l => {
                            l = l.trim();
                            if (l.startsWith('#Q')) { if (curQ) questionsArr.push(curQ); curQ = { question: l.replace('#Q','').trim(), options: [], answer: '' }; }
                            else if (l.startsWith('^')) { if (curQ) curQ.answer = l.replace('^','').trim(); }
                            else if (/^[A-D][\.\s]/.test(l)) { if (curQ) curQ.options.push(l.replace(/^[A-D][\.\s]+/,'').trim()); }
                        });
                        if (curQ) questionsArr.push(curQ);
                    }
                    if (questionsArr.length > 0) categories.push({ filename: file, name: categoryName, questions: questionsArr });
                }
            } catch (e) {}
        });
        res.json({ success: true, categories });
    });
});

io.on('connection', (socket) => {
    socket.emit('state-update', gameState);

    socket.on('player-join', (playerName) => {
        const cleanName = sanitizeText(playerName) || 'Anonymous';
        gameState.scores[socket.id] = { name: cleanName, score: 0, streak: 0 };
        io.emit('state-update', gameState);
    });

    socket.on('submit-answer', ({ answer, timeRemaining }) => {
        if (gameState.status !== 'QUESTION') return;
        const player = gameState.scores[socket.id];
        if (!player || player.hasAnsweredCurrent) return;

        const currentRound = gameState.playlist[gameState.currentRoundIndex];
        const currentQ = currentRound?.questions[gameState.currentQuestionIndex];
        if (!currentQ) return;

        let isCorrect = (answer || '').trim().toLowerCase() === (currentQ.answer || '').trim().toLowerCase();
        let pointsEarned = 0;
        if (isCorrect) {
            player.streak = (player.streak || 0) + 1;
            pointsEarned = Math.round((50 + Math.floor((timeRemaining / gameState.timerMax) * 40)) * (player.streak >= 3 ? 1.5 : 1));
            player.score += pointsEarned;
        } else {
            player.streak = 0;
        }
        player.hasAnsweredCurrent = true;
        socket.emit('answer-result', { correct: isCorrect, points: pointsEarned, correctAnswer: currentQ.answer });
        io.emit('state-update', gameState);
    });

    socket.on('poll-vote', (option) => {
        if (!gameState.lobbySettings.votes) gameState.lobbySettings.votes = {};
        gameState.lobbySettings.votes[socket.id] = option;
        io.emit('state-update', gameState);
    });

    socket.on('trigger-new-poll', () => {
        triggerNewPoll();
    });

    socket.on('trigger-new-fact', () => {
        generateNewFact();
    });

    socket.on('add-custom-picture-round', (roundObj) => {
        if (!roundObj || !roundObj.questions) return;
        const fileKey = roundObj.filename || roundObj.name;
        if (!categoryHistory[fileKey]) categoryHistory[fileKey] = [];
        let allQ = [...roundObj.questions];
        if (categoryHistory[fileKey].length >= allQ.length) categoryHistory[fileKey] = [];
        let available = allQ.map((_, i) => i).filter(i => !categoryHistory[fileKey].includes(i));
        available.sort(() => Math.random() - 0.5);
        let picked = available.slice(0, parseInt(roundObj.questionCount) || 10);
        categoryHistory[fileKey].push(...picked);

        gameState.playlist.push({
            name: roundObj.name || 'Custom Round',
            timer: parseInt(roundObj.timer) || 15,
            questions: picked.map(i => allQ[i])
        });
        io.emit('state-update', gameState);
    });

    socket.on('start-round', () => {
        if (gameState.playlist.length === 0) return;
        gameState.status = 'QUESTION';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.timerMax = parseInt(gameState.playlist[0].timer) || 15;
        gameState.timer = gameState.timerMax;
        gameState.lobbySettings.showPoll = false; // Hide poll on start
        Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);
        io.emit('state-update', gameState);
        startQuestionTimer();
    });

    socket.on('start-next-round', () => {
        if (gameState.currentRoundIndex + 1 < gameState.playlist.length) {
            gameState.currentRoundIndex++;
            gameState.currentQuestionIndex = 0;
            gameState.status = 'QUESTION';
            gameState.timerMax = parseInt(gameState.playlist[gameState.currentRoundIndex].timer) || 15;
            gameState.timer = gameState.timerMax;
            gameState.lobbySettings.showPoll = false; // Hide poll on start
            Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);
            io.emit('state-update', gameState);
            startQuestionTimer();
        } else {
            gameState.status = 'LEADERBOARD';
            io.emit('state-update', gameState);
        }
    });

    socket.on('next-question', () => { advanceToNextQuestion(); });
    socket.on('stop-game', () => { gameState.status = 'PAUSED'; io.emit('state-update', gameState); });
    socket.on('restart-game', () => { gameState.status = 'IDLE'; gameState.currentRoundIndex = 0; gameState.currentQuestionIndex = 0; io.emit('state-update', gameState); });
    socket.on('stop-reset', () => { gameState.status = 'IDLE'; gameState.currentRoundIndex = 0; gameState.currentQuestionIndex = 0; gameState.scores = {}; io.emit('state-update', gameState); });
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
    if (!round) return;
    Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);
    gameState.currentQuestionIndex++;
    if (gameState.currentQuestionIndex >= round.questions.length) {
        gameState.status = 'INTERMISSION';
        io.emit('state-update', gameState);
        return;
    }
    gameState.status = 'QUESTION';
    gameState.timerMax = parseInt(round.timer) || 15;
    gameState.timer = gameState.timerMax;
    io.emit('state-update', gameState);
    startQuestionTimer();
}

server.listen(process.env.PORT || 10000);
