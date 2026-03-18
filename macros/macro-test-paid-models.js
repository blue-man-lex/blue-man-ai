/*
 * 💰 ТЕСТ ПЛАТНЫХ МОДЕЛЕЙ GEMINI PRO
 * 
 * НАЗНАЧЕНИЕ:
 * - Тестирование платных моделей Gemini с высокими лимитами
 * - Проверка производительности Pro версий
 * - Поиск лучших моделей для серьезных задач
 * - Диагностика доступа к премиум функциям
 * 
 * ЧТО ДЕЛАЕТ:
 * - Проверяет наличие API ключа с доступом к Pro
 * - Тестирует gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash
 * - Делает прямые API вызовы для каждой модели
 * - Измеряет время ответа каждой модели
 * - Показывает детальные результаты сравнения
 * 
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - ✅ Если бесплатные модели не работают
 * - ✅ Для тестирования Gemini Pro/Flash
 * - ✅ При проблемах с производительностью
 * - ✅ Если нужен доступ к продвинутым функциям
 * - ✅ Для поиска оптимальной модели
 * 
 * ПРЕИМУЩЕСТВА PLATНЫХ МОДЕЛЕЙ:
 * - 🚀 Более высокие лимиты запросов
 * - 💪 Улучшенная производительность
 * - 🧠 Лучшее качество ответов
 * - 🎯 Доступ к продвинутым функциям
 * - ⚡ Быстрое время ответа
 * 
 * ТРЕБОВАНИЯ:
 * - 💳 API ключ с доступом к Gemini API
 * - 📊 Включенные платежи в Google AI Studio
 * 
 * КАК ЗАПУСКАТЬ:
 * 1. Macro -> Execute -> Выбрать macro-test-paid-models.js
 * 2. Следить за результатами в консоли F12
 * 
 * ВЕРСИЯ: v0.5.15 (Cache disabled - Protection ready)
 * ОБНОВЛЕНО: Добавлены новые модели и улучшена диагностика
 */

(async () => {
    console.log('💰 Тестирование платных моделей Gemini Pro...');
    
    try {
        // 1. Проверяем систему защиты
        if (typeof BlueManDebugger !== 'undefined') {
            const stats = BlueManDebugger.getStats();
            console.log('🛡️ Статистика защиты:', stats);
        }
        
        // 2. Проверяем API ключ
        const apiKey = game.settings.get('blue-man-ai', 'apiKey');
        
        if (!apiKey) {
            console.error('❌ API ключ Gemini не установлен!');
            ui.notifications.error('❌ API ключ Gemini не установлен!');
            console.log('💡 Установите API ключ в настройках модуля');
            return;
        }
        
        console.log('✅ API ключ найден, начинаю тест платных моделей...');
        
        // 3. Платные модели с более высокими лимитами
        const paidModels = [
            { 
                name: 'gemini-2.0-flash-exp', 
                desc: 'Экспериментальная 2.0',
                type: 'experimental'
            },
            { 
                name: 'gemini-1.5-pro', 
                desc: 'Pro версия',
                type: 'pro'
            },
            { 
                name: 'gemini-1.5-flash', 
                desc: 'Flash версия',
                type: 'flash'
            }
        ];
        
        console.log(`🧪 Буду тестировать ${paidModels.length} платных моделей...`);
        
        const results = [];
        
        // 4. Тестируем каждую модель
        for (const model of paidModels) {
            console.log(`\n🎯 Тестирую: ${model.name} (${model.desc})`);
            
            try {
                const startTime = Date.now();
                
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: "Ответь кратко: Платная модель работает"
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 50,
                        }
                    })
                });
                
                const duration = Date.now() - startTime;
                
                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    
                    const result = {
                        model: model.name,
                        desc: model.desc,
                        type: model.type,
                        status: 'success',
                        duration: duration,
                        response: text || 'No response',
                        tokens: data.usageMetadata?.totalTokens || 'N/A'
                    };
                    
                    results.push(result);
                    console.log(`✅ ${model.name}: УСПЕХ (${duration}ms)`);
                    console.log(`📝 Ответ: ${text}`);
                    console.log(`🔢 Токены: ${result.tokens}`);
                    
                } else {
                    const errorText = await response.text();
                    const result = {
                        model: model.name,
                        desc: model.desc,
                        type: model.type,
                        status: 'error',
                        error: `${response.status}: ${response.statusText}`,
                        details: errorText
                    };
                    
                    results.push(result);
                    console.log(`❌ ${model.name}: ОШИБКА (${response.status})`);
                    
                    if (response.status === 403) {
                        console.log(`💡 Возможно нет доступа к платным моделям`);
                    } else if (response.status === 429) {
                        console.log(`💡 Rate limit - попробуйте позже`);
                    }
                }
                
            } catch (error) {
                const result = {
                    model: model.name,
                    desc: model.desc,
                    type: model.type,
                    status: 'critical_error',
                    error: error.message
                };
                
                results.push(result);
                console.log(`💥 ${model.name}: КРИТИЧЕСКАЯ ОШИБКА`);
                console.error(error);
            }
            
            // Небольшая задержка между запросами
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 5. Анализ результатов
        console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТА:');
        console.table(results);
        
        const successful = results.filter(r => r.status === 'success');
        const failed = results.filter(r => r.status !== 'success');
        
        console.log(`\n🎉 ИТОГИ:`);
        console.log(`✅ Работает: ${successful.length} моделей`);
        console.log(`❌ Не работает: ${failed.length} моделей`);
        
        if (successful.length > 0) {
            console.log(`\n🏆 ЛУЧШИЕ МОДЕЛИ:`);
            successful.sort((a, b) => a.duration - b.duration);
            successful.forEach((result, index) => {
                console.log(`${index + 1}. ${result.desc} (${result.duration}ms) - ${result.response}`);
            });
            
            // Рекомендуем самую быструю
            const bestModel = successful[0];
            console.log(`\n💡 РЕКОМЕНДАЦИЯ: Используйте ${bestModel.model}`);
            console.log(`   Самая быстрая и стабильная модель`);
            
            ui.notifications.success(`✅ Найдено ${successful.length} рабочих моделей!`);
            
        } else {
            console.log(`\n❌ НИ ОДНА МОДЕЛЬ НЕ РАБОТАЕТ`);
            console.log(`💡 Возможные причины:`);
            console.log(`   - Нет доступа к платным моделям`);
            console.log(`   - Проблемы с оплатой в Google AI Studio`);
            console.log(`   - Временные проблемы с API`);
            
            ui.notifications.error('❌ Ни одна платная модель не работает');
        }
        
        console.log('\n🎉 Тест платных моделей завершен!');
        
    } catch (error) {
        console.error('❌ Критическая ошибка при тесте платных моделей:', error);
        ui.notifications.error('❌ Ошибка теста платных моделей');
    }
})();
