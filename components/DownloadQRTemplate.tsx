/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { 
  X, Upload, CheckCircle, XCircle, QrCode, Info, Clock, 
  Zap, Award, TrendingUp, Settings, CheckSquare, Square, 
  ChevronDown, ChevronUp, Download, AlertTriangle, 
  FileImage, Activity, Loader, RotateCcw, Move, Maximize2,
  Type, Palette, AlignCenter, Eye, Layers, Cpu, Sparkles,
  Monitor, Gauge, MemoryStick, HardDrive
} from 'lucide-react';

// Enhanced interfaces with Sharp support
interface PesertaData {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code?: string;
  created_at: string;
}

// Fixed QR Position - no configuration needed
interface QRPosition {
  preset: 'center';
  offsetX: number;
  offsetY: number;
  scale: number;
}

// Enhanced Sharp Text Overlay interface
interface SharpTextOverlay {
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
  // Sharp-specific enhancements
  autoExpandCanvas: boolean;
  minCanvasExpansion: number;
  maxTextWidth?: number;
  lineHeight: number;
  descendersSupport: boolean;
  extraSafetyMargin: number;
  sharpTextOptions: {
    antialias: boolean;
    kerning: boolean;
    hinting: 'none' | 'slight' | 'medium' | 'full';
    quality: number;
    dpi: number;
  };
}

// Enhanced Canvas expansion with Sharp optimization
interface SharpCanvasExpansion {
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
  sharpOptimized: boolean;
  memoryEstimate: number;
  processingComplexity: 'low' | 'medium' | 'high' | 'extreme';
}

