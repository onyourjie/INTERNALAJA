/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  X, Upload, CheckCircle, XCircle, QrCode, Info, Clock, 
  Zap, Award, TrendingUp, Settings, CheckSquare, Square, 
  ChevronDown, ChevronUp, Download, AlertTriangle, 
  FileImage, Activity, Loader, RotateCcw, Move, Maximize2,
  Type, Palette, AlignCenter, Eye, Layers
} from 'lucide-react';

// Enhanced interfaces with anti-crop text overlay
interface PesertaData {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code?: string;
  created_at: string;
}

// FIXED: QR Position - no more configuration needed
interface QRPosition {
  preset: 'center';
  offsetX: number;
  offsetY: number;
  scale: number;
}

// ENHANCED: Anti-Crop Text overlay interface
interface TextOverlay {
  enabled: boolean;
  preset: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'custom';
  offsetX: number;
  offsetY: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | 'bolder';
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  padding: number;
  borderRadius: number;
  textAlign: 'left' | 'center' | 'right';
  fontFamily: string;
  strokeWidth: number;
  strokeColor: string;
  // ENHANCED: Anti-crop settings
  autoExpandCanvas: boolean;
  minCanvasExpansion: number;
  maxTextWidth?: number;
  lineHeight: number;
  // NEW: Descender support for anti-crop
  descendersSupport: boolean;
  extraSafetyMargin: number;
}

// Enhanced Canvas expansion with anti-crop support
interface CanvasExpansion {
  top: number;
  right: number;
  bottom: number;
  left: number;
  newWidth: number;
  newHeight: number;
  textBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  antiCropApplied: boolean;
  descenderSafety: number;
}

interface TemplateSettings {
  qrPosition: QRPosition;
  textOverlay: TextOverlay;
  canvasExpansion: {
    enabled: boolean;
    autoCalculate: boolean;
    minExpansion: number;
    maxExpansion: number;
  };
}

interface DownloadProgress {
  show: boolean;
  current: number;
  total: number;
  stage: string;
  percentage: number;
  startTime: number;
  estimatedTimeRemaining?: number;
  currentDivisi?: string;
  downloadStarted: boolean;
  downloadCompleted: boolean;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface DivisiOption {
  divisi: string;
  count: number;
}

interface DownloadQRTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  availableDivisi: DivisiOption[];
  onDownload: (templateFile: File, selectedDivisi: string[], templateSettings: TemplateSettings) => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  isLoading: boolean;
}

// ENHANCED: Anti-Crop Text measurement utility
const measureTextDimensionsAntiCrop = (
  text: string, 
  fontSize: number, 
  fontFamily: string, 
  fontWeight: string,
  maxWidth?: number
): { width: number; height: number; lines: string[]; ascent: number; descent: number; safeHeight: number; actualHeight: number } => {
  // Create a temporary canvas for measurement
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    // Enhanced fallback calculation with NO HEIGHT LIMITS
    const avgCharWidth = fontSize * 0.6;
    const estimatedWidth = maxWidth ? Math.min(text.length * avgCharWidth, maxWidth) : text.length * avgCharWidth;
    const descent = fontSize * 0.35; // Enhanced descender calculation for y, g, p, q, j
    const ascent = fontSize * 0.8;
    const actualHeight = ascent + descent; // Real text height
    const safeHeight = actualHeight + fontSize * 0.3; // Extra safety but NO LIMITS
    
    return {
      width: estimatedWidth,
      height: safeHeight,
      lines: [text],
      ascent,
      descent,
      safeHeight,
      actualHeight
    };
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  
  // Enhanced text metrics with descender support
  const sampleMetrics = ctx.measureText(text);
  
  // CRITICAL: Enhanced descender calculation for anti-crop
  const actualAscent = sampleMetrics.actualBoundingBoxAscent || fontSize * 0.8;
  const actualDescent = sampleMetrics.actualBoundingBoxDescent || fontSize * 0.35;
  
  // Test with characters that have descenders to ensure proper measurement
  const testText = text + 'ygpqj'; // Add descender test characters
  const testMetrics = ctx.measureText(testText);
  const enhancedDescent = Math.max(
    actualDescent,
    testMetrics.actualBoundingBoxDescent || fontSize * 0.35,
    fontSize * 0.25 // Minimum descender space
  );
  
  if (!maxWidth) {
    const actualHeight = actualAscent + enhancedDescent; // Real height needed
    const safeHeight = actualHeight + fontSize * 0.4; // Extra anti-crop padding but NO LIMITS
    
    return {
      width: sampleMetrics.width,
      height: safeHeight, // UNLIMITED HEIGHT
      lines: [text],
      ascent: actualAscent,
      descent: enhancedDescent,
      safeHeight,
      actualHeight
    };
  }

  // Handle text wrapping with NO HEIGHT LIMITS
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  let maxLineWidth = 0;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const lineMetrics = ctx.measureText(testLine);
    
    if (lineMetrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
    maxLineWidth = Math.max(maxLineWidth, ctx.measureText(currentLine).width);
  }

  // Enhanced multi-line height calculation with NO LIMITS
  const lineSpacing = fontSize * 0.3;
  const actualHeight = lines.length * (actualAscent + enhancedDescent) + (lines.length - 1) * lineSpacing;
  const safeHeight = actualHeight + fontSize * 0.5; // Extra safety for multi-line but NO HEIGHT LIMITS
  
  return {
    width: maxLineWidth,
    height: safeHeight, // UNLIMITED HEIGHT - bisa sangat besar sesuai kebutuhan
    lines,
    ascent: actualAscent,
    descent: enhancedDescent,
    safeHeight,
    actualHeight
  };
};

