import gc from "@sg/game-client-base";

import { ServiceOldCard } from "db://shared-components/game/poker-cards/scripts/poker-card";
import { BaccaratResult, ServiceCardHand } from "../cards/baccarat-cards.types";

export interface GameScores {
    playerScore: number;
    bankerScore: number;
}

export class GameBaccaratResultUtil {
    /**
     * Calculates the total score for a set of cards in Baccarat
     * @param cards Array of card values (0-12 where: 0=Ace, 10=Jack, 11=Queen, 12=King)
     * @returns Score between 0-9
     * @throws Error if cards array is empty or contains invalid values
     */
    public static calculateTotal(cards: number[]): number {
        if (!cards || cards.length === 0) {
            throw new Error('Cards array cannot be empty');
        }

        if (cards.some(card => card < 0 || card > 12)) {
            throw new Error('Card values must be between 0 and 12');
        }

        const sum = cards.reduce((total, card) => {
            const cardValue = card >= 9 ? 0 : card + 1;
            return total + cardValue;
        }, 0);

        return sum % 10;
    }

    /**
     * Extracts card values from a card hand
     * @param cards ServiceCardHand object
     * @returns Array of card values (0-12)
     */
    public static extractCards(cards: ServiceCardHand | undefined): number[] {
        if (!cards) {
            return [];
        }

        return Object.values(cards)
            .filter((cardInfo): cardInfo is ServiceOldCard =>
                cardInfo !== undefined && cardInfo.card !== undefined)
            .map((cardInfo) => cardInfo.card);
    }

    /**
     * Calculates score from a service card hand
     * @param hand Object containing card1, card2, and optional card3
     * @param index Index of the card to calculate score for (1, 2, or 3)
     * @returns Score between 0-9
     * @throws Error if hand is undefined
     */
    public static calculateHandScore(hand: ServiceCardHand, index?: number): number {
        if (!hand) {
            throw new Error('Hand cannot be undefined');
        }

        const cardValues = [
            hand.card1?.card,
            hand.card2?.card,
            hand.card3?.card
        ];

        const relevantCards = index !== undefined ?
            cardValues.slice(0, index + 1).filter((card): card is number => card !== undefined) :
            cardValues.filter((card): card is number => card !== undefined);

        return this.calculateTotal(relevantCards);
    }

    /**
     * Gets player and banker scores from a service game result
     * @param result Object containing player and banker hands
     * @param index Optional index to limit score calculation
     * @returns Object with player and banker scores
     * @throws Error if result is undefined
     */
    public static getScores(result: BaccaratResult, index?: number): GameScores {
        if (!result) {
            throw new Error('Result cannot be undefined');
        }

        const playerHand = result[gc.GameBaccaratX.BetChoice.Player];
        const bankerHand = result[gc.GameBaccaratX.BetChoice.Banker];

        return {
            playerScore: this.calculateHandScore(playerHand, index),
            bankerScore: this.calculateHandScore(bankerHand, index)
        };
    }
} 