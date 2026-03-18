import { MOD_ID } from '../../core/settings.js';
import { callGemini } from '../../core/ai-logic.js'; 
import { NpcCollector } from '../../core/npc-collector.js';
import { BlueManFlagHandler } from '../../core/flag-handler.js';

export function initPatrolIntegration() {
    console.log("Blue Man AI | Initializing Patrol Integration...");
    
    // ГЛОБАЛЬНЫЙ ЛОГГЕР ДЛЯ ВСЕХ PATROL HOOKS (только для отладки)
    if (game.settings.get(MOD_ID, "enableDebugLogs")) {
        Hooks.on('patrolAlerted', (spotter, spotted) => {
            console.log(" GLOBAL patrolAlerted triggered:", { 
                spotter: spotter?.name || spotter?.id, 
                spotted: spotted?.name || spotted?.id,
                caller: "GLOBAL LOGGER"
            });
        });
        
        Hooks.on('patrolSpotted', (spotter, spotted) => {
            console.log(" GLOBAL patrolSpotted triggered:", { 
                spotter: spotter?.name || spotter?.id, 
                spotted: spotted?.name || spotted?.id,
                caller: "GLOBAL LOGGER"
            });
        });
    }
    
    // ФАЗА 1: ПОДОЗРЕНИЕ (ALERTED) - показываем "?"
    Hooks.on('patrolAlerted', async (spotter, spotted) => {
        console.log("Blue Man AI | PATROL ALERTED Hook triggered:", { 
            spotter: spotter?.name || spotter?.id, 
            spotted: spotted?.name || spotted?.id,
            spotterType: typeof spotter,
            spottedType: typeof spotted,
            isGM: game.user?.isGM 
        });

        // --- FIX: ЗАЩИТА ОТ ИГРОКОВ ---
        // Игроки не имеют прав управлять НПС. Этот код выполняет ТОЛЬКО ГМ.
        if (!game.user.isGM) {
            console.log("Blue Man AI | Patrol ALERTED: Not GM, skipping");
            return;
        }
        // ------------------------------
        
        if (!game.settings.get(MOD_ID, "enablePatrolReaction")) {
            console.log("Blue Man AI | Patrol ALERTED: Patrol reaction disabled");
            return;
        }

        const npcToken = spotter.object || canvas.tokens.get(spotter.id);
        const playerToken = spotted.object || canvas.tokens.get(spotted.id);

        console.log("Blue Man AI | Patrol ALERTED: Resolved tokens:", { 
            npcToken: npcToken?.name, 
            playerToken: playerToken?.name 
        });

        if (!npcToken || !playerToken) {
            console.warn("Blue Man AI | Patrol ALERTED: Missing tokens", { npcToken, playerToken });
            return;
        }

        console.log("Blue Man AI | Patrol ALERTED: Showing bubble ?!");
        // Показываем бабл с "?" - страж что-то услышал
        await BlueManFlagHandler.showBubble(npcToken.document, "?!", true);
    });

    // ФАЗА 2: ОБНАРУЖЕНИЕ (SPOTTED) - показываем "!" и диалог
    Hooks.on('patrolSpotted', async (spotter, spotted) => {
        console.log("Blue Man AI | PATROL SPOTTED Hook triggered:", { 
            spotter: spotter?.name || spotter?.id, 
            spotted: spotted?.name || spotted?.id,
            spotterType: typeof spotter,
            spottedType: typeof spotted,
            isGM: game.user?.isGM 
        });

        // --- FIX: ЗАЩИТА ОТ ИГРОКОВ ---
        // Игроки не имеют прав управлять НПС. Этот код выполняет ТОЛЬКО ГМ.
        if (!game.user.isGM) {
            console.log("Blue Man AI | Patrol SPOTTED: Not GM, skipping");
            return;
        }
        // ------------------------------
        
        if (!game.settings.get(MOD_ID, "enablePatrolReaction")) {
            console.log("Blue Man AI | Patrol SPOTTED: Patrol reaction disabled");
            return;
        }

        const npcToken = spotter.object || canvas.tokens.get(spotter.id);
        const playerToken = spotted.object || canvas.tokens.get(spotted.id);

        console.log("Blue Man AI | Patrol SPOTTED: Resolved tokens:", { 
            npcToken: npcToken?.name, 
            playerToken: playerToken?.name 
        });

        if (!npcToken || !playerToken) {
            console.warn("Blue Man AI | Patrol SPOTTED: Missing tokens", { npcToken, playerToken });
            return;
        }

        console.log("Blue Man AI | Patrol SPOTTED: Processing reaction...");

        // 1. Остановка анимации и разворот к игроку
        if (npcToken.document.animation) await npcToken.stopAnimation();
        
        const ray = new Ray(npcToken.center, playerToken.center);
        const angle = (ray.angle * 180 / Math.PI) - 90; 
        await npcToken.document.update({ rotation: angle });

        // 2. Поиск игрока-владельца
        let targetUser = game.users.find(u => !u.isGM && u.active && playerToken.document.testUserPermission(u, "OWNER"));
        // Фолбэк для тестов ГМа
        if (!targetUser && playerToken.document.testUserPermission(game.user, "OWNER")) {
            targetUser = game.user; 
        }

        if (!targetUser) return;

        // 3. Генерация фразы
        const npcData = NpcCollector.collect(npcToken.document);
        const socialStatus = npcToken.document.getFlag(MOD_ID, 'socialStatus') || {};
        
        const triggerText = `[SYSTEM EVENT]: You are PATROLLING and just SPOTTED this character (${playerToken.name}). Shout a warning ("Stop!", "Identify yourself!") immediately!`;
        
        const response = await callGemini(triggerText, npcData, { 
            socialStatus: socialStatus, 
            isWhisper: false,
            languageInfo: { hasShared: true }
        }, []);

        // 4. Запись в историю
        const historyItem = { 
            speaker: npcData.name, 
            text: response, 
            isSystem: false, 
            isWhisper: false, 
            ownerId: game.user.id 
        };
        
        let currentHistory = npcToken.document.getFlag(MOD_ID, 'chatHistory') || [];
        currentHistory.push(historyItem);
        await npcToken.document.setFlag(MOD_ID, 'chatHistory', currentHistory);

        // 5. Отправка команды клиенту + сохранение ID патруля для возобновления
        const patrolId = npcToken.document.getFlag("patrol", "patrolId");
        console.log("Blue Man AI | Patrol SPOTTED: Saving patrol ID for resume:", patrolId);
        
        // ФИКС: Если patrolId отсутствует, пробуем найти патруль по токену
        let actualPatrolId = patrolId;
        if (!actualPatrolId && game.patrol?.patrols) {
            const patrolByToken = game.patrol.patrols.find(p => p.token?.id === npcToken.id);
            if (patrolByToken) {
                actualPatrolId = patrolByToken.id;
                console.log("Blue Man AI | Found patrol by token:", actualPatrolId);
            }
        }
        
        await BlueManFlagHandler.sendForceOpen(targetUser.id, npcToken.id, playerToken.id, response, socialStatus, actualPatrolId);
    });
}