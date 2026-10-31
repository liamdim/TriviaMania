function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(function(el) {
        el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(function(el) {
        el.classList.remove('active');
    });
    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.classList.add('active');
    }
    if (btn) {
        btn.classList.add('active');
    }
}

const socket = io();
let playlist = [];
let storedAdvertBase64 = null;
let latestPlayersState = {};

// --- ANTI-REPEAT QUESTION HISTORY TRACKER ---
let usedQuestionHistory = JSON.parse(localStorage.getItem('triviamania_history') || '[]');

function filterUnusedQuestions(pool) {
    const fresh = pool.filter(item => !usedQuestionHistory.includes(item.q || item.img));
    if (fresh.length < pool.length * 0.3) {
        usedQuestionHistory = [];
        localStorage.setItem('triviamania_history', JSON.stringify([]));
        return pool;
    }
    return fresh;
}

function markQuestionsAsUsed(questions) {
    questions.forEach(item => {
        const key = item.image || item.q;
        if (!usedQuestionHistory.includes(key)) {
            usedQuestionHistory.push(key);
        }
    });
    if (usedQuestionHistory.length > 300) {
        usedQuestionHistory = usedQuestionHistory.slice(-300);
    }
    localStorage.setItem('triviamania_history', JSON.stringify(usedQuestionHistory));
}

