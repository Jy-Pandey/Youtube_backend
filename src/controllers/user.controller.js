import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import { v2 as cloudinary } from "cloudinary";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async(userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // save refresh token into database
    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave : false})

    // now you have both access and refresh token
    return {accessToken, refreshToken};

  } catch (error) {
    throw new ApiError(500, "Error while generating access and refresh token");
  }
}
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

  const { fullName, username, email, password } = req.body;

  // if (!fullName || !username || !email || !password) {
  //   throw new ApiError(400, "All fields are required");
  // }
  // The some() method checks if at least one element in an array passes the test implemented by the provided function.
  // Returns → true if at least one element passes the test, else false

  if (
    [fullName, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (existedUser) {
    throw new ApiError(409, "User already exist");
  }

  //Log file
  // req.files tabhi available hota hai jab aap apne Node.js app me multer middleware use karte ho file upload ke liye.
  // console.log(req.files); // it is a object of arr ,, { avatar[], coverImage[]}

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar file is required");
  }

  //upload on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  // console.log("cover image path" , coverImageLocalPath);

  let coverImage = "";
  if (coverImageLocalPath) {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
  }

  if (!avatar) {
    throw new ApiError(400, "avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage.url || "",
    username: username.toLowerCase(),
    password,
    email,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User is created successfully"));
})

const loginUser = asyncHandler( async(req, res) => {
  // Take username, email, password from request.body
  // Perform validation
  // Check if the user doesnot exist then throw the error
  // If exist .. check password match hashed password with original password usin bcrypt
  // If password is wrong throw error
  // Set access token and refresh token
  // Send cookie
  
 
  // res.send("Login controller");
  
  const {username, email, password} = req.body;
  
  if(!username && !email) {
    throw new ApiError(400, "Username or password is required");
  }

  const user = await User.findOne({
    $or : [{username}, {email}]
  })

  if(!user) {
    throw new ApiError(404, "User doesnot exist");
  }
  
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

  // Abhi jo user hai mere pass uske pass refresh token nhi hai to nya user database se lana padega
  const loggedInUser = await User.findById(user._id).
  select("-password -refreshToken");

  //* cookies can be set using res and can be accesed using req
  const options = {
    httpOnly: true, //The cookie cannot be accessed or modified using JavaScript prevent XSS attack
    secure: true, //The cookie is only sent over HTTPS connections from browser to server.
  };

  res.status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(new ApiResponse(
    200,
    {
      user : loggedInUser, accessToken, refreshToken
    },
    "User loggedIn successFully"
  ))

} )

const logoutUser = asyncHandler( async(req, res) => {
  // user delete krte vakt uske accessToken and refreshToken ko clear karna padega
  // yha to user ki id hai nhi to kaunse user ko delte karna hai kaise find kare?
  // to ek middleware likhenge jo pehle verify karega ki jisne request bheji h vo correct user hai 
  // ya nhi .. uske tokens verify karke 
  // token verify ho jaega to usi token me se stored user id nikal lenge us se ham user easily find kr skte h
  // fir us user ka refresh token delete kr denge
  // aur access token ko clear kar denge
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset : {
        refreshToken : 1
      }
    },
    {
      new : true
    }
  )

  const options = {
    httpOnly: true, //The cookie cannot be accessed or modified using JavaScript prevent XSS attack
    secure: true, //The cookie is only sent over HTTPS connections from browser to server.
  };

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler( async(req, res) => {

  const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if(!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request while refreshing access token");
  }
  try {
    // verify this incoming token with stored refresh token of user
    // for that first check the incomingToken is valid refreshToken or not
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  
    // is se user find karo , Found -> generate new Access & refresh token
    const user = await User.findById(decodedToken?._id);
  
    if(!user) {
      throw new ApiError(401, "invalid refresh token");
    }
  
    if(incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired");
    }
  
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);
  
    const options = {
      httpOnly: true, 
      secure: true,
    };
  
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access Token is refreshed"
        )
      );
  } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh Token");
  }
})

const changeCurrentPassword = asyncHandler( async(req, res) => {
  // verifyJwt middleware is executed so we have req.user

  const {oldPassword, newPassword} = req.body;
  console.log("oldPassword", oldPassword);
  
  const user = await User.findById(req.user?._id);

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if(!isPasswordValid) {
    throw new ApiError(400, "Invalid old password")
  }

  user.password = newPassword;
  await user.save({validateBeforeSave : false});

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));

})

const getCurrentUser = asyncHandler(async(req, res) => {
  const user = await User.findById(req.user?._id);
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User fetched successfully"));
})

const updateAccountDetails = asyncHandler( async(req, res) => {

  const {fullName, email} =  req.body;

  // dono me se ek bhi nhi hai to error do
  if(!fullName || !email) {
    throw new ApiError(401, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set : { // update the fields
        fullName : fullName,
        email : email
      }
    },
    {new : true} //return updated object
  ).select(" -password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));

})

const updateUserAvatar = asyncHandler(async(req, res) => {
  // user ne jo updated file bheji hogi multer use server pr upload karva dega fir use access krk 
  // db me update kar denge

  const avatarLocalPath = req.file?.path; // only single file aayegi isliye file not files

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // delete prevously stored file , you can delete using public id of that image
  const user = await User.findById(req.user?._id);
  if(user && user.avatar) {
    const previousAvatarUrl = user.avatar;
    // "http://res.cloudinary.com/dxnw3ywcn/image/upload/v1744906204/meb8tca8puxh5jz870bq.jpg"
    const previousAvatarPublicId = previousAvatarUrl.split('/').pop().split('.')[0]; //meb8tca8puxh5jz870bq
    await cloudinary.uploader.destroy(previousAvatarPublicId);
  }

  // upload the new avatar to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");    
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar : avatar.url
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Avatar file is updated successfully")
    );

})

const updateUserCoverImage = asyncHandler(async(req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverImage file is required");
  }

  // delete prevously stored file , you can delete using public id of that image
  const user = await User.findById(req.user?._id);
  if (user && user.coverImage) {
    const previousCoverImageUrl = user.coverImage;
    const previousCoverImagePublicId = previousCoverImageUrl.split("/").pop().split(".")[0];
    await cloudinary.uploader.destroy(previousCoverImagePublicId);
  }

  // upload the new coverImage to cloudinary
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading coverImage");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "Cover Image is updated successfully")
    );
})

const getUserChannelProfile = asyncHandler(async(req, res)=> {

  const {username} = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  // ab is username (channel) ki profile ki sari details lani h
  // match se is username ko access karlo
  // subscribers , subscribedTo for that channel

  const channel = await User.aggregate([
    {
      $match: { username: username?.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if(!channel?.length) {
    throw new ApiError(404, "channel does not exists");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
})

const getUserWatchHistory = asyncHandler(async(req, res) => {
  const user = await User.aggregate(
    [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.user._id),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchedVideos",

          pipeline: [
            // videos collection ke andar perform kar rhe hai
            // owner field ki details la rahe hai
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",

                pipeline: [
                  // user collection me hai
                  // owner ki required fields hi denge
                  {
                    $project: {
                      fullname: 1,
                      username: 1,
                      avatar: 1,
                    },
                  },
                ],
              },
            },
            {
              // watcedVideos arr me multible video object hai
              // un object me owner field ek array jabki usme only ek hi object hai
              // isliye use array se nikal kar direct owner me as a object store kar denge
              $addFields: {
                owner: { $arrayElemAt: ["$owner", 0] },
              },
            },
          ],
        },
      },
    ])

    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getUserWatchHistory,
};