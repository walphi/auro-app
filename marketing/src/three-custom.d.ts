/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare module 'three/webgpu' {
  export * from 'three';
  export const WebGPURenderer: any;
  export const PostProcessing: any;
  export const MeshBasicNodeMaterial: any;
}

declare module 'three/tsl' {
  export const Fn: any;
  export const uniform: any;
  export const float: any;
  export const vec3: any;
  export const instancedArray: any;
  export const instanceIndex: any;
  export const uv: any;
  export const positionGeometry: any;
  export const positionWorld: any;
  export const sin: any;
  export const cos: any;
  export const pow: any;
  export const smoothstep: any;
  export const mix: any;
  export const sqrt: any;
  export const select: any;
  export const hash: any;
  export const time: any;
  export const deltaTime: any;
  export const PI: any;
  export const mx_noise_float: any;
  export const pass: any;
  export const mrt: any;
  export const output: any;
  export const transformedNormalView: any;
}

declare module 'three/addons/tsl/display/DepthOfFieldNode.js' {
  export const dof: any;
}
