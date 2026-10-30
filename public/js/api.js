// TriviaMania Live API & Question Engine
async function fetchTriviaQuestions(amount = 10, category = '') {
    try {
        let url = `https://opentdb.com/api.php?amount=${amount}&type=multiple`;
        if (category) {
            url += `&category=${category}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return data.results.map(item => {
                const options = [...item.incorrect_answers, item.correct_answer].sort(() => 0.5 - Math.random());
                return {
                    q: decodeHTML(item.question),
                    a: decodeHTML(item.correct_answer),
                    options: options.map(decodeHTML),
                    type: 'trivia'
                };
            });
        }
    } catch (e) {
        console.error("API Fetch failed, using fallback:", e);
    }
    return getFallbackTrivia();
}

async function fetchMusicPreviewRound(amount = 10, searchTerm = 'classic+rock+hits') {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=${Math.max(amount, 5)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            // Filter only results that have a valid preview URL
            const validSongs = data.results.filter(song => song.previewUrl);
            
            return validSongs.slice(0, amount).map(song => {
                const wrongArtists = ["The Beatles", "Queen", "Led Zeppelin", "The Rolling Stones", "Fleetwood Mac", "Elton John", "Madonna", "Michael Jackson", "Prince", "David Bowie", "ABBA", "Ed Sheeran", "Taylor Swift"].filter(a => a !== song.artistName);
                const shuffledWrong = wrongArtists.sort(() => 0.5 - Math.random()).slice(0, 3);
                const options = [...shuffledWrong, song.artistName].sort(() => 0.5 - Math.random());
                
                return {
                    q: `Name the artist performing this track! 🎵`,
                    a: song.artistName,
                    options: options,
                    audioUrl: song.previewUrl,
                    type: 'music'
                };
            });
        }
    } catch (e) {
        console.error("Music API failed:", e);
    }
    return getFallbackTrivia();
}

function decodeHTML(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

function getFallbackTrivia() {
    return [
        { q: "What is the capital of France?", a: "Paris", options: ["London", "Berlin", "Paris", "Madrid"], type: "trivia" },
        { q: "Which element has the chemical symbol 'O'?", a: "Oxygen", options: ["Gold", "Oxygen", "Silver", "Iron"], type: "trivia" }
    ];
}
