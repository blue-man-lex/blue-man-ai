import { MOD_ID } from '../../core/settings.js';
import { BlueManFlagHandler } from '../../core/flag-handler.js';
import { BlueManSystemManager } from '../adapters/system-manager.js';

export class BlueManStealDialog extends FormApplication {
    constructor(playerToken, npcToken) {
        super();
        this.playerToken = playerToken;
        this.npcToken = npcToken;
        this.stolenCount = 0; // Счетчик успешных краж за сеанс
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "blue-man-steal-dialog",
            title: "Карманы NPC",
            width: 400,
            height: "auto",
            classes: ["blue-man-ai-window", "dialog"],
        });
    }

    render(force, options) {
        const adapter = BlueManSystemManager.adapter;
        // Используем адаптер для фильтрации предметов инвентаря
        const allowedTypes = ["weapon", "equipment", "consumable", "tool", "loot", "backpack"];
        const items = this.npcToken.actor.items.filter(i => allowedTypes.includes(i.type));

        const currentDC = 10 + (this.stolenCount * 5); 
        
        let content = `
        <div style="padding: 10px; color: #cbb497;">
            <div style="margin-bottom: 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #7e6345; padding-bottom: 5px;">
                <i class="fas fa-mask"></i> Риск обнаружения (DC: ${currentDC})
            </div>
            <div class="blue-man-item-list" style="max-height: 300px; overflow-y: auto;">`;

        if (items.length === 0) {
            content += `<p style="text-align:center; color:#888;">Карманы пусты.</p>`;
        } else {
            items.forEach(i => {
                const weightVal = i.system.weight?.value ?? i.system.weight ?? 0;
                content += `
                <div class="blue-man-item-row" style="display:flex; align-items:center; gap:10px; padding:5px;">
                    <img src="${i.img}" width="32" height="32" style="border:1px solid #4a3b2a; background:#000;">
                    <div style="flex:1;">
                        <span style="color:#e0d0b8; font-weight:bold;">${i.name}</span>
                        <span style="color:#888; font-size:0.8em;">(Вес: ${weightVal})</span>
                    </div>
                    <button class="steal-btn" data-id="${i.id}" style="width:auto; padding: 2px 8px; font-size: 0.9em;">
                        <i class="fas fa-hand-lizard"></i>
                    </button>
                </div>`;
            });
        }
        content += `</div></div>`;

        new Dialog({
            title: `Ограбление: ${this.npcToken.name}`,
            content: content,
            buttons: {
                close: { label: "Уйти", icon: "<i class='fas fa-door-open'></i>" }
            },
            render: (html) => {
                html.find('.steal-btn').click((ev) => this._onStealClick(ev, html));
            }
        }, { classes: ["dialog", "blue-man-ai-window"] }).render(true);
    }

    async _onStealClick(event, html) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.id;
        const item = this.npcToken.actor.items.get(itemId);
        if (!item) return;

        const currentDC = 10 + (this.stolenCount * 5);
        const playerActor = this.playerToken.actor;
        const adapter = BlueManSystemManager.adapter;
        
        // Получаем модификатор навыка через адаптер
        const skillMod = adapter.getSkillValue(playerActor, "slt"); // Ловкость рук

        console.log(`Blue Man AI | Steal Item Check: Actor=${playerActor.name}, Mod=${skillMod}`);

        const rollFormula = adapter.getSkillRollFormula(skillMod);
        const roll = new Roll(rollFormula);
        await roll.evaluate();
        
        const total = roll.total;
        
        // Пассивная внимательность NPC через адаптер
        const npcPassive = adapter.getPassiveSkill(this.npcToken.actor, "prc");
        
        const targetDC = Math.max(currentDC, npcPassive);

        if (total >= targetDC) {
            this.stolenCount++;
            ui.notifications.info(`Успех! (Roll: ${total} vs DC ${targetDC}). Вы украли ${item.name}.`);
            
            const itemData = item.toObject();
            itemData.originId = item.id; // [FIX] Store original ID for deletion
            delete itemData._id;
            itemData.system.quantity = 1;

            await BlueManFlagHandler.stealItem(this.npcToken.document, itemData, this.playerToken.document.id);
            
            Object.values(ui.windows).forEach(w => {
                if (w.title.includes(`Ограбление: ${this.npcToken.name}`)) w.close();
            });
            setTimeout(() => this.render(true), 100);

        } else {
            ui.notifications.error(`Провал! (Roll: ${total} vs DC ${targetDC}). Вас заметили!`);
            
            Object.values(ui.windows).forEach(w => {
                if (w.title.includes(`Ограбление: ${this.npcToken.name}`)) w.close();
            });

            await BlueManFlagHandler.triggerAlarm(this.npcToken.document);
        }
    }
}