// ENHANCED: Anti-Crop Canvas expansion calculator
const calculateCanvasExpansionAntiCrop = (
  templateWidth: number,
  templateHeight: number,
  textOverlay: TextOverlay,
  sampleText: string = "Sample Participant Name with ygpqj"
): CanvasExpansion => {
  if (!textOverlay.enabled) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      newWidth: templateWidth,
      newHeight: templateHeight,
      textBounds: { x: 0, y: 0, width: 0, height: 0 },
      antiCropApplied: false,
      descenderSafety: 0
    };
  }

  // Enhanced text dimension measurement with UNLIMITED HEIGHT
  const textDimensions = measureTextDimensionsAntiCrop(
    sampleText,
    textOverlay.fontSize,
    textOverlay.fontFamily,
    textOverlay.fontWeight,
    textOverlay.maxTextWidth
  );

  // Calculate text position
  let textX = textOverlay.offsetX;
  let textY = textOverlay.offsetY;

  // Adjust for text alignment
  if (textOverlay.textAlign === 'center') {
    textX -= textDimensions.width / 2;
  } else if (textOverlay.textAlign === 'right') {
    textX -= textDimensions.width;
  }

  // ENHANCED: Anti-crop padding calculation with NO HEIGHT RESTRICTIONS
  const basePadding = textOverlay.padding;
  const fontSizeMultiplier = Math.max(1.5, textOverlay.fontSize / 100); // Dynamic multiplier
  const adjustedPadding = basePadding * fontSizeMultiplier;
  
  // CRITICAL: Enhanced descender safety for anti-crop with NO LIMITS
  const descenderSafety = textDimensions.descent + textOverlay.fontSize * 0.3 + textOverlay.extraSafetyMargin;
  const ascenderSafety = textDimensions.ascent + textOverlay.fontSize * 0.1;
  
  const textBounds = {
    x: textX - adjustedPadding,
    y: textY - adjustedPadding - ascenderSafety, // Account for ascender
    width: textDimensions.width + (adjustedPadding * 2),
    height: textDimensions.safeHeight + (adjustedPadding * 2) + descenderSafety + ascenderSafety // UNLIMITED HEIGHT
  };

  // ENHANCED: Expansion calculation with UNLIMITED HEIGHT EXPANSION
  const baseExpansion = textOverlay.minCanvasExpansion;
  const antiCropMargin = Math.max(100, textOverlay.fontSize * 0.8); // Dynamic anti-crop margin
  
  const expansionLeft = Math.max(0, -textBounds.x + baseExpansion + antiCropMargin);
  const expansionTop = Math.max(0, -textBounds.y + baseExpansion + antiCropMargin);
  const expansionRight = Math.max(0, (textBounds.x + textBounds.width) - templateWidth + baseExpansion + antiCropMargin);
  
  // CRITICAL: UNLIMITED BOTTOM EXPANSION - text bisa setinggi apapun
  const expansionBottom = Math.max(0, (textBounds.y + textBounds.height) - templateHeight + baseExpansion + antiCropMargin);

  const antiCropApplied = expansionLeft > 0 || expansionTop > 0 || expansionRight > 0 || expansionBottom > 0;

  // UNLIMITED HEIGHT: Canvas bisa diperluas tanpa batas
  const newHeight = templateHeight + expansionTop + expansionBottom; // Bisa sangat tinggi
  const newWidth = templateWidth + expansionLeft + expansionRight;

  return {
    top: expansionTop,
    right: expansionRight,
    bottom: expansionBottom, // UNLIMITED - bisa sangat besar
    left: expansionLeft,
    newWidth,
    newHeight, // UNLIMITED HEIGHT - tidak ada batasan tinggi
    textBounds,
    antiCropApplied,
    descenderSafety
  };
};

const renderTextWithUnlimitedHeight = (
  ctx: CanvasRenderingContext2D,
  text: string,
  textOverlay: TextOverlay,
  canvasWidth: number,
  canvasHeight: number // Bisa unlimited
) => {
  if (!textOverlay.enabled) return;

  // Measure text with unlimited height
  const textDimensions = measureTextDimensionsAntiCrop(
    text,
    textOverlay.fontSize,
    textOverlay.fontFamily,
    textOverlay.fontWeight,
    textOverlay.maxTextWidth
  );

  // Set font properties
  ctx.font = `${textOverlay.fontWeight} ${textOverlay.fontSize}px ${textOverlay.fontFamily}`;
  ctx.textAlign = textOverlay.textAlign as CanvasTextAlign;
  ctx.textBaseline = 'top'; // Consistent baseline

  // Calculate position (no height restrictions)
  let textX = textOverlay.offsetX;
  let textY = textOverlay.offsetY;

  // Adjust for text alignment
  if (textOverlay.textAlign === 'center') {
    textX = textOverlay.offsetX; // Keep X as is for center
  } else if (textOverlay.textAlign === 'right') {
    textX = textOverlay.offsetX; // Keep X as is for right
  }

  // UNLIMITED HEIGHT: Y position bisa sangat besar
  const finalY = textY; // No restrictions on Y position

  // Draw background if needed (with unlimited height)
  if (textOverlay.backgroundOpacity > 0) {
    const bgX = textX - (textOverlay.textAlign === 'center' ? textDimensions.width / 2 : 
                       textOverlay.textAlign === 'right' ? textDimensions.width : 0) - textOverlay.padding;
    const bgY = finalY - textOverlay.padding;
    const bgWidth = textDimensions.width + (textOverlay.padding * 2);
    const bgHeight = textDimensions.safeHeight + (textOverlay.padding * 2); // UNLIMITED HEIGHT

    ctx.save();
    ctx.globalAlpha = textOverlay.backgroundOpacity;
    ctx.fillStyle = textOverlay.backgroundColor;
    
    if (textOverlay.borderRadius > 0) {
      // Rounded rectangle with unlimited height
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, bgWidth, bgHeight, textOverlay.borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(bgX, bgY, bgWidth, bgHeight); // UNLIMITED HEIGHT rectangle
    }
    ctx.restore();
  }

  // Draw text stroke if needed (unlimited height)
  if (textOverlay.strokeWidth > 0) {
    ctx.strokeStyle = textOverlay.strokeColor;
    ctx.lineWidth = textOverlay.strokeWidth;
    
    if (textDimensions.lines.length === 1) {
      ctx.strokeText(text, textX, finalY);
    } else {
      // Multi-line stroke with unlimited height
      textDimensions.lines.forEach((line, index) => {
        const lineY = finalY + (index * (textOverlay.fontSize * textOverlay.lineHeight));
        ctx.strokeText(line, textX, lineY);
      });
    }
  }

  // Draw text fill (unlimited height)
  ctx.fillStyle = textOverlay.fontColor;
  
  if (textDimensions.lines.length === 1) {
    ctx.fillText(text, textX, finalY);
  } else {
    // Multi-line text with unlimited height
    textDimensions.lines.forEach((line, index) => {
      const lineY = finalY + (index * (textOverlay.fontSize * textOverlay.lineHeight));
      ctx.fillText(line, textX, lineY); // Tidak ada batasan tinggi
    });
  }
};

// Components
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
  );
};

