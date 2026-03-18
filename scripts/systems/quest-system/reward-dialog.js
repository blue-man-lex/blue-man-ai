import { MOD_ID } from '../../core/settings.js';
import { BlueManFlagHandler } from '../../core/flag-handler.js';

export class BlueManRewardDialog extends Application {
    constructor(npcToken, isBoardReward = false) {
        super();
        this.npcToken = npcToken;
        this.isBoardReward = isBoardReward; // Флаг для доски объявлений
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "blue-man-reward-dialog",
            title: "Сундук с наградой",
            template: "modules/blue-man-ai/templates/reward-dialog.html",
            width: 350,
            height: 300,
            resizable: true,
            classes: ["blue-man-ai-window"]
        });
    }

    // [NEW] Карта цветов редкости (WoW Style)
    _getRarityColor(rarity) {
        const map = {
            "common": "#9e9e9e",       // Серый (Обычный)
            "uncommon": "#1eff00",     // Зеленый (Необычный)
            "rare": "#0070dd",         // Синий (Редкий)
            "veryRare": "#a335ee",     // Фиолетовый (Очень редкий)
            "legendary": "#ffd700",    // Золотой/Желтый (Легендарный)
            "artifact": "#ff8000"      // Оранжевый (Артефакт)
        };
        // Если редкости нет или она кривая - возвращаем серый
        return map[rarity] || "#9e9e9e"; 
    }

    getData() {
        // Читаем актуальные предметы прямо из флага НПС
        // Это обеспечивает синхронизацию: если кто-то забрал, флаг обновится, окно перерисуется
        const rawLoot = this.npcToken.document.getFlag(MOD_ID, 'questLoot') || [];
        
        // Обогащаем данные цветами редкости
        const enrichedLoot = rawLoot.map(itemEntry => {
            // В D&D5e редкость лежит в item.system.rarity
            // itemEntry.data - это сохраненный объект предмета
            const rarity = itemEntry.data?.system?.rarity || "common";
            const color = this._getRarityColor(rarity);
            
            return {
                ...itemEntry,
                rarityColor: color,
                // Добавляем свечение (Glow) для всего, что выше "Обычного"
                hasGlow: rarity !== "common"
            };
        });

        return {
            items: enrichedLoot
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // КЛИК ПО ПРЕДМЕТУ (ЗАБРАТЬ)
        html.find('.claim-item-btn').click(async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const index = ev.currentTarget.dataset.index;

            // Проверяем персонажа игрока
            const actor = game.user.character;
            if (!actor) {
                return ui.notifications.warn("У вас нет активного персонажа (Character), чтобы забрать награду.");
            }
            
            // ID актера-болванки или токена НПС в любом случае лежит в this.npcToken.id
            await BlueManFlagHandler.requestClaimReward(this.npcToken.id, index, actor.id);
        });

        html.find('.close-btn').click(() => this.close());
    }

    // Метод для обновления окна в реальном времени (вызывается из хука updateToken)
    updateItems(loot) {
        this.render(true);
    }
}