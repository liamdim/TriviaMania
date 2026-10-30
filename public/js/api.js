async function fetchTriviaQuestions(amount = 10, category = '') {
    let url = `https://opentdb.com/api.php?amount=${amount}&type=multiple`;
    if (category) url += `&category=${category}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            return data.results.map(item => {
                const incorrect = item.incorrect_answers.map(ans => decodeHtml(ans));
                const correct = decodeHtml(item.correct_answer);
                const options = [...incorrect, correct].sort(() => Math.random() - 0.5);
                return {
                    q: decodeHtml(item.question),
                    a: correct,
                    options: options,
                    type: 'trivia'
                };
            });
        }
    } catch (e) {
        console.error("Error fetching trivia:", e);
    }
    return [
        { q: "What is the capital of France?", a: "Paris", options: ["London", "Paris", "Berlin", "Madrid"], type: 'trivia' }
    ];
}

async function fetchMusicPreviewRound(amount = 10, searchTerm = 'pop hits') {
    try {
        // If searching for female artists, let's target prominent female pop/rock icons specifically
        let queryTerm = searchTerm;
        const isFemaleRound = searchTerm.toLowerCase().includes('female');
        if (isFemaleRound) {
            const femaleIcons = ['Taylor Swift', 'Beyonce', 'Rihanna', 'Dua Lipa', 'Adele', 'Ariana Grande', 'Billie Eilish', 'Lady Gaga', 'Katy Perry', 'Miley Cyrus', 'Olivia Rodrigo', 'Britney Spears', 'Madonna', 'Whitney Houston', 'Alicia Keys', 'Pink', 'Shakira', 'Celine Dion', 'Amy Winehouse', 'Sia'];
            queryTerm = femaleIcons[Math.floor(Math.random() * femaleIcons.length)];
        }

        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryTerm)}&entity=song&limit=40`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            const validSongs = data.results.filter(song => song.previewUrl && song.artistName && song.trackName);
            validSongs.sort(() => Math.random() - 0.5);

            const questions = [];
            const usedArtists = new Set();

            for (const song of validSongs) {
                if (questions.length >= amount) break;
                if (!usedArtists.has(song.artistName)) {
                    usedArtists.add(song.artistName);
                    
                    const distractors = validSongs
                        .filter(s => s.artistName !== song.artistName)
                        .map(s => s.artistName)
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 3);

                    const options = [...distractors, song.artistName].sort(() => Math.random() - 0.5);

                    questions.push({
                        q: `Name the artist / band performing this track: "${song.trackName}"`,
                        a: song.artistName,
                        options: options,
                        audioUrl: song.previewUrl,
                        type: 'music'
                    });
                }
            }
            if (questions.length > 0) return questions;
        }
    } catch(e) {
        console.error("Error fetching iTunes music round:", e);
    }

    return [
        { q: "Name the artist for this track", a: "Adele", options: ["Taylor Swift", "Adele", "Rihanna", "Dua Lipa"], audioUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/c6/8e/3c/c68e3c6a-4d2c-8824-3458-1f6b814674d8/mza_11674482098716327668.m43.aac", type: 'music' }
    ];
}

function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}
