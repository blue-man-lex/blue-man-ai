import { MOD_ID } from '../../core/settings.js';

export class QuestService {
    
    static getQuests() {
        return game.settings.get(MOD_ID, "questData") || [];
    }

    static async saveQuests(quests) {
        if (!game.user.isGM) return;
        await game.settings.set(MOD_ID, "questData", quests);
    }

    static _getFolder(folderOrId) {
        if (!folderOrId) return null;
        if (typeof folderOrId === "string") return game.folders.get(folderOrId);
        return folderOrId;
    }

    static async addQuest(journalUuid, sourceName) {
        let quests = this.getQuests();
        const doc = await fromUuid(journalUuid);
        if (!doc) return false;

        // 1. ПОЛУЧАЕМ КОНТЕНТ
        let rawContent = "";
        if (doc.documentName === "JournalEntryPage") {
            rawContent = doc.text.content;
        } else if (doc.pages && doc.pages.size > 0) {
            rawContent = doc.pages.contents[0].text.content;
        }

        // Создаем DOM для удобной работы
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = rawContent;

        // 2. ЧИСТКА СЕКРЕТОВ (GM Only)
        const secretSelectors = [".secret", ".gm-only", "section.secret"];
        secretSelectors.forEach(sel => {
            tempDiv.querySelectorAll(sel).forEach(el => el.remove());
        });

        // --- 3. ПАРСЕР НАГРАД И ЧИСТКА МЕТАДАННЫХ ---
        let rewards = { currency: [], items: [], text: "" };
        
        // Массив регулярок для удаления "технических" строк из текста (чтобы не дублировались)
        const metaRegexes = [
            /(\*\*|###)?\s*(?:Награда|Reward|Rewards)[:\s]+(.*?)(?:<br>|<\/p>|$)/i,
            /(\*\*|###)?\s*(?:Выдает|Источник|Source|Giver)[:\s]+(.*?)(?:<br>|<\/p>|$)/i,
            /(\*\*|###)?\s*(?:Статус|Status)[:\s]+(.*?)(?:<br>|<\/p>|$)/i
        ];

        let fullHtml = tempDiv.innerHTML;

        // 3a. Извлекаем награды специальной регуляркой
        const mechMatch = fullHtml.match(metaRegexes[0]);
        if (mechMatch) {
            const contentLine = mechMatch[2];

            // A. Валюта
            const moneyRegex = /(\d+)\s*(pp|gp|ep|sp|cp|пм|зм|эм|см|мм)/gi;
            const moneyMatches = [...contentLine.matchAll(moneyRegex)];
            moneyMatches.forEach(m => {
                let type = m[2].toLowerCase();
                let icon = "fa-coins";
                if (["pp", "пм"].includes(type)) icon = "fa-gem";
                if (["gp", "зм"].includes(type)) icon = "fa-coins";
                if (["sp", "см"].includes(type)) icon = "fa-moon";
                rewards.currency.push({ amount: m[1], type: type.toUpperCase(), icon: icon });
            });

            // B. Предметы
            const tempLineDiv = document.createElement("div");
            tempLineDiv.innerHTML = contentLine;
            const links = tempLineDiv.querySelectorAll("a[data-uuid]");
            links.forEach(a => {
                rewards.items.push({ name: a.innerText || "Предмет", uuid: a.dataset.uuid, icon: "fa-box-open" });
            });

            const textUuidRegex = /@UUID\[([\w\.-]+)\](?:\{([^}]+)\})?/g;
            const textMatches = [...contentLine.matchAll(textUuidRegex)];
            textMatches.forEach(m => {
                if (!rewards.items.find(i => i.uuid === m[1])) {
                    rewards.items.push({ name: m[2] || "Предмет", uuid: m[1], icon: "fa-box-open" });
                }
            });

            if (rewards.currency.length === 0 && rewards.items.length === 0) {
                rewards.text = tempLineDiv.innerText.trim().substring(0, 100);
            }
        }

        // 3b. ЧИСТКА: Удаляем ВСЕ технические строки из HTML
        metaRegexes.forEach(regex => {
            fullHtml = fullHtml.replace(regex, "");
        });

        const safeHtml = fullHtml;

        // 4. ПРЕВЬЮ (чистый текст без тегов и метаданных)
        tempDiv.innerHTML = fullHtml; // Используем уже очищенный HTML
        let plainText = tempDiv.innerText || tempDiv.textContent || "";
        plainText = plainText.replace(/[#*`_~]/g, "").replace(/\s+/g, " ").trim(); 
        const preview = plainText.substring(0, 160) + (plainText.length > 160 ? "..." : "");

        // 5. КАТЕГОРИИ И ТИПЫ
        let category = "Вне сюжета"; 
        let type = "local";          
        
        let folder = this._getFolder(doc.folder);

        if (folder) {
            const folderNameLower = folder.name.toLowerCase();
            const isSubFolder = folderNameLower.includes("квесты") || 
                                folderNameLower.includes("quests") || 
                                folderNameLower.includes("npc");

            if (isSubFolder) {
                type = "local";
                const parent = this._getFolder(folder.folder);
                if (parent) category = parent.name;
                else category = folder.name;
            } else {
                category = folder.name;
                type = "global";
            }

            // Проверяем, является ли папка доской объявлений
            if (folderNameLower.includes("доска") || folderNameLower.includes("board")) {
                type = "board";
            }
        }

        // 6. СОХРАНЕНИЕ
        const existingIndex = quests.findIndex(q => q.id === journalUuid);
        
        const questData = {
            id: journalUuid,
            title: doc.name,
            description: preview,
            fullText: safeHtml,
            source: sourceName,
            category: category,
            type: type,
            rewards: rewards,
            status: existingIndex > -1 ? quests[existingIndex].status : "active",
            timestamp: Date.now()
        };

        if (existingIndex > -1) {
            quests[existingIndex] = questData;
            ui.notifications.info(`Квест "${doc.name}" обновлен.`);
        } else {
            quests.push(questData);
        }

        await this.saveQuests(quests);
        return true;
    }

    static async updateStatus(journalUuid, status) {
        const quests = this.getQuests();
        const quest = quests.find(q => q.id === journalUuid);
        if (quest && quest.status !== status) {
            quest.status = status;
            await this.saveQuests(quests);
            return true;
        }
        return false;
    }

    static async removeQuest(journalUuid) {
        if (!game.user.isGM) {
            return;
        }
        
        let quests = this.getQuests();
        const questToRemove = quests.find(q => q.id === journalUuid);
        if (!questToRemove) {
            return;
        }
        
        quests = quests.filter(q => q.id !== journalUuid);
        await this.saveQuests(quests);
    }
}