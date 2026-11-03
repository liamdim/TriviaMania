<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="data:,">
    <title>TriviaMania - Mini-Games Studio</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        :root {
            --bg-color: #05050a;
            --panel-bg: rgba(15, 23, 42, 0.85);
            --neon-blue: #00f3ff;
            --neon-green: #00ff66;
            --neon-yellow: #ffee00;
            --text: #ffffff;
            --text-muted: #8b9bb4;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background-color: var(--bg-color); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; background-image: radial-gradient(circle at 50% 0%, #1a103c 0%, #05050a 70%); }
        header { background: rgba(10, 15, 30, 0.9); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 243, 255, 0.3); }
        header h1 { font-size: 1.5rem; color: var(--neon-blue); }
        .nav-links { display: flex; gap: 0.75rem; }
        .nav-links.nav-links a { color: var(--neon-blue); text-decoration: none; padding: 0.5rem 1rem; background: rgba(0, 243, 255, 0.1); border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.3); font-size: 0.9rem; }
        .container { flex: 1; padding: 2rem; max-width: 900px; width: 100%; margin: 0 auto; }
        .card { background: var(--panel-bg); border-radius: 12px; padding: 2rem; border: 1px solid rgba(0, 243, 255, 0.3); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); margin-bottom: 1.5rem; }
        .card h3 { margin-bottom: 1.0rem; color: var(--neon-blue); font-weight: 600; }
        .form-group { margin-bottom: 1.2rem; text-align: left; }
        label { display: block; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.9rem; }
        select, input { width: 100%; padding: 0.75rem; background: rgba(5, 10, 20, 0.8); border: 1px solid rgba(0, 243, 255, 0.3); color: white; border-radius: 6px; font-size: 1rem; }
        button { background: linear-gradient(135deg, #0077ff, #00f3ff); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.3s; font-size: 1rem; width: 100%; }
        button:hover { filter: brightness(1.2); box-shadow: 0 0 15px rgba(0, 243, 255, 0.5); }
    </style>
</head>
<body>
    <header>
        <h1>🎮 Mini-Games Studio</h1>
        <div class="nav-links">
            <a href="/index.html">⚡ Live Controls</a>
        </div>
    </header>
    <div class="container">
        <div class="card">
            <h3>Generate AI Mini-Game Round</h3>
            <div class="form-group">
                <label>Select Mini-Game Type:</label>
                <select id="gameTypeSelect">
                    <option value="scramble">🔀 Word Scramble (Unscramble the famous word/band/movie)</option>
                    <option value="lingo">🔤 Lingo (5-letter word guessing with clues)</option>
                    <option value="higher-lower">⬆️ Higher or Lower (Statistic comparisons)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Custom Round Title:</label>
                <input type="text" id="roundNameInput" placeholder="e.g., Lightning Word Scramble">
            </div>
            <div class="form-group">
                <label>Number of Items/Questions:</label>
                <input type="number" id="itemCountInput" value="5" min="1" max="15">
            </div>
            <button onclick="generateMiniGame()" id="genBtn">🚀 Generate & Add to Playlist</button>
        </div>
    </div>

    <script>
        const socket = io({ transports: ['websocket', 'polling'] });

        function generateMiniGame() {
            const type = document.getElementById('gameTypeSelect').value;
            const name = document.getElementById('roundNameInput').value.trim();
            const count = document.getElementById('itemCountInput').value;
            const btn = document.getElementById('genBtn');

            btn.innerText = '⏳ Generating Mini-Game via AI...';
            btn.disabled = true;

            socket.emit('add-minigame-round', { type, name, count });
        }

        socket.on('minigame-added', (res) => {
            const btn = document.getElementById('genBtn');
            btn.disabled = false;
            btn.innerText = '🚀 Generate & Add to Playlist';
            if (res.success) {
                alert('Mini-game round successfully added to your playlist!');
                window.location.href = '/index.html';
            } else {
                alert('Generation failed: ' + (res.error || 'Please try again.'));
            }
        });
    </script>
</body>
</html>
