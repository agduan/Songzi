let dictionary = {};
let isLoading = true;

// Performance-friendly logging system
const DEBUG = {
    enabled: false,
    log: function(...args) {
        if (this.enabled) {
            console.log(...args);
        }
    },
    error: function(...args) {
        if (this.enabled) {
            console.error(...args);
        }
    },
    warn: function(...args) {
        if (this.enabled) {
            console.warn(...args);
        }
    }
};

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

// Cache for unknown character lookups
const unknownCharCache = {};

// Google Translate function using the free google-translate-api
async function translateText(text) {
    if (translationCache[text]) {
        return translationCache[text];
    }
    
    try {
        // Using the free google-translate-api
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
        DEBUG.error('Translation error:', error);
        return text; // Return original text if translation fails
    }
}

// Get pinyin for a single character
async function getPinyinForChar(char) {
    // Step 1: Check if character is in HSK dictionary
    if (dictionary[char] && dictionary[char].pinyin) {
        return dictionary[char].pinyin;
    }
    
    // Step 2: Try pinyin-pro library
    try {
        if (typeof pinyinPro !== 'undefined' && pinyinPro.pinyin) {
            // Use the correct API from pinyin-pro library
            const pinyinResult = pinyinPro.pinyin(char, {toneType: 'symbol'});     
            DEBUG.log(`pinyin-pro result for "${char}":`, pinyinResult);
            
            if (pinyinResult && pinyinResult.trim() !== '') {
                DEBUG.log(`Found pinyin via pinyin-pro for "${char}": "${pinyinResult}"`);
                return pinyinResult;
            }
        } else {
            DEBUG.log(`pinyin-pro library not available for "${char}"`);
        }
    } catch (error) {
        DEBUG.log(`pinyin-pro failed for "${char}":`, error);
    }
    
    // Step 3: No pinyin found
    DEBUG.log(`No pinyin found for "${char}" - pinyin.js library failed`);
    return ""; // Return empty string if pinyin.js fails
}

