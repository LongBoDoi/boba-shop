import Phaser from 'phaser';
import { characterSvg, type CatPart, type Mood } from '../art/character';
import type { Customer } from '../game/reducer';
import type { StageContext } from './CustomerView';
import { ownerOf } from './identity';
import { catPose } from './catMotion';

const PIVOTS = {
  shadow: [50, 170], tail: [70, 139], leftLeg: [38, 131], rightLeg: [62, 131],
  torso: [50, 132], leftArm: [31, 91], rightArm: [69, 91], head: [50, 80],
} as const;
type Joint = keyof typeof PIVOTS;

/** Eight cached layers, animated through transforms only. No per-frame SVG, canvas or texture uploads. */
export class CatFigure {
  readonly root: Phaser.GameObjects.Container;
  readonly hand: Phaser.GameObjects.Container;
  private joints = {} as Record<Joint, Phaser.GameObjects.Image>;
  private alive = true;
  private loaded = false;
  private mood: Mood = 'happy';
  private rear = false;
  private facing = 0;
  private facingTarget = 0;
  private facePart: 'head' | 'profile' | 'back' = 'head';
  private reaching = 0;
  private reachTarget = 0;
  private blinking = false;
  private elapsed = 0;
  private stride = 0;
  private walking = 0;
  private walkTarget = 0;
  private nextBlink: number;
  private blinkUntil = 0;
  private reaction = 0;
  private holding = false;
  private personality: number;
  private faceRequest = 0;

  constructor(private ctx: StageContext, parent: Phaser.GameObjects.Container, readonly customer: Customer, mood: Mood) {
    const { charWidth, charHeight } = ctx.layout.metrics;
    this.personality = (customer.id * 2.399963) % (Math.PI * 2);
    this.nextBlink = 1800 + this.personality * 430;
    this.root = ctx.scene.add.container(-charWidth / 2, ctx.layout.room.queueY - charHeight)
      .setScale(charWidth / 100).setVisible(false);
    parent.add(this.root);
    for (const joint of Object.keys(PIVOTS) as Joint[]) {
      const [x, y] = PIVOTS[joint];
      const image = ctx.scene.add.image(x, y, '__DEFAULT').setOrigin(x / 100, y / 176);
      this.joints[joint] = image;
      this.root.add(image);
    }
    this.hand = ctx.scene.add.container(77, 119);
    this.root.add(this.hand);
    this.mood = mood;
    const parts = Object.keys(PIVOTS) as Joint[];
    void Promise.all(parts.map(async part => {
      const key = await this.texture(part, mood);
      if (this.alive && key) this.joints[part].setTexture(key).setDisplaySize(100, 176);
      return key;
    })).then(keys => {
      if (!this.alive || keys.some(key => !key)) return;
      this.loaded = true; this.root.setVisible(true); this.refreshFace();
    });
    // Prepare the turned-away silhouette once, before the customer needs to leave.
    void this.texture('back', mood); void this.texture('torsoBack', mood);
    void this.texture('profile', mood);
    void this.texture('head', mood, true);
  }

  private texture(part: CatPart, mood = this.mood, blinking = false) {
    const { charWidth, charHeight } = this.ctx.layout.metrics;
    const face = part === 'head' ? `:${mood}:${blinking}` : '';
    const owner = ownerOf(this.customer);
    const key = `${owner}:rig:${part}${face}:${charWidth.toFixed(2)}`;
    return this.ctx.bank.get(owner, key, () => characterSvg(this.customer.look,
      { mood, blinking, width: charWidth, fullBody: true, part }), charWidth, charHeight);
  }

  setMood(mood: Mood) {
    if (this.mood === mood) return;
    this.mood = mood; this.refreshFace();
    void this.texture('head', mood, true);
  }

  setWalking(walking: boolean) { this.walkTarget = walking ? 1 : 0; }
  acknowledge() { this.reaction = 650; }
  holdDrink() { this.holding = true; }
  setFacing(degrees: number) { this.facingTarget = degrees; }
  reachDoor(reaching: boolean) { this.reachTarget = reaching ? 1 : 0; }

