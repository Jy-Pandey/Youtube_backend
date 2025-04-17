import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { User } from "../models/user.model.js";

const registerUser = asyncHandler (async (req, res) => {
  // Take the required fields from request.body like username fullname etc
  // Validation - Check that all required fields are not empty
  // Check if user already exist - through email or username
  // Check the files are provided or not - Avtar, Cover Image
  // Upload on cloudinary , Avtar
  // Create User object and - Create entry in DB
  // Remove password and refresh token field from response
  // Check user is successfully created
  // return user

  console.log("From user register controller");
  
  const { fullName, username, email, password} = req.body;

  // if (!fullName || !username || !email || !password) {
  //   throw new ApiError(400, "All fields are required");
  // }
  // The some() method checks if at least one element in an array passes the test implemented by the provided function.
  // Returns → true if at least one element passes the test, else false

  if(
    [fullName, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or : [{email}, {username}]
  })
  if(existedUser) {
    throw new ApiError(409, "User already exist");
  } 

  //Log file
  // console.log(req.files);

  const avatarLocalPath = req.files ?.avatar[0]?.path
  // const coverImageLocalPath = req.files?.coverImage[0]?.path

  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if(!avatarLocalPath) {
    throw new ApiError(400, "avatar file is required");
  }

  //upload on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  // console.log("cover image path" , coverImageLocalPath);
  
  let coverImage = "";
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath); 
  }

  if(!avatar) {
    throw new ApiError(400, "avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar : avatar.url,
    coverImage : coverImage.url || "",
    username : username.toLowerCase(),
    password,
    email
  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if(!createdUser) {
    throw new ApiError(500, "Something went wrong while creating user");
  }

  return res.status(200).json(
    new ApiResponse(200, createdUser, "User is created successfully")
  );
})

export {registerUser}