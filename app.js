import express from "express";
import dotenv from "dotenv";
import connectDB from "./src/db/dbConnect.js";
import cors from "cors";
// import cookieParser from "cookie-parser";

const app = express();

// Ye .env file se tumhare environment variables ko load karega.
dotenv.config();
// app.use(cors());

//? Ye middleware JSON data ko read karne ke liye hai.
// Jaise koi client tumhare backend ko POST request bheje jisme body JSON format mein ho, to backend ko samajhne ke liye ye zaroori hai.
// limit: "16kb" => Iska matlab maximum 16KB tak ka JSON data accept karenge.
// Isse hum server ko protect karte hain badi-badi ya malicious request se.

app.use(express.json({
  limit : "16kb"
}));

// Ye HTML forms ke through aaye hue data ko parse karta hai (jaise name=Jyoti&age=21).
// Agar koi form submit karta hai to uska data iske through read hota hai.
// extended: true => iska matlab nested objects bhi parse kar sakte ho.
app.use(express.urlencoded({
  extended : true, //
  limit : "16kb"
}))

// Static files serve karta hai
app.use(express.static("public"));

// Cookies read karta hai
// app.use(cookieParser);

//Router
import userRouter from "./src/routes/user.routes.js"

app.use("/api/v1/users", userRouter);
//http://localhost:8080/api/v1/users/register











/*Connect with Databse*/
connectDB();

app.use("/", (_, res) => {
  res.send("This is first middleware");
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
