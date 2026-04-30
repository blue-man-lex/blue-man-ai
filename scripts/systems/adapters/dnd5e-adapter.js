import { SystemAdapter } from './system-adapter.js';

/**
 * Blue Man AI - DnD5e System Adapter
 * Реализация для системы Dungeons & Dragons 5th Edition.
 */
export class Dnd5eAdapter extends SystemAdapter {
    constructor() {
        super();
        this.id = "dnd5e";
    }

    getAbilities(actor) {
        const abs = actor.system.abilities || {};
        return {
            int: abs.int?.value || 10,
            wis: abs.wis?.value || 10,
            cha: abs.cha?.value || 10
        };
    }

    getSkillValue(actor, skillId) {
        const skillData = actor.system.skills?.[skillId];
        if (!skillData) return 0;
        
        // Пытаемся получить итоговый бонус (total в 3.0+, value в более старых)
        let val = skillData.total ?? skillData.value;
        
        // Если ничего нет - считаем базово: модификатор характеристики + бонус мастерства
        if (val === undefined || val === null) {
            const abKey = skillData.ability || "dex";
            const mod = actor.system.abilities?.[abKey]?.mod || 0;
            const prof = actor.system.attributes?.prof || 2;
            const mult = skillData.proficient || 0;
            val = mod + (mult * prof);
        }
        return val;
    }

    getPassiveSkill(actor, skillId) {
        const skillData = actor.system.skills?.[skillId];
        return skillData?.passive || 10;
    }

    getSpellSchoolLabel(spell) {
        if (spell.type !== "spell") return "Ability";
        const schoolKey = spell.system.school;
        return CONFIG.DND5E?.spellSchools?.[schoolKey]?.label || "Заклинание";
    }

    getSkillLabel(skillId) {
        return CONFIG.DND5E.skills[skillId]?.label || skillId;
    }

    getCombatStats(actor) {
        const sys = actor.system;
        const traits = sys.traits || {};
        
        const getTraitNames = (key) => {
            const values = traits[key]?.value || [];
            return Array.from(values).map(v => CONFIG.DND5E.damageTypes[v]?.label || v).join(", ");
        };

        return {
            hp: `${sys.attributes?.hp?.value || 0}/${sys.attributes?.hp?.max || 0}`,
            ac: sys.attributes?.ac?.value || 10,
            type: sys.details?.type?.value || (typeof sys.details?.type === 'string' ? sys.details.type : "Humanoid"),
            res: getTraitNames('dr') || "None",
            imm: getTraitNames('di') || "None",
            vuln: getTraitNames('dv') || "None"
        };
    }

    getBio(actor, token = null) {
        const rawBio = actor.system.details?.biography?.value || "";
        const cleanBio = rawBio.replace(/<\/?[^>]+(>|$)/g, " ");
        const secretMatch = cleanBio.match(/(?:Секрет|Secret)[\s:\-.,;]*([^\.\n!?]+)/i);
        
        return {
            full: cleanBio.substring(0, 2000),
            secret: secretMatch ? secretMatch[1].trim() : "None"
        };
    }

    getLanguages(actor) {
        const langKeys = actor.system.traits?.languages?.value || [];
        const customLang = actor.system.traits?.languages?.custom;
        const langConfig = CONFIG.DND5E?.languages || {};
        const languagesList = Array.from(langKeys).map(key => langConfig[key]?.label || key);
        if (customLang) languagesList.push(customLang);
        return languagesList;
    }

    getCurrencyString(actor) {
        const currency = actor.system.currency || {};
        let parts = [];
        if (currency.pp) parts.push(`${currency.pp}pp`);
        if (currency.gp) parts.push(`${currency.gp}gp`);
        if (currency.ep) parts.push(`${currency.ep}ep`);
        if (currency.sp) parts.push(`${currency.sp}sp`);
        if (currency.cp) parts.push(`${currency.cp}cp`);
        return parts.length > 0 ? parts.join(", ") : "No money";
    }

    getInventoryList(actor) {
        const allowedTypes = ["weapon", "equipment", "tool", "consumable", "loot", "backpack"];
        return actor.items
            .filter(i => allowedTypes.includes(i.type))
            .map(i => {
                const qty = i.system.quantity || 1;
                return qty > 1 ? `${i.name} (x${qty})` : i.name;
            });
    }

    isMerchant(tokenDoc) {
        // Интеграция с THM
        if (game.modules.get("treasure-hoard-manager")?.active) {
            const thmData = tokenDoc.getFlag("treasure-hoard-manager", "data");
            if (thmData?.type === "shop" && thmData.enabled) return true;
        }
        // Интеграция с Item Piles
        if (game.modules.get("item-piles")?.active) {
            if (game.itempiles?.API?.isValidItemPile(tokenDoc)) return true;
        }
        return false;
    }
}
