const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let gameState = {
  status: 'waiting',
  currentRound: null,
  timerSeconds: 10,
  betweenDelay: 5,
  eventTitle: 'TriviaMania Live Event',
  welcomeMessage: 'Welcome to the ultimate pub quiz experience!',
  bannerText: 'TriviaMania Live Pub Quiz Night',
  advertImage: null,
  advertTitle: 'Featured Sponsor & Event Advert',
  showAdvertQR: false,
  projectorAdvertActive: false,
  mobileAdvertActive: false,
  tipJarActive: false,
  tipJarUrl: '',
  speedBonusEnabled: false,
  players: {},
  answersSubmitted: {}
};

let questionStartTime = 0;
let questionInterval = null;

function clearQuizTimer() {
  if (questionInterval) {
    clearInterval(questionInterval);
    questionInterval = null;
  }
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  socket.emit('syncState', gameState);

  socket.on('playerJoin', (data) => {
    gameState.players[socket.id] = {
      id: socket.id,
      name: data.name || `Team ${Object.keys(gameState.players).length + 1}`,
      score: 0,
      avatar: ['🍻', '🎯', '🚀', '🔥', '⚡', '🏆', '🍕', '🎸'][Math.floor(Math.random() * 8)]
    };
    io.emit('updatePlayers', gameState.players);
    io.emit('syncState', gameState);
  });

  socket.on('hostAction', (actionData) => {
    const { action, payload } = actionData;
    clearQuizTimer();
    
    if (action === 'loadRound' && payload) {
      gameState.currentRound = {
        name: payload.name,
        questions: payload.questions,
        currentIndex: 0,
        timer: payload.timer || 10,
        betweenDelay: payload.betweenDelay || 5,
        speedBonus: payload.speedBonus || false
      };
      gameState.speedBonusEnabled = payload.speedBonus || false;
      gameState.status = 'paused';
    } else if (action === 'updateSettings' && payload) {
      if (payload.eventTitle !== undefined) gameState.eventTitle = payload.eventTitle;
      if (payload.welcomeMessage !== undefined) gameState.welcomeMessage = payload.welcomeMessage;
      if (payload.bannerText !== undefined) gameState.bannerText = payload.bannerText;
      if (payload.tipJarUrl !== undefined) gameState.tipJarUrl = payload.tipJarUrl;
    } else if (action === 'toggleTipJar') {
      gameState.tipJarActive = !gameState.tipJarActive;
    } else if (action === 'pushAdvert' && payload) {
      gameState.advertImage = payload.image;
      if (payload.advertTitle !== undefined) gameState.advertTitle = payload.advertTitle;
      if (payload.showAdvertQR !== undefined) gameState.showAdvertQR = payload.showAdvertQR;

      if (payload.target === 'projector') {
        gameState.projectorAdvertActive = true;
      } else if (payload.target === 'mobile') {
        gameState.mobileAdvertActive = true;
      } else {
        gameState.projectorAdvertActive = true;
        gameState.mobileAdvertActive = true;
      }
    } else if (action === 'hideAdvert' && payload) {
      if (payload.target === 'projector') {
        gameState.projectorAdvertActive = false;
      } else if (payload.target === 'mobile') {
        gameState.mobileAdvertActive = false;
      } else {
        gameState.projectorAdvertActive = false;
        gameState.mobileAdvertActive = false;
      }
    } else if (action === 'resume') {
      if (gameState.currentRound) {
        gameState.status = 'active';
        gameState.answersSubmitted = {};
        questionStartTime = Date.now();
        startQuestionTimer();
      }
    } else if (action === 'pause') {
      gameState.status = 'paused';
    } else if (action === 'restart') {
      if (gameState.currentRound) {
        gameState.currentRound.currentIndex = 0;
        gameState.status = 'active';
        gameState.answersSubmitted = {};
        questionStartTime = Date.now();
        startQuestionTimer();
      }
    } else if (action === 'reveal') {
      processRoundScores();
      gameState.status = 'revealed';
    }
    
    io.emit('syncState', gameState);
    io.emit('updatePlayers', gameState.players);
  });

  socket.on('submitAnswer', (data) => {
    if (gameState.status !== 'active') return;
    if (!gameState.answersSubmitted[socket.id]) {
      const submitTime = Date.now();
      const timeTaken = (submitTime - questionStartTime) / 1000; // seconds taken
      gameState.answersSubmitted[socket.id] = { answer: data.answer, timeTaken };
      io.emit('answerUpdate', { count: Object.keys(gameState.answersSubmitted).length });
    }
  });

  socket.on('disconnect', () => {
    delete gameState.players[socket.id];
    io.emit('updatePlayers', gameState.players);
    io.emit('syncState', gameState);
  });
});

function processRoundScores() {
  if (!gameState.currentRound) return;
  const currentQ = gameState.currentRound.questions[gameState.currentRound.currentIndex];
  const correctAnswer = currentQ.a.trim().toLowerCase();
  const maxTimer = gameState.currentRound.timer || 10;

  for (const socketId in gameState.answersSubmitted) {
    const sub = gameState.answersSubmitted[socketId];
    const playerAnswer = sub.answer.trim().toLowerCase();
    
    if (playerAnswer === correctAnswer) {
      if (gameState.players[socketId]) {
        let points = 10;
        // Calculate speed bonus if enabled (up to 5 extra points for fast responses)
        if (gameState.currentRound.speedBonus) {
          const timeRatio = Math.max(0, (maxTimer - sub.timeTaken) / maxTimer);
          const bonus = Math.round(timeRatio * 5);
          points += bonus;
        }
        gameState.players[socketId].score += points;
      }
    }
  }
}

function startQuestionTimer() {
  clearQuizTimer();
  let timeLeft = gameState.currentRound.timer || 10;
  
  io.emit('timerTick', timeLeft);

  questionInterval = setInterval(() => {
    timeLeft--;
    io.emit('timerTick', timeLeft);

    if (timeLeft <= 0) {
      clearQuizTimer();
      processRoundScores();
      gameState.status = 'revealed';
      io.emit('syncState', gameState);
      io.emit('updatePlayers', gameState.players);

      const delay = (gameState.currentRound.betweenDelay || 5) * 1000;
      setTimeout(() => {
        if (gameState.status === 'revealed' && gameState.currentRound) {
          if (gameState.currentRound.currentIndex < gameState.currentRound.questions.length - 1) {
            gameState.currentRound.currentIndex++;
            gameState.status = 'active';
            gameState.answersSubmitted = {};
            questionStartTime = Date.now();
            io.emit('syncState', gameState);
            startQuestionTimer();
          } else {
            gameState.status = 'podium';
            io.emit('syncState', gameState);
          }
        }
      }, delay);
    }
  }, 1000);
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`TriviaMania Server running on port ${PORT}`);
});
