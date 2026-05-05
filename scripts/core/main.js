import { registerSettings, MOD_ID } from './settings.js';
import { BlueManDebugger } from './debug.js';
import { BlueManDialog } from '../systems/ui/dialog-window.js';
import { initializeAmbientTalk } from '../systems/ambient-system/ambient-logic.js';
import { AIProviders } from './ai-providers.js';
import { callGemini } from './ai-logic.js';
import { NpcCollector } from './npc-collector.js';
import { applyCompatibilityFixes } from '../systems/integrations/compatibility.js';
import { initPatrolIntegration } from '../systems/integrations/patrol.js';
import { BlueManFlagHandler } from './flag-handler.js';
import { BlueManMarkers } from '../systems/ui/markers.js';
import { BlueManQuestLog } from '../systems/quest-system/quest-log.js';
import { BlueManRewardDialog } from '../systems/quest-system/reward-dialog.js';
import { NoticeBoardConfig, NoticeBoardApp } from '../systems/quest-system/notice-board.js';
import { BlueManSystemManager } from '../systems/adapters/system-manager.js';

Hooks.once('init', () => {
    applyCompatibilityFixes();
    registerSettings();
    BlueManSystemManager.init();

    // --- ДОБАВЛЕНО: ЗАГРУЗКА ТЕМЫ ---
    const theme = game.settings.get(MOD_ID, "theme");
    const systemId = game.system.id;

    if (theme === "cpr" || (theme === "auto" && systemId === "cyberpunk-red-core")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = `modules/${MOD_ID}/styles/style-cpr.css`;
        document.head.appendChild(link);
        console.log("Blue Man AI | Загружена тема: Cyberpunk Red");
    }

    game.keybindings.register(MOD_ID, "interactNpc", {
        name: "Поговорить с NPC / Открыть Доску",
        hint: "Наведите мышь на NPC или Доску и нажмите клавишу.",
        editable: [{ key: "KeyX" }],
        onDown: () => attemptInteractionSmart(),
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });

    console.log(`Blue Man AI | Init complete. v0.13.16 (${game.blueManAI.adapter.id} adapter ready).`);
});

Hooks.on("updateSetting", (setting, change, options, userId) => {
    if (setting.key === `${MOD_ID}.questData`) {
        const openLog = Object.values(ui.windows).find(w => w.id === "blue-man-quest-log");
        if (openLog) {
            openLog.render(true);
        }
    }
});

Hooks.on("updateToken", (tokenDoc, change, options, userId) => {
    if (change.flags?.[MOD_ID]?.questLoot !== undefined) {
        const loot = change.flags[MOD_ID].questLoot;
        Object.values(ui.windows).forEach(app => {
            if (app instanceof BlueManRewardDialog && app.npcToken.id === tokenDoc.id) {
                app.updateItems(loot);
            }
        });
    }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
    const flags = message.flags?.[MOD_ID];
    if (flags && (
        flags.action === "aiRequest" ||
        flags.action === "forceOpen" ||
        flags.action === "set" ||
        flags.action === "unset" ||
        flags.action === "changeReputation" ||
        flags.action === "transferItem" ||
        flags.action === "stealItem" ||
        flags.action === "triggerAlarm" ||
        flags.action === "showQuestOffer" ||
        flags.action === "acceptQuest" ||
        flags.action === "openRewardWindow" ||
        flags.action === "openBoardRewardWindow" ||
        flags.action === "claimReward" ||
        flags.action === "showBubble" || // [NEW] Скрываем бабл-команду
        flags.action === "distributeBoardRewards" // [NEW] ДОБАВИТЬ ЭТО
    )) {
        if (html instanceof HTMLElement) {
            html.style.display = "none";
        }
        return false;
    }
});

