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
                const correct = decodeHTML(item.correct_answer);
                const incorrects = item.incorrect_answers.map(decodeHTML);
                
                // Combine correct and incorrect answers cleanly, then shuffle
                const options = [...incorrects, correct].sort(() => 0.5 - Math.random());
                
                return {
                    q: decodeHTML(item.question),
                    a: correct,
                    options: options,
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
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=${Math.max(amount, 10)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const validSongs = data.results.filter(song => song.previewUrl && song.artistName);
            
            return validSongs.slice(0, amount).map(song => {
                const correctArtist = song.artistName;
                const poolWrongArtists = ["The Beatles", "Queen", "Led Zeppelin", "The Rolling Stones", "Fleetwood Mac", "Elton John", "Madonna", "Michael Jackson", "Prince", "David Bowie", "ABBA", "Ed Sheeran", "Taylor Swift", "U2", "Coldplay", "Adele"];
                
                // Filter out the correct artist so they don't appear in wrong options, then pick 3
                const wrongOptions = poolWrongArtists.filter(a => a.toLowerCase() !== correctArtist.toLowerCase()).sort(() => 0.5 - Math.random()).slice(0, 3);
                
                // Combine and shuffle properly
                const options = [...wrongOptions, correctArtist].sort(() => 0.5 - Math.random());
                
                return {
                    q: `Name the artist performing this track! 🎵`,
                    a: correctArtist,
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
