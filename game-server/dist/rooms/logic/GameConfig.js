"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.buildConfig = buildConfig;
/** Valeurs par défaut utilisées si aucune option n'est fournie. */
exports.DEFAULT_CONFIG = {
    minPlayers: 3,
    maxPlayers: 7,
    enableSequences: false,
    enableSpecialTwo: false,
    enableRevolution: true,
    revolutionResetsTrick: true,
    startRule: "three_of_clubs",
    exchangeCards: true,
    turnTimeoutMs: 25_000,
    abandonBehavior: "bot",
};
/**
 * Fusionne les options fournies par le créateur avec les valeurs par défaut.
 */
function buildConfig(overrides = {}) {
    return { ...exports.DEFAULT_CONFIG, ...overrides };
}
