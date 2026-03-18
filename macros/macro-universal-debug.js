/*
 * 🎯 УНИВЕРСАЛЬНАЯ ДИАГНОСТИКА BLUE MAN AI
 * 
 * НАЗНАЧЕНИЕ:
 * Комплексная проверка всего модуля - первый макрос для запуска при любых проблемах
 * 
 * ЧТО ПРОВЕРЯЕТ:
 * - Базовые настройки модуля (провайдер, API ключ, модели)
 * - Состояние игры и готовность системы
 * - Доступность AIProviders класса
 * - Работоспособность всех методов
 * - Систему защиты BlueManDebugger
 * - Тестовый вызов AI
 * - Целостность всех компонентов
 * 
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - ✅ ПЕРВАЯ диагностика при любых проблемах
 * - ✅ Проверка после обновления модуля
 * - ✅ Если не работают другие макросы
 * - ✅ Для комплексной проверки системы
 * - ✅ Перед обращением за поддержкой
 * 
 * ЧТО ДЕЛАЕТ:
 * - Проверяет готовность Foundry VTT
 * - Валидирует все критические настройки
 * - Тестирует работу AIProviders
 * - Проверяет систему защиты
 * - Делает тестовый вызов AI
 * - Показывает детальную статистику
 * - Дает рекомендации по исправлению
 * 
 * РЕЗУЛЬТАТ:
 * - Полный отчет о состоянии модуля
 * - Рекомендации по исправлению проблем
 * - Статистика производительности
 * - Список рабочих компонентов
 * 
 * КАК ЗАПУСКАТЬ:
 * 1. Macro -> Execute -> Выбрать macro-universal-debug.js
 * 2. Анализировать результаты в консоли F12
 * 3. Следовать рекомендациям
 * 
 * ВЕРСИЯ: v0.5.15 (Cache disabled - Protection ready)
 * ОБНОВЛЕНО: Добавлена проверка системы защиты и всех новых провайдеров
 */

