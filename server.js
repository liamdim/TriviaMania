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
    venueDetails: 'Welcome to Trivia Night!',
    welcomeHeader: 'Welcome to TriviaMania!',
    mobileWaitingText: 'Waiting for host to start game...',
    customEmojis: ['🔥', '🍻', '👏', '😂', '🎉', '💡'],
    announcement: { active: false, text: '' },
    settings: { 
        questionTime: 15,
        intermissionTime: 5,
        countdownSound: true 
    }
};

let timerInterval = null;
let disconnectedPlayers = {};

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

// BULK AI GENERATOR WITH PURE AI & GITHUB PERMANENT COMMIT
app.post('/api/generate-bulk-trivia', async (req, res) => {
    const { categoryName, count = 20 } = req.body;
    if (!categoryName) return res.status(400).json({ error: 'Category name is required' });

    const seed = Math.floor(Math.random() * 100000);
    const prompt = `Generate exactly ${count} completely unique, high-quality trivia questions about "${categoryName}" (Random Seed ${seed}).
    Return ONLY a valid JSON array of objects with keys:
    - "question": string
    - "options": array of 4 strings (1 correct answer and 3 clever plausible distractors)
    - "answer": string (the exact correct option matching one of the options)
    No markdown formatting, no backticks, just raw JSON array.`;

    let attempts = 0;
    let success = false;
    let responseText = '';
    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.8-flash'];

    while (attempts < 3 && !success) {
        try {
            attempts++;
            const activeModel = modelsToTry[(attempts - 1) % modelsToTry.length];
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: prompt,
            });
            responseText = response.text.trim();
            success = true;
        } catch (err) {
            if (attempts >= 3) {
                return res.status(500).json({ error: 'AI server is currently experiencing high demand. Please wait 10 seconds and try generating again!' });
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    try {
        if (responseText.startsWith('```json')) responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (responseText.startsWith('```')) responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim();

        const items = JSON.parse(responseText);
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(500).json({ error: 'Failed to parse generated questions format from AI.' });
        }

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
        const filePath = `categories/${fileName}`;

        const categoriesDir = path.join(__dirname, 'categories');
        if (!fs.existsSync(categoriesDir)) fs.mkdirSync(categoriesDir, { recursive: true });
        const localFullPath = path.join(categoriesDir, fileName);
        
        let existingLocal = fs.existsSync(localFullPath) ? fs.readFileSync(localFullPath, 'utf8') : '';
        const combinedContent = existingLocal + (existingLocal ? '\n' : '') + newContent;
        fs.writeFileSync(localFullPath, combinedContent, 'utf8');

        if (process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO) {
            try {
                const owner = process.env.GITHUB_OWNER;
                const repo = process.env.GITHUB_REPO;
                let sha = null;

                const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
                    headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'TriviaMania-Server' }
                });
                
                if (getRes.ok) {
                    const fileData = await getRes.json();
                    sha = fileData.sha;
                    const existingGithubContent = Buffer.from(fileData.content, 'base64').toString('utf8');
                    newContent = existingGithubContent + '\n' + newContent;
                }

                await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'TriviaMania-Server'
                    },
                    body: JSON.stringify({
                        message: `Auto-generated category: ${categoryName}`,
                        content: Buffer.from(newContent).toString('base64'),
                        sha: sha
                    })
                });
            } catch (gitErr) {
                console.error('GitHub auto-commit failed:', gitErr.message);
            }
        }

        res.json({ success: true, count: items.length, fileName });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process AI response: ' + err.message });
    }
});