interface SharpTemplateSettings {
  qrPosition: QRPosition;
  textOverlay: SharpTextOverlay;
  canvasExpansion: {
    enabled: boolean;
    autoCalculate: boolean;
    minExpansion: number;
    maxExpansion: number;
  };
  sharpProcessing: {
    enabled: boolean;
    concurrency: number;
    memoryLimit: number;
    pixelLimit: number;
    qualityMode: 'fast' | 'balanced' | 'quality';
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
  sharpProcessed: number;
  fallbackProcessed: number;
  memoryUsage?: number;
  processingMode: 'sharp' | 'fallback' | 'mixed';
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
  onDownload: (templateFile: File, selectedDivisi: string[], templateSettings: SharpTemplateSettings) => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  isLoading: boolean;
}

// Sharp-based text measurement utility
const measureTextWithSharp = (
  text: string, 
  fontSize: number, 
  fontFamily: string, 
  fontWeight: string,
  maxWidth?: number
): { 
  width: number; 
  height: number; 
  lines: string[]; 
  ascent: number; 
  descent: number; 
  safeHeight: number; 
  actualHeight: number;
  sharpOptimized: boolean;
} => {
  // Enhanced character width calculation based on font family for Sharp processing
  const fontMultipliers: { [key: string]: number } = {
    "Arial": 0.55,
    "Helvetica": 0.55,
    "Times New Roman": 0.5,
    "Courier New": 0.6, // Monospace
    "Verdana": 0.65,
    "Georgia": 0.52,
    "Trebuchet MS": 0.58,
    "Impact": 0.48
  };
  
  const charWidthMultiplier = fontMultipliers[fontFamily] || 0.55;
  const avgCharWidth = fontSize * charWidthMultiplier;
  
  // Enhanced ascent and descent calculation optimized for Sharp
  const ascent = fontSize * 0.8;
  const descent = fontSize * 0.25; // For descenders y, g, p, q, j
  
  if (!maxWidth) {
    const actualHeight = ascent + descent;
    const safeHeight = actualHeight + fontSize * 0.4; // Sharp-optimized padding
    
    return {
      width: Math.ceil(text.length * avgCharWidth),
      height: Math.ceil(safeHeight),
      lines: [text],
      ascent,
      descent,
      safeHeight,
      actualHeight,
      sharpOptimized: true
    };
  }

  // Text wrapping optimized for Sharp processing
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  let maxLineWidth = 0;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const lineWidth = testLine.length * avgCharWidth;
    
    if (lineWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      maxLineWidth = Math.max(maxLineWidth, currentLine.length * avgCharWidth);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
    maxLineWidth = Math.max(maxLineWidth, currentLine.length * avgCharWidth);
  }

  // Multi-line height calculation optimized for Sharp
  const lineSpacing = fontSize * 0.2;
  const actualHeight = lines.length * (ascent + descent) + (lines.length - 1) * lineSpacing;
  const safeHeight = actualHeight + fontSize * 0.5; // Sharp-optimized multi-line padding
  
  return {
    width: Math.ceil(maxLineWidth),
    height: Math.ceil(safeHeight),
    lines,
    ascent,
    descent,
    safeHeight,
    actualHeight,
    sharpOptimized: true
  };
};

// Sharp canvas expansion calculator with memory estimation
const calculateSharpCanvasExpansion = (
  templateWidth: number,
  templateHeight: number,
  textOverlay: SharpTextOverlay,
  sampleText: string = "Sample Participant Name with ygpqj"
): SharpCanvasExpansion => {
  if (!textOverlay.enabled) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      newWidth: templateWidth,
      newHeight: templateHeight,
      textBounds: { x: 0, y: 0, width: 0, height: 0 },
      sharpOptimized: false,
      memoryEstimate: 0,
      processingComplexity: 'low'
    };
  }

  // Sharp-optimized text dimension measurement
  const textDimensions = measureTextWithSharp(
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

  // Sharp-optimized padding calculation
  const basePadding = textOverlay.padding;
  const fontSizeMultiplier = Math.max(1.2, textOverlay.fontSize / 150); // Sharp-optimized multiplier
  const adjustedPadding = basePadding * fontSizeMultiplier;
  
  // Enhanced descender safety for Sharp
  const descenderSafety = textDimensions.descent + textOverlay.fontSize * 0.25 + textOverlay.extraSafetyMargin;
  const ascenderSafety = textDimensions.ascent + textOverlay.fontSize * 0.1;
  
  const textBounds = {
    x: textX - adjustedPadding,
    y: textY - adjustedPadding - ascenderSafety,
    width: textDimensions.width + (adjustedPadding * 2),
    height: textDimensions.safeHeight + (adjustedPadding * 2) + descenderSafety + ascenderSafety
  };

  // Sharp-optimized expansion calculation
  const baseExpansion = textOverlay.minCanvasExpansion;
  const sharpMargin = Math.max(50, textOverlay.fontSize * 0.6); // Sharp-optimized margin
  
  const expansionLeft = Math.max(0, -textBounds.x + baseExpansion + sharpMargin);
  const expansionTop = Math.max(0, -textBounds.y + baseExpansion + sharpMargin);
  const expansionRight = Math.max(0, (textBounds.x + textBounds.width) - templateWidth + baseExpansion + sharpMargin);
  const expansionBottom = Math.max(0, (textBounds.y + textBounds.height) - templateHeight + baseExpansion + sharpMargin);

  const newWidth = templateWidth + expansionLeft + expansionRight;
  const newHeight = templateHeight + expansionTop + expansionBottom;

  // Memory estimate for Sharp processing
  const pixelCount = newWidth * newHeight;
  const memoryEstimate = pixelCount * 4; // 4 bytes per pixel (RGBA)

  // Determine processing complexity
  let processingComplexity: 'low' | 'medium' | 'high' | 'extreme' = 'low';
  if (memoryEstimate > 100 * 1024 * 1024) processingComplexity = 'extreme'; // > 100MB
  else if (memoryEstimate > 50 * 1024 * 1024) processingComplexity = 'high'; // > 50MB
  else if (memoryEstimate > 20 * 1024 * 1024) processingComplexity = 'medium'; // > 20MB

  return {
    top: expansionTop,
    right: expansionRight,
    bottom: expansionBottom,
    left: expansionLeft,
    newWidth,
    newHeight,
    textBounds,
    sharpOptimized: true,
    memoryEstimate,
    processingComplexity
  };
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

const SharpProgressBar: React.FC<{
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

  const formatMemory = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-blue-800 flex items-center">
          <Cpu className="mr-2 animate-pulse text-blue-600" size={20} />
          Sharp Processing Template QR + Enhanced Text
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
              className="bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center text-gray-700">
            <Activity className="w-4 h-4 mr-2 text-blue-500" />
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
            <Clock className="w-4 h-4 mr-2 text-gray-500" />
            <span className="font-medium">Waktu berlalu:</span>
            <span className="ml-2">{formatTime(elapsed)}</span>
          </div>
          
          {remaining > 1000 && (
            <div className="flex items-center text-gray-700">
              <TrendingUp className="w-4 h-4 mr-2 text-gray-500" />
              <span className="font-medium">Estimasi sisa:</span>
              <span className="ml-2">{formatTime(remaining)}</span>
            </div>
          )}
        </div>

        {/* Sharp Processing Stats */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="flex items-center text-green-800 text-sm">
              <Sparkles className="w-4 h-4 mr-2" />
              <span className="font-medium">Sharp Processed:</span>
              <span className="ml-2 font-bold">{progress.sharpProcessed}</span>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <div className="flex items-center text-yellow-800 text-sm">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="font-medium">Fallback:</span>
              <span className="ml-2 font-bold">{progress.fallbackProcessed}</span>
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        {progress.memoryUsage && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="flex items-center text-blue-800 text-sm">
              <MemoryStick className="w-4 h-4 mr-2" />
              <span className="font-medium">Memory Usage:</span>
              <span className="ml-2">{formatMemory(progress.memoryUsage)}</span>
              <span className="ml-2 text-blue-600">({progress.processingMode} mode)</span>
            </div>
          </div>
        )}

        {/* Sharp Processing Info */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center text-blue-800 text-sm">
            <Type className="w-4 h-4 mr-2" />
            <span className="font-medium">Sharp Enhanced:</span>
            <span className="ml-2">High-quality text rendering dengan anti-aliasing, kerning, dan descender protection</span>
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
              <span className="text-gray-500">Pilih divisi untuk Sharp template processing (max {maxSelection})</span>
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
      
      {/* Backdrop */}
      {showDropdown && !disabled && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </>
  );
};

// Enhanced Sharp Text Overlay Controller Component
const SharpTextOverlayController: React.FC<{
  textOverlay: SharpTextOverlay;
  onTextOverlayChange: (textOverlay: SharpTextOverlay) => void;
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
    { value: 'Courier New', label: 'Courier New (Monospace)' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Trebuchet MS', label: 'Trebuchet MS' },
    { value: 'Impact', label: 'Impact' }
  ];

  // Calculate Sharp canvas expansion preview
  const canvasExpansion = useMemo(() => {
    return calculateSharpCanvasExpansion(
      templateWidth, 
      templateHeight, 
      textOverlay, 
      "Sample Participant Name with ygpqj"
    );
  }, [templateWidth, templateHeight, textOverlay]);

  const needsExpansion = canvasExpansion.sharpOptimized && 
    (canvasExpansion.newWidth > templateWidth || canvasExpansion.newHeight > templateHeight);

  const handleToggleEnabled = () => {
    onTextOverlayChange({
      ...textOverlay,
      enabled: !textOverlay.enabled
    });
  };

  const handlePropertyChange = (property: keyof SharpTextOverlay, value: any) => {
    onTextOverlayChange({
      ...textOverlay,
      [property]: value
    });
  };

  const handleSharpOptionChange = (property: keyof SharpTextOverlay['sharpTextOptions'], value: any) => {
    onTextOverlayChange({
      ...textOverlay,
      sharpTextOptions: {
        ...textOverlay.sharpTextOptions,
        [property]: value
      }
    });
  };

  const resetToSharpDefaults = () => {
    onTextOverlayChange({
      enabled: true,
      preset: 'bottom',
      offsetX: templateWidth / 2,
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
      extraSafetyMargin: 20,
      sharpTextOptions: {
        antialias: true,
        kerning: true,
        hinting: 'full',
        quality: 95,
        dpi: 300
      }
    });
  };

  const formatMemory = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'text-green-700 bg-green-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'high': return 'text-orange-700 bg-orange-100';
      case 'extreme': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Sparkles className="mr-2 text-blue-600" size={20} />
          Sharp-Enhanced Text Overlay Settings
          {needsExpansion && (
            <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
              Canvas Will Expand
            </span>
          )}
          {textOverlay.sharpTextOptions.antialias && (
            <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
              Sharp Optimized
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToSharpDefaults}
            disabled={disabled}
            className="flex items-center px-3 py-1 text-sm bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 disabled:opacity-50 transition-colors"
          >
            <Cpu className="mr-1" size={14} />
            Sharp Defaults
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

      {/* Sharp Canvas expansion info */}
      {textOverlay.enabled && needsExpansion && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <Cpu className="w-4 h-4 mr-2" />
                Sharp Canvas Auto-Expansion Detected
              </h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>Original:</strong> {templateWidth} × {templateHeight}px</p>
                <p><strong>New Size:</strong> {canvasExpansion.newWidth} × {canvasExpansion.newHeight}px</p>
                <p><strong>Expansion:</strong> Top:{canvasExpansion.top}px, Right:{canvasExpansion.right}px, Bottom:{canvasExpansion.bottom}px, Left:{canvasExpansion.left}px</p>
                <p><strong>Memory Estimate:</strong> {formatMemory(canvasExpansion.memoryEstimate)}</p>
                <p className="flex items-center">
                  <strong>Complexity:</strong>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getComplexityColor(canvasExpansion.processingComplexity)}`}>
                    {canvasExpansion.processingComplexity.toUpperCase()}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {textOverlay.enabled && (
        <div className="space-y-6">
          {/* Sharp Processing Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Cpu className="w-4 h-4 mr-2" />
              Sharp Processing Options
            </label>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="antialias"
                  checked={textOverlay.sharpTextOptions.antialias}
                  onChange={(e) => handleSharpOptionChange('antialias', e.target.checked)}
                  disabled={disabled}
                  className="mr-2"
                />
                <label htmlFor="antialias" className="text-sm text-gray-700">
                  Anti-aliasing (smoother edges)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="kerning"
                  checked={textOverlay.sharpTextOptions.kerning}
                  onChange={(e) => handleSharpOptionChange('kerning', e.target.checked)}
                  disabled={disabled}
                  className="mr-2"
                />
                <label htmlFor="kerning" className="text-sm text-gray-700">
                  Kerning (letter spacing)
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Hinting Quality: {textOverlay.sharpTextOptions.hinting}
                </label>
                <select
                  value={textOverlay.sharpTextOptions.hinting}
                  onChange={(e) => handleSharpOptionChange('hinting', e.target.value)}
                  disabled={disabled}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="none">None</option>
                  <option value="slight">Slight</option>
                  <option value="medium">Medium</option>
                  <option value="full">Full (Best Quality)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Quality: {textOverlay.sharpTextOptions.quality}%
                </label>
                <input
                  type="range"
                  min="60"
                  max="100"
                  step="5"
                  value={textOverlay.sharpTextOptions.quality}
                  onChange={(e) => handleSharpOptionChange('quality', parseInt(e.target.value))}
                  disabled={disabled}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>60%</span>
                  <span>80%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Anti-Crop settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Type className="w-4 h-4 mr-2" />
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
                  onClick={() => {
                    let defaultOffsets = { offsetX: 0, offsetY: 750 };
                    
                    switch (option.value) {
                      case 'top':
                        defaultOffsets = { offsetX: templateWidth / 2, offsetY: 100 };
                        break;
                      case 'bottom':
                        defaultOffsets = { offsetX: templateWidth / 2, offsetY: 750 };
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

                    handlePropertyChange('preset', option.value);
                    handlePropertyChange('offsetX', defaultOffsets.offsetX);
                    handlePropertyChange('offsetY', defaultOffsets.offsetY);
                  }}
                  disabled={disabled}
                  className={`p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    textOverlay.preset === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-25'
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
                Font Family (Sharp Optimized)
              </label>
              <select
                value={textOverlay.fontFamily}
                onChange={(e) => handlePropertyChange('fontFamily', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                Font Size: {textOverlay.fontSize}px (Sharp Range: 12px - 1000px)
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Quick Size Slider (12px - 200px)</label>
                  <input
                    type="range"
                    min="12"
                    max="200"
                    step="2"
                    value={Math.min(textOverlay.fontSize, 200)}
                    onChange={(e) => handlePropertyChange('fontSize', parseInt(e.target.value))}
                    disabled={disabled}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Custom Size Input (12px - 1000px)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="12"
                      max="1000"
                      step="1"
                      value={textOverlay.fontSize}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value)) {
                          const clampedValue = Math.max(12, Math.min(1000, value));
                          handlePropertyChange('fontSize', clampedValue);
                        }
                      }}
                      disabled={disabled}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      placeholder="Font size in pixels"
                    />
                    <span className="text-sm text-gray-500 font-medium">px</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {[24, 48, 72, 100, 150, 200, 300, 500, 750, 1000].map(size => (
                    <button
                      key={size}
                      onClick={() => handlePropertyChange('fontSize', size)}
                      disabled={disabled}
                      className={`px-3 py-1 text-xs rounded transition-colors disabled:opacity-50 ${
                        textOverlay.fontSize === size
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                max="50"
                step="2"
                value={textOverlay.padding}
                onChange={(e) => handlePropertyChange('padding', parseInt(e.target.value))}
                disabled={disabled}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>

          {/* Custom Position (if custom preset selected) */}
          {textOverlay.preset === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Custom Text Position (pixels) - Sharp Range: -10000px to +10000px
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
                      onChange={(e) => handlePropertyChange('offsetX', parseInt(e.target.value))}
                      disabled={disabled}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                    <input
                      type="number"
                      min="-10000"
                      max="10000"
                      step="10"
                      value={textOverlay.offsetX}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value)) {
                          const clampedValue = Math.max(-10000, Math.min(10000, value));
                          handlePropertyChange('offsetX', clampedValue);
                        }
                      }}
                      disabled={disabled}
                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">px</span>
                  </div>
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
                      onChange={(e) => handlePropertyChange('offsetY', parseInt(e.target.value))}
                      disabled={disabled}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                    <input
                      type="number"
                      min="-10000"
                      max="10000"
                      step="10"
                      value={textOverlay.offsetY}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value)) {
                          const clampedValue = Math.max(-10000, Math.min(10000, value));
                          handlePropertyChange('offsetY', clampedValue);
                        }
                      }}
                      disabled={disabled}
                      className="w-24 px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500">px</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sharp Text Overlay Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2 flex items-center">
              <Sparkles className="w-4 h-4 mr-2" />
              Sharp Text Overlay Summary
            </h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <p><strong>Position:</strong> {presetOptions.find(p => p.value === textOverlay.preset)?.label}</p>
                <p><strong>Font:</strong> {textOverlay.fontFamily} {textOverlay.fontSize}px {textOverlay.fontWeight}</p>
                <p><strong>Sharp Quality:</strong> {textOverlay.sharpTextOptions.quality}% with {textOverlay.sharpTextOptions.hinting} hinting</p>
                <p><strong>Anti-Crop:</strong> {textOverlay.descendersSupport ? 'Enabled (y,g,p,q,j safe)' : 'Disabled'}</p>
              </div>
              <div>
                <p><strong>Colors:</strong> {textOverlay.fontColor} on {textOverlay.backgroundColor}</p>
                <p><strong>Position:</strong> X:{textOverlay.offsetX}px, Y:{textOverlay.offsetY}px</p>
                <p><strong>Canvas:</strong> {needsExpansion ? `Will expand to ${canvasExpansion.newWidth}×${canvasExpansion.newHeight}px` : 'Original size maintained'}</p>
                <p><strong>Processing:</strong> {canvasExpansion.processingComplexity} complexity ({formatMemory(canvasExpansion.memoryEstimate)})</p>
              </div>
            </div>
            {(Math.abs(textOverlay.offsetX) > 5000 || Math.abs(textOverlay.offsetY) > 5000 || textOverlay.fontSize > 200) && (
              <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800">
                <strong>⚡ Sharp Enhanced:</strong> High-quality text rendering dengan anti-aliasing, kerning, dan full hinting support. 
                Canvas auto-expansion dijamin tidak akan crop text termasuk descender letters!
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
  
  // Enhanced Settings with Sharp support
  const [templateSettings, setTemplateSettings] = useState<SharpTemplateSettings>({
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
      autoExpandCanvas: true,
      minCanvasExpansion: 50,
      lineHeight: 1.2,
      descendersSupport: true,
      extraSafetyMargin: 20,
      sharpTextOptions: {
        antialias: true,
        kerning: true,
        hinting: 'full',
        quality: 95,
        dpi: 300
      }
    },
    canvasExpansion: {
      enabled: true,
      autoCalculate: true,
      minExpansion: 50,
      maxExpansion: 10000
    },
    sharpProcessing: {
      enabled: true,
      concurrency: 2,
      memoryLimit: 512 * 1024 * 1024, // 512MB
      pixelLimit: 100000000, // 100MP
      qualityMode: 'quality'
    }
  });
  
  // Progress state with Sharp tracking
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    show: false,
    current: 0,
    total: 0,
    stage: '',
    percentage: 0,
    startTime: 0,
    downloadStarted: false,
    downloadCompleted: false,
    sharpProcessed: 0,
    fallbackProcessed: 0,
    processingMode: 'sharp'
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
  
  // Enhanced template file handling with Sharp optimization
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
          message: `${selectedFile.name} (${img.width}×${img.height}px) siap untuk Sharp processing`
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
    
    // Reset to default settings with FIXED QR position + Sharp enhancements
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
        extraSafetyMargin: 20,
        sharpTextOptions: {
          antialias: true,
          kerning: true,
          hinting: 'full',
          quality: 95,
          dpi: 300
        }
      },
      canvasExpansion: {
        enabled: true,
        autoCalculate: true,
        minExpansion: 50,
        maxExpansion: 10000
      },
      sharpProcessing: {
        enabled: true,
        concurrency: 2,
        memoryLimit: 512 * 1024 * 1024,
        pixelLimit: 100000000,
        qualityMode: 'quality'
      }
    });
    
    const fileInput = document.getElementById('templateFileModal') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
    addToast({
      type: 'info',
      title: 'Template Dihapus',
      message: 'Template dan pengaturan Sharp telah direset (QR tetap fixed 75% scale, Y:550px)'
    });
  }, [addToast]);

  // Enhanced download handler with Sharp processing info
  const handleDownload = useCallback(async () => {
    if (!templateFile) {
      addToast({
        type: 'warning',
        title: 'Template Belum Dipilih',
        message: 'Upload template terlebih dahulu untuk Sharp processing'
      });
      return;
    }

    if (selectedDivisi.length === 0) {
      addToast({
        type: 'warning',
        title: 'Divisi Belum Dipilih',
        message: 'Pilih minimal 1 divisi untuk Sharp template processing'
      });
      return;
    }

    // Calculate Sharp canvas expansion for confirmation
    const canvasExpansion = calculateSharpCanvasExpansion(
      templateDimensions.width,
      templateDimensions.height,
      templateSettings.textOverlay,
      "Sample Participant Name with ygpqj"
    );

    const needsExpansion = canvasExpansion.sharpOptimized && 
      (canvasExpansion.newWidth > templateDimensions.width || canvasExpansion.newHeight > templateDimensions.height);

    // Enhanced confirmation with Sharp processing info
    const estimatedTime = Math.ceil(totalQRForSelectedDivisi / 3); // Slower due to Sharp processing
    const estimatedSize = Math.ceil(totalQRForSelectedDivisi * 0.6); // Larger due to quality
    
    // FIXED QR info
    const qrInfo = `Fixed QR: Center position (Y:550px, 75% scale)`;
      
    const textInfo = templateSettings.textOverlay.enabled 
      ? `Sharp Text at X:${templateSettings.textOverlay.offsetX}, Y:${templateSettings.textOverlay.offsetY}px (${templateSettings.textOverlay.fontSize}px ${templateSettings.textOverlay.fontFamily}, ${templateSettings.textOverlay.sharpTextOptions.quality}% quality)`
      : 'No text overlay';

    const canvasInfo = needsExpansion 
      ? `Canvas expansion: ${templateDimensions.width}×${templateDimensions.height} → ${canvasExpansion.newWidth}×${canvasExpansion.newHeight}px`
      : `Canvas: ${templateDimensions.width}×${templateDimensions.height}px (no expansion needed)`;

    const sharpInfo = `Sharp Processing: ${templateSettings.textOverlay.sharpTextOptions.antialias ? 'Anti-aliasing' : 'No AA'}, ${templateSettings.textOverlay.sharpTextOptions.hinting} hinting, ${templateSettings.textOverlay.sharpTextOptions.quality}% quality`;
    
    const proceed = confirm(
      `Download ${totalQRForSelectedDivisi} QR dengan Sharp template processing untuk ${selectedDivisi.length} divisi:\n\n` +
      `📁 Divisi: ${selectedDivisi.slice(0, 3).join(', ')}${selectedDivisi.length > 3 ? ' dan lainnya...' : ''}\n` +
      `📍 ${qrInfo}\n` +
      `📝 Text: ${textInfo}\n` +
      `🖼️ ${canvasInfo}\n` +
      `⚡ ${sharpInfo}\n` +
      `🔄 Processing: ${canvasExpansion.processingComplexity} complexity\n` +
      `💾 Memory: ~${(canvasExpansion.memoryEstimate / 1024 / 1024).toFixed(1)}MB per image\n` +
      `⏱️ Estimasi waktu: ${estimatedTime} detik\n` +
      `📦 Estimasi ukuran: ~${estimatedSize} MB\n\n` +
      `Lanjutkan dengan Sharp processing?`
    );
    
    if (!proceed) return;

    // Initialize progress with Sharp tracking
    setDownloadProgress({
      show: true,
      current: 0,
      total: totalQRForSelectedDivisi,
      stage: 'Memulai Sharp template processing dengan enhanced text rendering...',
      percentage: 0,
      startTime: Date.now(),
      downloadStarted: false,
      downloadCompleted: false,
      sharpProcessed: 0,
      fallbackProcessed: 0,
      processingMode: 'sharp',
      memoryUsage: canvasExpansion.memoryEstimate
    });

    try {
      abortControllerRef.current = new AbortController();
      
      // Update progress
      setDownloadProgress(prev => ({
        ...prev,
        stage: 'Mengirim template dan konfigurasi Sharp ke server...',
        percentage: 5
      }));
      
      // Call the onDownload callback with Sharp template settings
      await onDownload(templateFile, selectedDivisi, templateSettings);
      
      // Complete progress
      setDownloadProgress(prev => ({
        ...prev,
        percentage: 100,
        stage: 'Sharp processing selesai! High-quality text rendering dengan anti-aliasing completed.',
        downloadCompleted: true
      }));
      
    } catch (error: any) {
      setDownloadProgress(prev => ({ ...prev, show: false }));
      
      if (error.name === 'AbortError') {
        addToast({
          type: 'error',
          title: 'Download Dibatalkan',
          message: 'Sharp processing dibatalkan oleh user'
        });
      } else {
        addToast({
          type: 'error',
          title: 'Sharp Template Processing Gagal',
          message: error.message || 'Error saat Sharp processing template'
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
      message: 'Sharp template processing telah dibatalkan'
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
              <Sparkles className="mr-3 text-purple-600" size={28} />
              Sharp QR Template Processing + Enhanced Text Rendering
            </h2>
            <button
              onClick={handleClose}
              disabled={downloadProgress.show && !downloadProgress.downloadCompleted}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Template Upload Section */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Upload className="mr-2 text-blue-600" size={20} />
              Upload Template untuk Sharp Processing (PNG, JPG, JPEG) - Max 15MB
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

            {/* Enhanced Template Requirements for Sharp */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                <Cpu className="w-4 h-4 mr-2" />
                Sharp Template Requirements (Fixed QR + Enhanced Text)
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
                <ul className="space-y-1">
                  <li>• Format: PNG, JPG, JPEG (optimized for Sharp)</li>
                  <li>• Ukuran: 10KB - 15MB</li>
                  <li>• QR: Fixed center position (75% scale, Y:550px)</li>
                  <li>• Text: Sharp-enhanced rendering dengan anti-aliasing</li>
                </ul>
                <ul className="space-y-1">
                  <li>• Rasio: Portrait 9:16 direkomendasikan</li>
                  <li>• Resolusi minimal: 720x1280px</li>
                  <li>• Quality: High-res output dengan kerning support</li>
                  <li>• Canvas: Auto-expansion untuk positioning ekstrem</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Template Preview */}
          {templatePreview && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Eye className="mr-2 text-purple-600" size={20} />
                Sharp Template Preview:
              </h3>
              <div className="flex justify-center">
                <div className="relative">
                  <img
                    src={templatePreview}
                    alt="Sharp Template Preview"
                    width={200}
                    height={300}
                    className="border border-gray-300 rounded-lg shadow-lg"
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 text-center mt-3">
                QR akan ditempatkan pada posisi <strong>center fixed</strong> dengan ukuran <strong>75%</strong> dan Y offset <strong>550px</strong>
                {templateSettings.textOverlay.enabled && (
                  <span>, Nama peserta akan di-render dengan <strong>Sharp high-quality</strong> pada X:{templateSettings.textOverlay.offsetX}, Y:<strong>{templateSettings.textOverlay.offsetY}px</strong> dengan anti-aliasing dan kerning</span>
                )}
              </p>
            </div>
          )}

          {/* FIXED QR Position Info with Sharp enhancement */}
          {templateFile && (
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <QrCode className="mr-2 text-blue-600" size={20} />
                QR Code Settings (Fixed Position - Sharp Optimized)
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
                  <strong>⚡ Sharp Enhancement:</strong> QR position tetap fixed untuk konsistensi, 
                  namun kualitas rendering ditingkatkan dengan Sharp processing untuk hasil yang lebih crisp dan professional.
                </p>
              </div>
            </div>
          )}

          {/* Enhanced Sharp Text Overlay Controller */}
          {templateFile && (
            <SharpTextOverlayController
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
              Pilih Divisi untuk Sharp Template Processing (Max {MAX_DIVISI_TEMPLATE})
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
                      {selectedDivisi.length} divisi dipilih untuk Sharp processing
                    </p>
                    <p className="text-xs text-blue-600">
                      Total QR: {totalQRForSelectedDivisi} | Estimasi: {Math.ceil(totalQRForSelectedDivisi / 3)} detik (Sharp high-quality rendering)
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

          {/* Enhanced Sharp Processing Info */}
          <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
            <h3 className="font-medium text-green-800 mb-3 flex items-center">
              <Sparkles className="w-5 h-5 mr-2" />
              Sharp Enhanced Template Processing Features
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-green-700">
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  QR positioning: Fixed center (75% scale, Y:550px)
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Sharp text rendering: High-quality anti-aliasing
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Kerning support: Professional letter spacing
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  ⚡ Full hinting: Crisp text edges
                </li>
              </ul>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Quality control: 60%-100% adjustable
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Descender protection: y, g, p, q, j safe
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Memory optimization: Efficient processing
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  🔥 Canvas expansion: Unlimited positioning
                </li>
              </ul>
            </div>
          </div>

          {/* Download Progress */}
          {downloadProgress.show && (
            <SharpProgressBar
              progress={downloadProgress}
              onCancel={downloadProgress.downloadCompleted ? undefined : cancelDownload}
            />
          )}

          {/* Enhanced Download Section */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center">
                  <Cpu className="mr-2" size={20} />
                  Ready untuk Sharp Template QR Processing?
                </h3>
                <p className="text-sm text-purple-600">
                  QR Fixed Position (Center 75% Y:550px) + Sharp enhanced text rendering untuk {selectedDivisi.length} divisi ({totalQRForSelectedDivisi} QR).
                  High-quality output dengan anti-aliasing, kerning, dan full hinting support!
                </p>
              </div>
              <button
                onClick={handleDownload}
                disabled={!templateFile || selectedDivisi.length === 0 || downloadProgress.show || isLoading}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg"
              >
                {downloadProgress.show ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Sharp Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2" size={20} />
                    Download Sharp Template QR
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