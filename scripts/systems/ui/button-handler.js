import { MOD_ID } from '../../core/settings.js';
import { BlueManFlagHandler } from '../../core/flag-handler.js';
import { BlueManStealDialog } from './steal-dialog.js'; 
import { BlueManMagicHandler } from './magic-handler.js'; 

export class BlueManButtonHandler {
    
    // --- АТАКА (ИНИЦИАЦИЯ БОЯ) ---
    static async handleAttack(dialog) {
        if (!game.user.isGM) return;

        if (!game.paused) {
            game.togglePause(true, {broadcast: true});
        }

        let combat = game.combat;
        if (!combat || combat.scene.id !== canvas.scene.id) {
            combat = await Combat.create({ scene: canvas.scene.id });
            await combat.activate();
        }

        const npcToken = dialog.npcToken;
        const playerTokens = canvas.tokens.placeables.filter(t => t.actor && t.actor.hasPlayerOwner && !t.document.hidden);

        const combatantsToAdd = [];

        if (!combat.combatants.some(c => c.tokenId === npcToken.id)) {
            combatantsToAdd.push({ 
                tokenId: npcToken.id,
                sceneId: canvas.scene.id,
                actorId: npcToken.actor.id,
                hidden: npcToken.document.hidden
            });
        }

        for (const pt of playerTokens) {
            if (!combat.combatants.some(c => c.tokenId === pt.id)) {
                combatantsToAdd.push({ 
                    tokenId: pt.id,
                    sceneId: canvas.scene.id,
                    actorId: pt.actor.id
                });
            }
        }

        if (combatantsToAdd.length > 0) {
            await combat.createEmbeddedDocuments("Combatant", combatantsToAdd);
            ui.notifications.info(`Бой инициирован! Добавлено участников: ${combatantsToAdd.length}`);
            ui.combat.render(true);
        } else {
            ui.notifications.warn("Все участники уже находятся в бою.");
        }
    }

    // --- ОГРАБЛЕНИЕ (ПРОВЕРКА ВОЗМОЖНОСТИ) ---
    static async handleSteal(dialog) {
        const playerActor = dialog.playerToken.actor;
        const npcActor = dialog.npcToken.actor;

        // --- FIX: Золотая формула (которая сработала в steal-dialog) ---
        const skillId = "sle"; // Sleight of Hand
        const skillData = playerActor.system.skills[skillId];
        
        // 1. Пытаемся взять Total
        // 2. Если нет, берем модификатор Характеристики (Ловкости), это гарантирует +45
        let pMod = skillData?.total;
        
        if (pMod === undefined || pMod === null) {
            const abilityKey = skillData?.ability || "dex";
            pMod = playerActor.system.abilities[abilityKey]?.mod || 0;
        }

        // Делаем чистый бросок
        const roll = new Roll("1d20 + @mod", { mod: pMod });
        await roll.evaluate();

        const passivePerception = npcActor.system.skills?.prc?.passive || 10;

        console.log(`Blue Man AI | Steal Init Check: Mod=${pMod}, Roll=${roll.total} vs DC=${passivePerception}`);

        if (roll.total >= passivePerception) {
            new BlueManStealDialog(dialog.playerToken, dialog.npcToken).render(true);
        } else {
            ui.notifications.error(`Вас заметили при попытке приблизиться! (${roll.total} < ${passivePerception})`);
            await BlueManFlagHandler.triggerAlarm(dialog.npcToken.document);
        }
    }

    // --- УПРАВЛЕНИЕ КВЕСТАМИ (ГМ) ---
    static async handleOfferQuest(dialog) {
        if (!game.user.isGM) return;
        const questUuid = dialog.npcToken.document.getFlag(MOD_ID, 'questJournalUuid');
        if (!questUuid) return ui.notifications.warn("Нет привязанного квеста.");
        await BlueManFlagHandler.offerQuest(dialog.npcToken.document, questUuid);
        ui.notifications.info("Предложение квеста отправлено игрокам.");
    }

    static async handleQuestConclusion(dialog, result) {
        if (!game.user.isGM) return;
        const questUuid = dialog.npcToken.document.getFlag(MOD_ID, 'questJournalUuid');
        if (!questUuid) return;
        await BlueManFlagHandler.questConclusion(dialog.npcToken.document, questUuid, result);
    }

