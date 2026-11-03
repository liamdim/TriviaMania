// BULK AI QUESTION GENERATOR WITH STABLE FALLBACK MODEL
app.post('/api/generate-bulk-trivia', async (req, res) => {
    const { categoryName, count = 20 } = req.body;
    if (!categoryName) return res.status(400).json({ error: 'Category name is required' });

    const seed = Math.floor(Math.random() * 100000);
    const prompt = `Generate exactly ${count} completely unique, high-quality trivia questions about "${categoryName}" (Random Seed ${seed}).
    Return ONLY a valid JSON array of objects with keys:
    - "question": string
    - "options": array of 4 strings (1 correct answer and 3 clever plausible distractors)
    - "answer": string (the exact correct option matching one of the options)
    No markdown formatting, no backticks, just raw JSON array.`;

    let attempts = 0;
    let success = false;
    let responseText = '';
    // Use gemini-2.5-flash as a stable fallback for bulk generation
    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.8-flash'];

    while (attempts < 3 && !success) {
        try {
            attempts++;
            const activeModel = modelsToTry[(attempts - 1) % modelsToTry.length];
            const response = await ai.models.generateContent({
                model: activeModel,
                contents: prompt,
            });
            responseText = response.text.trim();
            success = true;
        } catch (err) {
            if (attempts >= 3) {
                return res.status(500).json({ error: 'AI generation failed due to high server demand. Please try again in a moment!' });
            }
            // Wait 3 seconds before trying the next model/attempt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    try {
        if (responseText.startsWith('```json')) responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (responseText.startsWith('```')) responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim();

        const items = JSON.parse(responseText);
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(500).json({ error: 'Failed to parse generated questions format' });
        }

        let fileContent = '';
        items.forEach((item) => {
            fileContent += `#Q ${item.question}\n`;
            if (item.options && Array.isArray(item.options)) {
                item.options.forEach((opt, oIdx) => {
                    const letters = ['A', 'B', 'C', 'D'];
                    fileContent += `${letters[oIdx] || 'A'} ${opt}\n`;
                });
            }
            fileContent += `^${item.answer}\n\n`;
        });

        const categoriesDir = path.join(__dirname, 'categories');
        if (!fs.existsSync(categoriesDir)) fs.mkdirSync(categoriesDir, { recursive: true });

        const fileName = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.txt';
        fs.writeFileSync(path.join(categoriesDir, fileName), fileContent, 'utf8');

        res.json({ success: true, count: items.length, fileName });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process AI response: ' + err.message });
    }
});
