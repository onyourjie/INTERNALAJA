/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db, RowDataPacket } from "@/lib/db";
import QRCode from "qrcode";
import JSZip from "jszip";
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
  skippedParticipants: string[];
  fallbackCount: number;
}

// Enhanced configuration constants
const CONFIG = {
  BATCH_SIZE: 15, // Reduced for better stability
  MAX_QR_LIMIT: 1500,
  MAX_DIVISI_TEMPLATE: 10,
  PROCESSING_TIMEOUT: 1200000, // 20 minutes
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
  TEXT_SETTINGS: {
    MIN_FONT_SIZE: 12,
    MAX_FONT_SIZE: 1000,
    DEFAULT_FONT_SIZE: 24,
    SUPPORTED_FONTS: [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Courier New",
      "Verdana",
      "Georgia",
    ],
    POSITION_LIMITS: {
      MIN: -10000,
      MAX: 10000,
    },
  },
  // FIXED: Canvas limits to prevent memory issues
  CANVAS_LIMITS: {
    MAX_WIDTH: 50000,
    MAX_HEIGHT: 50000,
    SAFE_WIDTH: 20000,
    SAFE_HEIGHT: 20000,
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

// FIXED: Enhanced filename sanitization to prevent conflicts
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100) // Reduced length to prevent issues
    .toLowerCase();
}

