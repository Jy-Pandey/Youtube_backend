import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // -TODO: toggle subscription

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channelId");
  }

  // check the channel exist or not
  const userChannel = await User.findById(channelId);
  if (!userChannel) {
    throw new ApiError(400, "Channel doesnot exist");
  }

  // find from all subscribers of this channel that user is there or not
  // return the document in isSubscribed
  const isSubscribed = await Subscription.findOne({
    channel: channelId,
    subscriber: req.user?._id,
  });
  if (isSubscribed) {
    await Subscription.findByIdAndDelete(isSubscribed?._id);

    return res
      .status(200)
      .json(
        new ApiResponse(200, { subscribed: false }, "unsunscribed successfully")
      );
  }

  // else subscribe the channel
  const newSubscriber = await Subscription.create({
    channel: channelId,
    subscriber: req.user?._id,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, newSubscriber, "subscribed successfully"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channelId");
  }

  // check the channel exist or not
  const userChannel = await User.findById(channelId);
  if (!userChannel) {
    throw new ApiError(400, "Channel doesnot exist");
  }

  // Get the subscribers of this channel
  // And have you subscribed it?
  const channelSubscribers = await Subscription.aggregate([
    {
      $match: { channel: new mongoose.Types.ObjectId(channelId) },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $project: {
              username: 1,
              _id: 1,
              email: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscriber",
    },
  ]);

  const isSubscribed = channelSubscribers.some(
    (obj) => obj.subscriber._id.toString() === req.user?._id.toString()
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {totalSubscribers : channelSubscribers.length, subscribers : channelSubscribers, isSubscribed, },
        "Subscribers fetched"
      )
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriberId");
  }

  // check the subscriber exist or not
  const userSubscriber = await User.findById(subscriberId);
  if (!userSubscriber) {
    throw new ApiError(400, "Channel doesnot exist");
  }

  const subscribedChannels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedChannel",

        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "channelVideos",
            },
          },
          {
            $addFields: {
              latestVideo: { $last: "$channelVideos" },
            },
          },
          {
            $project: {
              username: 1,
              _id: 1,
              email: 1,
              avatar: 1,
              latestVideo: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscribedChannel",
    },
    {
      $project: {
        subscribedChannel: 1,
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {subscribedChannelsCount : subscribedChannels.length ,subscribedChannels},
        "subscribed channels fetched successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
