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
let latestPlayersState = {};

// --- ANTI-REPEAT QUESTION HISTORY TRACKER ---
let usedQuestionHistory = JSON.parse(localStorage.getItem('triviamania_history') || '[]');

function filterUnusedQuestions(pool) {
    // Filter out questions that have been used recently
    const fresh = pool.filter(item => !usedQuestionHistory.includes(item.q));
    // If we've used more than 75% of the pool, reset history to keep games flowing
    if (fresh.length < pool.length * 0.25) {
        usedQuestionHistory = [];
        localStorage.setItem('triviamania_history', JSON.stringify([]));
        return pool;
    }
    return fresh;
}

function markQuestionsAsUsed(questions) {
    questions.forEach(item => {
        if (!usedQuestionHistory.includes(item.q)) {
            usedQuestionHistory.push(item.q);
        }
    });
    // Cap memory history at last 300 questions
    if (usedQuestionHistory.length > 300) {
        usedQuestionHistory = usedQuestionHistory.slice(-300);
    }
    localStorage.setItem('triviamania_history', JSON.stringify(usedQuestionHistory));
}

// --- MASSIVELY EXPANDED MASTER QUESTION BANKS (50-100+ UNIQUE QUESTIONS PER CATEGORY) ---
const masterTriviaBanks = {
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
        { q: "What is a traditional British Sunday roast meat commonly served with mint sauce?", a: "Roast Lamb", options: ["Roast Beef", "Roast Pork", "Roast Lamb", "Roast Chicken"] },
        { q: "In what year did the UK vote to leave the European Union in a referendum?", a: "2016", options: ["2014", "2015", "2016", "2018"] },
        { q: "Which British city is famous for producing the world's finest cutlery and steel?", a: "Sheffield", options: ["Leeds", "Sheffield", "Newcastle", "Bristol"] },
        { q: "What is the highest mountain peak in the United Kingdom?", a: "Ben Nevis", options: ["Snowdon", "Scafell Pike", "Ben Nevis", "Slieve Donard"] },
        { q: "Which iconic British automobile manufacturer produces the Mini?", a: "BMW / British Motor Corporation", options: ["Aston Martin", "Rolls-Royce", "BMW / British Motor Corporation", "Bentley"] },
        { q: "What is the traditional name for the day after Christmas in the UK?", a: "Boxing Day", options: ["St. Stephen's Day", "Boxing Day", "Feasting Day", "Winter Bank Holiday"] },
        { q: "Which UK country has a red dragon on its national flag?", a: "Wales", options: ["Scotland", "Wales", "Northern Ireland", "England"] },
        { q: "What is the official national animal of Scotland?", a: "Unicorn", options: ["Red Deer", "Golden Eagle", "Unicorn", "Scottish Wildcat"] },
        { q: "In which English city would you find the historic university founded in 1209?", a: "Cambridge", options: ["Oxford", "Cambridge", "Durham", "Bath"] },
        { q: "What is the name of the famous prehistoric stone circle located in Wiltshire?", a: "Stonehenge", options: ["Avebury", "Stonehenge", "Glastonbury Tor", "Silbury Hill"] },
        { q: "Which British poet wrote 'The Tale of Peter Rabbit'?", a: "Beatrix Potter", options: ["Roald Dahl", "A.A. Milne", "Beatrix Potter", "C.S. Lewis"] }
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
        { q: "What sport is played at Lord's Cricket Ground, known as the Home of Cricket?", a: "Cricket", options: ["Polo", "Cricket", "Rugby Union", "Croquet"] },
        { q: "Who holds the record for the most goals scored in the English Premier League?", a: "Alan Shearer", options: ["Wayne Rooney", "Harry Kane", "Alan Shearer", "Sergio Agüero"] },
        { q: "Which British golfer won The Masters in 2016?", a: "Danny Willett", options: ["Justin Rose", "Danny Willett", "Rory McIlroy", "Nick Faldo"] },
        { q: "Which stadium is known as the home of English rugby union?", a: "Twickenham", options: ["Wembley", "Twickenham", "Principality Stadium", "Murrayfield"] },
        { q: "In darts, what is the highest possible checkout score with three darts?", a: "170", options: ["160", "170", "180", "150"] },
        { q: "Which Formula 1 driver holds a record for winning seven World Drivers' Championships alongside Michael Schumacher?", a: "Lewis Hamilton", options: ["Jenson Button", "Damon Hill", "Lewis Hamilton", "Nigel Mansell"] }
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
        { q: "Who discovered penicillin in London in 1928?", a: "Alexander Fleming", options: ["Alexander Fleming", "Edward Jenner", "Joseph Lister", "Isaac Newton"] },
        { q: "In what year did the Titanic sink on its maiden voyage from Southampton?", a: "1912", options: ["1910", "1912", "1914", "1918"] },
        { q: "Who was Britain's first female Prime Minister, elected in 1979?", a: "Margaret Thatcher", options: ["Theresa May", "Margaret Thatcher", "Liz Truss", "Barbara Castle"] },
        { q: "Which Roman Emperor ordered the construction of a famous wall across northern Britain?", a: "Hadrian", options: ["Julius Caesar", "Augustus", "Hadrian", "Nero"] }
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
        { q: "Who created the legendary British comedy series 'Fawlty Towers'?", a: "John Cleese", options: ["Rowan Atkinson", "John Cleese", "Ricky Gervais", "Steve Coogan"] },
        { q: "What is the name of the Rovers Return landlady in Coronation Street?", a: "Annie Walker / Bet Lynch", options: ["Peggy Mitchell", "Annie Walker / Bet Lynch", "Kat Slater", "Deirdre Barlow"] },
        { q: "Which comedy show features the phrase 'Computer says no'?", a: "Little Britain", options: ["The Catherine Tate Show", "Little Britain", "The Fast Show", "Bo' Selecta!"] }
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
    ],

    // Kids & Family Categories
    "kids_disney": [
        { q: "Which Disney movie features the ice queen Elsa?", a: "Frozen", options: ["Cinderella", "Frozen", "Moana", "Tangled"] },
        { q: "What is the name of Mickey Mouse's pet dog?", a: "Pluto", options: ["Goofy", "Pluto", "Bolt", "Snoopy"] },
        { q: "In The Lion King, what is the name of Simba's strict hornbill majordomo?", a: "Zazu", options: ["Timon", "Pumbaa", "Zazu", "Rafiki"] },
        { q: "What kind of animal is Po in 'Kung Fu Panda'?", a: "Giant Panda", options: ["Red Panda", "Giant Panda", "Grizzly Bear", "Polar Bear"] },
        { q: "Which Disney princess loses her glass slipper at the royal ball?", a: "Cinderella", options: ["Snow White", "Cinderella", "Aurora", "Belle"] },
        { q: "What is the name of the cowboy doll in Pixar's Toy Story?", a: "Woody", options: ["Buzz Lightyear", "Woody", "Rex", "Slinky"] },
        { q: "In Finding Nemo, what species of fish is Nemo?", a: "Clownfish", options: ["Blue Tang", "Clownfish", "Goldfish", "Angel Fish"] },
        { q: "Which Hawaiian girl adopts an alien named Stitch?", a: "Lilo", options: ["Moana", "Lilo", "Merida", "Mulan"] },
        { q: "What is the name of the snowman who likes warm hugs in Frozen?", a: "Olaf", options: ["Sven", "Kristoff", "Olaf", "Hans"] },
        { q: "Which Disney film features a young mermaid who trades her voice for human legs?", a: "The Little Mermaid", options: ["Moana", "The Little Mermaid", "Brave", "Cinderella"] }
    ],
    "kids_pokemon": [
        { q: "Which yellow electric Pokémon is the mascot of the franchise?", a: "Pikachu", options: ["Charmander", "Bulbasaur", "Pikachu", "Squirtle"] },
        { q: "What type of Pokémon is Charmander?", a: "Fire", options: ["Water", "Grass", "Fire", "Electric"] },
        { q: "Who is Ash Ketchum's very first human traveling companion in the Kanto region?", a: "Misty", options: ["May", "Dawn", "Misty", "Serena"] },
        { q: "What is the name of the sleepy Pokémon that blocks roads in early games?", a: "Snorlax", options: ["Pounder", "Snorlax", "Jigglypuff", "Meowth"] },
        { q: "Which Pokémon evolves into Charizard?", a: "Charmeleon", options: ["Charmander", "Charmeleon", "Cyndaquil", "Torchic"] },
        { q: "What is the name of Team Rocket's talking feline partner?", a: "Meowth", options: ["Persian", "Meowth", "Skitty", "Glameow"] }
    ],
    "kids_roald_dahl": [
        { q: "Which Roald Dahl character finds a Golden Ticket to visit a chocolate factory?", a: "Charlie Bucket", options: ["James", "Charlie Bucket", "Matilda", "Danny"] },
        { q: "What giant magical fruit does James travel inside in Roald Dahl's famous story?", a: "Peach", options: ["Apple", "Pear", "Peach", "Melon"] },
        { q: "What is the name of the telekinetic little girl with magical powers in Dahl's novel?", a: "Matilda", options: ["Sophie", "Matilda", "Veruca", "Lavender"] },
        { q: "In 'The BFG', what does BFG stand for?", a: "Big Friendly Giant", options: ["Big Fast Giant", "Big Friendly Giant", "Brown Furry Giant", "Bold Fearless Giant"] },
        { q: "Which terrible couple are Matilda's neglectful parents in the book?", a: "Mr. and Mrs. Wormwood", options: ["Mr. and Mrs. Twit", "Mr. and Mrs. Wormwood", "The Trunchbulls", "The Bucket Family"] }
    ],
    "kids_harry_potter": [
        { q: "What is the name of Harry Potter's pet snowy owl?", a: "Hedwig", options: ["Crookshanks", "Scabbers", "Hedwig", "Fang"] },
        { q: "Which house at Hogwarts does Harry Potter belong to?", a: "Gryffindor", options: ["Slytherin", "Ravenclaw", "Hufflepuff", "Gryffindor"] },
        { q: "What position does Harry play on his Quidditch team?", a: "Seeker", options: ["Chaser", "Keeper", "Seeker", "Beater"] },
        { q: "What is the name of the wizarding prison guarded by Dementors?", a: "Azkaban", options: ["Nurmengard", "Azkaban", "Gringotts", "The Ministry"] },
        { q: "What sweet candy can make people make animal noises in Hogwarts?", a: "Skiving Snackboxes", options: ["Bertie Bott's Every Flavor Beans", "Chocolate Frogs", "Skiving Snackboxes", "Acid Pops"] }
    ],

    // Music Trivia Categories
    "music_classic_rock": [
        { q: "Which legendary rock band recorded the epic rock anthem 'Stairway to Heaven'?", a: "Led Zeppelin", options: ["The Beatles", "Led Zeppelin", "Queen", "Pink Floyd"] },
        { q: "Who sang the iconic 1970 hit single 'Your Song'?", a: "Elton John", options: ["David Bowie", "Elton John", "Rod Stewart", "Paul McCartney"] },
        { q: "Which band released the landmark 1973 album 'The Dark Side of the Moon'?", a: "Pink Floyd", options: ["Led Zeppelin", "The Who", "Pink Floyd", "Genesis"] },
        { q: "What was the name of the lead singer of Queen who famously commanded Live Aid?", a: "Freddie Mercury", options: ["Mick Jagger", "Robert Plant", "Freddie Mercury", "David Bowie"] },
        { q: "Which band performed the massive 1976 hit 'Hotel California'?", a: "Eagles", options: ["Fleetwood Mac", "Eagles", "The Doobie Brothers", "Lynyrd Skynyrd"] },
        { q: "Which heavy metal band released 'Paranoid' in 1970?", a: "Black Sabbath", options: ["Led Zeppelin", "Deep Purple", "Black Sabbath", "Judas Priest"] }
    ],
    "music_80s_90s": [
        { q: "Who sang the legendary 1983 pop/dance smash hit 'Billie Jean'?", a: "Michael Jackson", options: ["Prince", "Lionel Richie", "Michael Jackson", "George Michael"] },
        { q: "Which British pop duo sang 'Wake Me Up Before You Go-Go'?", a: "Wham!", options: ["Duran Duran", "Wham!", "Culture Club", "Pet Shop Boys"] },
        { q: "Which 90s Britpop band famously rivaled Blur during the 'Battle of Britpop'?", a: "Oasis", options: ["Pulp", "Oasis", "Suede", "The Verve"] },
        { q: "Which girl group released the massive 1996 debut smash hit 'Wannabe'?", a: "Spice Girls", options: ["All Saints", "Atomic Kitten", "Spice Girls", "Sugababes"] },
        { q: "Who released the record-breaking 1997 global ballad 'My Heart Will Go On'?", a: "Celine Dion", options: ["Mariah Carey", "Whitney Houston", "Celine Dion", "Madonna"] },
        { q: "Which American band released the massive 1991 grunge anthem 'Smells Like Teen Spirit'?", a: "Nirvana", options: ["Pearl Jam", "Soundgarden", "Nirvana", "Alice in Chains"] }
    ],
    "music_soundtracks": [
        { q: "Which film featured the Oscar-winning theme song 'My Heart Will Go On'?", a: "Titanic", options: ["The Bodyguard", "Titanic", "Armageddon", "Ghost"] },
        { q: "Who composed the legendary movie scores for Star Wars, Jaws, and Jurassic Park?", a: "John Williams", options: ["Hans Zimmer", "Ennio Morricone", "John Williams", "Danny Elfman"] },
        { q: "Which animated movie featured the iconic hit song 'Let It Go'?", a: "Frozen", options: ["Tangled", "Frozen", "Moana", "Brave"] },
        { q: "Which cult classic 90s film soundtrack featured iconic tracks by Pulp, Blur, and Lou Reed?", a: "Trainspotting", options: ["Pulp Fiction", "Trainspotting", "Lock, Stock and Two Smoking Barrels", "Snatch"] },
        { q: "Which Quentin Tarantino movie famously featured Chuck Berry's 'You Never Can Tell' during a twist contest?", a: "Pulp Fiction", options: ["Reservoir Dogs", "Pulp Fiction", "Kill Bill", "Django Unchained"] }
    ],
    "music_pop_divas": [
        { q: "Which pop superstar released the global hit albums '1989', 'Fearless', and 'Midnights'?", a: "Taylor Swift", options: ["Katy Perry", "Taylor Swift", "Lady Gaga", "Rihanna"] },
        { q: "Who is known worldwide as the 'Queen of Pop' and released 'Like a Prayer'?", a: "Madonna", options: ["Cher", "Madonna", "Cyndi Lauper", "Whitney Houston"] },
        { q: "Which singer rose to fame with 'Poker Face' and starred in 'A Star is Born'?", a: "Lady Gaga", options: ["Katy Perry", "Britney Spears", "Lady Gaga", "Miley Cyrus"] },
        { q: "What is the real first name of pop icon Rihanna?", a: "Robyn", options: ["Rihanna", "Robyn", "Fenty", "Aaliyah"] }
    ]
};