(async () => {
    console.log('🎯 Начинаю универсальную диагностику Blue Man AI...');
    console.log('=' .repeat(60));
    
    const diagnosticResults = {
        game: { status: 'unknown', details: {} },
        settings: { status: 'unknown', details: {} },
        providers: { status: 'unknown', details: {} },
        protection: { status: 'unknown', details: {} },
        test: { status: 'unknown', details: {} }
    };
    
    try {
        // 1. ПРОВЕРКА СОСТОЯНИЯ ИГРЫ
        console.log('\n🎮 ПРОВЕРКА СОСТОЯНИЯ FOUNDRY VTT...');
        
        const gameChecks = {
            ready: game.ready || false,
            version: game.version || 'unknown',
            system: game.system?.id || 'unknown',
            userId: game.user?.id || 'unknown',
            canvasReady: !!canvas?.ready
        };
        
        diagnosticResults.game.details = gameChecks;
        
        if (gameChecks.ready && gameChecks.userId && gameChecks.canvasReady) {
            diagnosticResults.game.status = 'success';
            console.log('✅ Foundry VTT готов к работе');
            console.log(`   Версия: ${gameChecks.version}`);
            console.log(`   Система: ${gameChecks.system}`);
        } else {
            diagnosticResults.game.status = 'error';
            console.error('❌ Foundry VTT не готов');
            console.log('💡 Дождитесь полной загрузки игры');
        }
        
        // 2. ПРОВЕРКА НАСТРОЕК МОДУЛЯ
        console.log('\n⚙️ ПРОВЕРКА НАСТРОЕК МОДУЛЯ...');
        
        const criticalSettings = [
            'aiProvider', 'apiKey', 'aiModels', 'fallbackEnabled',
            'deepseekApiKey', 'deepseekModels', 'gptApiKey', 'gptModels',
            'yandexIamToken', 'yandexFolderId', 'yandexModels',
            'ollamaModels', 'customUrl', 'customApiKey', 'customModels',
            'tone', 'intelligence', 'eloquence', 'worldLoreJournal'
        ];
        
        const settingsStatus = {};
        let configuredCount = 0;
        
        for (const setting of criticalSettings) {
            const value = game.settings.get('blue-man-ai', setting);
            const hasValue = value && value !== '' && value !== null;
            settingsStatus[setting] = hasValue;
            if (hasValue) configuredCount++;
        }
        
        diagnosticResults.settings.details = settingsStatus;
        
        const configPercent = Math.round((configuredCount / criticalSettings.length) * 100);
        
        if (configPercent >= 50) {
            diagnosticResults.settings.status = 'success';
            console.log(`✅ Настройки настроены на ${configPercent}%`);
        } else {
            diagnosticResults.settings.status = 'warning';
            console.log(`⚠️ Настройки настроены только на ${configPercent}%`);
        }
        
        // Показываем критичные настройки
        console.log('   Критичные настройки:');
        console.log(`   - Провайдер: ${settingsStatus.aiProvider ? '✅' : '❌'}`);
        console.log(`   - API ключ: ${settingsStatus.apiKey ? '✅' : '❌'}`);
        console.log(`   - Модели: ${settingsStatus.aiModels ? '✅' : '❌'}`);
        
        // 3. ПРОВЕРКА AI PROVIDERS
        console.log('\n🤖 ПРОВЕРКА AI PROVIDERS...');
        
        if (typeof AIProviders !== 'undefined') {
            const providerChecks = {
                exists: true,
                hasCallAI: typeof AIProviders.callAI === 'function',
                hasClearCache: typeof AIProviders.clearCache === 'function',
                hasGetCachedSetting: typeof AIProviders.getCachedSetting === 'function'
            };
            
            diagnosticResults.providers.details = providerChecks;
            
            if (providerChecks.hasCallAI && providerChecks.hasClearCache) {
                diagnosticResults.providers.status = 'success';
                console.log('✅ AIProviders класс полностью функционален');
                
                // Проверяем текущий провайдер
                const currentProvider = AIProviders.getCachedSetting('aiProvider');
                console.log(`   Текущий провайдер: ${currentProvider || 'не установлен'}`);
                
            } else {
                diagnosticResults.providers.status = 'error';
                console.error('❌ AIProviders класс не полностью функционален');
            }
        } else {
            diagnosticResults.providers.status = 'error';
            diagnosticResults.providers.details = { exists: false };
            console.error('❌ AIProviders класс не найден');
        }
        
        // 4. ПРОВЕРКА СИСТЕМЫ ЗАЩИТЫ
        console.log('\n🛡️ ПРОВЕРКА СИСТЕМЫ ЗАЩИТЫ...');
        
        if (typeof BlueManDebugger !== 'undefined') {
            const protectionStats = BlueManDebugger.getStats();
            diagnosticResults.protection.details = protectionStats;
            
            if (protectionStats.initialized) {
                diagnosticResults.protection.status = 'success';
                console.log('✅ Система защиты активна');
                console.log(`   Ошибок: ${protectionStats.errorCount}`);
                console.log(`   Аптайм: ${Math.round(protectionStats.uptime / 1000)}с`);
            } else {
                diagnosticResults.protection.status = 'warning';
                console.log('⚠️ Система защиты не инициализирована');
            }
        } else {
            diagnosticResults.protection.status = 'error';
            diagnosticResults.protection.details = { exists: false };
            console.warn('⚠️ Система защиты не найдена');
        }
        
        // 5. ТЕСТОВЫЙ ВЫЗОВ AI
        console.log('\n🧪 ТЕСТОВЫЙ ВЫЗОВ AI...');
        
        if (diagnosticResults.providers.status === 'success' && settingsStatus.apiKey) {
            try {
                const startTime = Date.now();
                
                const testResponse = await AIProviders.callAI(
                    "Тестовый запрос. Ответь одним словом: OK",
                    { name: "Test NPC", bio: "Test", secret: "None", inventory: "None", money: "None", stats: "INT:10" },
                    {},
                    []
                );
                
                const duration = Date.now() - startTime;
                
                if (testResponse && testResponse.includes("OK")) {
                    diagnosticResults.test.status = 'success';
                    diagnosticResults.test.details = { duration, response: testResponse };
                    console.log(`✅ Тестовый вызов успешен (${duration}ms)`);
                    console.log(`   Ответ: ${testResponse}`);
                } else {
                    diagnosticResults.test.status = 'warning';
                    diagnosticResults.test.details = { duration, response: testResponse };
                    console.log(`⚠️ Тестовый вызов ответил странно (${duration}ms)`);
                    console.log(`   Ответ: ${testResponse}`);
                }
                
            } catch (error) {
                diagnosticResults.test.status = 'error';
                diagnosticResults.test.details = { error: error.message };
                console.error('❌ Тестовый вызов завершился ошибкой:', error.message);
            }
        } else {
            diagnosticResults.test.status = 'skipped';
            diagnosticResults.test.details = { reason: 'Providers not ready or no API key' };
            console.log('⏭️ Тестовый вызов пропущен (провайдеры не готовы)');
        }
        
        // 6. ИТОГОВАЯ СТАТИСТИКА
        console.log('\n📊 ИТОГОВАЯ ДИАГНОСТИКА');
        console.log('=' .repeat(60));
        
        const statuses = {
            success: '✅',
            warning: '⚠️', 
            error: '❌',
            unknown: '❓',
            skipped: '⏭️'
        };
        
        Object.entries(diagnosticResults).forEach(([category, result]) => {
            const icon = statuses[result.status] || '❓';
            console.log(`${icon} ${category.toUpperCase()}: ${result.status.toUpperCase()}`);
        });
        
        // Подсчет общего состояния
        const categoryStatuses = Object.values(diagnosticResults).map(r => r.status);
        const successCount = categoryStatuses.filter(s => s === 'success').length;
        const errorCount = categoryStatuses.filter(s => s === 'error').length;
        const warningCount = categoryStatuses.filter(s => s === 'warning').length;
        
        console.log(`\n🎉 ОБЩИЙ СТАТУС:`);
        console.log(`✅ Успешно: ${successCount}/${categoryStatuses.length}`);
        console.log(`⚠️ Предупреждений: ${warningCount}`);
        console.log(`❌ Ошибок: ${errorCount}`);
        
        // Рекомендации
        console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
        
        if (errorCount > 0) {
            console.log('❌ Обнаружены критические проблемы:');
            if (diagnosticResults.game.status === 'error') {
                console.log('   - Дождитесь полной загрузки Foundry VTT');
            }
            if (diagnosticResults.providers.status === 'error') {
                console.log('   - Перезагрузите модуль или Foundry VTT');
            }
            if (diagnosticResults.settings.status === 'error') {
                console.log('   - Настройте модуль через UI настроек');
            }
        }
        
        if (warningCount > 0) {
            console.log('⚠️ Рекомендуется исправить:');
            if (diagnosticResults.settings.status === 'warning') {
                console.log('   - Заполните больше настроек для лучшей функциональности');
            }
        }
        
        if (successCount === categoryStatuses.length) {
            console.log('🎉 Модуль полностью готов к работе!');
            ui.notifications.success('✅ Blue Man AI готов к работе!');
        } else {
            ui.notifications.warn(`⚠️ Обнаружены проблемы (${errorCount} ошибок)`);
        }
        
        console.log('\n🎯 Универсальная диагностика завершена!');
        console.log('=' .repeat(60));
        
    } catch (error) {
        console.error('💥 КРИТИЧЕСКАЯ ОШИБКА ДИАГНОСТИКИ:', error);
        ui.notifications.error('💥 Критическая ошибка диагностики модуля');
    }
})();
