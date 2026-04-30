import { MOD_ID } from './settings.js';
import { AIProviders } from './ai-providers.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ЧИСТКИ ТЕКСТА ---
function cleanJournalText(htmlContent) {
    if (!htmlContent) return "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;

    const gmSelectors = [
        ".fvtt-narrative", 
        ".narrative",
        ".notable",       
        ".gm-only",
        ".secret",
        "section.fvtt-relative" 
    ];

    gmSelectors.forEach(sel => {
        const elements = tempDiv.querySelectorAll(sel);
        elements.forEach(el => el.remove());
    });
    
    const asides = tempDiv.querySelectorAll("aside");
    asides.forEach(el => el.remove());

    let text = tempDiv.innerText || tempDiv.textContent || "";
    text = text.replace(/\s+/g, " ").trim();
    
    return text.substring(0, 3500); 
}
// ---------------------------------------------

export async function callGemini(userInput, npcData, contextOptions = {}, history = [], apiKeyOverride = null) {
    // Используем централизованный метод из AIProviders
    return await AIProviders.callAI(userInput, npcData, contextOptions, history);
}

// Сохраняем оригинальную логику для совместимости
export async function callGeminiOriginal(userInput, npcData, contextOptions = {}, history = [], apiKeyOverride = null) {
    
    const apiKey = apiKeyOverride?.trim() || game.settings.get(MOD_ID, "apiKey")?.trim();
    if (!apiKey) return "[Система: Нет API ключа]";

    let modelsString = game.settings.get(MOD_ID, "aiModels");
    let models = modelsString.split(',').map(m => m.trim()).filter(m => m.length > 0);

    // --- 1. ЛОГИКА ХАРАКТЕРА ---
    const toneVal = game.settings.get(MOD_ID, "tone");
    const intVal = game.settings.get(MOD_ID, "intelligence");
    const eloqVal = game.settings.get(MOD_ID, "eloquence");
    
    let basePersonality = "";
    if (toneVal > 70) basePersonality += "Tone: Friendly and Polite. ";
    else if (toneVal < 30) basePersonality += "Tone: Rude and Aggressive. ";
    
    if (intVal > 70) basePersonality += "Intellect: High (use complex words). ";
    else if (intVal < 30) basePersonality += "Intellect: Low (speak simply). ";
    
    if (eloqVal > 70) basePersonality += "Style: Eloquent. ";
    else if (eloqVal < 30) basePersonality += "Style: Blunt. ";

    const rep = npcData.reputation ?? 50;
    let attitudeInstruction = "";
    let emoteInstruction = ""; 

    if (rep <= 15) {
        attitudeInstruction = "ATTITUDE: HATEFUL. Ignore politeness. Be extremely hostile. Insult the player.";
        emoteInstruction = "Action style: Frequent displays of disgust (*spits*, *turns away*, *glares*). Speak less, act more.";
    } else if (rep <= 35) {
        attitudeInstruction = "ATTITUDE: SUSPICIOUS/COLD. Be reluctant to help. Short answers.";
        emoteInstruction = "Action style: Guarded body language (*crosses arms*, *narrows eyes*).";
    } else if (rep <= 60) {
        attitudeInstruction = "ATTITUDE: NEUTRAL. Professional/Business-like.";
        emoteInstruction = "Action style: Formal gestures (*nods*, *points*).";
    } else if (rep <= 85) {
        attitudeInstruction = "ATTITUDE: FRIENDLY. Warm and helpful.";
        emoteInstruction = "Action style: Warm gestures (*smiles*, *leans in*, *laughs*).";
    } else {
        attitudeInstruction = "ATTITUDE: ADMIRATION. Treat player as a hero/best friend.";
        emoteInstruction = "Action style: Enthusiastic gestures (*beams*, *claps*, *bows low*).";
    }
    
    let behaviorInstruction = `BASE PERSONALITY: ${basePersonality}\nCURRENT ATTITUDE: ${attitudeInstruction}\nEMOTES: ${emoteInstruction}`;

    const langInfo = contextOptions.languageInfo;
    if (langInfo && !langInfo.hasShared) {
        behaviorInstruction += `
        CRITICAL: Player DOES NOT understand your language (${langInfo.npcLangs}).
        Speak ONLY in alien sounds (phonetic) and describe gestures *like this* in Russian.
        Example: "*Рычит.* Грах-ту!"
        DO NOT speak normal language.
        `;
    } else {
        behaviorInstruction += " Speak normally (Russian).";
    }
    
    if (contextOptions.isWhisper) behaviorInstruction += " (Context: You are whispering).";
    if (contextOptions.socialStatus?.insightSuccess) behaviorInstruction += " Player KNOWS your secret. Reveal a hint.";
    if (npcData.isMerchant) behaviorInstruction += " You are a MERCHANT. Mention wares if appropriate.";

    if (userInput.startsWith("[SYSTEM EVENT]")) {
        behaviorInstruction += `
        CURRENT EVENT: ${userInput}.
        React immediately to this event.
        `;
    }

    // --- 4. СЮЖЕТНЫЙ КОНТЕКСТ ---
    let questContext = "";
    const tokenDoc = canvas.tokens.placeables.find(t => t.name === npcData.name && (t.actor?.type === "npc" || t.actor?.type === "mook"))?.document;

    if (tokenDoc) {
        const mainArcUuid = game.settings.get(MOD_ID, "worldLoreJournal");
        if (mainArcUuid) {
            const doc = fromUuidSync(mainArcUuid);
            if (doc) {
                let rawText = "";
                if (doc.documentName === "JournalEntryPage") {
                     rawText = doc.text.content;
                } else if (doc.pages && doc.pages.size > 0) {
                     rawText = doc.pages.contents[0].text.content; 
                }
                const cleanText = cleanJournalText(rawText);
                if (cleanText) questContext += `\n[WORLD BACKGROUND]: ${cleanText}\n`;
            }
        }

        const isQuestActive = tokenDoc.getFlag(MOD_ID, 'isQuestActive') ?? true;
        if (isQuestActive) {
            const questUuid = tokenDoc.getFlag(MOD_ID, 'questJournalUuid');
            if (questUuid) {
                const doc = fromUuidSync(questUuid);
                if (doc) {
                    let rawText = "";
                    if (doc.documentName === "JournalEntryPage") {
                        rawText = doc.text.content;
                    } else if (doc.pages && doc.pages.size > 0) {
                        rawText = doc.pages.contents[0].text.content;
                    }
                    const cleanText = cleanJournalText(rawText);
                    if (cleanText) {
                        questContext += `\n[CURRENT QUEST / MOTIVATION]: ${cleanText}\n`;
                        questContext += `INSTRUCTION: If this text mentions you ('${npcData.name}'), follow your specific role. If not, treat it as local news/rumors.\n`;
                    }
                }
            }
        }
    }
    
    if (questContext) behaviorInstruction += questContext;

    const combatInfo = npcData.combatStats ? `
    Combat Stats (FOR ANALYSIS ONLY):
    HP: ${npcData.combatStats.hp}
    AC: ${npcData.combatStats.ac}
    Type: ${npcData.combatStats.type}
    Resistances: ${npcData.combatStats.res}
    Immunities: ${npcData.combatStats.imm}
    Vulnerabilities: ${npcData.combatStats.vuln}
    ` : "";

    const systemInstruction = `
    Roleplay as ${npcData.name}.
    Bio: ${npcData.bio}
    Secret: ${npcData.secret}
    Inventory: ${npcData.inventory}
    Wallet: ${npcData.money}
    Stats: ${npcData.stats}
    ${combatInfo}
    
    INSTRUCTIONS: ${behaviorInstruction}

    [SENTIMENT ANALYSIS]: 
    Determine if the player's LAST message is rude/hostile or nice/complimentary.
    - If Rude/Hostile -> Start response with [OPINION: -1]
    - If Nice/Flattering -> Start response with [OPINION: +1]
    - If Neutral -> Do NOT add any tag.
    
    [FORMATTING]:
    - Use *asterisks* for actions/emotes.
    - You CAN respond with ONLY an action if the situation calls for silence or intense emotion.
    - Keep it concise (max 3 sentences) unless explaining a quest.
    `;

    const apiHistory = history
        .filter(h => !h.isSystem && h.text)
        .map(h => ({
            role: h.speaker === npcData.name ? "model" : "user",
            parts: [{ text: h.text }]
        }));

    const contents = [
        { role: "user", parts: [{ text: `SYSTEM: ${systemInstruction}` }] },
        ...apiHistory,
        { role: "user", parts: [{ text: userInput }] }
    ];

    // [DEBUG & OPTIMIZATION]
    console.log("Blue Man AI | Starting Model Loop:", models);
    
    for (let modelName of models) {
        console.time(`AI Request (${modelName})`); // Засекаем время
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            // 🔥 ИСПРАВЛЕНИЕ ЗДЕСЬ: Увеличили таймаут до 30 секунд (30000 мс)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: contents }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            console.timeEnd(`AI Request (${modelName})`); // Останавливаем таймер

            if (response.status === 429) {
                console.warn(`Blue Man AI | ${modelName} Rate Limit (429). Skipping...`);
                await sleep(500); 
                continue; 
            }

            if (response.status === 404) {
                 console.warn(`Blue Man AI | Model ${modelName} not found (404). Skipping.`);
                 continue;
            }

            if (!response.ok) {
                 console.error(`Blue Man AI | API Error (${modelName}):`, await response.text());
                 continue;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                console.log(`Blue Man AI | Success with ${modelName}`);
                return text;
            }

        } catch (e) {
            console.timeEnd(`AI Request (${modelName})`);
            console.error(`Blue Man AI | Connection Error (${modelName}):`, e);
        }
    }
    
    return "...(ИИ молчит)...";
}