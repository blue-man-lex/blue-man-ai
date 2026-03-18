/*
 * 🔧 ИСПРАВЛЕНИЕ ПРОБЛЕМНЫХ МОДЕЛЕЙ
 * 
 * НАЗНАЧЕНИЕ:
 * Автоматическое исправление списка моделей - удаление нерабочих и добавление рабочих
 * 
 * ЧТО ДЕЛАЕТ:
 * - Находит и удаляет модели 1.5 поколения (больше не существуют)
 * - Удаляет модели с 429 ошибками (gemini-2.0-flash-lite, gemini-flash-latest)
 * - Добавляет проверенные рабочие модели
 * - Показывает диалог с подтверждением изменений
 * - Очищает кеш после применения изменений
 * 
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - При получении 429 ошибок от Gemini API
 * - Если модели не работают после обновления Google
 * - При сообщениях о несуществующих моделях
 * - Для автоматического исправления списка моделей
 * 
 * КАК ЗАПУСКАТЬ:
 * Macro -> Execute -> Выбрать macro-fix-models.js
 */

(async () => {
  console.log('=== Blue Man AI | Исправление моделей ===');
  
  // 1. Получаем текущие настройки
  const currentModels = game.settings.get('blue-man-ai', 'aiModels');
  const currentProvider = game.settings.get('blue-man-ai', 'aiProvider');
  
  console.log('📋 Текущие модели:', currentModels);
  console.log('📛 Текущий провайдер:', currentProvider);
  
  // Получаем AIProviders класс
  let AIProviders;
  
  // Пытаемся найти AIProviders разными способами
  if (window.BlueManAI?.AIProviders) {
    AIProviders = window.BlueManAI.AIProviders;
  } else if (typeof BlueManAI !== 'undefined' && BlueManAI.AIProviders) {
    AIProviders = BlueManAI.AIProviders;
  } else {
    // Пробуем импортировать напрямую
    try {
      const module = await import('/modules/blue-man-ai/scripts/core/ai-providers.js');
      AIProviders = module.AIProviders;
    } catch (error) {
      console.error('❌ Не удалось импортировать AIProviders:', error);
      ui.notifications.error('Не удалось найти AIProviders класс');
      return;
    }
  }
  
  // 2. Рабочие модели на основе ваших логов
  const workingModels = [
    'gemini-flash-lite-latest',    // ✅ Работает стабильно
    'gemini-2.0-flash',           // Может работать с ограничениями
    'gemini-2.0-pro'              // Может работать с ограничениями
  ];
  
  const problematicModels = [
    'gemini-2.0-flash-lite',      // ❌ 429 ошибка  
    'gemini-flash-latest',        // ❌ 429 ошибка
    'gemini-2.5-flash-lite',      // ❌ 400 ошибка формата
    'gemini-1.5-flash',           // ❌ Удалена - больше не существует
    'gemini-1.5-pro'              // ❌ Удалена - больше не существует
  ];
  
  // 3. Очистка списка от проблемных моделей
  let modelList = currentModels.split(',').map(m => m.trim());
  let cleanedModels = [];
  let removedModels = [];
  
  for (const model of modelList) {
    if (problematicModels.some(pm => model.includes(pm))) {
      removedModels.push(model);
    } else {
      cleanedModels.push(model);
    }
  }
  
  // 4. Добавление рабочих моделей если их нет
  for (const workingModel of workingModels) {
    if (!cleanedModels.includes(workingModel)) {
      cleanedModels.push(workingModel);
    }
  }
  
  const newModels = cleanedModels.join(', ');
  
  console.log('🗑️ Удалены проблемные модели:', removedModels);
  console.log('✅ Новый список моделей:', newModels);
  
  // 5. Показываем диалог пользователю
  const dialogContent = `
    <h2>Исправление моделей Gemini</h2>
    <p><strong>Текущие модели:</strong></p>
    <p style="background: #f0f0f0; padding: 10px; border-radius: 5px;">${currentModels}</p>
    
    <p><strong>Проблемные модели (удалены):</strong></p>
    <p style="background: #ffe6e6; padding: 10px; border-radius: 5px;">${removedModels.join(', ') || 'Нет'}</p>
    
    <p><strong>Новый список моделей:</strong></p>
    <p style="background: #e6ffe6; padding: 10px; border-radius: 5px;">${newModels}</p>
    
    <p><strong>Статус моделей:</strong></p>
    <ul>
      <li>✅ gemini-flash-lite-latest - работает стабильно</li>
      <li>⚠️ gemini-2.0-flash - работает с ограничениями</li>
      <li>⚠️ gemini-2.0-pro - работает с ограничениями</li>
      <li>❌ gemini-2.0-flash-lite - 429 ошибка (удален)</li>
      <li>❌ gemini-1.5-flash - удалена (больше не существует)</li>
    </ul>
  `;
  
  new Dialog({
    title: 'Исправление моделей Gemini',
    content: dialogContent,
    buttons: {
      yes: {
        label: 'Применить исправления',
        callback: async () => {
          try {
            // Сохраняем новый список моделей
            await game.settings.set('blue-man-ai', 'aiModels', newModels);
            
            // Очищаем кеш
            if (AIProviders) {
              AIProviders.clearCache();
            }
            
            console.log('✅ Настройки моделей обновлены');
            ui.notifications.success('Модели успешно исправлены!');
            
            // Тестовый вызов
            console.log('🧪 Тестовый вызов AI...');
            const testResponse = await AIProviders.callAI('тест', {
              name: 'Тестовый NPC',
              type: 'commoner'
            });
            
            console.log('✅ Тестовый вызов успешен:', testResponse);
            ui.notifications.info('Тестовый вызов успешен! Проверьте консоль.');
            
          } catch (error) {
            console.error('❌ Ошибка при сохранении:', error);
            ui.notifications.error(`Ошибка: ${error.message}`);
          }
        }
      },
      no: {
        label: 'Отмена',
        callback: () => {
          console.log('❌ Отмена изменений');
        }
      }
    },
    default: 'yes'
  }).render(true);
  
  // 6. Дополнительная диагностика
  console.log('\n=== Диагностика проблемы 429 ===');
  console.log('💡 Причина 429 ошибки:');
  console.log('   - Google временно ограничил некоторые бесплатные модели');
  console.log('   - Модели 2.0 поколения работают с ограничениями');
  console.log('   - gemini-flash-lite-latest работает как preview модель');
  console.log('   - Модели 1.5 поколения удалены - больше не существуют');
  
  console.log('\n💡 Рекомендации:');
  console.log('   1. Используйте gemini-flash-lite-latest как основную модель');
  console.log('   2. gemini-2.0-flash/pro могут работать с ограничениями');
  console.log('   3. При проблемах попробуйте позже (Google может снять ограничения)');
  console.log('   4. Рассмотрите платный API ключ для более высоких лимитов');
  
})();
