const express = require('express');
const http = http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize Gemini AI (uses process.env.GEMINI_API_KEY)
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

const badWords = [
    'damn', 'hell', 'shit', 'fuck', 'bitch', 'crap', 'ass', 
    'bastard', 'cunt', 'dick', 'piss', 'cock', 'prick', 'wanker', 'arse'
];

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

app.get('/api/beatiq/tracks', (req, res) => {
    try {
        function findFile(dir, filename) {
            if (!fs.existsSync(dir)) return null;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        if (file === 'node_modules' || file === '.git') continue;
                        const found = findFile(fullPath, filename);
                        if (found) return found;
                    } else if (file === filename) {
                        return fullPath;
                    }
                } catch (e) {}
            }
            return null;
        }

        const foundPath = findFile(__dirname, 'curatedTracks.json');
        if (foundPath) {
            const rawData = fs.readFileSync(foundPath, 'utf8');
            const data = JSON.parse(rawData);
            return res.json(data);
        }
        return res.json([]);
    } catch (err) {
        return res.json([]);
    }
});

function parseCategoryFile(filename) {
    const categoriesDir = path.join(__dirname, 'categories');
    let filePath = path.join(categoriesDir, filename);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(categoriesDir, filename + '.txt');
    }
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
    return questions;
}

