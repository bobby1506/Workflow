import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { CropParams, CropResult } from "../types";
import { uploadCroppedImageToTransloadit } from "../transloadit/uploadService";

// Configure FFmpeg paths
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

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
 * Crops an image using FFmpeg with percentage-based parameters.
 * Uploads the result to Transloadit CDN and returns the CDN URL.
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

    // Get image dimensions using ffprobe
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

    // Run crop using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(`crop=${clampedW}:${clampedH}:${clampedX}:${clampedY}`)
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => {
          console.error("[FFmpeg] Crop error:", err);
          reject(new Error(`FFmpeg crop failed: ${err.message}`));
        })
        .run();
    });

    // Upload cropped image to Transloadit CDN
    const outputBuffer = fs.readFileSync(outputPath);
    const size = outputBuffer.length;

    const outputUrl = await uploadCroppedImageToTransloadit(
      outputBuffer,
      `cropped_${ts}.jpg`,
      "image/jpeg",
    );

    return {
      outputUrl,
      mimeType: "image/jpeg",
      size,
    };
  } finally {
    // Cleanup temp files
    [inputPath, outputPath].forEach((p) => {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {
          /* ignore */
        }
      }
    });
  }
}

/**
 * Uses ffprobe to determine image dimensions.
 */
function getImageDimensions(
  filePath: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error("[FFmpeg] Probe error:", err);
        return reject(new Error(`FFmpeg probe failed: ${err.message}`));
      }

      const stream = metadata.streams[0];
      if (stream && typeof stream.width === "number" && typeof stream.height === "number") {
        resolve({ width: stream.width, height: stream.height });
      } else {
        reject(new Error("Could not determine image dimensions using ffprobe"));
      }
    });
  });
}
