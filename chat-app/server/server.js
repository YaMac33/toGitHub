const express = require("express");
const fs = require("fs");
const path = require("path");
const { findUser } = require("./users");

const app = express();
const PORT = 3000;

const dataDir = path.join(__dirname, "data");
const messagesFile = path.join(dataDir, "messages.json");
const publicDir = path.join(__dirname, "..", "public");

// JSONのリクエスト本文を req.body として読めるようにします。
app.use(express.json());

// publicフォルダ内のHTML/CSS/JavaScriptをブラウザへ配信します。
app.use(express.static(publicDir));

function ensureMessagesFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(messagesFile)) {
    fs.writeFileSync(messagesFile, "[]", "utf8");
  }
}

function readMessages() {
  ensureMessagesFile();

  try {
    const fileText = fs.readFileSync(messagesFile, "utf8");
    const messages = JSON.parse(fileText);
    return Array.isArray(messages) ? messages : [];
  } catch (error) {
    console.error("messages.json の読み込みに失敗しました:", error);
    return [];
  }
}

function writeMessages(messages) {
  ensureMessagesFile();
  fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2), "utf8");
}

function createMessageId(messages) {
  const nextNumber = messages.length + 1;
  return `msg_${String(nextNumber).padStart(3, "0")}`;
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = findUser(username, password);

  if (!user) {
    return res.json({ ok: false, message: "ログイン失敗" });
  }

  res.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
    },
  });
});

app.get("/api/messages", (req, res) => {
  res.json(readMessages());
});

app.post("/api/messages", (req, res) => {
  const { userId, userName, text } = req.body;
  const trimmedText = typeof text === "string" ? text.trim() : "";

  if (!userId || !userName || !trimmedText) {
    return res.status(400).json({
      ok: false,
      message: "メッセージを入力してください",
    });
  }

  const messages = readMessages();
  const message = {
    id: createMessageId(messages),
    userId,
    userName,
    text: trimmedText,
    time: new Date().toISOString(),
  };

  messages.push(message);
  writeMessages(messages);

  res.json({ ok: true, message });
});

ensureMessagesFile();

app.listen(PORT, () => {
  console.log(`Chat app is running at http://localhost:${PORT}`);
});
