import { BlueManButtonHandler } from './button-handler.js';
import { MOD_ID } from '../../core/settings.js';
import { BlueManFlagHandler } from '../../core/flag-handler.js';
import { BlueManQuestConfig } from '../quest-system/quest-config.js';
import { BlueManMagicHandler } from './magic-handler.js'; 
import { BlueManQuestLog } from '../quest-system/quest-log.js';  

export class BlueManDialog extends FormApplication {
    constructor(npcToken, playerToken) {
        super();
        this.npcToken = npcToken;
        this.playerToken = playerToken;
        this.isWhisperingState = false; 
        this._submitting = false; 
        this.localHistoryOverride = null;
        this._savedInputText = "";

        const rawBio = npcToken.actor.system.details?.biography?.value || "";
        const cleanText = rawBio.replace(/<\/?[^>]+(>|$)/g, " ");
        const match = cleanText.match(/(?:Секрет|Secret)[\s:\-.,;]*([^\.\n!?]+)/i);
        this.secretText = match ? match[1].trim() : "";

        this._announcePresence();
    }

    async _announcePresence() {
        await BlueManFlagHandler.addViewer(this.npcToken.document, game.user.id);
    }

    async close(options) {
        await BlueManFlagHandler.removeViewer(this.npcToken.document, game.user.id);
        
        // ВОЗОБНОВЛЕНИЕ ПАТРУЛЯ ПОСЛЕ ЗАКРЫТИЯ ДИАЛОГА
        if (this.patrolId && game.patrol) {
            console.log("Blue Man AI | Resuming patrol after dialog:", this.patrolId);
            try {
                // Находим патруль по ID
                let patrol = game.patrol.patrols?.find(p => p.id === this.patrolId);
                
                // ФИКС: Если не нашли по ID, ищем по токену
                if (!patrol && this.npcToken) {
                    patrol = game.patrol.patrols?.find(p => p.token?.id === this.npcToken.id);
                    if (patrol) {
                        console.log("Blue Man AI | Found patrol by token on close:", patrol.id);
                    }
                }
                
                if (patrol) {
                    patrol.resume();
                    console.log("Blue Man AI | Patrol resumed successfully");
                } else {
                    console.warn("Blue Man AI | Patrol not found for resume. Available patrols:", game.patrol.patrols?.length || 0);
                }
            } catch (err) {
                console.error("Blue Man AI | Error resuming patrol:", err);
            }
        }
        
        return super.close(options);
    }

    async render(force, options) {
        if (this.element && this.element.length > 0) {
            const input = this.element.find('#ai-input')[0];
            const log = this.element.find('#message-log')[0];
            if (input) {
                this._savedInputText = input.value;
                this._savedSelectionStart = input.selectionStart;
                this._savedSelectionEnd = input.selectionEnd;
                this._wasFocused = document.activeElement === input;
            }
            if (log) {
                // Проверяем, был ли скролл в самом низу
                this._isScrolledToBottom = log.scrollHeight - log.clientHeight <= log.scrollTop + 10;
            }
        }
        await super.render(force, options);
        return this;
    }

    _filterHistory(history) {
        const listToUse = this.localHistoryOverride || history;
        if (game.user.isGM) return listToUse; 
        const currentUserId = game.user.id;
        return listToUse.filter(msg => {
            if (!msg.isWhisper) return true;
            return msg.ownerId === currentUserId;
        });
    }

    _enrichHistoryWithColors(history, npcName) {
        return history.map(msg => {
            const enriched = { ...msg };
            if (msg.speaker === npcName) {
                enriched.userColor = "#334155";
            } else {
                const user = game.users.get(msg.ownerId);
                enriched.userColor = user ? user.color.css : "#1e3a8a"; 
            }
            return enriched;
        });
    }

