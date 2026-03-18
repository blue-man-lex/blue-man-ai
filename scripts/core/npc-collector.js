import { MOD_ID } from './settings.js';

export class NpcCollector {
    static collect(tokenDoc) {
        const actor = tokenDoc.actor;
        if (!actor) return null;

        // Био
        const rawBio = actor.system.details?.biography?.value || "";
        const cleanBio = rawBio.replace(/<\/?[^>]+(>|$)/g, " ");
        const secretMatch = cleanBio.match(/(?:Секрет|Secret)[\s:\-.,;]*([^\.\n!?]+)/i);
        const secretText = secretMatch ? secretMatch[1].trim() : "None";

        // Статы (Ментал)
        const stats = actor.system.abilities || {};
        const int = stats.int?.value || 10;
        const wis = stats.wis?.value || 10;
        const cha = stats.cha?.value || 10;

        // --- БОЕВЫЕ СТАТЫ ДЛЯ АНАЛИЗА ---
        const hp = `${actor.system.attributes.hp.value}/${actor.system.attributes.hp.max}`;
        const ac = actor.system.attributes.ac.value || 10;
        const type = actor.system.details.type?.value || "Humanoid";
        
        // Резисты и уязвимости (превращаем коды dnd5e в текст)
        const traits = actor.system.traits || {};
        const getTraitNames = (key) => {
            const values = traits[key]?.value || [];
            // Используем конфиг системы для перевода кодов (fire -> Огонь)
            return Array.from(values).map(v => CONFIG.DND5E.damageTypes[v]?.label || v).join(", ");
        };
        
        const resistances = getTraitNames('dr') || "None";
        const immunities = getTraitNames('di') || "None";
        const vulnerabilities = getTraitNames('dv') || "None";
        // ----------------------------------------

        // Деньги
        const currency = actor.system.currency || {};
        let moneyStr = [];
        if (currency.pp) moneyStr.push(`${currency.pp}pp`);
        if (currency.gp) moneyStr.push(`${currency.gp}gp`);
        if (currency.ep) moneyStr.push(`${currency.ep}ep`);
        if (currency.sp) moneyStr.push(`${currency.sp}sp`);
        if (currency.cp) moneyStr.push(`${currency.cp}cp`);
        const moneyText = moneyStr.length > 0 ? moneyStr.join(", ") : "No money";

        // Инвентарь
        const allowedTypes = ["weapon", "equipment", "tool", "consumable", "loot", "backpack"];
        const items = actor.items
            .filter(i => allowedTypes.includes(i.type))
            .map(i => i.name);
        
        let inventoryText = "";
        if (items.length > 15) {
            inventoryText = items.slice(0, 15).join(", ") + "...";
        } else if (items.length > 0) {
            inventoryText = items.join(", ");
        } else {
            inventoryText = "Empty pockets";
        }

        // Языки
        const langKeys = actor.system.traits?.languages?.value || [];
        const customLang = actor.system.traits?.languages?.custom;
        const langConfig = CONFIG.DND5E?.languages || {};
        const languagesList = Array.from(langKeys).map(key => langConfig[key] || key);
        if (customLang) languagesList.push(customLang);

        let isMerchant = false;
        let merchantInfo = "";

        const shopPref = game.settings.get(MOD_ID, "shopSystem") || "auto";
        const thmActive = !!game.THM;
        const ipActive = !!game.modules.get("item-piles")?.active;

        const useTHM = (shopPref === "thm" && thmActive) || (shopPref === "auto" && thmActive);
        const useIP = (shopPref === "item-piles" && ipActive) || (shopPref === "auto" && !useTHM && ipActive);

        if (useTHM) {
            const thmData = tokenDoc.getFlag("treasure-hoard-manager", "data");
            if (thmData && thmData.type === "shop" && thmData.enabled) {
                isMerchant = true;
                const shopItems = actor.items.filter(i => ["weapon", "equipment", "consumable", "loot"].includes(i.type));
                if (shopItems.length > 0) {
                    const itemNames = shopItems.slice(0, 10).map(item => {
                        const name = item.name || "Предмет";
                        const quantity = item.system.quantity || 1;
                        const price = item.system.price?.value || 0;
                        return `${name} (кол-во: ${quantity}, цена: ${price} зм)`;
                    }).join(", ");
                    merchantInfo = `Товары магазина: ${itemNames}`;
                    if (shopItems.length > 10) merchantInfo += ` и еще ${shopItems.length - 10} предметов...`;
                } else {
                    merchantInfo = "Магазин пока пуст.";
                }
            }
        } 
        
        if (!isMerchant && useIP) {
            isMerchant = game.itempiles.API.isValidItemPile(tokenDoc);
            if (isMerchant) {
                try {
                    const items = game.itempiles.API.getItems(tokenDoc);
                    if (items && items.length > 0) {
                        const itemNames = items.slice(0, 10).map(item => `${item.name || "Предмет"} (цена: ${item.price || 0} зм)`).join(", ");
                        merchantInfo = `Товары: ${itemNames}`;
                        if (items.length > 10) merchantInfo += ` и еще ${items.length - 10} предметов...`;
                    }
                } catch (e) {
                    merchantInfo = "Товары доступны для продажи";
                }
            }
        }

        // [NEW] Репутация (Если нет флага, считаем 50 - нейтрально)
        const reputation = tokenDoc.getFlag(MOD_ID, 'reputation') ?? 50;

        return {
            name: actor.name,
            bio: cleanBio,
            secret: secretText,
            stats: `INT:${int}, WIS:${wis}, CHA:${cha}`,
            combatStats: {
                hp: hp,
                ac: ac,
                type: type,
                res: resistances,
                imm: immunities,
                vuln: vulnerabilities
            },
            money: moneyText,
            inventory: inventoryText,
            languages: languagesList,
            isMerchant: isMerchant,
            merchantInfo: merchantInfo,
            reputation: reputation 
        };
    }
}