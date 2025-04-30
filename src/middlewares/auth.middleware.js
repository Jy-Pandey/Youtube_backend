import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";


export const verifyJWT = asyncHandler( async(req, _, next) => {

  try {
    //token ya to req me aayega ya header se to use wha se extract karlo
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    //verify token
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    if(!decodedToken) {
      throw new ApiError(401, "Invalid decoded token");
    }
    const user = User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if(!user) {
      throw new ApiError(401, "Invalid access token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
})