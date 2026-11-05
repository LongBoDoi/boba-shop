/** Rig motion in the illustration's 100×176 coordinates; independent of screen size and FPS. */
export function catPose(time: number, stride: number, walking: number, personality: number, angry: boolean, reaction = 0) {
  const breath = Math.sin(time * .00165 + personality);
  const sway = Math.sin(time * .00072 + personality);
  const step = Math.sin(stride);
  const lift = (1 - Math.cos(stride * 2)) * .5 * walking;
  // A brief look around every 9–12 seconds, with long still intervals between gestures.
  const cycle = (time + personality * 1300) % (9000 + personality * 400);
  const glance = cycle < 2100 ? Math.sin(cycle / 2100 * Math.PI) * Math.sin(personality + 1) : 0;
  const rest = cycle > 4500 && cycle < 7100 ? Math.sin((cycle - 4500) / 2600 * Math.PI) ** 2 : 0;
  const nod = Math.sin(Math.PI * reaction);
  return {
    bodyX: sway * .65 * (1 - walking) + step * .9 * walking,
    bodyY: -breath * .6 * (1 - walking) - lift * 1.7,
    bodyAngle: step * 1.4 * walking + sway * .4 * (1 - walking),
    breath: 1 + breath * .007 * (1 - walking),
    headX: glance * 2.5 * (1 - walking),
    headY: breath * -.25 - lift * .65 + nod * 2.2,
    headAngle: glance * 3 * (1 - walking) - step * 1.3 * walking + nod * 3,
    headScaleY: 1 - nod * .025,
    leftLeg: step * 6 * walking,
    rightLeg: -step * 6 * walking,
    leftLift: Math.max(0, step) * 4 * walking,
    rightLift: Math.max(0, -step) * 4 * walking,
    leftArm: -step * 10 * walking + (sway * 1.5 - rest * 38) * (1 - walking),
    rightArm: step * 10 * walking - sway * 1.5 * (1 - walking),
    tail: Math.sin(time * (angry ? .005 : .0014) + personality) * (angry ? 13 : 8) + step * 5 * walking,
    shadow: 1 - lift * .035,
  };
}