    // --- СДАТЬ КВЕСТ (Рукопожатие - Старое) ---
    static async handleCompleteQuest(dialog) {
        if (!game.user.isGM) return; 

        await BlueManFlagHandler.changeReputation(dialog.npcToken.document, 10);
        ui.notifications.info("Квест сдан! Репутация +10");

        await BlueManFlagHandler.completeQuest(dialog.npcToken.document);
    }

    // --- АНАЛИЗ (ИНТЕЛЛЕКТ/РАССЛЕДОВАНИЕ) ---
    static async handleAnalysis(dialog) {
        const playerActor = dialog.playerToken.actor;
        
        await BlueManButtonHandler._addSystemLog(dialog.npcToken.document, `🔎 Анализ существа...`);
        dialog.render(false); 

        // --- FIX: Золотая формула ---
        const skillId = "inv"; // Investigation
        const skillData = playerActor.system.skills[skillId];
        
        let pMod = skillData?.total;
        if (pMod === undefined || pMod === null) {
            const abilityKey = skillData?.ability || "int";
            pMod = playerActor.system.abilities[abilityKey]?.mod || 0;
        }

        const roll = new Roll("1d20 + @mod", { mod: pMod });
        await roll.evaluate();
        
        // Показываем игроку результат
        await roll.toMessage({ 
            flavor: `🔍 <b>Анализ существа</b> (Расследование)`, 
            speaker: ChatMessage.getSpeaker({ actor: playerActor }) 
        });

        const total = roll.total;
        let promptInstruction = "";

        if (total >= 20) {
            promptInstruction = "Reveal EVERYTHING: Appearance, Race/Type, Habitat, Weaknesses, Resistances, HP, and Armor Class.";
        } else if (total >= 16) {
            promptInstruction = "Reveal: Appearance, Race/Type, Habitat, Weaknesses, and Resistances. (Do NOT reveal HP/AC).";
        } else if (total >= 10) {
            promptInstruction = "Reveal: Appearance, Race/Type, Habitat, and ONE Weakness (if any).";
        } else if (total >= 2) {
            promptInstruction = "Reveal ONLY: Appearance and Race/Type. Mention distinctive features.";
        } else {
            promptInstruction = "The player understands NOTHING. Describe confusing or misleading features.";
        }

        const triggerText = `
        [SYSTEM EVENT]: The player ANALYZES you (Roll: ${total}). 
        INSTRUCTION: ${promptInstruction}
        Format: Provide a concise, narrative observation describing yourself based strictly on the allowed info above.
        `;

        await BlueManFlagHandler.requestAI(dialog, triggerText, {});
    }