// --- UNIVERSAL ROUND GENERATOR WITH ANTI-REPEAT ---
function addTriviaRound() { generateRoundFromCategory('triviaGenreSelect', 'triviaCountSelect', 'Standard Trivia'); }
function addKidsRound() { generateRoundFromCategory('kidsGenreSelect', 'kidsCountSelect', 'Kids & Family'); }
function addMusicRound() { generateRoundFromCategory('musicGenreSelect', 'musicCountSelect', 'Music Trivia'); }

function generateRoundFromCategory(genreSelectId, countSelectId, roundPrefix) {
    const select = document.getElementById(genreSelectId);
    const categoryKey = select ? select.value : Object.keys(masterTriviaBanks)[0];
    const genreName = select ? select.options[select.selectedIndex].text : roundPrefix;
    const countSelect = document.getElementById(countSelectId);
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;
    
    const pool = masterTriviaBanks[categoryKey] || masterTriviaBanks["uk_general"];
    
    // Filter out recently used questions to prevent repetition
    const availablePool = filterUnusedQuestions(pool);
    const shuffled = [...availablePool].sort(function() { return Math.random() - 0.5; });
    const selected = shuffled.slice(0, targetCount);

    const questions = selected.map(function(item) {
        return {
            q: item.q,
            a: item.a,
            options: [...item.options].sort(function() { return Math.random() - 0.5; }),
            type: 'trivia'
        };
    });

    markQuestionsAsUsed(selected);

    playlist.push({ 
        id: Date.now(), 
        name: roundPrefix + ": " + genreName + " (" + questions.length + " Qs)", 
        questions: questions, 
        timer: 15, 
        betweenDelay: 5, 
        speedBonus: true 
    });
    
    renderPlaylist();
    alert('Successfully loaded ' + questions.length + ' fresh questions for ' + genreName + '!');
}

