# blue-man-ai
Интеграция Gemini ИИ для NPC: Живые диалоги, Торговля, Квесты и Оживление мира.

# 🤖 Blue Man AI

[![Foundry VTT Version](https://img.shields.io/badge/Foundry-V12%2B-blue.svg)](https://foundryvtt.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.5.15-orange.svg)](https://github.com/blue-man-lex/blue-man-ai)

> **Интеграция Gemini ИИ для NPC: Живые диалоги, Торговля, Квесты и Оживление мира.**

## 🌟 Обзор

Blue Man AI - это мощный модуль для Foundry VTT, который добавляет интеллектуальных NPC с возможностью ведения реальных диалогов через Google Gemini API. Модуль создает живой и динамичный мир, где NPC могут помнить предыдущие разговоры, выдавать квесты и взаимодействовать с игроками на новом уровне.

### ✨ Ключевые возможности

- 🗣️ **Живые диалоги с NPC** - Использует Google Gemini AI для реалистичных разговоров
- 🧠 **Адаптивный AI** - NPC помнят контекст и историю взаимодействий
- 📋 **Система квестов** - Динамическая генерация и управление заданиями
- 🏪 **Интеллектуальная торговля** - AI-торговцы с уникальными предложениями
- 🌍 **Окружающие диалоги** - NPC общаются между собой, создавая живую атмосферу
- 🎯 **Маркеры и интерфейсы** - Удобные инструменты управления AI
- 🔄 **Мультипровайдерность** - Поддержка Gemini, DeepSeek, OpenAI, Yandex и Custom API

## 🚀 Быстрый старт

### 1. Установка

1. Скачайте модуль из [GitHub Releases](https://github.com/blue-man-lex/blue-man-ai/releases)
2. Распакуйте архив в папку `Data/modules/`
3. Активируйте модуль в Foundry VTT

### 2. Первичная настройка

1. Откройте **Game Settings** → **Module Settings** → **Blue Man AI**
2. Выберите провайдера AI (рекомендуется **Google Gemini**)
3. Получите API ключ:
   - **Gemini**: [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **DeepSeek**: [DeepSeek Platform](https://platform.deepseek.com/api_keys)
4. Вставьте API ключ в настройки
5. Настройте модели (рекомендуется: `gemini-1.5-flash, gemini-1.5-pro`)

### 3. Базовое использование

- **Наведите на NPC** и нажмите клавишу **X** для начала диалога
- **Используйте макросы** из папки `/macros` для диагностики и настройки
- **Создайте доску объявлений** через интерфейс модуля для квестов

## 📋 Детальное описание возможностей

### 🗣️ Система диалогов

- **Контекстные разговоры** - NPC учитывают историю диалогов
- **Адаптивные ответы** - AI анализирует персонажа и ситуацию
- **Эмоциональные реакции** - NPC проявляют эмоции в зависимости от контекста
- **Память о событиях** - Запоминают важные события и действия игроков

### 🎯 Система квестов

- **Динамическая генерация** - AI создает уникальные задания
- **Доска объявлений** - Центральный пункт для получения квестов
- **Награды и прогресс** - Автоматическое отслеживание выполнения
- **Многоэтапные квесты** - Сложные сюжетные линии

### 🏪 Торговая система

- **Интеллектуальные торговцы** - AI предлагает релевантные товары
- **Динамические цены** - Адаптация к ситуации и игрокам
- **Уникальные предложения** - Специальные товары и скидки
- **Переговоры** - Возможность торговаться и обсуждать условия

### 🌍 Окружающая атмосфера

- **Диалоги между NPC** - Создание живого мира
- **Случайные события** - Непредсказуемые ситуации
- **Атмосферные фразы** - Реакции на события игры
- **Патрулирование** - NPC перемещаются и взаимодействуют

## 🛠️ Конфигурация

### Основные настройки

```javascript
// API ключи и провайдеры
game.settings.get('blue-man-ai', 'aiProvider') // 'gemini', 'deepseek', 'gpt', 'yandex'
game.settings.get('blue-man-ai', 'apiKey') // Ваш API ключ
game.settings.get('blue-man-ai', 'aiModels') // Список моделей через запятую

// Поведение AI
game.settings.get('blue-man-ai', 'dialogTemperature') // Креативность (0.0-1.0)
game.settings.get('blue-man-ai', 'maxTokens') // Макс. длина ответа
game.settings.get('blue-man-ai', 'memoryDepth') // Глубина памяти
```

### Продвинутые настройки

- **Rate Limit Control** - Управление ограничениями API
- **Кэширование ответов** - Оптимизация производительности
- **Логирование и отладка** - Детальная диагностика
- **Интеграция с другими модулями** - Совместимость с патрулями, торговлей

## 📁 Структура модуля

```
blue-man-ai/
├── 📄 README.md                    # Этот файл
├── 📄 module.json                  # Манифест модуля
├── 📁 scripts/                     # Основной код
│   ├── 📁 core/                     # Ядро системы
│   │   ├── main.js                  # Главный файл
│   │   ├── ai-logic.js              # Логика AI
│   │   ├── ai-providers.js          # Провайдеры API
│   │   ├── ai-settings.js           # Настройки AI
│   │   ├── debug.js                 # Отладка
│   │   ├── flag-handler.js          # Управление флагами
│   │   ├── npc-collector.js         # Сбор NPC
│   │   └── settings.js              # Общие настройки
│   ├── 📁 systems/                  # Системы модуля
│   │   ├── 📁 ambient-system/       # Окружающие диалоги
│   │   ├── 📁 integrations/         # Интеграции
│   │   ├── 📁 quest-system/         # Система квестов
│   │   └── 📁 ui/                    # Пользовательский интерфейс
├── 📁 templates/                    # HTML шаблоны
│   ├── ai-settings.html             # Настройки AI
│   ├── dialog.html                  # Окно диалога
│   ├── notice-board.html            # Доска объявлений
│   └── ...
├── 📁 macros/                       # Макросы для пользователей
│   ├── macro-clear-cache.js         # Очистка кэша
│   ├── macro-switch-to-deepseek.js  # Переключение на DeepSeek
│   ├── macro-test-paid-models.js    # Тест платных моделей
│   └── ...
└── 📁 styles/                       # CSS стили
    └── style.css                    # Основные стили
```

## 🔧 Макросы

Модуль включает набор готовых макросов для удобного управления:

### Основные макросы

- **macro-clear-cache.js** - Очистка кэша (решает 90% проблем)
- **macro-switch-to-deepseek.js** - Быстрое переключение на DeepSeek
- **macro-universal-debug.js** - Комплексная диагностика

### Тестовые макросы

- **macro-test-paid-models.js** - Тест платных моделей
- **macro-test-single-model.js** - Тест одной модели
- **macro-test-api-versions.js** - Сравнение версий API

### Диагностические макросы

- **macro-debug-cache.js** - Глубокая диагностика кеша
- **macro-fix-models.js** - Исправление моделей

## 🎮 Использование в игре

### Начало диалога

1. **Наведите курсор** на NPC
2. **Нажмите клавишу X** (или настроенную клавишу)
3. **Выберите тип диалога** в появившемся меню
4. **Общайтесь** с AI в реальном времени

### Создание квестов

1. **Откройте доску объявлений** через интерфейс модуля
2. **Настройте тип квестов** и сложность
3. **AI сгенерирует** уникальные задания
4. **Игроки принимают** и выполняют квесты

### Торговля

1. **Выберите NPC-торговца**
2. **Начните диалог** о торговле
3. **AI предложит** товары на основе контекста
4. **Ведите переговоры** о ценах и условиях

## 🐛 Устранение неполадок

### Частые проблемы

#### ❌ Rate Limit (слишком много запросов)

**Решение:**
```javascript
// Выполните макрос macro-clear-cache.js
// Или в консоли:
game.settings.set('blue-man-ai', 'aiProvider', 'gemini');
```

#### ❌ API ключ не работает

**Решение:**
1. Проверьте правильность ключа
2. Убедитесь что у вас есть доступ к API
3. Попробуйте другой провайдер (DeepSeek)

#### ❌ NPC не отвечает

**Решение:**
1. Проверьте настройки модуля
2. Очистите кэш через макрос
3. Проверьте подключение к интернету

### Диагностика

Используйте встроенные макросы для диагностики:

1. **macro-universal-debug.js** - Полная проверка системы
2. **macro-debug-cache.js** - Анализ кеша
3. **macro-fix-models.js** - Исправление моделей

### Консольные команды

```javascript
// Проверка настроек
console.log('Provider:', game.settings.get('blue-man-ai', 'aiProvider'));
console.log('API Key:', game.settings.get('blue-man-ai', 'apiKey') ? '✅' : '❌');
console.log('Models:', game.settings.get('blue-man-ai', 'aiModels'));

// Очистка кэша
game.blueManAI?.clearCache?.();

// Перезагрузка AI
game.blueManAI?.reinitialize?.();
```

## 🔗 Интеграции

### Совместимые модули

- **Patrol Module** - Интеграция с патрулированием NPC
- **Item Piles** - Совместимость с торговлей
- **D&D 5e** - Полная поддержка системы
- **Foundry VTT V12+** - Совместимость с последними версиями

### API для разработчиков

```javascript
// Получение доступа к API
const blueManAI = game.modules.get('blue-man-ai').api;

// Создание диалога
await blueManAI.createDialog(actor, message);

// Генерация квеста
const quest = await blueManAI.generateQuest(type, difficulty);

// Очистка кеша
blueManAI.clearCache();
```

## 🤝 Вклад в проект

### Как помочь

1. **Сообщите о проблемах** через [Issues](https://github.com/blue-man-lex/blue-man-ai/issues)
2. **Предложите улучшения** в [Discussions](https://github.com/blue-man-lex/blue-man-ai/discussions)
3. **Внесите код** через Pull Requests
4. **Помогите с документацией** и переводами

### Разработка

```bash
# Клонирование репозитория
git clone https://github.com/blue-man-lex/blue-man-ai.git

# Установка зависимостей (если есть)
npm install

# Разработка
# Внесите изменения в код
# Протестируйте в Foundry VTT
# Создайте Pull Request
```

## 📄 Лицензия

Этот проект лицензирован под **MIT License** - см. файл [LICENSE](LICENSE) для деталей.

## 🙏 Благодарности

- **Foundry VTT** - За прекрасную платформу
- **Google** - За Gemini API
- **DeepSeek** - За альтернативный AI провайдер
- **Сообщество** - За поддержку и обратную связь

## 📞 Поддержка

- **GitHub Issues** - [Сообщить о проблеме](https://github.com/blue-man-lex/blue-man-ai/issues)
- **Discord** - Присоединяйтесь к сообществу (если есть)
- **Документация** - [Wiki](https://github.com/blue-man-lex/blue-man-ai/wiki)

---

<div align="center">

**🤖 Сделано с ❤️ для Foundry VTT сообщества**

[![GitHub](https://img.shields.io/badge/Github-blue-man--lex-blue?style=flat-square&logo=github)](https://github.com/blue-man-lex)
[![Version](https://img.shields.io/badge/Version-0.5.15-orange?style=flat-square)](https://github.com/blue-man-lex/blue-man-ai/releases)

</div>
