/**
 * Configuration centralisée pour une partie de Président.
 * Toutes les valeurs ont un défaut raisonnable ; le créateur de la room
 * peut les surcharger via les options de création.
 */
export interface GameConfig {
    minPlayers: number;
    maxPlayers: number;
    /** Séquences (suites) activées */
    enableSequences: boolean;
    /** Le 2 peut couper / brûler le pli */
    enableSpecialTwo: boolean;
    /** Un carré déclenche une révolution (inverse l'ordre) */
    enableRevolution: boolean;
    /** Un carré reset (brûle) également le pli en plus de la révolution */
    revolutionResetsTrick: boolean;
    /** "three_of_clubs" = celui qui a le 3♣ commence
     *  "lowest_card"    = celui qui a la plus petite carte commence */
    startRule: "three_of_clubs" | "lowest_card";
    /** Échanges de cartes en début de manche (Président↔TDC, VP↔VTDC) */
    exchangeCards: boolean;
    /** Temps par tour en millisecondes (0 = pas de timeout) */
    turnTimeoutMs: number;
    /** "bot"      = un bot prend la main jusqu'à la fin
     *  "mmr_loss" = le joueur perd du MMR, la partie continue sans lui */
    abandonBehavior: "bot" | "mmr_loss";
}
/** Valeurs par défaut utilisées si aucune option n'est fournie. */
export declare const DEFAULT_CONFIG: GameConfig;
/**
 * Fusionne les options fournies par le créateur avec les valeurs par défaut.
 */
export declare function buildConfig(overrides?: Partial<GameConfig>): GameConfig;
//# sourceMappingURL=GameConfig.d.ts.map