Hooks.once('ready', () => {
    initPatrolIntegration();
    initializeAmbientTalk(); // ✅ Возвращаем - работает с условиями, не спамит AI
    BlueManMarkers.init();
    Hooks.on('canvasReady', makeBoardsInteractive);

    Hooks.on('createChatMessage', async (message, options, userId) => {
        const action = message.getFlag(MOD_ID, "action");
        if (!action) return;

        // [NEW] Обработка команды показа бабла
        if (action === "showBubble") {
            const tokenId = message.getFlag(MOD_ID, "tokenId");
            const text = message.getFlag(MOD_ID, "text");
            const emote = message.getFlag(MOD_ID, "emote"); // true/false

            const token = canvas.tokens.get(tokenId);
            if (token) {
                // Вызываем метод отрисовки бабла (он локальный для каждого клиента)
                // Хак с пробелами для длительности
                const padding = "\u200B".repeat(80);

                canvas.hud.bubbles.say(token, text + padding, {
                    emote: emote ?? false,
                    pan: false,
                    ensureVisible: false
                });
            }
            return;
        }

        if (action === "forceOpen") {
            const amITarget = message.whisper.includes(game.user.id);

            if (amITarget) {
                const npcId = message.getFlag(MOD_ID, "npcTokenId");
                const playerId = message.getFlag(MOD_ID, "playerTokenId");
                const greeting = message.getFlag(MOD_ID, "greetingText");
                const patrolId = message.getFlag(MOD_ID, "patrolId");

                const npcToken = canvas.tokens.get(npcId);
                const playerToken = canvas.tokens.get(playerId);

                if (npcToken && playerToken) {
                    const localHistory = npcToken.document.getFlag(MOD_ID, 'chatHistory') || [];

                    const tempMsg = {
                        speaker: npcToken.name,
                        text: greeting,
                        isSystem: false,
                        isWhisper: false,
                        ownerId: userId
                    };
                    const lastMsg = localHistory[localHistory.length - 1];
                    if (!lastMsg || lastMsg.text !== greeting) {
                        localHistory.push(tempMsg);
                    }

                    const dialog = new BlueManDialog(npcToken, playerToken);
                    dialog.localHistoryOverride = localHistory;
                    dialog.patrolId = patrolId; // Сохраняем patrolId для возобновления
                    dialog.render(true);
                }
            }
            return;
        }

        if (action === "showQuestOffer") {
            const amITarget = message.whisper.includes(game.user.id);

            if (amITarget) {
                const questName = message.getFlag(MOD_ID, "questName");
                const sourceName = message.getFlag(MOD_ID, "sourceName");
                const questUuid = message.getFlag(MOD_ID, "questUuid");

                new Dialog({
                    title: `Предложение задания`,
                    content: `
                        <div style="text-align: center; font-family: 'Signika', sans-serif; color: #e0d0b8;">
                            <h3>${sourceName} предлагает задание:</h3>
                            <div style="font-size: 1.2em; font-weight: bold; color: #f1c40f; margin: 10px 0;">
                                <i class="fas fa-scroll"></i> ${questName}
                            </div>
                            <p>Принять это задание в журнал группы?</p>
                        </div>
                    `,
                    buttons: {
                        yes: {
                            label: "Принять",
                            icon: "<i class='fas fa-check'></i>",
                            callback: async () => {
                                await BlueManFlagHandler.acceptQuest(questUuid, sourceName);
                                ui.notifications.info("Запрос отправлен...");
                                setTimeout(() => {
                                    new BlueManQuestLog().render(true);
                                }, 500);
                            }
                        },
                        no: {
                            label: "Отказаться",
                            icon: "<i class='fas fa-times'></i>"
                        }
                    },
                    default: "yes"
                }, { classes: ["dialog", "blue-man-ai-window"] }).render(true);
            }
            return;
        }

        if (action === "openRewardWindow") {
            const amITarget = message.whisper.includes(game.user.id);

            if (amITarget) {
                const tokenId = message.getFlag(MOD_ID, "tokenId");
                const token = canvas.tokens.get(tokenId);

                if (token) {
                    new BlueManRewardDialog(token).render(true);
                }
            }
            return;
        }

        if (action === "openBoardRewardWindow") {
            const amITarget = message.whisper.includes(game.user.id);

            if (amITarget) {
                const actorId = message.getFlag(MOD_ID, "actorId");
                const actor = game.actors.get(actorId);

                if (actor) {
                    // Создаем временный токен для актера-болванки
                    const tempToken = {
                        id: actor.id,
                        document: actor,
                        actor: actor
                    };
                    new BlueManRewardDialog(tempToken, true).render(true); // Передаем флаг доски объявлений
                }
            }
            return;
        }

        if (!game.user.isGM) return;

        if (action === "claimReward") {
            const tokenId = message.getFlag(MOD_ID, "tokenId");
            const itemIndex = message.getFlag(MOD_ID, "itemIndex");
            const actorId = message.getFlag(MOD_ID, "actorId");

            await BlueManFlagHandler._processClaim(tokenId, itemIndex, actorId);
            return;
        }

        const flags = {
            action: action,
            tokenId: message.getFlag(MOD_ID, "tokenId"),
            playerTokenId: message.getFlag(MOD_ID, "playerTokenId"),
            sceneId: message.getFlag(MOD_ID, "sceneId"),
            key: message.getFlag(MOD_ID, "key"),
            value: message.getFlag(MOD_ID, "value"),
            text: message.getFlag(MOD_ID, "text"),
            socialStatus: message.getFlag(MOD_ID, "socialStatus"),
            isWhisper: message.getFlag(MOD_ID, "isWhisper"),
            history: message.getFlag(MOD_ID, "history"),
            userId: message.getFlag(MOD_ID, "userId"),
            delta: message.getFlag(MOD_ID, "delta"),
            itemData: message.getFlag(MOD_ID, "itemData"),
            senderName: message.getFlag(MOD_ID, "senderName"),
            questUuid: message.getFlag(MOD_ID, "questUuid"),
            sourceName: message.getFlag(MOD_ID, "sourceName"),
            // Добавляем флаги для доски объявлений
            rewards: message.getFlag(MOD_ID, "rewards"),
            questName: message.getFlag(MOD_ID, "questName"),
            actorId: message.getFlag(MOD_ID, "actorId"),
            itemIndex: message.getFlag(MOD_ID, "itemIndex")
        };

        setTimeout(async () => {
            if (message && message.id) try { await message.delete(); } catch (e) { }
        }, 1000);

        const scene = game.scenes.get(flags.sceneId) || canvas.scene;
        const npcTokenDoc = scene?.tokens.get(flags.tokenId);

        try {
            if (flags.action === "set" && npcTokenDoc) await npcTokenDoc.setFlag(MOD_ID, flags.key, flags.value);
            if (flags.action === "unset" && npcTokenDoc) await npcTokenDoc.unsetFlag(MOD_ID, flags.key);

            if (flags.action === "changeReputation" && npcTokenDoc) {
                await BlueManFlagHandler.changeReputation(npcTokenDoc, flags.delta);
            }

            if (flags.action === "transferItem" && npcTokenDoc) {
                await BlueManFlagHandler.transferItem(npcTokenDoc, flags.itemData, flags.senderName);
            }

            if (flags.action === "stealItem" && npcTokenDoc) {
                await BlueManFlagHandler.stealItem(npcTokenDoc, flags.itemData, flags.playerTokenId);
            }

            if (flags.action === "triggerAlarm" && npcTokenDoc) {
                await BlueManFlagHandler.triggerAlarm(npcTokenDoc);
            }

            if (flags.action === "acceptQuest") {
                await BlueManFlagHandler.acceptQuest(flags.questUuid, flags.sourceName);
            }

            if (flags.action === "distributeBoardRewards") {
                console.log("🎁 Получен запрос на раздачу наград доски:", {
                    flags: flags,
                    rewards: flags.rewards,
                    rewardsType: typeof flags.rewards,
                    questName: flags.questName,
                    allFlags: message.flags
                });
                await BlueManFlagHandler._distributeBoardRewards(flags.rewards, flags.questName);

                console.log("✅ Board rewards distributed:", flags.questName);
            }

            if (flags.action === "claimReward") {
                const tokenId = flags.tokenId;
                const itemIndex = flags.itemIndex;
                const actorId = flags.actorId;

                await BlueManFlagHandler._processClaim(tokenId, itemIndex, actorId);
                return;
            }

            if (flags.action === "aiRequest" && npcTokenDoc) {
                const npcData = NpcCollector.collect(npcTokenDoc);
                if (!npcData) return;

                let languageInfo = { hasShared: true, sharedLang: "Common", npcLangs: "Unknown" };
                const playerTokenDoc = scene.tokens.get(flags.playerTokenId);
                const playerActor = playerTokenDoc?.actor;

                if (playerActor) {
                    const adapter = BlueManSystemManager.adapter;
                    const pLangs = new Set(adapter.getLanguages(playerActor));
                    const nLangs = new Set(adapter.getLanguages(npcTokenDoc.actor));
                    let shared = [...pLangs].filter(x => nLangs.has(x));

                    if (shared.length > 0) {
                        languageInfo.hasShared = true;
                        languageInfo.sharedLang = shared[0];
                    } else {
                        languageInfo.hasShared = false;
                        languageInfo.npcLangs = npcData.languages.join(", ");
                    }
                }

                let history = flags.history || npcTokenDoc.getFlag(MOD_ID, 'chatHistory') || [];
                if (flags.history) await npcTokenDoc.setFlag(MOD_ID, 'chatHistory', history);

                let response = await callGemini(flags.text, npcData, {
                    socialStatus: flags.socialStatus,
                    isWhisper: flags.isWhisper,
                    languageInfo: languageInfo
                }, history);

                let opinionDelta = 0;
                const opinionRegex = /\[OPINION:?\s*([+-]?\d+)\s*\]/gi;
                const opinionMatch = [...response.matchAll(opinionRegex)];

                if (opinionMatch.length > 0) {
                    opinionDelta = parseInt(opinionMatch[0][1], 10);
                    response = response.replace(opinionRegex, "").trim();
                }

                if (opinionDelta !== 0) {
                    await BlueManFlagHandler.changeReputation(npcTokenDoc, opinionDelta);
                    const msg = opinionDelta > 0 ? "НПС: Это понравилось (+1)" : "НПС: Это не понравилось (-1)";
                    const color = opinionDelta > 0 ? "#2ecc71" : "#e74c3c";

                    history.push({
                        speaker: "Система",
                        text: `<span style="color:${color}; font-size: 0.9em;"><i>${msg}</i></span>`,
                        isSystem: true
                    });
                }

                history.push({
                    speaker: npcData.name,
                    text: response,
                    isSystem: false,
                    isWhisper: false,
                    ownerId: flags.userId
                });
                await npcTokenDoc.setFlag(MOD_ID, 'chatHistory', history);
            }
        } catch (err) { console.error("Handler Error:", err); }
    });
});

