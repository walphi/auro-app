/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CameraKeyFrame, StageParams } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Global
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  groundColor: string;
  setGroundColor: (color: string) => void;
  skyColors: {
    top: string;
    midHigh: string;
    midLow: string;
    horizon: string;
  };
  setSkyColors: (colors: { top: string; midHigh: string; midLow: string; horizon: string }) => void;
  globalDofEnabled: boolean;
  setGlobalDofEnabled: (val: boolean) => void;
  fpsOverlayVisible: boolean;
  setFpsOverlayVisible: (val: boolean) => void;
  fps: number;

  // Path & Parameters
  cameraPath: CameraKeyFrame[];
  setCameraPath: (path: CameraKeyFrame[]) => void;
  stageParams: StageParams[];
  setStageParams: (params: StageParams[]) => void;
  editingMode: 'scroll' | 'edit';
  setEditingMode: (mode: 'scroll' | 'edit') => void;
  activeStage: number;
  setActiveStage: (idx: number) => void;
}

const stageNames = ['Hero', 'Manifesto', 'Pillars', 'Stats', 'Quote', 'CTA', 'Footer'];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  backgroundColor,
  setBackgroundColor,
  groundColor,
  setGroundColor,
  skyColors,
  setSkyColors,
  globalDofEnabled,
  setGlobalDofEnabled,
  fpsOverlayVisible,
  setFpsOverlayVisible,
  fps,
  cameraPath,
  setCameraPath,
  stageParams,
  setStageParams,
  editingMode,
  setEditingMode,
  activeStage,
  setActiveStage,
}) => {
  const [expandedStageIdx, setExpandedStageIdx] = useState<number | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  // Color conversion helper
  const rgbToHex = (r: number, g: number, b: number) => {
    const clamp = (val: number) => Math.round(Math.min(1, Math.max(0, val)) * 255);
    const toHexVal = (val: number) => clamp(val).toString(16).padStart(2, '0');
    return `#${toHexVal(r)}${toHexVal(g)}${toHexVal(b)}`;
  };

  const hexToRgb = (hex: string) => {
    const val = parseInt(hex.slice(1), 16);
    return {
      r: ((val >> 16) & 255) / 255,
      g: ((val >> 8) & 255) / 255,
      b: (val & 255) / 255,
    };
  };

  // Updaters for camera keyframe paths
  const handleKeyframeChange = (idx: number, key: keyof CameraKeyFrame, value: any) => {
    const updated = [...cameraPath];
    updated[idx] = { ...updated[idx], [key]: value } as any;
    setCameraPath(updated);
  };

  // Updaters for stage parameters
  const handleParamChange = (idx: number, key: string, value: number) => {
    const updated = [...stageParams];
    updated[idx] = { ...updated[idx], [key]: value };
    setStageParams(updated);
  };

  const handleStageColorPickerChange = (idx: number, colorName: string, hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const updated = [...stageParams];
    if (colorName === 'fogColor') {
      updated[idx].fogR = r;
      updated[idx].fogG = g;
      updated[idx].fogB = b;
    } else if (colorName === 'bladeBaseColor') {
      updated[idx].bladeBaseR = r;
      updated[idx].bladeBaseG = g;
      updated[idx].bladeBaseB = b;
    } else if (colorName === 'bladeTipColor') {
      updated[idx].bladeTipR = r;
      updated[idx].bladeTipG = g;
      updated[idx].bladeTipB = b;
    } else if (colorName === 'goldenTipColor') {
      updated[idx].goldenTipR = r;
      updated[idx].goldenTipG = g;
      updated[idx].goldenTipB = b;
    } else if (colorName === 'greenTipColor') {
      updated[idx].greenTipR = r;
      updated[idx].greenTipG = g;
      updated[idx].greenTipB = b;
    } else if (colorName === 'midColor') {
      updated[idx].midR = r;
      updated[idx].midG = g;
      updated[idx].midB = b;
    }
    setStageParams(updated);
  };

  const handleCopyJson = () => {
    const data = cameraPath.map((kf, i) => ({
      stage: stageNames[i],
      scroll: kf.scroll,
      pos: { x: kf.posX, y: kf.posY, z: kf.posZ },
      look: { x: kf.lookX, y: kf.lookY, z: kf.lookZ },
      focusDist: kf.focusDist,
      autoFocus: kf.autoFocus,
      dofEnabled: kf.dofEnabled,
      focalLength: kf.focalLength,
      bokehScale: kf.bokehScale,
      afSpeed: kf.afSpeed,
      afMin: kf.afMin,
      afMax: kf.afMax,
      params: stageParams[i],
    }));

    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy settings JSON:', err);
      });
  };

  const handleStageSelect = (idx: number) => {
    if (editingMode !== 'edit') return;
    setActiveStage(idx);
    const triggerSection = document.querySelector(`.section[data-stage="${idx}"]`);
    if (triggerSection) {
      triggerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleHeaderClick = (idx: number) => {
    if (editingMode !== 'edit') return;
    if (activeStage === idx) {
      setExpandedStageIdx(expandedStageIdx === idx ? null : idx);
    } else {
      handleStageSelect(idx);
    }
  };

  return (
    <div
      id="settingsPanel"
      className="fixed top-1/2 right-6 -translate-y-1/2 w-[340px] max-h-[85vh] overflow-y-auto bg-[#0a0a0af5] backdrop-blur-xl border border-[#333] rounded-none p-[22px] z-[300] shadow-[0_4px_30px_rgba(0,0,0,0.8)] transition-all duration-300 pointer-events-auto flex flex-col gap-5 text-[#f4f4f4]"
    >
      <div className="flex justify-between items-center pb-2 border-b border-[#333]">
        <span className="font-serif italic text-lg tracking-wide text-[#D4FF00]">Oasis Playground</span>
        <button
          onClick={onClose}
          className="text-[9px] font-mono tracking-widest uppercase text-[#555] hover:text-[#D4FF00] transition-colors cursor-pointer"
        >
          Close [X]
        </button>
      </div>

      {/* Global Colors */}
      <div className="flex flex-col gap-3">
        <div className="text-[9px] tracking-[3px] uppercase text-[#666] border-b border-[#333] pb-1.5 font-mono">
          Global Environment
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#aaa]">Background</span>
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="w-8 h-5 cursor-pointer border border-[#333] bg-transparent outline-none p-0 rounded-none"
          />
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-[#aaa]">Ground Surface</span>
          <input
            type="color"
            value={groundColor}
            onChange={(e) => setGroundColor(e.target.value)}
            className="w-8 h-5 cursor-pointer border border-[#333] bg-transparent outline-none p-0 rounded-none"
          />
        </div>
      </div>

      {/* Sky Colors */}
      <div className="flex flex-col gap-3">
        <div className="text-[9px] tracking-[3px] uppercase text-[#666] border-b border-[#333] pb-1.5 font-mono">
          Sky Gradient Canopy
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#aaa]">Zenith (Top)</span>
          <input
            type="color"
            value={skyColors.top}
            onChange={(e) => setSkyColors({ ...skyColors, top: e.target.value })}
            className="w-8 h-5 cursor-pointer border border-[#333] bg-transparent p-0 rounded-none"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#aaa]">Upper Mid</span>
          <input
            type="color"
            value={skyColors.midHigh}
            onChange={(e) => setSkyColors({ ...skyColors, midHigh: e.target.value })}
            className="w-8 h-5 cursor-pointer border border-[#333] bg-transparent p-0 rounded-none"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#aaa]">Lower Mid</span>
          <input
            type="color"
            value={skyColors.midLow}
            onChange={(e) => setSkyColors({ ...skyColors, midLow: e.target.value })}
            className="w-8 h-5 cursor-pointer border border-[#333] bg-transparent p-0 rounded-none"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#aaa]">Horizon</span>
          <input
            type="color"
            value={skyColors.horizon}
            onChange={(e) => setSkyColors({ ...skyColors, horizon: e.target.value })}
            className="w-8 h-5 cursor-pointer border border-[#333] bg-transparent p-0 rounded-none"
          />
        </div>
      </div>

      {/* Camera Coordinates Path */}
      <div className="flex flex-col gap-3">
        <div className="text-[9px] tracking-[3px] uppercase text-[#666] border-b border-[#333] pb-1.5 font-mono flex justify-between items-center">
          <span>Camera Keyframes</span>
          <button
            onClick={handleCopyJson}
            className="text-[8px] font-mono border border-[#333] rounded-none px-1.5 py-0.5 bg-neutral-950 hover:border-[#D4FF00] hover:text-[#D4FF00] transition-colors cursor-pointer"
          >
            {copySuccess ? 'Copied!' : 'Copy JSON'}
          </button>
        </div>

        {/* Operating Modes */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setEditingMode('scroll')}
            className={`flex-1 py-1.5 rounded-none border text-[9px] font-mono uppercase tracking-widest transition-all cursor-pointer ${
              editingMode === 'scroll'
                ? 'bg-[#D4FF00]/15 border-[#D4FF00]/50 text-[#D4FF00]'
                : 'bg-[#111] border-[#333] text-[#666] hover:text-white'
            }`}
          >
            ⏵ Scroll Mode
          </button>
          <button
            onClick={() => setEditingMode('edit')}
            className={`flex-1 py-1.5 rounded-none border text-[9px] font-mono uppercase tracking-widest transition-all cursor-pointer ${
              editingMode === 'edit'
                ? 'bg-[#D4FF00]/15 border-[#D4FF00]/50 text-[#D4FF00]'
                : 'bg-[#111] border-[#333] text-[#666] hover:text-white'
            }`}
          >
            ✎ Editor Mode
          </button>
        </div>

        <div className="text-[10px] text-[#777] font-mono leading-relaxed">
          {editingMode === 'scroll'
            ? 'Camera maps scroll positions smoothly. Transitions animate naturally.'
            : 'Locked mode — select a stage below to pin coordinates, customize, and save.'}
        </div>

        {/* Scroll path accordion */}
        <div className="flex flex-col gap-2">
          {cameraPath.map((kf, i) => {
            const isStageActive = editingMode === 'edit' && activeStage === i;
            const isExpanded = isStageActive && expandedStageIdx === i;
            const stageName = stageNames[i];
            const p = stageParams[i];

            return (
              <div
                key={i}
                className={`flex flex-col border rounded-none transition-all overflow-hidden ${
                  isStageActive
                    ? 'border-[#D4FF00]/50 bg-[#D4FF00]/5'
                    : 'border-[#333] bg-[#0c0c0c] opacity-50 pointer-events-none'
                }`}
                style={{ opacity: editingMode === 'edit' ? 1 : 0.5, pointerEvents: editingMode === 'edit' ? 'auto' : 'none' }}
              >
                {/* Header */}
                <div
                  onClick={() => handleHeaderClick(i)}
                  className="flex justify-between items-center px-3 py-2 cursor-pointer hover:bg-[#D4FF00]/5 transition-all"
                >
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${isStageActive ? 'text-[#D4FF00]' : 'text-[#888]'}`}>
                    {stageName}
                  </span>
                  <span className="text-[10px] font-mono text-[#444]">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>

                {/* Body Controls */}
                {isExpanded && (
                  <div className="flex flex-col gap-4 p-3 border-t border-[#333] text-xs">
                    {/* Camera */}
                    <div className="flex flex-col gap-2.5">
                      <div className="text-[9px] font-mono uppercase text-[#666] tracking-widest border-b border-white/[0.04]">Camera Vector</div>
                      {/* Pos X */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-[#aaa] font-mono">X Coordinate</span>
                          <span className="font-mono text-[10px] text-[#D4FF00]">{kf.posX.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="-10"
                          max="10"
                          step="0.1"
                          value={kf.posX}
                          onChange={(e) => handleKeyframeChange(i, 'posX', parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                        />
                      </div>
                      {/* Pos Y */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-[#aaa] font-mono">Elevation (Y)</span>
                          <span className="font-mono text-[10px] text-[#D4FF00]">{kf.posY.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="15"
                          step="0.1"
                          value={kf.posY}
                          onChange={(e) => handleKeyframeChange(i, 'posY', parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                        />
                      </div>
                      {/* Pos Z */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-[#aaa] font-mono">Depth (Z)</span>
                          <span className="font-mono text-[10px] text-[#D4FF00]">{kf.posZ.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="25"
                          step="0.1"
                          value={kf.posZ}
                          onChange={(e) => handleKeyframeChange(i, 'posZ', parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                        />
                      </div>
                      {/* Look Target Coordinates */}
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[#555] font-mono text-[9px]">Look At Target</span>
                        <div className="flex gap-1.5 font-mono text-[9px] text-[#D4FF00]">
                          <span>[{kf.lookX.toFixed(1)}, {kf.lookY.toFixed(1)}, {kf.lookZ.toFixed(1)}]</span>
                        </div>
                      </div>
                    </div>

                    {/* Depth of field */}
                    <div className="flex flex-col gap-2.5">
                      <div className="text-[9px] font-mono uppercase text-[#666] tracking-widest border-b border-white/[0.04] flex justify-between items-center">
                        <span>Depth Of Field</span>
                        <button
                          onClick={() => handleKeyframeChange(i, 'dofEnabled', !kf.dofEnabled)}
                          className={`text-[8px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded-none cursor-pointer ${
                            kf.dofEnabled
                              ? 'bg-[#D4FF00]/15 text-[#D4FF00] border border-[#D4FF00]/50'
                              : 'bg-neutral-950 border border-[#333] text-neutral-500'
                          }`}
                        >
                          {kf.dofEnabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>

                      {kf.dofEnabled && (
                        <div className="flex flex-col gap-2">
                          {/* Auto focus toggle */}
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-mono text-[#aaa]">Auto Focus (Center Pointer)</span>
                            <button
                              onClick={() => handleKeyframeChange(i, 'autoFocus', !kf.autoFocus)}
                              className={`w-9 h-5 rounded-none relative transition-[background-color] cursor-pointer ${
                                kf.autoFocus ? 'bg-[#D4FF00]' : 'bg-[#111] border border-[#333]'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 bg-black rounded-none absolute top-[2px] transition-[left] ${
                                  kf.autoFocus ? 'left-[18px]' : 'left-[3px]'
                                }`}
                              />
                            </button>
                          </div>

                          {!kf.autoFocus && (
                            <div>
                               <div className="flex justify-between items-center text-[10px] mb-1">
                                 <span className="text-[#aaa] font-mono">Focus Distance</span>
                                 <span className="font-mono text-[10px] text-[#D4FF00]">{kf.focusDist.toFixed(1)}</span>
                               </div>
                               <input
                                 type="range"
                                 min="0.3"
                                 max="40"
                                 step="0.1"
                                 value={kf.focusDist}
                                 onChange={(e) => handleKeyframeChange(i, 'focusDist', parseFloat(e.target.value))}
                                 className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                               />
                            </div>
                          )}

                          {kf.autoFocus && (
                            <div>
                               <div className="flex justify-between items-center text-[10px] mb-1">
                                 <span className="text-[#aaa] font-mono">Focus Speed</span>
                                 <span className="font-mono text-[10px] text-[#D4FF00]">{kf.afSpeed.toFixed(1)}</span>
                               </div>
                               <input
                                 type="range"
                                 min="0.5"
                                 max="20"
                                 step="0.5"
                                 value={kf.afSpeed}
                                 onChange={(e) => handleKeyframeChange(i, 'afSpeed', parseFloat(e.target.value))}
                                 className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                               />
                            </div>
                          )}

                          {/* Focal Length */}
                          <div>
                            <div className="flex justify-between items-center text-[10px] mb-1">
                              <span className="text-[#aaa] font-mono">Focal Length</span>
                              <span className="font-mono text-[10px] text-[#D4FF00]">{kf.focalLength.toFixed(1)}</span>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="20"
                              step="0.1"
                              value={kf.focalLength}
                              onChange={(e) => handleKeyframeChange(i, 'focalLength', parseFloat(e.target.value))}
                              className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                            />
                          </div>

                          {/* Bokeh Scale */}
                          <div>
                            <div className="flex justify-between items-center text-[10px] mb-1">
                              <span className="text-[#aaa] font-mono">Bokeh Blur Potency</span>
                              <span className="font-mono text-[10px] text-[#D4FF00]">{kf.bokehScale.toFixed(1)}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="40"
                              step="0.5"
                              value={kf.bokehScale}
                              onChange={(e) => handleKeyframeChange(i, 'bokehScale', parseFloat(e.target.value))}
                              className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Grass Physics Parameters */}
                    <div className="flex flex-col gap-2.5">
                      <div className="text-[9px] font-mono uppercase text-[#666] tracking-widest border-b border-white/[0.04]">Vegetation Simulation</div>

                      {/* Grass Density */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-[#aaa] font-mono">Density Factor</span>
                          <span className="font-mono text-[10px] text-[#D4FF00]">{p.grassDensity.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={p.grassDensity}
                          onChange={(e) => handleParamChange(i, 'grassDensity', parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                        />
                      </div>

                      {/* Blade Height */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-[#aaa] font-mono">Blade Height</span>
                          <span className="font-mono text-[10px] text-[#D4FF00]">{p.bladeHeight.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="2"
                          step="0.05"
                          value={p.bladeHeight}
                          onChange={(e) => handleParamChange(i, 'bladeHeight', parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                        />
                      </div>

                      {/* Lean */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-[#aaa] font-mono">Wind Lean</span>
                          <span className="font-mono text-[10px] text-[#D4FF00]">{p.bladeLean.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="0.05"
                          value={p.bladeLean}
                          onChange={(e) => handleParamChange(i, 'bladeLean', parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                        />
                      </div>

                      {/* Wind Speed */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1">
                          <span className="text-[#aaa] font-mono">Canopy Wind Velocity</span>
                          <span className="font-mono text-[10px] text-[#D4FF00]">{p.windSpeed.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step="0.1"
                          value={p.windSpeed}
                          onChange={(e) => handleParamChange(i, 'windSpeed', parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#222] rounded-none appearance-none cursor-pointer accent-[#D4FF00]"
                        />
                      </div>
                    </div>

                    {/* Grass Color gradients */}
                    <div className="flex flex-col gap-2.5">
                      <div className="text-[9px] font-mono uppercase text-[#666] tracking-widest border-b border-white/[0.04]">Vegetation Colorways</div>

                      {/* Base Color picker */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[#aaa] font-mono">Stem (Base Color)</span>
                        <input
                          type="color"
                          value={rgbToHex(p.bladeBaseR, p.bladeBaseG, p.bladeBaseB)}
                          onChange={(e) => handleStageColorPickerChange(i, 'bladeBaseColor', e.target.value)}
                          className="w-7 h-4 rounded-none border border-[#333] bg-transparent cursor-pointer"
                        />
                      </div>

                      {/* Tip Color picker */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[#aaa] font-mono">Tip Color</span>
                        <input
                          type="color"
                          value={rgbToHex(p.bladeTipR, p.bladeTipG, p.bladeTipB)}
                          onChange={(e) => handleStageColorPickerChange(i, 'bladeTipColor', e.target.value)}
                          className="w-7 h-4 rounded-none border border-[#333] bg-transparent cursor-pointer"
                        />
                      </div>

                      {/* Golden Tip Color picker */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[#aaa] font-mono">Wild Gold Highlights</span>
                        <input
                          type="color"
                          value={rgbToHex(p.goldenTipR, p.goldenTipG, p.goldenTipB)}
                          onChange={(e) => handleStageColorPickerChange(i, 'goldenTipColor', e.target.value)}
                          className="w-7 h-4 rounded-none border border-[#333] bg-transparent cursor-pointer"
                        />
                      </div>

                      {/* Green Tip Color picker */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[#aaa] font-mono">Lush Green Highlights</span>
                        <input
                          type="color"
                          value={rgbToHex(p.greenTipR, p.greenTipG, p.greenTipB)}
                          onChange={(e) => handleStageColorPickerChange(i, 'greenTipColor', e.target.value)}
                          className="w-7 h-4 rounded-none border border-[#333] bg-transparent cursor-pointer"
                        />
                      </div>

                      {/* MidTone Color picker */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-[#aaa] font-mono">Mid-Tone Transition</span>
                        <input
                          type="color"
                          value={rgbToHex(p.midR, p.midG, p.midB)}
                          onChange={(e) => handleStageColorPickerChange(i, 'midColor', e.target.value)}
                          className="w-7 h-4 rounded-none border border-[#333] bg-transparent cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rendering and debug */}
      <div className="flex flex-col gap-3">
        <div className="text-[9px] tracking-[3px] uppercase text-[#666] border-b border-[#333] pb-1.5 font-mono">
          Graphics Pipeline
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#aaa]">Global Depth Of Field</span>
          <button
            onClick={() => setGlobalDofEnabled(!globalDofEnabled)}
            className={`w-9 h-5 rounded-none relative transition-[background-color] cursor-pointer ${
              globalDofEnabled ? 'bg-[#D4FF00]' : 'bg-[#111] border border-[#333]'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 bg-black rounded-none absolute top-[2px] transition-[left] ${
                globalDofEnabled ? 'left-[18px]' : 'left-[3px]'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-[#aaa]">Debug FPS Overlay</span>
          <button
            onClick={() => setFpsOverlayVisible(!fpsOverlayVisible)}
            className={`w-9 h-5 rounded-none relative transition-[background-color] cursor-pointer ${
              fpsOverlayVisible ? 'bg-[#D4FF00]' : 'bg-[#111] border border-[#333]'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 bg-black rounded-none absolute top-[2px] transition-[left] ${
                fpsOverlayVisible ? 'left-[18px]' : 'left-[3px]'
              }`}
            />
          </button>
        </div>

        {fpsOverlayVisible && (
          <div className="flex justify-between items-center mt-1 text-[10px] font-mono text-[#555]">
            <span>Active Performance</span>
            <span className="text-[#D4FF00] font-mono">{fps} frames/sec</span>
          </div>
        )}
      </div>
    </div>
  );
};
