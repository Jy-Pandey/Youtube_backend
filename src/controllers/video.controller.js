import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  // -TODO: get all videos based on query, sort, pagination
  // hame ye jo query word aayega find krne ke liye hamne title aur description par search index
  // lagaya hai jo efficiently find karega.
  // us index ke basis par search kar denge
  // available documents ko sort kar denge in given sortBy order me

  const pipeline = [];
  if (query) {
    pipeline.push({
      $search: {
        index: "search-videos",
        text: {
          query: query,
          path: ["title", "description"],
        },
      },
    });
  }
  // fetch videos only that are set isPublished as true
  pipeline.push({ $match: { isPublished: true } });

  //sortBy can be views, createdAt, duration
  //sortType can be ascending(-1) or descending(1)
  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1: -1,
        // views : -1
      },
    });
  } 
  else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  // Add owner details
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "owner",
      foreignField: "_id",
      as: "owner",
      pipeline: [
        {
          $project: {
            username: 1,
            email: 1,
            avatar: 1,
          },
        },
      ],
    },
  });

  // const videoAggregate = await Video.aggregate(pipeline);

  // Pagination : “Large data ko chhote chhote pages mein divide karna.”
  // page 1 , limit 10 .. first page me 10 docs aayenge
  const options = {
    page : parseInt(page),
    limit : parseInt(limit)
  };

  const video = await Video.aggregatePaginate(pipeline, options);
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  //  -TODO: get video, upload to cloudinary, create video

  // Steps : get data from req .. validate them
  // VideoFile and thumbnail is uploaded on server through multer .. so get their localPath
  // save them on cloudinary and get the URL
  // Create new video document and save on DB
  // Return successFull response

  if (!title || !description) {
    throw new ApiError(401, "All fields are required");
  }
  // console.log(req.files);

  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "video file is required");
  }

  if (!thumbnailLocalPath) {
    throw new ApiError(401, "thumbnail is required");
  }
  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  // console.log("Video after uploading on cloudinary",thumbnail);

  if (!videoFile) {
    throw new ApiError(400, "video file is required");
  }
  if (!thumbnail) {
    throw new ApiError(400, "thumbnail file is required");
  }

  const video = await Video.create({
    videoFile: {
      url: videoFile.url,
      public_id: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.url,
      public_id: thumbnail.public_id,
    },
    title,
    description,
    owner: req.user?._id,
    duration: videoFile.duration,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video is published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // -TODO: get video by id
  // Steps : Fetch all video details .. Likes , comments, owner details , Subscribers etc
  // increment view of video as user had watched this now
  // Add this video into users watch History

  const video = await Video.aggregate([
    // find video
    {
      $match: { _id: new mongoose.Types.ObjectId(videoId) },
    },
    // get likes
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    // get comments
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "video",
        as: "comments",
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
                    username: 1,
                    fullName: 1,
                    email: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "comment",
              as: "commentLikes",
            },
          },
          {
            $addFields: {
              owner: { $first: "$owner" },
              commentlikes: { $size: "$commentLikes" },
            },
          },
          {
            $project: {
              content: 1,
              owner: 1,
              commentlikes: 1,
            },
          },
        ],
      },
    },
    // get video owner details
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",

        pipeline: [
          {
            // get subscribers of owner of this video
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribers: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: {
                    in: [req.user?._id, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              email: 1,
              fullName: 1,
              subscribers: 1,
              isSubscribed: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    // Add new fields
    {
      $addFields: {
        likes: { $size: "$likes" },
        comments: "$comments",
        owner: { $arrayElemAt: ["$owner", 0] },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    // Project
    {
      $project: {
        _id: 1,
        videoFile: 1,
        thumnail: 1,
        title: 1,
        description: 1,
        likes: 1,
        owner: 1,
        isLiked: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
      },
    },
  ]);

  if (!video || video.length === 0) {
    throw new ApiError(500, "failed to fetch video");
  }

  // The user has now watched the video so increment view of this video
  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1,
    },
  });

  // Add this video into Users watch History
  await User.findByIdAndUpdate(req.user?._id, {
    // adds unique values only into an array
    $addToSet: {
      watchHistory: videoId,
    },
  });
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched succesfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  // -TODO: update video details like title, description,( thumbnail - from req.file)
  // Steps : Get required details from body that need to check perform validation on it
  // fetch video and check authorization - if user is the owner then only allow to update
  // upload thumbnail on clodinary and delete prevoius one
  // now update video

  if (!(title && description)) {
    throw new ApiError(401, "Provide title and decription");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "No video found");
  }

  // Check Authorization
  // typeof video.owner; // object
  // typeof req.user._id; // object

  // ObjectId === compare karta hai reference se, value se nahi.
  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(401, "Only owner can edit!!");
  }

  const thumbnailToDlt = video.thumbnail.public_id;

  const newThumbnailLocalPath = req.file?.path;
  if (!newThumbnailLocalPath) {
    throw new ApiError(400, "thumbnail is required");
  }

  const newthumbnail = await uploadOnCloudinary(newThumbnailLocalPath);
  if (!newthumbnail) {
    throw new ApiError(400, "thumbnail can;t uploaded on cloudinary");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumnail: {
          url: newthumbnail.url,
          public_id: newthumbnail.public_id,
        },
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError(500, "Failed to update video please try again");
  }
  // Now dlt previous one
  await cloudinary.uploader.destroy(thumbnailToDlt);

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  // -TODO: delete video
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(400, "Video not found");
  }

  // If you are owner then only you can delete
  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You can't delete this video as you are not the owner"
    );
  }

  const videoDeleted = await Video.findByIdAndDelete(videoId);
  if (!videoDeleted) {
    throw new ApiError(400, "Failed to delete the video please try again");
  }

  // delete thumbnail and video from cloudinary
  await cloudinary.uploader.destroy(video.videoFile.public_id, {
    resource_type: "video",
  });
  await cloudinary.uploader.destroy(video.thumbnail.public_id);

  // delete all likes of this video
  // {likedBy : User, video : videoId}, {...}, {...} .. to sare aise doc delete karo jisme videoId ye ho
  // Model.deleteMany(filter);
  await Like.deleteMany({
    video: videoId,
  });

  // delete all comments of video
  await Comment.deleteMany({
    video: videoId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You can't toogle publish status as you are not the owner"
    );
  }

  const toggledVideoPublish = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video?.isPublished,
      },
    },
    { new: true }
  );

  if (!toggledVideoPublish) {
    throw new ApiError(500, "Failed to toogle video publish status");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: toggledVideoPublish.isPublished },
        "Video publish toggled successfully"
      )
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
