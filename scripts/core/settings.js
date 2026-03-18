import { BlueManAISettings } from './ai-settings.js';

export const MOD_ID = 'blue-man-ai';

export function registerSettings() {
    // --- 1. ВНУТРЕННИЕ НАСТРОЙКИ (не видны в UI) ---
    game.settings.register(MOD_ID, "aiProvider", {
        name: "AI Provider (Internal)",
        scope: "world",
        config: false, // Скрыто из UI
        type: String,
        default: "gemini"
    });

    // API ключи (скрыты из UI, хранятся в отдельном меню AI)
    game.settings.register(MOD_ID, "apiKey", {
        name: "Gemini API Key",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "geminiAmbientKey", {
        name: "Gemini Ambient API Key",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "deepseekApiKey", {
        name: "DeepSeek API Key",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });


    game.settings.register(MOD_ID, "gptApiKey", {
        name: " OpenAI GPT API Key",
        hint: "Ключ для доступа к OpenAI GPT API",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });


    game.settings.register(MOD_ID, "yandexIamToken", {
        name: " Yandex IAM Token",
        hint: "Токен для доступа к Yandex GPT API",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "yandexFolderId", {
        name: " Yandex Folder ID",
        hint: "ID папки Yandex Cloud",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });


    game.settings.register(MOD_ID, "ollamaUrl", {
        name: "Ollama URL",
        scope: "world",
        config: false,
        type: String,
        default: "http://localhost:11434"
    });


    game.settings.register(MOD_ID, "aiModels", {
        name: "Gemini Models",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "deepseekModels", {
        name: "DeepSeek Models",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "gptModels", {
        name: "GPT Models",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "yandexModels", {
        name: "Yandex Models",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "ollamaModels", {
        name: "Ollama Models",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // --- 2. ОСНОВНЫЕ НАСТРОЙКИ ---
    game.settings.register(MOD_ID, "fallbackEnabled", {
        name: " Автопереключение при ошибках",
        hint: "Если основной ИИ не отвечает, автоматически попробовать Gemini",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    // --- Custom Provider Settings ---
    game.settings.register(MOD_ID, "customUrl", {
        name: "URL Custom провайдера",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "customApiKey", {
        name: "API ключ Custom провайдера",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "customModels", {
        name: "Модели Custom провайдера",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MOD_ID, "customFormat", {
        name: "Формат запроса Custom",
        scope: "world",
        config: false,
        type: String,
        default: "openai"
    });

    game.settings.register(MOD_ID, "customParams", {
        name: "Доп. параметры Custom",
        scope: "world",
        config: false,
        type: String,
        default: '{"temperature": 0.7, "max_tokens": 1000}'
    });

    // --- 2. СЮЖЕТ И КВЕСТЫ ---
    game.settings.register(MOD_ID, "worldLoreJournal", {
        name: "Глобальный Сюжет (Main Arc)",
        hint: "вставить UUID вашего журнала (разбивать по сессиям) для загрузки мозгов НПС",
        scope: "world",
        config: true,
        type: String,
        default: ""
    });

    // Хранилище квестов (JSON)
    game.settings.register(MOD_ID, "questData", {
        name: "Quest Database",
        scope: "world",
        config: false, 
        type: Array,
        default: []
    });

    // Галочка для 'Читеров'
    game.settings.register(MOD_ID, "enableQuestHints", {
        name: "Кнопка 'Источник Квеста'",
        hint: "Если включено, игроки увидят кнопку (книжку) в диалоге.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(MOD_ID, "markerVisibility", {
        name: "Маркеры Квестов/Секретов",
        hint: "Кто видит иконки '!' и '?'",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "all": "Все (Игроки + ГМ)",
            "gm": "Только ГМ",
            "none": "Отключено"
        },
        default: "all",
        onChange: () => { canvas.tokens.placeables.forEach(t => t.draw()); }
    });

    // --- 3. ПОВЕДЕНИЕ ---
    game.settings.register(MOD_ID, "allowAmbientTalk", {
        name: "Включить Оживление Мира (Ambient)",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });
    
    game.settings.register(MOD_ID, "enablePatrolReaction", {
        name: "Реакция Патруля",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    // --- 4. ГЛОБАЛЬНЫЙ ХАРАКТЕР ---
    game.settings.register(MOD_ID, "tone", { 
        name: "Тон (Глобальный)", 
        scope: "world", 
        config: true, 
        type: Number, 
        default: 50 
    });
    game.settings.register(MOD_ID, "intelligence", { 
        name: "Интеллект (Глобальный)", 
        scope: "world", 
        config: true, 
        type: Number, 
        default: 50 
    });
    game.settings.register(MOD_ID, "eloquence", { 
        name: "Красноречие (Глобальное)", 
        scope: "world", 
        config: true, 
        type: Number, 
        default: 50 
    });

    // --- 5. ОТЛАДКА И ДИАГНОСТИКА ---
    game.settings.register(MOD_ID, "enableDebugLogs", {
        name: " Включить отладочные логи",
        hint: "Показывать детальные логи для отладки интеграции с патрулями и другими системами",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    // --- 6. ИНТЕГРАЦИЯ МАГАЗИНОВ ---
    game.settings.register(MOD_ID, "shopSystem", {
        name: "Система магазинов",
        hint: "Выберите, какой модуль использовать для кнопок магазина и торговли. При значении 'Авто' приоритет отдается THM.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "auto": "Авто (Приоритет THM)",
            "thm": "Treasure Hoard Manager",
            "item-piles": "Item Piles",
            "none": "Отключить магазины"
        },
        default: "auto"
    });

    // --- 5. КНОПКА НАСТРОЕК AI ---
    game.settings.registerMenu(MOD_ID, "aiSettings", {
        name: " Настройки Blue Man AI",
        label: "Открыть настройки AI",
        hint: "Открывает отдельное окно для настройки всех AI провайдеров",
        icon: "fas fa-robot",
        type: BlueManAISettings,
        restricted: true
    });
}
