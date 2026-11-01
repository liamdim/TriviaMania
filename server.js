// Launch Next Question
    socket.on('next-question', () => {
        const round = gameState.playlist[gameState.currentRoundIndex];
        if (!round) return;

        Object.values(gameState.scores).forEach(p => p.hasAnsweredCurrent = false);

        // If this isn't the very first time starting the round, move to the next question index
        if (gameState.status === 'QUESTION' || gameState.status === 'LEADERBOARD') {
            gameState.currentQuestionIndex++;
        }

        // Check if we've finished all questions in the current round
        if (gameState.currentQuestionIndex >= round.questions.length) {
            // Check if there is another round in the playlist queue
            if (gameState.currentRoundIndex + 1 < gameState.playlist.length) {
                gameState.currentRoundIndex++;
                gameState.currentQuestionIndex = 0;
            } else {
                gameState.status = 'LEADERBOARD';
                io.emit('state-update', gameState);
                return;
            }
        }

        gameState.status = 'QUESTION';
        gameState.timerMax = gameState.settings.questionTime || 15;
        gameState.timer = gameState.timerMax;
        
        io.emit('state-update', gameState);
        startQuestionTimer();
    });
