// Патчи для совместимости с другими (багованными) модулями

export function applyCompatibilityFixes() {
    // FIX: Elfrey's Item Price использует несуществующую функцию console.warning
    if (typeof console.warning === "undefined") {
        console.warning = console.warn;
        console.log("Blue Man AI | Compatibility: Applied fix for console.warning");
    }
}