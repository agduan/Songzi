// Edit to user input
const lyrics = "你好吗";

// Dictionary of characters to pinyin, HSK level
const dictionary = {
    "你": { pinyin: "nǐ", hsk: 1 },
    "好": { pinyin: "hǎo", hsk: 1 },
    "吗": { pinyin: "ma", hsk: 1 },
};

const container = document.getElementById("lyrics-output");

for (const char of lyrics) {
    const entry = dictionary[char] || { pinyin: "", hsk: "unknown" };
    const div = document.createElement("div");
    div.className = `char-block hsk-${entry.hsk}`;
    div.innerHTML = `<div>${char}</div><div>${entry.pinyin}</div>`;
    container.appendChild(div);
}
