import gc from "@sg/game-client-base";
import { _decorator, instantiate, Node, Prefab, tween, UITransform, v3, Vec3 } from "cc";
import { FairnessCard } from "db://shared-components/game/poker-cards/scripts/fairness-card";
import { convertOldCardToServiceCard, ServiceCard, ServiceOldCard } from "db://shared-components/game/poker-cards/scripts/poker-card";
import { ObserverComponent } from "db://shared-components/shared/common-components/observer-component/scripts/observer-component";
import Observer from "observer";
import { BaccaratXCards } from "db://shared-components/game-baccarat/cards/baccarat-x-cards";
import { GameBaccaratResultUtil } from "../utils/game-result-util";
import { BaccaratResult, CardLocation, CardWithTeam, PoolItem, ServiceCardHand } from "./baccarat-cards.types";

const { ccclass, property } = _decorator;
const { render, handle } = Observer;
const { Rounds, GameBaccaratX } = gc;

// Constants
const CARD_SCALE = 0.34;
const CARD_SCALE_WAITING = 0.2;
const MOVING_CARD_DURATION = 0.5;
const OPEN_CARD_DURATION = 0.8;
const MAX_CARDS = 6;

@ccclass
export class BaccaratCardsUI extends ObserverComponent {
    // Properties
    @property(Prefab)
    private prfCard: Prefab = null;

    @property(Node)
    private nodeCardContainer: Node = null;

    @property(Node)
    private nodeWaitingCard: Node = null;

    @property(Node)
    private nodeBoxCard: Node = null;

    private _cardHands: BaccaratXCards[] = [];
    private cards: FairnessCard[] = [];
    private cardPool: PoolItem[] = [];

    // Lifecycle Methods
    async onLoad() {
        await this.initializeCards();
        super.onLoad();
    }

    // Public Methods
    public async initCards(): Promise<void> {
        await this.initializeCards();
    }

    // Card Initialization
    private async initializeCards(): Promise<void> {
        if (this.cardPool.length > 0) {
            return;
        }

        for (let i = 0; i < MAX_CARDS; i++) {
            const node = this.createCardNode();
            this.nodeCardContainer.addChild(node);
            node.active = false;

            const card = node.getComponent(FairnessCard);
            card.setIndexValue(i);

            this.cardPool.push({
                location: CardLocation.Box,
                card,
            });

            this.transformCardNode(node, CardLocation.Box, false);
        }

        this.cards = this.cardPool.map((item) => item.card);
    }

    private createCardNode(): Node {
        const node = instantiate(this.prfCard);
        node.setScale(v3(CARD_SCALE, CARD_SCALE));
        return node;
    }

    // Card Management
    private get cardHands(): BaccaratXCards[] {
        if (this._cardHands.length === 0) {
            this._cardHands = this.node.getComponentsInChildren(BaccaratXCards);
        }
        return this._cardHands;
    }

    private updateLocation(item: PoolItem, location: CardLocation): void {
        item.location = location;
    }

    // Card Transformation
    private transformCardNode(node: Node, location: CardLocation, animated = true): void {
        let scale: Vec3;
        let eulerAngles: Vec3;

        switch (location) {
            case CardLocation.Box:
                eulerAngles = this.nodeBoxCard.eulerAngles;
                scale = this.nodeBoxCard.scale;
                break;
            case CardLocation.Player3:
                eulerAngles = v3(0, 0, -90);
                scale = v3(1, 1, 1).multiplyScalar(CARD_SCALE);
                break;

            case CardLocation.Banker3:
                eulerAngles = v3(0, 0, 90);
                scale = v3(1, 1, 1).multiplyScalar(CARD_SCALE);
                break;
            case CardLocation.Waiting1:
            case CardLocation.Waiting2:
                eulerAngles = v3(0, 0, 0);
                scale = v3(1, 1, 1).multiplyScalar(CARD_SCALE_WAITING);
                break;

            default:
                eulerAngles = v3(0);
                scale = v3(1, 1, 1).multiplyScalar(CARD_SCALE);
                break;
        }

        if (animated) {
            tween(node).to(MOVING_CARD_DURATION, { scale, eulerAngles }).start();
        } else {
            node.scale = scale;
            node.eulerAngles = eulerAngles;
        }
    }

    // Card Drawing Operations
    public async draw6Cards(animated = true): Promise<void> {
        this.resetCardsToBox(this.cardPool);
        this.cards = this.cardPool.map((item) => item.card);

        if (animated) {
            await this.drawingCards(this.cardPool, animated);
        } else {
            this.drawingCards(this.cardPool, animated);
        }
    }

    private resetCardsToBox(pool: PoolItem[]): void {
        pool.forEach((item) => {
            item.card.card.faceDown();
            item.location = CardLocation.Box;
            this.moveCard(item.card, CardLocation.Box, false);
            item.card.node.active = false;
        });
    }

    private async drawingCards(cards: PoolItem[], animated = true): Promise<void> {
        for (let i = 0; i < cards.length; i++) {
            const item = cards[i];
            const nextLocation = i + 1;
            item.card.node.active = true;

            if (animated) {
                this.playSoundDrawCard();
                await this.moveCard(item.card, nextLocation, animated);
            } else {
                this.moveCard(item.card, nextLocation, animated);
            }

            this.updateLocation(item, nextLocation);
        }
    }

