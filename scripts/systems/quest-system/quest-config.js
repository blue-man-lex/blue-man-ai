import { MOD_ID } from '../../core/settings.js';
import { BlueManFlagHandler } from '../../core/flag-handler.js';

export class BlueManQuestConfig extends FormApplication {
    constructor(tokenDoc) {
        super();
        this.tokenDoc = tokenDoc;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "blue-man-quest-config",
            title: "Настройки Сюжета NPC",
            template: "modules/blue-man-ai/templates/quest-config.html",
            width: 400,
            height: "auto",
            resizable: false,
            classes: ["blue-man-ai-window"], // Используем те же стили
            dragDrop: [{ dragSelector: null, dropSelector: ".quest-drop-zone" }]
        });
    }

    getData() {
        const questUuid = this.tokenDoc.getFlag(MOD_ID, 'questJournalUuid');
        let questName = null;
        
        if (questUuid) {
            const doc = fromUuidSync(questUuid);
            questName = doc?.name || "Неизвестный журнал";
        }

        const mainArcUuid = game.settings.get(MOD_ID, "worldLoreJournal");

        return {
            questUuid: questUuid,
            questName: questName,
            isQuestActive: this.tokenDoc.getFlag(MOD_ID, 'isQuestActive') ?? true,
            hasMainArc: !!mainArcUuid
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        // Кнопка очистки
        html.find('.clear-quest').click(async (e) => {
            e.preventDefault();
            await BlueManFlagHandler.unset(this.tokenDoc, 'questJournalUuid');
            this.render();
        });
    }

    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        
        if (data.type === "JournalEntry" || data.type === "JournalEntryPage") {
            const uuid = data.uuid;
            await BlueManFlagHandler.set(this.tokenDoc, 'questJournalUuid', uuid);
            await BlueManFlagHandler.set(this.tokenDoc, 'isQuestActive', true); // Авто-включение
            this.render();
            ui.notifications.info("Журнал квеста привязан!");
        }
    }

    async _updateObject(event, formData) {
        await BlueManFlagHandler.set(this.tokenDoc, 'isQuestActive', formData.isQuestActive);
    }
}