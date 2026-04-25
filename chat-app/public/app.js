const loginView = document.getElementById("loginView");
const chatView = document.getElementById("chatView");
const loginForm = document.getElementById("loginForm");
const messageForm = document.getElementById("messageForm");
const logoutButton = document.getElementById("logoutButton");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const messageInput = document.getElementById("messageInput");
const loginError = document.getElementById("loginError");
const messageError = document.getElementById("messageError");
const messagesList = document.getElementById("messagesList");
const currentUserLabel = document.getElementById("currentUserLabel");

let currentUser = null;
let pollingTimer = null;

function showLoginView() {
  currentUser = null;
  chatView.classList.add("hidden");
  loginView.classList.remove("hidden");
  currentUserLabel.textContent = "";
  messagesList.textContent = "";
  stopPolling();
}

function showChatView(user) {
  currentUser = user;
  loginView.classList.add("hidden");
  chatView.classList.remove("hidden");
  currentUserLabel.textContent = `${user.name} でログイン中`;
  messageInput.focus();
  loadMessages();
  startPolling();
}

function startPolling() {
  stopPolling();
  pollingTimer = setInterval(loadMessages, 3000);
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function formatTime(isoString) {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderMessages(messages) {
  messagesList.textContent = "";

  messages.forEach((message) => {
    const item = document.createElement("article");
    const meta = document.createElement("div");
    const userName = document.createElement("strong");
    const time = document.createElement("span");
    const text = document.createElement("p");

    item.className = "message";
    if (currentUser && message.userId === currentUser.id) {
      item.classList.add("mine");
    }

    meta.className = "message-meta";
    userName.textContent = message.userName;
    time.textContent = formatTime(message.time);
    text.className = "message-text";

    // textContentを使うことで、入力されたHTMLをタグとして実行しません。
    text.textContent = message.text;

    meta.append(userName, time);
    item.append(meta, text);
    messagesList.appendChild(item);
  });

  messagesList.scrollTop = messagesList.scrollHeight;
}

async function loadMessages() {
  try {
    const response = await fetch("/api/messages");
    const messages = await response.json();
    renderMessages(messages);
    messageError.textContent = "";
  } catch (error) {
    messageError.textContent = "メッセージの取得に失敗しました";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    loginError.textContent = "ユーザー名とパスワードを入力してください";
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
    const result = await response.json();

    if (!result.ok) {
      loginError.textContent = result.message || "ログイン失敗";
      return;
    }

    passwordInput.value = "";
    showChatView(result.user);
  } catch (error) {
    loginError.textContent = "サーバーに接続できません";
  }
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageError.textContent = "";

  const text = messageInput.value.trim();

  if (!text) {
    messageError.textContent = "メッセージを入力してください";
    return;
  }

  try {
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: currentUser.id,
        userName: currentUser.name,
        text,
      }),
    });
    const result = await response.json();

    if (!result.ok) {
      messageError.textContent = result.message || "送信に失敗しました";
      return;
    }

    messageInput.value = "";
    await loadMessages();
  } catch (error) {
    messageError.textContent = "送信に失敗しました";
  }
});

logoutButton.addEventListener("click", () => {
  showLoginView();
});

showLoginView();
