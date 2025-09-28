let dictionary = {};
let isLoading = true;

const input = document.getElementById("lyrics-input");
const button = document.getElementById("analyze-btn");
const container = document.getElementById("lyrics-output");
const translationContainer = document.getElementById("translation-output");
const commonWordsContainer = document.getElementById("common-words");
const tooltip = document.getElementById("tooltip");

// Translation cache to avoid repeated API calls
const translationCache = {
    "你问我爱你有多深": "You ask me how deep my love is for you",
    "我爱你有几分": "I love you how much", 
    "我的情也真 我的爱也真": "My feelings are true, my love is true",
    "月亮代表我的心": "The moon represents my heart",
    "我的情不移 我的爱不变": "My feelings don't change, my love doesn't change"
};

// Google Translate function using the free google-translate-api
async function translateText(text) {
    if (translationCache[text]) {
        return translationCache[text];
    }
    
    try {
        // Using the free google-translate-api (no API key needed)
        const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh&tl=en&dt=t&q=' + encodeURIComponent(text));
        const data = await response.json();
        
        if (data && data[0] && data[0][0] && data[0][0][0]) {
            const translatedText = data[0][0][0];
            
            // Cache the translation
            translationCache[text] = translatedText;
            return translatedText;
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Translation error:', error);
        return text; // Return original text if translation fails
    }
}

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
    translationContainer.innerHTML = "";
}

function populateCommonWords() {
    const commonWords = {};
    
    // Get first 10 words from each HSK level
    for (let level = 1; level <= 6; level++) {
        commonWords[level] = [];
        let count = 0;
        
        for (const [char, data] of Object.entries(dictionary)) {
            if (data.hsk === level && count < 4) {
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
                wordDiv.className = 'common-word';
                wordDiv.innerHTML = `
                    <span class="word-char hsk-${level}">${word.char}</span>
                    <span class="word-info">${word.pinyin} - ${word.definition}</span>
                `;
                wordsDiv.appendChild(wordDiv);
            });
            
            levelDiv.appendChild(wordsDiv);
            commonWordsContainer.appendChild(levelDiv);
        }
    }
}

async function analyzeLyrics(text) {
    if (isLoading) {
        container.innerHTML = "<p>Loading definitions...</p>";
        return;
    }
    
    clearOutput();
    console.log(`Analyzing text: "${text}"`);
    console.log(`Dictionary has ${Object.keys(dictionary).length} characters`);
    
    const lines = text.split('\n');
    
    // First pass: Display all Chinese lyrics with character analysis
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        if (line.trim() === '') {
            // Add empty line
            const br = document.createElement("br");
            container.appendChild(br);
            continue;
        }
        
        // Process each character in the line
        for (const char of line) {
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
            
            // Add hover events for tooltip
            div.addEventListener('mouseenter', () => {
                if (entry.hsk !== "unknown") {
                    tooltip.innerHTML = `
                        <strong>${char}</strong> (HSK ${entry.hsk})<br>
                        <em>${entry.pinyin}</em><br>
                        ${entry.definition}
                    `;
                    tooltip.classList.add('show');
                }
            });
            
            div.addEventListener('mouseleave', () => {
                tooltip.classList.remove('show');
            });
            
            container.appendChild(div);
        }
        
        // Add line break if not the last line
        if (lineIndex < lines.length - 1) {
            const br = document.createElement("br");
            container.appendChild(br);
        }
    }
    
    // Second pass: Translate all lines and display them aligned
    console.log("Starting translation of all lines...");
    const translationPromises = lines.map(line => 
        line.trim() === '' ? Promise.resolve('') : translateText(line.trim())
    );
    
    try {
        const translations = await Promise.all(translationPromises);
        
        // Display translations aligned with Chinese lines
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const translation = translations[lineIndex];
            
            if (translation === '') {
                // Add empty line for empty Chinese line
                const translationBr = document.createElement("br");
                translationContainer.appendChild(translationBr);
            } else {
                const translationDiv = document.createElement("div");
                translationDiv.innerHTML = translation;
                translationContainer.appendChild(translationDiv);
            }
            
            // Add line break if not the last line
            if (lineIndex < lines.length - 1) {
                const translationBr = document.createElement("br");
                translationContainer.appendChild(translationBr);
            }
        }
        
        console.log("Translation completed!");
    } catch (error) {
        console.error("Error during translation:", error);
        // Fallback: show error message
        translationContainer.innerHTML = "<p>Translation failed. Please try again.</p>";
    }
}

// Initialize
loadHSKDefinitions();

// Set default lyrics
const defaultLyrics = `你问我爱你有多深
我爱你有几分
我的情也真 我的爱也真
月亮代表我的心

你问我爱你有多深
我爱你有几分
我的情不移 我的爱不变
月亮代表我的心`;

// Set default text when page loads
document.addEventListener('DOMContentLoaded', () => {
    input.value = defaultLyrics;
});


button.addEventListener("click", async () => {
    const text = input.value.trim();
    if (text === "") {
        alert("Please paste some Chinese lyrics.");
        return;
    }
    await analyzeLyrics(text);
});