    // --- СОЦИАЛЬНЫЕ БРОСКИ И РЕПУТАЦИЯ ---
    static async handleSocialAction(action, dialog, event) {
        if (event) { try { event.preventDefault(); event.stopPropagation(); } catch(e) {} }

        const playerActor = dialog.playerToken.actor;
        const npcActor = dialog.npcToken.actor;
        const npcTokenDoc = dialog.npcToken.document;

        if (!playerActor || !npcActor) return ui.notifications.error("Ошибка: Актеры не найдены.");

        const configMap = {
            "roll-insight": { 
                skill: "ins", contestSkill: "dec", contestAbility: "cha", label: "Проницательность", icon: "👁️", flagKey: "insightSuccess",
                promptSuccess: "Player Insight SUCCESS. Reveal a hint about your secret.",
                promptFail: "Player Insight FAILED. You are suspicious."
            },
            "roll-persuasion": { 
                skill: "per", contestSkill: "ins", contestAbility: "wis", label: "Убеждение", icon: "💬", flagKey: "persuaded",       
                promptSuccess: "Player Persuasion SUCCESS. You are friendly/agreeable.",
                promptFail: "Player Persuasion FAILED. You refuse."
            },
            "roll-intimidation": { 
                skill: "itm", contestSkill: "ins", contestAbility: "wis", label: "Запугивание", icon: "💀", flagKey: "intimidated",     
                promptSuccess: "Player Intimidation SUCCESS. You are scared.",
                promptFail: "Player Intimidation FAILED. You are NOT scared."
            },
            "roll-performance": { 
                skill: "prf", contestSkill: "ins", contestAbility: "wis", label: "Выступление", icon: "🎵", flagKey: "performed",       
                promptSuccess: "Player Performance SUCCESS. You are charmed.",
                promptFail: "Player Performance FAILED. You are unimpressed."
            }
        };

        const config = configMap[action];
        if (!config) return null;

        await BlueManButtonHandler._addSystemLog(npcTokenDoc, `${config.icon} <b>Попытка:</b> ${config.label}`);
        dialog.render(false);

        // --- 1. БРОСОК ИГРОКА (Золотая формула) ---
        const pSkillData = playerActor.system.skills[config.skill];
        let pMod = pSkillData?.total;
        
        if (pMod === undefined || pMod === null) {
            const abilityKey = pSkillData?.ability || "cha"; // Default Charisma usually
            pMod = playerActor.system.abilities[abilityKey]?.mod || 0;
        }
        
        const pRoll = new Roll("1d20 + @mod", { mod: pMod });
        await pRoll.evaluate();
        const pTotal = pRoll.total;
        
        const d20Result = pRoll.terms[0]?.results?.[0]?.result || 10;
        const isCritSuccess = d20Result === 20;
        const isCritFail = d20Result === 1;

        if (!game.user.isGM) {
            await pRoll.toMessage({ 
                flavor: `🎲 <b>${config.label}</b> (Игрок)`, 
                speaker: ChatMessage.getSpeaker({ actor: playerActor }) 
            });
        }

        // --- 2. БРОСОК NPC (Встречный - тоже по формуле) ---
        let nMod = 0;
        let nLabel = "Характеристика";

        if (npcActor.system.skills && npcActor.system.skills[config.contestSkill]) {
            const nSkillData = npcActor.system.skills[config.contestSkill];
            nMod = nSkillData.total; // У NPC обычно total работает лучше, но перестрахуемся
            
            if (nMod === undefined || nMod === null) {
                const abilityKey = nSkillData.ability || (config.contestSkill === 'dec' ? "cha" : "wis");
                nMod = npcActor.system.abilities[abilityKey]?.mod || 0;
            }
            nLabel = config.contestSkill === 'dec' ? "Обман" : "Проницательность";
        } else {
            // Фолбэк на чистую характеристику
            const abKey = config.contestAbility || "wis";
            nMod = npcActor.system.abilities[abKey]?.mod || 0;
            nLabel = abKey === "cha" ? "Харизма" : "Мудрость";
        }

        const nRoll = new Roll("1d20 + @mod", { mod: nMod });
        await nRoll.evaluate();
        const nTotal = nRoll.total;

        // --- 3. ИТОГ ---
        const isSuccess = pTotal >= nTotal;
        let repChange = 0;

        if (action !== "roll-insight") {
            if (isSuccess) {
                repChange = isCritSuccess ? 8 : 4;
            } else {
                repChange = isCritFail ? -8 : -4;
            }
            await BlueManFlagHandler.changeReputation(npcTokenDoc, repChange);
        }

        // --- 4. КАРТОЧКА ---
        if (!game.user.isGM) {
            const resultColor = isSuccess ? "#2ecc71" : "#e74c3c"; 
            const resultText = isSuccess ? "УСПЕХ" : "ПРАВАЛ";
            let repText = "";
            if (repChange !== 0) {
                const sign = repChange > 0 ? "+" : "";
                const color = repChange > 0 ? "#f1c40f" : "#e74c3c";
                repText = `<br><span style="font-size:0.9em; color:${color}; font-weight:bold;">Отношение: ${sign}${repChange}</span>`;
            }

            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: npcActor }),
                content: `
                    <div style="background: rgba(15, 10, 6, 0.95); color: #ecf0f1; padding: 10px; border: 2px solid #7e6345; border-radius: 4px; font-family: 'Signika', sans-serif; box-shadow: 0 0 5px rgba(0,0,0,0.5);">
                        <h3 style="border-bottom: 1px solid #7e6345; margin-top:0; padding-bottom: 5px; color: #f1c40f; text-align:center; display:flex; align-items:center; justify-content:center; gap:8px;">
                            <i class="fas fa-gavel"></i> Социальный Поединок
                        </h3>
                        <div style="display:flex; justify-content:space-between; margin-bottom: 4px; align-items:center;">
                            <span><i class="fas fa-dice-d20"></i> Игрок:</span>
                            <b style="font-size:1.1em;">${pTotal}</b>
                        </div>
                        <div style="text-align:right; font-size: 0.8em; color: #bdc3c7; margin-bottom: 8px;">
                            ${config.label} (Mod: ${pMod >= 0 ? '+' : ''}${pMod})
                        </div>
                        <div style="border-top: 1px dashed #555; margin: 5px 0;"></div>
                        <div style="display:flex; justify-content:space-between; margin-bottom: 4px; align-items:center;">
                            <span><i class="fas fa-shield-alt"></i> ${npcActor.name}:</span>
                            <b style="font-size:1.1em;">${nTotal}</b>
                        </div>
                        <div style="text-align:right; font-size: 0.8em; color: #bdc3c7; margin-bottom: 10px;">
                            ${nLabel} (Mod: ${nMod >= 0 ? '+' : ''}${nMod})
                        </div>
                        <div style="text-align: center; font-weight: bold; font-size: 1.4em; padding: 8px 0; background: rgba(0,0,0,0.3); border-radius: 4px; color: ${resultColor}; border: 1px solid ${resultColor};">
                            ${resultText}
                        </div>
                        <div style="text-align:center; margin-top:5px;">
                            ${repText}
                        </div>
                    </div>
                `,
                type: CONST.CHAT_MESSAGE_STYLES.OTHER, 
                sound: null 
            });
        }

        let currentStatus = npcTokenDoc.getFlag(MOD_ID, 'socialStatus') || {};
        
        if (isSuccess) {
            ui.notifications.info(`${config.label}: Успех! (${pTotal} vs ${nTotal})`);
            currentStatus[config.flagKey] = true;
            await BlueManFlagHandler.set(npcTokenDoc, 'socialStatus', currentStatus);
        } else {
            ui.notifications.warn(`${config.label}: Провал. (${pTotal} vs ${nTotal})`);
        }

        if (dialog.render) dialog.render(false);

        if (game.user.isGM) return;

        let promptBase = isSuccess ? config.promptSuccess : config.promptFail;
        if (repChange !== 0) {
            promptBase += ` Your opinion of the player has shifted by ${repChange} points.`;
        }
        const triggerText = `[SYSTEM EVENT]: ${promptBase} (Rolled ${pTotal} vs Opposition ${nTotal})`;
        await BlueManFlagHandler.requestAI(dialog, triggerText, currentStatus);
    }
    
    // --- ПРЕДЛОЖИТЬ ПРЕДМЕТ (С УДАЛЕНИЕМ) ---
    static async handleOfferItem(dialog) {
        const playerActor = dialog.playerToken.actor;
        const npcTokenDoc = dialog.npcToken.document;

        const items = playerActor.items.filter(i => 
            ["weapon", "equipment", "consumable", "tool", "loot", "backpack"].includes(i.type)
        );

        if (items.length === 0) return ui.notifications.warn("Ваш инвентарь пуст.");

        let content = `
        <div style="margin-bottom: 10px; color: #cbb497;">Выберите предмет для передачи:</div>
        <div class="blue-man-item-list" style="max-height: 250px; overflow-y: auto;">`;

        items.forEach(i => {
            content += `
            <label class="blue-man-item-row" style="display:flex; align-items:center; gap:8px; margin-bottom:4px; padding:4px; border-bottom:1px solid rgba(74,59,42,0.5); cursor:pointer;">
                <input type="radio" name="itemId" value="${i.id}" style="margin:0;">
                <img src="${i.img}" width="32" height="32" style="border:1px solid #4a3b2a; background:#000;">
                <span style="color:#e0d0b8; font-weight:bold;">${i.name}</span>
                <span style="color:#888; font-size:0.9em; margin-left:auto;">x${i.system.quantity || 1}</span>
            </label>`;
        });
        content += `</div>`;

        new Dialog({
            title: `Передать предмет`,
            content: content,
            buttons: {
                offer: {
                    icon: '<i class="fas fa-hand-holding"></i>',
                    label: "Отдать предмет",
                    callback: async (html) => {
                        const itemId = html.find('input[name="itemId"]:checked').val();
                        if (!itemId) return;

                        const item = playerActor.items.get(itemId);
                        if (!item) return;

                        const itemData = item.toObject();
                        delete itemData._id; 
                        itemData.system.quantity = 1; 

                        if (item.system.quantity > 1) {
                            await item.update({"system.quantity": item.system.quantity - 1});
                        } else {
                            await item.delete(); 
                        }

                        await BlueManFlagHandler.transferItem(npcTokenDoc, itemData, playerActor.name);
                    }
                }
            },
            default: "offer"
        }, { classes: ["dialog", "blue-man-ai-window"] }).render(true);
    }

    // --- УТИЛИТЫ ---
    static async handleUtilityAction(action, dialog) {
        if (action === "dm-give-item") return this.giveItemToPlayer(dialog);
        
        const shopPref = game.settings.get(MOD_ID, "shopSystem") || "auto";
        const thmActive = !!game.THM;
        const ipActive = !!game.modules.get("item-piles")?.active;
        const useTHM = (shopPref === "thm" && thmActive) || (shopPref === "auto" && thmActive);
        const useIP = (shopPref === "item-piles" && ipActive) || (shopPref === "auto" && !useTHM && ipActive);

        if (action === "trade-open") {
            if (useTHM) {
                const isTHMShop = dialog.npcToken.document.getFlag("treasure-hoard-manager", "data")?.type === "shop";
                if (isTHMShop) return game.THM.uiManager.showShopInterface(dialog.npcToken.actor);
            }
            if (useIP) {
                if (game.itempiles.API.isValidItemPile(dialog.npcToken.document)) {
                    return game.itempiles.API.renderItemPileInterface(dialog.npcToken);
                }
            }
            return ui.notifications.warn("Магазин не настроен или модуль отключен.");
        }
        
        if (action === "dm-toggle-merchant") {
            if (!game.user.isGM) return;
            
            if (useTHM) {
                game.THM.uiManager.showConfig(dialog.npcToken.actor);
                ui.notifications.info("Открыты настройки Treasure Hoard Manager.");
            } else if (useIP) {
                const isMerchantIP = game.itempiles.API.isValidItemPile(dialog.npcToken.document);
                if (isMerchantIP) {
                    await game.itempiles.API.revertTokensFromItemPiles(dialog.npcToken);
                    ui.notifications.info("NPC больше не торговец (Item Piles).");
                } else {
                    await game.itempiles.API.turnTokensIntoItemPiles(dialog.npcToken, {
                        pileSettings: { type: "merchant", merchant: { type: "merchant" } }
                    });
                    ui.notifications.info("NPC стал торговцем (Item Piles).");
                }
            } else {
                ui.notifications.warn("Модуль магазина не выбран или не активен.");
            }
            setTimeout(() => dialog.render(false), 500);
        }
    }

    // --- ВЫДАТЬ НАГРАДУ (НПС -> ИГРОК) ---
    static async giveItemToPlayer(dialog) {
        const npc = dialog.npcToken.actor;
        const player = dialog.playerToken.actor;
        const items = npc.items.filter(i => 
            ["weapon", "equipment", "consumable", "tool", "loot", "backpack"].includes(i.type)
        );
        
        const cur = npc.system.currency;
        const currencyConfig = {
            pp: { label: "Платина", max: cur.pp || 0, icon: "fas fa-gem" },
            gp: { label: "Золото", max: cur.gp || 0, icon: "fas fa-coins" },
            ep: { label: "Электрум", max: cur.ep || 0, icon: "fas fa-bolt" },
            sp: { label: "Серебро", max: cur.sp || 0, icon: "fas fa-moon" },
            cp: { label: "Медь", max: cur.cp || 0, icon: "fas fa-circle" }
        };

        let htmlContent = `<form style="padding: 10px;">`;
        if (items.length > 0) {
            htmlContent += `<div style="margin-bottom: 15px; color:#cbb497;"><strong>Предметы:</strong><div class="blue-man-item-list" style="max-height: 150px; overflow-y: auto;">`;
            items.forEach(i => {
                htmlContent += `
                <label class="blue-man-item-row" style="display:flex; align-items:center; gap:8px; margin-bottom:4px; cursor:pointer;">
                    <input type="checkbox" name="itemIds" value="${i.id}">
                    <img src="${i.img}" width="24" height="24" style="border:1px solid #4a3b2a;">
                    <span style="color:#e0d0b8;">${i.name}</span>
                    <span style="color:#888; margin-left:auto;">x${i.system.quantity || 1}</span>
                </label>`;
            });
            htmlContent += `</div></div>`;
        } else {
            htmlContent += `<p style="color: #777;"><i>У НПС нет предметов для передачи.</i></p>`;
        }

        htmlContent += `<strong style="color:#cbb497;">Валюта:</strong><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">`;
        for (const [key, data] of Object.entries(currencyConfig)) {
            htmlContent += `
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 3px;">
                <span title="${data.label}" style="color:#e0d0b8;"><i class="${data.icon}" style="width: 20px; text-align: center;"></i> ${key.toUpperCase()}</span>
                <input type="number" name="currency-${key}" value="0" min="0" max="${data.max}" style="width: 60px; text-align: right;">
                <span style="font-size: 10px; color: #888; width: 40px; text-align: right;">/${data.max}</span>
            </div>`;
        }
        htmlContent += `</div></form>`;

        new Dialog({
            title: `Награда от ${npc.name}`,
            content: htmlContent,
            buttons: {
                give: {
                    icon: '<i class="fas fa-hand-holding-usd"></i>',
                    label: "Выдать награду",
                    callback: async (html) => {
                        const form = html[0].querySelector("form");
                        const selectedCheckboxes = form.querySelectorAll('input[name="itemIds"]:checked');
                        const itemIds = Array.from(selectedCheckboxes).map(cb => cb.value);
                        
                        const transferCurrency = {};
                        let hasCurrency = false;
                        for (const key of Object.keys(currencyConfig)) {
                            const val = parseInt(form.querySelector(`input[name="currency-${key}"]`).value) || 0;
                            if (val > 0) {
                                transferCurrency[key] = val;
                                hasCurrency = true;
                            }
                        }

                        if (itemIds.length === 0 && !hasCurrency) return;

                        let messageParts = [];

                        if (itemIds.length > 0) {
                            const itemsToTransfer = itemIds.map(id => npc.items.get(id)).filter(i => i);
                            const itemsData = itemsToTransfer.map(i => i.toObject());
                            await player.createEmbeddedDocuments("Item", itemsData);
                            await npc.deleteEmbeddedDocuments("Item", itemIds);
                            
                            const names = itemsToTransfer.map(i => i.name).join(", ");
                            messageParts.push(`Предметы: ${names}`);
                        }

                        if (hasCurrency) {
                            const npcNewCur = foundry.utils.deepClone(npc.system.currency);
                            const playerNewCur = foundry.utils.deepClone(player.system.currency);
                            
                            let curStr = [];
                            for (const [key, amount] of Object.entries(transferCurrency)) {
                                npcNewCur[key] -= amount;
                                playerNewCur[key] += amount;
                                curStr.push(`${amount}${key}`);
                            }
                            
                            await npc.update({"system.currency": npcNewCur});
                            await player.update({"system.currency": playerNewCur});
                            messageParts.push(`Деньги: ${curStr.join(", ")}`);
                        }

                        const finalMessage = `Получено: ${messageParts.join("; ")}`;
                        ui.notifications.info(finalMessage);

                        let history = dialog.npcToken.document.getFlag(MOD_ID, 'chatHistory') || [];
                        history.push({ speaker: "Система", text: finalMessage, isSystem: true });
                        await BlueManFlagHandler.set(dialog.npcToken.document, 'chatHistory', history);
                        
                        dialog.render(true);
                    }
                }
            },
            default: "give"
        }, { classes: ["dialog", "blue-man-ai-window"] }).render(true);
    }

    // --- ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ЛОГА ---
    static async _addSystemLog(tokenDoc, message) {
        let history = tokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
        history.push({ 
            speaker: "Система", 
            text: `<i>${message}</i>`, 
            isSystem: true 
        });
        await BlueManFlagHandler.set(tokenDoc, 'chatHistory', history);
    }
}