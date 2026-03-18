import { MOD_ID } from './settings.js';
import { AIProviders } from './ai-providers.js';

export class BlueManAISettings extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "🤖 Настройки Blue Man AI",
            template: `modules/${MOD_ID}/templates/ai-settings.html`,
            width: 800,
            height: 600,
            resizable: true,
            classes: ["blue-man-ai-settings"],
            tabs: [{ 
                navSelector: ".tabs-nav", 
                contentSelector: ".content", 
                initial: "gemini" 
            }]
        });
    }

    getData() {
        return {
            currentProvider: game.settings.get(MOD_ID, "aiProvider") || "gemini",
            gemini: {
                apiKey: AIProviders.getApiKey('gemini') || "",
                geminiAmbientKey: AIProviders.getCachedSetting("geminiAmbientKey") || "",
                aiModels: AIProviders.getModel('gemini') || ""
            },
            deepseek: {
                apiKey: AIProviders.getApiKey('deepseek') || "",
                aiModels: AIProviders.getModel('deepseek') || ""
            },
            gpt: {
                apiKey: AIProviders.getApiKey('gpt') || "",
                aiModels: AIProviders.getModel('gpt') || ""
            },
            yandex: {
                iamToken: AIProviders.getApiKey('yandex') || "",
                folderId: AIProviders.getCachedSetting("yandexFolderId") || "",
                aiModels: AIProviders.getModel('yandex') || ""
            },
            ollama: {
                url: AIProviders.getCachedSetting("ollamaUrl") || "http://localhost:11434",
                aiModels: AIProviders.getModel('ollama') || ""
            },
            custom: {
                url: AIProviders.getCachedSetting("customUrl") || "",
                apiKey: AIProviders.getApiKey('custom') || "",
                aiModels: AIProviders.getModel('custom') || "",
                customFormat: AIProviders.getCachedSetting("customFormat") || "openai",
                customParams: AIProviders.getCachedSetting("customParams") || '{"temperature": 0.7, "max_tokens": 1000}'
            }
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        // Сохранение настроек при изменении
        html.find('input, select').on('change', async (event) => {
            await this._saveSetting(event.target);
        });

        // Кнопки "Сделать активным"
        html.find('.set-provider').on('click', async (event) => {
            const provider = event.target.dataset.provider;
            await game.settings.set(MOD_ID, "aiProvider", provider);
            ui.notifications.info(`${provider.toUpperCase()} теперь активный провайдер ИИ`);
            // Перерисовываем окно чтобы обновить индикаторы
            this.render();
        });

        // Тестовые кнопки
        html.find('.test-connection').on('click', async (event) => {
            const provider = event.target.dataset.provider;
            await this._testConnection(provider);
        });
    }

    async _saveSetting(element) {
        const provider = element.dataset.provider;
        const key = element.dataset.key;
        const value = element.type === 'checkbox' ? element.checked : element.value;

        // Сохраняем в game.settings
        await game.settings.set(MOD_ID, key, value);
        
        // 🛠️ ОБЯЗАТЕЛЬНО очищаем кэш AIProviders чтобы новые настройки применились
        AIProviders.clearCache();
        
        ui.notifications.info(`Настройки ${provider} сохранены`);
    }

    async _testConnection(provider) {
        // 🛡️ Защита от спама - проверяем上次 тест
        const now = Date.now();
        const lastTest = this._lastTestTime || 0;
        if (now - lastTest < 5000) { // 5 секунд между тестами
            ui.notifications.warn("⏰ Подожди 5 секунд перед следующим тестом");
            return;
        }
        this._lastTestTime = now;
        
        ui.notifications.info(`Проверка соединения с ${provider}...`);
        
        try {
            // Делаем реальный тестовый вызов API
            const testResponse = await AIProviders.callProvider(provider, 
                "Тестовый запрос. Ответь одним словом: OK", 
                { name: "Тестовый NPC" }, 
                {}, 
                []
            );
            
            if (testResponse && testResponse.includes("OK")) {
                ui.notifications.info(`✅ Соединение с ${provider} успешно проверено!`);
            } else {
                ui.notifications.warn(`⚠️ Соединение установлено, но ответ некорректен: ${testResponse?.substring(0, 50)}...`);
            }
        } catch (error) {
            ui.notifications.error(`❌ Ошибка соединения с ${provider}: ${error.message}`);
        }
    }

    async _updateObject(event, formData) {
        // Сохранение всех настроек
        for (const [key, value] of Object.entries(formData)) {
            await game.settings.set(MOD_ID, key, value);
        }
        
        ui.notifications.info("Все настройки сохранены!");
    }
}
