import multer from "multer";

import {
  MAX_LOGO_SIZE,
} from "../services/logoStorageService.js";

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),

 limits: {
  fileSize: MAX_LOGO_SIZE,
  files: 1,
  fields: 1,
  fieldSize: 100,
  parts: 3,
},

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error(
          "Only PNG, JPG, JPEG and WEBP images are allowed."
        )
      );
    }

    callback(null, true);
  },
});

export const uploadShopLogo = (req, res, next) => {
  upload.single("logo")(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "Logo image must not exceed 10 MB.",
          });
        }

        return res.status(400).json({
          success: false,
          message: "Invalid logo upload request.",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Logo image is required.",
      });
    }

    next();
  });
};