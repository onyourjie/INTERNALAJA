/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, RowDataPacket } from "@/lib/db";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import sharp from "sharp";

interface PesertaQR extends RowDataPacket {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code?: string;
  created_at: Date;
  updated_at: Date;
}

interface QRPosition {
  preset:
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "top-center"
    | "bottom-center"
    | "left-center"
    | "right-center"
    | "custom";
  offsetX: number;
  offsetY: number;
  scale: number;
}

// Enhanced Text Overlay Interface
interface TextOverlay {
  enabled: boolean;
  preset: "center" | "top" | "bottom" | "left" | "right" | "custom";
  offsetX: number;
  offsetY: number;
  fontSize: number;
  fontWeight: "normal" | "bold" | "bolder";
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  padding: number;
  borderRadius: number;
  textAlign: "left" | "center" | "right";
  fontFamily: string;
  strokeWidth: number;
  strokeColor: string;
  paddingBottom?: number;
}

interface TemplateSettings {
  qrPosition: QRPosition;
  textOverlay: TextOverlay;
}

interface ProcessingResult {
  divisiData: { [key: string]: { fileName: string; buffer: Buffer }[] };
  processedCount: number;
  errorCount: number;
  errors: string[];
  divisiProcessed: string[];
  textOverlayWarnings?: string[];
  debugOverlayFiles?: { fileName: string; svg?: Buffer; png?: Buffer }[];
}

// Enhanced configuration constants with extended ranges
const CONFIG = {
  BATCH_SIZE: 20, // Reduced due to text rendering overhead
  MAX_QR_LIMIT: 1500,
  MAX_DIVISI_TEMPLATE: 10,
  PROCESSING_TIMEOUT: 900000, // 15 minutes
  TEMPLATE_MAX_SIZE: 15 * 1024 * 1024, // 15MB
  QR_SETTINGS: {
    DEFAULT_SIZE: 400,
    DEFAULT_MARGIN: 2,
    ERROR_CORRECTION: "M" as const,
    COMPRESSION_LEVEL: 6,
  },
  OFFSET_LIMITS: {
    MIN: -1000,
    MAX: 1000,
  },
  SCALE_LIMITS: {
    MIN: 0.1,
    MAX: 0.8,
  },
  // EXTENDED: Text settings with massive range support
  TEXT_SETTINGS: {
    MIN_FONT_SIZE: 12,
    MAX_FONT_SIZE: 1000, // Increased from 72 to 1000px
    DEFAULT_FONT_SIZE: 24,
    SUPPORTED_FONTS: [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Courier New",
      "Verdana",
      "Georgia",
    ],
    // Extended positioning limits
    POSITION_LIMITS: {
      MIN: -10000, // Extended from -1000 to -10000px
      MAX: 10000, // Extended from 1000 to 10000px
    },
  },
} as const;

// Enhanced QR data generation with versioning
function generateQRData(peserta: PesertaQR, version: string = "2.0"): string {
  return JSON.stringify({
    v: version,
    id: peserta.unique_id,
    nama: peserta.nama_lengkap,
    nim: peserta.nim,
    divisi: peserta.divisi,
    timestamp: new Date().toISOString(),
    checksum: generateChecksum(peserta.unique_id + peserta.nim),
  });
}

function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 150)
    .toLowerCase();
}

function formatQRFilename(
  peserta: PesertaQR,
  isTemplate: boolean = false,
  index?: number
): string {
  const cleanNama = sanitizeFilename(peserta.nama_lengkap);
  const suffix = isTemplate ? "_template" : "";
  const indexSuffix = index !== undefined ? `_${index}` : "";
  return `${peserta.nim}_${cleanNama}${suffix}${indexSuffix}.png`;
}

// Enhanced QR positioning calculator
function calculateQRPosition(
  templateWidth: number,
  templateHeight: number,
  qrPosition: QRPosition,
  qrSize: number
) {
  let baseX = 0;
  let baseY = 0;

  switch (qrPosition.preset) {
    case "center":
      baseX = (templateWidth - qrSize) / 2;
      baseY = (templateHeight - qrSize) / 2;
      break;
    case "top-left":
      baseX = templateWidth * 0.1;
      baseY = templateHeight * 0.1;
      break;
    case "top-center":
      baseX = (templateWidth - qrSize) / 2;
      baseY = templateHeight * 0.1;
      break;
    case "top-right":
      baseX = templateWidth * 0.9 - qrSize;
      baseY = templateHeight * 0.1;
      break;
    case "left-center":
      baseX = templateWidth * 0.1;
      baseY = (templateHeight - qrSize) / 2;
      break;
    case "right-center":
      baseX = templateWidth * 0.9 - qrSize;
      baseY = (templateHeight - qrSize) / 2;
      break;
    case "bottom-left":
      baseX = templateWidth * 0.1;
      baseY = templateHeight * 0.9 - qrSize;
      break;
    case "bottom-center":
      baseX = (templateWidth - qrSize) / 2;
      baseY = templateHeight * 0.9 - qrSize;
      break;
    case "bottom-right":
      baseX = templateWidth * 0.9 - qrSize;
      baseY = templateHeight * 0.9 - qrSize;
      break;
    case "custom":
      baseX = (templateWidth - qrSize) / 2;
      baseY = (templateHeight - qrSize) / 2;
      break;
  }

  const finalX = Math.round(baseX + qrPosition.offsetX);
  const finalY = Math.round(baseY + qrPosition.offsetY);

  return { x: finalX, y: finalY };
}

// NEW: Text positioning calculator
function calculateTextPosition(
  templateWidth: number,
  templateHeight: number,
  textOverlay: TextOverlay,
  textWidth: number,
  textHeight: number
) {
  let baseX = 0;
  let baseY = 0;

  switch (textOverlay.preset) {
    case "center":
      baseX = (templateWidth - textWidth) / 2;
      baseY = (templateHeight - textHeight) / 2;
      break;
    case "top":
      baseX = (templateWidth - textWidth) / 2;
      baseY = templateHeight * 0.1;
      break;
    case "bottom":
      baseX = (templateWidth - textWidth) / 2;
      baseY = templateHeight * 0.9 - textHeight;
      break;
    case "left":
      baseX = templateWidth * 0.05;
      baseY = (templateHeight - textHeight) / 2;
      break;
    case "right":
      baseX = templateWidth * 0.95 - textWidth;
      baseY = (templateHeight - textHeight) / 2;
      break;
    case "custom":
      baseX = (templateWidth - textWidth) / 2;
      baseY = (templateHeight - textHeight) / 2;
      break;
  }

  const finalX = Math.round(baseX + textOverlay.offsetX);
  const finalY = Math.round(baseY + textOverlay.offsetY);

  return { x: finalX, y: finalY };
}

