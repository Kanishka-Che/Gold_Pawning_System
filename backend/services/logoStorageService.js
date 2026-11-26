import sharp from "sharp";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

export const LOGO_DIRECTORY = path.resolve(
  __dirname,
  "../uploads/logos"
);

export const MAX_LOGO_SIZE = 10 * 1024 * 1024;

const MAX_INPUT_PIXELS = 16_000_000;

const ALLOWED_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
]);

// Custom error for invalid logo images
export class LogoValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "LogoValidationError";
    this.statusCode = 400;
  }
}

export async function saveShopLogo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new LogoValidationError(
      "Logo image is required."
    );
  }

 if (buffer.length > MAX_LOGO_SIZE) {
  throw new LogoValidationError(
    "Logo image must not exceed 10 MB."
  );
}

  let processedImage;

  // Image validation and processing
  try {
    const image = sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "warning",
    });

    const metadata = await image.metadata();

    if (!ALLOWED_FORMATS.has(metadata.format)) {
      throw new LogoValidationError(
        "Only PNG, JPG, JPEG and WEBP images are allowed."
      );
    }

    if (!metadata.width || !metadata.height) {
      throw new LogoValidationError(
        "Invalid image dimensions."
      );
    }

    if ((metadata.pages ?? 1) > 1) {
      throw new LogoValidationError(
        "Animated images are not allowed."
      );
    }

    processedImage = await image
      .rotate()
      .resize({
        width: 600,
        height: 600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

  } catch (error) {
    if (error instanceof LogoValidationError) {
      throw error;
    }

    if (
      error.message?.includes("exceeds pixel limit")
    ) {
      throw new LogoValidationError(
        "Logo image exceeds the maximum pixel limit."
      );
    }

    throw new LogoValidationError(
      "Invalid or corrupted logo image."
    );
  }

  // File storage errors remain server errors
  await mkdir(LOGO_DIRECTORY, {
    recursive: true,
  });

  const fileName = `logo-${randomUUID()}.png`;

  const filePath = path.join(
    LOGO_DIRECTORY,
    fileName
  );

  await writeFile(filePath, processedImage, {
    flag: "wx",
  });

  return {
    fileName,
    filePath,
    logoUrl: `/api/system-settings/logos/${fileName}`,
  };
}