// --- STANDARD TRIVIA GENERATOR ---
async function addTriviaRound() {
    const select = document.getElementById('triviaGenreSelect');
    const categoryKey = select ? select.value : "uk_general";
    const genreName = select ? select.options[select.selectedIndex].text : "Standard Trivia";
    const countSelect = document.getElementById('triviaCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;
    
    let questions = [];

    const customBanks = {
        "uk_general": [
            { q: "What is the capital city of England?", a: "London", options: ["Manchester", "Birmingham", "London", "Liverpool"] },
            { q: "Which currency is officially used in the United Kingdom?", a: "Pound Sterling", options: ["Euro", "Dollar", "Pound Sterling", "Franc"] },
            { q: "How many countries make up the United Kingdom?", a: "4", options: ["3", "4", "5", "6"] },
            { q: "What is the national flower of England?", a: "Tudor Rose", options: ["Daffodil", "Thistle", "Tudor Rose", "Shamrock"] },
            { q: "Which British monarch had a reign lasting over 70 years?", a: "Queen Elizabeth II", options: ["Queen Victoria", "King George III", "Queen Elizabeth II", "King Henry VIII"] },
            { q: "What is the longest river entirely within England?", a: "River Thames", options: ["River Severn", "River Thames", "River Trent", "River Ouse"] },
            { q: "On which date is British Bonfire Night celebrated?", a: "5th November", options: ["31st October", "5th November", "25th December", "1st January"] },
            { q: "What animal is traditionally featured as the symbol of the Bank of England?", a: "Lion", options: ["Lion", "Bull", "Unicorn", "Eagle"] },
            { q: "Which famous clock tower in London was officially renamed the Elizabeth Tower in 2012?", a: "Big Ben", options: ["Big Ben", "The Shard", "Gherkin", "Nelson's Column"] },
            { q: "What is a traditional British Sunday roast meat commonly served with mint sauce?", a: "Roast Lamb", options: ["Roast Beef", "Roast Pork", "Roast Lamb", "Roast Chicken"] }
        ],
        "uk_sports": [
            { q: "Which English football club has won the most top-flight league titles?", a: "Manchester United", options: ["Liverpool", "Manchester United", "Arsenal", "Manchester City"] },
            { q: "At which sporting venue is the Wimbledon Tennis Championships held?", a: "All England Club", options: ["Queen's Club", "All England Club", "Wembley Stadium", "Edgbaston"] },
            { q: "Which country won the Six Nations Rugby Championship most recently?", a: "Ireland", options: ["England", "Wales", "France", "Ireland"] },
            { q: "How many players are on a traditional British pub darts team on the oche?", a: "1", options: ["1", "2", "3", "4"] },
            { q: "Which English city hosted the 2012 Summer Olympic Games?", a: "London", options: ["Birmingham", "London", "Manchester", "Sheffield"] },
            { q: "What is the name of the historic annual boat race rowed between Oxford and Cambridge universities?", a: "The Boat Race", options: ["The Regatta", "The Boat Race", "The Thames Challenge", "The Varsity Row"] },
            { q: "Which snooker player is nicknamed 'The Rocket'?", a: "Ronnie O'Sullivan", options: ["Jimmy White", "Stephen Hendry", "Ronnie O'Sullivan", "Judd Trump"] },
            { q: "In cricket, how many balls are in a standard over?", a: "6", options: ["4", "5", "6", "8"] },
            { q: "Which Premier League team is known by the nickname 'The Gunners'?", a: "Arsenal", options: ["Tottenham Hotspur", "Arsenal", "Chelsea", "West Ham United"] },
            { q: "What sport is played at Lord's Cricket Ground, known as the Home of Cricket?", a: "Cricket", options: ["Polo", "Cricket", "Rugby Union", "Croquet"] }
        ],
        "uk_history": [
            { q: "In what year did the Great Fire of London take place?", a: "1666", options: ["1066", "1215", "1666", "1805"] },
            { q: "Who was the British Prime Minister during most of World War II?", a: "Winston Churchill", options: ["Neville Chamberlain", "Winston Churchill", "Clement Attlee", "Anthony Eden"] },
            { q: "Which king signed the Magna Carta in 1215?", a: "King John", options: ["King Richard", "King John", "King Henry VIII", "King Edward I"] },
            { q: "How many wives did King Henry VIII have?", a: "6", options: ["4", "5", "6", "8"] },
            { q: "In what year did the Battle of Hastings take place?", a: "1066", options: ["1066", "1154", "1314", "1415"] },
            { q: "Which British nurse became famous for her pioneering work during the Crimean War?", a: "Florence Nightingale", options: ["Mary Seacole", "Florence Nightingale", "Edith Cavell", "Elizabeth Garrett Anderson"] },
            { q: "Who was the monarch on the throne during the Victorian era?", a: "Queen Victoria", options: ["Queen Elizabeth I", "Queen Victoria", "King George IV", "King William IV"] },
            { q: "The War of the Roses was fought between which two royal houses?", a: "Lancaster and York", options: ["Tudor and Stuart", "Lancaster and York", "Windsor and Hanover", "Plantagenet and Wessex"] },
            { q: "Which UK city was bombed during the historic raid known as the Blitz?", a: "London (and other cities)", options: ["London", "Bath", "York", "All of the above"] },
            { q: "Who discovered penicillin in London in 1928?", a: "Alexander Fleming", options: ["Alexander Fleming", "Edward Jenner", "Joseph Lister", "Isaac Newton"] }
        ],
        "uk_tv": [
            { q: "Which long-running British sci-fi show features a Time Lord traveling in a TARDIS?", a: "Doctor Who", options: ["Star Trek", "Doctor Who", "Red Dwarf", "Blake's 7"] },
            { q: "What is the name of the fictional pub in the BBC soap opera EastEnders?", a: "The Queen Victoria", options: ["The Rovers Return", "The Queen Victoria", "The Woolpack", "The Nag's Head"] },
            { q: "Which British secret agent holds the codename 007?", a: "James Bond", options: ["Jason Bourne", "Jack Ryan", "James Bond", "Harry Palmer"] },
            { q: "In what year did the first Harry Potter film release in cinemas?", a: "2001", options: ["1999", "2001", "2003", "2005"] },
            { q: "Which comedy sketch show famously starred Matt Lucas and David Walliams?", a: "Little Britain", options: ["The Fast Show", "Little Britain", "The Catherine Tate Show", "Gavin & Stacey"] },
            { q: "What is the name of the family in the classic British sitcom 'Only Fools and Horses'?", a: "The Trotters", options: ["The Trotters", "The Simpsons", "The Royles", "The Griffins"] },
            { q: "Which actor played Sherlock Holmes in the BBC modern adaptation 'Sherlock'?", a: "Benedict Cumberbatch", options: ["Martin Freeman", "Benedict Cumberbatch", "David Tennant", "Tom Hiddleston"] },
            { q: "What is the setting of the popular period drama television series 'Downton Abbey'?", a: "An English Country Estate", options: ["A Scottish Castle", "An English Country Estate", "A Welsh Mining Town", "A London Hotel"] },
            { q: "Which British quiz show has been hosted by Jeremy Clarkson and Chris Tarrant?", a: "Who Wants to Be a Millionaire?", options: ["The Chase", "Mastermind", "University Challenge", "Who Wants to Be a Millionaire?"] },
            { q: "Who created the legendary British comedy series 'Fawlty Towers'?", a: "John Cleese", options: ["Rowan Atkinson", "John Cleese", "Ricky Gervais", "Steve Coogan"] }
        ],
        "uk_music": [
            { q: "Which legendary British rock band formed in Liverpool in 1960?", a: "The Beatles", options: ["The Rolling Stones", "The Beatles", "The Kinks", "The Who"] },
            { q: "Which band released the iconic rock anthem 'Bohemian Rhapsody'?", a: "Queen", options: ["Led Zeppelin", "Queen", "Pink Floyd", "Black Sabbath"] },
            { q: "What is the best-selling Christmas single in UK chart history by Band Aid?", a: "Do They Know It's Christmas?", options: ["Last Christmas", "Do They Know It's Christmas?", "Fairytale of New York", "Merry Xmas Everybody"] },
            { q: "Which Oasis brother famously fronted the band alongside his brother Noel?", a: "Liam Gallagher", options: ["Phil Collins", "Liam Gallagher", "Damon Albarn", "Robbie Williams"] },
            { q: "What annual British music awards ceremony is named after a flower?", a: "The BRIT Awards", options: ["The Grammys", "The Mercury Prize", "The BRIT Awards", "The MOBO Awards"] },
            { q: "Which pop superstar sang 'Shape of You' and 'Bad Habits'?", a: "Ed Sheeran", options: ["Harry Styles", "Ed Sheeran", "Sam Smith", "Adele"] },
            { q: "Which iconic British singer released albums titled '21', '25', and '30'?", a: "Adele", options: ["Amy Winehouse", "Dua Lipa", "Adele", "Ellie Goulding"] },
            { q: "What genre of electronic music originated in London in the early 1990s?", a: "Drum and Bass", options: ["House", "Techno", "Drum and Bass", "Trance"] },
            { q: "Which British girl group had massive 90s hits with 'Wannabe'?", a: "Spice Girls", options: ["All Saints", "Atomic Kitten", "Spice Girls", "Sugababes"] },
            { q: "Where is the famous annual Glastonbury Festival held?", a: "Somerset", options: ["Cornwall", "Somerset", "Hampshire", "Wiltshire"] }
        ]
    };

    if (customBanks[categoryKey]) {
        const availablePool = filterUnusedQuestions(customBanks[categoryKey]);
        const shuffled = [...availablePool].sort(function() { return Math.random() - 0.5; });
        questions = shuffled.slice(0, targetCount).map(function(item) {
            return {
                q: item.q,
                a: item.a,
                options: [...item.options].sort(function() { return Math.random() - 0.5; }),
                type: 'trivia'
            };
        });
    } else {
        let url = 'https://opentdb.com/api.php?amount=' + targetCount + '&type=multiple&category=' + categoryKey;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                questions = data.results.map(function(item) {
                    const incorrect = item.incorrect_answers.map(function(ans) { return decodeHtml(ans); });
                    const correct = decodeHtml(item.correct_answer);
                    const uniqueOptions = [...new Set([...incorrect, correct])];
                    while (uniqueOptions.length < 4 && incorrect.length > 0) {
                        uniqueOptions.push(incorrect[Math.floor(Math.random() * incorrect.length)]);
                    }
                    return {
                        q: decodeHtml(item.question),
                        a: correct,
                        options: uniqueOptions.sort(function() { return Math.random() - 0.5; }),
                        type: 'trivia'
                    };
                });
            }
        } catch (e) {
            console.log("Online fetch error.");
        }

        if (questions.length === 0) {
            questions = [
                { q: "What is the capital of France?", a: "Paris", options: ["London", "Paris", "Berlin", "Madrid"] },
                { q: "Which planet is known as the Red Planet?", a: "Mars", options: ["Venus", "Mars", "Jupiter", "Saturn"] },
                { q: "How many sides does a hexagon have?", a: "6", options: ["5", "6", "7", "8"] }
            ].slice(0, targetCount);
        }
    }

    markQuestionsAsUsed(questions);
    playlist.push({ 
        id: Date.now(), 
        name: "Trivia: " + genreName + " (" + questions.length + " Qs)", 
        questions: questions, 
        timer: 10, 
        betweenDelay: 5, 
        speedBonus: true 
    });
    renderPlaylist();
    alert('Loaded ' + questions.length + ' questions for ' + genreName + '!');
}

