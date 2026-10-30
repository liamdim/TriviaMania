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
  timerSeconds: 30,
  players: {},
  answersSubmitted: {}
};

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
    
    if (action === 'loadRound' && payload) {
      gameState.currentRound = payload;
      gameState.status = 'active';
      gameState.answersSubmitted = {};
    } else if (action === 'reveal') {
      gameState.status = 'revealed';
    } else if (action === 'pause') {
      gameState.status = 'paused';
    } else if (action === 'resume') {
      gameState.status = 'active';
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

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`TriviaMania Server running on port ${PORT}`);
});
