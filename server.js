const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let gameState = {
  status: 'waiting', // waiting, active, paused, revealed
  currentRound: null,
  timerSeconds: 10,
  betweenDelay: 5,
  players: {},
  answersSubmitted: {}
};

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
      avatar: '🍻'
    };
    io.emit('updatePlayers', gameState.players);
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
        betweenDelay: payload.betweenDelay || 5
      };
      gameState.status = 'paused'; // Loaded, waiting for host to hit Play
    } else if (action === 'resume') {
      if (gameState.currentRound) {
        gameState.status = 'active';
        startQuestionTimer();
      }
    } else if (action === 'pause') {
      gameState.status = 'paused';
    } else if (action === 'restart') {
      if (gameState.currentRound) {
        gameState.currentRound.currentIndex = 0;
        gameState.status = 'active';
        startQuestionTimer();
      }
    } else if (action === 'reveal') {
      gameState.status = 'revealed';
    }
    io.emit('syncState', gameState);
  });

  socket.on('submitAnswer', (data) => {
    if (gameState.status !== 'active') return;
    if (!gameState.answersSubmitted[socket.id]) {
      gameState.answersSubmitted[socket.id] = data.answer;
      io.emit('answerUpdate', { count: Object.keys(gameState.answersSubmitted).length });
    }
  });

  socket.on('disconnect', () => {
    delete gameState.players[socket.id];
    io.emit('updatePlayers', gameState.players);
  });
});

function startQuestionTimer() {
  clearQuizTimer();
  let timeLeft = gameState.currentRound.timer || 10;
  
  // Broadcast initial time
  io.emit('timerTick', timeLeft);

  questionInterval = setInterval(() => {
    timeLeft--;
    io.emit('timerTick', timeLeft);

    if (timeLeft <= 0) {
      clearQuizTimer();
      // Auto-reveal answer when timer hits 0
      gameState.status = 'revealed';
      io.emit('syncState', gameState);

      // Wait for host-defined delay before moving to next question
      const delay = (gameState.currentRound.betweenDelay || 5) * 1000;
      setTimeout(() => {
        if (gameState.status === 'revealed' && gameState.currentRound) {
          if (gameState.currentRound.currentIndex < gameState.currentRound.questions.length - 1) {
            gameState.currentRound.currentIndex++;
            gameState.status = 'active';
            gameState.answersSubmitted = {};
            io.emit('syncState', gameState);
            startQuestionTimer();
          } else {
            gameState.status = 'waiting';
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
