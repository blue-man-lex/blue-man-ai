import { MOD_ID } from '../../core/settings.js';
import { QuestService } from './quest-service.js';

export class BlueManQuestLog extends FormApplication {
    constructor() {
        super();
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "blue-man-quest-log",
            classes: ["blue-man-ai-window", "quest-log-window"],
            template: "modules/blue-man-ai/templates/quest-log.html",
            width: 550,
            height: 650,
            resizable: true,
            title: "Журнал Заданий Группы"
        });
    }

    getData() {
        const allQuests = QuestService.getQuests();
        
        allQuests.sort((a, b) => {
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            return b.timestamp - a.timestamp;
        });

        const groups = {};
        
        allQuests.forEach(q => {
            const cat = q.category || "Общие";
            if (!groups[cat]) {
                let color = "#cbb497"; 
                let icon = "fa-folder";

                if (q.type === 'local') { 
                    color = "#f1c40f"; 
                    icon = "fa-map-marker-alt";
                } else if (q.type === 'global') {
                    color = "#d35400"; 
                    icon = "fa-globe";
                }

                groups[cat] = {
                    name: cat,
                    quests: [],
                    color: color,
                    icon: icon
                };
            }
            
            groups[cat].quests.push({
                ...q,
                isActive: q.status === 'active',
                isCompleted: q.status === 'completed',
                isFailed: q.status === 'failed',
                statusLabel: this._getStatusLabel(q.status)
            });
        });

        const categories = Object.values(groups).sort((a, b) => {
            if (a.name === "Общие") return 1;
            if (b.name === "Общие") return -1;
            return a.name.localeCompare(b.name);
        });

        return {
            categories: categories,
            hasQuests: allQuests.length > 0,
            userIsGM: game.user.isGM
        };
    }

    _getStatusLabel(status) {
        switch(status) {
            case 'active': return "Активно";
            case 'completed': return "Выполнено";
            case 'failed': return "Провалено";
            default: return "";
        }
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.quest-header').click(ev => {
            ev.preventDefault();
            ev.stopPropagation(); 
            const li = $(ev.currentTarget).closest('.quest-entry');
            const body = li.find('.quest-body');
            const chevron = li.find('.quest-toggle-icon');
            
            body.slideToggle(200);
            
            if (body.is(':visible')) {
                chevron.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            } else {
                chevron.removeClass('fa-chevron-up').addClass('fa-chevron-down');
            }
        });

        html.find('.category-header').click(ev => {
            ev.preventDefault();
            const header = $(ev.currentTarget);
            const list = header.next('.category-quest-list');
            const icon = header.find('.cat-chevron');
            
            list.slideToggle(200);
            icon.toggleClass('fa-folder-open fa-folder');
        });

        html.find('.open-journal-btn').click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const uuid = ev.currentTarget.dataset.uuid;
            const doc = await fromUuid(uuid);
            if (doc) doc.sheet.render(true);
        });

        // [NEW] Клик по предмету-награде
        html.find('.open-item-btn').click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const uuid = ev.currentTarget.dataset.uuid;
            const item = await fromUuid(uuid);
            if (item) item.sheet.render(true);
        });

        // Обработчики для кнопок завершения квестов с выдачей награды
        html.find('.complete-quest-btn').click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const uuid = ev.currentTarget.dataset.uuid;
            try {
                // 1. Получаем данные квеста перед сменой статуса
                const allQuests = QuestService.getQuests();
                const quest = allQuests.find(q => q.id === uuid);
                
                // 2. Меняем статус
                await QuestService.updateStatus(uuid, 'completed');
                ui.notifications.info('Квест успешно завершен');
                
                // Check if the quest came from the board
                if (quest.source === "Доска Объявлений" || quest.source === "Доска") {
                    const color = "#2ecc71";
                    const statusText = "КОНТРАКТ ВЫПОЛНЕН";
                    const icon = "fa-check-circle";
                    
                    // Создаем единое сообщение с информацией о наградах
                    let chatMessage = `
                        <div style="background: rgba(0,0,0,0.7); border: 1px solid ${color}; border-radius: 4px; padding: 10px; text-align: center; font-family: 'Signika', sans-serif;">
                            <div style="color: ${color}; font-size: 1.2em; font-weight: bold; margin-bottom: 5px; font-family: 'Modesto Condensed', serif;">
                                <i class="fas ${icon}"></i> ${statusText}
                            </div>
                            <div style="color: #e0d0b8; font-size: 1.1em; margin-bottom: 10px;">
                                ${quest.title || "Неизвестный контракт"}
                            </div>
                    `;
                    
                    // Добавляем информацию о наградах
                    if (quest.rewards) {
                        chatMessage += `<div style="text-align: left; margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 3px;">`;
                        
                        // Деньги
                        if (quest.rewards.currency && quest.rewards.currency.length > 0) {
                            chatMessage += `<div style="color: #786c3b; font-weight: bold; margin-bottom: 5px;">💰 Награда:</div>`;
                            quest.rewards.currency.forEach(c => {
                                chatMessage += `<div style="color: #e0d0b8; margin-left: 10px;">• ${c.amount} ${c.type}</div>`;
                            });
                        }
                        
                        // Предметы
                        if (quest.rewards.items && quest.rewards.items.length > 0) {
                            chatMessage += `<div style="color: #786c3b; font-weight: bold; margin: 8px 0 5px 0;">🎁 Предметы:</div>`;
                            quest.rewards.items.forEach(item => {
                                chatMessage += `<div style="color: #e0d0b8; margin-left: 10px;">• ${item.name}</div>`;
                            });
                        }
                        
                        chatMessage += `</div>`;
                    }
                    
                    chatMessage += `</div>`;

                    ChatMessage.create({
                        content: chatMessage,
                        speaker: { alias: "Доска Объявлений" }
                    });
                }
                
                // 3. Выдаем награду (передаем null вместо tokenDoc, так как квест завершен не через НПС)
                if (quest && quest.rewards) {
                    console.log(" Завершаю квест доски:", { 
                        questTitle: quest.title,
                        rewards: quest.rewards,
                        rewardsType: typeof quest.rewards,
                        rewardsKeys: Object.keys(quest.rewards || {}),
                        hasCurrency: quest.rewards.currency?.length > 0,
                        hasItems: quest.rewards.items?.length > 0,
                        currencyArray: quest.rewards.currency,
                        itemsArray: quest.rewards.items
                    });
                    
                    // Импортируем BlueManFlagHandler динамически, чтобы избежать циклических зависимостей, 
                    // или используем глобальную функцию, если она доступна.
                    // Для надежности отправим запрос на раздачу через ChatMessage (как в остальном модуле)
                    ChatMessage.create({
                        content: "System Request (Distribute Rewards)",
                        whisper: game.users.filter(u => u.isGM).map(u => u.id),
                        flags: {
                            [MOD_ID]: {
                                action: "distributeBoardRewards",
                                rewards: quest.rewards,
                                questName: quest.title || quest.name
                            }
                        }
                    });
                } else {
                    console.warn(" У квеста нет наград:", { 
                        quest: quest,
                        hasQuest: !!quest,
                        hasRewards: quest?.hasOwnProperty('rewards'),
                        rewardsValue: quest?.rewards,
                        rewardsType: typeof quest?.rewards
                    });
                }
                
                this.render();
            } catch (error) {
                console.error('Ошибка при завершении квеста:', error);
                ui.notifications.error('Не удалось завершить квест');
            }
        });

        html.find('.fail-quest-btn').click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const uuid = ev.currentTarget.dataset.uuid;
            try {
                // 1. Получаем данные квеста перед сменой статуса
                const allQuests = QuestService.getQuests();
                const quest = allQuests.find(q => q.id === uuid);
                
                // 2. Меняем статус
                await QuestService.updateStatus(uuid, 'failed');
                ui.notifications.info('Квест провален');
                
                // Check if the quest came from the board
                if (quest.source === "Доска Объявлений" || quest.source === "Доска") {
                    const color = "#e74c3c";
                    const statusText = "КОНТРАКТ ПРОВАЛЕН";
                    const icon = "fa-times-circle";
                    
                    const chatContent = `
                        <div style="background: rgba(0,0,0,0.7); border: 1px solid ${color}; border-radius: 4px; padding: 10px; text-align: center; font-family: 'Signika', sans-serif;">
                            <div style="color: ${color}; font-size: 1.2em; font-weight: bold; margin-bottom: 5px; font-family: 'Modesto Condensed', serif;">
                                <i class="fas ${icon}"></i> ${statusText}
                            </div>
                            <div style="color: #e0d0b8; font-size: 1.1em;">
                                ${quest.title || "Неизвестный контракт"}
                            </div>
                        </div>
                    `;

                    ChatMessage.create({
                        content: chatContent,
                        speaker: { alias: "Доска Объявлений" }
                    });
                }
                
                this.render();
            } catch (error) {
                console.error('Ошибка при провале квеста:', error);
                ui.notifications.error('Не удалось провалить квест');
            }
        });

        // [NEW] Клик по кнопке удаления квеста
        html.find('.delete-quest-btn').click(async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const uuid = ev.currentTarget.dataset.uuid;
            const title = ev.currentTarget.dataset.title;
            
            const confirmed = await Dialog.confirm({
                title: "Удаление квеста",
                content: `<p>Вы уверены, что хотите удалить квест "<strong>${title}</strong>"?</p>
                         <p style="color: #e74c3c;">Это действие необратимо!</p>`,
                yes: () => true,
                no: () => false,
                options: {
                    width: 400,
                    height: 200
                }
            });
            
            if (confirmed) {
                try {
                    await QuestService.removeQuest(uuid);
                    ui.notifications.info(`Квест "${title}" удален.`);
                    this.render();
                } catch (error) {
                    console.error("Ошибка при удалении квеста:", error);
                    ui.notifications.error("Не удалось удалить квест.");
                }
            }
        });
    }

    async _updateObject(event, formData) {}
}