  faceAway(away: boolean) {
    this.setFacing(away ? 180 : 0);
  }

  private refreshFace() {
    const request = ++this.faceRequest;
    void this.texture(this.facePart, this.mood, this.blinking).then(key => {
      if (this.alive && key && request === this.faceRequest) this.joints.head.setTexture(key).setDisplaySize(100, 176);
    });
  }

  /** Called only while the shift is running; all motion and blinks freeze on pause. */
  update(delta: number, reduced = false) {
    if (!this.alive || !this.loaded) return;
    const dt = Math.min(delta, 50);
    this.facing += Math.max(-dt * .145, Math.min(dt * .145, this.facingTarget - this.facing));
    this.reaching += (this.reachTarget - this.reaching) * (1 - Math.exp(-dt / 180));
    const yaw = Math.abs(this.facing), rear = yaw > 125;
    const facePart = rear ? 'back' : yaw > 48 ? 'profile' : 'head';
    if (facePart !== this.facePart) { this.facePart = facePart; this.refreshFace(); }
    if (rear !== this.rear) {
      this.rear = rear;
      void this.texture(rear ? 'torsoBack' : 'torso').then(key => {
        if (this.alive && this.rear === rear && key) this.joints.torso.setTexture(key).setDisplaySize(100, 176);
      });
    }
    this.elapsed += dt;
    this.walking += (this.walkTarget - this.walking) * (1 - Math.exp(-dt / 110));
    this.stride += dt * .0068 * this.walking;
    this.reaction = Math.max(0, this.reaction - dt);
    if (this.elapsed >= this.nextBlink && !this.blinking) {
      this.blinking = true; this.blinkUntil = this.elapsed + 130;
      this.refreshFace();
    } else if (this.blinking && this.elapsed >= this.blinkUntil) {
      this.blinking = false; this.nextBlink = this.elapsed + 2600 + (Math.sin(this.elapsed + this.personality) + 1) * 900;
      this.refreshFace();
    }
    const pose = catPose(reduced ? 0 : this.elapsed, this.stride, reduced ? 0 : this.walking,
      this.personality, this.mood === 'angry', reduced ? 0 : this.reaction / 650);
    const j = this.joints;
    const turnWidth = .62 + .38 * Math.abs(Math.cos(this.facing * Math.PI / 180));
    const set = (part: Joint, dx: number, dy: number, angle: number, sy = 1) => {
      const [x, y] = PIVOTS[part];
      // setDisplaySize preserves the device-density raster scale while joints move in art units.
      j[part].setPosition(50 + (x + dx - 50) * turnWidth, y + dy).setAngle(angle).setDisplaySize(100 * turnWidth, 176 * sy);
    };
    set('torso', pose.bodyX, pose.bodyY, pose.bodyAngle, pose.breath);
    set('head', pose.bodyX + pose.headX, pose.bodyY + pose.headY, pose.headAngle, pose.headScaleY);
    set('leftArm', pose.bodyX, pose.bodyY, pose.leftArm * (1 - this.reaching) - 145 * this.reaching);
    set('rightArm', pose.bodyX, pose.bodyY, this.holding ? -23 + pose.rightArm * .12 : pose.rightArm);
    set('leftLeg', 0, -pose.leftLift, pose.leftLeg);
    set('rightLeg', 0, -pose.rightLift, pose.rightLeg);
    set('tail', pose.bodyX, pose.bodyY, pose.tail);
    j.head.setFlipX(this.facePart === 'profile' && this.facing < 0);
    j.shadow.setDisplaySize(100 * pose.shadow, 176);
    // The cup rides the raised paw, never the independently swinging body image.
    const a = Phaser.Math.DegToRad(this.holding ? -23 + pose.rightArm * .12 : pose.rightArm);
    this.hand.setPosition(50 + (19 + pose.bodyX + 8 * Math.cos(a) - 28 * Math.sin(a)) * turnWidth,
      91 + pose.bodyY + 8 * Math.sin(a) + 28 * Math.cos(a)).setAngle(this.holding ? pose.bodyAngle * .25 : 0);
  }

  destroy() {
    this.alive = false;
    this.root.destroy();
  }
}
