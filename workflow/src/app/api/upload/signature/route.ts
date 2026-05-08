import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

/**
 * Generates a signed Transloadit params object for secure client-side uploads.
 * Uses /file/compress to store on Transloadit's own CDN — no S3/R2 needed.
 */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = process.env.TRANSLOADIT_KEY;
    const secret = process.env.TRANSLOADIT_SECRET;

    if (!key || !secret) {
      return NextResponse.json({
        configured: false,
        message: "Transloadit not configured — using local upload fallback",
      });
    }

    // Expires 2 hours from now
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d{3}Z$/, "+00:00");

    // Simple assembly: accept the upload and compress to JPEG
    // /file/compress stores the result on Transloadit's CDN
    const paramsObj = {
      auth: { key, expires },
      steps: {
        ":original": {
          robot: "/upload/handle",
        },
        compressed: {
          use: ":original",
          robot: "/image/resize",
          format: "jpeg",
          quality: 92,
          result: true,
        },
      },
    };

    const params = JSON.stringify(paramsObj);

    // HMAC-SHA384 signature
    const signature = crypto
      .createHmac("sha384", secret)
      .update(Buffer.from(params, "utf-8"))
      .digest("hex");

    return NextResponse.json({
      configured: true,
      params,
      signature: `sha384:${signature}`,
      expires,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
