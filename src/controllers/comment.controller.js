import mongoose, {isValidObjectId} from "mongoose";
import { Comment } from "../models/comment.model.js";
import {Video} from "../models/video.model.js"
import {Like} from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //-TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const video = await Video.findById(videoId);

  console.log("Get all comments");
  
  if(!video) {
    throw new ApiError(404, "Video not found");
  }
  const commentAggregate = [
    {
      $match: { video: new mongoose.Types.ObjectId(videoId) },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likes: { $size: "$likes" },
        isLiked : {
          $cond : {
            if : {$in : [req.user?._id, "$likes.likedBy"]},
            then : true,
            else : false
          }
        }
      },
    },
    {
      $project: {
        content: 1,
        likes: 1,
        isLiked : 1
      },
    },
  ];

  const options = {
    page : parseInt(page),
    limit : parseInt(limit)
  }
  const commentsArr = await Comment.aggregatePaginate(commentAggregate, options);

  return res
  .status(200)
  .json(
    new ApiResponse(200, commentsArr, "all comments fetched succefully")
  )
});

const addComment = asyncHandler(async (req, res) => {
  // -TODO: add a comment to a video
  const { videoId } = req.params;
  const {content} = req.body;

  if(content.trim() === "") {
    throw new ApiError(401, "Content is required");
  }

  if(!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId")
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const comment = await Comment.create({
    content,
    video : videoId,
    owner : req.user?._id
  })
  if (!comment) {
    throw new ApiError(500, "Error in uploading comments");
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, comment, "Comment addedd successfully")
  )


});

const updateComment = asyncHandler(async (req, res) => {
  // -TODO: update a comment
  const { commentId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid commentId");
  }
  if (content.trim() === "") {
    throw new ApiError(401, "Content is required");
  }

  const comment = await Comment.findById(commentId);

  // If you are owner of this comment then only u can update
  if(comment?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(404, "You cant update as you are not the owner");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    comment?._id,
    {
      $set : {
        content
      }
    },
    {new : true}
  )
  if (!updatedComment) {
    throw new ApiError(500, "Failed to edit comment");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment edited successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // -TODO: delete a comment
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "only comment owner can delete their comment");
  }

  await Comment.findByIdAndDelete(commentId);

  // is comment ke sare likes delete karo
  await Like.deleteMany({
    comment: commentId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, comment, "Comment deleted successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
