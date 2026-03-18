import { MOD_ID } from '../../core/settings.js';
import { QuestService } from './quest-service.js'; 
import { BlueManFlagHandler } from '../../core/flag-handler.js';

export class NoticeBoardConfig extends FormApplication {
    constructor(tileDocument, options = {}) {
        super(options);
        this.tileDocument = tileDocument;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "notice-board-config",
            title: "Настройка Доски Объявлений",
            template: `modules/${MOD_ID}/templates/notice-board-config.html`,
            width: 400,
            height: "auto",
            resizable: false,
            classes: ["blue-man-ai-window", "blue-man-quest-config"]
        });
    }

    getData() {
        const flags = this.tileDocument.getFlag(MOD_ID, 'board') || {};
        return {
            folderUuid: flags.boardFolderUuid || "", 
            folderName: flags.boardFolderName || null
        };
    }

    async _updateObject(event, formData) {
        const folderUuid = formData.boardFolderUuid;
        const folderName = formData.boardFolderName;

        if (folderUuid && folderName) {
            await this.tileDocument.setFlag(MOD_ID, 'board', {
                boardFolderUuid: folderUuid,
                boardFolderName: folderName
            });
            ui.notifications.info('Настройки Доски Объявлений сохранены!');
        } else {
            await this.tileDocument.unsetFlag(MOD_ID, 'board');
            ui.notifications.info('Настройки Доски Объявлений сброшены.');
        }
    }

    async _onDrop(event) {
        event.preventDefault();
        try {
            const data = JSON.parse(event.dataTransfer.getData('text/plain'));
            if (data.type === "Folder") {
                const folder = fromUuidSync(data.uuid);
                if (!folder) return;
                
                // Update hidden form inputs instead of saving to DB immediately
                const form = this.element.find('form')[0];
                if (form) {
                    form.elements['boardFolderUuid'].value = data.uuid;
                    form.elements['boardFolderName'].value = folder.name;
                }
                
                // Update the visual drop zone
                const dropZone = this.element.find('.quest-drop-zone');
                dropZone.html(`<div class="folder-info" style="color:#2ecc71;"><i class="fas fa-check-circle"></i> ${folder.name} (Готово к сохранению)</div>`);
                
                ui.notifications.info(`Папка "${folder.name}" выбрана. Нажмите "СОХРАНИТЬ".`);
            }
        } catch (error) {
            console.error('NoticeBoardConfig | Error processing drop:', error);
            ui.notifications.error('Ошибка при обработке перетаскивания');
        }
    }

    activateListeners(html) {
        super.activateListeners(html);
        const dropZone = html.find('.quest-drop-zone')[0];
        if (dropZone) {
            dropZone.addEventListener('dragover', (event) => {
                event.preventDefault();
                dropZone.style.borderColor = '#2ecc71';
                dropZone.style.background = 'rgba(46, 204, 113, 0.1)';
            });
            dropZone.addEventListener('dragleave', (event) => {
                event.preventDefault();
                dropZone.style.borderColor = '#3498db';
                dropZone.style.background = 'rgba(0,0,0,0.4)';
            });
            dropZone.addEventListener('drop', (event) => {
                dropZone.style.borderColor = '#3498db';
                dropZone.style.background = 'rgba(0,0,0,0.4)';
                this._onDrop(event);
            });
        }
        html.find('.clear-board').click(async ev => {
            ev.preventDefault();
            const confirmed = await Dialog.confirm({
                title: "Отвязка доски",
                content: `<p>Вы уверены, что хотите отвязать папку от этой доски?</p>`,
                yes: () => true,
                no: () => false
            });
            if (confirmed) {
                await this.tileDocument.unsetFlag(MOD_ID, 'board');
                ui.notifications.info('Папка отвязана от доски');
                this.render();
            }
        });
    }
}

