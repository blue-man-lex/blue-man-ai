import { MOD_ID } from '../../core/settings.js';
import { AIProviders } from '../../core/ai-providers.js';
import { AMBIENT_PHRASES } from './ambient-phrases.js';
import { AMBIENT_PHRASES_CPR } from './ambient-phrases-cpr.js';
import { NpcCollector } from '../../core/npc-collector.js';
import { BlueManFlagHandler } from '../../core/flag-handler.js';
import { BlueManSystemManager } from '../../systems/adapters/system-manager.js';

export function initializeAmbientTalk() {
    if (!game.user.isGM) return;

    setInterval(async () => {
        if (game.paused) return;

        const isEnabled = game.settings.get(MOD_ID, "allowAmbientTalk");
        const isEmulation = game.settings.get(MOD_ID, "enableAmbientEmulation");
        
        // Если выключены обе функции — ничего не делаем
        if (!isEnabled && !isEmulation) return; 

        const npcs = canvas.tokens.placeables.filter(t => (t.actor?.type === "npc" || t.actor?.type === "mook") && !t.document.hidden);
        if (npcs.length === 0) return;

        const players = canvas.tokens.placeables.filter(t => t.actor?.hasPlayerOwner);
        if (players.length === 0) return;

        // РАНДОМИЗАЦИЯ: случайный шанс срабатывания (40% вместо 100%)
        if (Math.random() > 0.4) return;

        // РАНДОМИЗАЦИЯ: случайное количество NPC (1-4 вместо 0-2)
        const maxSpeakers = Math.floor(Math.random() * 4) + 1; // 1, 2, 3 или 4
        
        const speakers = npcs.sort(() => 0.5 - Math.random()).slice(0, maxSpeakers);

        for (const npc of speakers) {
            await processAmbientNpc(npc, players);
        }
    }, 5000); // Каждые 5 секунд вместо 10
}

async function processAmbientNpc(npcToken, players) {
    let minDistance = Infinity;
    
    for (const p of players) {
        let dist = Infinity;
        try {
            if (canvas.grid.measurePath) {
                const measure = canvas.grid.measurePath([npcToken.center, p.center]);
                dist = measure.distance;
            } else {
                dist = canvas.grid.measureDistance(npcToken.center, p.center);
            }
        } catch (e) {
            const dx = npcToken.center.x - p.center.x;
            const dy = npcToken.center.y - p.center.y;
            dist = (Math.sqrt(dx*dx + dy*dy) / canvas.grid.size) * canvas.grid.distance; 
        }
        if (dist < minDistance) minDistance = dist;
    }

    let text = "";
    let isAi = false;
    const isEnemy = npcToken.document.disposition === -1;
    const adapter = BlueManSystemManager.adapter;
    const bioData = adapter ? adapter.getBio(npcToken.actor) : { full: "" };
    const bio = (bioData.full || "").toLowerCase();
    const hasQuest = bio.includes("квест") || bio.includes("quest");
    const hasSecret = bio.includes("секрет") || bio.includes("secret");
    const isNamed = npcToken.name.split(" ").length > 1;

    const allowAi = !isEnemy || (hasQuest || hasSecret || isNamed);
    const isEmulationOnly = game.settings.get(MOD_ID, "enableAmbientEmulation");
    const isAiEnabled = game.settings.get(MOD_ID, "allowAmbientTalk");

    // ИИ срабатывает только если включена главная настройка эмбиента и ВЫКЛЮЧЕНА имитация
    if (minDistance <= 5 && allowAi && isAiEnabled && !isEmulationOnly) {
        const activeProvider = game.settings.get(MOD_ID, "aiProvider") || "gemini";
        // Пытаемся взять отдельный эмбиент-ключ, если его нет — берем основной ключ провайдера
        const ambientKey = AIProviders.getAmbientApiKey(activeProvider) || AIProviders.getApiKey(activeProvider);
        
        if (ambientKey) {
            const isMerchant = game.modules.get("item-piles")?.active && 
                               game.itempiles.API.isValidItemPile(npcToken.document) &&
                               npcToken.document.getFlag("item-piles", "data")?.type === "merchant";

            let aiChance = 0.1; 
            let specificPrompt = "";

            if (hasQuest || hasSecret) {
                aiChance = 1.0; 
                specificPrompt = "Hint at your secret/quest. Be mysterious.";
            } else if (isMerchant) {
                aiChance = 0.8;
                specificPrompt = "Advertise your wares.";
            } else if (isNamed) {
                aiChance = 0.5;
                specificPrompt = "Say something in character.";
            }

            if (Math.random() < aiChance) {
                const npcData = NpcCollector.collect(npcToken.document);
                const prompt = `Player is very close (${Math.round(minDistance)} ft). Ambient phrase. ${specificPrompt || "React."} Max 1 sentence.`;
                
                text = await AIProviders.callAI(prompt, npcData, { isWhisper: false, languageInfo: { hasShared: true } }, []);
                isAi = true;
            }
        }
    }

    if (!text && minDistance <= 60) {
        text = getTemplatePhrase(npcToken.document);
    }

    if (text && !text.includes("[Error")) {
        // [FIX] Вместо локального вызова, отправляем сигнал всем через FlagHandler
        await BlueManFlagHandler.showBubble(npcToken.document, text, !isAi);
    }
}

function getTemplatePhrase(tokenDoc) {
    const actor = tokenDoc.actor;
    
    // Определяем нужную базу фраз на основе текущей игровой системы
    const isCPR = game.system.id === "cyberpunk-red-core";
    const phraseDatabase = isCPR ? AMBIENT_PHRASES_CPR : AMBIENT_PHRASES;

    // Получаем биографию
    const adapter = BlueManSystemManager.adapter;
    const bioData = adapter ? adapter.getBio(actor) : { full: "" };
    
    // Объединяем имя и биографию, переводим в нижний регистр для поиска
    const searchStr = (tokenDoc.name + " " + (bioData.full || "")).toLowerCase();

    // 1. Ищем теги в имени или биографии (игнорируя решетки и регистр)
    for (const key of Object.keys(phraseDatabase)) {
        const category = phraseDatabase[key];
        if (category.tags) {
            const isMatch = category.tags.some(tag => {
                // Очищаем тег от символа # и лишних пробелов
                const cleanTag = tag.replace('#', '').trim().toLowerCase();
                return searchStr.includes(cleanTag);
            });
            
            if (isMatch) {
                const list = category.phrases;
                return list[Math.floor(Math.random() * list.length)];
            }
        }
    }

    // Пытаемся найти тип существа (для DnD5e это .details.type, для других — просто humanoid)
    const type = actor.system.details?.type?.value || actor.system.type?.value || "humanoid";

    // 2. Fallback логика для Item Piles
    if (game.modules.get("item-piles")?.active && 
        game.itempiles.API.isValidItemPile(tokenDoc) &&
        tokenDoc.getFlag("item-piles", "data")?.type === "merchant") {
        const list = phraseDatabase.merchant.phrases;
        return list[Math.floor(Math.random() * list.length)];
    }

    // 3. Fallback логика для зверей/монстров
    if (type !== "humanoid") {
        const list = phraseDatabase.beast.phrases;
        return list[Math.floor(Math.random() * list.length)];
    }

    // 4. Fallback логика для простолюдинов (дефолт)
    const list = phraseDatabase.commoner.phrases;
    return list[Math.floor(Math.random() * list.length)];
}