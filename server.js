app.get('/api/questions/:category', (req, res) => {
    let category = req.params.category.toLowerCase().trim();
    const count = parseInt(req.query.count) || 10;
    
    // Check direct path first, then check common variations (hyphens vs underscores)
    let filePath = path.join(__dirname, 'categories', `${category}.txt`);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'categories', `${category.replace(/-/g, '_')}.txt`);
    }
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'categories', `${category.replace(/_/g, '-')}.txt`);
    }

    if (!fs.existsSync(filePath)) {
        console.log(`Warning: Category file not found for "${category}". Falling back to general pool.`);
        const pool = backupQuestionBanks[category] || backupQuestionBanks["general"];
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return res.json(shuffled.slice(0, count));
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            const pool = backupQuestionBanks[category] || backupQuestionBanks["general"];
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            return res.json(shuffled.slice(0, count));
        }

        const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let questions = [];

        for (let i = 0; i < lines.length; i++) {
            if (i + 4 < lines.length) {
                let possibleQ = {
                    q: lines[i],
                    options: [lines[i+1], lines[i+2], lines[i+3], lines[i+4]],
                    a: lines[i+1]
                };
                if (possibleQ.q && possibleQ.options.length === 4) {
                    questions.push(possibleQ);
                    i += 4;
                }
            }
        }

        if (questions.length === 0) {
            questions = backupQuestionBanks["general"];
        }

        const shuffled = questions.sort(() => Math.random() - 0.5);
        res.json(shuffled.slice(0, count));
    });
});