/**
 * Безопасный вызов уведомлений, чтобы избежать ошибок в консоли
 */
function safeNotify(type, message) {
    if (ui.notifications && ui.notifications.active) {
        ui.notifications[type](message);
    } else {
        console.log(`Blue Man AI | ${type.toUpperCase()}: ${message}`);
        // Пробуем еще раз через небольшую паузу
        setTimeout(() => {
            if (ui.notifications && ui.notifications.active) ui.notifications[type](message);
        }, 500);
    }
}

function attemptInteractionSmart() {
    // 1. ПРОВЕРКА ПОД КУРСОРОМ (Canvas)
    const mousePos = canvas.mousePosition;

    // Ищем тайл под курсором (Доска объявлений)
    const hoveredTile = canvas.tiles.placeables.find(t => t.bounds.contains(mousePos.x, mousePos.y));
    if (hoveredTile) {
        const flags = hoveredTile.document.getFlag(MOD_ID, 'board');
        if (flags && flags.boardFolderUuid) {
            new NoticeBoardApp(hoveredTile.document).render(true);
            return;
        }
    }

    // 2. СТАНДАРТНАЯ ЛОГИКА NPC
    let potentialPlayer = null;
    let potentialNpc = null;

    // Ищем игрока
    if (canvas.tokens.controlled.length > 0) {
        potentialPlayer = canvas.tokens.controlled.find(t => t.actor?.hasPlayerOwner) || canvas.tokens.controlled[0];
    } else if (game.user.character) {
        potentialPlayer = canvas.tokens.placeables.find(t => t.actor?.id === game.user.character.id);
    }

    // Ищем NPC под курсором
    if (canvas.tokens.hover) {
        const actor = canvas.tokens.hover.actor;
        if (actor) {
            const isPc = actor.hasPlayerOwner;
            // ГМ может говорить со всеми, игрок только с NPC
            if (game.user.isGM || !isPc) {
                potentialNpc = canvas.tokens.hover;
            }
        }
    }

    if (!potentialPlayer) {
        safeNotify("warn", "Не найден ваш персонаж на сцене.");
        return;
    }
    if (!potentialNpc) {
        safeNotify("warn", "Выберите NPC для разговора или наведите на доску.");
        return;
    }

    new BlueManDialog(potentialNpc, potentialPlayer).render(true);
}

