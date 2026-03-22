import { UserActivity } from "../models/userActivity.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";

const FAST_WINDOW_MS = 60 * 1000; // 1 minute
const FAST_ACTIONS_THRESHOLD = 15; // >15 actions in last minute => suspicious

const REPEAT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REPEAT_ACTIONS_THRESHOLD = 5; // >5 same-target actions => suspicious

const SUSPICIOUS_SCORE_THRESHOLD = 10;

async function incrementSuspicious(userId, amount = 1) {
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { suspiciousScore: amount } },
    { new: true }
  );
  if (updated && updated.suspiciousScore >= SUSPICIOUS_SCORE_THRESHOLD) {
    await User.findByIdAndUpdate(userId, { $set: { isSuspicious: true } });
  }
}

async function detectFastActions(userId, actionType) {
  const lastMinute = new Date(Date.now() - FAST_WINDOW_MS);
  const count = await UserActivity.countDocuments({
    userId: mongoose.Types.ObjectId(userId),
    actionType,
    createdAt: { $gte: lastMinute },
  });

  if (count > FAST_ACTIONS_THRESHOLD) {
    await incrementSuspicious(userId, 3);
    return true;
  }
  return false;
}

async function detectRepeatedActions(userId, actionType, targetId) {
  if (!targetId) return false;
  const since = new Date(Date.now() - REPEAT_WINDOW_MS);
  const repeated = await UserActivity.find({
    userId: mongoose.Types.ObjectId(userId),
    actionType,
    targetId: mongoose.Types.ObjectId(targetId),
    createdAt: { $gte: since },
  });
  if (repeated.length > REPEAT_ACTIONS_THRESHOLD) {
    await incrementSuspicious(userId, 2);
    return true;
  }
  return false;
}

export async function logActivity(userId, actionType, targetId = null) {
  try {
    await UserActivity.create({ userId, actionType, targetId });
    // Run lightweight detection checks (non-blocking but awaited here)
    await detectFastActions(userId, actionType);
    await detectRepeatedActions(userId, actionType, targetId);
  } catch (err) {
    // swallow - activity logging should not crash main flow
    console.warn("Failed to log activity", err.message || err);
  }
}

export { detectFastActions, detectRepeatedActions, incrementSuspicious };
