import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongooseInstance = await mongoose.connect(`${process.env.MONGO_URI}`);
    console.log(`MongoDB connected!! ${mongooseInstance}`);
    
  } catch (error) {
    console.log("Error in dataBase connect!!", error);
  }
}

export default connectDB;