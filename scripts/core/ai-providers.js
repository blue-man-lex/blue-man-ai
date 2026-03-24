import { MOD_ID } from './settings.js';

export class AIProviders {
    
    // 🔥 КАШ УДАЛЕН ДЛЯ РЕШЕНИЯ ПРОБЛЕМ С RATE LIMIT
    
    static getCachedSetting(key) {
        // 🛡️ Безопасная проверка game
        if (!game?.settings) {
            console.warn(`Blue Man AI | Game not ready, cannot get setting: ${key}`);
            return null;
        }
        
        // 🔥 ОТКЛЮЧАЕМ КЭШ ДЛЯ РЕШЕНИЯ ПРОБЛЕМЫ С RATE LIMIT
        // Берем настройки напрямую, без кэширования
        return game.settings.get(MOD_ID, key);
    }

    // 🆕 Метод очистки кеша (для совместимости с UI)
    static clearCache() {
        console.log("Blue Man AI | 🧹 Cache cleared (cache disabled by design)");
        // Ничего не делаем - кеш отключен
    }

    // 🆕 Получение API ключа для провайдера
    static getApiKey(provider) {
        const keyMap = {
            'gemini': 'apiKey',
            'deepseek': 'deepseekApiKey',
            'gpt': 'gptApiKey',
            'yandex': 'yandexIamToken',
            'ollama': null, // Ollama не требует API ключа
            'custom': 'customApiKey'
        };
        
        const settingKey = keyMap[provider];
        if (!settingKey) return null;
        
        return this.getCachedSetting(settingKey);
    }

    // 🆕 Получение Ambient API ключа для провайдера
    static getAmbientApiKey(provider) {
        const ambientKeyMap = {
            'gemini': 'geminiAmbientKey',
            'deepseek': 'deepseekAmbientKey',
            'gpt': 'gptAmbientKey',
            'yandex': 'yandexAmbientIamToken',
            'custom': 'customAmbientApiKey'
        };
        
        const settingKey = ambientKeyMap[provider];
        if (!settingKey) return null;
        
        return this.getCachedSetting(settingKey);
    }

    // 🆕 Получение моделей для провайдера
    static getModel(provider) {
        const modelMap = {
            'gemini': 'aiModels',
            'deepseek': 'deepseekModels',
            'gpt': 'gptModels',
            'yandex': 'yandexModels',
            'ollama': 'ollamaModels',
            'custom': 'customModels'
        };
        
        const settingKey = modelMap[provider];
        if (!settingKey) return null;
        
        return this.getCachedSetting(settingKey);
    }

    // 🆕 Получение URL для Custom провайдера
    static getCustomUrl() {
        return this.getCachedSetting('customApiUrl');
    }

    // 🆕 Получение настроек для Custom провайдера
    static getCustomSettings() {
        return {
            url: this.getCustomUrl(),
            model: this.getModel('custom'),
            apiKey: this.getApiKey('custom'),
            ambientApiKey: this.getAmbientApiKey('custom')
        };
    }

