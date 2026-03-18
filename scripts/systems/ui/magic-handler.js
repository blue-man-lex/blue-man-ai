import { BlueManFlagHandler } from '../../core/flag-handler.js';

export class BlueManMagicHandler {
    
    // БЕЛЫЙ СПИСОК (Whitelist)
    static get SOCIAL_SPELLS_WHITELIST() {
        return [
            // --- EN ---
            "friends", "charm person", "command", "detect thoughts", 
            "zone of truth", "hold person", "suggestion", "calm emotions", 
            "enthrall", "fear", "hypnotic pattern", "dominate person", 
            "modify memory", "geas", "antipathy/sympathy", "power word stun", 
            "sleep", "cause fear", "charm monster", "dominate monster",
            "hold monster", "mass suggestion", "glibness", "paraly", 
            
            // --- RU ---
            "дружба", "очарование", "приказ", "обнаружение мыслей",
            "зона правды", "удержание", "внушение", "умиротворение",
            "оцепенение", "страх", "гипнотический узор", "подчинение",
            "изменение памяти", "гэас", "антипатия", "симпатия", "слово силы",
            "сон", "навести страх", "развязность", "паралич"
        ];
    }

    // Поиск подходящих заклинаний/фитов у актера
    static getSocialSpells(actor) {
        if (!actor) return [];
        const whitelist = this.SOCIAL_SPELLS_WHITELIST;

        return actor.items.filter(i => {
            // 1. Фильтр типов
            const allowedTypes = ["spell", "feat", "consumable", "weapon", "equipment"];
            if (!allowedTypes.includes(i.type)) return false;
            
            // 2. Проверка подготовки (ТОЛЬКО для заклинаний)
            if (i.type === "spell") {
                const prep = i.system.preparation;
                if (prep) {
                    const mode = prep.method || prep.mode; 
                    const isPrepared = prep.prepared;
                    if (mode === "prepared" && !isPrepared) return false;
                }
            }

            // --- 3. ТОЧЕЧНЫЙ ПОИСК ---
            
            // А. Проверяем Название Самого Предмета
            // (Это найдет "Заклинание: Дружба" или "Свиток Очарования")
            if (whitelist.some(w => i.name.toLowerCase().includes(w))) return true;

            // Б. Проверяем Активности (Activities/Functions) - ТОЛЬКО для предметов
            // Это найдет "Паралич чудовища" ВНУТРИ "Посоха могущества"
            // Мы НЕ смотрим описание (Description), чтобы не цеплять мусор.
            if ((i.type === "weapon" || i.type === "equipment") && i.system.activities) {
                for (const activity of i.system.activities.values()) {
                    if (activity.name && whitelist.some(w => activity.name.toLowerCase().includes(w))) {
                        return true; // Нашли активность внутри предмета!
                    }
                }
            }

            return false;
        });
    }

    static openMagicDialog(dialogInstance) {
        const actor = dialogInstance.playerToken.actor;
        const spells = this.getSocialSpells(actor);
        
        if (spells.length === 0) {
            return ui.notifications.warn("У вас нет подходящих заклинаний или магических предметов.");
        }

        let content = `<div class="blue-man-item-list" style="max-height: 400px; overflow-y: auto;">`;
        spells.forEach(s => {
            let typeLabel = "Способность";
            if (s.type === 'spell') typeLabel = CONFIG.DND5E.spellSchools[s.system.school] || "Заклинание";
            else if (s.type === 'consumable') typeLabel = "Предмет";
            else if (s.type === 'weapon' || s.type === 'equipment') typeLabel = "Маг. Артефакт";

            content += `
            <div class="blue-man-item-row magic-spell-row" data-id="${s.id}" style="cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 5px;">
                <img src="${s.img}" width="36" height="36" style="border: 1px solid #4a3b2a; background: #000; flex-shrink: 0;">
                <div style="flex: 1;">
                    <div style="color: #e0d0b8; font-weight: bold; font-size: 1.1em;">${s.name}</div>
                    <div style="color: #888; font-size: 0.8em;">${typeLabel}</div>
                </div>
                <i class="fas fa-magic" style="color: #6fbff9; margin-right: 5px;"></i>
            </div>`;
        });
        content += `</div>`;

        const d = new Dialog({
            title: "🔮 Социальная Магия",
            content: content,
            buttons: {},
            render: (html) => {
                html.find('.magic-spell-row').click(async (ev) => {
                    const itemId = ev.currentTarget.dataset.id;
                    const item = actor.items.get(itemId);
                    if (item) {
                        d.close(); 
                        
                        await item.use(); 

                        const effectPrompt = `
                        [SYSTEM EVENT]: Player used Magic/Ability/Item "${item.name}" on you!
                        INSTRUCTION: React instantly to this effect.
                        - If it's a charm (Friends/Charm Person): You act friendly but might realize it later.
                        - If it's a control (Command/Hold Person/Paralysis): Describe physical struggle or freezing (e.g. "Mmph!").
                        - If it's fear: Flinch or back away.
                        - If it's aggressive: React with pain or anger.
                        `;

                        await BlueManFlagHandler.requestAI(dialogInstance, effectPrompt, {});
                    }
                });
            }
        }, { 
            classes: ["dialog", "blue-man-ai-window"],
            width: 400
        });
        
        d.render(true);
    }
}