function initiateChatFromHUD(npcToken) {
    const targets = Array.from(game.user.targets);
    let playerToken = targets[0] || canvas.tokens.controlled[0];

    if (!playerToken) {
        const userChar = game.user.character;
        if (userChar) {
            playerToken = canvas.tokens.placeables.find(t => t.actor?.id === userChar.id);
        }
    }

    if (!playerToken && !game.user.isGM) {
        return ui.notifications.warn("Выберите своего персонажа!");
    }

    // Защита от общения с игроками
    if (!game.user.isGM && npcToken.actor?.hasPlayerOwner) {
        return ui.notifications.warn("Вы не можете использовать ИИ для разговора с другими игроками.");
    }

    new BlueManDialog(npcToken, playerToken).render(true);
}

Hooks.on('renderTokenHUD', (app, html, data) => {
    const token = app.object;
    if (!token?.actor) return;

    const $html = $(html);
    const $colLeft = $html.find('.col.left');

    if (!$colLeft.length) {
        console.warn("Blue Man AI | HUD Error: .col.left not found!");
        return;
    }

    if (token.actor.type === "npc" || token.actor.type === "mook") {
        if ($colLeft.find('.blue-man-chat-btn').length) return;

        const chatBtn = $(`
            <div class="control-icon blue-man-chat-btn" title="Поговорить с NPC (Blue Man AI)" style="cursor: pointer;">
                <i class="fas fa-comment-dots" style="color:#6fbff9"></i>
            </div>
        `);

        chatBtn.click((ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            initiateChatFromHUD(token);
        });

        // APPEND = BOTTOM
        $colLeft.append(chatBtn);
    }

    if (token.actor.type === "character") {
        if ($colLeft.find('.blue-man-quest-btn').length) return;

        const questBtn = $(`
            <div class="control-icon blue-man-quest-btn" title="Журнал Заданий Группы" style="cursor: pointer;">
                <i class="fas fa-scroll" style="color:#f1c40f"></i>
            </div>
        `);

        questBtn.click((ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            new BlueManQuestLog().render(true);
        });

        // APPEND = BOTTOM
        $colLeft.append(questBtn);
    }
});

