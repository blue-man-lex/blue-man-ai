/*
 * 🔄 БЫСТРОЕ ПЕРЕКЛЮЧЕНИЕ НА DEEPSEEK AI
 * 
 * НАЗНАЧЕНИЕ:
 * - Мгновенное переключение на DeepSeek провайдер
 * - Автоматическая настройка рабочих моделей
 * - Проверка наличия API ключа
 * - Инструкции по получению ключа
 * 
 * ЧТО ДЕЛАЕТ:
 * - Устанавливает aiProvider = 'deepseek'
 * - Настраивает модели: deepseek-chat, deepseek-coder
 * - Проверяет наличие API ключа
 * - Показывает инструкции если ключ отсутствует
 * - Очищает кеш для применения изменений
 * 
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - ✅ Если Gemini не работает из-за rate limit
 * - ✅ Для тестирования альтернативного провайдера
 * - ✅ Если нужно быстро переключиться на рабочий AI
 * - ✅ DeepSeek имеет щедрые бесплатные лимиты
 * 
 * ПРЕИМУЩЕСТВА DEEPSEEK:
 * - 💰 Щедрые бесплатные лимиты
 * - 🚀 Быстрые ответы
 * - 🧠 Качественный кодер (deepseek-coder)
 * - 💬 Хороший диалоговый (deepseek-chat)
 * 
 * КАК ЗАПУСКАТЬ:
 * 1. Macro -> Execute -> Выбрать macro-switch-to-deepseek.js
 * 2. Следовать инструкциям в консоли
 * 
 * ВЕРСИЯ: v0.5.15 (Cache disabled - Protection ready)
 * ОБНОВЛЕНО: Добавлена очистка кеша и проверка системы защиты
 */

(async () => {
    console.log('🔄 Переключение на DeepSeek AI...');
    
    try {
        // 1. Устанавливаем DeepSeek как основной провайдер
        await game.settings.set('blue-man-ai', 'aiProvider', 'deepseek');
        console.log('✅ Провайдер изменен на DeepSeek');
        
        // 2. Устанавливаем рабочие модели DeepSeek
        await game.settings.set('blue-man-ai', 'deepseekModels', 'deepseek-chat,deepseek-coder');
        console.log('🤖 Модели установлены: deepseek-chat, deepseek-coder');
        
        // 3. Очищаем кеш для применения изменений
        if (typeof AIProviders !== 'undefined') {
            AIProviders.clearCache();
            console.log('🧹 Кеш очищен');
        }
        
        // 4. Проверяем наличие API ключа
        const deepseekKey = game.settings.get('blue-man-ai', 'deepseekApiKey');
        
        if (!deepseekKey) {
            console.log('⚠️ API ключ DeepSeek не установлен');
            ui.notifications.warn('⚠️ Нужно установить API ключ DeepSeek в настройках');
            
            console.log('💡 Как получить ключ DeepSeek:');
            console.log('   1. Зарегистрируйтесь на https://platform.deepseek.com');
            console.log('   2. Создайте API ключ в профиле (API Keys)');
            console.log('   3. Вставьте ключ в настройки модуля (Blue Man AI -> DeepSeek)');
            console.log('   4. DeepSeek имеет щедрые бесплатные лимиты!');
            console.log('   5. После установки ключа - перезапустите макрос');
        } else {
            console.log('✅ API ключ DeepSeek установлен');
            ui.notifications.info('✅ DeepSeek готов к использованию!');
            
            // 5. Тестовый вызов если ключ есть
            console.log('🧪 Пробуем тестовый вызов...');
            try {
                if (typeof AIProviders !== 'undefined') {
                    const testResponse = await AIProviders.callProvider('deepseek', 
                        "Тестовый запрос. Ответь одним словом: OK", 
                        { name: "Test NPC", bio: "Test", secret: "None", inventory: "None", money: "None", stats: "INT:10" }, 
                        {}, 
                        []
                    );
                    
                    if (testResponse && testResponse.includes("OK")) {
                        console.log('✅ Тестовый вызов успешен!');
                        ui.notifications.info('🎉 DeepSeek полностью настроен и работает!');
                    } else {
                        console.warn('⚠️ Тестовый вызов вернул странный ответ:', testResponse);
                        ui.notifications.warn('⚠️ DeepSeek настроен, но тестовый вызов подозрителен');
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка тестового вызова:', error);
                ui.notifications.error('❌ Ошибка тестового вызова DeepSeek');
            }
        }
        
        console.log('🎉 Переключение на DeepSeek завершено!');
        
    } catch (error) {
        console.error('❌ Ошибка при переключении на DeepSeek:', error);
        ui.notifications.error('❌ Не удалось переключиться на DeepSeek');
    }
})();
