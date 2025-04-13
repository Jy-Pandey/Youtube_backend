import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new mongoose.Schema({
  videoFile: {
    type: String, //cloudinary url
    required: true,
  },
  thumbnail: {
    type: String, //cludinary url
    required: true,
  },
  owner : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "User"
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  views : {
    type : Number,
    default : 0
  },
  isPublished : {
    type : Boolean,
    default : true
  }
}, {timestamps : true});

// Mongoose plugin ek reusable function hota hai jo tumhare schema ya model ke andar custom methods, properties, ya middleware inject karta hai — taaki tumhara code DRY (Don't Repeat Yourself) ho jaaye.
videoSchema.plugin(mongooseAggregatePaginate);
export const Video = mongoose.model("Video", videoSchema);