import * as PIXI from 'pixi.js';
import { GameZIndex, PixiManager } from '../../api/PixiManager';
import { Piece, PieceType, Player } from '../../_types/global/GlobalTypes';
import { GameObject } from './GameObject';
import { BoardCoords, CanvasCoords, PlayerColor } from './PixiTypes';
import { playerShader } from './Shaders';
import { getShipSprite, SHIPS, SPRITE_W } from './TextureLoader';

const waterline = (type: PieceType): number => {
  if (type === PieceType.Mothership_00) return 28;
  else if (type === PieceType.Submarine_04) return 32;
  else return 25;
};

export enum ShipState {
  Summoned,
  Active,
  Moved,
  Attacked,
}

export class Ship extends GameObject {
  coords: BoardCoords;
  id: number;
  type: PieceType;

  hasMoved: boolean;

  mask: PIXI.Graphics;

  constructor(
    manager: PixiManager,
    PieceType: PieceType,
    coords: BoardCoords,
    color: PlayerColor
  ) {
    let container = new PIXI.Container();
    super(manager, container, GameZIndex.Ships);

    this.hasMoved = false;

    // probably gets rolled up into general props
    this.id = Math.random();
    this.type = PieceType;

    const sprite = getShipSprite(PieceType, color);

    sprite.anchor.set(0.5, 0.0);
    sprite.scale.x = color === PlayerColor.Red ? 1 : -1;
    sprite.x = 16;
    // sprite.y = 16; // doesn't work? investigate

    container.addChild(sprite);
    container.interactive = true;
    container.hitArea = new PIXI.Rectangle(0, 0, SPRITE_W, SPRITE_W);
    container
      .on('mouseover', this.onMouseOver)
      .on('mouseout', this.onMouseOut)
      .on('click', this.onClick);

    let mask = new PIXI.Graphics();
    mask.beginFill(0xffffff, 1.0);
    mask.drawRect(container.x, container.y, SPRITE_W, waterline(PieceType));
    mask.endFill();
    container.mask = mask;
    this.mask = mask;

    this.setCoords(coords);

    this.coords = coords;
  }

  setPosition({ x, y }: CanvasCoords) {
    super.setPosition({ x, y });
    const mask = this.mask;
    const container = this.object;
    mask.clear();
    mask.beginFill(0xffffff, 1.0);
    mask.drawRect(container.x, container.y, SPRITE_W, waterline(this.type));
    mask.endFill();
  }

  setCoords(coords: BoardCoords) {
    this.coords = coords;
    const { x, y } = this.manager.gameBoard.getTopLeft(coords);
    this.setPosition({ x: x + 2, y: y + 2 });
    console.log(x, y);
  }

  onMouseOver() {
    this.manager.mouseManager.setHoveringShip(this.id);
  }

  onMouseOut() {
    this.manager.mouseManager.setHoveringShip(null);
  }

  onClick() {
    this.manager.mouseManager.shipClicked(this);
  }

  loop() {
    super.loop();
    const { frameCount } = this.manager;

    const frames = 30;
    const container = this.object;
    const boat = container.children[0];
    if (frameCount % (2 * frames) < frames) {
      boat.y = 2;
    } else {
      boat.y = 0;
    }
  }
}

export const RED_MOTHERSHIP_COORDS: BoardCoords = { row: 2, col: 0 };
export const BLUE_MOTHERSHIP_COORDS: BoardCoords = { row: 2, col: 6 };

export const getMothership = (
  manager: PixiManager,
  color: PlayerColor
): Ship => {
  const coords =
    color === PlayerColor.Red ? RED_MOTHERSHIP_COORDS : BLUE_MOTHERSHIP_COORDS;

  return new Ship(manager, PieceType.Mothership_00, coords, color);
};
