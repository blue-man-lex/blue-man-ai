import { SystemAdapter } from './system-adapter.js';
import { Dnd5eAdapter } from './dnd5e-adapter.js';
import { CprAdapter } from './cpr-adapter.js';

/**
 * Blue Man AI - System Manager
 * Управляет выбором и инициализацией адаптера системы.
 */
export class BlueManSystemManager {
    static _adapter = null;

    static init() {
        const systemId = game.system.id;
        console.log(`Blue Man AI | Определение адаптера для системы: ${systemId}`);

        switch (systemId) {
            case "dnd5e":
                this._adapter = new Dnd5eAdapter();
                break;
            case "cyberpunk-red-core":
                this._adapter = new CprAdapter();
                break;
            default:
                console.warn(`Blue Man AI | Система ${systemId} не поддерживается напрямую. Используется базовый адаптер.`);
                this._adapter = new SystemAdapter();
                break;
        }
        
        // Глобальный доступ для удобства
        game.blueManAI = game.blueManAI || {};
        game.blueManAI.adapter = this._adapter;
    }

    static get adapter() {
        if (!this._adapter) this.init();
        return this._adapter;
    }
}
