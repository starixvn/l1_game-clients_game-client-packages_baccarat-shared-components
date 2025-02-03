import { FairnessCard } from "db://shared-components/game/poker-cards/scripts/fairness-card";
import { ServiceOldCard } from "db://shared-components/game/poker-cards/scripts/poker-card";
import gc from "@sg/game-client-base";

export interface ServiceCardHand {
    card1: ServiceOldCard;
    card2: ServiceOldCard;
    card3?: ServiceOldCard;
    score: number;
}

export interface BaccaratResult {
    [choice: string]: ServiceCardHand;
}

export interface PoolItem {
    location: CardLocation;
    card: FairnessCard;
}

export interface CardWithTeam {
    card: ServiceOldCard;
    team: gc.GameBaccaratX.BetChoice;
    cardIndex: number;
}

export enum CardLocation {
    Box = 0,
    Player1 = 1,
    Banker1 = 2,
    Player2 = 3,
    Banker2 = 4,
    Waiting1 = 5,
    Waiting2 = 6,
    Player3,
    Banker3
} 