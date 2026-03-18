/*
 * 🎯 ТЕСТ ОДНОЙ СТАБИЛЬНОЙ МОДЕЛИ GEMINI
 * 
 * НАЗНАЧЕНИЕ:
 * - Тестирование одной стабильной модели Gemini
 * - Изоляция проблемной модели от рабочих
 * - Проверка базовой функциональности API
 * - Диагностика проблем с конкретной моделью
 * 
 * ЧТО ДЕЛАЕТ:
 * - Проверяет наличие API ключа Gemini
 * - Тестирует только gemini-1.5-flash (стабильная)
 * - Делает прямой API вызов минуя кеш
 * - Показывает детальный ответ сервера
 * - Помогает изолировать проблемы с моделями
 * 
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - ✅ Если нужно проверить рабочую модель
 * - ✅ Для изоляции проблемной модели
 * - ✅ При тестировании новых моделей
 * - ✅ Если другие модели не работают
 * - ✅ Для проверки базового API функционала
 * 
 * ПРЕИМУЩЕСТВА:
 * - 🎯 Тестирует только одну проверенную модель
 * - 🔍 Детальная диагностика ответа API
 * - 🚀 Быстрый тест без лишних запросов
 * - 💡 Помогает найти рабочую модель
 * 
 * КАК ЗАПУСКАТЬ:
 * 1. Macro -> Execute -> Выбрать macro-test-single-model.js
 * 2. Следить за результатами в консоли F12
 * 
 * ВЕРСИЯ: v0.5.15 (Cache disabled - Protection ready)
 * ОБНОВЛЕНО: Добавлена проверка системы защиты и улучшенная диагностика
 */

(async () => {
    console.log('🎯 Тестирование одной стабильной модели Gemini...');
    
    try {
        // 1. Проверяем систему защиты
        if (typeof BlueManDebugger !== 'undefined') {
            const stats = BlueManDebugger.getStats();
            console.log('🛡️ Статистика защиты:', stats);
        }
        
        // 2. Получаем текущие настройки
        const apiKey = game.settings.get('blue-man-ai', 'apiKey');
        const currentProvider = game.settings.get('blue-man-ai', 'aiProvider');
        const currentModels = game.settings.get('blue-man-ai', 'aiModels');
        
        console.log('🔑 API ключ Gemini:', apiKey ? '✅ Установлен' : '❌ Пустой');
        console.log('🤖 Текущий провайдер:', currentProvider);
        console.log('📋 Текущие модели:', currentModels);
        
        if (!apiKey) {
            console.error('❌ API ключ Gemini не установлен!');
            ui.notifications.error('❌ API ключ Gemini не установлен!');
            console.log('💡 Установите API ключ в настройках модуля');
            return;
        }
        
        // 3. Тестируем только одну самую стабильную модель
        const testModel = 'gemini-1.5-flash'; // Старая но стабильная модель
        
        console.log(`🧪 Тестирую модель: ${testModel}`);
        console.log('⏱️ Отправляю запрос...');
        
        const startTime = Date.now();
        
        // 4. Прямой API вызов
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: "Ответь одним словом: OK"
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 10,
                }
            })
        });
        
        const duration = Date.now() - startTime;
        console.log(`⏱️ Ответ получен за ${duration}ms`);
        
        // 5. Анализируем ответ
        console.log('📊 Статус ответа:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Ошибка API:', errorText);
            
            if (response.status === 429) {
                ui.notifications.error('❌ Rate limit! Попробуйте позже или используйте другой провайдер');
                console.log('💡 Совет: используйте макрос macro-switch-to-deepseek.js');
            } else if (response.status === 403) {
                ui.notifications.error('❌ Проблема с API ключом!');
                console.log('💡 Проверьте API ключ в настройках');
            } else if (response.status === 404) {
                ui.notifications.error('❌ Модель не найдена!');
                console.log('💡 Возможно модель изменила название или недоступна');
            }
            
            return;
        }
        
        const data = await response.json();
        console.log('📄 Полный ответ API:', data);
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text && text.includes("OK")) {
            console.log('✅ Тест успешен! Модель работает корректно');
            console.log('📝 Ответ модели:', text);
            ui.notifications.success(`✅ Модель ${testModel} работает! (${duration}ms)`);
            
            // Предлагаем установить эту модель как основную
            console.log('💡 Модель работает! Можно установить её в настройках:');
            console.log(`   Установите модели: ${testModel}`);
            
        } else {
            console.warn('⚠️ Модель ответила, но ответ некорректен');
            console.log('📝 Полученный ответ:', text);
            ui.notifications.warn('⚠️ Модель отвечает, но ответ странный');
        }
        
        // 6. Итоговая статистика
        console.log('🎉 Тест завершен!');
        console.log(`📊 Время ответа: ${duration}ms`);
        console.log(`🎯 Модель: ${testModel}`);
        console.log(`📝 Статус: ${text ? 'Работает' : 'Не работает'}`);
        
    } catch (error) {
        console.error('❌ Критическая ошибка при тесте:', error);
        ui.notifications.error('❌ Критическая ошибка при тесте модели');
        console.log('💡 Проверьте интернет соединение и API ключ');
    }
})();