// Function to get translation for a single character
async function getTranslationForChar(char) {
    if (unknownCharCache[char] && unknownCharCache[char].translation) {
        return unknownCharCache[char].translation;
    }
    
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh&tl=en&dt=t&q=${encodeURIComponent(char)}`);
        const data = await response.json();
        
        if (data && data[0] && data[0][0] && data[0][0][0]) {
            const translation = data[0][0][0];
            
            // Initialize cache entry if it doesn't exist
            if (!unknownCharCache[char]) {
                unknownCharCache[char] = {};
            }
            unknownCharCache[char].translation = translation;
            
            return translation;
        }
    } catch (error) {
        DEBUG.error('Character translation error:', error);
    }
    
    return ""; // Return empty string if translation fails
}

// Function to lookup unknown character data
async function lookupUnknownChar(char) {
    if (unknownCharCache[char]) {
        return unknownCharCache[char];
    }
    
    // Initialize cache entry
    unknownCharCache[char] = {};
    
    try {
        // Get both pinyin and translation in parallel
        const [pinyin, translation] = await Promise.all([
            getPinyinForChar(char),
            getTranslationForChar(char)
        ]);
        
        unknownCharCache[char] = {
            pinyin: pinyin,
            translation: translation
        };
        
        return unknownCharCache[char];
    } catch (error) {
        console.error('Unknown character lookup error:', error);
        return { pinyin: "", translation: "" };
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
    populateCommonWords(defaultLyrics);
    
    // Auto-analyze the default lyrics
    analyzeLyrics(defaultLyrics);
}

function clearOutput() {
    container.innerHTML = "";
    translationContainer.innerHTML = "";
}

function populateCommonWords(analyzedText = '') {
    const commonWords = {};
    
    // Get characters that are actually in the analyzed text, grouped by HSK level
    for (let level = 1; level <= 6; level++) {
        commonWords[level] = [];
        
        // Find all unique characters in the text that belong to this HSK level
        const charsInText = new Set(analyzedText.split(''));
        
        for (const char of charsInText) {
            const data = dictionary[char];
            if (data && data.hsk === level) {
                commonWords[level].push({ char, ...data });
            }
        }
        
        // Sort by frequency (if available) or alphabetically
        commonWords[level].sort((a, b) => {
            // If both have frequency data, sort by frequency (lower number = more common)
            if (a.frequency && b.frequency) {
                return a.frequency - b.frequency;
            }
            // Otherwise sort alphabetically by character
            return a.char.localeCompare(b.char);
        });
        
        // Limit to 4 characters per level
        commonWords[level] = commonWords[level].slice(0, 4);
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
    DEBUG.log(`Analyzing text: "${text}"`);
    DEBUG.log(`Dictionary has ${Object.keys(dictionary).length} characters`);
    
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
        
        // Create a container for this Chinese line with speaker icon
        const chineseLineDiv = document.createElement("div");
        chineseLineDiv.className = "chinese-line";
        
        // Add speaker icon for this line
        const speakerIcon = document.createElement("span");
        speakerIcon.className = "speaker-icon";
        speakerIcon.setAttribute("data-text", line.trim());
        
        chineseLineDiv.appendChild(speakerIcon);
        
        // Process each character in the line
        for (const char of line) {
            if (char === ' ') {
                // Add space
                const space = document.createElement("span");
                space.innerHTML = "&nbsp;";
                chineseLineDiv.appendChild(space);
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
                DEBUG.log(`Unknown character: "${char}"`);
            }
            
            const div = document.createElement("div");
            div.className = `char-block hsk-${entry.hsk}`;
            
            // For unknown characters, we'll load pinyin asynchronously
            if (entry.hsk === "unknown") {
                div.innerHTML = `
                    <div class="pinyin">...</div>
                    <div class="character">${char}</div>
                `;
                
                // Load pinyin for unknown character using hybrid lookup
                getPinyinForChar(char).then(pinyin => {
                    const pinyinDiv = div.querySelector('.pinyin');
                    if (pinyinDiv) {
                        pinyinDiv.textContent = pinyin || '?';
                    }
                }).catch(error => {
                    console.error(`Error getting pinyin for "${char}":`, error);
                    const pinyinDiv = div.querySelector('.pinyin');
                    if (pinyinDiv) {
                        pinyinDiv.textContent = '?';
                    }
                });
            } else {
                div.innerHTML = `
                    <div class="pinyin">${entry.pinyin}</div>
                    <div class="character">${char}</div>
                `;
            }
            
            // Add hover events for tooltip
            div.addEventListener('mouseenter', async () => {
                if (entry.hsk !== "unknown") {
                    // Known HSK character
                    tooltip.innerHTML = `
                        <strong>${char}</strong> (HSK ${entry.hsk})<br>
                        <em>${entry.pinyin}</em><br>
                        ${entry.definition}
                    `;
                    tooltip.classList.add('show');
                } else {
                    // Unknown character - lookup pinyin and translation
                    tooltip.innerHTML = `
                        <strong>${char}</strong> (Unknown)<br>
                        <em>Loading...</em><br>
                        Loading translation...
                    `;
                    tooltip.classList.add('show');
                    
                    try {
                        // Get both pinyin and translation in parallel
                        const [pinyin, translation] = await Promise.all([
                            getPinyinForChar(char),
                            getTranslationForChar(char)
                        ]);
                        
                        tooltip.innerHTML = `
                            <strong>${char}</strong><br>
                            <em>${pinyin || 'N/A'}</em><br>
                            ${translation || 'No translation available'}
                        `;
                    } catch (error) {
                        DEBUG.error('Error looking up unknown character:', error);
                        tooltip.innerHTML = `
                            <strong>${char}</strong><br>
                            <em>Error loading pinyin</em><br>
                            Error loading translation
                        `;
                    }
                }
            });
            
            div.addEventListener('mouseleave', () => {
                tooltip.classList.remove('show');
            });
            
            chineseLineDiv.appendChild(div);
        }
        
        // Add the complete Chinese line to the container
        container.appendChild(chineseLineDiv);
    }
    
    // Second pass: Translate all lines and display them aligned
    DEBUG.log("Starting translation of all lines...");
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
        
        DEBUG.log("Translation completed!");
        
        // Add event listeners to speaker icons after translations are displayed
        addSpeakerEventListeners();
    } catch (error) {
        DEBUG.error("Error during translation:", error);
        // Fallback: show error message
        translationContainer.innerHTML = "<p>Translation failed. Please try again.</p>";
    }
    
    // Update the HSK sidebar to show only characters from this text
    populateCommonWords(text);
}

// Audio functionality using Web Speech API
function speakText(text, language = 'zh-CN') {
    // Check if speech synthesis is supported
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported in this browser');
        return;
    }
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    // Create speech utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.8; // Slower for Chinese pronunciation
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Find a suitable voice for Chinese
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('zh') && voice.default
    ) || voices.find(voice => voice.lang.startsWith('zh'));
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    return utterance;
}

function addSpeakerEventListeners() {
    const speakerIcons = document.querySelectorAll('.speaker-icon');
    
    speakerIcons.forEach(icon => {
        icon.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const text = this.getAttribute('data-text');
            if (!text) return;
            
            // Add playing class for visual feedback
            this.classList.add('playing');
            
            // Create and play speech
            const utterance = speakText(text);
            if (utterance) {
                utterance.onend = () => {
                    this.classList.remove('playing');
                };
                utterance.onerror = () => {
                    this.classList.remove('playing');
                    console.error('Speech synthesis error');
                };
                
                window.speechSynthesis.speak(utterance);
            } else {
                this.classList.remove('playing');
            }
        });
    });
}

// Initialize
loadHSKDefinitions();

// Set default lyrics
const defaultLyrics1 = `你问我爱你有多深
我爱你有几分
我的情也真 我的爱也真
月亮代表我的心

你问我爱你有多深
我爱你有几分
我的情不移 我的爱不变
月亮代表我的心

测试字符：学习中文很有趣`;

const defaultLyrics = `雪花飘飘 北风萧萧
天地 一片苍茫
一剪寒梅 傲立雪中
只为 伊人飘香
爱我所爱 无怨无悔
此情 长留心间`

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