// Enhanced validation functions with extended ranges
function validateTemplateSettings(templateSettings: TemplateSettings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate QR position
  const qrPosition = templateSettings.qrPosition;
  if (
    qrPosition.scale < CONFIG.SCALE_LIMITS.MIN ||
    qrPosition.scale > CONFIG.SCALE_LIMITS.MAX
  ) {
    errors.push(
      `QR scale must be between ${CONFIG.SCALE_LIMITS.MIN} and ${CONFIG.SCALE_LIMITS.MAX}`
    );
  }

  if (
    qrPosition.offsetX < CONFIG.OFFSET_LIMITS.MIN ||
    qrPosition.offsetX > CONFIG.OFFSET_LIMITS.MAX
  ) {
    errors.push(
      `QR X offset must be between ${CONFIG.OFFSET_LIMITS.MIN}px and ${CONFIG.OFFSET_LIMITS.MAX}px`
    );
  }

  if (
    qrPosition.offsetY < CONFIG.OFFSET_LIMITS.MIN ||
    qrPosition.offsetY > CONFIG.OFFSET_LIMITS.MAX
  ) {
    errors.push(
      `QR Y offset must be between ${CONFIG.OFFSET_LIMITS.MIN}px and ${CONFIG.OFFSET_LIMITS.MAX}px`
    );
  }

  // Enhanced text overlay validation with extended ranges
  if (templateSettings.textOverlay.enabled) {
    const textOverlay = templateSettings.textOverlay;

    // Extended font size validation (12px - 1000px)
    if (
      textOverlay.fontSize < CONFIG.TEXT_SETTINGS.MIN_FONT_SIZE ||
      textOverlay.fontSize > CONFIG.TEXT_SETTINGS.MAX_FONT_SIZE
    ) {
      errors.push(
        `Font size must be between ${CONFIG.TEXT_SETTINGS.MIN_FONT_SIZE}px and ${CONFIG.TEXT_SETTINGS.MAX_FONT_SIZE}px`
      );
    }

    // Extended positioning validation (±10000px)
    if (
      textOverlay.offsetX < CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MIN ||
      textOverlay.offsetX > CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MAX
    ) {
      errors.push(
        `Text X offset must be between ${CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MIN}px and ${CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MAX}px`
      );
    }

    if (
      textOverlay.offsetY < CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MIN ||
      textOverlay.offsetY > CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MAX
    ) {
      errors.push(
        `Text Y offset must be between ${CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MIN}px and ${CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MAX}px`
      );
    }

    if (
      textOverlay.backgroundOpacity < 0 ||
      textOverlay.backgroundOpacity > 1
    ) {
      errors.push("Background opacity must be between 0 and 1");
    }

    if (textOverlay.padding < 0 || textOverlay.padding > 50) {
      errors.push("Padding must be between 0 and 50 pixels");
    }

    // Validate color formats
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!(colorRegex.test(textOverlay.fontColor) || textOverlay.fontColor === 'transparent')) {
      errors.push("Invalid font color format. Use hex format (#000000) or 'transparent'");
    }

    if (!(colorRegex.test(textOverlay.backgroundColor) || textOverlay.backgroundColor === 'transparent')) {
      errors.push("Invalid background color format. Use hex format (#FFFFFF) or 'transparent'");
    }

    // Font family validation
    const supportedFonts = ["Arial", "Helvetica", "Times New Roman", "Courier New", "Verdana", "Georgia"];
    const fontFamily = supportedFonts.includes(textOverlay.fontFamily) ? textOverlay.fontFamily : "Arial";

    // Add warnings for extreme values (not errors, just logs)
    if (textOverlay.fontSize > 500) {
      console.warn(
        `Large font size detected: ${textOverlay.fontSize}px - this may cause performance issues`
      );
    }

    if (
      Math.abs(textOverlay.offsetX) > 5000 ||
      Math.abs(textOverlay.offsetY) > 5000
    ) {
      console.warn(
        `Extreme positioning detected: X:${textOverlay.offsetX}px, Y:${textOverlay.offsetY}px - canvas will be extended`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// Tambahkan fungsi utilitas untuk warna kontras
function getContrastColor(hex: string): string {
  // Ambil RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Enhanced text overlay SVG creation with support for large fonts
async function createTextOverlaySVG(
  text: string,
  textOverlay: TextOverlay,
  templateWidth: number
): Promise<Buffer> {
  let fontColor = textOverlay.fontColor;
  let backgroundColor = textOverlay.backgroundColor;
  let backgroundOpacity = textOverlay.backgroundOpacity;
  if (fontColor.toLowerCase() === backgroundColor.toLowerCase()) {
    fontColor = getContrastColor(backgroundColor);
  }
  if (backgroundColor === 'transparent' || backgroundOpacity === 0) {
    backgroundColor = 'none';
    backgroundOpacity = 0;
  }
  let fontSize = textOverlay.fontSize;
  const fontFamily = textOverlay.fontFamily;
  const fontWeight = textOverlay.fontWeight;
  const padding = textOverlay.padding;
  const borderRadius = textOverlay.borderRadius;
  const paddingBottom = typeof textOverlay.paddingBottom === 'number' ? textOverlay.paddingBottom : padding;

  // PATCH: Auto-scale font size jika text terlalu panjang
  let charWidth = fontSize * 0.6;
  let textWidth = Math.max(text.length * charWidth, 100);
  let textHeight = fontSize * 1.2;
  let scaled = false;
  let minFontSize = 12;
  let warning = '';
  while (textWidth + padding * 2 > templateWidth && fontSize > minFontSize) {
    fontSize = Math.max(minFontSize, fontSize - 2);
    charWidth = fontSize * 0.6;
    textWidth = Math.max(text.length * charWidth, 100);
    textHeight = fontSize * 1.2;
    scaled = true;
  }
  if (scaled && fontSize === minFontSize) {
    warning = 'Font terlalu kecil akibat nama terlalu panjang, hasil overlay mungkin kurang jelas.';
  } else if (scaled) {
    warning = 'Font otomatis diskalakan agar muat di template.';
  }
  if (fontSize > 200) {
    charWidth = fontSize * 0.55;
    textWidth = text.length * charWidth;
    textHeight = fontSize * 1.15;
  }
  if (fontSize > 500) {
    charWidth = fontSize * 0.5;
    textWidth = text.length * charWidth;
    textHeight = fontSize * 1.1;
  }
  textWidth = Math.max(textWidth, fontSize * 2);
  textHeight = Math.max(textHeight, fontSize);
  const paddingMultiplier = fontSize > 200 ? Math.max(1, fontSize / 200) : 1;
  const adjustedPadding = padding * paddingMultiplier;
  const adjustedPaddingBottom = paddingBottom * paddingMultiplier;
  const bgWidth = textWidth + adjustedPadding * 2;
  const bgHeight = textHeight + adjustedPadding + adjustedPaddingBottom;

  // PATCH: posisi Y text di SVG harus memperhitungkan padding bawah
  const textY = adjustedPadding + textHeight / 2 + (adjustedPaddingBottom - adjustedPadding) / 2;

  const svg = `
    <svg width="${bgWidth}" height="${bgHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect 
        x="0" y="0" 
        width="${bgWidth}" 
        height="${bgHeight}" 
        rx="${borderRadius * paddingMultiplier}" 
        ry="${borderRadius * paddingMultiplier}"
        fill="${backgroundColor}"
        fill-opacity="${backgroundOpacity}"
      />
      <text 
        x="${bgWidth / 2}" 
        y="${textY}" 
        font-family="${fontFamily}" 
        font-size="${fontSize}" 
        font-weight="${fontWeight}" 
        fill="${fontColor}" 
        text-anchor="middle" 
        dominant-baseline="middle"
        letter-spacing="${fontSize > 100 ? fontSize * 0.02 : 0}"
      >${text}</text>
    </svg>
  `;
  if (warning && (globalThis as any).textOverlayWarnings) {
    (globalThis as any).textOverlayWarnings.push(warning + ' | Peserta: ' + text);
  }
  console.log(
    `Created text overlay: "${text}" with font ${fontSize}px, dimensions ${bgWidth}x${bgHeight}`
  );
  return Buffer.from(svg);
}

// Koreksi posisi text overlay agar tidak keluar template dan tidak overlap QR code (preset center)
function clampTextOverlayBackend(
  textOverlay: TextOverlay,
  templateWidth: number,
  templateHeight: number,
  textWidth: number,
  textHeight: number,
  qrPos?: { x: number; y: number; size: number }
): { offsetX: number; offsetY: number; corrected: boolean; warning?: string } {
  let offsetX = textOverlay.offsetX;
  let offsetY = textOverlay.offsetY;
  let corrected = false;
  let warning = undefined;

  // Koreksi offsetY
  if (offsetY + textHeight > templateHeight) {
    offsetY = Math.max(0, templateHeight - textHeight);
    corrected = true;
    warning = 'Text overlay Y dikoreksi agar tidak keluar template';
  }
  if (offsetY < 0) {
    offsetY = 0;
    corrected = true;
    warning = 'Text overlay Y dikoreksi agar tidak keluar template';
  }
  // Koreksi offsetX (center align)
  if (textOverlay.textAlign === 'center') {
    if (offsetX - textWidth / 2 < 0) {
      offsetX = textWidth / 2;
      corrected = true;
      warning = 'Text overlay X dikoreksi agar tidak keluar template';
    }
    if (offsetX + textWidth / 2 > templateWidth) {
      offsetX = templateWidth - textWidth / 2;
      corrected = true;
      warning = 'Text overlay X dikoreksi agar tidak keluar template';
    }
  } else {
    if (offsetX + textWidth > templateWidth) {
      offsetX = templateWidth - textWidth;
      corrected = true;
      warning = 'Text overlay X dikoreksi agar tidak keluar template';
    }
    if (offsetX < 0) {
      offsetX = 0;
      corrected = true;
      warning = 'Text overlay X dikoreksi agar tidak keluar template';
    }
  }
  // Jika preset center dan ada QR code, pastikan tidak overlap
  if (qrPos && textOverlay.preset === 'center') {
    const textBox = {
      left: offsetX - textWidth / 2,
      right: offsetX + textWidth / 2,
      top: offsetY,
      bottom: offsetY + textHeight,
    };
    const qrBox = {
      left: qrPos.x,
      right: qrPos.x + qrPos.size,
      top: qrPos.y,
      bottom: qrPos.y + qrPos.size,
    };
    // Jika overlap secara vertikal, geser text ke atas/bawah QR
    if (
      textBox.right > qrBox.left &&
      textBox.left < qrBox.right &&
      textBox.bottom > qrBox.top &&
      textBox.top < qrBox.bottom
    ) {
      // Geser text ke atas QR jika cukup ruang, jika tidak ke bawah
      if (qrBox.top - textHeight > 0) {
        offsetY = qrBox.top - textHeight - 10;
        corrected = true;
        warning = 'Text overlay digeser agar tidak overlap QR code';
      } else if (qrBox.bottom + textHeight < templateHeight) {
        offsetY = qrBox.bottom + 10;
        corrected = true;
        warning = 'Text overlay digeser agar tidak overlap QR code';
      }
    }
  }
  return { offsetX, offsetY, corrected, warning };
}

// Enhanced template processing with text overlay
async function applyQRAndTextToTemplate(
  templateBuffer: Buffer,
  qrData: string,
  templateSettings: TemplateSettings,
  pesertaNama: string,
  qrSettings: any = {},
  retryCount: number = 0
): Promise<{ buffer: Buffer; debugSVG?: Buffer; debugPNG?: Buffer; textOverlayWarning?: string }> {
  const MAX_RETRIES = 2;

  let qrBuffer: Buffer | null = null;
  let resizedQR: Buffer | null = null;
  let textOverlayBuffer: Buffer | null = null;

  try {
    if (!templateBuffer || templateBuffer.length === 0) {
      throw new Error("Invalid template buffer");
    }

    // Generate QR code
    qrBuffer = await QRCode.toBuffer(qrData, {
      type: "png",
      width: qrSettings.qr_size || CONFIG.QR_SETTINGS.DEFAULT_SIZE,
      margin: qrSettings.margin || CONFIG.QR_SETTINGS.DEFAULT_MARGIN,
      color: {
        dark: qrSettings.dark_color || "#000000",
        light: qrSettings.light_color || "#FFFFFF",
      },
      errorCorrectionLevel:
        qrSettings.error_correction || CONFIG.QR_SETTINGS.ERROR_CORRECTION,
    });

    // Get template metadata
    let templateMetadata;
    try {
      templateMetadata = await sharp(templateBuffer).metadata();
    } catch (error) {
      throw new Error("Invalid template image format");
    }

    const templateWidth = templateMetadata.width || 720;
    const templateHeight = templateMetadata.height || 1280;

    if (templateWidth < 400 || templateHeight < 400) {
      throw new Error("Template too small (minimum 400x400px)");
    }

    // Calculate QR size and position
    const maxDimension = Math.min(templateWidth, templateHeight);
    const qrSize = Math.round(maxDimension * templateSettings.qrPosition.scale);
    const qrPos = calculateQRPosition(
      templateWidth,
      templateHeight,
      templateSettings.qrPosition,
      qrSize
    );

    // Resize QR code
    resizedQR = await sharp(qrBuffer)
      .resize(qrSize, qrSize, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
      })
      .png({
        compressionLevel: CONFIG.QR_SETTINGS.COMPRESSION_LEVEL,
        adaptiveFiltering: true,
        force: true,
      })
      .toBuffer();

    // Prepare composite options
    const compositeOptions: any[] = [
      {
        input: resizedQR,
        top: Math.round(qrPos.y),
        left: Math.round(qrPos.x),
        blend: "over",
      },
    ];

    // Add text overlay if enabled
    let textOverlayWasComposited = false;
    if (templateSettings.textOverlay.enabled) {
      let pesertaNamaFinal = pesertaNama && pesertaNama.trim() ? pesertaNama : 'NAMA TIDAK TERSEDIA';
      try {
        console.log('[DEBUG] Nama peserta untuk text overlay:', pesertaNamaFinal);
        // Create text overlay SVG
        textOverlayBuffer = await createTextOverlaySVG(
          pesertaNamaFinal,
          templateSettings.textOverlay,
          templateWidth
        );
        if (!textOverlayBuffer || textOverlayBuffer.length < 100) {
          console.warn('[WARNING] Text overlay SVG buffer kosong atau terlalu kecil!');
          if ((globalThis as any).textOverlayWarnings) {
            (globalThis as any).textOverlayWarnings.push('Text overlay SVG buffer kosong untuk peserta: ' + pesertaNamaFinal);
          }
          // Skip penempelan text overlay jika buffer kosong
        } else {
        const textPngBuffer = await sharp(textOverlayBuffer).png().toBuffer();
        // Get text overlay dimensions
        const textMetadata = await sharp(textPngBuffer).metadata();
          let textWidth = textMetadata.width || 100;
          let textHeight = textMetadata.height || 50;
          // Koreksi posisi agar tidak keluar template dan tidak overlap QR
          const safePos = clampTextOverlayBackend(
            templateSettings.textOverlay,
            templateWidth,
            templateHeight,
            textWidth,
            textHeight,
            { x: qrPos.x, y: qrPos.y, size: qrSize }
          );
        // Calculate text position
          let textPos = calculateTextPosition(
          templateWidth,
          templateHeight,
            { ...templateSettings.textOverlay, offsetX: safePos.offsetX, offsetY: safePos.offsetY },
          textWidth,
          textHeight
        );
          // PAKSA posisi agar selalu di dalam template (sinkron dengan frontend)
          if (templateSettings.textOverlay.textAlign === 'center') {
            textPos.x = textPos.x - textWidth / 2;
          } else if (templateSettings.textOverlay.textAlign === 'right') {
            textPos.x = textPos.x - textWidth;
          }
          // Clamp agar tidak keluar template
          textPos.x = Math.max(0, Math.min(textPos.x, templateWidth - textWidth));
          textPos.y = Math.max(0, Math.min(textPos.y, templateHeight - textHeight));
          // Selalu composite overlay (hilangkan validasi textInTemplate)
        compositeOptions.push({
          input: textPngBuffer,
            top: Math.round(textPos.y),
            left: Math.round(textPos.x),
          blend: "over",
        });
          textOverlayWasComposited = true;
        }
      } catch (textError) {
        console.error("Error creating text overlay:", textError);
        let errorMsg = '';
        if (textError instanceof Error) {
          errorMsg = textError.message;
        } else if (typeof textError === 'string') {
          errorMsg = textError;
        } else {
          errorMsg = JSON.stringify(textError);
        }
        (globalThis as any).textOverlayWarnings.push('Gagal membuat text overlay untuk peserta: ' + pesertaNamaFinal + ' | Error: ' + errorMsg);
        // Continue without text overlay if there's an error
      }
      // Fallback warning jika text overlay tidak pernah ditempel
      if (!textOverlayWasComposited) {
        if ((globalThis as any).textOverlayWarnings) {
          (globalThis as any).textOverlayWarnings.push('Text overlay tidak ditempel untuk peserta: ' + pesertaNamaFinal + ' karena alasan tidak diketahui.');
        }
      }
    }

      // Standard processing within template bounds
    let result: Buffer;
      result = await sharp(templateBuffer)
        .composite(compositeOptions)
        .png({
          compressionLevel: CONFIG.QR_SETTINGS.COMPRESSION_LEVEL,
          adaptiveFiltering: true,
          force: true,
        })
        .toBuffer();

    return {
      buffer: result,
      debugSVG: textOverlayBuffer || undefined,
      debugPNG: resizedQR || undefined,
      textOverlayWarning: textOverlayWasComposited ? undefined : 'Text overlay tidak ditempel untuk peserta: ' + pesertaNama,
    };
  } catch (error: any) {
    console.error(
      `Template processing error (attempt ${retryCount + 1}):`,
      error?.message || error
    );

    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      await delay(1000 * (retryCount + 1));
      return applyQRAndTextToTemplate(
        templateBuffer,
        qrData,
        templateSettings,
        pesertaNama,
        qrSettings,
        retryCount + 1
      );
    }

    throw new Error(
      `Template processing failed: ${error?.message || "Unknown error"}`
    );
  } finally {
    qrBuffer = null;
    resizedQR = null;
    textOverlayBuffer = null;

    if (global.gc && retryCount === 0) {
      global.gc();
    }
  }
}

// Enhanced batch processor with text overlay support
async function processBatchQRTemplateWithText(
  rows: PesertaQR[],
  templateBuffer: Buffer,
  templateSettings: TemplateSettings,
  selectedDivisi: string[],
  progressCallback?: (
    current: number,
    total: number,
    stage: string,
    currentDivisi?: string
  ) => void
): Promise<ProcessingResult> {
  const divisiData: { [key: string]: { fileName: string; buffer: Buffer }[] } =
    {};
  let processedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const divisiProcessed: string[] = [];
  const textOverlayWarnings: string[] = [];
  const debugOverlayFiles: { fileName: string; svg?: Buffer; png?: Buffer }[] = [];

  // Validate inputs
  if (!rows.length) {
    throw new Error("No data to process");
  }

  if (selectedDivisi.length > CONFIG.MAX_DIVISI_TEMPLATE) {
    throw new Error(
      `Too many divisi selected (${selectedDivisi.length}). Maximum ${CONFIG.MAX_DIVISI_TEMPLATE} divisi allowed.`
    );
  }

  // Validate template settings
  const settingsValidation = validateTemplateSettings(templateSettings);
  if (!settingsValidation.valid) {
    throw new Error(
      `Invalid template settings: ${settingsValidation.errors.join(", ")}`
    );
  }

  // Filter rows by selected divisi only
  const filteredRows = rows.filter((row) =>
    selectedDivisi.includes(row.divisi)
  );

  if (filteredRows.length > CONFIG.MAX_QR_LIMIT) {
    throw new Error(
      `Too many QR codes (${filteredRows.length}). Maximum ${CONFIG.MAX_QR_LIMIT} allowed.`
    );
  }

  // Pre-validate template
  try {
    const metadata = await sharp(templateBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("Invalid template image");
    }
  } catch (error) {
    throw new Error("Template validation failed");
  }

  const processingDesc = templateSettings.textOverlay.enabled
    ? `template + text overlay (${templateSettings.textOverlay.preset} position, Y:${templateSettings.textOverlay.offsetY}px)`
    : `template only (${templateSettings.qrPosition.preset} position)`;

  progressCallback?.(
    0,
    filteredRows.length,
    `Initializing per-divisi processing with ${processingDesc}...`
  );

  // Group rows by divisi
  const rowsByDivisi = filteredRows.reduce((acc, row) => {
    if (!acc[row.divisi]) {
      acc[row.divisi] = [];
    }
    acc[row.divisi].push(row);
    return acc;
  }, {} as { [key: string]: PesertaQR[] });

  let totalProcessed = 0;

  // Process each divisi separately
  for (const [divisiName, divisiRows] of Object.entries(rowsByDivisi)) {
    progressCallback?.(
      totalProcessed,
      filteredRows.length,
      `Processing divisi: ${divisiName} with text overlay`,
      divisiName
    );

    const sanitizedDivisiName = sanitizeFilename(divisiName);
    divisiData[sanitizedDivisiName] = [];

    // Process divisi in smaller batches due to text rendering overhead
    const totalBatches = Math.ceil(divisiRows.length / CONFIG.BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * CONFIG.BATCH_SIZE;
      const batchEnd = Math.min(
        batchStart + CONFIG.BATCH_SIZE,
        divisiRows.length
      );
      const batch = divisiRows.slice(batchStart, batchEnd);

      progressCallback?.(
        totalProcessed + batchStart,
        filteredRows.length,
        `Processing ${divisiName} - batch ${
          batchIndex + 1
        }/${totalBatches} with text rendering`,
        divisiName
      );

      const batchPromises = batch.map(async (peserta, index) => {
        try {
          const qrData = generateQRData(peserta);

          // Apply both QR and text overlay
          const processedImageResult = await Promise.race([
            applyQRAndTextToTemplate(
              templateBuffer,
              qrData,
              templateSettings,
              peserta.nama_lengkap, // Use nama_lengkap for text overlay
              {
                qr_size: 400,
                margin: 2,
                dark_color: "#000000",
                light_color: "#FFFFFF",
                error_correction: "M",
              }
            ),
            new Promise<never>(
              (_, reject) =>
                setTimeout(() => reject(new Error("Processing timeout")), 40000) // Increased timeout for text rendering
            ),
          ]);

          let fileName = formatQRFilename(peserta, true);
          let fileIndex = 0;
          while (
            divisiData[sanitizedDivisiName].some((f) => f.fileName === fileName)
          ) {
            fileName = formatQRFilename(peserta, true, ++fileIndex);
          }

          divisiData[sanitizedDivisiName].push({
            fileName,
            buffer: processedImageResult.buffer,
          });

          if (processedImageResult.debugSVG) {
            debugOverlayFiles.push({
              fileName: fileName + '.svg',
              svg: processedImageResult.debugSVG,
            });
          }
          if (processedImageResult.debugPNG) {
            debugOverlayFiles.push({
              fileName: fileName + '.png',
              png: processedImageResult.debugPNG,
            });
          }

          if (processedImageResult.textOverlayWarning) {
            textOverlayWarnings.push(processedImageResult.textOverlayWarning);
          }

          processedCount++;
        } catch (error: any) {
          const errorMsg = `${peserta.unique_id} (${divisiName}): ${
            error?.message || "Unknown error"
          }`;
          console.error(
            `Error processing template+text for ${peserta.unique_id}:`,
            error?.message || error
          );
          errors.push(errorMsg);
          errorCount++;

          // Fallback to original QR without text
          try {
            const qrData = generateQRData(peserta);
            const qrBuffer = await QRCode.toBuffer(qrData, {
              type: "png",
              width: 300,
              margin: 2,
              color: { dark: "#000000", light: "#FFFFFF" },
              errorCorrectionLevel: "M",
            });

            const fileName = formatQRFilename(peserta, false);
            divisiData[sanitizedDivisiName].push({
              fileName,
              buffer: qrBuffer,
            });

            processedCount++;
          } catch (fallbackError) {
            console.error(
              `Fallback failed for ${peserta.unique_id}:`,
              fallbackError
            );
            errors.push(
              `${peserta.unique_id} (${divisiName}): Fallback also failed`
            );
          }
        }
      });

      await Promise.allSettled(batchPromises);

      // Update progress
      totalProcessed += batch.length;
      progressCallback?.(
        totalProcessed,
        filteredRows.length,
        `Completed ${divisiName} - batch ${batchIndex + 1}/${totalBatches}`,
        divisiName
      );
    }

    divisiProcessed.push(divisiName);

    // Memory cleanup after each divisi
    if (global.gc) {
      global.gc();
      await delay(100);
    }
  }

  progressCallback?.(
    filteredRows.length,
    filteredRows.length,
    `Template processing with text overlay completed`
  );

  return {
    divisiData,
    processedCount,
    errorCount,
    errors,
    divisiProcessed,
    textOverlayWarnings,
    debugOverlayFiles,
  };
}

function isRetryableError(error: any): boolean {
  const retryableMessages = ["timeout", "memory", "ECONNRESET", "ETIMEDOUT"];
  return retryableMessages.some(
    (msg) =>
      error?.message?.toLowerCase().includes(msg) || error?.code?.includes(msg)
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logOperation(operation: string, details: any) {
  console.log(
    `[Enhanced QR Operation] ${operation}:`,
    JSON.stringify(details, null, 2)
  );
}

export async function GET(request: NextRequest) {
  // GET operations remain the same as before
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type") || "single";
    const format = searchParams.get("format") || "png";
    const divisi = searchParams.get("divisi") || "";
    const size = Math.min(
      Math.max(parseInt(searchParams.get("size") || "300"), 100),
      1000
    );
    const margin = Math.min(
      Math.max(parseInt(searchParams.get("margin") || "2"), 1),
      10
    );
    const templateMode = searchParams.get("template_mode") === "true";

    logOperation("GET Request", {
      type,
      format,
      divisi,
      size,
      margin,
      templateMode,
    });

    if (type === "single" && !id) {
      return NextResponse.json(
        {
          success: false,
          message: "Parameter id diperlukan untuk download single QR",
        },
        { status: 400 }
      );
    }

    // Single QR download
    if (type === "single" && id) {
      const [rows] = await db.execute<PesertaQR[]>(
        "SELECT * FROM panitia_peserta WHERE unique_id = ?",
        [id]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: "Data tidak ditemukan" },
          { status: 404 }
        );
      }

      const peserta = rows[0];
      const qrData = generateQRData(peserta);

      if (format === "svg") {
        const svgOptions = {
          type: "svg" as const,
          width: size,
          margin: margin,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: CONFIG.QR_SETTINGS.ERROR_CORRECTION,
        };

        const qrSvg = await QRCode.toString(qrData, svgOptions);
        const filename = `${peserta.nim}_${sanitizeFilename(
          peserta.nama_lengkap
        )}.svg`;

        return new NextResponse(qrSvg, {
          headers: {
            "Content-Type": "image/svg+xml",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      } else {
        const pngOptions = {
          type: "png" as const,
          width: size,
          margin: margin,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: CONFIG.QR_SETTINGS.ERROR_CORRECTION,
        };

        const qrBuffer = await QRCode.toBuffer(qrData, pngOptions);
        const filename = formatQRFilename(peserta, templateMode);

        return new NextResponse(new Uint8Array(qrBuffer), {
          headers: {
            "Content-Type": "image/png",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }
    }

    // Bulk QR download (original QR only)
    else if (type === "bulk") {
      let query =
        'SELECT * FROM panitia_peserta WHERE qr_code IS NOT NULL AND qr_code != ""';
      const params: any[] = [];

      if (divisi) {
        query += " AND divisi = ?";
        params.push(divisi);
      }

      query += " ORDER BY divisi, nim, nama_lengkap";

      const [rows] = await db.execute<PesertaQR[]>(query, params);

      if (rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Tidak ada data dengan QR code untuk didownload",
          },
          { status: 404 }
        );
      }

      if (rows.length > CONFIG.MAX_QR_LIMIT) {
        return NextResponse.json(
          {
            success: false,
            message: `Terlalu banyak data (${rows.length}). Maksimal ${CONFIG.MAX_QR_LIMIT} QR codes per download.`,
            suggestion: "Gunakan filter divisi untuk membatasi jumlah data",
          },
          { status: 400 }
        );
      }

      const zip = new JSZip();
      let processedCount = 0;

      for (const peserta of rows) {
        try {
          const qrData = generateQRData(peserta);
          const qrBuffer = await QRCode.toBuffer(qrData, {
            type: "png",
            width: size,
            margin: margin,
            color: { dark: "#000000", light: "#FFFFFF" },
            errorCorrectionLevel: CONFIG.QR_SETTINGS.ERROR_CORRECTION,
          });

          const fileName = formatQRFilename(peserta, templateMode);
          zip.file(fileName, qrBuffer);
          processedCount++;
        } catch (error: any) {
          console.error(
            `Error processing QR for ${peserta.unique_id}:`,
            error?.message || error
          );
        }
      }

      if (processedCount === 0) {
        return NextResponse.json(
          { success: false, message: "Gagal memproses QR code" },
          { status: 500 }
        );
      }

      const processingTime = Date.now() - startTime;
      const summaryData = {
        total_qr_codes: processedCount,
        processing_time_ms: processingTime,
        generated_at: new Date().toISOString(),
        download_mode: "bulk_single_divisi",
        divisi_name: divisi || "all",
        qr_data_format: {
          version: "2.0",
          structure: "enhanced_format",
          fields: ["v", "id", "nama", "nim", "divisi", "timestamp", "checksum"],
        },
      };

      zip.file("download_summary.json", JSON.stringify(summaryData, null, 2));

      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
        streamFiles: true,
      });

      const timestamp = new Date().toISOString().split("T")[0];
      const zipFileName = `qr_codes_${sanitizeFilename(
        divisi || "bulk"
      )}_${timestamp}.zip`;

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFileName}"`,
          "Content-Length": zipBuffer.length.toString(),
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Parameter type tidak valid. Gunakan: single, bulk",
      },
      { status: 400 }
    );
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("QR Download Error:", error?.message || error);
    logOperation("GET Error", { error: error?.message, processingTime });

    return NextResponse.json(
      {
        success: false,
        message: "Error saat mendownload QR code",
        error: error?.message || "Unknown error",
        processing_time: processingTime,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const contentType = request.headers.get("content-type");

    // Enhanced template processing with text overlay
    if (contentType?.includes("multipart/form-data")) {
      const formData = await request.formData();
      const templateFile = formData.get("template") as File;
      const selectedDivisiStr = formData.get("selectedDivisi") as string;
      const templateSettingsStr = formData.get("templateSettings") as string;

      if (!templateFile) {
        return NextResponse.json(
          { success: false, message: "Template file diperlukan" },
          { status: 400 }
        );
      }

      if (!selectedDivisiStr) {
        return NextResponse.json(
          {
            success: false,
            message: "Divisi harus dipilih untuk template processing",
          },
          { status: 400 }
        );
      }

      // Parse selected divisi
      let selectedDivisi: string[];
      try {
        selectedDivisi = JSON.parse(selectedDivisiStr);
      } catch (error) {
        return NextResponse.json(
          { success: false, message: "Format divisi tidak valid" },
          { status: 400 }
        );
      }

      // Parse template settings (enhanced with text overlay)
      let templateSettings: TemplateSettings;
      try {
        templateSettings = templateSettingsStr
          ? JSON.parse(templateSettingsStr)
          : {
              qrPosition: {
                preset: "center",
                offsetX: 0,
                offsetY: 0,
                scale: 0.35,
              },
              textOverlay: {
                enabled: true,
                preset: "bottom",
                offsetX: 0,
                offsetY: 750,
                fontSize: 24,
                fontWeight: "bold",
                fontColor: "#000000",
                backgroundColor: "#FFFFFF",
                backgroundOpacity: 0.8,
                padding: 8,
                borderRadius: 4,
                textAlign: "center",
                fontFamily: "Arial",
                strokeWidth: 0,
                strokeColor: "#FFFFFF",
              },
            };
      } catch (error) {
        return NextResponse.json(
          { success: false, message: "Format template settings tidak valid" },
          { status: 400 }
        );
      }

      // Enhanced validation
      const settingsValidation = validateTemplateSettings(templateSettings);
      if (!settingsValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid template settings: ${settingsValidation.errors.join(
              ", "
            )}`,
          },
          { status: 400 }
        );
      }

      if (selectedDivisi.length === 0) {
        return NextResponse.json(
          { success: false, message: "Minimal 1 divisi harus dipilih" },
          { status: 400 }
        );
      }

      if (selectedDivisi.length > CONFIG.MAX_DIVISI_TEMPLATE) {
        return NextResponse.json(
          {
            success: false,
            message: `Terlalu banyak divisi dipilih (${selectedDivisi.length}). Maksimal ${CONFIG.MAX_DIVISI_TEMPLATE} divisi untuk template processing.`,
            max_allowed: CONFIG.MAX_DIVISI_TEMPLATE,
          },
          { status: 400 }
        );
      }

      // Enhanced file validation
      if (!templateFile.type.startsWith("image/")) {
        return NextResponse.json(
          {
            success: false,
            message: "File template harus berupa gambar (PNG, JPG, JPEG)",
          },
          { status: 400 }
        );
      }

      if (templateFile.size > CONFIG.TEMPLATE_MAX_SIZE) {
        return NextResponse.json(
          {
            success: false,
            message: `File template terlalu besar (${(
              templateFile.size /
              1024 /
              1024
            ).toFixed(1)}MB). Maksimal ${
              CONFIG.TEMPLATE_MAX_SIZE / 1024 / 1024
            }MB`,
          },
          { status: 400 }
        );
      }

      // Query data for selected divisi only
      const placeholders = selectedDivisi.map(() => "?").join(",");
      const query = `SELECT * FROM panitia_peserta WHERE qr_code IS NOT NULL AND qr_code != "" AND divisi IN (${placeholders}) ORDER BY divisi, nim, nama_lengkap`;

      const [rows] = await db.execute<PesertaQR[]>(query, selectedDivisi);

      if (rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Tidak ada data dengan QR code untuk divisi yang dipilih",
          },
          { status: 404 }
        );
      }

      const templateBuffer = Buffer.from(await templateFile.arrayBuffer());

      const processingDesc = templateSettings.textOverlay.enabled
        ? `template + text overlay (nama peserta pada Y:${templateSettings.textOverlay.offsetY}px)`
        : `template only`;

      logOperation("Enhanced Template Processing Started", {
        totalQR: rows.length,
        selectedDivisi: selectedDivisi,
        templateSize: `${(templateFile.size / 1024).toFixed(1)}KB`,
        templateSettings: templateSettings,
        processingType: processingDesc,
      });

      // Use enhanced batch processor with text overlay
      const result = await processBatchQRTemplateWithText(
        rows,
        templateBuffer,
        templateSettings,
        selectedDivisi,
        (current, total, stage, currentDivisi) => {
          if (current % 10 === 0 || current === total) {
            logOperation("Enhanced Processing Progress", {
              current,
              total,
              percentage: Math.round((current / total) * 100),
              stage,
              currentDivisi,
              textOverlayEnabled: templateSettings.textOverlay.enabled,
            });
          }
        }
      );

      if (result.processedCount === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Gagal memproses template QR dengan text overlay",
          },
          { status: 500 }
        );
      }

      // Create ZIP with divisi organization
      const zip = new JSZip();

      for (const [divisiName, files] of Object.entries(result.divisiData)) {
        const divisiFolder = zip.folder(divisiName);

        for (const { fileName, buffer } of files) {
          divisiFolder?.file(fileName, buffer, {
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
          });
        }
      }

      // Tambahkan folder _debug_overlay dan masukkan semua file debugOverlayFiles
      if (result.debugOverlayFiles && result.debugOverlayFiles.length > 0) {
        const debugFolder = zip.folder('_debug_overlay');
        for (const debug of result.debugOverlayFiles) {
          if (debug.svg) debugFolder?.file(debug.fileName + '.svg', debug.svg);
          if (debug.png) debugFolder?.file(debug.fileName + '.png', debug.png);
        }
      }

      const processingTime = Date.now() - startTime;
      const summaryData = {
        total_processed: result.processedCount,
        total_errors: result.errorCount,
        success_rate: `${Math.round(
          (result.processedCount / rows.length) * 100
        )}%`,
        processing_time_ms: processingTime,
        processing_time_readable: `${(processingTime / 1000).toFixed(
          2
        )} seconds`,
        generated_at: new Date().toISOString(),
        template_applied: true,
        text_overlay_enabled: templateSettings.textOverlay.enabled,
        selected_divisi: selectedDivisi,
        divisi_processed: result.divisiProcessed,
        enhanced_template_settings: {
          qr_positioning: {
            preset: templateSettings.qrPosition.preset,
            scale: templateSettings.qrPosition.scale,
            offset: {
              x: templateSettings.qrPosition.offsetX,
              y: templateSettings.qrPosition.offsetY,
            },
            supported_range: `±${CONFIG.OFFSET_LIMITS.MAX}px`,
          },
          text_overlay: templateSettings.textOverlay.enabled
            ? {
                position_preset: templateSettings.textOverlay.preset,
                font_settings: {
                  family: templateSettings.textOverlay.fontFamily,
                  size: `${templateSettings.textOverlay.fontSize}px`,
                  weight: templateSettings.textOverlay.fontWeight,
                  color: templateSettings.textOverlay.fontColor,
                  size_category:
                    templateSettings.textOverlay.fontSize <= 50
                      ? "normal"
                      : templateSettings.textOverlay.fontSize <= 150
                      ? "large"
                      : templateSettings.textOverlay.fontSize <= 500
                      ? "poster"
                      : "banner",
                },
                background_settings: {
                  color: templateSettings.textOverlay.backgroundColor,
                  opacity: templateSettings.textOverlay.backgroundOpacity,
                  padding: `${templateSettings.textOverlay.padding}px`,
                  border_radius: `${templateSettings.textOverlay.borderRadius}px`,
                },
                position: {
                  x: templateSettings.textOverlay.offsetX,
                  y: templateSettings.textOverlay.offsetY,
                  extreme_positioning:
                    Math.abs(templateSettings.textOverlay.offsetX) > 5000 ||
                    Math.abs(templateSettings.textOverlay.offsetY) > 5000,
                },
                text_content: "nama_lengkap dari database",
                extended_capabilities: {
                  font_size_range: `${CONFIG.TEXT_SETTINGS.MIN_FONT_SIZE}px - ${CONFIG.TEXT_SETTINGS.MAX_FONT_SIZE}px`,
                  position_range: `±${CONFIG.TEXT_SETTINGS.POSITION_LIMITS.MAX}px`,
                  canvas_extension_used:
                    Math.abs(templateSettings.textOverlay.offsetX) > 2000 ||
                    Math.abs(templateSettings.textOverlay.offsetY) > 2000 ||
                    templateSettings.textOverlay.fontSize > 200,
                },
              }
            : null,
        },
        structure: "organized_by_divisi_with_qr_and_text_overlay",
        file_naming_format: "nim_nama_lengkap_template.png",
        processing_features: {
          qr_code_generation: true,
          text_overlay_rendering: templateSettings.textOverlay.enabled,
          custom_positioning: true,
          per_divisi_organization: true,
          batch_processing: true,
          memory_optimization: true,
        },
        performance_metrics: {
          total_items: rows.length,
          processed_successfully: result.processedCount,
          failed_items: result.errorCount,
          items_per_second: Math.round(
            (result.processedCount / processingTime) * 1000
          ),
          divisi_count: selectedDivisi.length,
          max_divisi_allowed: CONFIG.MAX_DIVISI_TEMPLATE,
          text_rendering_overhead: templateSettings.textOverlay.enabled
            ? "~40% slower due to text overlay"
            : "N/A",
        },
        errors: result.errors.slice(0, 20),
        text_overlay_warnings: (result.textOverlayWarnings ?? []).slice(0, 20),
      };

      zip.file(
        "enhanced_template_processing_summary.json",
        JSON.stringify(summaryData, null, 2)
      );

      const zipStartTime = Date.now();
      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6
        },
        streamFiles: true,
        platform: "UNIX",
      });

      const zipTime = Date.now() - zipStartTime;
      const totalTime = Date.now() - startTime;

      const timestamp = new Date().toISOString().split("T")[0];
      const divisiNames = selectedDivisi
        .slice(0, 3)
        .map((d) => sanitizeFilename(d))
        .join("_");
      const textSuffix = templateSettings.textOverlay.enabled
        ? "with_text"
        : "qr_only";
      const positionSuffix =
        templateSettings.qrPosition.preset === "custom"
          ? `custom_${Math.abs(templateSettings.qrPosition.offsetX)}_${Math.abs(
              templateSettings.qrPosition.offsetY
            )}`
          : templateSettings.qrPosition.preset;
      const zipFileName = `qr_template_${divisiNames}${
        selectedDivisi.length > 3 ? "_etc" : ""
      }_${textSuffix}_${positionSuffix}_${
        result.processedCount
      }items_${timestamp}.zip`;

      logOperation("Enhanced Template Processing Completed", {
        fileName: zipFileName,
        fileSize: `${
          Math.round((zipBuffer.length / 1024 / 1024) * 100) / 100
        } MB`,
        totalTime: `${(totalTime / 1000).toFixed(2)}s`,
        zipTime: `${(zipTime / 1000).toFixed(2)}s`,
        processed: result.processedCount,
        errors: result.errorCount,
        divisiProcessed: result.divisiProcessed,
        textOverlayEnabled: templateSettings.textOverlay.enabled,
        textPosition: templateSettings.textOverlay.enabled
          ? `Y:${templateSettings.textOverlay.offsetY}px`
          : "N/A",
      });

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFileName}"`,
          "Content-Length": zipBuffer.length.toString(),
          "X-Processing-Summary": `${result.processedCount}/${rows.length} processed successfully`,
          "X-Divisi-Processed": result.divisiProcessed.join(","),
          "X-Processing-Time": totalTime.toString(),
          "X-Error-Count": result.errorCount.toString(),
          "X-Text-Overlay": templateSettings.textOverlay.enabled
            ? "enabled"
            : "disabled",
          "X-Text-Position": templateSettings.textOverlay.enabled
            ? `Y:${templateSettings.textOverlay.offsetY}px`
            : "N/A",
        },
      });
    }

    // Other POST operations remain the same...
    const body = await request.json();
    const { action, unique_ids, divisi, settings } = body;

    if (action === "regenerate") {
      let query = "SELECT * FROM panitia_peserta WHERE 1=1";
      const params: any[] = [];

      if (unique_ids && Array.isArray(unique_ids) && unique_ids.length > 0) {
        if (unique_ids.length > 200) {
          return NextResponse.json(
            {
              success: false,
              message: "Maksimal 200 QR codes untuk regenerate sekaligus",
            },
            { status: 400 }
          );
        }

        const placeholders = unique_ids.map(() => "?").join(",");
        query += ` AND unique_id IN (${placeholders})`;
        params.push(...unique_ids);
      } else {
        if (divisi) {
          query += " AND divisi = ?";
          params.push(divisi);
        }
      }

      const [rows] = await db.execute<PesertaQR[]>(query, params);

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: "Tidak ada data untuk di-regenerate" },
          { status: 404 }
        );
      }

      if (rows.length > 1000) {
        return NextResponse.json(
          {
            success: false,
            message: `Terlalu banyak data (${rows.length}). Maksimal 1000 untuk regenerate sekaligus.`,
          },
          { status: 400 }
        );
      }

      const successData: any[] = [];
      const errorData: any[] = [];

      const qrSettings = {
        width: settings?.width || 300,
        margin: settings?.margin || 2,
        errorCorrectionLevel: settings?.errorCorrectionLevel || "M",
        dark_color: settings?.dark_color || "#000000",
        light_color: settings?.light_color || "#FFFFFF",
      };

      for (const peserta of rows) {
        try {
          const qrData = generateQRData(peserta);
          const qrCode = await QRCode.toDataURL(qrData, {
            width: qrSettings.width,
            margin: qrSettings.margin,
            color: {
              dark: qrSettings.dark_color,
              light: qrSettings.light_color,
            },
            errorCorrectionLevel: qrSettings.errorCorrectionLevel as any,
          });

          await db.execute(
            "UPDATE panitia_peserta SET qr_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [qrCode, peserta.id]
          );

          successData.push({
            unique_id: peserta.unique_id,
            nama_lengkap: peserta.nama_lengkap,
            nim: peserta.nim,
            divisi: peserta.divisi,
            filename_format: formatQRFilename(peserta),
            qr_data_structure: JSON.parse(qrData),
          });
        } catch (error: any) {
          console.error(
            `Error regenerating QR for ${peserta.unique_id}:`,
            error?.message || error
          );
          errorData.push({
            unique_id: peserta.unique_id,
            nama_lengkap: peserta.nama_lengkap,
            nim: peserta.nim,
            error: error?.message || "Gagal generate QR code",
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        message: `QR code berhasil di-regenerate. ${successData.length} berhasil, ${errorData.length} gagal.`,
        data: {
          success: successData,
          errors: errorData,
          success_count: successData.length,
          error_count: errorData.length,
          processing_time_ms: processingTime,
          settings_applied: qrSettings,
          qr_data_format: {
            version: "2.0",
            structure: "enhanced_format",
            fields: [
              "v",
              "id",
              "nama",
              "nim",
              "divisi",
              "timestamp",
              "checksum",
            ],
          },
        },
      });
    }

    return NextResponse.json(
      { success: false, message: "Action tidak dikenali. Gunakan: regenerate" },
      { status: 400 }
    );
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("Enhanced QR Operation Error:", error?.message || error);
    logOperation("POST Error", { error: error?.message, processingTime });

    return NextResponse.json(
      {
        success: false,
        message: "Error saat operasi QR code dengan text overlay",
        error: error?.message || "Unknown error",
        processing_time: processingTime,
      },
      { status: 500 }
    );
  }
}

