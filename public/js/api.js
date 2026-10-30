// TriviaMania Advanced API & Question Engine
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

async function fetchKidsTriviaQuestions(amount = 10, subGenre = 'disney') {
    // Uses Open Trivia DB mixed with general family-friendly query parameters
    let categoryId = "9"; // General knowledge fallback
    if (subGenre === 'animals') categoryId = "27";
    if (subGenre === 'science') categoryId = "17";
    if (subGenre === 'geography') categoryId = "22";

    const questions = await fetchTriviaQuestions(amount, categoryId);
    
    // Customize phrasing to make it super fun for kids rounds
    return questions.map((q, idx) => ({
        ...q,
        q: `[Kids Quiz #${idx + 1}] ${q.q}`
    }));
}

async function fetchMusicPreviewRound(amount = 10, searchTerm = '1980s pop rock', isKidsOrMovie = false) {
    try {
        // Fetch a larger pool to ensure plenty of valid preview streams
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=40`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const validSongs = data.results.filter(song => song.previewUrl && song.trackName);
            
            // Handle Movie / TV / Kids Theme Rounds (Guessing the Show or Movie)
            if (isKidsOrMovie || searchTerm.includes('disney') || searchTerm.includes('marvel') || searchTerm.includes('cbeebies') || searchTerm.includes('nickelodeon') || searchTerm.includes('cartoon network') || searchTerm.includes('theme')) {
                let showDecoys = ["The Lion King", "Frozen", "Moana", "Toy Story", "Aladdin", "Mickey Mouse Clubhouse", "Peppa Pig", "Paw Patrol", "Bluey", "Spider-Man", "Avengers", "SpongeBob SquarePants", "Ben 10", "Teletubbies", "Postman Pat", "Danger Mouse", "The Incredibles", "Shrek", "Harry Potter", "Doctor Who"];

                if (searchTerm.includes('marvel')) {
                    showDecoys = ["Avengers: Endgame", "Iron Man", "Spider-Man", "Thor", "Black Panther", "Guardians of the Galaxy", "Captain America", "Doctor Strange", "X-Men", "Deadpool"];
                } else if (searchTerm.includes('cbeebies')) {
                    showDecoys = ["Peppa Pig", "Paw Patrol", "Bluey", "Postman Pat", "Teletubbies", "Hey Duggee", "In the Night Garden", "Octonauts", "Gruffalo", "Fireman Sam"];
                } else if (searchTerm.includes('nickelodeon')) {
                    showDecoys = ["SpongeBob SquarePants", "PAW Patrol", "The Fairly OddParents", "Dora the Explorer", "Avatar: The Last Airbender", "iCarly", "Teenage Mutant Ninja Turtles", "Rugrats"];
                } else if (searchTerm.includes('cartoon network')) {
                    showDecoys = ["Ben 10", "Adventure Time", "The Powerpuff Girls", "Scooby-Doo", "Tom and Jerry", "Teen Titans Go!", "Courage the Cowardly Dog", "Regular Show"];
                }

                return validSongs.slice(0, amount).map(song => {
                    let correctShow = song.collectionName || song.artistName || "Family Classic";
                    if (correctShow.length > 30) correctShow = "Animated Masterpiece";

                    const wrongOptions = showDecoys.filter(s => s.toLowerCase() !== correctShow.toLowerCase()).sort(() => Math.random() - 0.5).slice(0, 3);
                    const options = [...wrongOptions, correctShow].sort(() => Math.random() - 0.5);

                    return {
                        q: `What show, movie, or franchise is this theme song from? 🎵`,
                        a: correctShow,
                        options: options,
                        audioUrl: song.previewUrl,
                        type: 'music'
                    };
                });
            }

            // Standard Music / Decades Round (Asking for Artist Name)
            let decoyPool = ["Duran Duran", "Tears for Fears", "Spandau Ballet", "Culture Club", "Wham!", "Simple Minds", "Eurythmics", "Bryan Adams", "Bon Jovi", "Queen", "The Police"];
            
            const lowerSearch = searchTerm.toLowerCase();
            if (lowerSearch.includes('90s')) {
                decoyPool = ["Oasis", "Blur", "Pulp", "Radiohead", "Spice Girls", "Backstreet Boys", "Take That", "All Saints", "Suede", "The Verve", "The Cranberries"];
            } else if (lowerSearch.includes('2000')) {
                decoyPool = ["Coldplay", "Green Day", "Eminem", "Outkast", "The Killers", "Britney Spears", "Justin Timberlake", "Linkin Park", "Beyoncé", "Rihanna"];
            } else if (lowerSearch.includes('2010')) {
                decoyPool = ["Adele", "Taylor Swift", "Ed Sheeran", "Bruno Mars", "Drake", "Katy Perry", "Lady Gaga", "Imagine Dragons", "Maroon 5", "Shawn Mendes"];
            } else if (lowerSearch.includes('2020')) {
                decoyPool = ["Dua Lipa", "Harry Styles", "Olivia Rodrigo", "Billie Eilish", "The Weeknd", "Bad Bunny", "Justin Bieber", "Post Malone", "Miley Cyrus"];
            } else if (lowerSearch.includes('dance')) {
                decoyPool = ["Calvin Harris", "David Guetta", "Avicii", "Daft Punk", "Tiësto", "Swedish House Mafia", "Disclosure", "Marshmello", "Martin Garrix"];
            } else if (lowerSearch.includes('rock') || lowerSearch.includes('metal')) {
                decoyPool = ["AC/DC", "Led Zeppelin", "Deep Purple", "Black Sabbath", "Guns N' Roses", "Aerosmith", "Metallica", "Iron Maiden", "Van Halen", "Def Leppard"];
            } else if (lowerSearch.includes('motown') || lowerSearch.includes('soul') || lowerSearch.includes('disco')) {
                decoyPool = ["Stevie Wonder", "Marvin Gaye", "The Supremes", "Jackson 5", "Earth, Wind & Fire", "Bee Gees", "ABBA", "Boney M.", "Chic", "Aretha Franklin"];
            } else if (lowerSearch.includes('hip hop') || lowerSearch.includes('rap') || lowerSearch.includes('rnb')) {
                decoyPool = ["Eminem", "Tupac Shakur", "Jay-Z", "Snoop Dogg", "Drake", "Kanye West", "Usher", "Alicia Keys", "Dr. Dre", "Kendrick Lamar"];
            } else if (lowerSearch.includes('garage')) {
                decoyPool = ["Artful Dodger", "Craig David", "DJ Pied Piper", "So Solid Crew", "Sweet Female Attitude", "The Streets", "MJ Cole"];
            } else if (lowerSearch.includes('jazz')) {
                decoyPool = ["Miles Davis", "John Coltrane", "Louis Armstrong", "Ella Fitzgerald", "Frank Sinatra", "Nina Simone", "Dave Brubeck", "Billie Holiday"];
            } else if (lowerSearch.includes('country')) {
                decoyPool = ["Johnny Cash", "Willie Nelson", "Dolly Parton", "Kenny Rogers", "Garth Brooks", "Alan Jackson", "Shania Twain", "Chris Stapleton"];
            } else if (lowerSearch.includes('boy band') || lowerSearch.includes('girl band')) {
                decoyPool = ["Backstreet Boys", "NSYNC", "Boyz II Men", "Westlife", "Take That", "Spice Girls", "Destiny's Child", "Little Mix", "Girls Aloud", "Pussycat Dolls"];
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
