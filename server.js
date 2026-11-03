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
    mobileWaitingText: 'Waiting for host to start game...',
    customEmojis: ['🔥', '🍻', '👏', '😂', '🎉', '💡'],
    adverts: [
        { text: '🍻 Bar Sponsor Special: Enjoy drink deals at the counter tonight!', image: '' },
        { text: '🎵 Next Week Preview: Don’t miss our special Music Bingo Night!', image: '' }
    ],
    lobbySettings: {
        showFact: true,
        factText: 'Did you know? The pub record score is 480 points!',
        showPoll: true,
        pollQuestion: samplePolls[0].question,
        pollOptions: samplePolls[0].options,
        votes: {}
    },
    announcement: { active: false, text: '' },
    settings: { 
        questionTime: 15,
        intermissionTime: 5,
        countdownSound: true 
    }
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

app.post('/api/generate-bulk-trivia', async (req, res) => {
    const { categoryName, count = 20 } = req.body;
    if (!categoryName) return res.status(400).json({ error: 'Category name is required' });

    const seed = Date.now() + Math.floor(Math.random() * 100000);
    const prompt = `Generate exactly ${count} completely unique, varied, and fresh trivia questions about "${categoryName}" (Timestamp Seed ${seed}).
    Return ONLY a valid JSON array of objects with keys:
    - "question": string
    - "options": array of 4 strings
    - "answer": string
    No markdown, just raw JSON array.`;

    let attempts = 0;
    let success = false;
    let responseText = '';

    while (attempts < 3 && !success) {
        try {
            attempts++;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            responseText = response.text.trim();
            success = true;
        } catch (err) {
            if (attempts >= 3) return res.status(500).json({ error: 'AI server busy. Please try again.' });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    try {
        if (responseText.startsWith('```json')) responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (responseText.startsWith('```')) responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim();

        const items = JSON.parse(responseText);
        let newContent = '';
        items.forEach((item) => {
            newContent += `#Q ${item.question}\n`;
            if (item.options && Array.isArray(item.options)) {
                item.options.forEach((opt, oIdx) => {
                    const letters = ['A', 'B', 'C', 'D'];
                    newContent += `${letters[oIdx] || 'A'} ${opt}\n`;
                });
            }
            newContent += `^${item.answer}\n\n`;
        });

        const fileName = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const categoriesDir = path.join(__dirname, 'categories');
        if (!fs.existsSync(categoriesDir)) fs.mkdirSync(categoriesDir, { recursive: true });
        fs.writeFileSync(path.join(categoriesDir, fileName), newContent, 'utf8');

        res.json({ success: true, count: items.length, fileName });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process AI response: ' + err.message });
    }
});

app.post('/api/add-track-quiz', async (req, res) => {
    const { songQuery } = req.body;
    if (!songQuery) return res.status(400).json({ error: 'Song input is required' });

    const seed = Date.now() + Math.floor(Math.random() * 100000);
    const prompt = `Create a list of multiple-choice trivia questions based on these songs, artists, or links: "${songQuery}" (Timestamp Seed ${seed}).
    Return ONLY a valid JSON array of objects with keys:
    - "question": string
    - "options": array of 4 strings
    - "answer": string
    No markdown, just raw JSON array.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        let text = response.text.trim();
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '').trim();

        const items = JSON.parse(text);
        const questions = items.map(item => ({
            question: item.question,
            options: (item.options || []).sort(() => 0.5 - Math.random()),
            answer: item.answer,
            fastestPlayerId: null
        }));

        res.json({ success: true, questions });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate quiz: ' + err.message });
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

async function generateAIQuestions(type, count) {
    let prompt = '';
    const seed = Date.now() + Math.floor(Math.random() * 100000);
    
    if (type === 'lingo') {
        prompt = `Generate exactly ${count} completely unique, randomized 5-letter English words (Timestamp Seed ${seed}) for a Lingo game. Return ONLY a valid JSON array of objects with keys "word" (5 uppercase letters) and "hint" (short clever clue). No markdown, no introductory text, just raw JSON array.`;
    } else if (type === 'scramble') {
        prompt = `Generate exactly ${count} famous words, bands, movies, or cities (Timestamp Seed ${seed}) for word scramble. For each item, provide the correct answer ("word") AND 3 tricky multiple-choice options ("options" array containing 4 strings total: the correct answer and 3 deceptive decoy words that share similar letters or spelling patterns). Return ONLY a valid JSON array of objects with keys "word", "scrambled" (randomly jumbled letters separated by spaces like "L E A B T S E"), "options" (array of 4 strings including the word), and "answer" (the correct word). No markdown, just raw JSON array.`;
    } else if (type === 'higher-lower') {
        prompt = `Generate exactly ${count} completely randomized and fresh trivia statistics questions (Timestamp Seed ${seed}). Return ONLY a valid JSON array of objects with keys "fact" (statement), "options" (array ["Higher", "Lower"]), and "answer" ("Higher" or "Lower"). No markdown, no introductory text, just raw JSON array.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        let text = response.text ? response.text.trim() : '';
        
        if (text.startsWith('```json')) {
            text = text.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (text.startsWith('```')) {
            text = text.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch (err) {
        console.error('AI generation error:', err.message);
    }

    if (type === 'scramble') {
        return [
            { word: 'BEATLES', scrambled: 'S E T A E B L', options: ['BEATLES', 'BALTEES', 'BASTLES', 'BEALTES'], answer: 'BEATLES' },
            { word: 'MATRIX', scrambled: 'X I R T A M', options: ['MATRIX', 'MARTIX', 'MATRXI', 'MITRAX'], answer: 'MATRIX' },
            { word: 'DIAMOND', scrambled: 'D N O M A I D', options: ['DIAMOND', 'DAMIOND', 'DIMANOV', 'DOMIAND'], answer: 'DIAMOND' }
        ].slice(0, count);
    } else if (type === 'lingo') {
        return [
            { word: 'SHARK', hint: 'Ocean predator' },
            { word: 'TIGER', hint: 'Striped big cat' },
            { word: 'PLANT', hint: 'Green living thing' }
        ].slice(0, count);
    } else {
        return [
            { fact: 'Average annual rainfall in London (mm)', options: ['Higher', 'Lower'], answer: 'Lower' },
            { fact: 'Global population in billions', options: ['Higher', 'Lower'], answer: 'Higher' }
        ].slice(0, count);
    }
}

function getCurrentRoundTimer() {
    const round = gameState.playlist[gameState.currentRoundIndex];
    if (round && round.timer) return round.timer;
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

        let isCorrect = answer.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
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

    socket.on('trigger-new-poll', () => {
        triggerNewPoll();
    });

    socket.on('mute-player', (targetId) => {
        gameState.mutedPlayers[targetId] = true;
        io.emit('state-update', gameState);
    });

    socket.on('unmute-player', (targetId) => {
        delete gameState.mutedPlayers[targetId];
        io.emit('state-update', gameState);
    });

    socket.on('update-adverts-library', (newAdverts) => {
        if (Array.isArray(newAdverts)) {
            gameState.adverts = newAdverts;
            io.emit('state-update', gameState);
        }
    });

    socket.on('add-round', (roundConfig) => {
        const questions = parseCategoryFile(roundConfig.genre);
        const selectedQuestions = questions.slice(0, roundConfig.count || 10);
        
        gameState.playlist.push({
            name: roundConfig.name || roundConfig.genre,
            genre: roundConfig.genre,
            timer: roundConfig.timer ? parseInt(roundConfig.timer) : null,
            questions: selectedQuestions
        });
        io.emit('state-update', gameState);
    });

    socket.on('add-custom-playlist', (playlistObj) => {
        if (!playlistObj || !playlistObj.questions || playlistObj.questions.length === 0) return;
        gameState.playlist.push({
            name: playlistObj.name || 'Custom Playlist',
            genre: 'Saved Music Playlist',
            timer: 20,
            questions: playlistObj.questions
        });
        io.emit('state-update', gameState);
    });

    socket.on('add-minigame-round', async (config) => {
        const count = parseInt(config.count || 5);
        const rawItems = await generateAIQuestions(config.type, count);
        let questions = [];

        if (config.type === 'lingo') {
            questions = rawItems.map(item => ({
                gameType: 'lingo',
                question: '🔤 LINGO: Guess 5-letter word! Hint: ' + (item.hint || 'Clue'),
                answer: (item.word || 'SHARK').toUpperCase(),
                options: [],
                fastestPlayerId: null
            }));
        } else if (config.type === 'scramble') {
            questions = rawItems.map(item => {
                const ans = (item.word || 'BEATLES').toUpperCase();
                const scrambled = item.scrambled || ans.split('').sort(() => 0.5 - Math.random()).join(' ');
                const opts = item.options ? [...item.options].sort(() => 0.5 - Math.random()) : [ans, 'BAND', 'MUSIC', 'STAGE'].sort(() => 0.5 - Math.random());
                return {
                    gameType: 'scramble',
                    question: '🔀 WORD SCRAMBLE: [ ' + scrambled + ' ]',
                    answer: ans,
                    options: opts,
                    fastestPlayerId: null
                };
            });
        } else if (config.type === 'higher-lower') {
            questions = rawItems.map(item => ({
                gameType: 'higher-lower',
                question: '⬆️ HIGHER OR LOWER: ' + (item.fact || 'Statistic'),
                answer: item.answer || 'Higher',
                options: ['Higher', 'Lower'],
                fastestPlayerId: null
            }));
        }

        if (questions.length > 0) {
            gameState.playlist.push({
                name: config.name || '🎮 AI Game Show: ' + config.type.toUpperCase(),
                genre: 'AI Gen (' + config.type + ')',
                timer: 25,
                questions: questions
            });
            io.emit('state-update', gameState);
            socket.emit('minigame-added', { success: true });
        } else {
            socket.emit('minigame-added', { success: false, error: 'AI returned empty data. Please try again.' });
        }
    });

    socket.on('update-welcome-header', (headerText) => {
        gameState.welcomeHeader = sanitizeText(headerText);
        io.emit('state-update', gameState);
    });

    socket.on('update-venue-details', (details) => {
        gameState.venueDetails = sanitizeText(details);
        io.emit('state-update', gameState);
    });

    socket.on('update-lobby-toolkit', (toolkitSettings) => {
        let opts = gameState.lobbySettings.pollOptions;
        if (toolkitSettings.pollOptionsStr) {
            opts = toolkitSettings.pollOptionsStr.split(',').map(o => o.trim()).filter(o => o.length > 0);
        }
        gameState.lobbySettings = {
            showFact: !!toolkitSettings.showFact,
            factText: sanitizeText(toolkitSettings.factText),
            showPoll: !!toolkitSettings.showPoll,
            pollQuestion: sanitizeText(toolkitSettings.pollQuestion),
            pollOptions: opts,
            votes: gameState.lobbySettings.votes || {}
        };
        io.emit('state-update', gameState);
    });

    socket.on('update-emojis', (emojisArray) => {
        if (Array.isArray(emojisArray)) {
            gameState.customEmojis = emojisArray;
            io.emit('state-update', gameState);
        }
    });

    socket.on('player-reaction', (emoji) => {
        const cleanEmoji = sanitizeText(emoji);
        if (cleanEmoji) {
            io.emit('trigger-floating-emoji', cleanEmoji);
        }
    });

    socket.on('player-chat', (message) => {
        if (gameState.mutedPlayers[socket.id]) return;
        const player = gameState.scores[socket.id];
        const name = player ? player.name : 'Player';
        const cleanMsg = sanitizeText(message);
        if (cleanMsg) {
            io.emit('chat-message', { name: name, text: cleanMsg });
        }
    });

    socket.on('host-chat-broadcast', (message) => {
        const cleanMsg = sanitizeText(message);
        if (!cleanMsg) return;
        io.emit('chat-message', { name: 'HOST 📢', text: cleanMsg });
    });

    socket.on('broadcast-advert-screen', (adData) => {
        gameState.activeScreenAdvert = adData;
        io.emit('state-update', gameState);
        io.emit('broadcast-advert-screen', adData);
    });

    socket.on('hide-advert-screen', () => {
        gameState.activeScreenAdvert = null;
        io.emit('state-update', gameState);
        io.emit('hide-advert-screen');
    });

    socket.on('broadcast-advert-mobile', (adData) => {
        gameState.activeMobileAdvert = adData;
        io.emit('broadcast-advert-mobile', adData);
    });

    socket.on('hide-advert-mobile', () => {
        gameState.activeMobileAdvert = null;
        io.emit('hide-advert-mobile');
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

    socket.on('next-question', () => {
        advanceToNextQuestion();
    });

    socket.on('stop-game', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'PAUSED';
        triggerNewPoll();
        io.emit('stop-audio');
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
        io.emit('stop-audio');
        io.emit('state-update', gameState);
    });

    socket.on('stop-reset', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'IDLE';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
        gameState.activeScreenAdvert = null;
        gameState.activeMobileAdvert = null;
        gameState.scores = {};
        gameState.mutedPlayers = {};
        disconnectedPlayers = {};
        triggerNewPoll();
        io.emit('stop-audio');
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
        if (gameState.currentRoundIndex + 1 < gameState.playlist.length) {
            gameState.currentRoundIndex++;
            gameState.currentQuestionIndex = 0;
            triggerNewPoll();
        } else {
            gameState.status = 'LEADERBOARD';
            triggerNewPoll();
            io.emit('stop-audio');
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log('TriviaMania server running on port ' + PORT);
});