Hooks.on('renderTileHUD', (app, html, data) => {
    if (!game.user.isGM) return;

    const tileDocument = app.object.document;
    const $html = $(html);
    const $colRight = $html.find('.col.right');

    if (!$colRight.length) {
        console.warn("Blue Man AI | Tile HUD Error: .col.right not found!");
        return;
    }

    // Проверяем, нет ли уже кнопки
    if ($colRight.find('.blue-man-notice-board-btn').length) return;

    const noticeBoardBtn = $(`
        <div class="control-icon blue-man-notice-board-btn" title="Настроить Доску Объявлений" style="cursor: pointer;">
            <i class="fas fa-clipboard-list" style="color:#3498db;"></i>
        </div>
    `);

    noticeBoardBtn.click((ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        new NoticeBoardConfig(tileDocument).render(true);
    });

    $colRight.append(noticeBoardBtn);
});


Hooks.on('updateToken', (tokenDocument, change, options, userId) => {
    if (change.flags?.[MOD_ID]) {
        Object.values(ui.windows).forEach(app => {
            if (app instanceof BlueManDialog && app.npcToken.id === tokenDocument.id) {
                app.localHistoryOverride = null;
                app.render(false);
            }
        });
    }

    if (foundry.utils.hasProperty(change, "flags.item-piles.data.merchant")) {
        Object.values(ui.windows).forEach(app => {
            const appTokenId = app?.token?.id || app?.object?.id || app?.options?.token?.id;
            if (appTokenId === tokenDocument.id) {
                if (app.constructor.name === "MerchantApp" || app.id.includes("item-pile")) {
                    console.log(`Blue Man AI v0.5.9 | Удалены модели 1.5 поколения, обновлены рабочие модели`);
                    app.close().then(() => {
                        setTimeout(() => {
                            if (game.itempiles.API) {
                                game.itempiles.API.renderItemPileInterface(tokenDocument);
                            }
                        }, 100);
                    });
                }
            }
        });
    }
});

