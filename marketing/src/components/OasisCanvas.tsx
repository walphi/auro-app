/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec3, instancedArray, instanceIndex, uv,
  positionGeometry, positionWorld, sin, cos, pow, smoothstep, mix,
  sqrt, select, hash, time, deltaTime, PI, mx_noise_float,
  pass, mrt, output, transformedNormalView,
} from 'three/tsl';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { CameraKeyFrame, StageParams } from '../types';

interface OasisCanvasProps {
  scrollProgress: number;
  cameraPath: CameraKeyFrame[];
  stageParams: StageParams[];
  activeStage: number;
  editingMode: 'scroll' | 'edit';
  skyColors: {
    top: string;
    midHigh: string;
    midLow: string;
    horizon: string;
  };
  groundColor: string;
  backgroundColor: string;
  globalDofEnabled: boolean;
  onFpsUpdate: (fps: number) => void;
  windBurstTrigger: number;
  audioAmplitude: number;
  audioActive: boolean;
}

export const OasisCanvas: React.FC<OasisCanvasProps> = ({
  scrollProgress,
  cameraPath,
  stageParams,
  activeStage,
  editingMode,
  skyColors,
  groundColor,
  backgroundColor,
  globalDofEnabled,
  onFpsUpdate,
  windBurstTrigger,
  audioAmplitude,
  audioActive,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs to make properties accessible in the render loop without rebuilding
  const propsRef = useRef({
    scrollProgress,
    cameraPath,
    stageParams,
    activeStage,
    editingMode,
    skyColors,
    groundColor,
    backgroundColor,
    globalDofEnabled,
    windBurstTrigger,
    audioAmplitude,
    audioActive,
  });

  propsRef.current = {
    scrollProgress,
    cameraPath,
    stageParams,
    activeStage,
    editingMode,
    skyColors,
    groundColor,
    backgroundColor,
    globalDofEnabled,
    windBurstTrigger,
    audioAmplitude,
    audioActive,
  };

  const [hasError, setHasError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    let animationFrameId: number;

    // WebGL / WebGPU objects
    let renderer: any = null;
    let postProcessing: any = null;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let instancedGrass: THREE.InstancedMesh;
    let skyTexture: THREE.CanvasTexture;

    // Grass Uniforms references
    const uniforms = {
      mouseWorld: uniform(new THREE.Vector3(99999, 0, 99999)),
      mouseRadius: uniform(6.1),
      mouseStrength: uniform(4.0),
      outerRadius: uniform(9.4),
      outerStrength: uniform(1.45),
      camSphereWorld: uniform(new THREE.Vector3(99999, 0, 99999)),
      camSphereRadius: uniform(15.0),
      camSphereStrength: uniform(5.9),
      grassDensity: uniform(1.0),
      windSpeed: uniform(1.3),
      windAmplitude: uniform(0.21),
      bladeWidth: uniform(4.0),
      bladeTipWidth: uniform(0.19),
      bladeHeight: uniform(1.6),
      bladeHeightVariation: uniform(0.5),
      bladeLean: uniform(1.1),
      noiseAmplitude: uniform(1.85),
      noiseFrequency: uniform(0.3),
      noise2Amplitude: uniform(0.2),
      noise2Frequency: uniform(15),
      bladeColorVariation: uniform(0.93),
      groundRadius: uniform(13.8),
      groundFalloff: uniform(2.4),
      bladeBaseColor: uniform(new THREE.Color('#0e1e04')),
      bladeTipColor: uniform(new THREE.Color('#c8b840')),
      backgroundColor: uniform(new THREE.Color(backgroundColor)),
      groundColor: uniform(new THREE.Color(groundColor)),
      fogStart: uniform(6.5),
      fogEnd: uniform(12.0),
      fogIntensity: uniform(1.0),
      fogColor: uniform(new THREE.Color('#000000')),
      goldenTipColor: uniform(new THREE.Color('#d4b838')),
      greenTipColor: uniform(new THREE.Color('#4a7a14')),
      midColor: uniform(new THREE.Color('#2d4e0e')),
      focusDistanceU: uniform(31.83),
      focalLengthU: uniform(10.0),
      bokehScaleU: uniform(12.5),
    };

    let dofOutputNode: any = null;
    let sceneColorNode: any = null;
    let activeDofState = false;

    // Constants
    const BLADE_COUNT = window.innerWidth < 768 ? 60000 : 120000;
    const FIELD_SIZE = 30;

    // Sky texture helper
    const buildSky = (colors: typeof skyColors) => {
      const w = 2, h = 512;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0.0, colors.top);
        grad.addColorStop(0.35, colors.midHigh);
        grad.addColorStop(0.65, colors.midLow);
        grad.addColorStop(1.0, colors.horizon);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    // Main setup
    const init = async () => {
      try {
        const width = containerRef.current?.clientWidth || window.innerWidth;
        const height = containerRef.current?.clientHeight || window.innerHeight;

        // Renderer
        renderer = new THREE.WebGPURenderer({ antialias: true });
        const maxDPR = window.innerWidth < 1200 ? 1.5 : Math.min(window.devicePixelRatio, 2);
        renderer.setPixelRatio(maxDPR);
        renderer.setSize(width, height);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        if (destroyed) return;
        containerRef.current?.appendChild(renderer.domElement);

        await renderer.init();
        if (destroyed) return;

        // Scene
        scene = new THREE.Scene();
        skyTexture = buildSky(propsRef.current.skyColors);
        scene.background = skyTexture;
        scene.fog = new THREE.FogExp2('#000000', 0.035);

        // Camera
        camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
        camera.position.set(0, 8, 18);
        camera.lookAt(0, 0, 0);

        // Compute / Instantiate Grass Buffers
        const bladeData = instancedArray(BLADE_COUNT, 'vec4');
        const bendState = instancedArray(BLADE_COUNT, 'vec4');
        const bladeBound = instancedArray(BLADE_COUNT, 'float');

        const noise2D = Fn(([x, z]: [any, any]) =>
          mx_noise_float(vec3(x, float(0), z)).mul(0.5).add(0.5)
        );

        // Instanced Grass Initialization Compute Node
        const computeInit = Fn(() => {
          const blade = bladeData.element(instanceIndex);
          const col = instanceIndex.mod(283);
          const row = instanceIndex.div(283);
          const jx = hash(instanceIndex).sub(0.5);
          const jz = hash(instanceIndex.add(7919)).sub(0.5);
          const wx = col.toFloat().add(jx).div(float(283)).sub(0.5).mul(FIELD_SIZE);
          const wz = row.toFloat().add(jz).div(float(283)).sub(0.5).mul(FIELD_SIZE);
          blade.x.assign(wx);
          blade.y.assign(wz);
          blade.z.assign(hash(instanceIndex.add(1337)).mul(PI.mul(2)));

          const n1 = noise2D(wx.mul(uniforms.noiseFrequency), wz.mul(uniforms.noiseFrequency));
          const n2 = noise2D(
            wx.mul(uniforms.noiseFrequency.mul(uniforms.noise2Frequency)).add(50),
            wz.mul(uniforms.noiseFrequency.mul(uniforms.noise2Frequency)).add(50)
          );
          const clump = n1.mul(uniforms.noiseAmplitude).sub(uniforms.noise2Amplitude).add(
            n2.mul(uniforms.noise2Amplitude).mul(2)
          ).max(0);
          blade.w.assign(clump);

          const dist = sqrt(wx.mul(wx).add(wz.mul(wz)));
          const edgeNoise = noise2D(wx.mul(0.25).add(100), wz.mul(0.25).add(100));
          const maxR = float(12.0).add(edgeNoise.sub(0.5).mul(6.0));
          const boundary = float(1).sub(smoothstep(maxR.sub(1.5), maxR, dist));
          bladeBound.element(instanceIndex).assign(select(boundary.lessThan(0.05), float(0), boundary));
        })().compute(BLADE_COUNT);

        // Frame-by-frame Physics Compute Node
        const computeUpdate = Fn(() => {
          const blade = bladeData.element(instanceIndex);
          const bend = bendState.element(instanceIndex);
          const bx = blade.x;
          const bz = blade.y;

          const w1 = sin(bx.mul(0.35).add(bz.mul(0.12)).add(time.mul(uniforms.windSpeed)));
          const w2 = sin(bx.mul(0.18).add(bz.mul(0.28)).add(time.mul(uniforms.windSpeed.mul(0.67))).add(1.7));
          const windX = w1.add(w2).mul(uniforms.windAmplitude);
          const windZ = w1.sub(w2).mul(uniforms.windAmplitude.mul(0.55));

          const lw = deltaTime.mul(4.0).saturate();
          bend.x.assign(mix(bend.x, windX, lw));
          bend.y.assign(mix(bend.y, windZ, lw));

          // Mouse push
          const dx = bx.sub(uniforms.mouseWorld.x);
          const dz = bz.sub(uniforms.mouseWorld.z);
          const dist = sqrt(dx.mul(dx).add(dz.mul(dz))).add(0.0001);
          const falloff = float(1).sub(dist.div(uniforms.mouseRadius).saturate());
          const influence = falloff.mul(falloff).mul(uniforms.mouseStrength);
          const pushX = dx.div(dist).mul(influence);
          const pushZ = dz.div(dist).mul(influence);

          // Outer mouse sphere
          const odx = bx.sub(uniforms.mouseWorld.x);
          const odz = bz.sub(uniforms.mouseWorld.z);
          const odist = sqrt(odx.mul(odx).add(odz.mul(odz))).add(0.0001);
          const ofalloff = float(1).sub(odist.div(uniforms.outerRadius).saturate());
          const oinfluence = ofalloff.mul(ofalloff).mul(uniforms.outerStrength);
          const opushX = odx.div(odist).mul(oinfluence);
          const opushZ = odz.div(odist).mul(oinfluence);

          // Camera sphere push
          const cdx = bx.sub(uniforms.camSphereWorld.x);
          const cdz = bz.sub(uniforms.camSphereWorld.z);
          const cdist = sqrt(cdx.mul(cdx).add(cdz.mul(cdz))).add(0.0001);
          const cfalloff = float(1).sub(cdist.div(uniforms.camSphereRadius).saturate());
          const cinfluence = cfalloff.mul(cfalloff).mul(uniforms.camSphereStrength);
          const cpushX = cdx.div(cdist).mul(cinfluence);
          const cpushZ = cdz.div(cdist).mul(cinfluence);

          const totalPushX = pushX.add(opushX).add(cpushX);
          const totalPushZ = pushZ.add(opushZ).add(cpushZ);

          const targetMag = sqrt(totalPushX.mul(totalPushX).add(totalPushZ.mul(totalPushZ)));
          const currentMag = sqrt(bend.z.mul(bend.z).add(bend.w.mul(bend.w)));
          const lm = select(targetMag.greaterThan(currentMag), deltaTime.mul(12.0), deltaTime.mul(1)).saturate();
          bend.z.assign(mix(bend.z, totalPushX, lm));
          bend.w.assign(mix(bend.w, totalPushZ, lm));
        })().compute(BLADE_COUNT);

        // Pre-run init computes
        await renderer.computeAsync(computeInit);
        if (destroyed) return;

        // Custom High-Quality Blade Geometry
        const createBladeGeometry = () => {
          const segs = 5, W = 0.055, H = 1.0;
          const verts = [], norms = [], uvArr = [], idx = [];
          for (let i = 0; i <= segs; i++) {
            const t = i / segs, y = t * H, hw = W * 0.5 * (1.0 - t * 0.82);
            verts.push(-hw, y, 0, hw, y, 0);
            norms.push(0, 0, 1, 0, 0, 1);
            uvArr.push(0, t, 1, t);
          }
          for (let i = 0; i < segs; i++) {
            const b = i * 2;
            idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
          geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
          geo.setIndex(idx);
          return geo;
        };

        // Grass Material Nodes
        const grassMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });

        grassMat.positionNode = Fn(() => {
          const blade = bladeData.element(instanceIndex);
          const bend = bendState.element(instanceIndex);
          const worldX = blade.x, worldZ = blade.y, rotY = blade.z;
          const boundary = bladeBound.element(instanceIndex);
          const visible = select(hash(instanceIndex.add(9999)).lessThan(uniforms.grassDensity.mul(0.5)), float(1), float(0));
          const hVar = hash(instanceIndex.add(5555)).mul(uniforms.bladeHeightVariation);
          const heightScale = float(0.35).add(blade.w).add(hVar).mul(boundary).mul(visible);
          const taper = float(1).sub(uv().y.mul(float(1).sub(uniforms.bladeTipWidth)));
          const lx = positionGeometry.x.mul(uniforms.bladeWidth).mul(taper).mul(heightScale.sign());
          const ly = positionGeometry.y.mul(heightScale).mul(uniforms.bladeHeight);
          const cY = cos(rotY), sY = sin(rotY);
          const rx = lx.mul(cY), rz = lx.mul(sY);
          const t = uv().y;
          const bendFactor = pow(t, 1.8);
          const staticBendX = hash(instanceIndex.add(7777)).sub(0.5).mul(uniforms.bladeLean);
          const staticBendZ = hash(instanceIndex.add(8888)).sub(0.5).mul(uniforms.bladeLean);
          const bendX = staticBendX.add(bend.x).add(bend.z);
          const bendZ = staticBendZ.add(bend.y).add(bend.w);
          const relX = rx.add(bendX.mul(bendFactor).mul(uniforms.bladeHeight));
          const relY = ly;
          const relZ = rz.add(bendZ.mul(bendFactor).mul(uniforms.bladeHeight));
          const origLen = sqrt(rx.mul(rx).add(ly.mul(ly)).add(rz.mul(rz)));
          const newLen = sqrt(relX.mul(relX).add(relY.mul(relY)).add(relZ.mul(relZ)));
          const scale = origLen.div(newLen.max(0.0001));
          return vec3(worldX.add(relX.mul(scale)), relY.mul(scale), worldZ.add(relZ.mul(scale)));
        })();

        grassMat.colorNode = Fn(() => {
          const t = uv().y;
          const clump = bladeData.element(instanceIndex).w.saturate();
          const bladeHash = hash(instanceIndex.add(4242));
          const isGolden = bladeHash.lessThan(0.4);
          const lowerGrad = smoothstep(float(0.0), float(0.45), t);
          const upperGrad = smoothstep(float(0.4), float(0.85), t);
          const tipMix = float(1).sub(uniforms.bladeColorVariation).add(clump.mul(uniforms.bladeColorVariation));
          const greenTip = mix(uniforms.greenTipColor, uniforms.bladeTipColor, tipMix);
          const warmTip = mix(uniforms.greenTipColor, uniforms.goldenTipColor, tipMix);
          const tipFinal = mix(greenTip, warmTip, select(isGolden, float(1), float(0)));
          const lowerColor = mix(uniforms.bladeBaseColor, uniforms.midColor, lowerGrad);
          const grassColor = mix(lowerColor, tipFinal, upperGrad);
          const blade = bladeData.element(instanceIndex);
          const dist = sqrt(blade.x.mul(blade.x).add(blade.y.mul(blade.y)));
          const fogFactor = smoothstep(uniforms.fogStart, uniforms.fogEnd, dist).mul(uniforms.fogIntensity);
          return mix(grassColor, uniforms.fogColor, fogFactor);
        })();

        grassMat.opacityNode = Fn(() => {
          const blade = bladeData.element(instanceIndex);
          const dist = sqrt(blade.x.mul(blade.x).add(blade.y.mul(blade.y)));
          const fadeEnd = select(uniforms.fogIntensity.greaterThan(0.01), uniforms.fogEnd.add(2.0), float(15.0));
          const fadeFactor = float(1).sub(smoothstep(fadeEnd.sub(5.0), fadeEnd, dist));
          return smoothstep(float(0.0), float(0.1), uv().y).mul(fadeFactor);
        })();
        grassMat.transparent = true;

        // Instantiate
        const bladeGeo = createBladeGeometry();
        instancedGrass = new THREE.InstancedMesh(bladeGeo, grassMat, BLADE_COUNT);
        instancedGrass.frustumCulled = false;
        scene.add(instancedGrass);

        const dummy = new THREE.Object3D();
        for (let i = 0; i < BLADE_COUNT; i++) {
          instancedGrass.setMatrixAt(i, dummy.matrix);
        }
        instancedGrass.instanceMatrix.needsUpdate = true;

        // Ground Mesh
        const groundMat = new THREE.MeshBasicNodeMaterial();
        groundMat.colorNode = Fn(() => {
          const wx = positionWorld.x, wz = positionWorld.z;
          const dist = sqrt(wx.mul(wx).add(wz.mul(wz)));
          const edgeNoise = noise2D(wx.mul(0.25).add(100), wz.mul(0.25).add(100));
          const maxR = uniforms.groundRadius.add(edgeNoise.sub(0.5).mul(4.0));
          const t = smoothstep(maxR.sub(uniforms.groundFalloff), maxR, dist);
          return mix(uniforms.groundColor, uniforms.backgroundColor, t);
        })();

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_SIZE * 5, FIELD_SIZE * 5), groundMat);
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Lights
        const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambLight);
        const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.5);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        // Depth of field post-processing
        postProcessing = new THREE.PostProcessing(renderer);
        const scenePass = pass(scene, camera);
        scenePass.setMRT(mrt({
          output: output,
          normal: transformedNormalView,
        }));
        sceneColorNode = scenePass.getTextureNode('output');
        const sceneViewZ = scenePass.getViewZNode();
        dofOutputNode = dof(sceneColorNode, sceneViewZ, uniforms.focusDistanceU, uniforms.focalLengthU, uniforms.bokehScaleU);

        // Apply initial Pipeline layout
        postProcessing.outputNode = scenePass;
        postProcessing.needsUpdate = true;

        // Raycasting for Mouse interactions
        const raycaster = new THREE.Raycaster();
        const mouseNDC = new THREE.Vector2();
        const grassPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hitPoint = new THREE.Vector3();

        const onMouseMove = (e: MouseEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          mouseNDC.set(x, y);

          raycaster.setFromCamera(mouseNDC, camera);
          if (raycaster.ray.intersectPlane(grassPlane, hitPoint)) {
            uniforms.mouseWorld.value.copy(hitPoint);
          }
        };

        const onMouseLeave = () => {
          uniforms.mouseWorld.value.set(99999, 0, 99999);
        };

        window.addEventListener('mousemove', onMouseMove);
        containerRef.current?.addEventListener('mouseleave', onMouseLeave);

        // Interpolation variables
        const clock = new THREE.Clock();
        const lookTarget = new THREE.Vector3();

        let currentScrollT = 0;
        let prevRawScroll = 0;
        let windBurst = 0;
        let lastBurstTrigger = propsRef.current.windBurstTrigger;
        let scrollSinceAudio = false;
        let prevAudioActive = false;

        let fpsFrames = 0;
        let fpsLast = performance.now();

        // Interpolation helper
        const lerpCam = (scrollT: number) => {
          const path = propsRef.current.cameraPath;
          const params = propsRef.current.stageParams;

          // Search keyframes
          let i = 0;
          for (let j = 1; j < path.length; j++) {
            if (path[j].scroll >= scrollT) {
              i = j - 1;
              break;
            }
            if (j === path.length - 1) i = j - 1;
          }

          const a = path[i];
          const b = path[Math.min(i + 1, path.length - 1)];
          const range = b.scroll - a.scroll;
          const t = range > 0 ? Math.max(0, Math.min(1, (scrollT - a.scroll) / range)) : 0;
          const ease = t * t * (3 - 2 * t);

          // Interpolate parameters
          const pA = params[i];
          const pB = params[Math.min(i + 1, params.length - 1)];
          const lerpedProps: any = {};
          Object.keys(pA).forEach(key => {
            if (typeof pA[key] === 'number') {
              lerpedProps[key] = pA[key] + (pB[key] - pA[key]) * ease;
            }
          });

          // Find the keyframe whose scroll threshold we've passed for DoF
          let dofIdx = 0;
          for (let j = path.length - 1; j >= 0; j--) {
            if (path[j].scroll <= scrollT) { dofIdx = j; break; }
          }

          return {
            px: a.posX + (b.posX - a.posX) * ease,
            py: a.posY + (b.posY - a.posY) * ease,
            pz: a.posZ + (b.posZ - a.posZ) * ease,
            lx: a.lookX + (b.lookX - a.lookX) * ease,
            ly: a.lookY + (b.lookY - a.lookY) * ease,
            lz: a.lookZ + (b.lookZ - a.lookZ) * ease,
            fd: a.focusDist + (b.focusDist - a.focusDist) * ease,
            af: a.autoFocus,
            dofOn: path[dofIdx].dofEnabled,
            fl: a.focalLength + (b.focalLength - a.focalLength) * ease,
            bk: a.bokehScale + (b.bokehScale - a.bokehScale) * ease,
            afSpd: a.afSpeed + (b.afSpeed - a.afSpeed) * ease,
            afMin: a.afMin + (b.afMin - a.afMin) * ease,
            afMax: a.afMax + (b.afMax - a.afMax) * ease,
            params: lerpedProps,
          };
        };

        // Render loop
        const animate = () => {
          if (destroyed) return;
          animationFrameId = requestAnimationFrame(animate);

          const dt = Math.min(clock.getDelta(), 0.05);

          // Track Scroll interpolation
          const targetScroll = propsRef.current.scrollProgress;
          currentScrollT += (targetScroll - currentScrollT) * Math.min(1, dt * 6);

          // Direct editing override vs standard scroll
          let activeCam: any = null;
          const mode = propsRef.current.editingMode;
          const selectedIdx = propsRef.current.activeStage;

          if (mode === 'edit' && selectedIdx >= 0 && selectedIdx < propsRef.current.cameraPath.length) {
            const kf = propsRef.current.cameraPath[selectedIdx];
            const sp = propsRef.current.stageParams[selectedIdx];
            activeCam = {
              px: kf.posX, py: kf.posY, pz: kf.posZ,
              lx: kf.lookX, ly: kf.lookY, lz: kf.lookZ,
              fd: kf.focusDist, af: kf.autoFocus, dofOn: kf.dofEnabled,
              fl: kf.focalLength, bk: kf.bokehScale,
              afSpd: kf.afSpeed, afMin: kf.afMin, afMax: kf.afMax,
              params: sp,
            };
          } else {
            activeCam = lerpCam(currentScrollT);
          }

          // Update camera
          camera.position.set(activeCam.px, activeCam.py, activeCam.pz);
          lookTarget.set(activeCam.lx, activeCam.ly, activeCam.lz);
          camera.lookAt(lookTarget);

          // Push landscape slightly on site footer overlay
          const footer = document.querySelector('.site-footer');
          if (footer && renderer.domElement) {
            const footerTop = footer.getBoundingClientRect().top;
            if (footerTop < window.innerHeight) {
              renderer.domElement.style.transform = `translateY(-${window.innerHeight - footerTop}px)`;
            } else {
              renderer.domElement.style.transform = '';
            }
          }

          // Camera push on grass based on layout proximity
          uniforms.camSphereWorld.value.set(camera.position.x, 0, camera.position.z);
          const camHeight = camera.position.y;
          const proximityT = Math.max(0, 1 - camHeight / 10);
          const proxCurve = proximityT * proximityT;

          // Apply parameter and color uniforms from keyframe interpolation
          if (activeCam.params) {
            const p = activeCam.params;

            // Fog
            uniforms.fogStart.value = p.fogStart ?? 6.5;
            uniforms.fogEnd.value = p.fogEnd ?? 12.0;
            uniforms.fogIntensity.value = p.fogIntensity ?? 1.0;
            uniforms.fogColor.value.setRGB(p.fogR ?? 0, p.fogG ?? 0, p.fogB ?? 0);
            if (scene.fog) scene.fog.color.copy(uniforms.fogColor.value);

            // Grass Physics
            uniforms.grassDensity.value = p.grassDensity ?? 1.0;
            uniforms.bladeWidth.value = p.bladeWidth ?? 4.0;
            uniforms.bladeTipWidth.value = p.bladeTipWidth ?? 0.19;
            uniforms.bladeHeight.value = p.bladeHeight ?? 1.6;
            uniforms.bladeHeightVariation.value = p.bladeHeightVar ?? 0.5;
            uniforms.bladeLean.value = p.bladeLean ?? 1.1;

            // Wind
            let baseWindSpd = p.windSpeed ?? 1.3;
            let baseWindAmp = p.windAmplitude ?? 0.21;

            // Noise
            uniforms.noiseAmplitude.value = p.noiseAmp ?? 1.85;
            uniforms.noiseFrequency.value = p.noiseFreq ?? 0.3;
            uniforms.noise2Amplitude.value = p.noise2Amp ?? 0.2;
            uniforms.noise2Frequency.value = p.noise2Freq ?? 15;

            // Interaction Spheres
            uniforms.mouseRadius.value = p.mouseRadius ?? 6.1;
            uniforms.mouseStrength.value = p.mouseStrength ?? 4.0;
            uniforms.outerRadius.value = p.outerRadius ?? 9.4;
            uniforms.outerStrength.value = p.outerStrength ?? 1.45;

            // Apply camera push variables
            uniforms.camSphereRadius.value = (p.camSphereRadius ?? 15.0) * (0.3 + proxCurve * 0.7);
            uniforms.camSphereStrength.value = (p.camSphereStrength ?? 5.9) * (0.1 + proxCurve * 0.9);

            // Blade color gradients
            uniforms.bladeBaseColor.value.setRGB(p.bladeBaseR ?? 0.05, p.bladeBaseG ?? 0.12, p.bladeBaseB ?? 0.01);
            uniforms.bladeTipColor.value.setRGB(p.bladeTipR ?? 0.78, p.bladeTipG ?? 0.72, p.bladeTipB ?? 0.25);
            uniforms.goldenTipColor.value.setRGB(p.goldenTipR ?? 0.83, p.goldenTipG ?? 0.72, p.goldenTipB ?? 0.22);
            uniforms.greenTipColor.value.setRGB(p.greenTipR ?? 0.29, p.greenTipG ?? 0.48, p.greenTipB ?? 0.07);
            uniforms.midColor.value.setRGB(p.midR ?? 0.17, p.midG ?? 0.3, p.midB ?? 0.05);
            uniforms.bladeColorVariation.value = p.colorVar ?? 0.93;

            // Global environment colors
            uniforms.backgroundColor.value.copy(new THREE.Color(propsRef.current.backgroundColor));
            uniforms.groundColor.value.copy(new THREE.Color(propsRef.current.groundColor));
          }

          // Wind burst triggers
          if (propsRef.current.windBurstTrigger !== lastBurstTrigger) {
            windBurst = 4.0; // Seconds of burst
            lastBurstTrigger = propsRef.current.windBurstTrigger;
          }

          if (windBurst > 0) {
            windBurst -= dt * 0.6;
            const burstT = Math.max(0, windBurst / 4.0);
            const easedFactor = burstT * burstT * (3 - 2 * burstT);
            uniforms.windSpeed.value = (activeCam.params?.windSpeed ?? 1.3) + easedFactor * 4.5;
            uniforms.windAmplitude.value = (activeCam.params?.windAmplitude ?? 0.21) + easedFactor * 0.45;
          } else {
            uniforms.windSpeed.value = activeCam.params?.windSpeed ?? 1.3;
            uniforms.windAmplitude.value = activeCam.params?.windAmplitude ?? 0.21;
          }

          // Audio-driven grass modulation (scroll-takeover logic)
          const currAudioActive = propsRef.current.audioActive;
          const currScroll = propsRef.current.scrollProgress;

          // Reset scroll lock when audio transitions from off to on
          if (currAudioActive && !prevAudioActive) {
            scrollSinceAudio = false;
          }
          prevAudioActive = currAudioActive;

          // Detect scroll while audio is active
          if (currAudioActive && Math.abs(currScroll - prevRawScroll) > 0.001) {
            scrollSinceAudio = true;
          }
          prevRawScroll = currScroll;

          // Apply audio modulation if active and no scroll detected
          if (currAudioActive && !scrollSinceAudio && windBurst <= 0) {
            const amp = propsRef.current.audioAmplitude;
            const baseSpeed = activeCam.params?.windSpeed ?? 1.3;
            const baseAmp = activeCam.params?.windAmplitude ?? 0.21;
            uniforms.windSpeed.value = baseSpeed + amp * 2.5;
            uniforms.windAmplitude.value = baseAmp + amp * 0.3;
          }

          // Depth of Field Rendering logic
          const isDofActive = propsRef.current.globalDofEnabled && activeCam.dofOn;
          if (isDofActive !== activeDofState) {
            activeDofState = isDofActive;
            postProcessing.outputNode = isDofActive ? dofOutputNode : scenePass;
            postProcessing.needsUpdate = true;
          }

          if (isDofActive) {
            // Focus distances calculations
            const mouseOnField = uniforms.mouseWorld.value.x < 9000;
            const cameraToMouseDist = camera.position.distanceTo(uniforms.mouseWorld.value);
            const rawFocus = mouseOnField
              ? cameraToMouseDist
              : Math.max(0.5, Math.sqrt(activeCam.py * activeCam.py + activeCam.pz * activeCam.pz) * 0.9);

            const clampedFocus = Math.max(activeCam.afMin, Math.min(activeCam.afMax, rawFocus));

            // Smooth focus distances changes
            const smoothedFocus = uniforms.focusDistanceU.value + (clampedFocus - uniforms.focusDistanceU.value) * Math.min(1, dt * (activeCam.afSpd ?? 5.0));
            const activeFocus = activeCam.af ? smoothedFocus : activeCam.fd;

            uniforms.focusDistanceU.value = activeFocus;
            uniforms.focalLengthU.value += (activeCam.fl - uniforms.focalLengthU.value) * Math.min(1, dt * 6);
            uniforms.bokehScaleU.value += (activeCam.bk - uniforms.bokehScaleU.value) * Math.min(1, dt * 6);

            // Update parameters inside keyframes if actively editing so UI mirrors live render state
            if (mode === 'edit' && selectedIdx === activeStage) {
              const currentFD = uniforms.focusDistanceU.value;
              if (propsRef.current.cameraPath[selectedIdx].autoFocus) {
                // Readonly focus reflection in auto focus
                propsRef.current.cameraPath[selectedIdx].focusDist = currentFD;
              }
            }
          }

          // FPS processing
          fpsFrames++;
          const fpsNow = performance.now();
          if (fpsNow - fpsLast >= 500) {
            const actualFps = Math.round(fpsFrames / ((fpsNow - fpsLast) / 1000));
            onFpsUpdate(actualFps);
            fpsFrames = 0;
            fpsLast = fpsNow;
          }

          // Render
          renderer.compute(computeUpdate);
          postProcessing.render();
        };

        // Resize handler
        const handleResize = () => {
          if (destroyed) return;
          const w = containerRef.current?.clientWidth || window.innerWidth;
          const h = containerRef.current?.clientHeight || window.innerHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();

          const dpr = window.innerWidth < 1200 ? 1.5 : Math.min(window.devicePixelRatio, 2);
          renderer.setPixelRatio(dpr);
          renderer.setSize(w, h);
        };

        let resizeTimeout: any;
        const debouncedResize = () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(handleResize, 100);
        };
        window.addEventListener('resize', debouncedResize);

        // Pre-warm loop briefly
        for (let i = 0; i < 3; i++) {
          renderer.compute(computeUpdate);
          postProcessing.render();
        }

        // Run
        animate();

        // Cleanup function
        return () => {
          destroyed = true;
          cancelAnimationFrame(animationFrameId);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('resize', debouncedResize);

          // Dispose GPU objects
          if (renderer) {
            renderer.dispose();
            if (renderer.domElement && containerRef.current?.contains(renderer.domElement)) {
              containerRef.current.removeChild(renderer.domElement);
            }
          }
          if (bladeGeo) bladeGeo.dispose();
          if (skyTexture) skyTexture.dispose();
          if (instancedGrass) {
            instancedGrass.dispose();
            scene.remove(instancedGrass);
          }
        };

      } catch (err: any) {
        console.error('Three.js / WebGL / WebGPU Rendering Error: ', err);
        setHasError(err?.message || 'Incompatible hardware / WebGL driver. Please refresh or use another browser.');
      }
    };

    // Run loader
    const cleanupPromise = init();

    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [onFpsUpdate]);

  // Update sky on changes (non-destructive)
  useEffect(() => {
    // Background colors handle in animation frame by syncing refs,
    // but sky grad textures benefit from a direct rebuild if color changes.
    // However, keeping them dynamic can also be updated inside canvas textures
  }, [skyColors]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-screen h-screen z-0 overflow-hidden pointer-events-none bg-black"
      style={{ touchAction: 'none' }}
    >
      {hasError && (
        <div className="absolute inset-0 bg-[#060606] z-50 flex flex-col items-center justify-center p-6 text-center text-neutral-400">
          <div className="max-w-md p-10 rounded-none border border-[#333] bg-[#0a0a0a] shadow-2xl">
            <h3 className="font-serif italic text-2xl text-[#D4FF00] mb-4">Aesthetics Engine Offline</h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              This interactive digital oasis requires a modern browser supporting high-performance WebGL2/WebGPU rendering.
            </p>
            <div className="text-[10px] font-mono p-3 bg-neutral-950 rounded-none border border-[#333] text-[#D4FF00]/90 text-left overflow-auto max-h-32 mb-6">
              ERR_CODE: {hasError}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 border border-[#D4FF00]/50 bg-[#D4FF00]/15 text-[#D4FF00] font-mono text-[9px] uppercase tracking-widest cursor-pointer hover:bg-[#D4FF00] hover:text-black hover:border-[#D4FF00] transition-colors"
            >
              // Refresh Platform
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
