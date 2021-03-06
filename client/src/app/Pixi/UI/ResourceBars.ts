import { GameZIndex, PixiManager } from '../../../api/PixiManager';
import { PixiObject } from '../PixiObject';
import * as PIXI from 'pixi.js';
import { CanvasCoords } from '../@PixiTypes';
import { TextObject } from '../Utils/TextObject';
import { BASELINE_TEXT, BASELINE_ICONS, ICONS } from '../Utils/TextureLoader';

const LABEL_WIDTH = 32; // width of 'Gold:'
const LABEL_M_RIGHT = 2; // right margin
const NUMBER_WIDTH = 34; // width of 'n/10'
const NUMBER_M_RIGHT = 2; // right margin

const NUMBER_OFFSET = LABEL_WIDTH + LABEL_M_RIGHT;
const ICON_OFFSET = NUMBER_OFFSET + NUMBER_WIDTH + NUMBER_M_RIGHT;

const ICON_WIDTH = 9;
const MARGIN = 2;

const MASK_HEIGHT = 2 * ICON_WIDTH;

function makeRow(icon: string, length: number): PIXI.DisplayObject {
  const cache = PIXI.utils.TextureCache;
  const row = new PIXI.Container();

  for (let i = 0; i < length; i++) {
    const element = new PIXI.Sprite(cache[icon]);
    element.position.set(i * (ICON_WIDTH + MARGIN), 0);
    row.addChild(element);
  }

  return row;
}

class ResourceBar extends PixiObject {
  label: TextObject;
  numbersObj: TextObject;

  mask: PIXI.Graphics;
  maskable: PIXI.DisplayObject;

  max: number;
  value: number;

  constructor(
    manager: PixiManager,
    label: string,
    max: number,
    iconContainer: PIXI.Container,
    maskable: PIXI.DisplayObject
  ) {
    super(manager, GameZIndex.UI);

    const container = this.object;

    const labelObj = new TextObject(manager, label);

    labelObj.setPosition({ x: 0, y: BASELINE_TEXT });

    const numbersObj = new TextObject(manager, '0/0');
    numbersObj.setPosition({ x: NUMBER_OFFSET, y: BASELINE_TEXT });

    this.addChild(labelObj, numbersObj);

    iconContainer.position.set(ICON_OFFSET, BASELINE_ICONS);

    let mask = new PIXI.Graphics();
    maskable.mask = mask;

    container.addChild(iconContainer);

    this.label = labelObj;
    this.numbersObj = numbersObj;
    this.mask = mask;
    this.maskable = maskable;
    this.value = max;
    this.max = max;
    this.update();
  }

  updateMask(value: number): void {
    // update mask
    const mask = this.mask;
    const maskContainer = this.maskable;
    const maskStart = maskContainer.toGlobal({ x: 0, y: 0 });

    mask.clear();
    mask.beginFill(0xffffff, 1.0);
    const width = this.getMaskWidth(value);
    mask.drawRect(maskStart.x, maskStart.y, width, MASK_HEIGHT);
    mask.endFill();
  }

  updateText(value: number) {
    this.numbersObj.setText(this.getText(value));
  }

  setMax(max: number) {
    this.max = max;
    this.update();
  }

  setValue(value: number): void {
    this.value = value;
    this.update();
  }

  update(): void {
    this.updateMask(this.value);
    this.updateText(this.value);
  }

  setPosition({ x, y }: CanvasCoords): void {
    super.setPosition({ x, y });
    this.update();
  }

  //implemented by children
  getMaskWidth(value: number): number {
    return value * (ICON_WIDTH + MARGIN);
  }
  getText(value: number): string {
    return `${value}/${this.max}`;
  }
}

const GOLD_START_MAX = 3;
export class GoldBar extends ResourceBar {
  coinUsedRow: PIXI.DisplayObject;
  iconContainer: PIXI.Container;
  constructor(manager: PixiManager) {
    const iconContainer = new PIXI.Container();

    const coinUsedRow = makeRow(ICONS.COIN_USED, 10);
    coinUsedRow.zIndex = 0;

    const coinRow = makeRow(ICONS.COIN, 10);
    coinRow.zIndex = 1;

    iconContainer.addChild(coinUsedRow);
    iconContainer.addChild(coinRow);

    super(manager, 'Gold:', GOLD_START_MAX, iconContainer, coinRow);

    iconContainer.sortableChildren = true;

    this.iconContainer = iconContainer;
    this.coinUsedRow = coinUsedRow;

    this.setMax(GOLD_START_MAX);
  }

  // overrides
  getText(value: number): string {
    const valueStr = value < 10 ? '0' + value : value;
    const maxStr = this.max < 10 ? '0' + this.max : this.max;
    return `${valueStr}/${maxStr}`;
  }
  setMax(max: number): void {
    this.iconContainer.removeChild(this.coinUsedRow);
    const coinUsedRow = makeRow(ICONS.COIN_USED, max);
    coinUsedRow.zIndex = 0;
    this.coinUsedRow = coinUsedRow;
    this.iconContainer.addChild(coinUsedRow);
    this.iconContainer.sortChildren();
    super.setMax(max);
  }
}

const MAX_HEALTH = 20;

export class HPBar extends ResourceBar {
  constructor(manager: PixiManager) {
    const iconContainer = new PIXI.Container();
    const hpRow = makeRow(ICONS.HEART, 10);

    iconContainer.addChild(hpRow);

    super(manager, 'HP:', MAX_HEALTH, iconContainer, hpRow);
  }

  // overrides
  getMaskWidth(value: number): number {
    return Math.floor((value / 2) * (ICON_WIDTH + MARGIN));
  }
  getText(value: number): string {
    const valueStr = value < 10 ? '0' + value : value;
    return `${valueStr}/${this.max}`;
  }
}

export class ResourceBars extends PixiObject {
  hpBar: HPBar;
  goldBar: GoldBar;
  constructor(manager: PixiManager) {
    super(manager, GameZIndex.UI);

    const goldBar = new GoldBar(manager);
    const hpBar = new HPBar(manager);

    goldBar.setPosition({ x: 0, y: 12 });

    this.hpBar = hpBar;
    this.goldBar = goldBar;

    this.addChild(goldBar);
    this.addChild(hpBar);

    this.positionSelf();
  }

  setPosition(coords: CanvasCoords) {
    super.setPosition(coords);
    this.hpBar.update();
    this.goldBar.update();
  }

  positionSelf() {
    this.setPosition({ x: 4, y: 4 });
  }

  loop() {
    const api = this.manager.api;
    this.goldBar.setValue(api.getGold());
    this.goldBar.setMax(api.getMaxGold());
    this.hpBar.setValue(api.getHealth());
  }
}
