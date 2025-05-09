import multer from "multer";

const storage = multer.diskStorage({
  destination : function(req, file, cb) {
    cb(null, "./public/temp"); // app.js se file ka path
  },
  filename : function(req, file, cb) {
    cb(null, file.originalname);
  }
})

export const upload = multer({storage : storage});