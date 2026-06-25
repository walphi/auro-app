/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CameraKeyFrame {
  stage: string;
  scroll: number;
  posX: number;
  posY: number;
  posZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  focusDist: number;
  autoFocus: boolean;
  dofEnabled: boolean;
  focalLength: number;
  bokehScale: number;
  afSpeed: number;
  afMin: number;
  afMax: number;
}

export interface StageParams {
  fogStart: number;
  fogEnd: number;
  fogIntensity: number;
  fogR: number;
  fogG: number;
  fogB: number;
  grassDensity: number;
  bladeWidth: number;
  bladeTipWidth: number;
  bladeHeight: number;
  bladeHeightVar: number;
  bladeLean: number;
  windSpeed: number;
  windAmplitude: number;
  noiseAmp: number;
  noiseFreq: number;
  noise2Amp: number;
  noise2Freq: number;
  mouseRadius: number;
  mouseStrength: number;
  outerRadius: number;
  outerStrength: number;
  camSphereRadius: number;
  camSphereStrength: number;
  bladeBaseR: number;
  bladeBaseG: number;
  bladeBaseB: number;
  bladeTipR: number;
  bladeTipG: number;
  bladeTipB: number;
  goldenTipR: number;
  goldenTipG: number;
  goldenTipB: number;
  greenTipR: number;
  greenTipG: number;
  greenTipB: number;
  midR: number;
  midG: number;
  midB: number;
  colorVar: number;
  [key: string]: number; // Allow dynamic keying
}
