import multer from "multer";

import {
  MAX_PROFILE_IMAGE_SIZE,
} from "../services/profileImageStorageService.js";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_PROFILE_IMAGE_SIZE,
    files: 1,
    fields: 0,
    parts: 2,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error(
          "Only JPG, PNG and WebP images are allowed."
        )
      );
    }

    callback(null, true);
  },
});

export const uploadProfileImage = (
  req,
  res,
  next
) => {
  upload.single("profileImage")(
    req,
    res,
    (error) => {
      if (error) {
        if (
          error instanceof multer.MulterError
        ) {
          return res.status(400).json({
            success: false,
            message:
              error.code === "LIMIT_FILE_SIZE"
                ? "Profile image must not exceed 5 MB."
                : "Invalid image upload request.",
          });
        }

        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (!req.file?.buffer) {
        return res.status(400).json({
          success: false,
          message: "Profile image is required.",
        });
      }

      next();
    }
  );
};