/**
 * 🛡️ СИСТЕМА ЗАЩИТЫ И ДИАГНОСТИКИ BLUE MAN AI
 * 
 * НАЗНАЧЕНИЕ:
 * - Мониторинг состояния модуля
 * - Безопасная обработка ошибок  
 * - Graceful degradation при проблемах
 * - Предотвращение критических сбоев
 */

import { MOD_ID } from './settings.js';
import { AIProviders } from './ai-providers.js';

export class BlueManDebugger {
    
    static isInitialized = false;
    static errorCount = 0;
    static lastError = null;
    static _startTime = Date.now();
    
    // 🛡️ Инициализация с защитой
    static init() {
        try {
            if (this.isInitialized) return;
            
            console.log("Blue Man AI | 🛡️ Protection system initializing...");
            
            // Проверяем критические компоненты
            this.checkCriticalComponents();
            
            // Устанавливаем глобальные обработчики ошибок
            this.setupErrorHandlers();
            
            this.isInitialized = true;
            console.log("Blue Man AI | ✅ Protection system ready");
            
        } catch (error) {
            console.error("Blue Man AI | ❌ Protection init failed:", error);
            this.handleError(error, 'PROTECTION_INIT');
        }
    }
    
    // 🔍 Проверка критических компонентов
    static checkCriticalComponents() {
        const checks = [
            { name: 'game.settings', test: () => !!game?.settings },
            { name: 'AIProviders', test: () => typeof AIProviders !== 'undefined' },
            { name: 'clearCache method', test: () => typeof AIProviders?.clearCache === 'function' },
            { name: 'callAI method', test: () => typeof AIProviders?.callAI === 'function' },
            { name: 'MOD_ID', test: () => typeof MOD_ID === 'string' }
        ];
        
        let allPassed = true;
        
        checks.forEach(check => {
            try {
                const passed = check.test();
                console.log(`Blue Man AI | ${passed ? '✅' : '❌'} ${check.name}`);
                if (!passed) allPassed = false;
            } catch (error) {
                console.error(`Blue Man AI | ❌ ${check.name}:`, error);
                allPassed = false;
            }
        });
        
        if (!allPassed) {
            console.warn("Blue Man AI | ⚠️ Some critical components failed - enabling safe mode");
            this.enableSafeMode();
        }
        
        return allPassed;
    }
    
    // 🛡️ Безопасная обработка ошибок
    static setupErrorHandlers() {
        // Перехватываем ошибки AI вызовов
        if (typeof AIProviders !== 'undefined') {
            const originalCallAI = AIProviders.callAI;
            AIProviders.callAI = async (...args) => {
                try {
                    return await originalCallAI.apply(AIProviders, args);
                } catch (error) {
                    this.handleError(error, 'AI_CALL');
                    throw error; // Пробрасываем дальше для fallback
                }
            };
        }
    }
    
    // 📊 Обработка ошибок
    static handleError(error, context = 'UNKNOWN') {
        this.errorCount++;
        this.lastError = { error, context, timestamp: Date.now() };
        
        console.error(`Blue Man AI | 🚨 Error [${context}]:`, error);
        
        // Если слишком много ошибок - включаем safe mode
        if (this.errorCount > 3) {
            this.enableSafeMode();
        }
    }
    
    // 🛡️ Безопасный режим
    static enableSafeMode() {
        console.warn("Blue Man AI | 🛡️ Entering SAFE MODE - basic functionality only");
        
        try {
            // Отключаем все провайдеры кроме Gemini
            game.settings.set(MOD_ID, 'aiProvider', 'gemini');
            game.settings.set(MOD_ID, 'fallbackEnabled', false);
            console.log("Blue Man AI | 🛡️ Safe mode activated - Gemini only, no fallback");
            
            ui.notifications.warn("Blue Man AI: Включен безопасный режим (только Gemini)");
        } catch (error) {
            console.error("Blue Man AI | ❌ Failed to enable safe mode:", error);
        }
    }
    
    // 📊 Статистика
    static getStats() {
        return {
            initialized: this.isInitialized,
            errorCount: this.errorCount,
            lastError: this.lastError,
            uptime: Date.now() - this._startTime
        };
    }
    
    // 🧹 Сброс статистики
    static reset() {
        this.errorCount = 0;
        this.lastError = null;
        console.log("Blue Man AI | 🧹 Protection stats reset");
    }
    
    // 🧪 Тестовый вызов AI с защитой
    static async testCall(text = "Test message") {
        try {
            console.log("Blue Man AI | 🧪 Testing AI call...");
            const response = await AIProviders.callAI(text, {
                name: "Test NPC",
                bio: "Test character",
                secret: "None",
                inventory: "None",
                money: "None",
                stats: "INT:10, WIS:10, CHA:10"
            }, {}, []);
            
            console.log("Blue Man AI | ✅ Test successful:", response);
            return response;
        } catch (error) {
            this.handleError(error, 'TEST_CALL');
            return null;
        }
    }
}

// 🌐 Глобальный доступ для консоли
if (typeof window !== 'undefined') {
    window.BlueManAIDebug = BlueManDebugger;
}

// 🚀 Автоматическая инициализация
Hooks.once('ready', () => {
    BlueManDebugger.init();
});