// PUT and DELETE methods remain the same as before
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { unique_id, qr_settings, custom_data } = body;

    if (!unique_id) {
      return NextResponse.json(
        { success: false, message: "Unique ID diperlukan" },
        { status: 400 }
      );
    }

    const [rows] = await db.execute<PesertaQR[]>(
      "SELECT * FROM panitia_peserta WHERE unique_id = ?",
      [unique_id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Data tidak ditemukan" },
        { status: 404 }
      );
    }

    const peserta = rows[0];

    let qrData = generateQRData(peserta);
    if (custom_data) {
      const parsedData = JSON.parse(qrData);
      qrData = JSON.stringify({ ...parsedData, ...custom_data });
    }

    const qrOptions = {
      width: qr_settings?.width || 300,
      margin: qr_settings?.margin || 2,
      color: {
        dark: qr_settings?.dark_color || "#000000",
        light: qr_settings?.light_color || "#FFFFFF",
      },
      errorCorrectionLevel: (qr_settings?.error_correction || "M") as any,
    };

    const qrCode = await QRCode.toDataURL(qrData, qrOptions);

    await db.execute(
      "UPDATE panitia_peserta SET qr_code = ?, updated_at = CURRENT_TIMESTAMP WHERE unique_id = ?",
      [qrCode, unique_id]
    );

    return NextResponse.json({
      success: true,
      message: "QR code berhasil diupdate",
      data: {
        unique_id,
        qr_code: qrCode,
        qr_data_structure: JSON.parse(qrData),
        settings_applied: qrOptions,
        custom_data_applied: custom_data || null,
      },
    });
  } catch (error: any) {
    console.error("QR Update Error:", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        message: "Error saat update QR code",
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unique_id = searchParams.get("unique_id");
    const permanent = searchParams.get("permanent") === "true";

    if (!unique_id) {
      return NextResponse.json(
        { success: false, message: "Unique ID diperlukan" },
        { status: 400 }
      );
    }

    const [rows] = await db.execute<PesertaQR[]>(
      "SELECT * FROM panitia_peserta WHERE unique_id = ?",
      [unique_id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Data tidak ditemukan" },
        { status: 404 }
      );
    }

    const peserta = rows[0];

    if (permanent) {
      await db.execute("DELETE FROM panitia_peserta WHERE unique_id = ?", [
        unique_id,
      ]);

      return NextResponse.json({
        success: true,
        message: "Data peserta dan QR code berhasil dihapus permanen",
        deleted_file_format: formatQRFilename(peserta),
        deleted_from_divisi: peserta.divisi,
      });
    } else {
      await db.execute(
        "UPDATE panitia_peserta SET qr_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE unique_id = ?",
        [unique_id]
      );

      return NextResponse.json({
        success: true,
        message: "QR code berhasil dihapus. Data peserta tetap ada.",
        affected_file_format: formatQRFilename(peserta),
        divisi: peserta.divisi,
      });
    }
  } catch (error: any) {
    console.error("QR Delete Error:", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        message: "Error saat menghapus QR code",
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}