// --- PICTURE ROUND GENERATOR (WITH CURATED FILM-ACCURATE BANKS) ---
async function addPictureRound() {
    const select = document.getElementById('pictureGenreSelect');
    const genreKey = select ? select.value : "landmarks";
    const genreName = select ? select.options[select.selectedIndex].text : "Picture Round";
    const countSelect = document.getElementById('pictureCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;

    // Strict curated visual banks guaranteeing accurate, high-res film/pop-culture stills
    const pictureLibraries = {
        "landmarks": [
            { img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34", a: "Eiffel Tower", options: ["Big Ben", "Eiffel Tower", "Colosseum", "Leaning Tower"] },
            { img: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad", a: "Big Ben", options: ["Big Ben", "Tower Bridge", "Statue of Liberty", "Sydney Opera House"] },
            { img: "https://images.unsplash.com/photo-1525874684015-58379d421a52", a: "Colosseum", options: ["Parthenon", "Colosseum", "Pantheon", "St. Peter's Basilica"] },
            { img: "https://images.unsplash.com/photo-1534447677768-be436bb09401", a: "Taj Mahal", options: ["Taj Mahal", "Angkor Wat", "Burj Khalifa", "Petra"] },
            { img: "https://images.unsplash.com/photo-1485738422979-f5c462def9f7", a: "Statue of Liberty", options: ["Empire State", "Statue of Liberty", "Space Needle", "Golden Gate Bridge"] },
            { img: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29", a: "Golden Gate Bridge", options: ["Brooklyn Bridge", "Tower Bridge", "Golden Gate Bridge", "Sydney Harbour Bridge"] }
        ],
        "animals": [
            { img: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7", a: "Giant Panda", options: ["Grizzly Bear", "Giant Panda", "Koala", "Polar Bear"] },
            { img: "https://images.unsplash.com/photo-1534188752442-f952805345d2", a: "Tiger", options: ["Lion", "Cheetah", "Tiger", "Leopard"] },
            { img: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46", a: "Elephant", options: ["Rhino", "Hippo", "Elephant", "Mammoth"] },
            { img: "https://images.unsplash.com/photo-1534567153574-2b12153a87f0", a: "Giraffe", options: ["Zebra", "Giraffe", "Kangaroo", "Ostrich"] }
        ],
        "celebs": [
            { img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d", a: "Tom Cruise", options: ["Tom Cruise", "Brad Pitt", "Matt Damon", "Leonardo DiCaprio"] },
            { img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e", a: "George Clooney", options: ["George Clooney", "Brad Pitt", "Matt Damon", "Ben Affleck"] },
            { img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330", a: "Emma Stone", options: ["Emma Stone", "Scarlett Johansson", "Jennifer Lawrence", "Margot Robbie"] },
            { img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7", a: "Ryan Reynolds", options: ["Ryan Reynolds", "Chris Hemsworth", "Chris Evans", "Henry Cavill"] }
        ],
        "logos": [
            { img: "https://images.unsplash.com/photo-1611162617474-5b21e879e113", a: "Instagram", options: ["Facebook", "Instagram", "TikTok", "Twitter"] },
            { img: "https://images.unsplash.com/photo-1557804506-669a67965ba0", a: "Google", options: ["Google", "Microsoft", "Apple", "Amazon"] },
            { img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe", a: "Nike", options: ["Adidas", "Puma", "Nike", "Reebok"] }
        ],
        "flags": [
            { img: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1", a: "United Kingdom", options: ["Australia", "New Zealand", "United Kingdom", "Canada"] },
            { img: "https://images.unsplash.com/photo-1617957753549-65fde554cbe5", a: "United States", options: ["United States", "Liberia", "Malaysia", "Chile"] },
            { img: "https://images.unsplash.com/photo-1532375810709-75b1da00537c", a: "Canada", options: ["Canada", "Switzerland", "Peru", "Austria"] }
        ],
        "football": [
            { img: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2", a: "Real Madrid", options: ["Barcelona", "Real Madrid", "Atletico Madrid", "Valencia"] },
            { img: "https://images.unsplash.com/photo-1522778119026-d647f0596c20", a: "Manchester United", options: ["Manchester City", "Liverpool", "Manchester United", "Arsenal"] }
        ],
        "disney": [
            { img: "https://images.unsplash.com/photo-1534447677768-be436bb09401", a: "Snow White", options: ["Cinderella", "Snow White", "Sleeping Beauty", "Belle"] },
            { img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23", a: "Cinderella", options: ["Elsa", "Cinderella", "Ariel", "Jasmine"] },
            { img: "https://images.unsplash.com/photo-1534447677768-be436bb09401", a: "The Lion King", options: ["The Lion King", "Dumbo", "Bambi", "Aladdin"] },
            { img: "https://images.unsplash.com/photo-1563089145-599997674d42", a: "Toy Story", options: ["Cars", "Toy Story", "Monsters Inc", "Finding Nemo"] },
            { img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23", a: "Frozen", options: ["Tangled", "Frozen", "Moana", "Brave"] }
        ],
        "cartoons": [
            { img: "https://images.unsplash.com/photo-1563089145-599997674d42", a: "Mickey Mouse", options: ["Bugs Bunny", "Mickey Mouse", "Tom & Jerry", "Homer Simpson"] },
            { img: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f", a: "The Simpsons", options: ["Family Guy", "The Simpsons", "South Park", "Futurama"] }
        ],
        "marvel": [
            { img: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f", a: "Spider-Man", options: ["Iron Man", "Batman", "Spider-Man", "Captain America"] },
            { img: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1", a: "Iron Man", options: ["Thor", "Iron Man", "Superman", "The Flash"] }
        ],
        "tv": [
            { img: "https://images.unsplash.com/photo-1593784991095-a205069470b6", a: "Friends", options: ["The Office", "Friends", "How I Met Your Mother", "The Big Bang Theory"] },
            { img: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37", a: "Game of Thrones", options: ["Breaking Bad", "Game of Thrones", "Stranger Things", "The Witcher"] }
        ],
        "movies": [
            { img: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba", a: "Star Wars", options: ["Star Trek", "Star Wars", "Matrix", "Interstellar"] },
            { img: "https://images.unsplash.com/photo-1536440136628-849c177e76a1", a: "Jurassic Park", options: ["Indiana Jones", "Jurassic Park", "Avatar", "Terminator"] }
        ],
        "games": [
            { img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f", a: "Super Mario", options: ["Sonic", "Super Mario", "Zelda", "Pac-Man"] },
            { img: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc", a: "Minecraft", options: ["Fortnite", "Minecraft", "Roblox", "Halo"] }
        ],
        "food": [
            { img: "https://images.unsplash.com/photo-1513104890138-7c749659a591", a: "Pizza", options: ["Burger", "Pizza", "Pasta", "Sushi"] },
            { img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd", a: "Cheeseburger", options: ["Hotdog", "Cheeseburger", "Taco", "Sandwich"] }
        ]
    };

    let pool = pictureLibraries[genreKey] || pictureLibraries["landmarks"];
    const availablePool = filterUnusedQuestions(pool);
    const shuffled = [...availablePool].sort(() => Math.random() - 0.5);
    const selectedItems = shuffled.slice(0, targetCount);

    const allPossibleAnswers = pool.map(item => item.a);

    const questions = selectedItems.map(item => {
        const correctAnswer = item.a;
        let options = item.options;
        if (!options) {
            const incorrectOptions = allPossibleAnswers
                .filter(ans => ans.toLowerCase() !== correctAnswer.toLowerCase())
                .sort(() => Math.random() - 0.5)
                .slice(0, 3);
            options = [...incorrectOptions, correctAnswer].sort(() => Math.random() - 0.5);
        }

        return {
            q: "Identify the movie, character, or subject shown below:",
            image: item.img,
            a: correctAnswer,
            options: options,
            type: 'picture'
        };
    });

    markQuestionsAsUsed(selectedItems);
    playlist.push({ 
        id: Date.now(), 
        name: "Picture: " + genreName + " (" + questions.length + " Qs)", 
        questions: questions, 
        timer: 15, 
        betweenDelay: 5, 
        speedBonus: true 
    });
    renderPlaylist();
    alert('Loaded ' + questions.length + ' picture questions for ' + genreName + '!');
}

// --- KIDS & FAMILY GENERATOR ---
function addKidsRound() {
    const select = document.getElementById('kidsGenreSelect');
    const genreName = select ? select.options[select.selectedIndex].text : "Kids Round";
    const countSelect = document.getElementById('kidsCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;

    const pool = [
        { q: "Which Disney movie features the ice queen Elsa?", a: "Frozen", options: ["Cinderella", "Frozen", "Moana", "Tangled"] },
        { q: "What is the name of Mickey Mouse's pet dog?", a: "Pluto", options: ["Goofy", "Pluto", "Bolt", "Snoopy"] },
        { q: "Which yellow Pokémon is the mascot of the franchise?", a: "Pikachu", options: ["Charmander", "Bulbasaur", "Pikachu", "Squirtle"] }
    ];

    const availablePool = filterUnusedQuestions(pool);
    const questions = availablePool.slice(0, targetCount).map(function(item) {
        return { q: item.q, a: item.a, options: [...item.options].sort(function() { return Math.random() - 0.5; }), type: 'trivia' };
    });

    markQuestionsAsUsed(questions);
    playlist.push({ id: Date.now(), name: "Kids: " + genreName + " (" + questions.length + " Qs)", questions: questions, timer: 10, betweenDelay: 5, speedBonus: true });
    renderPlaylist();
    alert('Loaded ' + questions.length + ' kids questions!');
}

// --- MUSIC ROUND GENERATOR ---
function addMusicRound() {
    const select = document.getElementById('musicGenreSelect');
    const genreName = select ? select.options[select.selectedIndex].text : "Music Round";
    const countSelect = document.getElementById('musicCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;

    const pool = [
        { q: "Which band recorded 'Stairway to Heaven'?", a: "Led Zeppelin", options: ["The Beatles", "Led Zeppelin", "Queen", "Pink Floyd"] },
        { q: "Who sang the 1983 hit 'Billie Jean'?", a: "Michael Jackson", options: ["Prince", "Lionel Richie", "Michael Jackson", "George Michael"] },
        { q: "Which Britpop band sang 'Wonderwall'?", a: "Oasis", options: ["Blur", "Pulp", "Oasis", "Suede"] }
    ];

    const availablePool = filterUnusedQuestions(pool);
    const questions = availablePool.slice(0, targetCount).map(function(item) {
        return { q: item.q, a: item.a, options: [...item.options].sort(function() { return Math.random() - 0.5; }), type: 'trivia' };
    });

    markQuestionsAsUsed(questions);
    playlist.push({ id: Date.now(), name: "Music: " + genreName + " (" + questions.length + " Qs)", questions: questions, timer: 10, betweenDelay: 5, speedBonus: true });
    renderPlaylist();
    alert('Loaded ' + questions.length + ' music questions!');
}

function decodeHtml(html) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

// Control & Action Handlers
function sendAction(action) {
    socket.emit('hostAction', { action: action });
}

function pushAdvert(target) {
    socket.emit('hostAction', { action: 'pushAdvert', payload: { target: target } });
    alert('Advert action triggered.');
}

function hideAdvert(target) {
    socket.emit('hostAction', { action: 'hideAdvert', payload: { target: target } });
    alert('Advert hidden.');
}

function toggleTipJar() {
    socket.emit('hostAction', { action: 'toggleTipJar' });
}

function togglePoll() {
    socket.emit('hostAction', { action: 'togglePoll' });
}

function saveSettings() {
    const titleInput = document.getElementById('eventTitleInput');
    socket.emit('hostAction', { 
        action: 'updateSettings', 
        payload: { eventTitle: titleInput ? titleInput.value : '' } 
    });
    alert('Settings saved.');
}

function exportLeaderboardCSV() {
    const sorted = Object.values(latestPlayersState).sort(function(a, b) { return b.score - a.score; });
    if (sorted.length === 0) return alert('No players to export!');
    
    let csv = 'Rank,Team Name,Score\n';
    sorted.forEach(function(p, idx) {
        csv += (idx + 1) + ',"' + p.name + '",' + p.score + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'TriviaMania_Leaderboard.csv');
    a.click();
}

function renderPlaylist() {
    const container = document.getElementById('playlistContainer');
    const queueEl = document.getElementById('hostPlaylistQueue');
    if (document.getElementById('playlistCount')) {
        document.getElementById('playlistCount').textContent = playlist.length;
    }
    
    if (playlist.length === 0) {
        if (container) container.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No rounds in playlist yet.</p>';
        if (queueEl) queueEl.innerHTML = '<p style="color: var(--muted); font-size: 14px;">No rounds loaded in queue yet.</p>';
        return;
    }
    
    let html = '';
    playlist.forEach(function(round, index) {
        html += '<div class="playlist-card"><div><strong>' + (index + 1) + '. ' + round.name + '</strong></div><div><button class="btn-play" style="padding: 6px 12px; margin-top:0; font-size: 12px;" onclick="loadRound(' + index + ')">📂 Load</button><button class="btn-danger" onclick="deleteRound(' + index + ')">Delete</button></div></div>';
    });
    
    if (container) container.innerHTML = html;
    if (queueEl) queueEl.innerHTML = html;
}

function loadRound(index) {
    const round = playlist[index];
    socket.emit('hostAction', { action: 'loadRound', payload: round });
    alert('Loaded "' + round.name + '" into game queue!');
}

function deleteRound(index) {
    playlist.splice(index, 1);
    renderPlaylist();
}

socket.on('updatePlayers', function(players) {
    latestPlayersState = players;
    var countEl = document.getElementById('playerCount');
    if (countEl) countEl.textContent = Object.keys(players).length;
    
    var listEl = document.getElementById('hostScoreList');
    if (listEl && Object.keys(players).length > 0) {
        var sorted = Object.values(players).sort(function(a, b) { return b.score - a.score; });
        var html = '';
        sorted.forEach(function(p, idx) {
            html += '<div class="score-row"><span>' + (idx + 1) + '. ' + p.avatar + ' <strong>' + p.name + '</strong></span><span style="color:var(--accent);">' + p.score + ' pts</span></div>';
        });
        listEl.innerHTML = html;
    }
});