// FIXED: Enhanced filename generation with better uniqueness
function formatQRFilename(
  peserta: PesertaQR,
  isTemplate: boolean = false,
  index?: number,
  additionalSuffix?: string
): string {
  const cleanNama = sanitizeFilename(peserta.nama_lengkap);
  const cleanNim = sanitizeFilename(peserta.nim);
  const suffix = isTemplate ? "_template" : "";
  const indexSuffix = index !== undefined ? `_${index}` : "";
  const extraSuffix = additionalSuffix ? `_${additionalSuffix}` : "";
  
  // Include unique_id to ensure uniqueness
  const uniquePart = peserta.unique_id.slice(-6); // Last 6 chars of unique_id
  
  return `${cleanNim}_${cleanNama}_${uniquePart}${suffix}${indexSuffix}${extraSuffix}.png`;
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

// Text positioning calculator
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

// FIXED: Enhanced validation with better error messages
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

  // Enhanced text overlay validation
  if (templateSettings.textOverlay.enabled) {
    const textOverlay = templateSettings.textOverlay;

    if (
      textOverlay.fontSize < CONFIG.TEXT_SETTINGS.MIN_FONT_SIZE ||
      textOverlay.fontSize > CONFIG.TEXT_SETTINGS.MAX_FONT_SIZE
    ) {
      errors.push(
        `Font size must be between ${CONFIG.TEXT_SETTINGS.MIN_FONT_SIZE}px and ${CONFIG.TEXT_SETTINGS.MAX_FONT_SIZE}px`
      );
    }

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
    if (!colorRegex.test(textOverlay.fontColor)) {
      errors.push("Invalid font color format. Use hex format (#000000)");
    }

    if (!colorRegex.test(textOverlay.backgroundColor)) {
      errors.push("Invalid background color format. Use hex format (#FFFFFF)");
    }

    // Font family validation
    if (
      !CONFIG.TEXT_SETTINGS.SUPPORTED_FONTS.includes(textOverlay.fontFamily)
    ) {
      errors.push(
        `Font family must be one of: ${CONFIG.TEXT_SETTINGS.SUPPORTED_FONTS.join(
          ", "
        )}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// FIXED: Enhanced text validation function
function validateTextContent(text: string): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = [];
  let sanitized = text;

  if (!text || text.trim().length === 0) {
    errors.push("Text content cannot be empty");
    return { valid: false, sanitized: "", errors };
  }

  // Remove problematic characters that could break SVG
  sanitized = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>&"']/g, (char) => { // Escape XML characters
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return char;
      }
    })
    .trim();

  if (sanitized.length === 0) {
    errors.push("Text content becomes empty after sanitization");
    return { valid: false, sanitized: "", errors };
  }

  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100) + "...";
  }

  return { valid: true, sanitized, errors };
}

// FIXED: Enhanced text overlay SVG creation with better error handling
async function createTextOverlaySVG(
  text: string,
  textOverlay: TextOverlay,
  templateWidth: number
): Promise<Buffer> {
  try {
    // Validate and sanitize text
    const textValidation = validateTextContent(text);
    if (!textValidation.valid) {
      throw new Error(`Invalid text content: ${textValidation.errors.join(', ')}`);
    }
    
    const sanitizedText = textValidation.sanitized;
    const fontSize = Math.max(12, Math.min(1000, textOverlay.fontSize));
    const fontFamily = textOverlay.fontFamily;
    const fontWeight = textOverlay.fontWeight;
    const fontColor = textOverlay.fontColor;
    const backgroundColor = textOverlay.backgroundColor;
    const padding = Math.max(0, Math.min(50, textOverlay.padding));
    const borderRadius = Math.max(0, Math.min(50, textOverlay.borderRadius));

    // Enhanced text dimension calculation
    let charWidth = fontSize * 0.6;
    let textWidth = Math.max(sanitizedText.length * charWidth, 100);
    let textHeight = fontSize * 1.2;

    // Adjustments for large fonts
    if (fontSize > 200) {
      charWidth = fontSize * 0.55;
      textWidth = sanitizedText.length * charWidth;
      textHeight = fontSize * 1.15;
    }

    if (fontSize > 500) {
      charWidth = fontSize * 0.5;
      textWidth = sanitizedText.length * charWidth;
      textHeight = fontSize * 1.1;
    }

    // Ensure minimum dimensions
    textWidth = Math.max(textWidth, fontSize * 2);
    textHeight = Math.max(textHeight, fontSize);

    // Create background rect dimensions
    const paddingMultiplier = fontSize > 200 ? Math.max(1, fontSize / 200) : 1;
    const adjustedPadding = padding * paddingMultiplier;

    const bgWidth = Math.min(textWidth + adjustedPadding * 2, CONFIG.CANVAS_LIMITS.SAFE_WIDTH);
    const bgHeight = Math.min(textHeight + adjustedPadding * 2, CONFIG.CANVAS_LIMITS.SAFE_HEIGHT);

    // Convert background color to RGBA
    const bgR = parseInt(backgroundColor.slice(1, 3), 16);
    const bgG = parseInt(backgroundColor.slice(3, 5), 16);
    const bgB = parseInt(backgroundColor.slice(5, 7), 16);
    const bgOpacity = Math.max(0, Math.min(1, textOverlay.backgroundOpacity));

    // Enhanced SVG with better error handling
    const svg = `
      <svg width="${bgWidth}" height="${bgHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect 
          x="0" y="0" 
          width="${bgWidth}" 
          height="${bgHeight}" 
          rx="${borderRadius * paddingMultiplier}" 
          ry="${borderRadius * paddingMultiplier}"
          fill="rgba(${bgR}, ${bgG}, ${bgB}, ${bgOpacity})"
        />
        <text 
          x="${bgWidth / 2}" 
          y="${bgHeight / 2 + fontSize / 3}" 
          font-family="${fontFamily}" 
          font-size="${fontSize}" 
          font-weight="${fontWeight}" 
          fill="${fontColor}" 
          text-anchor="middle" 
          dominant-baseline="middle"
          letter-spacing="${fontSize > 100 ? fontSize * 0.02 : 0}"
        >${sanitizedText}</text>
      </svg>
    `;

    console.log(
      `Created text overlay: "${sanitizedText}" with font ${fontSize}px, dimensions ${bgWidth}x${bgHeight}`
    );
    return Buffer.from(svg);
  } catch (error) {
    console.error('Error creating text overlay SVG:', error);
    throw new Error(`Text overlay creation failed: ${error.message}`);
  }
}

// FIXED: Enhanced template processing with comprehensive error handling
async function applyQRAndTextToTemplate(
  templateBuffer: Buffer,
  qrData: string,
  templateSettings: TemplateSettings,
  pesertaNama: string,
  qrSettings: any = {},
  retryCount: number = 0,
  participantId: string = "unknown"
): Promise<Buffer> {
  const MAX_RETRIES = 2;

  let qrBuffer: Buffer | null = null;
  let resizedQR: Buffer | null = null;
  let textOverlayBuffer: Buffer | null = null;

  try {
    if (!templateBuffer || templateBuffer.length === 0) {
      throw new Error("Invalid template buffer");
    }

    // FIXED: Validate participant name early
    if (!pesertaNama || pesertaNama.trim().length === 0) {
      console.warn(`Empty name for participant ${participantId}, using fallback`);
      pesertaNama = participantId || "Unknown Participant";
    }

    // Generate QR code with timeout
    const qrPromise = QRCode.toBuffer(qrData, {
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

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("QR generation timeout")), 30000)
    );

    qrBuffer = await Promise.race([qrPromise, timeoutPromise]);

    // Get template metadata with validation
    let templateMetadata;
    try {
      templateMetadata = await sharp(templateBuffer).metadata();
    } catch (error) {
      throw new Error("Invalid template image format");
    }

    const templateWidth = templateMetadata.width || 720;
    const templateHeight = templateMetadata.height || 1280;

    if (templateWidth < 100 || templateHeight < 100) {
      throw new Error("Template too small (minimum 100x100px)");
    }

    // FIXED: Validate canvas size limits
    if (templateWidth > CONFIG.CANVAS_LIMITS.MAX_WIDTH || 
        templateHeight > CONFIG.CANVAS_LIMITS.MAX_HEIGHT) {
      throw new Error(`Template too large (max ${CONFIG.CANVAS_LIMITS.MAX_WIDTH}x${CONFIG.CANVAS_LIMITS.MAX_HEIGHT}px)`);
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
        top: qrPos.y,
        left: qrPos.x,
        blend: "over",
      },
    ];

    // FIXED: Add text overlay with comprehensive error handling
    if (templateSettings.textOverlay.enabled && pesertaNama) {
      try {
        // Create text overlay SVG with validation
        textOverlayBuffer = await createTextOverlaySVG(
          pesertaNama,
          templateSettings.textOverlay,
          templateWidth
        );

        // Convert SVG to PNG with timeout
        const textPngPromise = sharp(textOverlayBuffer).png().toBuffer();
        const textTimeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Text rendering timeout")), 30000)
        );

        const textPngBuffer = await Promise.race([textPngPromise, textTimeoutPromise]);

        // Get text overlay dimensions
        const textMetadata = await sharp(textPngBuffer).metadata();
        const textWidth = textMetadata.width || 100;
        const textHeight = textMetadata.height || 50;

        // Calculate text position
        const textPos = calculateTextPosition(
          templateWidth,
          templateHeight,
          templateSettings.textOverlay,
          textWidth,
          textHeight
        );

        // Add text overlay to composite options
        compositeOptions.push({
          input: textPngBuffer,
          top: textPos.y,
          left: textPos.x,
          blend: "over",
        });

        console.log(
          `Text overlay applied for ${participantId}: "${pesertaNama}" at position (${textPos.x}, ${textPos.y})`
        );
      } catch (textError) {
        console.error(`Error creating text overlay for ${participantId}:`, textError);
        // Continue without text overlay instead of failing completely
        console.log(`Proceeding without text overlay for ${participantId}`);
      }
    }

    // FIXED: Enhanced canvas size calculation with limits
    const canvasWidth = Math.min(
      Math.max(
        templateWidth,
        qrPos.x + qrSize + 100,
        templateSettings.textOverlay.enabled
          ? Math.abs(templateSettings.textOverlay.offsetX) + 2000
          : 0
      ),
      CONFIG.CANVAS_LIMITS.SAFE_WIDTH
    );

    const canvasHeight = Math.min(
      Math.max(
        templateHeight,
        qrPos.y + qrSize + 100,
        templateSettings.textOverlay.enabled
          ? Math.abs(templateSettings.textOverlay.offsetY) + 1000
          : 0
      ),
      CONFIG.CANVAS_LIMITS.SAFE_HEIGHT
    );

    let result: Buffer;

    // Enhanced canvas extension logic with limits
    if (canvasWidth > templateWidth || canvasHeight > templateHeight) {
      console.log(
        `Extended canvas for ${participantId}: ${canvasWidth}x${canvasHeight} (original: ${templateWidth}x${templateHeight})`
      );

      result = await sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite([
          { input: templateBuffer, top: 0, left: 0 },
          ...compositeOptions,
        ])
        .png({
          compressionLevel: CONFIG.QR_SETTINGS.COMPRESSION_LEVEL,
          adaptiveFiltering: true,
          force: true,
        })
        .toBuffer();
    } else {
      // Standard processing within template bounds
      result = await sharp(templateBuffer)
        .composite(compositeOptions)
        .png({
          compressionLevel: CONFIG.QR_SETTINGS.COMPRESSION_LEVEL,
          adaptiveFiltering: true,
          force: true,
        })
        .toBuffer();
    }

    return result;
  } catch (error: any) {
    console.error(
      `Template processing error for ${participantId} (attempt ${retryCount + 1}):`,
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
        retryCount + 1,
        participantId
      );
    }

    throw new Error(
      `Template processing failed for ${participantId}: ${error?.message || "Unknown error"}`
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

// FIXED: Enhanced batch processor with better error handling and tracking
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
  let fallbackCount = 0;
  const errors: string[] = [];
  const divisiProcessed: string[] = [];
  const skippedParticipants: string[] = [];

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
    `Initializing enhanced processing with ${processingDesc}...`
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
      `Processing divisi: ${divisiName} with enhanced error handling`,
      divisiName
    );

    const sanitizedDivisiName = sanitizeFilename(divisiName);
    divisiData[sanitizedDivisiName] = [];

    // FIXED: Track filenames to prevent duplicates
    const usedFilenames = new Set<string>();

    // Process divisi in smaller batches
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
        }/${totalBatches} with comprehensive error handling`,
        divisiName
      );

      // FIXED: Process batch with individual error handling
      const batchResults = await Promise.allSettled(
        batch.map(async (peserta, index) => {
          try {
            // Validate participant data
            if (!peserta.unique_id || !peserta.nim) {
              throw new Error("Missing required participant data");
            }

            let participantName = peserta.nama_lengkap;
            if (!participantName || participantName.trim().length === 0) {
              console.warn(`Empty name for ${peserta.unique_id}, using fallback`);
              participantName = peserta.nim || peserta.unique_id || "Unknown";
            }

            const qrData = generateQRData(peserta);

            // Apply template with enhanced error handling
            const processedImageBuffer = await Promise.race([
              applyQRAndTextToTemplate(
                templateBuffer,
                qrData,
                templateSettings,
                participantName,
                {
                  qr_size: 400,
                  margin: 2,
                  dark_color: "#000000",
                  light_color: "#FFFFFF",
                  error_correction: "M",
                },
                0,
                peserta.unique_id
              ),
              new Promise<never>(
                (_, reject) =>
                  setTimeout(() => reject(new Error("Processing timeout")), 60000)
              ),
            ]);

            // FIXED: Generate unique filename
            let fileName = formatQRFilename(peserta, true);
            let fileIndex = 0;
            
            while (usedFilenames.has(fileName)) {
              fileName = formatQRFilename(peserta, true, fileIndex, `retry`);
              fileIndex++;
              if (fileIndex > 100) {
                throw new Error("Could not generate unique filename");
              }
            }
            
            usedFilenames.add(fileName);

            return {
              success: true,
              data: {
                fileName,
                buffer: processedImageBuffer,
                participantId: peserta.unique_id,
                participantName: participantName
              }
            };

          } catch (error: any) {
            console.error(
              `Error processing template for ${peserta.unique_id}:`,
              error?.message || error
            );
            
            return {
              success: false,
              error: error?.message || "Unknown error",
              participantId: peserta.unique_id,
              participantName: peserta.nama_lengkap || peserta.unique_id
            };
          }
        })
      );

      // FIXED: Process results with fallback handling
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          // Success case
          divisiData[sanitizedDivisiName].push({
            fileName: result.value.data.fileName,
            buffer: result.value.data.buffer
          });
          processedCount++;
          
        } else {
          // Error case - attempt fallback
          const errorInfo = result.status === 'fulfilled' 
            ? result.value 
            : { 
                participantId: 'unknown', 
                participantName: 'unknown',
                error: result.reason?.message || 'Promise rejected' 
              };

          const participantId = errorInfo.participantId;
          const participantName = errorInfo.participantName;
          const errorMsg = `${participantId} (${divisiName}): ${errorInfo.error}`;
          
          console.error(`Primary processing failed for ${participantId}, attempting fallback`);
          errors.push(errorMsg);

          // FIXED: Comprehensive fallback to simple QR
          try {
            const peserta = batch.find(p => p.unique_id === participantId);
            if (peserta) {
              const qrData = generateQRData(peserta);
              const qrBuffer = await QRCode.toBuffer(qrData, {
                type: "png",
                width: 300,
                margin: 2,
                color: { dark: "#000000", light: "#FFFFFF" },
                errorCorrectionLevel: "M",
              });

              // Generate fallback filename
              let fallbackFileName = formatQRFilename(peserta, false, undefined, "fallback");
              let fallbackIndex = 0;
              
              while (usedFilenames.has(fallbackFileName)) {
                fallbackFileName = formatQRFilename(peserta, false, fallbackIndex, "fallback");
                fallbackIndex++;
              }
              
              usedFilenames.add(fallbackFileName);

              divisiData[sanitizedDivisiName].push({
                fileName: fallbackFileName,
                buffer: qrBuffer,
              });

              processedCount++;
              fallbackCount++;
              console.log(`Fallback QR created successfully for ${participantId}`);
              
            } else {
              console.error(`Could not find participant data for ${participantId}`);
              skippedParticipants.push(participantId);
              errorCount++;
            }
          } catch (fallbackError) {
            console.error(
              `Fallback also failed for ${participantId}:`,
              fallbackError
            );
            errors.push(
              `${participantId} (${divisiName}): Both primary and fallback processing failed`
            );
            skippedParticipants.push(participantId);
            errorCount++;
          }
        }
      }

      // Update progress
      totalProcessed += batch.length;
      progressCallback?.(
        totalProcessed,
        filteredRows.length,
        `Completed ${divisiName} - batch ${batchIndex + 1}/${totalBatches} (${processedCount} processed, ${errorCount} failed)`,
        divisiName
      );

      // Memory cleanup between batches
      if (batchIndex % 3 === 0 && global.gc) {
        global.gc();
        await delay(200);
      }
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
    `Enhanced template processing completed: ${processedCount} processed, ${fallbackCount} fallbacks, ${errorCount} failed`
  );

  return { 
    divisiData, 
    processedCount, 
    errorCount, 
    errors, 
    divisiProcessed,
    skippedParticipants,
    fallbackCount
  };
}

