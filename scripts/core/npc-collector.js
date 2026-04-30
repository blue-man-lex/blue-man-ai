import { MOD_ID } from './settings.js';
import { BlueManSystemManager } from '../systems/adapters/system-manager.js';

export class NpcCollector {
    static collect(tokenDoc) {
        const actor = tokenDoc.actor;
        if (!actor) return null;

        const adapter = BlueManSystemManager.adapter;
        const bio = adapter.getBio(actor, tokenDoc);
        const abilities = adapter.getAbilities(actor);
        const combat = adapter.getCombatStats(actor);
        const languages = adapter.getLanguages(actor);
        const money = adapter.getCurrencyString(actor);
        const inventory = adapter.getInventoryList(actor);

        let isMerchant = adapter.isMerchant(tokenDoc);
        let merchantInfo = "";

        if (isMerchant) {
            // Краткий список товаров для контекста ИИ
            const items = inventory.slice(0, 10).join(", ");
            merchantInfo = `Товары магазина: ${items}${inventory.length > 10 ? "..." : ""}`;
        }

        const reputation = tokenDoc.getFlag(MOD_ID, 'reputation') ?? 50;

        return {
            name: actor.name,
            bio: bio.full,
            secret: bio.secret,
            stats: `INT:${abilities.int}, WIS:${abilities.wis}, CHA:${abilities.cha}`,
            combatStats: combat,
            money: money,
            inventory: inventory.join(", "),
            languages: languages,
            isMerchant: isMerchant,
            merchantInfo: merchantInfo,
            reputation: reputation 
        };
    }
}