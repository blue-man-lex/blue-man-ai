import { SystemAdapter } from './system-adapter.js';

/**
 * Blue Man AI - Cyberpunk Red Core System Adapter
 * Реализация для системы Cyberpunk Red Core.
 */
export class CprAdapter extends SystemAdapter {
    constructor() {
        super();
        this.id = "cyberpunk-red-core";
    }

    getAbilities(actor) {
        const stats = actor.system.stats || {};
        return {
            int: stats.int?.value || 0,
            wis: stats.will?.value || 0, // WILL в CPR ближе к WIS
            cha: stats.cool?.value || 0  // COOL в CPR ближе к CHA
        };
    }

    getSkillValue(actor, skillId) {
        // Карта навыков из DnD5e в CPR
        const skillMap = {
            "ste": "stealth",
            "slt": "pickPocket",
            "prc": "perception"
        };
        const cprSkillName = skillMap[skillId] || skillId;
        
        // 1. Поиск в actor.system.skills (если система хранит их там напрямую)
        const sysSkill = actor.system.skills?.[cprSkillName];
        if (sysSkill) {
            const statVal = actor.system.stats?.[sysSkill.stat]?.value || 0;
            return (sysSkill.level || 0) + statVal + (sysSkill.modifier || 0);
        }
        
        // 2. Поиск через предметы (навыки в CPR - это Item)
        const skillItem = actor.items.find(i => 
            i.type === "skill" && 
            (i.system.internalName === cprSkillName || i.name.toLowerCase().includes(cprSkillName.toLowerCase()))
        );
        
        if (skillItem) {
            const system = skillItem.system;
            const statVal = actor.system.stats?.[system.stat]?.value || 0;
            return (system.level || 0) + statVal + (system.modifier || 0);
        }

        // 3. Фолбэк для Mooks (если у них есть общие боевые числа, но мы ищем социалку/скрытность)
        if (actor.type === "mook" && actor.system.combatNumber) {
            return actor.system.combatNumber; // Грубое допущение для Муков
        }

        return 0;
    }

    getPassiveSkill(actor, skillId) {
        // В CPR обычно нет "пассивных" навыков в том же смысле, что в DnD5e
        // Обычно это 10 + Skill Total или просто Skill Total
        const val = this.getSkillValue(actor, skillId);
        return 10 + val; 
    }

    getSpellSchoolLabel(item) {
        // В CPR нет школ магии, но есть типы программ или способностей
        return item.type === "program" ? "Program" : "Ability";
    }

    getSkillLabel(skillId) {
        const skillMap = {
            "ste": "Stealth",
            "slt": "Pick Pocket",
            "prc": "Perception"
        };
        return skillMap[skillId] || skillId;
    }

    getSkillRollFormula(mod) {
        // В CPR бросок это 1d10 + mod. 
        // При 10 - взрыв (добавляем 1d10), при 1 - провал (вычитаем 1d10).
        // В Foundry обычно используют расширения, но для базы используем 1d10.
        return `1d10 + ${mod}`;
    }

    isCritSuccess(roll) {
        // В CPR 10 - это крит (взрыв)
        const d10Result = roll.terms[0]?.results?.[0]?.result;
        return d10Result === 10;
    }

    isCritFail(roll) {
        // В CPR 1 - это критический провал
        const d10Result = roll.terms[0]?.results?.[0]?.result;
        return d10Result === 1;
    }

    getCombatStats(actor) {
        const sys = actor.system;
        const stats = sys.stats || {};
        
        return {
            hp: `${sys.derivedStats?.hp?.value || 0}/${sys.derivedStats?.hp?.max || 0}`,
            ac: sys.externalData?.armor?.body?.sp || 0, // SP брони
            type: actor.type === "mook" ? "Mook" : "Character",
            res: "None",
            imm: "None",
            vuln: "None"
        };
    }

    getBio(actor, token = null) {
        // 1. Собираем биографию из всех возможных полей актера
        const sys = actor.system || {};
        const info = sys.information || {};
        const bioFields = [
            sys.notes, 
            info.description, 
            info.notes, 
            info.history,
            sys.details?.biography,
            sys.details?.notes
        ];

        // 2. Если передан токен, добавляем и его данные
        if (token) {
            const tokenDoc = token.document || token;
            if (tokenDoc.notes) bioFields.push(tokenDoc.notes);
            const tokenFlags = tokenDoc.flags?.["cyberpunk-red-core"];
            if (tokenFlags?.notes) bioFields.push(tokenFlags.notes);
        }

        // Чистим текст от HTML, заменяя теги на пробелы
        const standardBio = bioFields.map(v => {
            if (!v) return "";
            return (typeof v === 'object') ? (v.value || "") : v;
        }).join(" ").replace(/<\/?[^>]+(>|$)/g, " ").trim();

        // 3. Ищем секрет в глобальном пуле данных (БЕЗОПАСНО)
        let searchPool = standardBio;
        try {
            const actorData = JSON.stringify(actor.toObject?.() || {});
            const tokenData = (token?.document || token)?.toObject?.() ? JSON.stringify((token.document || token).toObject()) : "";
            // В сыром JSON тоже чистим теги для надежности поиска
            searchPool += " " + actorData.replace(/\\u003C[^>]*\\u003E/g, " ") + " " + tokenData;
        } catch (e) {
            console.warn("Blue Man AI | Could not stringify actor/token data for secret search", e);
        }
        
        let secret = "None";
        // НОВОЕ: Гибкая регулярка. Ищет "Секрет" или "Secret", 
        // игнорирует любые символы до двоеточия (остатки тегов)
        const secretRegex = /(?:Секрет|Secret)[\s\W]*[:\-]\s*([^"<{]+)/i;
        const match = searchPool.match(secretRegex);
        
        if (match && match[1]) {
            const potentialSecret = match[1].trim();
            // Отсекаем мусор и лишние пробелы
            secret = potentialSecret.split(/[".\n\r]/)[0].trim();
        }

        return {
            full: standardBio.substring(0, 2000) || "No biography available.",
            secret: secret
        };
    }

    getLanguages(actor) {
        // В CPR языки обычно в lifepath или как навыки
        const langs = actor.items.filter(i => i.type === "skill" && i.name.toLowerCase().includes("language")).map(i => i.name);
        return langs.length > 0 ? langs : ["Street Slang"];
    }

    getCurrencyString(actor) {
        return `${actor.system.currency || 0} eb`;
    }

    getCurrencyConfig(actor) {
        return {
            eb: { label: "Eurobucks", max: actor.system.currency || 0, icon: "fas fa-euro-sign" }
        };
    }

    updateCurrency(actor, deltaMap) {
        // В CPR валюта это просто число system.currency
        const current = actor.system.currency || 0;
        const delta = deltaMap.eb || 0;
        return { "system.currency": current + delta };
    }

    getInventoryList(actor) {
        const allowedTypes = ["weapon", "gear", "cyberware", "program", "drug", "clothing", "armor"];
        return actor.items
            .filter(i => allowedTypes.includes(i.type))
            .map(i => {
                const qty = i.system.quantity || 1;
                return qty > 1 ? `${i.name} (x${qty})` : i.name;
            });
    }

    isMerchant(tokenDoc) {
        // В CPR контейнеры могут быть типа "shop"
        if (tokenDoc.actor?.type === "container") {
            return tokenDoc.actor.system.containerType === "shop";
        }
        return false;
    }
}
