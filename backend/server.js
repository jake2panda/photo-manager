require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

const dbName = process.env.MONGODB_DATABASE_NAME;
const collectionName = process.env.MONGODB_COLLECTION;

const regex = /^([^-]+-[^-]+)/;

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
      id: file.filename.match(regex)[1],
      filename: file.filename,
      originalName: file.filename,
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
  const protocol =
    req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const imageFiles = files
    .filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
    .map((file) => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);

      return {
        id: file.match(regex)[1],
        filename: file,
        originalName: file,
        serverURL: protocol + "://" + host,
        path: `/uploads/${file}`,
        size: Math.round(stats.size / 1024) + " KB",
        uploadDate: stats.birthtime.toLocaleDateString(),
      };
    });

  res.json({ success: true, images: imageFiles });
});

function deleteFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    console.log(`Deleted: ${filePath}`);
    return true;
  } catch (err) {
    console.error("Error deleting file:", err);
    return false;
  }
}

app.delete("/api/photos/:id", (req, res) => {
  try {
    const id = req.params.id;
    const files = fs.readdirSync(uploadsDir);
    const matchedFileName = files.find((file) => file.includes(id));
    const filePath = path.join(uploadsDir, matchedFileName);
    const dres = deleteFile(filePath);

    if (dres) {
      res
        .status(200)
        .json({ success: true, message: "Photo deleted successfully" });
    } else {
      res
        .status(1000)
        .json({ success: false, message: "Unable to delete file" });
    }

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/download/:filename", (req, res) => {
  const filepath = path.join(__dirname, "./uploads", req.params.filename);
  fs.access(filepath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(4000).send("File not found!!!");
    }
  });
  res.download(filepath, req.params.filename, (err) => {
    if (err) {
      console.log("DOwnload error : ", err);
      res.status(5000).send("download failed!!!");
    }
  });
});

app.listen(3001, () => {
  console.log("[+] Server listening on 3001 ");
});