    // Card Opening and Results
    public async openCards(
        result: BaccaratResult,
        settlemenResult: gc.GameServiceMessage.TSettlementResult,
        animated = true
    ): Promise<void> {
        this.draw6Cards(false);

        const dataCards: CardWithTeam[] = [];
        for (let cardIndex = 0; cardIndex < 3; cardIndex++) {
            [GameBaccaratX.BetChoice.Player, GameBaccaratX.BetChoice.Banker].forEach((team) => {
                const handData = result[team];
                dataCards.push({
                    card: handData[`card${cardIndex + 1}`],
                    team,
                    cardIndex,
                });
            });
        }

        let index = 0;
        for (const [dataIndex, data] of dataCards.entries()) {
            if (data.card) {
                const card = this.cards[index];
                card.node.active = true;
                card.setCardData(convertOldCardToServiceCard(data.card));

                if (index > 3) {
                    this.playSoundDrawCard();
                    const newLocation = dataIndex === 4 ? CardLocation.Player3 : CardLocation.Banker3;
                    if (animated) {
                        await this.moveCard(card, newLocation, animated);
                    } else {
                        this.moveCard(card, newLocation, animated);
                    }

                    const item = this.cardPool.find((item) => item.card === card);
                    if (item) {
                        item.location = newLocation;
                    }
                }

                if (animated) {
                    this.playSoundOpeningCard();
                    await card.openCard(animated, OPEN_CARD_DURATION).then(() => {
                        const { playerScore, bankerScore } = GameBaccaratResultUtil.getScores(result, data.cardIndex);

                        if (data.team === GameBaccaratX.BetChoice.Player) {
                            this.cardHands[0].setScore(playerScore);
                        } else {
                            this.cardHands[1].setScore(bankerScore);
                        }
                    });
                } else {
                    card.openCard(animated);
                    const { playerScore, bankerScore } = GameBaccaratResultUtil.getScores(result);

                    this.cardHands[0].setScore(playerScore);
                    this.cardHands[1].setScore(bankerScore);
                }

                index++;
            }
        }

        if (!settlemenResult[GameBaccaratX.BetChoice.Tie]) {
            this.highlightWinHandCards(settlemenResult[GameBaccaratX.BetChoice.Player]);
        }
    }

    private highlightWinHandCards(isPlayerWin: boolean): void {
        const locations = isPlayerWin
            ? [CardLocation.Player1, CardLocation.Player2, CardLocation.Player3]
            : [CardLocation.Banker1, CardLocation.Banker2, CardLocation.Banker3];
        const cards = this.cardPool.filter((item) => locations.includes(item.location));
        cards.forEach((item) => item.card.setWinHighlight(true));
    }

    // Card Animations
    private async moveCard(card: FairnessCard, nextLocation: CardLocation, animated: boolean): Promise<void> {
        const cardNode = card?.node;
        if (!cardNode) return;

        cardNode.setSiblingIndex(card.cardIndex);
        const nextPosition = this.calculateNextPosition(nextLocation);

        this.transformCardNode(cardNode, nextLocation, animated);

        if (animated) {
            await this.animateCardMovement(cardNode, nextPosition);
        } else {
            cardNode.position = nextPosition;
        }
    }

    private calculateNextPosition(location: CardLocation): Vec3 {
        const targetNode = this.getTargetNodeForLocation(location);

        return this.nodeCardContainer
            .getComponent(UITransform)
            .convertToNodeSpaceAR(targetNode.getComponent(UITransform).convertToWorldSpaceAR(v3(0, 0, 0)));
    }

    private getTargetNodeForLocation(location: CardLocation): Node {
        switch (location) {
            case CardLocation.Player1:
                return this.cardHands[0]?.getCardLocation(0);
            case CardLocation.Player2:
                return this.cardHands[0]?.getCardLocation(1);
            case CardLocation.Player3:
                return this.cardHands[0]?.getCardLocation(2);

            case CardLocation.Banker1:
                return this.cardHands[1]?.getCardLocation(0);
            case CardLocation.Banker2:
                return this.cardHands[1]?.getCardLocation(1);
            case CardLocation.Banker3:
                return this.cardHands[1]?.getCardLocation(2);

            case CardLocation.Waiting1:
                return this.nodeWaitingCard?.children[0];
            case CardLocation.Waiting2:
                return this.nodeWaitingCard?.children[1];

            case CardLocation.Box:
                return this.nodeBoxCard;
            default:
                return this.nodeBoxCard;
        }
    }

    private async animateCardMovement(node: Node, position: Vec3): Promise<void> {
        return new Promise<void>((resolve) => {
            tween(node)
                .to(MOVING_CARD_DURATION, { position })
                .call(() => resolve())
                .start();
        });
    }

    // Sound Effects
    @handle(gc.Audios.AudioHandler, (handle, id: string) => handle.playSFX(id))
    private playSoundDrawCard(): string {
        return "draw-single-card";
    }

    @handle(gc.Audios.AudioHandler, (handle, id: string) => handle.playSFX(id))
    private playSoundOpeningCard(): string {
        return "opening-card";
    }

    // Card Operations
    @render(Rounds.RoundTimeStore, (store) => store.isStartRound)
    public async closeCards(isStartRound: boolean): Promise<void> {
        if (!isStartRound) {
            return;
        }

        [GameBaccaratX.BetChoice.Player, GameBaccaratX.BetChoice.Banker].forEach((team, index) => {
            this.cardHands[index]?.showScore(false);
        });

        await this.draw6Cards(true);
    }
}