// DIRECT BEATIQ TRACK LOADER (CHECKS MULTIPLE COMMON PATHS)
app.get('/api/beatiq/tracks', (req, res) => {
    try {
        const possiblePaths = [
            path.join(__dirname, 'curatedTracks.json'),
            path.join(__dirname, 'public', 'curatedTracks.json'),
            path.join(__dirname, 'data', 'curatedTracks.json')
        ];

        let foundPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                foundPath = p;
                break;
            }
        }

        if (foundPath) {
            const rawData = fs.readFileSync(foundPath, 'utf8');
            return res.json(JSON.parse(rawData));
        }

        return res.json([]);
    } catch (err) {
        return res.json([]);
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
    const seed = Math.floor(Math.random() * 100000);
    if (type === 'lingo') {
        prompt = `Generate exactly ${count} completely unique and randomized 5-letter English words (Random Seed ${seed}) for a Lingo game. Return ONLY a valid JSON array of objects with keys "word" (5 uppercase letters) and "hint" (short clever clue). No markdown.`;
    } else if (type === 'scramble') {
        prompt = `Generate exactly ${count} completely unique and randomized famous words, bands, movies, or cities (Random Seed ${seed}) for word scramble. Return ONLY a valid JSON array of objects with keys "word" (uppercase answer) and "scrambled" (letters spaced out like "S E T A E B L"). No markdown.`;
    } else if (type === 'higher-lower') {
        prompt = `Generate exactly ${count} completely randomized and fresh trivia statistics questions (Random Seed ${seed}). Return ONLY a valid JSON array of objects with keys "fact" (statement), "options" (array ["Higher", "Lower"]), and "answer" ("Higher" or "Lower"). No markdown.`;
    } else if (type === 'tenable') {
        prompt = `Generate exactly ${count} completely randomized Tenable top list challenges (Random Seed ${seed}). Return ONLY a valid JSON array of objects with keys "category" (list description) and "answer" (correct top item). No markdown.`;
    } else if (type === 'one-percent') {
        prompt = `Generate exactly ${count} completely randomized 1% Club logic brainteasers (Random Seed ${seed}). Return ONLY a valid JSON array of objects with keys "q" (question), "answer" (short answer), and "options" (array of 4 choices including correct answer). No markdown.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
        });

        let text = response.text.trim();
        if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '').trim();

        return JSON.parse(text);
    } catch (err) {
        return [];
    }
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

    socket.on('add-beatiq-round', (roundConfig) => {
        let allTracks = [];
        try {
            const possiblePaths = [
                path.join(__dirname, 'curatedTracks.json'),
                path.join(__dirname, 'public', 'curatedTracks.json'),
                path.join(__dirname, 'data', 'curatedTracks.json')
            ];
            let foundPath = null;
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    foundPath = p;
                    break;
                }
            }
            if (foundPath) allTracks = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
        } catch (err) {}

        const targetGenre = roundConfig.genre;
        const requestedCount = parseInt(roundConfig.questionCount || roundConfig.count || 10);
        
        let genreFilteredTracks = allTracks.filter(t => t.genre && t.genre.toLowerCase() === targetGenre.toLowerCase());
        let trackPool = genreFilteredTracks.length >= 3 ? genreFilteredTracks : allTracks;
        
        const selectedTracks = [...trackPool].sort(() => 0.5 - Math.random()).slice(0, requestedCount);
        const allArtists = allTracks.map(t => t.artist);

        const questions = selectedTracks.map((t) => {
            const wrongArtists = allArtists.filter(a => a !== t.artist).sort(() => 0.5 - Math.random()).slice(0, 3);
            while (wrongArtists.length < 3) wrongArtists.push('Alternative Artist ' + (wrongArtists.length + 1));
            const options = [t.artist, ...wrongArtists].sort(() => 0.5 - Math.random());

            return {
                question: '🎧 Listen to snippet: Which artist performed "' + t.title + '"?',
                options: options,
                answer: t.artist,
                fastestPlayerId: null,
                audioPreviewUrl: t.previewUrl || null
            };
        });

        gameState.playlist.push({
            name: '🎵 Music: ' + roundConfig.name,
            genre: 'BeatIQ (' + targetGenre + ')',
            timer: 20,
            questions: questions
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
                const scrambled = item.scrambled || ans.split('').join(' ');
                const options = [ans, 'MUSIC', 'BAND', 'STAGE'].sort(() => 0.5 - Math.random());
                return {
                    gameType: 'scramble',
                    question: '🔀 WORD SCRAMBLE: [ ' + scrambled + ' ]',
                    answer: ans,
                    options: options,
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
        } else if (config.type === 'tenable') {
            questions = rawItems.map(item => {
                const ans = item.answer || 'Top Choice';
                const options = [ans, 'Option A', 'Option B', 'Option C'].sort(() => 0.5 - Math.random());
                return {
                    gameType: 'tenable',
                    question: '🔟 TENABLE: ' + (item.category || 'Top List'),
                    answer: ans,
                    options: options,
                    fastestPlayerId: null
                };
            });
        } else if (config.type === 'one-percent') {
            questions = rawItems.map(item => {
                const ans = item.answer || 'Solution';
                const opts = item.options ? [...item.options] : [ans, 'A', 'B', 'C'];
                if (!opts.includes(ans)) opts[0] = ans;
                return {
                    gameType: 'one-percent',
                    question: '🧠 1% CLUB: ' + (item.q || 'Brainteaser'),
                    answer: ans,
                    options: opts.sort(() => 0.5 - Math.random()),
                    fastestPlayerId: null
                };
            });
        }

        if (questions.length > 0) {
            gameState.playlist.push({
                name: config.name || '🎮 AI Game Show: ' + config.type.toUpperCase(),
                genre: 'AI Gen (' + config.type + ')',
                timer: 25,
                questions: questions
            });
            io.emit('state-update', gameState);
        }
    });

    socket.on('update-venue-details', (details) => {
        gameState.venueDetails = sanitizeText(details);
        io.emit('state-update', gameState);
    });

    socket.on('update-welcome-header', (headerText) => {
        gameState.welcomeHeader = sanitizeText(headerText);
        io.emit('state-update', gameState);
    });

    socket.on('update-mobile-waiting', (waitingText) => {
        gameState.mobileWaitingText = sanitizeText(waitingText);
        io.emit('state-update', gameState);
    });

    socket.on('update-custom-emojis', (emojisArray) => {
        if (Array.isArray(emojisArray)) {
            gameState.customEmojis = emojisArray;
            io.emit('state-update', gameState);
        }
    });

    socket.on('toggle-chat', (enabled) => {
        gameState.chatEnabled = enabled;
        io.emit('state-update', gameState);
    });

    socket.on('toggle-mute-player', (socketId) => {
        gameState.mutedPlayers[socketId] = !gameState.mutedPlayers[socketId];
        io.emit('state-update', gameState);
    });

    socket.on('update-announcement', (announcementData) => {
        gameState.announcement = {
            active: announcementData.active,
            text: sanitizeText(announcementData.text)
        };
        io.emit('announcement-update', gameState.announcement);
    });

    socket.on('send-emoji', (emoji) => {
        if (!gameState.chatEnabled) return;
        if (gameState.mutedPlayers[socket.id]) return;
        io.emit('player-emoji', { id: socket.id, emoji });
    });

    socket.on('player-chat', (message) => {
        if (!gameState.chatEnabled) return;
        if (gameState.mutedPlayers[socket.id]) return;
        const cleanMsg = sanitizeText(message);
        if (!cleanMsg) return;
        const player = gameState.scores[socket.id];
        const chatObj = { name: player ? player.name : 'Anonymous', text: cleanMsg };
        io.emit('chat-message', chatObj);
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
        io.emit('stop-audio');
        io.emit('state-update', gameState);
    });

    socket.on('restart-game', () => {
        if (timerInterval) clearInterval(timerInterval);
        gameState.status = 'IDLE';
        gameState.currentRoundIndex = 0;
        gameState.currentQuestionIndex = 0;
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
        io.emit('stop-audio');
        io.emit('state-update', gameState);
    });

    socket.on('disconnect', () => {
        const player = gameState.scores[socket.id];
        if (player) {
            const playerName = player.name;
            disconnectedPlayers[playerName] = {
                playerData: player,
                timeout: setTimeout(() => {
                    delete gameState.scores[socket.id];
                    delete gameState.mutedPlayers[socket.id];
                    delete disconnectedPlayers[playerName];
                    io.emit('state-update', gameState);
                }, 10000)
            };
            delete gameState.scores[socket.id];
        }
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
        } else {
            gameState.status = 'LEADERBOARD';
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('TriviaMania server running on port ' + PORT);
});
