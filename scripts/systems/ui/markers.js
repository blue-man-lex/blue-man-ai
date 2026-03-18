import { MOD_ID } from '../../core/settings.js';

export class BlueManMarkers {
    static init() {
        // [FIX] Используем refreshToken вместо renderToken.
        // Это гарантирует, что маркер восстановится, даже если Foundry перерисует токен при загрузке сцены.
        Hooks.on('refreshToken', (token) => {
            if (token.actor && token.actor.type === "npc") {
                 this.drawMarker(token);
            }
        });
    }

    static drawMarker(token) {
        // 1. Проверка настроек
        const visibility = game.settings.get(MOD_ID, "markerVisibility");
        if (visibility === "none") return this.clearMarker(token);
        if (visibility === "gm" && !game.user.isGM) return this.clearMarker(token);

        // 2. Анализ
        // Если данных нет, выходим (маркер нарисуется при следующем refresh, когда данные придут)
        if (!token.actor?.system?.details?.biography) return;

        const bio = (token.actor.system.details.biography.value || "").toLowerCase();
        const cleanBio = bio.replace(/<[^>]*>/g, " ");

        let icon = null;
        let color = 0xFFFFFF;

        // Логика
        if (cleanBio.includes("квест") || cleanBio.includes("quest") || cleanBio.includes("задание")) {
            icon = "?";
            color = 0x00A1FF; // Голубой
        } else if (cleanBio.includes("секрет") || cleanBio.includes("secret")) {
            icon = "!";
            color = 0xFFD700; // Золотой
        }

        // 3. Отрисовка
        if (icon) {
            this.renderPixiMarker(token, icon, color);
        } else {
            this.clearMarker(token);
        }
    }

    static renderPixiMarker(token, text, bgColor) {
        // Если маркер уже есть и он правильный - не перерисовываем лишний раз (оптимизация)
        const existing = token.getChildByName("blue-man-marker");
        if (existing) {
             const existingText = existing.children[1]; // Текст - второй ребенок
             // Если текст и цвет не изменились, выходим
             if (existingText && existingText.text === text) return;
        }
        
        // Если старый или неправильный - удаляем
        this.clearMarker(token);

        const container = new PIXI.Container();
        container.name = "blue-man-marker";

        const radius = 12;

        // 1. Фон
        const bg = new PIXI.Graphics();
        bg.lineStyle(2, 0x000000, 1); 
        bg.beginFill(bgColor, 1);    
        bg.drawCircle(0, 0, radius);
        bg.endFill();
        
        // Тень (совместимость с V13)
        bg.filters = [new PIXI.BlurFilter(0.5)]; 

        // 2. Текст (Символ)
        const style = new PIXI.TextStyle({
            fontFamily: "Arial", 
            fontSize: 18,
            fill: "#FFFFFF",
            fontWeight: "900", // Самый жирный
            stroke: "#000000",
            strokeThickness: 3,
            align: "center"
        });

        const pixiText = new PIXI.Text(text, style);
        pixiText.anchor.set(0.5); 
        pixiText.y = 1; // Центровка по вертикали

        container.addChild(bg);
        container.addChild(pixiText);

        // 3. Позиция (Правый верхний угол)
        container.x = token.w - radius; 
        container.y = radius;           

        // 4. Анимация
        if (game.gsap) {
            container.y = 0; 
            game.gsap.to(container, {
                y: 5, 
                duration: 2.0,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut"
            });
            container.position.set(token.w - radius, radius - 5); 
        }

        token.addChild(container);
    }

    static clearMarker(token) {
        const existing = token.getChildByName("blue-man-marker");
        if (existing) {
            if (game.gsap) game.gsap.killTweensOf(existing);
            token.removeChild(existing);
            existing.destroy();
        }
    }
}