    // 🔄 Централизованный метод вызова AI
    static async callAI(userInput, npcData, contextOptions = {}, history = []) {
        // Получаем активного провайдера
        const selectedProvider = this.getCachedSetting('aiProvider') || 'gemini';
        const fallbackEnabled = this.getCachedSetting('fallbackEnabled') ?? true;
        
        console.log(`Blue Man AI | 🤖 Using provider: ${selectedProvider}`);
        console.log(`Blue Man AI | 🤖 NPC: ${npcData?.name || 'Unknown'}`);
        console.log(`Blue Man AI | 🔄 Fallback enabled: ${fallbackEnabled}`);
        
        const startTime = Date.now();
        
        try {
            const response = await this.callProvider(selectedProvider, userInput, npcData, contextOptions, history);
            
            const duration = Date.now() - startTime;
            console.log(`Blue Man AI | ✅ Success with ${selectedProvider} in ${duration}ms`);
            console.log(`Blue Man AI | 📄 Response length: ${response?.length || 0} chars`);
            console.log(`Blue Man AI | 📝 Response content: "${response}"`);
            
            return response;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`Blue Man AI | ❌ Error with ${selectedProvider} after ${duration}ms:`, error);
            
            if (fallbackEnabled && selectedProvider !== 'gemini') {
                console.log("Blue Man AI | 🔄 Falling back to Gemini...");
                try {
                    const response = await this.callProvider('gemini', userInput, npcData, contextOptions, history);
                    const totalDuration = Date.now() - startTime;
                    console.log(`Blue Man AI | ✅ Fallback success in ${totalDuration}ms`);
                    return response;
                } catch (fallbackError) {
                    console.error("Blue Man AI | ❌ Fallback also failed:", fallbackError);
                }
            }
            
            throw error;
        }
    }
    
    static async callProvider(provider, userInput, npcData, contextOptions, history) {
        switch(provider) {
            case 'deepseek':
                return await this.callDeepSeek(userInput, npcData, contextOptions, history);
            case 'gpt':
                return await this.callGPT(userInput, npcData, contextOptions, history);
            case 'yandex':
                return await this.callYandex(userInput, npcData, contextOptions, history);
            case 'ollama':
                return await this.callOllama(userInput, npcData, contextOptions, history);
            case 'custom':
                return await this.callCustom(userInput, npcData, contextOptions, history);
            case 'gemini':
                const { callGeminiOriginal } = await import('./ai-logic.js');
                return await callGeminiOriginal(userInput, npcData, contextOptions, history);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    // 🆕 Методы для каждого провайдера
    static async callDeepSeek(userInput, npcData, contextOptions, history) {
        const apiKey = this.getApiKey('deepseek');
        if (!apiKey) return "[Система: Нет API ключа для DeepSeek]";
        
        const modelsString = this.getModel('deepseek');
        if (!modelsString) return "[Система: Не указаны модели DeepSeek]";
        
        const models = modelsString.split(',').map(m => m.trim()).filter(m => m.length > 0);
        
        // Формируем системную инструкцию для DeepSeek
        const systemInstruction = this.buildSystemInstruction(npcData, contextOptions);
        
        // Формируем историю
        const apiHistory = history
            .filter(h => !h.isSystem && h.text)
            .map(h => ({
                role: h.speaker === npcData.name ? "assistant" : "user",
                content: h.text
            }));
        
        const contents = [
            { role: "system", content: systemInstruction },
            ...apiHistory,
            { role: "user", content: userInput }
        ];

        for (const modelName of models) {
            try {
                const url = `https://api.deepseek.com/chat/completions`;
                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: contents,
                        max_tokens: 1000,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    console.warn(`Blue Man AI | DeepSeek API Error (${modelName}):`, await response.text());
                    continue;
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content;
                if (text) {
                    console.log(`Blue Man AI | DeepSeek Success with ${modelName}`);
                    return text;
                }
            } catch (e) {
                console.error(`Blue Man AI | DeepSeek Connection Error (${modelName}):`, e);
            }
        }
        
        return "...(ИИ молчит)...";
    }

    static async callGPT(userInput, npcData, contextOptions, history) {
        const apiKey = this.getApiKey('gpt');
        if (!apiKey) return "[Система: Нет API ключа для GPT]";
        
        const modelsString = this.getModel('gpt');
        if (!modelsString) return "[Система: Не указаны модели GPT]";
        
        const models = modelsString.split(',').map(m => m.trim()).filter(m => m.length > 0);
        
        const systemInstruction = this.buildSystemInstruction(npcData, contextOptions);
        
        const apiHistory = history
            .filter(h => !h.isSystem && h.text)
            .map(h => ({
                role: h.speaker === npcData.name ? "assistant" : "user",
                content: h.text
            }));
        
        const contents = [
            { role: "system", content: systemInstruction },
            ...apiHistory,
            { role: "user", content: userInput }
        ];

        for (const modelName of models) {
            try {
                const url = `https://api.openai.com/v1/chat/completions`;
                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: modelName,
                        messages: contents,
                        max_tokens: 1000,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    console.warn(`Blue Man AI | GPT API Error (${modelName}):`, await response.text());
                    continue;
                }

                const data = await response.json();
                const text = data.choices?.[0]?.message?.content;
                if (text) {
                    console.log(`Blue Man AI | GPT Success with ${modelName}`);
                    return text;
                }
            } catch (e) {
                console.error(`Blue Man AI | GPT Connection Error (${modelName}):`, e);
            }
        }
        
        return "...(ИИ молчит)...";
    }

    static async callYandex(userInput, npcData, contextOptions, history) {
        const iamToken = this.getApiKey('yandex');
        if (!iamToken) return "[Система: Нет IAM токена для Yandex]";
        
        const modelsString = this.getModel('yandex');
        if (!modelsString) return "[Система: Не указаны модели Yandex]";
        
        const models = modelsString.split(',').map(m => m.trim()).filter(m => m.length > 0);
        
        const systemInstruction = this.buildSystemInstruction(npcData, contextOptions);
        
        const apiHistory = history
            .filter(h => !h.isSystem && h.text)
            .map(h => ({
                role: h.speaker === npcData.name ? "assistant" : "user",
                content: h.text
            }));
        
        const contents = [
            { role: "system", content: systemInstruction },
            ...apiHistory,
            { role: "user", content: userInput }
        ];

        for (const modelName of models) {
            try {
                const folderId = this.getCachedSetting("yandexFolderId");
                const uri = folderId ? `gpt://${folderId}/${modelName}` : `gpt://${modelName}`;
                
                console.log(`Blue Man AI | Yandex API using modelUri: ${uri} (Folder ID: ${folderId || 'not set'})`);
                
                const url = `https://llm.api.cloud.yandex.net/foundationModels/v1/completion`;
                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${iamToken}`
                    },
                    body: JSON.stringify({
                        modelUri: uri,
                        completionOptions: {
                            maxTokens: "1000",
                            temperature: 0.7
                        },
                        messages: contents
                    })
                });

                if (!response.ok) {
                    console.warn(`Blue Man AI | Yandex API Error (${modelName}):`, await response.text());
                    continue;
                }

                const data = await response.json();
                const text = data.result?.alternatives?.[0]?.message?.text;
                if (text) {
                    console.log(`Blue Man AI | Yandex Success with ${modelName}`);
                    return text;
                }
            } catch (e) {
                console.error(`Blue Man AI | Yandex Connection Error (${modelName}):`, e);
            }
        }
        
        return "...(ИИ молчит)...";
    }

    static async callOllama(userInput, npcData, contextOptions, history) {
        const modelsString = this.getModel('ollama');
        if (!modelsString) return "[Система: Не указаны модели Ollama]";
        
        const models = modelsString.split(',').map(m => m.trim()).filter(m => m.length > 0);
        
        const systemInstruction = this.buildSystemInstruction(npcData, contextOptions);
        
        const apiHistory = history
            .filter(h => !h.isSystem && h.text)
            .map(h => ({
                role: h.speaker === npcData.name ? "assistant" : "user",
                content: h.text
            }));
        
        const contents = [
            { role: "system", content: systemInstruction },
            ...apiHistory,
            { role: "user", content: userInput }
        ];

        for (const modelName of models) {
            try {
                const baseUrl = this.getCachedSetting("ollamaUrl") || "http://localhost:11434";
                const url = `${baseUrl.replace(/\/$/, '')}/api/generate`; // Убираем слэш на конце, если юзер его случайно ввел
                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: modelName,
                        prompt: contents.map(c => `${c.role}: ${c.content}`).join('\n\n'),
                        stream: false,
                        options: {
                            temperature: 0.7,
                            num_predict: 1000
                        }
                    })
                });

                if (!response.ok) {
                    console.warn(`Blue Man AI | Ollama API Error (${modelName}):`, await response.text());
                    continue;
                }

                const data = await response.json();
                const text = data.response;
                if (text) {
                    console.log(`Blue Man AI | Ollama Success with ${modelName}`);
                    return text;
                }
            } catch (e) {
                console.error(`Blue Man AI | Ollama Connection Error (${modelName}):`, e);
            }
        }
        
        return "...(ИИ молчит)...";
    }

    static async callCustom(userInput, npcData, contextOptions, history) {
        const settings = this.getCustomSettings();
        
        if (!settings.url) return "[Система: Не указан URL для Custom API]";
        
        const systemInstruction = this.buildSystemInstruction(npcData, contextOptions);
        
        const apiHistory = history
            .filter(h => !h.isSystem && h.text)
            .map(h => ({
                role: h.speaker === npcData.name ? "assistant" : "user",
                content: h.text
            }));
        
        const contents = [
            { role: "system", content: systemInstruction },
            ...apiHistory,
            { role: "user", content: userInput }
        ];

        try {
            const response = await fetch(settings.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(settings.apiKey && { "Authorization": `Bearer ${settings.apiKey}` })
                },
                body: JSON.stringify({
                    model: settings.model || "default",
                    messages: contents,
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                console.warn(`Blue Man AI | Custom API Error:`, await response.text());
                return "...(ИИ молчит)...";
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || data.response || data.text;
            
            if (text) {
                console.log(`Blue Man AI | Custom API Success`);
                return text;
            }
        } catch (e) {
            console.error(`Blue Man AI | Custom API Connection Error:`, e);
        }
        
        return "...(ИИ молчит)...";
    }

    // 🆕 Вспомогательный метод для очистки кеша (для совместимости с UI)
    static _cleanJournalText(htmlContent) {
        if (!htmlContent) return "";
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = htmlContent;

        const gmSelectors = [".fvtt-native", ".narrative", ".notable", ".gm-only", ".secret", "section.fvtt-relative"];
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

    // 🆕 Вспомогательный метод для построения системной инструкции
    static buildSystemInstruction(npcData, contextOptions) {
        const toneVal = this.getCachedSetting("tone") || 50;
        const intVal = this.getCachedSetting("intelligence") || 50;
        const eloqVal = this.getCachedSetting("eloquence") || 50;
        
        let basePersonality = "";
        if (toneVal > 70) basePersonality += "Tone: Friendly and Polite. ";
        else if (toneVal < 30) basePersonality += "Tone: Rude and Aggressive. ";
        
        if (intVal > 70) basePersonality += "Intellect: High (use complex words). ";
        else if (intVal < 30) basePersonality += "Intellect: Low (speak simply). ";
        
        if (eloqVal > 70) basePersonality += "Style: Eloquent. ";
        else if (eloqVal < 30) basePersonality += "Style: Blunt. ";

        const rep = npcData.reputation ?? 50;
        let attitudeInstruction = "";
        
        if (rep >= 90) {
            attitudeInstruction = "ATTITUDE: ADMIRATION. Treat player as a hero/best friend.";
        } else if (rep >= 85) {
            attitudeInstruction = "ATTITUDE: FRIENDLY. Warm and helpful.";
        } else if (rep >= 60) {
            attitudeInstruction = "ATTITUDE: NEUTRAL. Professional/Business-like.";
        } else if (rep >= 35) {
            attitudeInstruction = "ATTITUDE: SUSPICIOUS/COLD. Be reluctant to help. Short answers.";
        } else {
            attitudeInstruction = "ATTITUDE: HATEFUL. Ignore politeness. Be extremely hostile. Insult the player.";
        }
        
        let behaviorInstruction = `BASE PERSONALITY: ${basePersonality}\nCURRENT ATTITUDE: ${attitudeInstruction}`;

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
        
        // --- ДОБАВЛЕНО: СЮЖЕТЫЙ КОНТЕКСТ И КВЕСТЫ ---
        let questContext = "";
        const tokenDoc = canvas.tokens.placeables.find(t => t.name === npcData.name && t.actor?.type === "npc")?.document;

        if (tokenDoc) {
            const mainArcUuid = this.getCachedSetting("worldLoreJournal");
            if (mainArcUuid) {
                const doc = fromUuidSync(mainArcUuid);
                if (doc) {
                    let rawText = "";
                    if (doc.documentName === "JournalEntryPage") {
                        rawText = doc.text.content;
                    } else if (doc.pages && doc.pages.size > 0) {
                        rawText = doc.pages.contents[0].text.content;
                    }
                    const cleanText = this._cleanJournalText(rawText);
                    if (cleanText) {
                        questContext += `\n[WORLD BACKGROUND]: ${cleanText}\n`;
                    }
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
                        const cleanText = this._cleanJournalText(rawText);
                        if (cleanText) {
                            questContext += `\n[CURRENT QUEST / MOTIVATION]: ${cleanText}\n`;
                        }
                    }
                }
            }
        }
        
        if (questContext) behaviorInstruction += questContext;

        // --- ДОБАВЛЕНО: БОЕВЫЕ ХАРАКТЕРИСТИКИ ---
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

        return systemInstruction;
    }
}
