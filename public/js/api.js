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

                // Curated dictionary mapping popular track keywords to their correct movie answers
                const movieMapping = {
                    "lion": "The Lion King", "frozen": "Frozen", "moana": "Moana", "toy": "Toy Story",
                    "aladdin": "Aladdin", "tangled": "Tangled", "shrek": "Shrek", "cars": "Cars",
                    "nemo": "Finding Nemo", "beauty": "Beauty and the Beast", "cinderella": "Cinderella",
                    "mermaid": "The Little Mermaid", "up": "Up", "encanto": "Encanto", "potter": "Harry Potter",
                    "star wars": "Star Wars", "jurassic": "Jurassic Park", "batman": "Batman", "spider": "Spider-Man",
                    "incredibles": "The Incredibles", "monsters": "Monsters, Inc.", "mulan": "Mulan", "hercules": "Hercules",
                    "tarzan": "Tarzan", "coco": "Coco", "aladdin": "Aladdin", "hercules": "Hercules"
                };

                return validSongs.slice(0, amount).map(song => {
                    const songTitle = song.trackName.replace(/\(.*?\)/g, '').trim();
                    
                    // Try to deduce the movie from the song name or collection name, otherwise pick a clean default match from our list
                    let correctMovie = "The Lion King";
                    const combinedText = (song.trackName + " " + (song.collectionName || "")).toLowerCase();
                    
                    for (const [keyword, movieName] of Object.entries(movieMapping)) {
                        if (combinedText.includes(keyword)) {
                            correctMovie = movieName;
                            break;
                        }
                    }

                    // Pick 3 wrong movie decoys
                    const wrongOptions = movieDecoys.filter(m => m.toLowerCase() !== correctMovie.toLowerCase()).sort(() => Math.random() - 0.5).slice(0, 3);
                    
                    // Combine correct movie with decoys and truly randomize position
                    const options = [...wrongOptions, correctMovie].sort(() => Math.random() - 0.5);

                    return {
                        q: `What movie features the song "${songTitle}"? 🎵`,
                        a: correctMovie,
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
