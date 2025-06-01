require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

const dbName = process.env.MONGODB_NAME;
const collectionName = process.env.MONGODB_COLLECTION;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

async function getDatabaseEntry() {
  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db(dbName);
    const collection = database.collection(collectionName);

    const document = await collection.findOne({});
    return document;
  } finally {
    await client.close();
  }
}

app.post("/api/auth/signin", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === "") {
      return res
        .status(800)
        .json({ error: "provide userNAME first ", status: 800 });
    }
    if (password === "") {
      return res
        .status(700)
        .json({ error: "provide passcode first ", status: 700 });
    }
    const credentials = await getDatabaseEntry();

    if (username != credentials.username) {
      return res
        .status(800)
        .json({ error: "inValid credentials", status: 800 });
    }
    const isMatch = await bcrypt.compare(password, credentials.passcode);
    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Invalid credentials", status: 400 });
    }

    return res.status(200).json({ msg: "Login SUccessful", status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message, status: 500 });
  }
});

app.post("/api/upload", upload.array("photos"), (req, res) => {
  try {
    const uploadedFiles = req.files.map((file) => ({
      id: Date.now() + Math.random(),
      filename: file.filename,
      originalName: file.originalname,
      path: `uploads/${file.filename}`,
      size: Math.round(file.size / 1024) + " KB",
      uploadDate: new Date().toLocaleDateString(),
    }));
    res.json({ success: true, files: uploadedFiles });
  } catch (error) {
    res.status(500).json({ sucess: false, message: error.message });
  }
});

app.get("/api/images", (req, res) => {
  const files = fs.readdirSync(uploadsDir);
  console.log("files: ", files);
  const protocol =
    req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const imageFiles = files
    .filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
    .map((file) => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);

      return {
        id: file,
        filename: file,
        originalName: file,
        serverURL: protocol + "://" + host,
        path: `/uploads/${file}`,
        size: Math.round(stats.size / 1024) + " KB",
        uploadDate: stats.birthtime.toLocaleDateString(),
      };
    });

  console.log("photos : ", imageFiles);
  res.json({ success: true, images: imageFiles });
});

// app.get("/api/photos", (req, res) => {
//   try {
//     const files = fs.readdirSync(uploadsDir);
//     const photos = files
//       .filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
//       .map((file) => {
//         const filePath = path.join(uploadsDir, file);
//         const stats = fs.statSync(filePath);

//         return {
//           id: file,
//           filename: file,
//           originalName: file,
//           path: `/uploads/${file}`,
//           size: Math.round(stats.size / 1024) + " KB",
//           uploadDate: stats.birthtime.toLocaleDateString(),
//         };
//       });

//     res.json({ success: true, photos });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

app.delete("/api/photos/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: "Photo deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Photo not found" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(3001, () => {
  console.log("[+] Server listening on 3001 ");
});
