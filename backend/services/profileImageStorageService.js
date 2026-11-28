import sharp from "sharp";
import path from "node:path";

import {
  mkdir,
  writeFile,
  unlink,
} from "node:fs/promises";

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(
  fileURLToPath(import.meta.url)
);

export const PROFILE_DIRECTORY = path.resolve(
  currentDirectory,
  "../uploads/profiles"
);

export const MAX_PROFILE_IMAGE_SIZE =
  5 * 1024 * 1024;

export const PROFILE_IMAGE_SIZE = 256;

const allowedFormats = new Set([
  "jpeg",
  "png",
  "webp",
]);

export class ProfileImageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProfileImageValidationError";
  }
}

export function isValidProfileFileName(fileName) {
  return (
    typeof fileName === "string" &&
    /^profile-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(
      fileName
    )
  );
}

export async function saveProfileImage(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw new ProfileImageValidationError(
      "Profile image is required."
    );
  }

  if (buffer.length > MAX_PROFILE_IMAGE_SIZE) {
    throw new ProfileImageValidationError(
      "Profile image must not exceed 5 MB."
    );
  }

  let processedImage;

  try {
    const image = sharp(buffer, {
      limitInputPixels: 20000000,
      failOn: "error",
    });

    const metadata = await image.metadata();

    if (!allowedFormats.has(metadata.format)) {
      throw new ProfileImageValidationError(
        "Only JPG, PNG and WebP images are allowed."
      );
    }

    if (
      !metadata.width ||
      !metadata.height ||
      (metadata.pages || 1) > 1
    ) {
      throw new ProfileImageValidationError(
        "Invalid or animated profile image."
      );
    }

    processedImage = await image
      .rotate()
      .resize(
        PROFILE_IMAGE_SIZE,
        PROFILE_IMAGE_SIZE,
        {
          fit: "cover",
          position: "centre",
        }
      )
      .webp({
        quality: 85,
      })
      .toBuffer();

  } catch (error) {
    if (
      error instanceof ProfileImageValidationError
    ) {
      throw error;
    }

    throw new ProfileImageValidationError(
      "Invalid or unsupported image file."
    );
  }

  await mkdir(PROFILE_DIRECTORY, {
    recursive: true,
  });

  const fileName =
    `profile-${randomUUID()}.webp`;

  const filePath = path.join(
    PROFILE_DIRECTORY,
    fileName
  );

  try {
    await writeFile(
      filePath,
      processedImage,
      { flag: "wx" }
    );
  } catch (error) {
    if (error.code !== "EEXIST") {
      await unlink(filePath).catch(() => {});
    }

    throw error;
  }

  return {
    fileName,
    filePath,
  };
}

export async function deleteProfileImage(fileName) {
  if (!isValidProfileFileName(fileName)) {
    return;
  }

  try {
    await unlink(
      path.join(
        PROFILE_DIRECTORY,
        fileName
      )
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Profile image cleanup failed:",
        error.code
      );
    }
  }
}