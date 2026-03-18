/*
 * 🔍 ГЛУБОКАЯ ДИАГНОСТИКА КЕША И НАСТРОЕК
 * 
 * НАЗНАЧЕНИЕ:
 * Расширенная диагностика кеша, настроек и их взаимодействия
 * 
 * ЧТО ПРОВЕРЯЕТ:
 * - Полное состояние всех кешей системы
 * - Raw настройки из хранилища Foundry
 * - Сравнение настроек с кешированными значениями
 * - Целостность данных между разными источниками
 * - Работоспособность конкретных моделей
 * 
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - Сложные проблемы с кешем которые не решаются простым макросом
 * - Если настройки не сохраняются или не применяются
 * - При подозрении на рассинхронизацию данных
 * - Для детального анализа состояния системы
 * 
 * КАК ЗАПУСКАТЬ:
 * Macro -> Execute -> Выбрать macro-debug-cache.js
 */

(async () => {
  console.log('=== Blue Man AI | Глубокая диагностика кеша ===');
  
  // 1. Проверка состояния модуля
  if (!window.BlueManAI) {
    console.error('❌ Модуль Blue Man AI не инициализирован');
    ui.notifications.error('Модуль Blue Man AI не найден');
  }
  
  // 2. Получаем AIProviders класс
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
    }
  }
  
  if (!AIProviders) {
    console.error('❌ AIProviders класс не найден');
    ui.notifications.error('AIProviders класс не найден. Перезапустите Foundry.');
    return;
  }
  
  // 2. Полная очистка всех возможных кешей
  console.log('🧹 Полная очистка кешей...');
  
  // Очистка внутреннего кеша AIProviders
  AIProviders.clearCache();
  
  // Очистка кеша настроек Foundry
  const settingsKeys = [
    'blue-man-ai.aiProvider',
    'blue-man-ai.apiKey',
    'blue-man-ai.aiModels',
    'blue-man-ai.deepseekApiKey',
    'blue-man-ai.deepseekModels',
    'blue-man-ai.gptApiKey',
    'blue-man-ai.gptModels',
    'blue-man-ai.yandexApiKey',
    'blue-man-ai.yandexModels',
    'blue-man-ai.ollamaUrl',
    'blue-man-ai.ollamaModels',
    'blue-man-ai.geminiAmbientKey'
  ];
  
  for (const key of settingsKeys) {
    try {
      // Принудительное обновление настройки
      const value = game.settings.storage.get('world').getItem(key);
      if (value !== null) {
        game.settings.storage.get('world').removeItem(key);
        game.settings.storage.get('world').setItem(key, value);
        console.log(`🔄 Обновлена настройка: ${key}`);
      }
    } catch (error) {
      console.warn(`⚠️ Не удалось обновить настройку ${key}:`, error);
    }
  }
  
  console.log('✅ Все кеши очищены');
  
  // 3. Проверка raw настроек из хранилища
  console.log('\n=== Raw настройки из хранилища ===');
  const worldStorage = game.settings.storage.get('world');
  
  for (const key of settingsKeys) {
    try {
      const value = worldStorage.getItem(key);
      console.log(`📋 ${key}:`, value);
    } catch (error) {
      console.warn(`⚠️ Ошибка чтения ${key}:`, error);
    }
  }
  
  // 4. Проверка настроек через game.settings API
  console.log('\n=== Настройки через game.settings ===');
  const provider = game.settings.get('blue-man-ai', 'aiProvider');
  const apiKey = game.settings.get('blue-man-ai', 'apiKey');
  const models = game.settings.get('blue-man-ai', 'aiModels');
  const ambientKey = game.settings.get('blue-man-ai', 'geminiAmbientKey');
  
  console.log('📛 Провайдер:', provider);
  console.log('🔑 API ключ:', !!apiKey);
  console.log('🤖 Модели:', models);
  console.log('🔑 Ambient ключ:', !!ambientKey);
  
  // 6. Проверка кешированных значений после очистки
  console.log('\n=== Кешированные значения после очистки ===');
  console.log('📦 Кеш существует:', !!AIProviders.cache);
  if (AIProviders.cache) {
    console.log('📦 Размер кеша:', AIProviders.cache.size);
  } else {
    console.log('📦 Кеш не инициализирован');
  }
  
  // Принудительное заполнение кеша
  const cachedProvider = AIProviders.getProvider();
  const cachedKey = AIProviders.getApiKey('gemini');
  const cachedModels = AIProviders.getModel('gemini');
  const cachedAmbientKey = AIProviders.getAmbientApiKey('gemini');
  
  console.log('📦 Кешированный провайдер:', cachedProvider);
  console.log('🔑 Кешированный ключ:', !!cachedKey);
  console.log('🤖 Кешированные модели:', cachedModels);
  console.log('🔑 Кешированный ambient ключ:', !!cachedAmbientKey);
  
  // 6. Сравнение настроек
  console.log('\n=== Сравнение настроек ===');
  console.log('Провайдер совпадает:', provider === cachedProvider);
  console.log('API ключ совпадает:', apiKey === cachedKey);
  console.log('Модели совпадают:', models === cachedModels);
  
  // 7. Тест с конкретными рабочими моделями
  console.log('\n=== Тест с рабочими моделями ===');
  const workingModels = [
    'gemini-flash-lite-latest',  // ✅ Работает стабильно
    'gemini-2.0-flash',         // ⚠️ Может работать с ограничениями
    'gemini-2.0-pro'           // ⚠️ Может работать с ограничениями
  ];
  
  for (const model of workingModels) {
    try {
      console.log(`🔍 Тест модели: ${model}`);
      
      // Прямой вызов без кеша
      const response = await AIProviders.callAI('привет', {
        name: 'Тестовый NPC',
        type: 'commoner'
      }, {
        context: 'test',
        temperature: 0.7,
        models: [model],
        useCache: false // Отключаем кеш для теста
      });
      
      console.log(`✅ Модель ${model} работает:`, response);
      ui.notifications.info(`✅ Модель ${model} работает!`);
      
    } catch (error) {
      console.error(`❌ Модель ${model} ошибка:`, error.message);
      ui.notifications.warn(`❌ Модель ${model} ошибка: ${error.message}`);
    }
  }
  
  // 8. Рекомендации
  console.log('\n💡 Рекомендации:');
  if (models.includes('gemini-flash-lite-latest')) {
    console.log('✅ Рабочая модель gemini-flash-lite-latest уже в списке');
  } else {
    console.log('💡 Рекомендую добавить gemini-flash-lite-latest в список моделей');
    console.log('💡 Пример: gemini-flash-lite-latest, gemini-2.0-flash, gemini-2.0-pro');
  }
  
  console.log('⚠️ Модели 1.5 поколения (gemini-1.5-flash, gemini-1.5-pro) удалены - больше не существуют');
  console.log('💡 Используйте gemini-flash-lite-latest как основную рабочую модель');
  
  console.log('\n=== Диагностика завершена ===');
  ui.notifications.info('Глубокая диагностика завершена. Проверьте консоль (F12).');
})();
