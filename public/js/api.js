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
            
            // Choose appropriate decoy artists based on the genre searched
            let decoyPool = ["The Beatles", "Queen", "Led Zeppelin", "The Rolling Stones", "Fleetwood Mac", "Elton John", "David Bowie", "U2", "Coldplay", "AC/DC", "Pink Floyd", "Aerosmith"];
            
            const lowerSearch = searchTerm.toLowerCase();
            if (lowerSearch.includes('disney') || lowerSearch.includes('kids') || lowerSearch.includes('cartoon') || lowerSearch.includes('nursery')) {
                decoyPool = ["Phil Collins", "Elton John", "Idina Menzel", "Kristen Bell", "Alan Menken", "Randy Newman", "Lin-Manuel Miranda", "Beyoncé", "Justin Timberlake", "Bruno Mars", "Josh Gad", "Sarah McLachlan"];
            } else if (lowerSearch.includes('pop') || lowerSearch.includes('dance') || lowerSearch.includes('90s dance')) {
                decoyPool = ["Madonna", "Britney Spears", "Backstreet Boys", "Spice Girls", "Michael Jackson", "Katy Perry", "Lady Gaga", "Rihanna", "Justin Bieber", "Dua Lipa", "Ariana Grande", "Ed Sheeran"];
            } else if (lowerSearch.includes('hip hop') || lowerSearch.includes('r&b')) {
                decoyPool = ["Eminem", "Tupac Shakur", "The Notorious B.I.G.", "Jay-Z", "Snoop Dogg", "Drake", "Kanye West", "Beyoncé", "Usher", "Alicia Keys", "Dr. Dre", "Outkast"];
            }

            return validSongs.slice(0, amount).map(song => {
                const correctArtist = song.artistName;
                
                // Filter out the correct artist from decoys, then pick 3
                const wrongOptions = decoyPool.filter(a => a.toLowerCase() !== correctArtist.toLowerCase()).sort(() => 0.5 - Math.random()).slice(0, 3);
                
                // If we don't have enough decoys, pad with fallback names
                while (wrongOptions.length < 3) {
                    wrongOptions.push("Band " + Math.floor(Math.random() * 100));
                }

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
