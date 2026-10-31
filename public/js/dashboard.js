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

// --- PICTURE ROUND GENERATOR (PRECISION MATCHED BANKS) ---
async function addPictureRound() {
    const select = document.getElementById('pictureGenreSelect');
    const genreKey = select ? select.value : "landmarks";
    const genreName = select ? select.options[select.selectedIndex].text : "Picture Round";
    const countSelect = document.getElementById('pictureCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;

    // Precision-matched visual banks with 15+ items each, ensuring images and answers 100% align
    const pictureLibraries = {
        "landmarks": [
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg", a: "Eiffel Tower", options: ["Big Ben", "Eiffel Tower", "Colosseum", "Leaning Tower"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/9/93/Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg", a: "Big Ben", options: ["Big Ben", "Tower Bridge", "Statue of Liberty", "Sydney Opera House"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/d/de/Colosseo_2020.jpg", a: "Colosseum", options: ["Parthenon", "Colosseum", "Pantheon", "St. Peter's Basilica"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/c/c8/Taj_Mahal_in_March_2004.jpg", a: "Taj Mahal", options: ["Taj Mahal", "Angkor Wat", "Burj Khalifa", "Petra"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Statue_of_Liberty_7.jpg", a: "Statue of Liberty", options: ["Empire State", "Statue of Liberty", "Space Needle", "Golden Gate Bridge"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/0c/GoldenGateBridge-001.jpg", a: "Golden Gate Bridge", options: ["Brooklyn Bridge", "Tower Bridge", "Golden Gate Bridge", "Sydney Harbour Bridge"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Sydney_Opera_House_Sails.jpg", a: "Sydney Opera House", options: ["Sydney Opera House", "Wembley Stadium", "Tokyo Tower", "Marina Bay Sands"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Leaning_Tower_of_Pisa_SB.jpg", a: "Leaning Tower of Pisa", options: ["Eiffel Tower", "Leaning Tower of Pisa", "Colosseum", "Duomo"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/6/63/Tower_Bridge_London_Jan_2006.jpg", a: "Tower Bridge", options: ["London Bridge", "Tower Bridge", "Westminster Bridge", "Millennium Bridge"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a2/Burj_Khalifa_Dubai.jpg", a: "Burj Khalifa", options: ["Empire State", "Burj Khalifa", "Shard", "Shanghai Tower"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/5/52/Arc_de_Triomphe%2C_Paris_2nd_oct_2005.jpg", a: "Arc de Triomphe", options: ["Eiffel Tower", "Arc de Triomphe", "Louvre", "Pantheon"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/3/36/Stonehenge_July_2005_3.jpg", a: "Stonehenge", options: ["Stonehenge", "Avebury", "Glastonbury Tor", "Hadrian's Wall"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Machu_Picchu%2C_Peru.jpg", a: "Machu Picchu", options: ["Chichen Itza", "Machu Picchu", "Petra", "Tikal"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/5/53/Colosseo_di_Roma_%28interior%29.jpg", a: "Roman Colosseum", options: ["Parthenon", "Roman Colosseum", "Arena", "Stadium"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Empire_State_Building_%28aerial%29.jpg", a: "Empire State Building", options: ["Chrysler Building", "Empire State Building", "Freedom Tower", "Flatiron"] }
        ],
        "animals": [
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Grosser_Panda.JPG", a: "Giant Panda", options: ["Grizzly Bear", "Giant Panda", "Koala", "Polar Bear"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/5/56/Tiger.50.jpg", a: "Tiger", options: ["Lion", "Cheetah", "Tiger", "Leopard"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/3/37/African_Bush_Elephant.jpg", a: "Elephant", options: ["Rhino", "Hippo", "Elephant", "Mammoth"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Giraffe_Boats_Botswana.jpg", a: "Giraffe", options: ["Zebra", "Giraffe", "Kangaroo", "Ostrich"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/2/26/Yellow_Labrador_Retriever_RAM_Lrg.jpg", a: "Dog", options: ["Cat", "Dog", "Fox", "Wolf"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Kitten_In_Garden.jpg", a: "Cat", options: ["Dog", "Cat", "Rabbit", "Hamster"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/1/16/Red_Fox_%28Vulpes_vulpes%29_-_i_lang.jpg", a: "Fox", options: ["Wolf", "Fox", "Jackal", "Coyote"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/07/Emperor_Penguin_Manchot_empereur.jpg", a: "Penguin", options: ["Puffin", "Penguin", "Seal", "Polar Bear"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Kangaroo_darlington_point.jpg", a: "Kangaroo", options: ["Wallaby", "Kangaroo", "Koala", "Wombat"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Plains_Zebra_Equus_quagga_burchellii_Etosha.jpg", a: "Zebra", options: ["Horse", "Zebra", "Donkey", "Okapi"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg", a: "Lion", options: ["Tiger", "Lion", "Cheetah", "Jaguar"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a2/Mountain_Gorilla_%28Virunga_National_Park%2C_Democratic_Republic_of_the_Congo%2C_2012%29.jpg", a: "Gorilla", options: ["Chimpanzee", "Gorilla", "Orangutan", "Baboon"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Polar_Bear_-_Arctic_%2817542289196%29.jpg", a: "Polar Bear", options: ["Grizzly", "Polar Bear", "Panda", "Sloth Bear"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Cheetah_%28Acinonyx_jubatus%29_fording_a_stream.jpg", a: "Cheetah", options: ["Leopard", "Cheetah", "Tiger", "Hyena"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/4/49/Koala_climbing_a_tree.jpg", a: "Koala", options: ["Sloth", "Koala", "Wombat", "Possum"] }
        ],
        "celebs": [
            { img: "https://upload.wikimedia.org/wikipedia/commons/3/33/Tom_Cruise_by_Gage_Skidmore_2.jpg", a: "Tom Cruise", options: ["Tom Cruise", "Brad Pitt", "Matt Damon", "Leonardo DiCaprio"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/b/bd/George_Clooney_2016.jpg", a: "George Clooney", options: ["George Clooney", "Brad Pitt", "Matt Damon", "Ben Affleck"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/5/5a/Emma_Stone_2016.jpg", a: "Emma Stone", options: ["Emma Stone", "Scarlett Johansson", "Jennifer Lawrence", "Margot Robbie"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/1/18/Ryan_Reynolds_2016_%283%29.jpg", a: "Ryan Reynolds", options: ["Ryan Reynolds", "Chris Hemsworth", "Chris Evans", "Henry Cavill"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Keanu_Reeves_2019_%28cropped%29.jpg", a: "Keanu Reeves", options: ["Johnny Depp", "Keanu Reeves", "Brad Pitt", "Tom Hanks"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Will_Smith_2011.jpg", a: "Will Smith", options: ["Denzel Washington", "Will Smith", "Jamie Foxx", "Idris Elba"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/5/50/Angelina_Jolie_2nd_Annual_WIFTS_Awards_%28cropped%29.jpg", a: "Angelina Jolie", options: ["Angelina Jolie", "Charlize Theron", "Julia Roberts", "Sandra Bullock"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Taylor_Swift_The_Eras_Tour_%28cropped%29.jpg", a: "Taylor Swift", options: ["Taylor Swift", "Beyoncé", "Ariana Grande", "Billie Eilish"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Chris_Hemsworth_by_Gage_Skidmore_%28cropped%29.jpg", a: "Chris Hemsworth", options: ["Chris Evans", "Chris Pratt", "Chris Hemsworth", "Liam Hemsworth"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/6/60/Scarlett_Johansson_by_Gage_Skidmore_2_%28cropped%29.jpg", a: "Scarlett Johansson", options: ["Margot Robbie", "Emma Watson", "Scarlett Johansson", "Natalie Portman"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Zendaya_2019_by_Glenn_Francis_%28cropped%29.jpg", a: "Zendaya", options: ["Zendaya", "Zoe Saldana", "Halle Berry", "Lupita Nyong'o"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/d/de/Robert_Downey_Jr_2014_Comic_Con_%28cropped%29.jpg", a: "Robert Downey Jr.", options: ["Mark Ruffalo", "Robert Downey Jr.", "Chris Evans", "Jeremy Renner"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Jennifer_Lawrence_in_2016.jpg", a: "Jennifer Lawrence", options: ["Emma Stone", "Jennifer Lawrence", "Anne Hathaway", "Emily Blunt"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/5/51/Brad_Pitt_2019_by_Glenn_Francis.jpg", a: "Brad Pitt", options: ["Leonardo DiCaprio", "Brad Pitt", "Matt Damon", "Johnny Depp"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/7/7a/Margot_Robbie_Cannes_2019_%28cropped%29.jpg", a: "Margot Robbie", options: ["Margot Robbie", "Florence Pugh", "Ana de Armas", "Sydney Sweeney"] }
        ],
        "logos": [
            { img: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg", a: "Instagram", options: ["Facebook", "Instagram", "TikTok", "Twitter"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg", a: "Google", options: ["Google", "Microsoft", "Apple", "Amazon"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg", a: "Nike", options: ["Adidas", "Puma", "Nike", "Reebok"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg", a: "Spotify", options: ["Apple Music", "Spotify", "SoundCloud", "Pandora"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg", a: "Visa", options: ["Mastercard", "Visa", "PayPal", "American Express"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg", a: "Netflix", options: ["Amazon Prime", "Disney+", "Netflix", "Hulu"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg", a: "Apple", options: ["Microsoft", "Samsung", "Apple", "Sony"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023_original.svg", a: "Twitter / X", options: ["LinkedIn", "Reddit", "Twitter / X", "Discord"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg", a: "Amazon", options: ["eBay", "Amazon", "Shopify", "Alibaba"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/03/PlayStation_logo_1994.svg", a: "PlayStation", options: ["Xbox", "Nintendo", "PlayStation", "Steam"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Starbucks_Corporation_Logo_2011.svg", a: "Starbucks", options: ["Costa", "Starbucks", "Dunkin'", "Tim Hortons"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/3/36/McDonald%27s_Golden_Arches.svg", a: "McDonald's", options: ["Burger King", "McDonald's", "Wendy's", "Subway"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.svg", a: "Microsoft", options: ["Apple", "Google", "Microsoft", "IBM"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg", a: "Adidas", options: ["Nike", "Puma", "Adidas", "Under Armour"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg", a: "Mastercard", options: ["Visa", "Mastercard", "Amex", "Discover"] }
        ],
        "flags": [
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Flag_of_the_United_Kingdom.svg", a: "United Kingdom", options: ["Australia", "New Zealand", "United Kingdom", "Canada"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_the_United_States.svg", a: "United States", options: ["United States", "Liberia", "Malaysia", "Chile"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/c/cf/Flag_of_Canada.svg", a: "Canada", options: ["Canada", "Switzerland", "Peru", "Austria"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Flag_of_France.svg", a: "France", options: ["Italy", "France", "Belgium", "Netherlands"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Flag_of_Japan.svg", a: "Japan", options: ["South Korea", "Japan", "Bangladesh", "Palau"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Flag_of_Germany.svg", a: "Germany", options: ["Germany", "Belgium", "Austria", "Hungary"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/05/Flag_of_Brazil.svg", a: "Brazil", options: ["Argentina", "Brazil", "Colombia", "Venezuela"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Flag_of_Australia.svg", a: "Australia", options: ["New Zealand", "Australia", "Fiji", "UK"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/03/Flag_of_Italy.svg", a: "Italy", options: ["Ireland", "Italy", "Mexico", "Hungary"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Spain.svg", a: "Spain", options: ["Portugal", "Spain", "Italy", "Greece"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Flag_of_Sweden.svg", a: "Sweden", options: ["Norway", "Sweden", "Finland", "Denmark"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Flag_of_Switzerland.svg", a: "Switzerland", options: ["Switzerland", "Austria", "Denmark", "Poland"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/f/fc/Flag_of_Mexico.svg", a: "Mexico", options: ["Italy", "Mexico", "Ireland", "Hungary"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_Argentina.svg", a: "Argentina", options: ["Uruguay", "Argentina", "Brazil", "Chile"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Greece.svg", a: "Greece", options: ["Greece", "Cyprus", "Israel", "Turkey"] }
        ],
        "football": [
            { img: "https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg", a: "Real Madrid", options: ["Barcelona", "Real Madrid", "Atletico Madrid", "Valencia"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg", a: "Manchester United", options: ["Manchester City", "Liverpool", "Manchester United", "Arsenal"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg", a: "FC Barcelona", options: ["Real Madrid", "FC Barcelona", "Sevilla", "Villarreal"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg", a: "Liverpool FC", options: ["Everton", "Liverpool FC", "Chelsea", "Tottenham"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg", a: "Arsenal", options: ["Chelsea", "Arsenal", "Tottenham", "West Ham"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg", a: "Manchester City", options: ["Manchester United", "Manchester City", "Newcastle", "Aston Villa"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_München_Logo_%282002–2024%29.svg", a: "Bayern Munich", options: ["Borussia Dortmund", "Bayern Munich", "RB Leipzig", "Leverkusen"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Juventus_FC_2017_logo.svg", a: "Juventus", options: ["AC Milan", "Inter Milan", "Juventus", "Napoli"] },
            { img: "https://upload.wikimedia.org/wikipedia/fr/8/86/Logo_Paris_Saint-Germain_2013.svg", a: "Paris Saint-Germain", options: ["Marseille", "Lyon", "Paris Saint-Germain", "Monaco"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg", a: "Chelsea", options: ["Arsenal", "Chelsea", "Fulham", "Crystal Palace"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg", a: "AC Milan", options: ["Inter Milan", "AC Milan", "Roma", "Lazio"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/7/79/Ajax_Amsterdam.svg", a: "Ajax", options: ["PSV", "Feyenoord", "Ajax", "AZ Alkmaar"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg", a: "Borussia Dortmund", options: ["Bayern Munich", "Borussia Dortmund", "Schalke", "Frankfurt"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg", a: "Tottenham Hotspur", options: ["West Ham", "Tottenham Hotspur", "Arsenal", "Chelsea"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/0/05/FC_Internazionale_Milano_2021.svg", a: "Inter Milan", options: ["AC Milan", "Inter Milan", "Napoli", "Atalanta"] }
        ],
        "disney": [
            { img: "https://upload.wikimedia.org/wikipedia/en/c/c8/Snow_White_-_Poster.jpg", a: "Snow White", options: ["Cinderella", "Snow White", "Sleeping Beauty", "Belle"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/3/3f/Cinderella_1950_film_poster.jpg", a: "Cinderella", options: ["Elsa", "Cinderella", "Ariel", "Jasmine"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/3/3d/The_Lion_King_poster.jpg", a: "The Lion King", options: ["The Lion King", "Dumbo", "Bambi", "Aladdin"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/6/69/Toy_Story_3_poster.jpg", a: "Toy Story", options: ["Cars", "Toy Story", "Monsters Inc", "Finding Nemo"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/e/e8/Frozen_2013_poster.jpg", a: "Frozen", options: ["Tangled", "Frozen", "Moana", "Brave"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/d/de/Aladdin_poster.jpg", a: "Aladdin", options: ["Hercules", "Aladdin", "Mulan", "Tarzan"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/c/cb/Beauty_and_the_Beast_%281991_film_poster%29.jpg", a: "Beauty and the Beast", options: ["Cinderella", "Beauty and the Beast", "Sleeping Beauty", "Pocahontas"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/2/29/Finding_Nemo_poster.jpg", a: "Finding Nemo", options: ["Finding Nemo", "Moana", "Little Mermaid", "Luca"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/2/26/Moana_2016_poster.jpg", a: "Moana", options: ["Frozen", "Moana", "Brave", "Tangled"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/3/34/Cars_2006.jpg", a: "Cars", options: ["Toy Story", "Cars", "Planes", "The Incredibles"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/e/ea/The_Little_Mermaid_poster.jpg", a: "The Little Mermaid", options: ["Cinderella", "The Little Mermaid", "Snow White", "Sleeping Beauty"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b0/Up_%282009_film%29.jpg", a: "Up", options: ["WALL-E", "Up", "Coco", "Inside Out"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/a/a8/Tangled_poster.jpg", a: "Tangled", options: ["Frozen", "Tangled", "Brave", "Moana"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/9/98/Hercules_%281997_film%29_poster.jpg", a: "Hercules", options: ["Aladdin", "Hercules", "Robin Hood", "Peter Pan"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/9/98/Coco_%282017_film%29_poster.jpg", a: "Coco", options: ["Encanto", "Coco", "Up", "Soul"] }
        ],
        "cartoons": [
            { img: "https://upload.wikimedia.org/wikipedia/en/4/45/Mickey_Mouse_in_Steamboat_Willie.png", a: "Mickey Mouse", options: ["Bugs Bunny", "Mickey Mouse", "Tom & Jerry", "Homer Simpson"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/bd/The_Simpsons_The_Complete_First_Season_DVD_cover.jpg", a: "The Simpsons", options: ["Family Guy", "The Simpsons", "South Park", "Futurama"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/c/c4/Tom_and_Jerry_Title_Card.jpg", a: "Tom and Jerry", options: ["Looney Tunes", "Tom and Jerry", "Scooby-Doo", "Flintstones"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/e/e1/Scooby-Doo_Where_Are_You%21_title_screen.jpg", a: "Scooby-Doo", options: ["Scooby-Doo", "Snoopy", "Garfield", "Top Cat"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b2/Family_Guy_Logo.png", a: "Family Guy", options: ["The Simpsons", "Family Guy", "American Dad", "Bob's Burgers"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/a/a9/SpongeBob_SquarePants_character.svg", a: "SpongeBob SquarePants", options: ["SpongeBob SquarePants", "The Fairly OddParents", "Jimmy Neutron", "Dexter's Laboratory"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/1/1e/Looney_Tunes_Logo.svg", a: "Looney Tunes", options: ["Looney Tunes", "Merrie Melodies", "Disney", "Hanna-Barbera"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/2/28/Futurama_title_card.png", a: "Futurama", options: ["The Simpsons", "Futurama", "Rick and Morty", "Disenchantment"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/6/6b/South_Park_logo.svg", a: "South Park", options: ["South Park", "Family Guy", "Simpsons", "Beavis and Butt-Head"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b8/Rick_and_Morty_Logo.png", a: "Rick and Morty", options: ["Futurama", "Rick and Morty", "Adventure Time", "Regular Show"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/e/e4/Batman_The_Animated_Series_Title_Card.jpg", a: "Batman: The Animated Series", options: ["Superman", "Batman: The Animated Series", "Justice League", "Spider-Man"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/d/da/The_Flintstones_title_card.jpg", a: "The Flintstones", options: ["The Jetsons", "The Flintstones", "Scooby-Doo", "Yogi Bear"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/5/5a/Popeye_the_Sailor_1933.jpg", a: "Popeye", options: ["Popeye", "Mighty Mouse", "Woody Woodpecker", "Felix the Cat"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/a/a5/Pok%C3%A9mon_Pikachu_art.png", a: "Pokemon", options: ["Digimon", "Pokemon", "Yu-Gi-Oh", "Dragon Ball"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/2/2a/TMNT_title_screen.jpg", a: "Teenage Mutant Ninja Turtles", options: ["Power Rangers", "Teenage Mutant Ninja Turtles", "Transformers", "G.I. Joe"] }
        ],
        "marvel": [
            { img: "https://upload.wikimedia.org/wikipedia/en/2/21/Web_of_Spider-Man_Vol_1_1.png", a: "Spider-Man", options: ["Iron Man", "Batman", "Spider-Man", "Captain America"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/4/47/Iron_Man_%28circa_2018%29.png", a: "Iron Man", options: ["Thor", "Iron Man", "Superman", "The Flash"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/3/3a/Thor_%28Marvel_Comics%29.png", a: "Thor", options: ["Thor", "Captain America", "Hulk", "Hawkeye"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/e/e0/Captain_America_id.jpg", a: "Captain America", options: ["Iron Man", "Captain America", "Winter Soldier", "Falcon"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/9/9f/Black_Panther_OS_Vol_1_2.png", a: "Black Panther", options: ["Black Panther", "Killmonger", "Blade", "Falcon"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/1/17/Doctor_Strange_Vol_4_1_Textless.jpg", a: "Doctor Strange", options: ["Doctor Strange", "Loki", "Scarlet Witch", "Vision"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/f/f3/Guardians_of_the_Galaxy_Vol_3_poster.jpg", a: "Guardians of the Galaxy", options: ["Avengers", "Guardians of the Galaxy", "X-Men", "Fantastic Four"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/1/17/Batman-Jim_Lee.jpg", a: "Batman", options: ["Superman", "Batman", "Green Lantern", "Aquaman"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/3/35/Supermanbis.png", a: "Superman", options: ["Batman", "Superman", "Wonder Woman", "The Flash"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/d/df/Wonder_Woman_by_Brian_Bolland.jpg", a: "Wonder Woman", options: ["Supergirl", "Wonder Woman", "Catwoman", "Batgirl"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/f/ff/Avengers_%28Marvel_Comics%29_vol_4_1.png", a: "The Avengers", options: ["Justice League", "The Avengers", "X-Men", "Defenders"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/9/9f/Deadpool_Vol_2_1_Textless.jpg", a: "Deadpool", options: ["Wolverine", "Deadpool", "Venom", "Carnage"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/8/89/Wolverine_%28Marvel_Comics%29.png", a: "Wolverine", options: ["Cyclops", "Wolverine", "Gambit", "Beast"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/6/6f/The_Flash_Vol_5_1_Textless.png", a: "The Flash", options: ["Green Lantern", "The Flash", "Cyborg", "Shazam"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/5/54/Hulk_%28comic_book_character%29.png", a: "Hulk", options: ["The Thing", "Hulk", "Abomination", "Juggernaut"] }
        ],
        "tv": [
            { img: "https://upload.wikimedia.org/wikipedia/en/d/d9/Friends_logo.svg", a: "Friends", options: ["The Office", "Friends", "How I Met Your Mother", "The Big Bang Theory"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/d/d8/Game_of_Thrones_title_card.jpg", a: "Game of Thrones", options: ["Breaking Bad", "Game of Thrones", "Stranger Things", "The Witcher"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/0/03/Breaking_Bad_title_card.png", a: "Breaking Bad", options: ["Better Call Saul", "Breaking Bad", "Ozark", "The Wire"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/3/38/Stranger_Things_season_4.jpg", a: "Stranger Things", options: ["Dark", "Stranger Things", "Outer Banks", "Riverdale"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/c/c9/The_Office_US_Logo.svg", a: "The Office", options: ["Parks and Recreation", "The Office", "Brooklyn Nine-Nine", "Modern Family"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/4/43/The_Crown_title_card.png", a: "The Crown", options: ["Downton Abbey", "The Crown", "Victoria", "Bridgerton"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b3/Peaky_Blinders_Title_Card.png", a: "Peaky Blinders", options: ["Boardwalk Empire", "Peaky Blinders", "Sons of Anarchy", "The Sopranos"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b6/Sherlock_Title_card.png", a: "Sherlock", options: ["Doctor Who", "Sherlock", "Luther", "Line of Duty"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/a/a2/Doctor_Who_2023_logo.svg", a: "Doctor Who", options: ["Star Trek", "Doctor Who", "Torchwood", "Red Dwarf"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/7/7e/The_Big_Bang_Theory_logo.svg", a: "The Big Bang Theory", options: ["Silicon Valley", "The Big Bang Theory", "IT Crowd", "Friends"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/1/1a/The_Walking_Dead_logo.svg", a: "The Walking Dead", options: ["Lost", "The Walking Dead", "Z Nation", "Fear the Walking Dead"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/e/ed/Succession_title_card.png", a: "Succession", options: ["Billions", "Succession", "Mad Men", "House of Cards"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/a/a3/The_Sopranos_title_card.png", a: "The Sopranos", options: ["The Wire", "The Sopranos", "Goodfellas", "Boardwalk Empire"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/1/12/Lost_titlecard.png", a: "Lost", options: ["Manifest", "Lost", "Leftovers", "Fringe"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b3/Bridgerton_Title_Card.png", a: "Bridgerton", options: ["Gossip Girl", "Bridgerton", "Outlander", "Reign"] }
        ],
        "movies": [
            { img: "https://upload.wikimedia.org/wikipedia/en/6/6f/Star_Wars_Episode_IV_A_New_Hope_%28poster%29.jpg", a: "Star Wars", options: ["Star Trek", "Star Wars", "Matrix", "Interstellar"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/e/e6/Jurassic_Park_poster.jpg", a: "Jurassic Park", options: ["Indiana Jones", "Jurassic Park", "Avatar", "Terminator"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/8/87/Lord_Rings_Fellowship_Ring.jpg", a: "The Lord of the Rings", options: ["Harry Potter", "The Lord of the Rings", "Hobbit", "Chronicles of Narnia"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/7/7a/Harry_Potter_and_the_Philosophers_Stone_Banner.jpg", a: "Harry Potter", options: ["Percy Jackson", "Harry Potter", "Fantastic Beasts", "Twilight"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/c/c1/The_Matrix_Poster.jpg", a: "The Matrix", options: ["Inception", "The Matrix", "Blade Runner", "Terminator"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/1/1b/Titanic_%281997_film%29_poster.png", a: "Titanic", options: ["Avatar", "Titanic", "The Notebook", "Pearl Harbor"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b6/Avatar_The_Way_of_Water_poster.jpg", a: "Avatar", options: ["Interstellar", "Avatar", "Gravity", "Dune"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/5/56/Jaws_movie_poster.jpg", a: "Jaws", options: ["Deep Blue Sea", "Jaws", "Meg", "Shark Tale"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/d/d4/Raiders_of_the_Lost_Ark_theatrical_poster.jpg", a: "Indiana Jones", options: ["National Treasure", "Indiana Jones", "Tomb Raider", "The Mummy"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/d/d2/Back_to_the_Future_part_1.jpg", a: "Back to the Future", options: ["Terminator", "Back to the Future", "Ghostbusters", "Matrix"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/f/fb/Gladiator_%282000_film_poster%29.png", a: "Gladiator", options: ["Troy", "Gladiator", "300", "Braveheart"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg", a: "Inception", options: ["Tenet", "Inception", "Shutter Island", "Memento"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/1/1c/Dark_Knight_%282008_film%29_poster.jpg", a: "The Dark Knight", options: ["Joker", "The Dark Knight", "Batman Begins", "Man of Steel"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg", a: "Interstellar", options: ["Gravity", "Interstellar", "Arrival", "Mars"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/1/18/Rocky_poster.jpg", a: "Rocky", options: ["Creed", "Rocky", "Raging Bull", "Cinderella Man"] }
        ],
        "games": [
            { img: "https://upload.wikimedia.org/wikipedia/en/0/03/Super_Mario_Bros._box.png", a: "Super Mario", options: ["Sonic", "Super Mario", "Zelda", "Pac-Man"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/5/51/Minecraft_cover.png", a: "Minecraft", options: ["Fortnite", "Minecraft", "Roblox", "Halo"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/7/73/Tetris_Main_Screen.jpg", a: "Tetris", options: ["Tetris", "Pac-Man", "Pong", "Snake"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/f/f2/Call_of_Duty_Modern_Warfare_II_Key_Art.jpg", a: "Call of Duty", options: ["Battlefield", "Call of Duty", "Halo", "Counter-Strike"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/f/f4/Pokemon_Red_Version_box.jpg", a: "Pokémon", options: ["Digimon", "Pokémon", "Monster Hunter", "Zelda"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/c/c5/Grand_Theft_Auto_V.png", a: "Grand Theft Auto", options: ["Cyberpunk", "Grand Theft Auto", "Saints Row", "Watch Dogs"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b4/The_Legend_of_Zelda_Breath_of_the_Wild_cover.jpg", a: "The Legend of Zelda", options: ["Skyrim", "The Legend of Zelda", "Witcher", "Dark Souls"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/2/22/Sonic_the_Hedgehog_1_cover.png", a: "Sonic the Hedgehog", options: ["Super Mario", "Crash Bandicoot", "Sonic the Hedgehog", "Spyro"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/3/37/Fortnite_Logo.png", a: "Fortnite", options: ["PUBG", "Apex Legends", "Fortnite", "Valorant"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/5/59/Pac-man_arcade_flyer.jpg", a: "Pac-Man", options: ["Tetris", "Pac-Man", "Galaga", "Space Invaders"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/8/80/Halo_Combat_Evolved_box_art.png", a: "Halo", options: ["Destiny", "Halo", "Doom", "Gears of War"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/f/fc/EA_Sports_FC_24_Standard_Edition_Cover.jpg", a: "FIFA / EA Sports FC", options: ["PES", "FIFA / EA Sports FC", "Rocket League", "Madden"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/3/36/Among_Us_Cover_Art.jpg", a: "Among Us", options: ["Fall Guys", "Among Us", "Roblox", "Minecraft"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/c/c6/Street_Fighter_II_The_World_Warrior_flyer.png", a: "Street Fighter", options: ["Mortal Kombat", "Tekken", "Street Fighter", "Super Smash Bros"] },
            { img: "https://upload.wikimedia.org/wikipedia/en/b/b1/Elden_Ring_Box_art.jpg", a: "Elden Ring", options: ["Dark Souls", "Elden Ring", "Skyrim", "God of War"] }
        ],
        "food": [
            { img: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Supreme_pizza.jpg", a: "Pizza", options: ["Burger", "Pizza", "Pasta", "Sushi"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/0/0b/RedDot_Burger.jpg", a: "Cheeseburger", options: ["Hotdog", "Cheeseburger", "Taco", "Sandwich"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/6/60/Sushi_platter.jpg", a: "Sushi", options: ["Sashimi", "Sushi", "Ramen", "Tempura"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Spaghetti_Bolognese_mit_Parmesan_und_Basilikum_%28Zuschnitt%29.jpg", a: "Pasta", options: ["Pizza", "Pasta", "Risotto", "Lasagna"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/7/73/001_Tacos_de_carnitas%2C_Uruapan_%28cropped%29.jpg", a: "Tacos", options: ["Burrito", "Tacos", "Quesadilla", "Fajitas"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/d/da/Strawberry_ice_cream_cone_%285076899310%29.jpg", a: "Ice Cream", options: ["Cake", "Ice Cream", "Pudding", "Donut"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/b/b2/Hot_dog_with_mustard.jpg", a: "Hot Dog", options: ["Burger", "Hot Dog", "Sandwich", "Sub"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/9/94/Salad_platter.jpg", a: "Salad", options: ["Soup", "Salad", "Wrap", "Bowl"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Chicken_tikka_masala_with_basmati_rice.jpg", a: "Curry", options: ["Curry", "Stir Fry", "Stew", "Chili"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/9/9f/Ham_sandwich.jpg", a: "Sandwich", options: ["Burger", "Panini", "Sandwich", "Wrap"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Bifteck.jpg", a: "Steak", options: ["Ribs", "Steak", "Chops", "Brisket"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Tonkotsu_Ramen.jpg", a: "Ramen", options: ["Pho", "Ramen", "Udon", "Soup"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Paella_valenciana_original.jpg", a: "Paella", options: ["Risotto", "Paella", "Jambalaya", "Pilaf"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/4/43/Pancakes_with_blueberries.jpg", a: "Pancakes", options: ["Waffles", "Pancakes", "French Toast", "Crepes"] },
            { img: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Glazed_donuts.jpg", a: "Donuts", options: ["Cookies", "Donuts", "Muffins", "Pastries"] }
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
            q: "Identify what or who is shown in the image below:",
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
        { q: "Which yellow Pokémon is the mascot of the franchise?", a: "Pikachu", options: ["Charmander", "Bulbasaur", "Pikachu", "Squirtle"] },
        { q: "In The Lion King, what is the name of Simba's strict hornbill majordomo?", a: "Zazu", options: ["Timon", "Pumbaa", "Zazu", "Rafiki"] },
        { q: "What kind of animal is Po in 'Kung Fu Panda'?", a: "Giant Panda", options: ["Red Panda", "Giant Panda", "Grizzly Bear", "Polar Bear"] }
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
        { q: "Which Britpop band sang 'Wonderwall'?", a: "Oasis", options: ["Blur", "Pulp", "Oasis", "Suede"] },
        { q: "Which singer is known as the 'King of Rock and Roll'?", a: "Elvis Presley", options: ["Chuck Berry", "Elvis Presley", "Buddy Holly", "Little Richard"] },
        { q: "Which band released the iconic album 'The Dark Side of the Moon'?", a: "Pink Floyd", options: ["Led Zeppelin", "The Who", "Pink Floyd", "Genesis"] }
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
