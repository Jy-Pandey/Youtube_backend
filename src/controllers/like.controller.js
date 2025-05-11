import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import {Tweet} from "../models/tweet.model.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // -TODO: toggle like on video
  // First check the video with this is exist or not
  // Ab dekho kya pure like collection me ki maine is video par like kiya hai ya nhi ,, find(videoId, req.user?._id)
  // Agar kiya hai to us obj ko delete kardo 
  // Nhi kiya hoto ek nya object like me add kardo with this video and liked by me karke
  // return response

  if(!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId")
  }

  const video = await Video.findById(videoId);
  if(!video) {
    throw new ApiError(404, "Video does not exist")
  }
  // return first matched document
  const isLiked = await Like.findOne({
    video : videoId,
    likedBy : req.user?._id,
  })
  // console.log("Value of is Liked", isLiked);
  
  if(isLiked) {
    await Like.deleteOne({
      video: videoId,
      likedBy: req.user?._id,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { isLiked: false }, "Unliked video successfully"));
  }

  // else part
  await Like.create({
    video : videoId,
    likedBy : req.user?._id,
  })
  return res
    .status(200)
    .json(new ApiResponse(200, { isLiked: true }, " Toggle video - liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  // -TODO: toggle like on comment

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid commentId");
  }
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment does not exist");
  }
  // return first matched document
  const isLiked = await Like.findOne({
    comment: commentId,
    likedBy: req.user?._id,
  });
  // console.log("Value of is Liked", isLiked);

  if (isLiked) {
    await Like.deleteOne({
      comment: commentId,
      likedBy: req.user?._id,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { isLiked: false }, "Comment Unliked successfully"));
  }

  // else part
  await Like.create({
    comment: commentId,
    likedBy: req.user?._id,
  });
  return res
    .status(200)
    .json(
      new ApiResponse(200, { isLiked: true }, " Toggle comment - liked successfully")
    );
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  // -TODO: toggle like on tweet

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweetId");
  }
  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet does not exist");
  }
  // return first matched document
  const isLiked = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user?._id,
  });
  // console.log("Value of is Liked", isLiked);

  if (isLiked) {
    await Like.deleteOne({
      tweet: tweetId,
      likedBy: req.user?._id,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { isLiked: false }, "Unliked tweet successfully"));
  }

  // else part
  await Like.create({
    tweet: tweetId,
    likedBy: req.user?._id,
  });
  return res
    .status(200)
    .json(
      new ApiResponse(200, { isLiked: true }, " Toggle tweet - liked successfully")
    );
});

const getLikedVideos = asyncHandler(async (req, res) => {
  // -TODO: get all liked videos

  const likedVideosAggregate = await Like.aggregate([
    {
      $match: { likedBy: new mongoose.Types.ObjectId(req.user?._id) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideo",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                    email: 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: "$owner", // Array se object bnakr owner me store,, u can use addFields also
          },
        ],
      },
    },
    {
      $unwind: "$likedVideo", // ek single object banado array sse nikal ke
    },
    {
      $addFields: {
        video: "$likedVideo",
      },
    },
    {
      // latest liked video ka object sabse upar
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        _id: 0,
        likedVideo: 0,
        updatedAt : 0
      },
    },
  ]);

  // console.log("Liked videos by user : ", req.user?.username, likedVideosAggregate);

  return res
  .status(200)
  .json(
    new ApiResponse(200, likedVideosAggregate, "Liked Videos fetched successfully")
  )
  
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