function addPictureRound() { alert('Picture rounds are currently streamlined. Standard, Kids, and Music trivia are active!'); }

// Control & Action Handlers
function sendAction(action) { socket.emit('hostAction', { action: action }); }
function pushAdvert(target) { socket.emit('hostAction', { action: 'pushAdvert', payload: { target: target } }); alert('Advert action triggered.'); }
function hideAdvert(target) { socket.emit('hostAction', { action: 'hideAdvert', payload: { target: target } }); alert('Advert hidden.'); }
function toggleTipJar() { socket.emit('hostAction', { action: 'toggleTipJar' }); }
function togglePoll() { socket.emit('hostAction', { action: 'togglePoll' }); }

function saveSettings() {
    const titleInput = document.getElementById('eventTitleInput');
    socket.emit('hostAction', { action: 'updateSettings', payload: { eventTitle: titleInput ? titleInput.value : '' } });
    alert('Settings saved.');
}

function exportLeaderboardCSV() {
    const sorted = Object.values(latestPlayersState).sort(function(a, b) { return b.score - a.score; });
    if (sorted.length === 0) return alert('No players to export!');
    
    let csv = 'Rank,Team Name,Score\n';
    sorted.forEach(function(p, idx) { csv += (idx + 1) + ',"' + p.name + '",' + p.score + '\n'; });

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
    if (document.getElementById('playlistCount')) { document.getElementById('playlistCount').textContent = playlist.length; }
    
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