Hooks.on('updateActor', (actor, change, options, userId) => {
    if (change.flags?.["item-piles"]?.data?.merchant) {
        Object.values(ui.windows).forEach(app => {
            if ((app.actor && app.actor.id === actor.id) || (app.object && app.object.id === actor.id)) {
                if (app.constructor.name === "MerchantApp") {
                    console.log("Blue Man AI | Detected Actor price change. Refreshing Test Tube...");
                    app.close().then(() => {
                        setTimeout(() => {
                            if (game.itempiles.API) {
                                const token = actor.getActiveTokens()[0];
                                if (token) game.itempiles.API.renderItemPileInterface(token.document);
                            }
                        }, 100);
                    });
                }
            }
        });
    }
});
function handleBoardClick(event) {
    if (event.data.button !== 0) return; // Только левый клик
    const tile = event.currentTarget;
    if (tile && tile.document) {
        new NoticeBoardApp(tile.document).render(true);
    }
}

function makeBoardsInteractive() {
    if (!canvas.tiles?.placeables) return;
    for (let tile of canvas.tiles.placeables) {
        const flags = tile.document.getFlag(MOD_ID, 'board');
        if (flags && flags.boardFolderUuid) {
            tile.eventMode = 'static'; // PIXI v7: делает объект интерактивным
            tile.cursor = 'pointer';
            tile.off('pointerdown', handleBoardClick); // Защита от дублей
            tile.on('pointerdown', handleBoardClick);
        } else {
            tile.off('pointerdown', handleBoardClick);
            // Не меняем eventMode обратно, чтобы не сломать другие модули (например MATT)
        }
    }
}

Hooks.on('updateTile', (tileDocument, change) => {
    if (change.flags?.[MOD_ID]?.board !== undefined) {
        makeBoardsInteractive();
    }
});

Hooks.on('updateTile', (tileDocument, change) => {
    if (change.flags?.[MOD_ID]?.board !== undefined) {
        makeBoardsInteractive();
    }
});

