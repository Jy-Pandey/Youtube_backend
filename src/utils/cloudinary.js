import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });
cloudinary.config({
  cloud_name: "dxnw3ywcn",
  api_key: "754161352441727",
  api_secret: "JTHo88wY0b7TQly76qlj0VgNHOI",
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log("File uploaded on Cloudinary", response.url);
    fs.unlinkSync(localFilePath); //remove the locally saved file
    return response;
  } catch (error) {
    console.log("Error while saving on cloudinary !!", error);
    fs.unlinkSync(localFilePath); //remove the locally saved file

  }
}

export {uploadOnCloudinary}