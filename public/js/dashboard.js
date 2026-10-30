// --- PICTURE ROUND GENERATOR ---
function addPictureRound() {
    const select = document.getElementById('pictureGenreSelect');
    const genreKey = select ? select.value : "landmarks";
    const genreName = select ? select.options[select.selectedIndex].text : "Picture Round";
    const countSelect = document.getElementById('questionCountSelect');
    const targetCount = countSelect ? parseInt(countSelect.value) || 10 : 10;

    const pictureLibraries = {
        "landmarks": [
            { img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34", a: "Eiffel Tower", options: ["Big Ben", "Eiffel Tower", "Colosseum", "Leaning Tower"] },
            { img: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad", a: "Big Ben", options: ["Big Ben", "Tower Bridge", "Statue of Liberty", "Sydney Opera House"] },
            { img: "https://images.unsplash.com/photo-1525874684015-58379d421a52", a: "Colosseum", options: ["Parthenon", "Colosseum", "Pantheon", "St. Peter's Basilica"] },
            { img: "https://images.unsplash.com/photo-1534447677768-be436bb09401", a: "Taj Mahal", options: ["Taj Mahal", "Angkor Wat", "Burj Khalifa", "Petra"] },
            { img: "https://images.unsplash.com/photo-1548013146-72479768bada", a: "Taj Mahal", options: ["Taj Mahal", "Red Fort", "Qutub Minar", "Hawa Mahal"] },
            { img: "https://images.unsplash.com/photo-1485738422979-f5c462def9f7", a: "Statue of Liberty", options: ["Empire State", "Statue of Liberty", "Space Needle", "Golden Gate Bridge"] },
            { img: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29", a: "Golden Gate Bridge", options: ["Brooklyn Bridge", "Tower Bridge", "Golden Gate Bridge", "Sydney Harbour Bridge"] },
            { img: "https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3", a: "Sydney Opera House", options: ["Sydney Opera House", "Wembley Stadium", "Tokyo Tower", "Marina Bay Sands"] }
        ],
        "animals": [
            { img: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7", a: "Panda", options: ["Grizzly Bear", "Panda", "Koala", "Polar Bear"] },
            { img: "https://images.unsplash.com/photo-1534188752442-f952805345d2", a: "Tiger", options: ["Lion", "Cheetah", "Tiger", "Leopard"] },
            { img: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46", a: "Elephant", options: ["Rhino", "Hippo", "Elephant", "Mammoth"] },
            { img: "https://images.unsplash.com/photo-1534567153574-2b12153a87f0", a: "Giraffe", options: ["Zebra", "Giraffe", "Kangaroo", "Ostrich"] },
            { img: "https://images.unsplash.com/photo-1517849845537-4d257902454a", a: "Dog", options: ["Cat", "Dog", "Fox", "Wolf"] },
            { img: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba", a: "Cat", options: ["Dog", "Cat", "Rabbit", "Hamster"] },
            { img: "https://images.unsplash.com/photo-1474511320723-9a56873867b5", a: "Fox", options: ["Wolf", "Fox", "Jackal", "Coyote"] },
            { img: "https://images.unsplash.com/photo-1456926631375-92c8ce872def", a: "Penguin", options: ["Puffin", "Penguin", "Seal", "Polar Bear"] }
        ]
    };

    let pool = pictureLibraries[genreKey] || pictureLibraries["landmarks"];
    const shuffled = [...pool].sort(function() { return Math.random() - 0.5; });
    const questions = shuffled.slice(0, targetCount).map(function(item) {
        return {
            q: "Identify what or who is shown in the image below:",
            image: item.img, // Explicit image property
            a: item.a,
            options: [...item.options].sort(function() { return Math.random() - 0.5; }),
            type: 'picture'
        };
    });

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
