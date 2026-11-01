app.get('/api/questions/:category', (req, res) => {
    let category = req.params.category.toLowerCase().trim();
    const count = parseInt(req.query.count) || 10;
    
    let filePath = null;
    const possibleNames = [`${category}.txt`, `${category}`, `${category.replace(/-/g, '_')}.txt`, `${category.replace(/-/g, '_')}`];
    
    for (let name of possibleNames) {
        let testPath = path.join(__dirname, 'categories', name);
        if (fs.existsSync(testPath) && fs.lstatSync(testPath).isFile()) {
            filePath = testPath;
            break;
        }
    }

    if (!filePath) {
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

        const lines = data.split('\n').map(l => l.trim());
        let questions = [];
        let currentQ = null;
        let currentAns = null;
        let currentOpts = [];

        // Parse #Q / ^ format
        for (let line of lines) {
            if (line.startsWith('#Q ')) {
                if (currentQ && currentAns && currentOpts.length >= 2) {
                    questions.push({ q: currentQ, a: currentAns, options: [...currentOpts] });
                }
                currentQ = line.replace('#Q ', '').trim();
                currentAns = null;
                currentOpts = [];
            } else if (line.startsWith('^ ')) {
                currentAns = line.replace('^ ', '').trim();
                if (!currentOpts.includes(currentAns)) currentOpts.push(currentAns);
            } else if (/^[A-D]\s/.test(line)) {
                let optVal = line.replace(/^[A-D]\s/, '').trim();
                if (!currentOpts.includes(optVal)) currentOpts.push(optVal);
            }
        }
        // Push last question
        if (currentQ && currentAns && currentOpts.length >= 2) {
            questions.push({ q: currentQ, a: currentAns, options: [...currentOpts] });
        }

        // Fallback if parser found nothing
        if (questions.length === 0) {
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
        }

        if (questions.length === 0) {
            questions = backupQuestionBanks["general"];
        }

        const shuffled = questions.sort(() => Math.random() - 0.5);
        res.json(shuffled.slice(0, count));
    });
});