function isRetryableError(error: any): boolean {
  const retryableMessages = ["timeout", "memory", "ECONNRESET", "ETIMEDOUT", "ENOMEM"];
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

    // Bulk QR download
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

    // Enhanced template processing with comprehensive error handling
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

      // Parse template settings
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

      // Use enhanced batch processor
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
            errors: result.errors,
            skipped_participants: result.skippedParticipants,
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

      const processingTime = Date.now() - startTime;
      const summaryData = {
        total_processed: result.processedCount,
        total_errors: result.errorCount,
        fallback_count: result.fallbackCount,
        skipped_participants: result.skippedParticipants,
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
          },
          text_overlay: templateSettings.textOverlay.enabled
            ? {
                position_preset: templateSettings.textOverlay.preset,
                font_settings: {
                  family: templateSettings.textOverlay.fontFamily,
                  size: `${templateSettings.textOverlay.fontSize}px`,
                  weight: templateSettings.textOverlay.fontWeight,
                  color: templateSettings.textOverlay.fontColor,
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
                },
                text_content: "nama_lengkap dari database",
              }
            : null,
        },
        structure: "organized_by_divisi_with_qr_and_text_overlay",
        file_naming_format: "nim_nama_lengkap_uniqueid_template.png",
        processing_features: {
          qr_code_generation: true,
          text_overlay_rendering: templateSettings.textOverlay.enabled,
          custom_positioning: true,
          per_divisi_organization: true,
          batch_processing: true,
          memory_optimization: true,
          comprehensive_error_handling: true,
          fallback_qr_generation: true,
          filename_uniqueness: true,
        },
        performance_metrics: {
          total_items: rows.length,
          processed_successfully: result.processedCount,
          fallback_items: result.fallbackCount,
          failed_items: result.errorCount,
          skipped_items: result.skippedParticipants.length,
          items_per_second: Math.round(
            (result.processedCount / processingTime) * 1000
          ),
          divisi_count: selectedDivisi.length,
          max_divisi_allowed: CONFIG.MAX_DIVISI_TEMPLATE,
        },
        errors: result.errors.slice(0, 50), // Include more errors for debugging
        all_errors_count: result.errors.length,
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
          level: 6,
          chunkSize: 1024 * 64,
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
      const zipFileName = `qr_template_enhanced_${divisiNames}${
        selectedDivisi.length > 3 ? "_etc" : ""
      }_${textSuffix}_${result.processedCount}processed_${result.fallbackCount}fallback_${timestamp}.zip`;

      logOperation("Enhanced Template Processing Completed", {
        fileName: zipFileName,
        fileSize: `${
          Math.round((zipBuffer.length / 1024 / 1024) * 100) / 100
        } MB`,
        totalTime: `${(totalTime / 1000).toFixed(2)}s`,
        zipTime: `${(zipTime / 1000).toFixed(2)}s`,
        processed: result.processedCount,
        fallbacks: result.fallbackCount,
        errors: result.errorCount,
        skipped: result.skippedParticipants.length,
        divisiProcessed: result.divisiProcessed,
        textOverlayEnabled: templateSettings.textOverlay.enabled,
      });

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFileName}"`,
          "Content-Length": zipBuffer.length.toString(),
          "X-Processing-Summary": `${result.processedCount}/${rows.length} processed successfully, ${result.fallbackCount} fallbacks, ${result.errorCount} failed`,
          "X-Divisi-Processed": result.divisiProcessed.join(","),
          "X-Processing-Time": totalTime.toString(),
          "X-Error-Count": result.errorCount.toString(),
          "X-Fallback-Count": result.fallbackCount.toString(),
          "X-Skipped-Count": result.skippedParticipants.length.toString(),
          "X-Text-Overlay": templateSettings.textOverlay.enabled
            ? "enabled"
            : "disabled",
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
        message: "Error saat operasi QR code dengan enhanced error handling",
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