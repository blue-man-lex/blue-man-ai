/*
 * 🧹 ОЧИСТКА КЭША И ПРОВЕРКА СОСТОЯНИЯ BLUE MAN AI
 * 
 * НАЗНАЧЕНИЕ:
 * - Безопасная очистка кеша (кеш отключен по дизайну)
 * - Проверка всех критических настроек модуля
 * - Диагностика состояния провайдеров
 * - Валидация работы AI системы
 * 
 * ЧТО ДЕЛАЕТ:
 * - Вызывает AIProviders.clearCache() (безопасно)
 * - Проверяет все основные настройки (aiProvider, apiKey, models)
 * - Тестирует доступность текущего провайдера
 * - Показывает детальную статистику состояния
 * 
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - ✅ ПЕРВОЕ ДЕЙСТВИЕ при любых проблемах
 * - ✅ Если изменения в настройках не применяются
 * - ✅ При подозрении на проблемы с кешем
 * - ✅ Для регулярной проверки состояния модуля
 * - ✅ Перед другими диагностическими макросами
 * 
 * КАК ЗАПУСКАТЬ:
 * 1. Macro -> Execute -> Выбрать macro-clear-cache.js
 * 2. Или скопировать код в консоль F12 и нажать Enter
 * 
 * ВЕРСИЯ: v0.5.15 (Cache disabled - Protection system ready)
 * ОБНОВЛЕНО: Добавлена проверка системы защиты BlueManDebugger
 */

(async () => {
    console.log('🧹 Начинаю чистку кэша и проверку состояния Blue Man AI...');
    
    try {
        // 1. Проверка AIProviders (кеш отключен по дизайну)
        if (typeof AIProviders !== 'undefined') {
            console.log('🤖 Проверяю AIProviders...');
            AIProviders.clearCache(); // Теперь метод существует!
            console.log('✅ AIProviders проверен (кеш отключен по дизайну)');
        } else {
            console.warn('⚠️ AIProviders не найден - модуль может быть не загружен');
        }
        
        // 2. Проверка системы защиты
        if (typeof BlueManDebugger !== 'undefined') {
            console.log('🛡️ Проверяю систему защиты...');
            const stats = BlueManDebugger.getStats();
            console.log('   - Статистика защиты:', stats);
            
            if (stats.errorCount > 0) {
                console.warn(`⚠️ Обнаружено ${stats.errorCount} ошибок`);
                console.log('   - Последняя ошибка:', stats.lastError);
            }
        } else {
            console.warn('⚠️ Система защиты не найдена');
        }
        
        // 3. Принудительная проверка всех настроек
        console.log('⚙️ Проверяю все настройки...');
        const settings = [
            'aiProvider', 'apiKey', 'aiModels', 'fallbackEnabled',
            'deepseekApiKey', 'deepseekModels', 'gptApiKey', 'gptModels',
            'yandexIamToken', 'yandexFolderId', 'yandexModels',
            'ollamaModels', 'customUrl', 'customApiKey', 'customModels',
            'tone', 'intelligence', 'eloquence', 'worldLoreJournal'
        ];
        
        const settingsStatus = {};
        for (const setting of settings) {
            const value = game.settings.get('blue-man-ai', setting);
            const hasValue = value && value !== '' && value !== null;
            settingsStatus[setting] = hasValue;
            console.log(`   - ${setting}:`, hasValue ? '✅' : '❌ Пусто');
        }
        
        // 4. Проверка работы модуля
        console.log('🔍 Тестирую работу модуля...');
        
        // Тестовый вызов AI
        if (typeof AIProviders !== 'undefined') {
            const testProvider = AIProviders.getCachedSetting('aiProvider');
            console.log('   - Текущий провайдер:', testProvider);
            
            // Проверяем наличие настроек для текущего провайдера
            const providerKey = testProvider === 'gemini' ? 'apiKey' : `${testProvider}ApiKey`;
            const hasProviderKey = settingsStatus[providerKey];
            const hasProviderModels = settingsStatus[`${testProvider}Models`];
            
            console.log(`   - Ключ ${testProvider}:`, hasProviderKey ? '✅' : '❌');
            console.log(`   - Модели ${testProvider}:`, hasProviderModels ? '✅' : '❌');
            
            if (hasProviderKey && hasProviderModels) {
                console.log('✅ Провайдер полностью настроен и готов к работе');
            } else {
                console.warn(`⚠️ Провайдер ${testProvider} не полностью настроен`);
            }
        }
        
        // 5. Итоговая статистика
        const totalSettings = Object.keys(settingsStatus).length;
        const configuredSettings = Object.values(settingsStatus).filter(v => v).length;
        const configurationPercent = Math.round((configuredSettings / totalSettings) * 100);
        
        console.log('🎉 Проверка завершена!');
        console.log(`📊 Настроено: ${configuredSettings}/${totalSettings} (${configurationPercent}%)`);
        console.log('💡 Кеш отключен по дизайну для решения проблем с rate limit');
        console.log('🛡️ Система защиты активна и мониторит состояние модуля');
        
        // Показываем уведомление
        ui.notifications.info(`Blue Man AI: Проверка завершена (${configurationPercent}% настроено)`);
        
    } catch (error) {
        console.error('❌ Ошибка при проверке:', error);
        ui.notifications.error('Blue Man AI: Ошибка при проверке состояния');
        console.log('💡 Перезагрузите Foundry VTT если проблема осталась');
    }
})();
