// TriviaMania Verified Music & Trivia Engine
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

async function fetchMusicPreviewRound(amount = 10, searchTerm = '1980s pop rock') {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=25`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const validSongs = data.results.filter(song => song.previewUrl && song.artistName);
            
            // Define targeted decoy pools matching specific musical categories
            let decoyPool = ["Duran Duran", "Tears for Fears", "Spandau Ballet", "Culture Club", "Wham!", "Simple Minds", "Eurythmics", "Phil Collins"];
            
            const lowerSearch = searchTerm.toLowerCase();
            if (lowerSearch.includes('90s')) {
                decoyPool = ["Oasis", "Blur", "Pulp", "Radiohead", "Spice Girls", "Backstreet Boys", "Take That", "All Saints", "Suede", "The Verve"];
            } else if (lowerSearch.includes('rock') || lowerSearch.includes('metal')) {
                decoyPool = ["AC/DC", "Led Zeppelin", "Deep Purple", "Black Sabbath", "Guns N' Roses", "Aerosmith", "Metallica", "Iron Maiden", "Van Halen", "Def Leppard"];
            } else if (lowerSearch.includes('motown') || lowerSearch.includes('disco') || lowerSearch.includes('70s')) {
                decoyPool = ["Stevie Wonder", "Marvin Gaye", "The Supremes", "Jackson 5", "Earth, Wind & Fire", "Bee Gees", "ABBA", "Boney M.", "Chic", "Kool & The Gang"];
            } else if (lowerSearch.includes('country')) {
                decoyPool = ["Johnny Cash", "Willie Nelson", "Dolly Parton", "Kenny Rogers", "Garth Brooks", "Alan Jackson", "Shania Twain", "Tim McGraw"];
            } else if (lowerSearch.includes('disney') || lowerSearch.includes('cartoon') || lowerSearch.includes('kids') || lowerSearch.includes('nursery')) {
                decoyPool = ["Idina Menzel", "Phil Collins", "Elton John", "Kristen Bell", "Alan Menken", "Randy Newman", "Lin-Manuel Miranda", "Josh Gad", "Julie Andrews", "Sarah McLachlan"];
            }

            return validSongs.slice(0, amount).map(song => {
                const correctArtist = song.artistName;
                
                // Ensure correct artist is not in decoys, then pick 3 unique decoys
                const wrongOptions = decoyPool.filter(a => a.toLowerCase() !== correctArtist.toLowerCase()).sort(() => 0.5 - Math.random()).slice(0, 3);
                
                while (wrongOptions.length < 3) {
                    wrongOptions.push("Similar Artist " + Math.floor(Math.random() * 10));
                }

                const options = [...wrongOptions, correctArtist].sort(() => 0.5 - Math.random());
                
                return {
                    q: `Name the artist performing this track! 🎵 (${song.trackName})`,
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