export class NoticeBoardApp extends Application {
    constructor(tileDocument, options = {}) {
        super(options);
        this.tileDocument = tileDocument;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "notice-board-window",
            template: `modules/${MOD_ID}/templates/notice-board.html`,
            classes: ["blue-man-ai-window", "notice-board-ui"],
            width: 900,
            height: 700,
            resizable: true,
            title: "Доска Объявлений"
        });
    }

    getData() {
        const flags = this.tileDocument.getFlag(MOD_ID, 'board') || {};
        const folderUuid = flags.boardFolderUuid;
        
        if (!folderUuid) return { quests: [], boardName: "Пустая доска", isEmpty: true };
        const folder = fromUuidSync(folderUuid);
        if (!folder) return { quests: [], boardName: flags.boardFolderName || "Доска", isEmpty: true };

        const activeQuests = QuestService.getQuests().map(q => q.id);

        const quests = folder.contents
            .filter(doc => doc.documentName === 'JournalEntry' && !activeQuests.includes(doc.uuid))
            .map(doc => {
                // ВОЗВРАЩЕН РАБОЧИЙ ПАРСЕР ИЗ ПРЕДЫДУЩЕЙ ВЕРСИИ
                let rawText = "";
                let imageSrc = null;

                if (doc.pages && doc.pages.size > 0) {
                    const pages = doc.pages.contents;
                    const textPage = pages.find(p => p.type === "text" || !p.type);
                    if (textPage) rawText = textPage.text.content || "";
                    const imgPage = pages.find(p => p.type === "image");
                    if (imgPage) imageSrc = imgPage.src;
                } else {
                    rawText = doc.content || ""; 
                }

                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = rawText;

                // ЧИСТКА СЕКРЕТОВ
                const secretSelectors = [".secret", ".gm-only", "section.secret"];
                secretSelectors.forEach(sel => {
                    tempDiv.querySelectorAll(sel).forEach(el => el.remove());
                });

                if (!imageSrc) {
                    const imgTag = tempDiv.querySelector('img');
                    if (imgTag) {
                        imageSrc = imgTag.src;
                        imgTag.remove(); 
                    }
                }

                // ПАРСИНГ НАГРАДЫ
                const mechLineRegex = /(\*\*|###)?\s*(?:Награда|Reward|Rewards)[:\s]+(.*)(?:<br>|<\/p>|$)/i;
                const match = tempDiv.innerHTML.match(mechLineRegex);
                
                let shortReward = "Без награды";
                let detailedReward = "Награда не указана или обсуждается лично.";
                
                if (match) {
                    tempDiv.innerHTML = tempDiv.innerHTML.replace(match[0], ""); 
                    detailedReward = match[2].trim(); 
                    shortReward = "Оплата по выполнению";
                    if (detailedReward.match(/\d+\s*(gp|зм|sp|см|pp|пм)/i) || detailedReward.includes("UUID")) {
                        shortReward = "💰 Есть награда";
                    }
                }

                let plainText = tempDiv.innerText || tempDiv.textContent || "";
                plainText = plainText.replace(/[#*`_~]/g, "").replace(/\s+/g, " ").trim();
                const preview = plainText.substring(0, 200) + (plainText.length > 200 ? "..." : "");

                const safeHtml = tempDiv.innerHTML;

                let title = doc.name;
                let rarityClass = "rank-d"; 
                let rarityName = "Обычный";

                const rankMatch = title.match(/^\[([SABCDСАБЦД])\]\s*(.*)/i);
                if (rankMatch) {
                    const rank = rankMatch[1].toUpperCase();
                    title = rankMatch[2].trim();
                    if (['S', 'С'].includes(rank)) { rarityClass = 'rank-s'; rarityName = 'Смертельный'; }
                    else if (['A', 'А'].includes(rank)) { rarityClass = 'rank-a'; rarityName = 'Сложный'; }
                    else if (['B', 'Б'].includes(rank)) { rarityClass = 'rank-b'; rarityName = 'Средний'; }
                    else if (['C', 'Ц'].includes(rank)) { rarityClass = 'rank-c'; rarityName = 'Легкий'; }
                }

                return {
                    id: doc.uuid,
                    name: title,
                    preview: preview,
                    fullText: safeHtml, 
                    image: imageSrc,
                    rewardInfo: shortReward,        
                    detailedReward: detailedReward, 
                    rarityClass: rarityClass,
                    rarityName: rarityName
                };
            });

        return {
            quests,
            boardName: flags.boardFolderName || "Доска Объявлений",
            isEmpty: quests.length === 0
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.contract-paper').on('click', async (ev) => {
            if ($(ev.target).closest('.accept-contract-btn').length > 0) return;

            ev.preventDefault();
            const uuid = ev.currentTarget.dataset.uuid;
            const quest = this.getData().quests.find(q => q.id === uuid);
            if (!quest) return;
            const paperElement = $(ev.currentTarget);

            const enrichedReward = await TextEditor.enrichHTML(quest.detailedReward, { async: true });

            const content = `
                <div class="blue-man-quest-config" style="padding: 10px; font-family: 'Signika', sans-serif;">
                    ${quest.image ? `<img src="${quest.image}" style="width:100%; max-height:200px; object-fit:cover; border:2px solid #5c4b37; margin-bottom:15px; border-radius:2px;">` : ''}
                    <h2 style="font-family:'Modesto Condensed', serif; color:#3e2723; border-bottom:1px solid #c2b29a; padding-bottom:5px; text-align:center;">
                        ${quest.name}
                    </h2>
                    <div style="color:#4e342e; font-size:15px; line-height:1.5; max-height:300px; overflow-y:auto; padding:10px; background:rgba(0,0,0,0.05); border:1px dashed #c2b29a; margin-bottom:15px;">
                        ${quest.fullText}
                    </div>
                    <div style="text-align:center; color:#b71c1c; font-size:1.1em; margin-bottom:15px; padding:8px; background:rgba(183, 28, 28, 0.1); border:1px dashed #b71c1c;">
                        <span style="font-weight:bold; display:block; margin-bottom:5px;">Награда по контракту:</span>
                        <span style="color:#5c4b37;">${enrichedReward}</span>
                    </div>
                </div>
            `;

            new Dialog({
                title: `Чтение: ${quest.name}`,
                content: content,
                buttons: {
                    accept: {
                        label: "<i class='fas fa-hand-paper'></i> Сорвать контракт",
                        callback: async () => {
                            await BlueManFlagHandler.acceptQuest(uuid, "Доска Объявлений");
                            paperElement.fadeOut(300, () => {
                                paperElement.remove();
                                ui.notifications.info("Контракт сорван с доски!");
                                if (html.find('.contract-paper').length === 0) {
                                    this.close();
                                }
                            });
                        }
                    },
                    close: {
                        label: "<i class='fas fa-times'></i> Вернуть на доску"
                    }
                },
                default: "close"
            }, { 
                classes: ["blue-man-ai-window", "dialog", "notice-board-quest-detail"], 
                width: 500,
                popOut: true,
                resizable: true
            }).render(true);
        });

        html.find('.accept-contract-btn').click(async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const uuid = ev.currentTarget.dataset.uuid;
            const paperElement = $(ev.currentTarget).closest('.contract-paper');
            
            await BlueManFlagHandler.acceptQuest(uuid, "Доска Объявлений");
            
            paperElement.fadeOut(300, () => {
                paperElement.remove();
                ui.notifications.info("Контракт сорван с доски!");
                if (html.find('.contract-paper').length === 0) {
                    this.close();
                }
            });
        });
    }
}