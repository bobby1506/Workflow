import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { CropParams, CropResult } from "../types";


/**
 * Downloads an image from a URL or data URL to a temp file.
 */
async function downloadImage(url: string, destPath: string): Promise<void> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL");
    const buffer = Buffer.from(match[1], "base64");
    fs.writeFileSync(destPath, buffer);
    return;
  }

  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      `Failed to download image: ${res.status} ${url.substring(0, 80)}`,
    );
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
}

/**
 * Crops an image using Sharp with percentage-based parameters.
 * Returns the cropped image as a base64 data URL.
 * Transloadit is NOT used here — base64 works directly with Gemini Vision API.
 */
export async function cropImageWithFFmpeg(
  imageUrl: string,
  params: CropParams,
): Promise<CropResult> {
  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const inputPath = path.join(tmpDir, `nextflow_input_${ts}.jpg`);
  const outputPath = path.join(tmpDir, `nextflow_output_${ts}.jpg`);

  try {
    // Download source image
    await downloadImage(imageUrl, inputPath);

    // Get image dimensions using sharp
    const dimensions = await getImageDimensions(inputPath);
    const { width: imgW, height: imgH } = dimensions;

    // Convert percentage params to pixel values
    const cropX = Math.round((params.x / 100) * imgW);
    const cropY = Math.round((params.y / 100) * imgH);
    const cropW = Math.max(1, Math.round((params.width / 100) * imgW));
    const cropH = Math.max(1, Math.round((params.height / 100) * imgH));

    // Clamp to image bounds
    const clampedX = Math.min(cropX, imgW - 1);
    const clampedY = Math.min(cropY, imgH - 1);
    const clampedW = Math.min(cropW, imgW - clampedX);
    const clampedH = Math.min(cropH, imgH - clampedY);

    // Run crop using Sharp so we do not depend on external FFmpeg binaries.
    await sharp(inputPath)
      .extract({
        left: clampedX,
        top: clampedY,
        width: clampedW,
        height: clampedH,
      })
      .jpeg()
      .toFile(outputPath);

    // Read cropped file and return as base64 data URL
    // Base64 works directly with Gemini Vision API — no CDN upload needed
    const outputBuffer = fs.readFileSync(outputPath);
    const base64 = outputBuffer.toString("base64");
    const outputUrl = `data:image/jpeg;base64,${base64}`;
    const size = outputBuffer.length;

    return {
      outputUrl,
      mimeType: "image/jpeg",
      size,
    };
  } finally {
    try {
      fs.unlinkSync(inputPath);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(outputPath);
    } catch {
      /* ignore */
    }
  }
}

function getImageDimensions(
  filePath: string,
): Promise<{ width: number; height: number }> {
  return sharp(filePath).metadata().then((metadata) => {
    if (!metadata.width || !metadata.height) {
      throw new Error("Could not determine image dimensions");
    }

    return { width: metadata.width, height: metadata.height };
  });
}
