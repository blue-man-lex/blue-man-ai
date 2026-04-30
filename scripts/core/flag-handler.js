import { MOD_ID } from './settings.js';
import { callGemini } from './ai-logic.js'; 
import { NpcCollector } from './npc-collector.js';
import { QuestService } from '../systems/quest-system/quest-service.js';

export class BlueManFlagHandler {
    
    // --- [NEW] ОТОБРАЖЕНИЕ BUBBLE ---
    static async showBubble(tokenDoc, text, emote) {
        // Если это ГМ - он может сразу отправить команду всем (включая себя)
        // Но чтобы это увидели игроки, нам нужно отправить это через сокет/чат как команду
        // Проще всего: отправить скрытое сообщение с флагом 'showBubble'
        
        ChatMessage.create({
            content: "System Command: Show Bubble",
            whisper: game.users.map(u => u.id), // Всем
            sound: null,
            flags: {
                core: { canPopout: false },
                [MOD_ID]: {
                    action: "showBubble",
                    tokenId: tokenDoc.id,
                    sceneId: tokenDoc.parent?.id || canvas.scene?.id,
                    text: text,
                    emote: emote
                }
            }
        });
    }

    // --- ОБРАБОТКА КВЕСТОВ ---

    static async offerQuest(tokenDoc, questUuid) {
        const doc = await fromUuid(questUuid);
        if (!doc) return;

        const sourceName = tokenDoc.name;

        ChatMessage.create({
            content: "System Command: Show Quest Offer",
            whisper: game.users.filter(u => !u.isGM).map(u => u.id),
            sound: null,
            flags: {
                core: { canPopout: false },
                [MOD_ID]: {
                    action: "showQuestOffer",
                    questUuid: questUuid,
                    questName: doc.name,
                    sourceName: sourceName
                }
            }
        });
        
        let history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
        history.push({ 
            speaker: "Система", 
            text: `<span style="color:#3498db"><b>Предложено задание:</b> ${doc.name}</span>`, 
            isSystem: true 
        });
        await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);
    }

    static async acceptQuest(questUuid, sourceName) {
        if (!game.user.isGM) {
            ChatMessage.create({
                content: "Quest Accept Request",
                whisper: game.users.filter(u => u.isGM).map(u => u.id),
                flags: { [MOD_ID]: { action: "acceptQuest", questUuid: questUuid, sourceName: sourceName } }
            });
            return;
        }

        const success = await QuestService.addQuest(questUuid, sourceName);
        if (success) {
            ui.notifications.info(`Квест "${sourceName}" добавлен в журнал группы.`);
        }
    }

    // --- ЗАВЕРШЕНИЕ КВЕСТА + РАЗДАЧА (АВТО + ОКНО) ---
    static async questConclusion(tokenDoc, questUuid, result) {
        const success = await QuestService.updateStatus(questUuid, result);
        
        if (success) {
            const isWin = result === 'completed';
            const color = isWin ? "#2ecc71" : "#c0392b";
            const text = isWin ? "ЗАДАНИЕ ВЫПОЛНЕНО" : "ЗАДАНИЕ ПРОВАЛЕНО";
            const repDelta = isWin ? 10 : -10;

            await this.changeReputation(tokenDoc, repDelta);

            let history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
            history.push({ 
                speaker: "Система", 
                text: `<span style="color:${color}; font-weight:bold; font-size:1.1em;">${text}</span>`, 
                isSystem: true 
            });
            await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);

            // РАЗДАЧА НАГРАДЫ
            if (isWin) {
                const allQuests = QuestService.getQuests();
                const quest = allQuests.find(q => q.id === questUuid);
                
                if (quest && quest.rewards) {
                    await this._distributeRewards(tokenDoc, quest.rewards);
                }
            }

            const npcData = NpcCollector.collect(tokenDoc);
            const triggerText = isWin 
                ? `[SYSTEM EVENT]: Players COMPLETED the quest "${text}". Thank them and give reward if promised.`
                : `[SYSTEM EVENT]: Players FAILED the quest "${text}". Scold them or express disappointment.`;
            
            const response = await callGemini(triggerText, npcData, { languageInfo: { hasShared: true } }, history);
            
            history.push({ 
                speaker: npcData.name, 
                text: response, 
                isSystem: false, 
                ownerId: game.user.id 
            });
            await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);
        }
    }

    // --- БОЛВАНКА ДЛЯ НАГРАД ДОСКИ ОБЪЯВЛЕНИЙ ---
    
    static async _getOrCreateBoardRewardActor() {
        // Ищем существующего актера для наград доски
        let actor = game.actors.find(a => a.getFlag(MOD_ID, 'isBoardRewardActor'));
        
        if (!actor) {
            // Создаем нового актера-болванку
            const actorData = {
                name: "Сундук наград доски объявлений",
                type: "character",
                img: "icons/containers/chest/chest-reinforced-steel-brown.webp",
                system: {
                    abilities: {
                        str: { value: 10, mod: 0 },
                        dex: { value: 10, mod: 0 },
                        con: { value: 10, mod: 0 },
                        int: { value: 10, mod: 0 },
                        wis: { value: 10, mod: 0 },
                        cha: { value: 10, mod: 0 }
                    },
                    currency: {
                        pp: 0,
                        gp: 0,
                        ep: 0,
                        sp: 0,
                        cp: 0
                    },
                    traits: {
                        size: "med",
                        di: {},
                        dr: {},
                        dv: {},
                        ci: {},
                        languages: { value: [], custom: "" }
                    },
                    attributes: {
                        hp: { value: 10, max: 10 },
                        ac: { value: 10 }
                    }
                },
                prototypeToken: {
                    name: "Сундук наград",
                    disposition: 0,
                    displayBars: 0,
                    bar1: { attribute: "hp" },
                    bar2: { attribute: null },
                    lockRotation: true,
                    vision: { enabled: false },
                    actorLink: false
                }
            };
            
            actor = await Actor.create(actorData);
            await actor.setFlag(MOD_ID, 'isBoardRewardActor', true);
            ui.notifications.info("Создан актер для наград доски объявлений");
        }
        
        return actor;
    }
    
    static async _distributeBoardRewards(rewards, questName) {
        console.log("🎁 Начинаю раздачу наград доски:", { rewards, questName });
        
        // Защита от undefined
        if (!rewards) {
            console.warn("⚠️ Награды не переданы!");
            return;
        }
        
        const boardActor = await this._getOrCreateBoardRewardActor();
        const players = game.users.filter(u => u.character && !u.isGM);
        
        if (players.length === 0) {
            ui.notifications.warn("Нет игроков с персонажами для выдачи награды!");
            return;
        }
        
        let chatMessage = `<div style="font-family: 'Signika', sans-serif; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 5px;">`;
        chatMessage += `<h3 style="text-align: center; color: #786c3b; margin-bottom: 10px;">🎁 Награда за квест: "${questName || 'Неизвестный квест'}"</h3>`;
        
        // 1. Обрабатываем деньги
        if (rewards.currency && Array.isArray(rewards.currency) && rewards.currency.length > 0) {
            chatMessage += `<div style="text-align:center; font-weight:bold; border-bottom:1px solid #777; margin-bottom:5px; color:#786c3b;">💰 Золото распределено</div>`;
            
            for (let c of rewards.currency) {
                const totalAmount = parseInt(c.amount);
                const share = Math.floor(totalAmount / players.length);
                const type = c.type.toLowerCase();
                
                // Добавляем деньги актеру-болванке
                await boardActor.update({
                    [`system.currency.${type}`]: (boardActor.system.currency[type] || 0) + totalAmount
                });
                
                // Распределяем игрокам
                for (let player of players) {
                    const actor = player.character;
                    await actor.update({
                        [`system.currency.${type}`]: (actor.system.currency[type] || 0) + share
                    });
                }
                
                chatMessage += `<div style="color: #2ecc71;">✓ ${c.amount} ${c.type} → ${share} ${c.type} каждому игроку</div>`;
            }
        }
        
        // 2. Обрабатываем предметы
        if (rewards.items && Array.isArray(rewards.items) && rewards.items.length > 0) {
            const lootItems = [];
            
            for (let itemReward of rewards.items) {
                const itemObj = await fromUuid(itemReward.uuid);
                if (itemObj) {
                    lootItems.push({
                        name: itemObj.name,
                        img: itemObj.img,
                        uuid: itemReward.uuid,
                        qty: 1,
                        data: itemObj.toObject()
                    });
                }
            }

            if (lootItems.length > 0) {
                // Сохраняем лут во флаге актера-болванки
                await boardActor.setFlag(MOD_ID, 'questLoot', lootItems);
                
                // Отправляем команду открыть окно награды
                ChatMessage.create({
                    content: "System Command: Open Board Reward Window",
                    whisper: game.users.filter(u => !u.isGM).map(u => u.id),
                    sound: null,
                    flags: { 
                        core: { canPopout: false }, 
                        [MOD_ID]: { 
                            action: "openBoardRewardWindow", 
                            actorId: boardActor.id 
                        } 
                    }
                });
                
                chatMessage += `<div style="color:#34971a; margin-top: 10px;">✓ Предметы доступны для получения в сундуке наград!</div>`;
            }
        }
        
        chatMessage += `</div>`;
        // НЕ создаем сообщение здесь, так как оно уже создается в quest-log.js
// ... (rest of the code remains the same)
        // await ChatMessage.create({ content: chatMessage });
        
        console.log("✅ Раздача наград доски завершена");
    }

    // --- ЛОГИКА РАЗДАЧИ ---
    static async _distributeRewards(tokenDoc, rewards) {
        const players = canvas.tokens.placeables.filter(t => t.actor && t.actor.hasPlayerOwner);
        let chatMessage = "";
        let hasMoney = false;

        // 1. ДЕНЬГИ (АВТОМАТИЧЕСКИ ВСЕМ НА СЦЕНЕ)
        if (rewards.currency && rewards.currency.length > 0) {
            if (players.length === 0) {
                ui.notifications.warn("Нет игроков на сцене для раздачи денег!");
            } else {
                hasMoney = true;
                chatMessage += `<div style="text-align:center; font-weight:bold; border-bottom:1px solid #777; margin-bottom:5px; color:#f1c40f;">💰 Золото распределено</div>`;
                
                for (let c of rewards.currency) {
                    const totalAmount = parseInt(c.amount);
                    const share = Math.floor(totalAmount / players.length);
                    const type = c.type.toLowerCase(); 

                    if (share > 0) {
                        for (let p of players) {
                            const actor = p.actor;
                            const currentMoney = actor.system.currency[type] || 0;
                            await actor.update({ [`system.currency.${type}`]: currentMoney + share });
                        }
                        chatMessage += `<div style="color:#e0d0b8;">${totalAmount} ${type.toUpperCase()} (по ${share} каждому)</div>`;
                    }
                }
            }
        }

        // 2. ПРЕДМЕТЫ
        if (rewards.items && rewards.items.length > 0) {
            // Если есть tokenDoc (НПС) - открываем сундук
            if (tokenDoc) {
                const lootItems = [];
                for (let itemReward of rewards.items) {
                    const itemObj = await fromUuid(itemReward.uuid);
                    if (itemObj) {
                        lootItems.push({
                            name: itemObj.name,
                            img: itemObj.img,
                            uuid: itemReward.uuid,
                            qty: 1, 
                            data: itemObj.toObject()
                        });
                    }
                }

                if (lootItems.length > 0) {
                    await tokenDoc.setFlag(MOD_ID, 'questLoot', lootItems);
                    ChatMessage.create({
                        content: "System Command: Open Reward Window",
                        whisper: game.users.filter(u => !u.isGM).map(u => u.id),
                        sound: null,
                        flags: { core: { canPopout: false }, [MOD_ID]: { action: "openRewardWindow", tokenId: tokenDoc.id } }
                    });
                    chatMessage += `<div style="color:#2ecc71;">Предметы доступны для получения у НПС.</div>`;
                }
            } else {
                // Если НПС нет (Доска Объявлений) - просто кидаем красивые ссылки в чат
                chatMessage += `<div style="text-align:center; font-weight:bold; border-bottom:1px solid #777; margin-top:10px; margin-bottom:5px; color:#3498db;">🎁 Предметы (Перетащите себе)</div>`;
                chatMessage += `<div style="display:flex; flex-direction:column; gap:5px;">`;
                for (let itemReward of rewards.items) {
                    chatMessage += `<div>@UUID[${itemReward.uuid}]{${itemReward.name}}</div>`;
                }
                chatMessage += `</div>`;
            }
        }
        
        if (hasMoney || chatMessage.includes("Предметы")) {
             ChatMessage.create({ content: chatMessage, type: CONST.CHAT_MESSAGE_STYLES.OTHER, speaker: { alias: "Система" } });
        }
    }

    // [NEW] ЗАПРОС ИГРОКА "ЗАБРАТЬ ПРЕДМЕТ"
    static async requestClaimReward(tokenId, itemIndex, actorId) {
        if (game.user.isGM) {
            await this._processClaim(tokenId, itemIndex, actorId);
        } else {
            ChatMessage.create({
                content: "System Request (Claim Reward)",
                whisper: game.users.filter(u => u.isGM).map(u => u.id),
                flags: {
                    [MOD_ID]: {
                        action: "claimReward",
                        tokenId: tokenId,
                        itemIndex: itemIndex,
                        actorId: actorId
                    }
                }
            });
        }
    }

    // [NEW] ОБРАБОТКА ВЫДАЧИ ПРЕДМЕТА (ГМ)
    static async _processClaim(tokenId, itemIndex, actorId) {
        const actor = game.actors.get(actorId);
        
        if (!actor) {
            console.warn('THM Flag Handler | Actor not found:', actorId);
            return ui.notifications.warn("Персонаж игрока не найден!");
        }
        
        // Определяем, это токен на сцене или актер-болванка
        let lootContainer;
        if (canvas.tokens.get(tokenId)) {
            // Это токен на сцене (старая логика)
            const token = canvas.tokens.get(tokenId);
            
            if (!token) {
                console.warn('Blue Man AI | Token not found');
                return;
            }
            
            lootContainer = token.document;
        } else {
            // Это актер-болванка доски объявлений (передан его ID)
            const boardActor = game.actors.get(tokenId);
            if (!boardActor) {
                console.warn('Blue Man AI | Board actor not found:', tokenId);
                return ui.notifications.warn("Сундук наград не найден!");
            }
            lootContainer = boardActor;
            console.log('Blue Man AI | Using board reward actor:', boardActor.name);
        }
        
        // Читаем актуальный лут
        let loot = lootContainer.getFlag(MOD_ID, 'questLoot') || [];
        console.log('Blue Man AI | Current loot array:', loot);
        console.log('Blue Man AI | Requested item index:', itemIndex);
        
        // Проверка: существует ли предмет (индекс)
        if (!loot[itemIndex]) return ui.notifications.warn("Предмет уже забрали!");
        
        const itemToClaim = loot[itemIndex];
        if (!itemToClaim || !itemToClaim.data) {
            console.warn('Blue Man AI | Item at index does not exist or has no data:', itemIndex);
            return ui.notifications.warn("Предмет уже забрали или не существует!");
        }
        
        console.log('Blue Man AI | Claiming item:', itemToClaim.name);
        
        // Создаем предмет у игрока (со стаканьем)
        await this.addItemToActor(actor, itemToClaim.data);
        
        // Удаляем предмет из лута
        loot.splice(itemIndex, 1);
        await lootContainer.setFlag(MOD_ID, 'questLoot', loot);
        
        console.log('Blue Man AI | Item claimed successfully, remaining items:', loot.length);
        ui.notifications.info(`Предмет "${itemToClaim.name}" получен!`);
    }

    // --- КРАЖА ---
    static async stealItem(tokenDoc, itemData, playerTokenId) {
        if (game.user.isGM) {
            const npcActor = tokenDoc.actor;
            const playerToken = canvas.tokens.get(playerTokenId);
            const playerActor = playerToken?.actor;

            if (!npcActor || !playerActor) return;

            await this.addItemToActor(playerActor, itemData);

            if (itemData.originId) {
                await npcActor.deleteEmbeddedDocuments("Item", [itemData.originId]);
            }

            let history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
            history.push({ 
                speaker: "Система", 
                text: `<span style="color:#2ecc71"><b>УСПЕШНАЯ КРАЖА:</b> ${itemData.name}</span>`, 
                isSystem: true 
            });
            await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);

            return;
        }

        ChatMessage.create({
            content: "System Request (Steal)",
            whisper: game.users.filter(u => u.isGM).map(u => u.id),
            sound: null,
            flags: {
                core: { canPopout: false },
                [MOD_ID]: {
                    action: "stealItem", 
                    tokenId: tokenDoc.id,
                    sceneId: tokenDoc.parent?.id || canvas.scene?.id,
                    itemData: itemData,
                    playerTokenId: playerTokenId
                }
            }
        });
    }

    // --- ТРЕВОГА ---
    static async triggerAlarm(tokenDoc) {
        if (game.user.isGM) {
            if (!game.paused) game.togglePause(true, {broadcast: true});
            
            await this.changeReputation(tokenDoc, -30);

            const actor = tokenDoc.actor;
            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: "<b>СТРАЖА! МЕНЯ ГРАБЯТ!</b>",
                type: CONST.CHAT_MESSAGE_STYLES.IC
            });

            let history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
            history.push({ 
                speaker: "Система", 
                text: `<span style="color:#e74c3c"><b>НЕУДАЧНАЯ КРАЖА! ТРЕВОГА!</b></span>`, 
                isSystem: true 
            });
            await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);

            return;
        }

        ChatMessage.create({
            content: "System Request (Alarm)",
            whisper: game.users.filter(u => u.isGM).map(u => u.id),
            sound: null,
            flags: {
                core: { canPopout: false },
                [MOD_ID]: {
                    action: "triggerAlarm", 
                    tokenId: tokenDoc.id,
                    sceneId: tokenDoc.parent?.id || canvas.scene?.id
                }
            }
        });
    }

    // --- ЗАВЕРШЕНИЕ КВЕСТА (СТАРОЕ) ---
    static async completeQuest(tokenDoc) {
        const npcData = NpcCollector.collect(tokenDoc);
        let history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];

        history.push({ 
            speaker: "Система", 
            text: `<span style="color:#2ecc71; font-weight:bold;">✅ Игрок сообщил о выполнении квеста.</span>`, 
            isSystem: true 
        });
        await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);

        const triggerText = `[SYSTEM EVENT]: Player REPORTED that the QUEST IS COMPLETE. If you promised a reward, give it now. React with gratitude or satisfaction.`;
        
        try {
            const response = await callGemini(triggerText, npcData, { languageInfo: { hasShared: true } }, history);
            history.push({ speaker: npcData.name, text: response, isSystem: false, ownerId: game.user.id });
            await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);
        } catch (err) { console.error(err); }
    }

    // --- ПРИЕМ ПРЕДМЕТА ---
    static async transferItem(tokenDoc, itemData, senderName) {
        if (game.user.isGM) {
            const actor = tokenDoc.actor;
            if (!actor) return;

            await this.addItemToActor(actor, itemData);
            
            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: `<i>*Принимает предмет <b>${itemData.name}</b> от ${senderName}*</i>`,
                type: CONST.CHAT_MESSAGE_STYLES.IC 
            });

            // 1. Сообщение о передаче
            let history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
            history.push({ 
                speaker: "Система", 
                text: `Передан предмет: ${itemData.name}`, 
                isSystem: true 
            });
            await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);

            try {
                const tags = itemData.flags?.tagger?.tags || [];
                const nameUpper = itemData.name.toUpperCase();
                
                const isQuestItem = tags.includes("QuestItem") || 
                                    tags.includes("Квест") || 
                                    nameUpper.includes("[QUEST]") || 
                                    nameUpper.includes("[КВЕСТ]");
                
                let triggerText = "";
                
                // 2. Логика Репутации с выводом в чат
                if (isQuestItem) {
                    await this.changeReputation(tokenDoc, 5);
                    
                    // [NEW] Сообщение в чат о репутации
                    history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
                    history.push({ 
                        speaker: "Система", 
                        text: `<span style="color:#2ecc71; font-size: 0.9em;"><i>НПС очень рад подарку (+5 Реп)</i></span>`, 
                        isSystem: true 
                    });
                    await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);

                    triggerText = `[SYSTEM EVENT]: Player GAVE you a SPECIAL QUEST ITEM: "${itemData.name}". This is very important. React emotionally, confirm receipt and thank the player!`;
                } else {
                    await this.changeReputation(tokenDoc, 1);
                    
                    // [NEW] Сообщение в чат о репутации
                    history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
                    history.push({ 
                        speaker: "Система", 
                        text: `<span style="color:#2ecc71; font-size: 0.9em;"><i>НПС принял подарок (+1 Реп)</i></span>`, 
                        isSystem: true 
                    });
                    await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);

                    triggerText = `[SYSTEM EVENT]: Player GAVE you an item: "${itemData.name}". React to this gift based on your personality.`;
                }
                
                const npcData = NpcCollector.collect(tokenDoc);
                const response = await callGemini(triggerText, npcData, { languageInfo: { hasShared: true } }, history);

                history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
                history.push({ speaker: npcData.name, text: response, isSystem: false, ownerId: game.user.id });
                await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);

            } catch (err) { console.error(err); }
            return;
        }

        ChatMessage.create({
            content: "System Request (Transfer)",
            whisper: game.users.filter(u => u.isGM).map(u => u.id),
            sound: null,
            flags: {
                core: { canPopout: false },
                [MOD_ID]: {
                    action: "transferItem",
                    tokenId: tokenDoc.id,
                    sceneId: tokenDoc.parent?.id || canvas.scene?.id,
                    itemData: itemData,
                    senderName: senderName
                }
            }
        });
    }

    // --- РЕПУТАЦИЯ ---
    static async changeReputation(tokenDoc, delta) {
        if (game.user.isGM) {
            let currentRep = tokenDoc.getFlag(MOD_ID, 'reputation');
            if (currentRep === undefined || currentRep === null) currentRep = 50;

            let newRep = Math.clamp(currentRep + delta, 0, 100);

            if (newRep !== currentRep) {
                await this.set(tokenDoc, 'reputation', newRep);

                const shopPref = game.settings.get(MOD_ID, "shopSystem") || "auto";
                const thmActive = !!game.THM;
                const ipActive = !!game.modules.get("item-piles")?.active;

                const useTHM = (shopPref === "thm" && thmActive) || (shopPref === "auto" && thmActive);
                const useIP = (shopPref === "item-piles" && ipActive) || (shopPref === "auto" && !useTHM && ipActive);

                // --- [THM INTEGRATION] ---
                if (useTHM) {
                    const thmSettings = tokenDoc.getFlag("treasure-hoard-manager", "settings");
                    if (thmSettings && thmSettings.specific?.useReputation) {
                        const baseMarkup = 100; 
                        const repDiff = 50 - newRep; 
                        const dynamicMarkup = Math.max(10, Math.round(baseMarkup + (repDiff * 0.8))); 
                        
                        await tokenDoc.setFlag("treasure-hoard-manager", "settings.specific.priceMarkup", dynamicMarkup);
                        console.log(`Blue Man AI | THM shop markup adjusted to ${dynamicMarkup}% due to reputation ${newRep}`);
                    }
                }

                // --- [ITEM PILES INTEGRATION] ---
                if (useIP) {
                    try {
                        const pilesData = tokenDoc.getFlag("item-piles", "data");
                        if (pilesData && pilesData.type === "merchant") {
                            let newPriceMod = 1.5 - (newRep / 100);
                            newPriceMod = Math.round(newPriceMod * 100) / 100;
                            if (game.itempiles.API && typeof game.itempiles.API.updateItemPile === 'function') {
                                await game.itempiles.API.updateItemPile(tokenDoc, { merchant: { priceModifiers: { buy: newPriceMod } } });
                            } else {
                                await tokenDoc.update({ "flags.item-piles.data.merchant.priceModifiers.buy": newPriceMod });
                            }
                        }
                    } catch (e) { console.warn("Item Piles update failed:", e); }
                }
            }
            return;
        }
        ChatMessage.create({
            content: "System Request (Reputation)",
            whisper: game.users.filter(u => u.isGM).map(u => u.id),
            sound: null,
            flags: {
                core: { canPopout: false },
                [MOD_ID]: {
                    action: "changeReputation",
                    tokenId: tokenDoc.id,
                    sceneId: tokenDoc.parent?.id || canvas.scene?.id,
                    delta: delta
                }
            }
        });
    }

    // --- ЗРИТЕЛИ И ТЕХНИЧЕСКИЕ МЕТОДЫ ---
    static async addViewer(tokenDoc, userId) {
        let viewers = tokenDoc.getFlag(MOD_ID, 'viewers') || [];
        if (!viewers.includes(userId)) {
            viewers.push(userId);
            await this.set(tokenDoc, 'viewers', viewers);
        }
    }
    static async removeViewer(tokenDoc, userId) {
        let viewers = tokenDoc.getFlag(MOD_ID, 'viewers') || [];
        if (viewers.includes(userId)) {
            viewers = viewers.filter(id => id !== userId);
            await this.set(tokenDoc, 'viewers', viewers);
        }
    }
    static async sendForceOpen(targetUserId, npcTokenId, playerTokenId, greetingText, socialStatus, patrolId = null) {
        ChatMessage.create({
            content: "System Command: Open Dialog",
            whisper: [targetUserId], 
            sound: null,
            flags: {
                core: { canPopout: false },
                [MOD_ID]: {
                    action: "forceOpen",
                    npcTokenId: npcTokenId,
                    playerTokenId: playerTokenId,
                    greetingText: greetingText,
                    socialStatus: socialStatus,
                    patrolId: patrolId,
                    sceneId: canvas.scene.id
                }
            }
        });
    }
    static async set(tokenDoc, key, value) {
        if (game.user.isGM) return await tokenDoc.setFlag(MOD_ID, key, value);
        ChatMessage.create({
            content: "System Request (Set)",
            whisper: game.users.filter(u => u.isGM).map(u => u.id),
            sound: null,
            flags: { core: { canPopout: false }, [MOD_ID]: { action: "set", tokenId: tokenDoc.id, sceneId: tokenDoc.parent?.id || canvas.scene?.id, key: key, value: value } }
        });
    }
    static async unset(tokenDoc, key) {
        if (game.user.isGM) return await tokenDoc.unsetFlag(MOD_ID, key);
        ChatMessage.create({
            content: "System Request (Unset)",
            whisper: game.users.filter(u => u.isGM).map(u => u.id),
            sound: null,
            flags: { core: { canPopout: false }, [MOD_ID]: { action: "unset", tokenId: tokenDoc.id, sceneId: tokenDoc.parent?.id || canvas.scene?.id, key: key } }
        });
    }
    static async requestAI(dialogInstance, userText, socialStatus, historyOverride = null) {
        const tokenDoc = dialogInstance.npcToken.document;
        const playerTokenId = dialogInstance.playerToken.id;
        
        if (game.user.isGM) {
            const npcData = NpcCollector.collect(tokenDoc);
            let history = historyOverride || tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
            
            let response = await callGemini(userText, npcData, { socialStatus: socialStatus, isWhisper: dialogInstance.isWhisperingState, languageInfo: { hasShared: true } }, history);
            
            let opinionDelta = 0;
            const opinionRegex = /\[OPINION:?\s*([+-]?\d+)\s*\]/gi;
            const opinionMatch = [...response.matchAll(opinionRegex)];
            
            if (opinionMatch.length > 0) {
                opinionDelta = parseInt(opinionMatch[0][1], 10);
                response = response.replace(opinionRegex, "").trim();
            }
            
            if (opinionDelta !== 0) {
                await this.changeReputation(tokenDoc, opinionDelta);
                const msg = opinionDelta > 0 ? "НПС это понравилось (+1)" : "НПС это не понравилось (-1)";
                const color = opinionDelta > 0 ? "#2ecc71" : "#e74c3c";
                history.push({ speaker: "Система", text: `<span style="color:${color}; font-size: 0.9em;"><i>${msg}</i></span>`, isSystem: true });
            }
            
            history.push({ speaker: npcData.name, text: response, isSystem: false, ownerId: game.user.id });
            await tokenDoc.setFlag(MOD_ID, 'chatHistory', history);
            return;
        }
        
        ChatMessage.create({
            content: "AI Request Processing...", 
            whisper: game.users.filter(u => u.isGM).map(u => u.id),
            sound: null,
            flags: { core: { canPopout: false }, [MOD_ID]: { action: "aiRequest", tokenId: tokenDoc.id, playerTokenId: playerTokenId, sceneId: tokenDoc.parent?.id || canvas.scene?.id, text: userText, socialStatus: socialStatus, isWhisper: dialogInstance.isWhisperingState, history: historyOverride, userId: game.user.id } }
        });
    }

    /**
     * Вспомогательный метод для добавления предмета с учетом стаканья.
     */
    static async addItemToActor(actor, itemData) {
        // Проверяем, есть ли такой предмет (по имени и типу)
        const existingItem = actor.items.find(i => i.name === itemData.name && i.type === itemData.type);
        
        if (existingItem && existingItem.system && existingItem.system.quantity !== undefined) {
            const currentQty = existingItem.system.quantity || 1;
            const addQty = itemData.system?.quantity || 1;
            return await existingItem.update({ "system.quantity": currentQty + addQty });
        } else {
            const data = foundry.utils.duplicate(itemData);
            if (data._id) delete data._id;
            const [newItem] = await actor.createEmbeddedDocuments("Item", [data]);
            return newItem;
        }
    }
}