const ProgressBar: React.FC<{
  progress: DownloadProgress;
  onCancel?: () => void;
}> = ({ progress, onCancel }) => {
  const elapsed = Date.now() - progress.startTime;
  const estimatedTotal = progress.current > 0 ? (elapsed * progress.total) / progress.current : 0;
  const remaining = Math.max(0, estimatedTotal - elapsed);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-blue-800 flex items-center">
          <Settings className="mr-2 animate-spin text-blue-600" size={20} />
          Processing Template QR + Anti-Crop Text
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{progress.current} / {progress.total} QR processed</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center text-gray-700">
            <Clock className="w-4 h-4 mr-2 text-gray-500" />
            <span className="font-medium">Status:</span>
            <span className="ml-2">{progress.stage}</span>
          </div>
          
          {progress.currentDivisi && (
            <div className="flex items-center text-gray-700">
              <Award className="w-4 h-4 mr-2 text-purple-500" />
              <span className="font-medium">Divisi:</span>
              <span className="ml-2 bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                {progress.currentDivisi}
              </span>
            </div>
          )}
          
          <div className="flex items-center text-gray-700">
            <TrendingUp className="w-4 h-4 mr-2 text-gray-500" />
            <span className="font-medium">Waktu berlalu:</span>
            <span className="ml-2">{formatTime(elapsed)}</span>
          </div>
          
          {remaining > 1000 && (
            <div className="flex items-center text-gray-700">
              <Clock className="w-4 h-4 mr-2 text-gray-500" />
              <span className="font-medium">Estimasi sisa:</span>
              <span className="ml-2">{formatTime(remaining)}</span>
            </div>
          )}
        </div>

        {/* Anti-Crop Processing Info */}
        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <div className="flex items-center text-green-800 text-sm">
            <Type className="w-4 h-4 mr-2" />
            <span className="font-medium">Anti-Crop Mode Active:</span>
            <span className="ml-2">Text tidak akan terpotong (y, g, p, q, j lengkap)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const DivisiSelector: React.FC<{
  availableDivisi: DivisiOption[];
  selectedDivisi: string[];
  onSelectionChange: (selected: string[]) => void;
  maxSelection: number;
  disabled?: boolean;
}> = ({ availableDivisi, selectedDivisi, onSelectionChange, maxSelection, disabled = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const toggleDivisi = (divisi: string) => {
    if (disabled) return;
    
    if (selectedDivisi.includes(divisi)) {
      onSelectionChange(selectedDivisi.filter(d => d !== divisi));
    } else if (selectedDivisi.length < maxSelection) {
      onSelectionChange([...selectedDivisi, divisi]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    const toSelect = availableDivisi.slice(0, maxSelection).map(d => d.divisi);
    onSelectionChange(toSelect);
  };

  const clearAll = () => {
    if (disabled) return;
    onSelectionChange([]);
  };

  return (
    <>
      <div className="relative">
        <div 
          onClick={() => !disabled && setShowDropdown(!showDropdown)}
          className={`w-full p-3 border border-gray-300 rounded-lg bg-white cursor-pointer flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500'}`}
        >
          <div className="flex-1">
            {selectedDivisi.length === 0 ? (
              <span className="text-gray-500">Pilih divisi untuk template (max {maxSelection})</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedDivisi.slice(0, 3).map(divisi => (
                  <span key={divisi} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                    {divisi}
                  </span>
                ))}
                {selectedDivisi.length > 3 && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                    +{selectedDivisi.length - 3} lainnya
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {selectedDivisi.length}/{maxSelection}
            </span>
            {showDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {showDropdown && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
            <div className="p-2 border-b bg-gray-50 flex gap-2">
              <button
                onClick={selectAll}
                disabled={selectedDivisi.length >= maxSelection}
                className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                Pilih {maxSelection} Pertama
              </button>
              <button
                onClick={clearAll}
                className="flex-1 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Clear All
              </button>
            </div>
            
            <div className="max-h-48 overflow-y-auto">
              {availableDivisi.map(({ divisi, count }) => {
                const isSelected = selectedDivisi.includes(divisi);
                const canSelect = !isSelected && selectedDivisi.length < maxSelection;
                
                return (
                  <div
                    key={divisi}
                    onClick={() => toggleDivisi(divisi)}
                    className={`p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${
                      !canSelect && !isSelected ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 mr-2" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400 mr-2" />
                      )}
                      <span className="text-sm font-medium">{divisi}</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {count} QR
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Backdrop untuk menutup dropdown ketika klik di luar */}
      {showDropdown && !disabled && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </>
  );
};

// ENHANCED: Anti-Crop Text Overlay Controller Component
const TextOverlayControllerAntiCrop: React.FC<{
  textOverlay: TextOverlay;
  onTextOverlayChange: (textOverlay: TextOverlay) => void;
  disabled?: boolean;
  templateWidth?: number;
  templateHeight?: number;
}> = ({ textOverlay, onTextOverlayChange, disabled = false, templateWidth = 800, templateHeight = 1200 }) => {
  
  const presetOptions = [
    { value: 'center', label: 'Center', icon: '⊡' },
    { value: 'top', label: 'Top', icon: '⌃' },
    { value: 'bottom', label: 'Bottom', icon: '⌄' },
    { value: 'left', label: 'Left', icon: '⌊' },
    { value: 'right', label: 'Right', icon: '⌋' },
    { value: 'custom', label: 'Custom Position', icon: '⌖' }
  ];

  const fontFamilyOptions = [
    { value: 'Arial', label: 'Arial' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Trebuchet MS', label: 'Trebuchet MS' },
    { value: 'Comic Sans MS', label: 'Comic Sans MS' }
  ];

  // Calculate canvas expansion preview with anti-crop
  const canvasExpansion = useMemo(() => {
    return calculateCanvasExpansionAntiCrop(
      templateWidth, 
      templateHeight, 
      textOverlay, 
      "Sample Participant Name with ygpqj"
    );
  }, [templateWidth, templateHeight, textOverlay]);

  const needsExpansion = canvasExpansion.antiCropApplied;

  const handleToggleEnabled = () => {
    onTextOverlayChange({
      ...textOverlay,
      enabled: !textOverlay.enabled
    });
  };

  const handlePresetChange = (preset: TextOverlay['preset']) => {
    let defaultOffsets = { offsetX: 0, offsetY: 750 }; // Default Y offset for nama
    
    switch (preset) {
      case 'top':
        defaultOffsets = { offsetX: 0, offsetY: 100 };
        break;
      case 'bottom':
        defaultOffsets = { offsetX: 0, offsetY: 750 }; // User's requested position
        break;
      case 'left':
        defaultOffsets = { offsetX: 50, offsetY: 400 };
        break;
      case 'right':
        defaultOffsets = { offsetX: templateWidth - 50, offsetY: 400 };
        break;
      case 'center':
        defaultOffsets = { offsetX: templateWidth / 2, offsetY: templateHeight / 2 };
        break;
      case 'custom':
        defaultOffsets = { offsetX: textOverlay.offsetX, offsetY: textOverlay.offsetY };
        break;
    }

    onTextOverlayChange({
      ...textOverlay,
      preset,
      ...defaultOffsets
    });
  };

  const handleOffsetChange = (axis: 'X' | 'Y', value: string | number) => {
    if (typeof value === 'string') {
      if (value === '' || value === '-') {
        return;
      }
      
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        const clampedValue = Math.max(-10000, Math.min(10000, numValue));
        onTextOverlayChange({
          ...textOverlay,
          [`offset${axis}`]: clampedValue
        });
      }
    } else {
      onTextOverlayChange({
        ...textOverlay,
        [`offset${axis}`]: value
      });
    }
  };

  const handlePropertyChange = (property: keyof TextOverlay, value: any) => {
    onTextOverlayChange({
      ...textOverlay,
      [property]: value
    });
  };

  const handleFontSizeChange = (value: string | number) => {
    if (typeof value === 'string') {
      if (value === '') {
        return;
      }
      
      const numValue = parseInt(value);
      
      if (!isNaN(numValue)) {
        const clampedValue = Math.max(12, Math.min(1000, numValue));
        onTextOverlayChange({
          ...textOverlay,
          fontSize: clampedValue
        });
      }
    } else {
      onTextOverlayChange({
        ...textOverlay,
        fontSize: value
      });
    }
  };

  const resetToDefault = () => {
    onTextOverlayChange({
      enabled: true,
      preset: 'bottom',
      offsetX: templateWidth / 2, // Center X by default
      offsetY: 750,
      fontSize: 24,
      fontWeight: 'bold',
      fontColor: '#000000',
      backgroundColor: '#FFFFFF',
      backgroundOpacity: 0.8,
      padding: 8,
      borderRadius: 4,
      textAlign: 'center',
      fontFamily: 'Arial',
      strokeWidth: 0,
      strokeColor: '#FFFFFF',
      // ENHANCED: Anti-cropping settings
      autoExpandCanvas: true,
      minCanvasExpansion: 50,
      lineHeight: 1.2,
      descendersSupport: true,
      extraSafetyMargin: 20
    });
  };

  const handleSafePositioning = () => {
    // Set safe positioning that won't require canvas expansion
    const safeY = Math.min(textOverlay.offsetY, templateHeight - 100);
    const safeX = Math.max(50, Math.min(textOverlay.offsetX, templateWidth - 50));
    
    onTextOverlayChange({
      ...textOverlay,
      offsetX: safeX,
      offsetY: safeY,
      autoExpandCanvas: false
    });
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Type className="mr-2 text-green-600" size={20} />
          Anti-Crop Text Overlay Settings
          {needsExpansion && (
            <span className="ml-2 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
              Canvas Will Expand
            </span>
          )}
          {textOverlay.descendersSupport && (
            <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
              Anti-Crop Active
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefault}
            disabled={disabled}
            className="flex items-center px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="mr-1" size={14} />
            Reset
          </button>
          <button
            onClick={handleToggleEnabled}
            disabled={disabled}
            className={`flex items-center px-3 py-1 text-sm rounded-lg transition-colors disabled:opacity-50 ${
              textOverlay.enabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            {textOverlay.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* ENHANCED: Canvas expansion warning/info with anti-crop details */}
      {textOverlay.enabled && needsExpansion && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-orange-800 mb-2 flex items-center">
                <Maximize2 className="w-4 h-4 mr-2" />
                Anti-Crop Canvas Auto-Expansion Detected
              </h4>
              <div className="text-sm text-orange-700 space-y-1">
                <p><strong>Original:</strong> {templateWidth} × {templateHeight}px</p>
                <p><strong>New Size:</strong> {canvasExpansion.newWidth} × {canvasExpansion.newHeight}px</p>
                <p><strong>Expansion:</strong> Top:{canvasExpansion.top}px, Right:{canvasExpansion.right}px, Bottom:{canvasExpansion.bottom}px, Left:{canvasExpansion.left}px</p>
                <p><strong>Anti-Crop Safety:</strong> Descender space: {canvasExpansion.descenderSafety.toFixed(1)}px (untuk huruf y, g, p, q, j)</p>
              </div>
            </div>
            <button
              onClick={handleSafePositioning}
              disabled={disabled}
              className="ml-4 px-3 py-1 text-xs bg-orange-200 text-orange-800 rounded hover:bg-orange-300 disabled:opacity-50"
            >
              Fix Position
            </button>
          </div>
        </div>
      )}

      {textOverlay.enabled && (
        <div className="space-y-6">
          {/* ENHANCED: Anti-Crop settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Anti-Crop Settings (Huruf y, g, p, q, j tidak terpotong)
            </label>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="descendersSupport"
                  checked={textOverlay.descendersSupport}
                  onChange={(e) => handlePropertyChange('descendersSupport', e.target.checked)}
                  disabled={disabled}
                  className="mr-2"
                />
                <label htmlFor="descendersSupport" className="text-sm text-gray-700">
                  Enable descender support (y, g, p, q, j)
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Extra Safety Margin: {textOverlay.extraSafetyMargin}px
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={textOverlay.extraSafetyMargin}
                  onChange={(e) => handlePropertyChange('extraSafetyMargin', parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>10px</span>
                  <span>50px</span>
                  <span>100px</span>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas expansion settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Canvas Expansion Settings (Anti-Cropping)
            </label>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoExpandCanvas"
                  checked={textOverlay.autoExpandCanvas}
                  onChange={(e) => handlePropertyChange('autoExpandCanvas', e.target.checked)}
                  disabled={disabled}
                  className="mr-2"
                />
                <label htmlFor="autoExpandCanvas" className="text-sm text-gray-700">
                  Auto-expand canvas for text positioning
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Min Expansion Padding: {textOverlay.minCanvasExpansion}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="10"
                  value={textOverlay.minCanvasExpansion}
                  onChange={(e) => handlePropertyChange('minCanvasExpansion', parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Position Preset Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Text Position Preset
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {presetOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => handlePresetChange(option.value as TextOverlay['preset'])}
                  disabled={disabled}
                  className={`p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    textOverlay.preset === option.value
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-green-300 hover:bg-green-25'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="text-lg mr-2">{option.icon}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Settings */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Family
              </label>
              <select
                value={textOverlay.fontFamily}
                onChange={(e) => handlePropertyChange('fontFamily', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                {fontFamilyOptions.map(font => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Size: {textOverlay.fontSize}px (Anti-Crop: 12px - 1000px)
              </label>
              <div className="space-y-3">
                {/* Slider for common sizes */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Quick Size Slider (12px - 200px)</label>
                  <input
                    type="range"
                    min="12"
                    max="200"
                    step="2"
                    value={Math.min(textOverlay.fontSize, 200)}
                    onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                    disabled={disabled}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>12px</span>
                    <span>50px</span>
                    <span>100px</span>
                    <span>200px</span>
                  </div>
                </div>
                
                {/* Direct input for extreme sizes */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Custom Size Input (12px - 1000px)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="12"
                      max="1000"
                      step="1"
                      value={textOverlay.fontSize}
                      onChange={(e) => handleFontSizeChange(e.target.value)}
                      disabled={disabled}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                      placeholder="Font size in pixels"
                    />
                    <span className="text-sm text-gray-500 font-medium">px</span>
                  </div>
                </div>
                
                {/* Quick size presets */}
                <div className="flex flex-wrap gap-2">
                  {[24, 48, 72, 100, 150, 200, 300, 500, 750, 1000].map(size => (
                    <button
                      key={size}
                      onClick={() => handleFontSizeChange(size)}
                      disabled={disabled}
                      className={`px-3 py-1 text-xs rounded transition-colors disabled:opacity-50 ${
                        textOverlay.fontSize === size
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
                
                {/* Size category indicators */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <p className="font-medium text-blue-800">12-50px</p>
                    <p className="text-blue-600">Normal Text</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <p className="font-medium text-green-800">50-150px</p>
                    <p className="text-green-600">Large Text</p>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <p className="font-medium text-orange-800">150-500px</p>
                    <p className="text-orange-600">Poster Size</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded">
                    <p className="font-medium text-red-800">500-1000px</p>
                    <p className="text-red-600">Banner Size</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Font Weight and Text Align */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Weight
              </label>
              <select
                value={textOverlay.fontWeight}
                onChange={(e) => handlePropertyChange('fontWeight', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="bolder">Bolder</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Alignment
              </label>
              <select
                value={textOverlay.textAlign}
                onChange={(e) => handlePropertyChange('textAlign', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          {/* Colors */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={textOverlay.fontColor}
                  onChange={(e) => handlePropertyChange('fontColor', e.target.value)}
                  disabled={disabled}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer disabled:opacity-50"
                />
                <input
                  type="text"
                  value={textOverlay.fontColor}
                  onChange={(e) => handlePropertyChange('fontColor', e.target.value)}
                  disabled={disabled}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  placeholder="#000000"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={textOverlay.backgroundColor}
                  onChange={(e) => handlePropertyChange('backgroundColor', e.target.value)}
                  disabled={disabled}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer disabled:opacity-50"
                />
                <input
                  type="text"
                  value={textOverlay.backgroundColor}
                  onChange={(e) => handlePropertyChange('backgroundColor', e.target.value)}
                  disabled={disabled}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
          </div>

          {/* Background Opacity and Padding */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Opacity: {Math.round(textOverlay.backgroundOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={textOverlay.backgroundOpacity}
                onChange={(e) => handlePropertyChange('backgroundOpacity', parseFloat(e.target.value))}
                disabled={disabled}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Padding: {textOverlay.padding}px
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="2"
                value={textOverlay.padding}
                onChange={(e) => handlePropertyChange('padding', parseInt(e.target.value))}
                disabled={disabled}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>

          {/* Border Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Border Radius: {textOverlay.borderRadius}px
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={textOverlay.borderRadius}
              onChange={(e) => handlePropertyChange('borderRadius', parseInt(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Custom Position (if custom preset selected) */}
          {textOverlay.preset === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Custom Text Position (pixels) - Anti-Crop Range: -10000px to +10000px
              </label>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Horizontal Offset (X) - Left/Right (Template Width: {templateWidth}px)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-5000"
                      max="5000"
                      step="50"
                      value={Math.max(-5000, Math.min(5000, textOverlay.offsetX))}
                      onChange={(e) => handleOffsetChange('X', parseInt(e.target.value))}
                      disabled={disabled}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                    <input
                      type="number"
                      min="-10000"
                      max="10000"
                      step="10"
                      value={textOverlay.offsetX}
                      onChange={(e) => handleOffsetChange('X', e.target.value)}
                      disabled={disabled}
                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">px</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>-5000 (Far Left)</span>
                    <span>0 (Left Edge)</span>
                    <span>+5000 (Far Right)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Slider: ±5000px, Input: ±10000px untuk positioning ekstrem
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Vertical Offset (Y) - Up/Down (Template Height: {templateHeight}px)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-5000"
                      max="5000"
                      step="50"
                      value={Math.max(-5000, Math.min(5000, textOverlay.offsetY))}
                      onChange={(e) => handleOffsetChange('Y', parseInt(e.target.value))}
                      disabled={disabled}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                    <input
                      type="number"
                      min="-10000"
                      max="10000"
                      step="10"
                      value={textOverlay.offsetY}
                      onChange={(e) => handleOffsetChange('Y', e.target.value)}
                      disabled={disabled}
                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">px</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>-5000 (Far Up)</span>
                    <span>0 (Top Edge)</span>
                    <span>+5000 (Far Down)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Slider: ±5000px, Input: ±10000px untuk positioning ekstrem
                  </p>
                </div>
              </div>
              
              {/* Enhanced Quick Presets for Extreme Positioning */}
              <div className="mt-4 p-3 bg-green-100 rounded-lg">
                <p className="text-xs font-medium text-green-800 mb-2">Quick Position Presets (Anti-Crop Extended Range):</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      handleOffsetChange('X', templateWidth / 2);
                      handleOffsetChange('Y', 750);
                    }}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-white border border-green-300 rounded hover:bg-green-50 disabled:opacity-50"
                  >
                    Standard (Y: 750)
                  </button>
                  <button
                    onClick={() => {
                      handleOffsetChange('X', templateWidth / 2);
                      handleOffsetChange('Y', 1500);
                    }}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-white border border-green-300 rounded hover:bg-green-50 disabled:opacity-50"
                  >
                    Lower (Y: 1500)
                  </button>
                  <button
                    onClick={() => {
                      handleOffsetChange('X', templateWidth / 2);
                      handleOffsetChange('Y', 3000);
                    }}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-white border border-green-300 rounded hover:bg-green-50 disabled:opacity-50"
                  >
                    Far Down (Y: 3000)
                  </button>
                  <button
                    onClick={() => {
                      handleOffsetChange('X', templateWidth / 2);
                      handleOffsetChange('Y', 5000);
                    }}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-white border border-green-300 rounded hover:bg-green-50 disabled:opacity-50"
                  >
                    Extreme (Y: 5000)
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      handleOffsetChange('X', -2000);
                      handleOffsetChange('Y', templateHeight / 2);
                    }}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-white border border-green-300 rounded hover:bg-green-50 disabled:opacity-50"
                  >
                    Far Left (X: -2000)
                  </button>
                  <button
                    onClick={() => {
                      handleOffsetChange('X', templateWidth + 2000);
                      handleOffsetChange('Y', templateHeight / 2);
                    }}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Far Right (X: +{templateWidth + 2000})
                  </button>
                  <button
                    onClick={() => {
                      handleOffsetChange('X', templateWidth / 2);
                      handleOffsetChange('Y', -2000);
                    }}
                    disabled={disabled}
                    className="px-2 py-1 text-xs bg-white border border-green-300 rounded hover:bg-green-50 disabled:opacity-50"
                  >
                    Far Up (Y: -2000)
                  </button>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>💡 Tips Anti-Cropping Mode:</strong> Gunakan nilai besar (±2000-10000px) untuk positioning di luar template. 
                  Canvas akan diperluas otomatis untuk menampung text yang keluar bounds. Text tidak akan terpotong!
                </p>
              </div>
            </div>
          )}

          {/* ENHANCED: Text Overlay Summary with Anti-Cropping Info */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800 mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Anti-Crop Text Overlay Summary
            </h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-green-700">
              <div>
                <p><strong>Position:</strong> {presetOptions.find(p => p.value === textOverlay.preset)?.label}</p>
                <p><strong>Font:</strong> {textOverlay.fontFamily} {textOverlay.fontSize}px {textOverlay.fontWeight}</p>
                <p><strong>Size Category:</strong> {
                  textOverlay.fontSize <= 50 ? 'Normal (12-50px)' :
                  textOverlay.fontSize <= 150 ? 'Large (51-150px)' :
                  textOverlay.fontSize <= 500 ? 'Poster (151-500px)' :
                  'Banner (501-1000px)'
                }</p>
                <p><strong>Anti-Crop:</strong> {textOverlay.descendersSupport ? 'Enabled (y,g,p,q,j safe)' : 'Disabled'}</p>
              </div>
              <div>
                <p><strong>Colors:</strong> {textOverlay.fontColor} on {textOverlay.backgroundColor}</p>
                <p><strong>Position:</strong> X:{textOverlay.offsetX}px, Y:{textOverlay.offsetY}px</p>
                <p><strong>Canvas:</strong> {needsExpansion ? `Will expand to ${canvasExpansion.newWidth}×${canvasExpansion.newHeight}px` : 'Original size maintained'}</p>
                <p><strong>Safety Margin:</strong> {textOverlay.extraSafetyMargin}px extra space</p>
              </div>
            </div>
            {(Math.abs(textOverlay.offsetX) > 5000 || Math.abs(textOverlay.offsetY) > 5000 || textOverlay.fontSize > 200) && (
              <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800">
                <strong>⚡ Anti-Cropping Active:</strong> Canvas akan diperluas otomatis untuk menampung positioning/font ekstrem. 
                Text dijamin tidak terpotong termasuk huruf dengan descender (y, g, p, q, j)!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DownloadQRTemplate: React.FC<DownloadQRTemplateProps> = ({
  isOpen,
  onClose,
  availableDivisi,
  onDownload,
  addToast,
  isLoading
}) => {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);
  const [selectedDivisi, setSelectedDivisi] = useState<string[]>([]);
  const [templateDimensions, setTemplateDimensions] = useState({ width: 800, height: 1200 });
  
  // FIXED: Settings with fixed QR position (75% scale, 550px Y offset) + Anti-Crop Text
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings>({
    qrPosition: {
      preset: 'center',
      offsetX: 0,
      offsetY: 550, // FIXED: 550px Y offset
      scale: 0.75   // FIXED: 75% scale
    },
    textOverlay: {
      enabled: true,
      preset: 'bottom',
      offsetX: 400, // Default to center of 800px template
      offsetY: 750, // User's requested Y position
      fontSize: 24,
      fontWeight: 'bold',
      fontColor: '#000000',
      backgroundColor: '#FFFFFF',
      backgroundOpacity: 0.8,
      padding: 8,
      borderRadius: 4,
      textAlign: 'center',
      fontFamily: 'Arial',
      strokeWidth: 0,
      strokeColor: '#FFFFFF',
      // ENHANCED: Anti-cropping settings
      autoExpandCanvas: true,
      minCanvasExpansion: 50,
      lineHeight: 1.2,
      descendersSupport: true,
      extraSafetyMargin: 20
    },
    canvasExpansion: {
      enabled: true,
      autoCalculate: true,
      minExpansion: 50,
      maxExpansion: 10000
    }
  });
  
  // Progress state
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    show: false,
    current: 0,
    total: 0,
    stage: '',
    percentage: 0,
    startTime: 0,
    downloadStarted: false,
    downloadCompleted: false
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  
  const MAX_DIVISI_TEMPLATE = 10;

  // Calculate total QR for selected divisi
  const totalQRForSelectedDivisi = useMemo(() => {
    return selectedDivisi.reduce((total, divisi) => {
      const divisiData = availableDivisi.find(d => d.divisi === divisi);
      return total + (divisiData?.count || 0);
    }, 0);
  }, [selectedDivisi, availableDivisi]);

  // Enhanced file validation
  const validateTemplateFile = useCallback((file: File): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!file.type.startsWith('image/')) {
      errors.push('File harus berupa gambar (PNG, JPG, JPEG)');
    }
    
    if (file.size > 15 * 1024 * 1024) {
      errors.push(`File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)}MB). Maksimal 15MB`);
    }
    
    if (file.size < 10 * 1024) {
      errors.push('File terlalu kecil. Minimum 10KB');
    }

    return { valid: errors.length === 0, errors };
  }, []);
  
  // ENHANCED: Template file handling with dimension detection
  const handleTemplateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validation = validateTemplateFile(selectedFile);
    if (!validation.valid) {
      addToast({
        type: 'error',
        title: 'File Template Tidak Valid',
        message: validation.errors.join(', ')
      });
      e.target.value = '';
      return;
    }

    setTemplateFile(selectedFile);
    
    // Create preview and get dimensions
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setTemplatePreview(result);
      
      // Get actual image dimensions
      const img = new Image();
      img.onload = () => {
        setTemplateDimensions({ width: img.width, height: img.height });
        
        // Update text overlay position to center of actual image
        setTemplateSettings(prev => ({
          ...prev,
          // KEEP QR position fixed
          qrPosition: {
            preset: 'center',
            offsetX: 0,
            offsetY: 550, // FIXED: 550px Y offset
            scale: 0.75   // FIXED: 75% scale
          },
          textOverlay: {
            ...prev.textOverlay,
            offsetX: img.width / 2, // Center X on actual template
            offsetY: Math.max(750, img.height - 200) // Bottom area or user preference
          }
        }));
        
        addToast({
          type: 'success',
          title: 'Template Berhasil Diupload',
          message: `${selectedFile.name} (${img.width}×${img.height}px) siap digunakan dengan QR fixed position & anti-cropping`
        });
      };
      img.src = result;
    };
    reader.onerror = () => {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Gagal membaca file template'
      });
    };
    reader.readAsDataURL(selectedFile);
  }, [addToast, validateTemplateFile]);

  const clearTemplate = useCallback(() => {
    setTemplateFile(null);
    setTemplatePreview(null);
    setSelectedDivisi([]);
    setDownloadProgress(prev => ({ ...prev, show: false }));
    setTemplateDimensions({ width: 800, height: 1200 });
    
    // Reset to default settings with FIXED QR position + Anti-Crop
    setTemplateSettings({
      qrPosition: {
        preset: 'center',
        offsetX: 0,
        offsetY: 550, // FIXED: 550px Y offset
        scale: 0.75   // FIXED: 75% scale
      },
      textOverlay: {
        enabled: true,
        preset: 'bottom',
        offsetX: 400,
        offsetY: 750,
        fontSize: 24,
        fontWeight: 'bold',
        fontColor: '#000000',
        backgroundColor: '#FFFFFF',
        backgroundOpacity: 0.8,
        padding: 8,
        borderRadius: 4,
        textAlign: 'center',
        fontFamily: 'Arial',
        strokeWidth: 0,
        strokeColor: '#FFFFFF',
        autoExpandCanvas: true,
        minCanvasExpansion: 50,
        lineHeight: 1.2,
        descendersSupport: true,
        extraSafetyMargin: 20
      },
      canvasExpansion: {
        enabled: true,
        autoCalculate: true,
        minExpansion: 50,
        maxExpansion: 10000
      }
    });
    
    const fileInput = document.getElementById('templateFileModal') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
    addToast({
      type: 'info',
      title: 'Template Dihapus',
      message: 'Template dan pengaturan anti-cropping telah direset (QR tetap fixed 75% scale, Y:550px)'
    });
  }, [addToast]);

  // ENHANCED: Download handler with canvas expansion info
  const handleDownload = useCallback(async () => {
    if (!templateFile) {
      addToast({
        type: 'warning',
        title: 'Template Belum Dipilih',
        message: 'Upload template terlebih dahulu'
      });
      return;
    }

    if (selectedDivisi.length === 0) {
      addToast({
        type: 'warning',
        title: 'Divisi Belum Dipilih',
        message: 'Pilih minimal 1 divisi untuk template processing'
      });
      return;
    }

    // Calculate canvas expansion for confirmation
    const canvasExpansion = calculateCanvasExpansionAntiCrop(
      templateDimensions.width,
      templateDimensions.height,
      templateSettings.textOverlay,
      "Sample Participant Name with ygpqj"
    );

    const needsExpansion = canvasExpansion.antiCropApplied;

    // Enhanced confirmation with anti-crop canvas expansion info
    const estimatedTime = Math.ceil(totalQRForSelectedDivisi / 4); // Slower due to anti-crop processing
    const estimatedSize = Math.ceil(totalQRForSelectedDivisi * 0.4); // Larger due to expansion
    
    // FIXED QR info
    const qrInfo = `Fixed QR: Center position (Y:550px, 75% scale)`;
      
    const textInfo = templateSettings.textOverlay.enabled 
      ? `Anti-Crop Text at X:${templateSettings.textOverlay.offsetX}, Y:${templateSettings.textOverlay.offsetY}px (${templateSettings.textOverlay.fontSize}px ${templateSettings.textOverlay.fontFamily})`
      : 'No text overlay';

    const canvasInfo = needsExpansion 
      ? `Canvas expansion: ${templateDimensions.width}×${templateDimensions.height} → ${canvasExpansion.newWidth}×${canvasExpansion.newHeight}px`
      : `Canvas: ${templateDimensions.width}×${templateDimensions.height}px (no expansion needed)`;

    const antiCropInfo = templateSettings.textOverlay.descendersSupport 
      ? `Anti-Crop: Enabled (y,g,p,q,j tidak terpotong, +${templateSettings.textOverlay.extraSafetyMargin}px safety)`
      : `Anti-Crop: Disabled`;
    
    const proceed = confirm(
      `Download ${totalQRForSelectedDivisi} QR dengan template + anti-crop text untuk ${selectedDivisi.length} divisi:\n\n` +
      `📁 Divisi: ${selectedDivisi.slice(0, 3).join(', ')}${selectedDivisi.length > 3 ? ' dan lainnya...' : ''}\n` +
      `📍 ${qrInfo}\n` +
      `📝 Text: ${textInfo}\n` +
      `🖼️ ${canvasInfo}\n` +
      `🛡️ ${antiCropInfo}\n` +
      `⏱️ Estimasi waktu: ${estimatedTime} detik\n` +
      `💾 Estimasi ukuran: ~${estimatedSize} MB\n\n` +
      `Lanjutkan?`
    );
    
    if (!proceed) return;

    // Initialize progress
    setDownloadProgress({
      show: true,
      current: 0,
      total: totalQRForSelectedDivisi,
      stage: 'Memulai anti-crop template processing dengan QR fixed position...',
      percentage: 0,
      startTime: Date.now(),
      downloadStarted: false,
      downloadCompleted: false
    });

    try {
      abortControllerRef.current = new AbortController();
      
      // Update progress
      setDownloadProgress(prev => ({
        ...prev,
        stage: 'Mengirim template dan konfigurasi QR (Fixed 75% scale Y:550px) + Anti-Crop Text ke server...',
        percentage: 5
      }));
      
      // Call the onDownload callback with enhanced template settings
      await onDownload(templateFile, selectedDivisi, templateSettings);
      
      // Complete progress
      setDownloadProgress(prev => ({
        ...prev,
        percentage: 100,
        stage: 'Download selesai! QR fixed position & Anti-Crop Text dijamin tidak terpotong.',
        downloadCompleted: true
      }));
      
    } catch (error: any) {
      setDownloadProgress(prev => ({ ...prev, show: false }));
      
      if (error.name === 'AbortError') {
        addToast({
          type: 'error',
          title: 'Download Dibatalkan',
          message: 'Download dibatalkan oleh user'
        });
      } else {
        addToast({
          type: 'error',
          title: 'Anti-Crop Template Processing Gagal',
          message: error.message || 'Error saat processing template'
        });
      }
    }
  }, [templateFile, selectedDivisi, totalQRForSelectedDivisi, templateSettings, templateDimensions, addToast, onDownload]);

  const handleClose = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setTemplateFile(null);
    setTemplatePreview(null);
    setSelectedDivisi([]);
    setDownloadProgress(prev => ({ ...prev, show: false }));
    onClose();
  }, [onClose]);

  const cancelDownload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setDownloadProgress(prev => ({ ...prev, show: false }));
    addToast({
      type: 'info',
      title: 'Download Dibatalkan',
      message: 'Anti-crop template processing telah dibatalkan'
    });
  }, [addToast]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setTemplateFile(null);
      setTemplatePreview(null);
      setSelectedDivisi([]);
      setDownloadProgress(prev => ({ ...prev, show: false }));
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <QrCode className="mr-3 text-purple-600" size={28} />
              Download QR dengan Template + Anti-Crop Text (Fixed QR + No Text Cutting)
              <span className="ml-3 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                📍 QR Fixed 75%
              </span>
              <span className="ml-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                🛡️ Anti-Crop Text
              </span>
            </h2>
            <button
              onClick={handleClose}
              disabled={downloadProgress.show && !downloadProgress.downloadCompleted}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>
          <p className="text-gray-600 mt-2">
            Upload template, atur anti-crop text overlay nama peserta. QR Code fixed pada posisi center dengan scale 75% dan Y offset 550px. 
            Text tidak akan terpotong termasuk huruf y, g, p, q, j.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Template Upload Section */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Upload className="mr-2 text-blue-600" size={20} />
              Upload Template (PNG, JPG, JPEG) - Max 15MB
            </h3>
            
            <input
              id="templateFileModal"
              type="file"
              accept="image/*"
              onChange={handleTemplateChange}
              disabled={downloadProgress.show}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 border border-gray-300 rounded-lg disabled:opacity-50"
            />
            
            {templateFile && (
              <div className="mt-4 flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center">
                  <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      {templateFile.name}
                    </p>
                    <p className="text-xs text-green-600">
                      {(templateFile.size / 1024 / 1024).toFixed(2)} MB - {templateDimensions.width}×{templateDimensions.height}px
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearTemplate}
                  disabled={downloadProgress.show}
                  className="text-red-600 hover:text-red-800 p-2 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Enhanced Template Requirements */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <Info className="w-4 h-4 mr-2" />
                Template Requirements (Fixed QR + Anti-Crop Mode)
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
                <ul className="space-y-1">
                  <li>• Format: PNG, JPG, JPEG</li>
                  <li>• Ukuran: 10KB - 15MB</li>
                  <li>• QR: Fixed center position (75% scale, Y:550px)</li>
                  <li>• Text positioning: Custom dengan anti-crop</li>
                </ul>
                <ul className="space-y-1">
                  <li>• Rasio: Portrait 9:16 direkomendasikan</li>
                  <li>• Resolusi minimal: 720x1280px</li>
                  <li>• Nama peserta tidak akan terpotong (y,g,p,q,j)</li>
                  <li>• Canvas auto-expansion untuk text ekstrem</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Template Preview */}
          {templatePreview && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Preview Template:</h3>
              <div className="flex justify-center">
                <div className="relative">
                  <img
                    src={templatePreview}
                    alt="Template Preview"
                    width={200}
                    height={300}
                    className="border border-gray-300 rounded-lg shadow-lg"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 text-center mt-3">
                QR akan ditempatkan pada posisi <strong>center fixed</strong> dengan ukuran <strong>75%</strong> dan Y offset <strong>550px</strong>
                {templateSettings.textOverlay.enabled && (
                  <span>, Nama peserta pada X:{templateSettings.textOverlay.offsetX}, Y:<strong>{templateSettings.textOverlay.offsetY}px</strong> (Anti-Crop Mode - huruf y,g,p,q,j tidak terpotong)</span>
                )}
              </p>
            </div>
          )}

          {/* FIXED QR Position Info */}
          {templateFile && (
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <QrCode className="mr-2 text-blue-600" size={20} />
                QR Code Settings (Fixed Position)
                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  Non-Configurable
                </span>
              </h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <p className="font-medium text-blue-800 mb-1">Position</p>
                  <p className="text-blue-600">Center (Fixed)</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <p className="font-medium text-blue-800 mb-1">Scale</p>
                  <p className="text-blue-600">75% (Fixed)</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <p className="font-medium text-blue-800 mb-1">Y Offset</p>
                  <p className="text-blue-600">550px (Fixed)</p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>ℹ️ Info:</strong> QR Code position dan scale telah ditetapkan secara permanen untuk konsistensi. 
                  Anda hanya perlu mengatur anti-crop text overlay nama peserta di bawah.
                </p>
              </div>
            </div>
          )}

          {/* ENHANCED: Anti-Crop Text Overlay Controller */}
          {templateFile && (
            <TextOverlayControllerAntiCrop
              textOverlay={templateSettings.textOverlay}
              onTextOverlayChange={(textOverlay) => setTemplateSettings(prev => ({ ...prev, textOverlay }))}
              disabled={downloadProgress.show}
              templateWidth={templateDimensions.width}
              templateHeight={templateDimensions.height}
            />
          )}

          {/* Divisi Selection */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Award className="mr-2 text-purple-600" size={20} />
              Pilih Divisi untuk Anti-Crop Template Processing (Max {MAX_DIVISI_TEMPLATE})
            </h3>
            
            <DivisiSelector
              availableDivisi={availableDivisi}
              selectedDivisi={selectedDivisi}
              onSelectionChange={setSelectedDivisi}
              maxSelection={MAX_DIVISI_TEMPLATE}
              disabled={!templateFile || downloadProgress.show}
            />
            
            {selectedDivisi.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      {selectedDivisi.length} divisi dipilih
                    </p>
                    <p className="text-xs text-blue-600">
                      Total QR: {totalQRForSelectedDivisi} | Estimasi: {Math.ceil(totalQRForSelectedDivisi / 4)} detik (dengan fixed QR + anti-crop text rendering)
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDivisi([])}
                    disabled={downloadProgress.show}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ENHANCED: Processing Info with Fixed QR + Anti-Cropping */}
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <h3 className="font-medium text-green-800 mb-3 flex items-center">
              <Layers className="w-5 h-5 mr-2" />
              Enhanced Anti-Crop Template Processing Features (Fixed QR + No Text Cutting)
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-green-700">
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  QR positioning: Fixed center (75% scale, Y:550px)
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Anti-crop text: Nama peserta tidak terpotong
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Descender support: y, g, p, q, j lengkap
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  🛡️ Canvas auto-expansion: Text tidak akan crop
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Font customization: Size 12px-1000px
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Extreme positioning: ±10000px range
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Multi-divisi processing: Batch download
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  📍 Konsistensi QR: Position & scale tetap
                </li>
              </ul>
            </div>
          </div>

          {/* Download Progress */}
          {downloadProgress.show && (
            <ProgressBar
              progress={downloadProgress}
              onCancel={downloadProgress.downloadCompleted ? undefined : cancelDownload}
            />
          )}

          {/* Download Section */}
          <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-purple-800 mb-2">
                  Ready untuk Download Anti-Crop Template QR?
                </h3>
                <p className="text-sm text-purple-600">
                  QR Fixed Position (Center 75% Y:550px) + Anti-crop text overlay untuk {selectedDivisi.length} divisi ({totalQRForSelectedDivisi} QR).
                  Huruf y, g, p, q, j dijamin tidak terpotong!
                </p>
              </div>
              <button
                onClick={handleDownload}
                disabled={!templateFile || selectedDivisi.length === 0 || downloadProgress.show || isLoading}
                className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {downloadProgress.show ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="mr-2" size={20} />
                    Download Anti-Crop Template QR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadQRTemplate;