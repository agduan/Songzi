let dictionary = {};
let isLoading = true;

const input = document.getElementById("lyrics-input");
const button = document.getElementById("analyze-btn");
const container = document.getElementById("lyrics-output");
const commonWordsContainer = document.getElementById("common-words");

// Load HSK definitions
async function loadHSKDefinitions() {
    const hskLevels = [1, 2, 3, 4, 5, 6];
    
    for (const level of hskLevels) {
        try {
            console.log(`Loading HSK level ${level}...`);
            const response = await fetch(`definitions/HSK Official With Definitions 2012 L${level} freqorder.txt`);
            
            if (!response.ok) {
                console.error(`Failed to load HSK level ${level}: ${response.status}`);
                continue;
            }
            
            const text = await response.text();
            const lines = text.split('\n');
            console.log(`HSK level ${level}: ${lines.length} lines`);
            
            for (const line of lines) {
                if (line.trim() === '') continue;
                const parts = line.split('\t');
                if (parts.length >= 5) {
                    const character = parts[0];
                    const pinyinWithNumbers = parts[2];
                    const pinyinWithAccents = parts[3];
                    const definition = parts[4];
                    
                    dictionary[character] = {
                        pinyin: pinyinWithAccents,
                        pinyinClean: pinyinWithNumbers,
                        definition: definition,
                        hsk: level
                    };
                }
            }
        } catch (error) {
            console.error(`Error loading HSK level ${level}:`, error);
        }
    }
    
    isLoading = false;
    console.log(`Loaded ${Object.keys(dictionary).length} characters`);
    console.log('Sample characters:', Object.keys(dictionary).slice(0, 10));
    populateCommonWords();
    
    // Auto-analyze the default lyrics
    analyzeLyrics(defaultLyrics);
}

function clearOutput() {
    container.innerHTML = "";
}

function populateCommonWords() {
    const commonWords = {};
    
    // Get first 10 words from each HSK level
    for (let level = 1; level <= 6; level++) {
        commonWords[level] = [];
        let count = 0;
        
        for (const [char, data] of Object.entries(dictionary)) {
            if (data.hsk === level && count < 10) {
                commonWords[level].push({ char, ...data });
                count++;
            }
        }
    }
    
    // Display in sidebar
    commonWordsContainer.innerHTML = '';
    
    for (let level = 1; level <= 6; level++) {
        if (commonWords[level].length > 0) {
            const levelDiv = document.createElement('div');
            levelDiv.className = 'hsk-level-section';
            levelDiv.innerHTML = `<h4>HSK Level ${level}</h4>`;
            
            const wordsDiv = document.createElement('div');
            wordsDiv.className = 'hsk-words';
            
            commonWords[level].forEach(word => {
                const wordDiv = document.createElement('div');
                wordDiv.className = `common-word hsk-${level}`;
                wordDiv.innerHTML = `
                    <span class="word-char">${word.char}</span>
                    <span class="word-pinyin">${word.pinyin}</span>
                    <span class="word-def">${word.definition}</span>
                `;
                wordsDiv.appendChild(wordDiv);
            });
            
            levelDiv.appendChild(wordsDiv);
            commonWordsContainer.appendChild(levelDiv);
        }
    }
}

function analyzeLyrics(text) {
    if (isLoading) {
        container.innerHTML = "<p>Loading definitions...</p>";
        return;
    }
    
    clearOutput();
    console.log(`Analyzing text: "${text}"`);
    console.log(`Dictionary has ${Object.keys(dictionary).length} characters`);
    
    for (const char of text) {
        if (char === '\n') {
            // Add line break
            const br = document.createElement("br");
            container.appendChild(br);
            continue;
        }
        
        if (char === ' ') {
            // Add space
            const space = document.createElement("span");
            space.innerHTML = "&nbsp;";
            container.appendChild(space);
            continue;
        }
        
        if (char.trim() === "") continue;
        
        const entry = dictionary[char] || { 
            pinyin: "", 
            pinyinClean: "", 
            definition: "", 
            hsk: "unknown" 
        };
        
        if (entry.hsk === "unknown") {
            console.log(`Unknown character: "${char}"`);
        }
        
        const div = document.createElement("div");
        div.className = `char-block hsk-${entry.hsk}`;
        div.innerHTML = `
            <div class="pinyin">${entry.pinyin}</div>
            <div class="character">${char}</div>
        `;
        container.appendChild(div);
    }
}

// Initialize
loadHSKDefinitions();

// Set default lyrics
const defaultLyrics = `董小姐，你熄灭了烟 说起从前
你说前半生就这样吧 还有明天
董小姐，你可知道我说够了再见
在五月的早晨 终于丢失了睡眠`;

// Set default text when page loads
document.addEventListener('DOMContentLoaded', () => {
    input.value = defaultLyrics;
});


button.addEventListener("click", () => {
    const text = input.value.trim();
    if (text === "") {
        alert("Please paste some Chinese lyrics.");
        return;
    }
    analyzeLyrics(text);
});
