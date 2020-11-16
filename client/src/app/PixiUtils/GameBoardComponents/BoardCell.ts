import * as PIXI from 'pixi.js';
import { PixiManager } from '../../../api/PixiManager';
import { GameObject } from '../GameObject';
import { ClickState } from '../MouseManager';
import { CanvasCoords, BoardCoords, LineAlignment } from '../PixiTypes';
import { idxsIncludes, compareBoardCoords } from '../PixiUtils';
import { Ship } from '../Ships';
import { ShipSprite } from '../ShipSprite';

export const CELL_W = 36;

class BoardRect extends GameObject {
  rect: PIXI.Graphics;
  idx: BoardCoords;
  constructor(manager: PixiManager, idx: BoardCoords) {
    super(manager);
    this.idx = idx;

    const rect = new PIXI.Graphics();
    this.object.addChild(rect);

    this.rect = rect;
  }

  loop() {
    super.loop();

    const {
      mouseManager: {
        clickState,
        deployIdxs,
        moveIdxs,
        moveAttackIdxs,
        attackIdxs,
        attackStaged,
        selectedShip,
      },
    } = this.manager;

    this.rect.clear();
    let fill = [0, 0];
    let stroke = [0x000000, 0.2];

    const deploy =
      clickState === ClickState.Deploying && idxsIncludes(deployIdxs, this.idx);
    const move =
      clickState === ClickState.Acting && idxsIncludes(moveIdxs, this.idx);
    const atk =
      !move &&
      clickState === ClickState.Acting &&
      idxsIncludes(attackIdxs, this.idx);
    const movAtk =
      !move &&
      !atk &&
      clickState === ClickState.Acting &&
      idxsIncludes(
        moveAttackIdxs.map((el) => el.attack),
        this.idx
      );
    const target =
      clickState === ClickState.Acting &&
      compareBoardCoords(attackStaged, this.idx);

    const selected =
      selectedShip && compareBoardCoords(selectedShip.coords, this.idx);

    if (selected) {
      fill = [0x4444aa, 0.8];
    } else if (deploy) {
      fill = [0xaa7777, 0.8];
    } else if (target) {
      fill = [0x995555, 0.8];
    } else if (atk) {
      fill = [0x992255, 0.8];
    } else if (move) {
      fill = [0x7777bb, 0.8];
    } else if (movAtk) {
      fill = [0xaa7777, 0.8];
    } else {
      fill = [0x222266, 0.4];
      stroke = [0, 0];
    }

    this.rect.beginFill(...fill);
    this.rect.lineStyle(2, stroke[0], stroke[1], LineAlignment.Inner);

    this.rect.drawRect(0, 0, CELL_W, CELL_W);
    this.rect.endFill();
  }
}

export class BoardCell extends GameObject {
  topLeft: CanvasCoords;
  ship: Ship | null;
  submarines: Ship[];
  idx: BoardCoords;

  stagedShip: ShipSprite;

  constructor(manager: PixiManager, idx: BoardCoords, topLeft: CanvasCoords) {
    super(manager);

    // TODO refactor these into a single rect
    const rect = new BoardRect(manager, idx);

    const stagedShip = new ShipSprite(
      manager,
      null,
      this.manager.api.getMyColor()
    );
    const alphaFilter = new PIXI.filters.AlphaFilter(0.7);
    stagedShip.setFilters([alphaFilter]);
    stagedShip.setPosition({ x: 2, y: 2 });
    this.stagedShip = stagedShip;

    this.addChild(rect, stagedShip);

    this.setPosition(topLeft);

    this.setInteractive({
      hitArea: new PIXI.Rectangle(0, 0, CELL_W, CELL_W),
      mouseover: this.onMouseOver,
      mouseout: this.onMouseOut,
      click: this.onClick,
    });

    this.topLeft = topLeft;
    this.ship = null;
    this.idx = idx;
    this.submarines = [];
  }

  private onClick() {
    this.manager.mouseManager.cellClicked(this.idx);
  }

  private onMouseOver() {
    this.manager.mouseManager.setHoveringCell(this.idx);
  }

  private onMouseOut() {
    this.manager.mouseManager.setHoveringCell(null);
  }

  loop() {
    super.loop();
    const {
      mouseManager: {
        clickState,
        deployStaged,
        deployType,
        moveStaged,
        selectedShip,
      },
    } = this.manager;

    if (clickState === ClickState.Deploying) {
      const show = compareBoardCoords(this.idx, deployStaged);
      this.stagedShip.setType(show ? deployType : null);
    } else if (clickState === ClickState.Acting) {
      const show = compareBoardCoords(this.idx, moveStaged);
      this.stagedShip.setType(
        selectedShip && show ? selectedShip.getType() : null
      );
    } else {
      // none
      this.stagedShip.setType(null);
    }
  }
}
