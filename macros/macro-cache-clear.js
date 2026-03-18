// ========================================
// 🧹 ЧИСТКА КЭША BLUE MAN AI
// ========================================
// Использование: Скопируй этот код в консоль Foundry и нажми Enter

(async () => {
    console.log('🧹 Начинаю чистку кэша Blue Man AI...');
    
    try {
        // 1. Очистка кэша AIProviders если он существует
        if (typeof AIProviders !== 'undefined') {
            console.log('🤖 Очищаю кэш AIProviders...');
            
            // Очищаем кэш настроек
            if (AIProviders._settingsCache) {
                AIProviders._settingsCache.clear();
                console.log('✅ Кэш настроек очищен');
            }
            
            // Сбрасываем переменные
            AIProviders._settingsCache = new Map();
            AIProviders._cacheTimeout = 0; // Отключаем кэш
            
            console.log('✅ AIProviders кэш полностью очищен');
        }
        
        // 2. Принудительное обновление настроек
        console.log('⚙️ Обновляю настройки...');
        const settings = [
            'aiProvider', 'apiKey', 'aiModels', 'fallbackEnabled',
            'tone', 'intelligence', 'eloquence'
        ];
        
        for (const setting of settings) {
            const value = game.settings.get('blue-man-ai', setting);
            console.log(`   - ${setting}:`, value ? '✅' : '❌ Пусто');
        }
        
        // 3. Проверка работы модуля
        console.log('🔍 Проверяю работу модуля...');
        
        // Тестовый вызов AI
        const { AIProviders } = await import('./modules/blue-man-ai/scripts/core/ai-providers.js');
        const testProvider = AIProviders.getCachedSetting('aiProvider');
        console.log('   - Текущий провайдер:', testProvider);
        
        console.log('🎉 Чистка кэша завершена! Попробуйте использовать модуль снова.');
        console.log('💡 Если проблема осталась, перезагрузите Foundry VTT полностью.');
        
    } catch (error) {
        console.error('❌ Ошибка при чистке кэша:', error);
        console.log('💡 Попробуйте перезагрузить Foundry VTT');
    }
})();