async function generateAIQuestions(type, count) {
    let prompt = '';
    if (type === 'lingo') {
        prompt = `Generate exactly ${count} unique 5-letter English words for a Lingo/Wordle style pub game. Return ONLY a valid JSON array of objects with keys "word" (5 uppercase letters) and "hint" (a short clever clue). No markdown formatting or extra text.`;
    } else if (type === 'scramble') {
        prompt = `Generate exactly ${count} famous words or names (like bands, cities, movies) for a word scramble game. Return ONLY a valid JSON array of objects with keys "word" (the uppercase answer) and "scrambled" (the letters spaced out with spaces, e.g. "S E T A E B L"). No markdown or extra text.`;
    } else if (type === 'higher-lower') {
        prompt = `Generate exactly ${count} interesting trivia statistics questions where the answer is Higher or Lower or a number. Return ONLY a valid JSON array of objects with keys "fact" (the trivia statement), "options" (array containing exactly ["Higher", "Lower"]), and "answer" ("Higher" or "Lower"). No markdown or extra text.`;
    } else if (type === 'tenable') {
        prompt = `Generate exactly ${count} Tenable-style top list challenges (e.g., Top 5 most populous countries, top 5 highest grossing movies). Return ONLY a valid JSON array of objects with keys "category" (the list description) and "answer" (one correct top item from that list). No markdown or extra text.`;
    } else if (type === 'one-percent') {
        prompt = `Generate exactly ${count} lateral thinking brainteasers or clever math/word puzzles for a 1% Club style game show. Return ONLY a valid JSON array of objects with keys "q" (the puzzle question), "answer" (the correct short answer), and "options" (an array of 4 possible choices including the correct answer). No markdown or extra text.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        let text = response.text.trim();
        if (text.startsWith('```json')) {
            text = text.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (text.startsWith('```')) {
            text = text.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(text);
        return parsed;
    } catch (err) {
        console.error('AI Generation Error:', err);
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
        gameState.scores[socket.id] = { name: cleanName, score: 0, streak: 0 };
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
        if (currentQ.gameType === 'lingo') {
            isCorrect = answer.trim().toUpperCase() === currentQ.answer.trim().toUpperCase();
        } else {
            isCorrect = answer.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
        }

        let pointsEarned = 0;
        if (isCorrect) {
            if (!currentQ.fastestPlayerId) {
                currentQ.fastestPlayerId = socket.id;
            }
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
        socket.emit('answer-result', { correct: isCorrect, points: pointsEarned, streak: player.streak, isFastest: currentQ.fastestPlayerId === socket.id });
        io.emit('state-update', gameState);
    });

    socket.on('add-round', (roundConfig) => {
        const questions = parseCategoryFile(roundConfig.genre);
        const selectedQuestions = questions.sort(() => 0.5 - Math.random()).slice(0, roundConfig.count || 10);
        
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
            function findFile(dir, filename) {
                if (!fs.existsSync(dir)) return null;
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory()) {
                            if (file === 'node_modules' || file === '.git') continue;
                            const found = findFile(fullPath, filename);
                            if (found) return found;
                        } else if (file === filename) {
                            return fullPath;
                        }
                    } catch (e) {}
                }
                return null;
            }

            const foundPath = findFile(__dirname, 'curatedTracks.json');
            if (foundPath) {
                allTracks = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
            }
        } catch (err) {}

        const targetGenre = roundConfig.genre;
        const requestedCount = parseInt(roundConfig.questionCount || roundConfig.count || 10);
        
        let genreFilteredTracks = allTracks.filter(t => t.genre === targetGenre);
        let trackPool = genreFilteredTracks.length >= requestedCount ? genreFilteredTracks : allTracks;
        
        const selectedTracks = [...trackPool].sort(() => 0.5 - Math.random()).slice(0, requestedCount);
        const allArtists = allTracks.map(t => t.artist);

        const questions = selectedTracks.map((t) => {
            const wrongArtists = allArtists.filter(a => a !== t.artist).sort(() => 0.5 - Math.random()).slice(0, 3);
            while (wrongArtists.length < 3) {
                wrongArtists.push('Alternative Artist ' + (wrongArtists.length + 1));
            }
            const options = [t.artist, ...wrongArtists].sort(() => 0.5 - Math.random());

            return {
                question: '🎧 Listen to the snippet: Which artist or band performed "' + t.title + '"?',
                options: options,
                answer: t.artist,
                fastestPlayerId: null,
                audioPreviewUrl: t.previewUrl || null,
                spotifyUrl: t.spotifyUrl || null
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
                question: '🔤 LINGO: Guess the 5-letter word! Hint: ' + (item.hint || 'Mystery word'),
                answer: (item.word || 'SHARK').toUpperCase(),
                options: [],
                fastestPlayerId: null
            }));
        } else if (config.type === 'scramble') {
            questions = rawItems.map(item => {
                const ans = (item.word || 'BEATLES').toUpperCase();
                const scrambled = item.scrambled || ans.split('').join(' ');
                const wrongOpts = [ans, 'MUSIC', 'BAND', 'STAGE'].filter(w => w !== ans).slice(0, 3);
                const options = [ans, ...wrongOpts].sort(() => 0.5 - Math.random());
                return {
                    gameType: 'scramble',
                    question: '🔀 WORD SCRAMBLE: Unscramble letters: [ ' + scrambled + ' ]',
                    answer: ans,
                    options: options,
                    fastestPlayerId: null
                };
            });
        } else if (config.type === 'higher-lower') {
            questions = rawItems.map(item => ({
                gameType: 'higher-lower',
                question: '⬆️ HIGHER OR LOWER: ' + (item.fact || 'Statistic prediction'),
                answer: item.answer || 'Higher',
                options: ['Higher', 'Lower'],
                fastestPlayerId: null
            }));
        } else if (config.type === 'tenable') {
            questions = rawItems.map(item => {
                const ans = item.answer || 'Top Choice';
                const options = [ans, 'Alternative A', 'Alternative B', 'Alternative C'].sort(() => 0.5 - Math.random());
                return {
                    gameType: 'tenable',
                    question: '🔟 TENABLE: ' + (item.category || 'Name an entry in this top list'),
                    answer: ans,
                    options: options,
                    fastestPlayerId: null
                };
            });
        } else if (config.type === 'one-percent') {
            questions = rawItems.map(item => {
                const ans = item.answer || 'Solution';
                const opts = item.options ? [...item.options] : [ans, 'Wrong 1', 'Wrong 2', 'Wrong 3'];
                if (!opts.includes(ans)) opts[0] = ans;
                return {
                    gameType: 'one-percent',
                    question: '🧠 THE 1% CLUB: ' + (item.q || 'Brainteaser puzzle'),
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
        if (newSettings.countdownSound !== undefined) gameState.settings.countdownSound = newSettings.countdownSound;
        io.emit('state-update', gameState);
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
        gameState.customEmojis = emojisArray;
        io.emit('state-update', gameState);
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
        const playerName = player ? player.name : 'Anonymous';

        const chatObj = { name: playerName, text: cleanMsg };
        gameState.chatHistory.push(chatObj);
        if (gameState.chatHistory.length > 30) gameState.chatHistory.shift();

        io.emit('chat-message', chatObj);
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
            p.score = 0;
            p.streak = 0;
            p.hasAnsweredCurrent = false;
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
        gameState.chatHistory = [];
        io.emit('stop-audio');
        io.emit('state-update', gameState);
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

    socket.on('disconnect', () => {
        delete gameState.scores[socket.id];
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
                triggerLeaderboardAndAutoAdvance();
            }
        }
    }, 1000);
}

function triggerLeaderboardAndAutoAdvance() {
    const round = gameState.playlist[gameState.currentRoundIndex];
    if (!round) return;

    gameState.status = 'LEADERBOARD';
    io.emit('stop-audio');
    io.emit('state-update', gameState);
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