    _getReputationStatus(value) {
        if (value <= 10) return { label: "Ненависть", color: "#c0392b" }; 
        if (value <= 20) return { label: "Враждебность", color: "#e74c3c" };
        if (value <= 30) return { label: "Злость", color: "#d35400" };
        if (value <= 40) return { label: "Недовольство", color: "#e67e22" };
        if (value <= 59) return { label: "Нейтрально", color: "#f1c40f" }; 
        if (value <= 69) return { label: "Приветливость", color: "#f39c12" };
        if (value <= 79) return { label: "Дружелюбие", color: "#2ecc71" };
        if (value <= 89) return { label: "Доверие", color: "#27ae60" }; 
        return { label: "Почитание", color: "#2ecc71" };
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "blue-man-dialog",
            classes: ["blue-man-ai-window"],
            template: "modules/blue-man-ai/templates/dialog.html",
            width: 1100, 
            height: 750,
            resizable: true,
            title: "Диалог с NPC"
        });
    }

    getData() { 
        const fullHistory = this.npcToken.document.getFlag(MOD_ID, 'chatHistory') || [];
        const socialStatus = this.npcToken.document.getFlag(MOD_ID, 'socialStatus') || {};
        const isNameRevealed = this.npcToken.document.getFlag(MOD_ID, 'isNameRevealed') || false;
        const realName = this.npcToken.actor.name;
        const displayName = (game.user.isGM || isNameRevealed) ? realName : "Незнакомец";

        let isMerchant = false;
        const shopPref = game.settings.get(MOD_ID, "shopSystem") || "auto";
        const thmActive = !!game.THM;
        const isItemPilesActive = !!game.modules.get("item-piles")?.active;

        const useTHM = (shopPref === "thm" && thmActive) || (shopPref === "auto" && thmActive);
        const useIP = (shopPref === "item-piles" && isItemPilesActive) || (shopPref === "auto" && !useTHM && isItemPilesActive);

        if (useTHM) {
            isMerchant = this.npcToken.document.getFlag("treasure-hoard-manager", "data")?.type === "shop" &&
                         this.npcToken.document.getFlag("treasure-hoard-manager", "data")?.enabled === true;
        } 
        if (!isMerchant && useIP) {
            isMerchant = game.itempiles.API.isValidItemPile(this.npcToken.document);
        }

        let reputationValue = this.npcToken.document.getFlag(MOD_ID, 'reputation');
        if (reputationValue === undefined || reputationValue === null) reputationValue = 50;
        const repStatus = this._getReputationStatus(reputationValue);

        const filteredHistory = this._filterHistory(fullHistory);
        const coloredHistory = this._enrichHistoryWithColors(filteredHistory, realName);

        const viewerIds = this.npcToken.document.getFlag(MOD_ID, 'viewers') || [];
        const activeViewers = viewerIds
            .map(id => game.users.get(id))
            .filter(u => u && u.active)
            .map(u => ({
                name: u.name,
                color: u.color.css,
                img: u.character?.img || u.avatar || "icons/svg/mystery-man.svg"
            }));
            
        const questUuid = this.npcToken.document.getFlag(MOD_ID, 'questJournalUuid');
        const isQuestActive = this.npcToken.document.getFlag(MOD_ID, 'isQuestActive') ?? true;
        const hasActiveQuest = !!(questUuid && isQuestActive);
        
        // [NEW] Проверка настройки для чит-кнопки
        const showQuestHint = game.settings.get(MOD_ID, "enableQuestHints");

        return {
            playerName: this.playerToken.actor.name,
            playerImg: this.playerToken.actor?.img || "icons/svg/mystery-man.svg",
            npcName: realName, 
            displayName: displayName,
            npcImg: this.npcToken.actor?.img || "icons/svg/mystery-man.svg",
            isNameRevealed: isNameRevealed,
            npcSecret: this.secretText,
            hasSecret: !!this.secretText,
            isSecretRevealed: (!!this.secretText && socialStatus.insightSuccess === true),
            isWhispering: this.isWhisperingState,
            isGM: game.user.isGM,
            history: coloredHistory, 
            isItemPilesActive: isItemPilesActive,
            isMerchant: isMerchant,
            activeViewers: activeViewers,
            reputationValue: reputationValue,
            reputationLabel: repStatus.label,
            reputationColor: repStatus.color,
            hasActiveQuest: hasActiveQuest,
            showQuestHint: showQuestHint // [NEW] Передаем в шаблон
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        const input = html.find('#ai-input')[0];
        if (input && this._savedInputText !== undefined) {
            input.value = this._savedInputText;
            if (this._wasFocused) {
                input.focus();
                input.setSelectionRange(this._savedSelectionStart, this._savedSelectionEnd);
            }
        }

        const log = html.find('#message-log')[0];
        if (log) {
            // Прокручиваем вниз, если были внизу, ИЛИ если это первое открытие окна.
            if (this._isScrolledToBottom !== false || this._isFirstRender === undefined) {
                this._isFirstRender = false;
                
                // Foundry анимирует появление окна. В момент activateListeners
                // реальная высота может быть еще не рассчитана браузером. 
                // Делаем надежный тройной вызов для 100% срабатывания:
                const scrollToBottom = () => {
                    if (log) log.scrollTop = log.scrollHeight;
                };
                
                scrollToBottom(); // Пытаемся сразу
                requestAnimationFrame(scrollToBottom); // После отрисовки DOM-кадра браузером
                setTimeout(scrollToBottom, 150); // Гарантированно после завершения UI-анимации Foundry
            }
            
            // Отслеживаем ручной скролл игрока:
            // Если игрок читает старые сообщения (прокрутил вверх), мы не будем
            // принудительно кидать его вниз, когда окно перерисуется.
            log.addEventListener('scroll', () => {
                this._isScrolledToBottom = log.scrollHeight - log.clientHeight <= log.scrollTop + 10;
            });
        }

        html.find('.player-side .side-portrait').click(ev => {
            ev.preventDefault();
            this.playerToken.actor.sheet.render(true);
        });

        html.find('.npc-side .side-portrait').click(ev => {
            ev.preventDefault();
            BlueManButtonHandler.handleAnalysis(this);
        });

        html.find('#send-msg, #dm-send').click((e) => { e.preventDefault(); this._onSendMessage(); });
        html.find('#ai-input').keydown(e => { if (e.key === "Enter") { e.preventDefault(); this._onSendMessage(); } });
        
        html.find('#dm-whisper').click((e) => {
            e.preventDefault();
            this.isWhisperingState = !this.isWhisperingState;
            this.render(false);
        });

        html.find('#player-steal').click((e) => {
            e.preventDefault();
            BlueManButtonHandler.handleSteal(this);
        });

        html.find('#player-magic').click((e) => {
            e.preventDefault();
            // [FIX] ТУТ БЫЛА ОШИБКА. Передаем 'this' (весь диалог), а не 'this.playerToken.actor'
            BlueManMagicHandler.openMagicDialog(this);
        });

        // [NEW] КНОПКА ОТКРЫТИЯ ЖУРНАЛА ЗАДАНИЙ
        html.find('#player-quest-log').click(e => {
            e.preventDefault();
            new BlueManQuestLog().render(true);
        });

        // [NEW] КНОПКА ЧИТЕРА (ПОДСКАЗКА)
        html.find('#player-quest-hint').click(async (e) => {
            e.preventDefault();
            const questUuid = this.npcToken.document.getFlag(MOD_ID, 'questJournalUuid');
            if (questUuid) {
                const doc = await fromUuid(questUuid);
                if (doc) doc.sheet.render(true);
            }
        });

        html.find('#dm-toggle-name').click(async (ev) => {
            ev.preventDefault();
            const current = this.npcToken.document.getFlag(MOD_ID, 'isNameRevealed') || false;
            await BlueManFlagHandler.set(this.npcToken.document, 'isNameRevealed', !current);
            this.render(false);
        });
        
        html.find('#dm-settings').click(ev => {
            ev.preventDefault();
            new BlueManQuestConfig(this.npcToken.document).render(true);
        });

        html.find('#dm-give-item, button[data-action="trade-open"], #dm-toggle-merchant').click(ev => {
            ev.preventDefault(); ev.stopPropagation();
            const action = ev.currentTarget.dataset.action || ev.currentTarget.id;
            BlueManButtonHandler.handleUtilityAction(action, this);
        });

        // [NEW] УПРАВЛЕНИЕ КВЕСТОМ (ГМ)
        html.find('#dm-quest-offer').click(ev => {
            ev.preventDefault();
            BlueManButtonHandler.handleOfferQuest(this);
        });
        
        html.find('#dm-quest-success').click(ev => {
            ev.preventDefault();
            BlueManButtonHandler.handleQuestConclusion(this, 'completed');
        });

        html.find('#dm-quest-fail').click(ev => {
            ev.preventDefault();
            BlueManButtonHandler.handleQuestConclusion(this, 'failed');
        });
        // -----------------------------

        html.find('button[data-action="offer-item"]').click(ev => {
            ev.preventDefault(); ev.stopPropagation();
            BlueManButtonHandler.handleOfferItem(this);
        });

        html.find('.social-grid button').click(ev => {
            ev.preventDefault(); ev.stopPropagation();
            const action = ev.currentTarget.dataset.action;
            if (action) {
                BlueManButtonHandler.handleSocialAction(action, this, ev);
            }
        });

        html.find('#dm-clear').click(async (e) => {
            e.preventDefault();
            await BlueManFlagHandler.unset(this.npcToken.document, 'chatHistory');
            await BlueManFlagHandler.unset(this.npcToken.document, 'socialStatus'); 
            await BlueManFlagHandler.unset(this.npcToken.document, 'isNameRevealed'); 
            await BlueManFlagHandler.unset(this.npcToken.document, 'viewers');
            await BlueManFlagHandler.unset(this.npcToken.document, 'reputation'); 
            this.render(true);
        });

        html.find('#dm-attack').click(ev => {
            ev.preventDefault();
            BlueManButtonHandler.handleAttack(this);
        });
    }

    async _onSendMessage() {
        if (this._submitting) return;
        const input = this.element.find('#ai-input');
        const text = input.val().trim();
        if (!text) return;
        
        this._submitting = true;
        this._savedInputText = ""; 
        input.val('');

        const isWhisper = this.isWhisperingState;
        const speakerName = isWhisper ? `${this.playerToken.actor.name} (Шепотом)` : this.playerToken.actor.name;
        
        const playerMsg = { 
            speaker: speakerName, 
            text: text, 
            isSystem: false,
            isWhisper: isWhisper,
            ownerId: game.user.id
        };

        let fullHistory = this.npcToken.document.getFlag(MOD_ID, 'chatHistory') || [];
        fullHistory.push(playerMsg);
        
        this.localHistoryOverride = fullHistory;
        this.render(false);

        const socialStatus = this.npcToken.document.getFlag(MOD_ID, 'socialStatus') || {};
        await BlueManFlagHandler.requestAI(this, text, socialStatus, fullHistory);
        
        setTimeout(() => { this._submitting = false; }, 500);
    }

    _updateObject(event, formData) {}
}