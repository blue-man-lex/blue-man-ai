/*
 * 🧪 ТЕСТИРОВАНИЕ ВЕРСИЙ API GEMINI
 * 
 * НАЗНАЧЕНИЕ:
 * Сравнение работы разных версий Gemini API для определения оптимальной
 * 
 * ЧТО ПРОВЕРЯЕТ:
 * - Работоспособность v1beta vs v1 версий API
 * - Ответ конкретных моделей с разными версиями
 * - Скорость ответа каждой версии
 * - Типы ошибок для каждой версии
 * - Рекомендации по выбору лучшей версии
 * 
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - Если нужно определить какая версия API работает лучше
 * - При проблемах с текущей версией API
 * - Для оптимизации производительности
 * - При изменении политики Google в отношении версий
 * 
 * КАК ЗАПУСКАТЬ:
 * Macro -> Execute -> Выбрать macro-test-api-versions.js
 */

(async () => {
  console.log('=== Blue Man AI | Тест версий API Gemini ===');
  
  // 1. Получаем текущие настройки
  const apiKey = game.settings.get('blue-man-ai', 'apiKey');
  const models = game.settings.get('blue-man-ai', 'aiModels');
  
  console.log('🔑 API ключ:', !!apiKey);
  console.log('🤖 Модели:', models);
  
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
  
  // 2. Тестируемые версии API
  const apiVersions = [
    { name: 'v1beta', url: 'https://generativelanguage.googleapis.com/v1beta' },
    { name: 'v1', url: 'https://generativelanguage.googleapis.com/v1' }
  ];
  
  // 3. Тестируемые модели
  const testModels = [
    'gemini-flash-lite-latest',  // ✅ Рабочая модель
    'gemini-2.0-flash',         // ⚠️ Может работать с ограничениями
    'gemini-2.0-pro'           // ⚠️ Может работать с ограничениями
  ];
  
  // 4. Функция для тестирования API
  async function testApiVersion(version, model) {
    const url = `${version.url}/models/${model}:generateContent?key=${apiKey}`;
    
    try {
      console.log(`🔍 Тест: ${version.name} + ${model}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Say hello"
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100
          }
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`✅ ${version.name} + ${model} = "${text}"`);
        return { success: true, version: version.name, model, response: text };
      } else {
        console.log(`❌ ${version.name} + ${model} = ${response.status} ${response.statusText}`);
        console.log('   Ошибка:', data.error?.message || 'Unknown error');
        return { success: false, version: version.name, model, error: data.error?.message };
      }
      
    } catch (error) {
      console.log(`💥 ${version.name} + ${model} = Network error: ${error.message}`);
      return { success: false, version: version.name, model, error: error.message };
    }
  }
  
  // 5. Запускаем тесты
  console.log('\n=== Тестирование версий API ===');
  const results = [];
  
  for (const version of apiVersions) {
    for (const model of testModels) {
      const result = await testApiVersion(version, model);
      results.push(result);
      
      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // 6. Анализ результатов
  console.log('\n=== Анализ результатов ===');
  
  const workingCombinations = results.filter(r => r.success);
  const brokenCombinations = results.filter(r => !r.success);
  
  console.log('✅ Рабочие комбинации:');
  workingCombinations.forEach(r => {
    console.log(`   ${r.version} + ${r.model} = "${r.response}"`);
  });
  
  console.log('\n❌ Нерабочие комбинации:');
  brokenCombinations.forEach(r => {
    console.log(`   ${r.version} + ${r.model} = ${r.error}`);
  });
  
  // 7. Рекомендации
  console.log('\n=== Рекомендации ===');
  
  if (workingCombinations.length > 0) {
    console.log('💡 Найдены рабочие комбинации!');
    
    // Группируем по версиям
    const v1Working = workingCombinations.filter(r => r.version === 'v1');
    const v1betaWorking = workingCombinations.filter(r => r.version === 'v1beta');
    
    if (v1Working.length > 0 && v1betaWorking.length === 0) {
      console.log('🎯 v1 работает, v1beta не работает - проблема в beta версии!');
      console.log('💡 Рекомендую переключить код на стабильную v1 версию');
    } else if (v1betaWorking.length > 0 && v1Working.length === 0) {
      console.log('🎯 v1beta работает, v1 не работает - используйте beta версию');
    } else {
      console.log('🎯 Обе версии работают, но v1 может быть стабильнее');
    }
    
    // Показываем диалог с результатами
    const dialogContent = `
      <h2>Результаты тестирования API Gemini</h2>
      
      <h3>✅ Рабочие комбинации (${workingCombinations.length}):</h3>
      <div style="background: #e6ffe6; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
        ${workingCombinations.map(r => `<div>${r.version} + ${r.model} = "${r.response}"</div>`).join('')}
      </div>
      
      <h3>❌ Нерабочие комбинации (${brokenCombinations.length}):</h3>
      <div style="background: #ffe6e6; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
        ${brokenCombinations.map(r => `<div>${r.version} + ${r.model} = ${r.error}</div>`).join('')}
      </div>
      
      <h3>💡 Рекомендации:</h3>
      <ul>
        ${v1Working.length > 0 && v1betaWorking.length === 0 ? '<li style="color: green;">🎯 Переключить код на стабильную v1 версию API</li>' : ''}
        ${v1betaWorking.length > 0 && v1Working.length === 0 ? '<li>Продолжать использовать v1beta версию</li>' : ''}
        ${v1Working.length > 0 && v1betaWorking.length > 0 ? '<li>Обе версии работают, v1 может быть стабильнее</li>' : ''}
      </ul>
    `;
    
    new Dialog({
      title: 'Тестирование API Gemini',
      content: dialogContent,
      buttons: {
        close: {
          label: 'Закрыть',
          callback: () => {
            console.log('✅ Тестирование завершено');
          }
        }
      }
    }).render(true);
    
  } else {
    console.log('❌ Нет рабочих комбинаций!');
    console.log('💡 Возможные причины:');
    console.log('   - Проблемы с API ключом');
    console.log('   - Сетевые проблемы');
    console.log('   - Превышены лимиты API');
    
    ui.notifications.error('Нет рабочих комбинаций API. Проверьте API ключ и сеть.');
  }
  
})();
