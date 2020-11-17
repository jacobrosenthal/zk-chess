import * as PIXI from 'pixi.js';
import { GameZIndex, PixiManager } from '../../../api/PixiManager';
import { GameObject } from '../GameObject';
import { ClickState } from '../MouseManager';
import { LinkObject, TextAlign } from '../Text';
import { GameGrid } from './GameGrid';
import { GameBoardObject } from './GridObject';

export class ToggleButton extends GameBoardObject {
  text: LinkObject;

  showZk: boolean = false;

  constructor(manager: PixiManager, grid: GameGrid) {
    super(manager, grid);

    const text = new LinkObject(manager, '', this.toggleZk, TextAlign.Left);
    this.text = text;
    this.addChild(text);

    this.syncText();
  }

  toggleZk(): void {
    this.showZk = !this.showZk;
    this.syncText();
    this.manager.mouseManager.setClickState(ClickState.None);
  }

  private syncText(): void {
    this.text.setText(this.showZk ? 'Show Ships' : 'Show Submarines');
    this.manager.mouseManager.setShowZk(this.showZk);
  }

  positionGrid(_gridW: number, gridH: number) {
    this.setPosition({
      y: gridH + 2,
      x: 0,
    });
  }
}