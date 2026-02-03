const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const catchAsync = require("../utilts/catch.Async");
const AppError = require("../utilts/app.Error");

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Only image files are allowed", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

exports.uploadSingle = (field) => upload.single(field);

exports.uploadFields = (fields) => upload.fields(fields);

const uploadBufferToCloudinary = async (file, folder) => {
  return cloudinary.uploader.upload(
    `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
    {
      folder,
      resource_type: "image",
      transformation: [
        { quality: "auto" },
        { fetch_format: "auto" },
      ],
    }
  );
};

exports.uploadToCloudinary = catchAsync(async (req, res, next) => {
  if (!req.file && (!req.files || Object.keys(req.files).length === 0)) {
    return next();
  }

  const folderMap = {
    photo: "CLYNK/photos",

  };

  if (req.file) {
    const field = req.file.fieldname;
    const folder = folderMap[field] || "CLYNK/photos";

    const result = await uploadBufferToCloudinary(req.file, folder);

    req.body[field] = result.secure_url;
  }

  if (req.files) {
    for (const fieldName of Object.keys(req.files)) {
      const files = req.files[fieldName];
      if (!files || !files.length) continue;

      const folder = folderMap[fieldName] || "CLYNK/photos";

      const uploads = [];

      for (const file of files) {
        const result = await uploadBufferToCloudinary(file, folder);
        uploads.push(result.secure_url);
      }

      req.body[fieldName] = uploads.length === 1 ? uploads[0] : uploads;
    }
  }

  next();
});
