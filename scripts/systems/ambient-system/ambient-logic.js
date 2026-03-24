import { MOD_ID } from '../../core/settings.js';
import { AIProviders } from '../../core/ai-providers.js';
import { AMBIENT_PHRASES } from './ambient-phrases.js';
import { NpcCollector } from '../../core/npc-collector.js';
import { BlueManFlagHandler } from '../../core/flag-handler.js'; // [NEW] Импорт

export function initializeAmbientTalk() {
    if (!game.user.isGM) return;

    setInterval(async () => {
        if (game.paused) return;

        const isEnabled = game.settings.get(MOD_ID, "allowAmbientTalk");
        if (!isEnabled) return; 

        const npcs = canvas.tokens.placeables.filter(t => t.actor?.type === "npc" && !t.document.hidden);
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

    const bio = (npcToken.actor.system.details.biography.value || "").toLowerCase();
    const hasQuest = bio.includes("квест") || bio.includes("quest");
    const hasSecret = bio.includes("секрет") || bio.includes("secret");
    const isNamed = npcToken.name.split(" ").length > 1;

    const allowAi = !isEnemy || (hasQuest || hasSecret || isNamed);

    if (minDistance <= 5 && allowAi) {
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
    const name = tokenDoc.name.toLowerCase(); 
    const type = actor.system.details.type?.value || "humanoid";

    if (game.modules.get("item-piles")?.active && 
        game.itempiles.API.isValidItemPile(tokenDoc) &&
        tokenDoc.getFlag("item-piles", "data")?.type === "merchant") {
        const list = AMBIENT_PHRASES.merchant.phrases;
        return list[Math.floor(Math.random() * list.length)];
    }

    if (type !== "humanoid") {
        const list = AMBIENT_PHRASES.beast.phrases;
        return list[Math.floor(Math.random() * list.length)];
    }

    if (AMBIENT_PHRASES.guard.keywords.some(k => name.includes(k))) {
        const list = AMBIENT_PHRASES.guard.phrases;
        return list[Math.floor(Math.random() * list.length)];
    }

    const list = AMBIENT_PHRASES.commoner.phrases;
    return list[Math.floor(Math.random() * list.length)];
}