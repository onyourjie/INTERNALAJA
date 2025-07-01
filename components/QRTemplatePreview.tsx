import QRCode from 'qrcode';
import React, { useEffect, useRef } from 'react';

interface QRSettings {
  preset: string;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface TextOverlaySettings {
  enabled: boolean;
  preset: string;
  offsetX: number;
  offsetY: number;
  fontSize: number;
  fontWeight: string;
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  padding: number;
  borderRadius: number;
  textAlign: string;
  fontFamily: string;
}

interface QRTemplatePreviewProps {
  templateImg: string; // URL/base64
  qrSettings: QRSettings;
  textOverlaySettings: TextOverlaySettings;
  namaPeserta: string;
  onValidChange?: (valid: boolean) => void;
  width?: number;
  height?: number;
}

const QRTemplatePreview: React.FC<QRTemplatePreviewProps> = ({
  templateImg,
  qrSettings,
  textOverlaySettings,
  namaPeserta,
  onValidChange,
  width = 720,
  height = 1280,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [warning, setWarning] = React.useState<string | null>(null);

  useEffect(() => {
    const drawPreview = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Draw template image
      const img = new window.Image();
      img.src = templateImg;
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
      });
      ctx.drawImage(img, 0, 0, width, height);

      // Draw QR code
      const qrSize = Math.round(Math.min(width, height) * qrSettings.scale);
      let qrX = (width - qrSize) / 2 + (qrSettings.offsetX || 0);
      let qrY = (height - qrSize) / 2 + (qrSettings.offsetY || 0);
      if (qrSettings.preset === 'top-left') {
        qrX = width * 0.1 + (qrSettings.offsetX || 0);
        qrY = height * 0.1 + (qrSettings.offsetY || 0);
      } // ... (tambahkan preset lain sesuai backend)
      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(namaPeserta || 'QR');
      const qrImg = new window.Image();
      qrImg.src = qrDataUrl;
      await new Promise((res) => {
        qrImg.onload = res;
        qrImg.onerror = res;
      });
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Draw text overlay
      if (textOverlaySettings.enabled) {
        ctx.font = `${textOverlaySettings.fontWeight} ${textOverlaySettings.fontSize}px ${textOverlaySettings.fontFamily}`;
        const text = namaPeserta || 'NAMA TIDAK TERSEDIA';
        // Perhitungan dimensi text identik backend (SVG)
        let charWidth = textOverlaySettings.fontSize * 0.6;
        let textWidth = Math.max(text.length * charWidth, 100);
        let textHeight = textOverlaySettings.fontSize * 1.2;
        if (textOverlaySettings.fontSize > 200) {
          charWidth = textOverlaySettings.fontSize * 0.55;
          textWidth = text.length * charWidth;
          textHeight = textOverlaySettings.fontSize * 1.15;
        }
        if (textOverlaySettings.fontSize > 500) {
          charWidth = textOverlaySettings.fontSize * 0.5;
          textWidth = text.length * charWidth;
          textHeight = textOverlaySettings.fontSize * 1.1;
        }
        textWidth = Math.max(textWidth, textOverlaySettings.fontSize * 2);
        textHeight = Math.max(textHeight, textOverlaySettings.fontSize);
        // Padding identik backend
        const paddingMultiplier = textOverlaySettings.fontSize > 200 ? Math.max(1, textOverlaySettings.fontSize / 200) : 1;
        const adjustedPadding = textOverlaySettings.padding * paddingMultiplier;
        const bgWidth = textWidth + adjustedPadding * 2;
        const bgHeight = textHeight + adjustedPadding * 2;
        // Sinkronkan preset posisi dengan backend
        let baseX = 0;
        let baseY = 0;
        switch (textOverlaySettings.preset) {
          case 'center':
            baseX = (width - bgWidth) / 2;
            baseY = (height - bgHeight) / 2;
            break;
          case 'top':
            baseX = (width - bgWidth) / 2;
            baseY = height * 0.1;
            break;
          case 'bottom':
            baseX = (width - bgWidth) / 2;
            baseY = height * 0.9 - bgHeight;
            break;
          case 'left':
            baseX = width * 0.05;
            baseY = (height - bgHeight) / 2;
            break;
          case 'right':
            baseX = width * 0.95 - bgWidth;
            baseY = (height - bgHeight) / 2;
            break;
          case 'custom':
            baseX = (width - bgWidth) / 2;
            baseY = (height - bgHeight) / 2;
            break;
        }
        const textX = baseX + (textOverlaySettings.offsetX || 0);
        const textY = baseY + (textOverlaySettings.offsetY || 0);
        // Validasi posisi
        let valid = true;
        setWarning(null);
        if (
          textX < 0 ||
          textY < 0 ||
          textX + bgWidth > width ||
          textY + bgHeight > height
        ) {
          setWarning('Text overlay keluar area template!');
          valid = false;
        }
        // Draw background (identik backend)
        ctx.save();
        ctx.globalAlpha = textOverlaySettings.backgroundOpacity;
        ctx.fillStyle = textOverlaySettings.backgroundColor;
        ctx.fillRect(textX, textY, bgWidth, bgHeight);
        ctx.restore();
        // Draw text (identik backend, center)
        ctx.fillStyle = textOverlaySettings.fontColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${textOverlaySettings.fontWeight} ${textOverlaySettings.fontSize}px ${textOverlaySettings.fontFamily}`;
        ctx.fillText(
          text,
          textX + bgWidth / 2,
          textY + bgHeight / 2 + textOverlaySettings.fontSize / 3
        );
        // Draw outline/garis bantu
        ctx.save();
        ctx.strokeStyle = valid ? 'rgba(0,200,0,0.7)' : 'rgba(255,0,0,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(textX, textY, bgWidth, bgHeight);
        ctx.restore();
        if (onValidChange) onValidChange(valid);
      }
    };
    drawPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateImg, qrSettings, textOverlaySettings, namaPeserta, width, height]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ border: '1px solid #aaa', background: '#fff' }} />
      {warning && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(255,0,0,0.8)',
          color: '#fff',
          padding: 8,
          borderRadius: 4,
          zIndex: 10,
        }}>
          {warning}
        </div>
      )}
    </div>
  );
};

export default QRTemplatePreview; 