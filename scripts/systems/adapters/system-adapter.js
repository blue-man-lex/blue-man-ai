/**
 * Blue Man AI - System Adapter Base Class
 * Базовый класс для извлечения данных из игровых систем.
 */
export class SystemAdapter {
    constructor() {
        this.id = "generic";
    }

    /**
     * Возвращает основные характеристики для ИИ (INT, WIS, CHA и т.д.)
     */
    getAbilities(actor) {
        return { int: 10, wis: 10, cha: 10 };
    }

    /**
     * Возвращает значения навыков для социальных поединков
     */
    getSkillValue(actor, skillId) {
        return 0;
    }

    getPassiveSkill(actor, skillId) {
        return 10;
    }

    /**
     * Возвращает название школы магии (если применимо).
     * @param {Item} spell 
     * @returns {string}
     */
    getSpellSchoolLabel(spell) {
        return "Spell";
    }

    /**
     * Возвращает локализованное название навыка
     */
    getSkillLabel(skillId) {
        return skillId;
    }

    /**
     * Возвращает формулу броска для навыка.
     */
    getSkillRollFormula(mod) {
        return `1d20 + ${mod}`;
    }

    isCritSuccess(roll) {
        return (roll.terms[0]?.results?.[0]?.result || 0) === 20;
    }

    isCritFail(roll) {
        return (roll.terms[0]?.results?.[0]?.result || 0) === 1;
    }

    /**
     * Возвращает боевые параметры (HP, AC, Тип, Резисты)
     */
    getCombatStats(actor) {
        return {
            hp: "10/10",
            ac: 10,
            type: "Unknown",
            res: "None",
            imm: "None",
            vuln: "None"
        };
    }

    /**
     * Извлекает биографию и секрет из актера
     */
    getBio(actor, token = null) {
        return {
            full: "No biography.",
            secret: "None"
        };
    }

    /**
     * Возвращает список языков
     */
    getLanguages(actor) {
        return ["Common"];
    }

    /**
     * Возвращает строку с валютой
     */
    getCurrencyString(actor) {
        return "0 gp";
    }

    getCurrencyConfig(actor) {
        return {
            gp: { label: "Gold", max: 0, icon: "fas fa-coins" }
        };
    }

    updateCurrency(actor, deltaMap) {
        return {};
    }

    /**
     * Возвращает массив названий предметов инвентаря
     */
    getInventoryList(actor) {
        return [];
    }
    
    /**
     * Проверяет, является ли актер торговцем (поддержка THM/Item Piles)
     */
    isMerchant(tokenDoc) {
        return false;
    }
}
