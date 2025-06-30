/* eslint-disable no-restricted-globals */
import {
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
  QRCodeReader,
} from '@zxing/library'

let cvs: OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D
let det: BarcodeDetector | null = null
const read = new QRCodeReader()

self.onmessage = async (e) => {
  const { type } = e.data
  if (type === 'INIT') {
    cvs = e.data.canvas
    ctx = cvs.getContext('2d', { willReadFrequently: true })!
    if ('BarcodeDetector' in self) det = new BarcodeDetector({ formats: ['qr_code'] })
  }
  if (type === 'SCAN') {
    const img = ctx.getImageData(0, 0, cvs.width, cvs.height)
    let txt: string | null = null
    try {
      if (det) {
        const r = await det.detect(img)
        if (r[0]) txt = r[0].rawValue
      } else {
        const src = new RGBLuminanceSource(img.data, cvs.width, cvs.height)
        const bin = new BinaryBitmap(new HybridBinarizer(src))
        const r = read.decode(bin)
        if (r) txt = r.getText()
      }
      if (txt) (self as any).postMessage({ type: 'QR', text: txt })
    } catch {
      /* ignore */
    }
  }
}
