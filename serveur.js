const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const { toFile } = require("openai");
const path = require("path");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname, "public")));

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error("La clé OPENAI_API_KEY n'est pas configurée sur le serveur.");
    err.status = 503;
    throw err;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function validSize(size) {
  const allowed = ["1024x1024", "1536x1024", "1024x1536"];
  return allowed.includes(size) ? size : "1024x1024";
}

app.post("/api/generate", upload.none(), async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "La description est vide." });
    const client = getOpenAI();
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: validSize(req.body.size)
    });
    const image = result.data && result.data[0] && result.data[0].b64_json;
    if (!image) throw new Error("L'API n'a pas renvoyé de fichier image.");
    res.json({ image });
  } catch (error) {
    console.error("Erreur /api/generate:", error);
    res.status(error.status || 500).json({ error: error.message || "Erreur pendant la génération." });
  }
});

app.post("/api/edit", upload.single("image"), async (req, res) => {
  try {
    const prompt = String(req.body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "La consigne de transformation est vide." });
    if (!req.file) return res.status(400).json({ error: "Aucune image n'a été envoyée." });
    const client = getOpenAI();
    const imageFile = await toFile(req.file.buffer, req.file.originalname || "image.png", {
      type: req.file.mimetype || "image/png"
    });
    const result = await client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt,
      size: validSize(req.body.size)
    });
    const image = result.data && result.data[0] && result.data[0].b64_json;
    if (!image) throw new Error("L'API n'a pas renvoyé de fichier image modifiée.");
    res.json({ image });
  } catch (error) {
    console.error("Erreur /api/edit:", error);
    res.status(error.status || 500).json({ error: error.message || "Erreur pendant la transformation." });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Studio IA démarré sur le port ${port}`));
