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
                const options = [...incorrects, correct].sort(() => Math.random() - 0.5);
                
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

async function fetchMusicPreviewRound(amount = 10, searchTerm = '1980s pop rock', isKidsOrTv = false) {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=30`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const validSongs = data.results.filter(song => song.previewUrl && song.trackName);
            
            if (isKidsOrTv || searchTerm.includes('disney') || searchTerm.includes('cartoon') || searchTerm.includes('tv theme') || searchTerm.includes('soundtrack')) {
                const movieDecoys = ["The Lion King", "Frozen", "Moana", "Toy Story", "Aladdin", "Tangled", "Shrek", "Cars", "Finding Nemo", "Beauty and the Beast", "Cinderella", "The Little Mermaid", "Up", "Encanto", "Harry Potter", "Star Wars", "Jurassic Park", "Batman", "Spider-Man", "Doctor Who", "The Incredibles", "Monsters, Inc.", "Mulan", "Hercules"];

                return validSongs.slice(0, amount).map(song => {
                    // Clean up song title to be the correct answer
                    let cleanSongTitle = song.trackName
                        .replace(/\(.*?\)/g, '')
                        .replace(/from.*$/i, '')
                        .replace(/theme.*$/i, '')
                        .trim();
                    
                    if (cleanSongTitle.length < 2) cleanSongTitle = "Classic Theme Song";

                    // Pick 3 wrong movie decoys
                    const wrongOptions = movieDecoys.filter(m => m.toLowerCase() !== cleanSongTitle.toLowerCase()).sort(() => Math.random() - 0.5).slice(0, 3);
                    
                    // Combine correct answer with decoys and truly randomize position
                    const options = [...wrongOptions, cleanSongTitle].sort(() => Math.random() - 0.5);

                    return {
                        q: `What Disney or family movie features this song? 🎵`,
                        a: cleanSongTitle,
                        options: options,
                        audioUrl: song.previewUrl,
                        type: 'music'
                    };
                });
            }

            // Standard Music Round (Asking for Artist Name)
            let decoyPool = ["Duran Duran", "Tears for Fears", "Spandau Ballet", "Culture Club", "Wham!", "Simple Minds", "Eurythmics", "Bryan Adams", "Bon Jovi", "Queen", "The Police"];
            
            const lowerSearch = searchTerm.toLowerCase();
            if (lowerSearch.includes('90s')) {
                decoyPool = ["Oasis", "Blur", "Pulp", "Radiohead", "Spice Girls", "Backstreet Boys", "Take That", "All Saints", "Suede", "The Verve", "The Cranberries"];
            } else if (lowerSearch.includes('rock') || lowerSearch.includes('metal')) {
                decoyPool = ["AC/DC", "Led Zeppelin", "Deep Purple", "Black Sabbath", "Guns N' Roses", "Aerosmith", "Metallica", "Iron Maiden", "Van Halen", "Def Leppard"];
            } else if (lowerSearch.includes('motown') || lowerSearch.includes('disco') || lowerSearch.includes('70s')) {
                decoyPool = ["Stevie Wonder", "Marvin Gaye", "The Supremes", "Jackson 5", "Earth, Wind & Fire", "Bee Gees", "ABBA", "Boney M.", "Chic", "Kool & The Gang"];
            } else if (lowerSearch.includes('country')) {
                decoyPool = ["Johnny Cash", "Willie Nelson", "Dolly Parton", "Kenny Rogers", "Garth Brooks", "Alan Jackson", "Shania Twain", "Tim McGraw"];
            }

            return validSongs.slice(0, amount).map(song => {
                const correctArtist = song.artistName;
                const wrongOptions = decoyPool.filter(a => a.toLowerCase() !== correctArtist.toLowerCase()).sort(() => Math.random() - 0.5).slice(0, 3);
                
                while (wrongOptions.length < 3) {
                    wrongOptions.push("Similar Artist " + Math.floor(Math.random() * 10));
                }

                const options = [...wrongOptions, correctArtist].sort(() => Math.random() - 0.5);
                
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
