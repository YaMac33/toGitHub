window.YoteiFileAccess = (function () {
  "use strict";

  var Utils = window.YoteiUtils;
  var dbConfig = {
    name: "yotei-file-access",
    version: 1,
    storeName: "handles",
    directoryKey: "directory-handle"
  };
  var storageKeys = {
    lastFolderName: "yotei:last-folder-name",
    lastSavedAt: "yotei:last-saved-at"
  };

  var state = {
    directoryHandle: null,
    directoryName: "",
    support: null
  };

  function isSupported() {
    if (state.support !== null) {
      return state.support;
    }
    state.support = Boolean(window.isSecureContext && typeof window.showDirectoryPicker === "function");
    return state.support;
  }

  function getSupportMessage() {
    if (isSupported()) {
      return "File System Access API に対応しています。";
    }
    if (!window.isSecureContext) {
      return "このページは secure context ではないため、保存先の自動上書き保存は使えません。";
    }
    return "このブラウザでは File System Access API が使えないため、自動上書き保存は使えません。";
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB が使えないため、保存先の自動復元は利用できません。"));
        return;
      }

      var request = window.indexedDB.open(dbConfig.name, dbConfig.version);

      request.onupgradeneeded = function (event) {
        var database = event.target.result;
        if (!database.objectStoreNames.contains(dbConfig.storeName)) {
          database.createObjectStore(dbConfig.storeName);
        }
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function () {
        reject(request.error || new Error("IndexedDB の初期化に失敗しました。"));
      };
    });
  }

  function withStore(mode, runner) {
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(dbConfig.storeName, mode);
        var store = transaction.objectStore(dbConfig.storeName);
        var request = runner(store);

        transaction.oncomplete = function () {
          database.close();
        };

        transaction.onerror = function () {
          database.close();
          reject(transaction.error || new Error("IndexedDB の操作に失敗しました。"));
        };

        request.onsuccess = function (event) {
          resolve(event.target.result);
        };

        request.onerror = function () {
          reject(request.error || new Error("IndexedDB の読み書きに失敗しました。"));
        };
      });
    });
  }

  function saveDirectoryHandleToDb(handle) {
    return withStore("readwrite", function (store) {
      return store.put(handle, dbConfig.directoryKey);
    });
  }

  function loadDirectoryHandleFromDb() {
    return withStore("readonly", function (store) {
      return store.get(dbConfig.directoryKey);
    });
  }

  function clearDirectoryHandleFromDb() {
    return withStore("readwrite", function (store) {
      return store.delete(dbConfig.directoryKey);
    });
  }

  async function ensurePermission(handle) {
    if (!handle || typeof handle.queryPermission !== "function") {
      return false;
    }

    var options = { mode: "readwrite" };
    var current = await handle.queryPermission(options);
    if (current === "granted") {
      return true;
    }

    current = await handle.requestPermission(options);
    return current === "granted";
  }

  async function pickDirectory() {
    if (!isSupported()) {
      return {
        ok: false,
        type: "warning",
        message: getSupportMessage()
      };
    }

    try {
      var handle = await window.showDirectoryPicker({ mode: "readwrite" });
      var granted = await ensurePermission(handle);
      if (!granted) {
        return {
          ok: false,
          type: "warning",
          message: "保存先フォルダへの書き込み権限が許可されませんでした。"
        };
      }

      state.directoryHandle = handle;
      state.directoryName = handle.name || Utils.getAppFolderName();
      window.localStorage.setItem(storageKeys.lastFolderName, state.directoryName);
      await saveDirectoryHandleToDb(handle);

      return {
        ok: true,
        type: "success",
        message: "保存先フォルダを設定しました。",
        directoryName: state.directoryName
      };
    } catch (error) {
      console.error("フォルダ選択に失敗しました。", error);
      if (error && error.name === "AbortError") {
        return {
          ok: false,
          type: "warning",
          message: "保存先フォルダの選択がキャンセルされました。"
        };
      }
      return {
        ok: false,
        type: "error",
        message: "保存先フォルダの設定に失敗しました。ブラウザ権限をご確認ください。"
      };
    }
  }

  async function restoreDirectory() {
    if (!isSupported()) {
      return {
        ok: false,
        restored: false,
        type: "warning",
        message: getSupportMessage()
      };
    }

    try {
      var handle = await loadDirectoryHandleFromDb();
      if (!handle) {
        return {
          ok: true,
          restored: false,
          type: "info",
          message: "保存先フォルダはまだ設定されていません。"
        };
      }

      state.directoryHandle = handle;
      state.directoryName = handle.name || window.localStorage.getItem(storageKeys.lastFolderName) || Utils.getAppFolderName();
      window.localStorage.setItem(storageKeys.lastFolderName, state.directoryName);

      return {
        ok: true,
        restored: true,
        type: "success",
        message: "前回の保存先フォルダを復元しました。",
        directoryName: state.directoryName
      };
    } catch (error) {
      console.error("保存先フォルダの復元に失敗しました。", error);
      state.directoryHandle = null;
      state.directoryName = window.localStorage.getItem(storageKeys.lastFolderName) || "";
      return {
        ok: false,
        restored: false,
        type: "warning",
        message: "保存先フォルダを自動復元できませんでした。必要なら保存先設定をやり直してください。"
      };
    }
  }

  async function clearPersistedDirectory() {
    try {
      await clearDirectoryHandleFromDb();
    } catch (error) {
      console.error("保存先フォルダ情報の削除に失敗しました。", error);
    }
    state.directoryHandle = null;
  }

  async function resolveDataDirectory(rootHandle) {
    if (!rootHandle) {
      throw new Error("保存先フォルダが未設定です。");
    }

    var appFolderName = Utils.getAppFolderName();
    var appRootHandle = rootHandle;

    try {
      await rootHandle.getDirectoryHandle("data");
    } catch (error) {
      if (rootHandle.name !== appFolderName) {
        try {
          appRootHandle = await rootHandle.getDirectoryHandle(appFolderName);
        } catch (nestedError) {
          console.error("app フォルダの解決に失敗しました。", nestedError);
          throw new Error("選択したフォルダに data フォルダ、または " + appFolderName + "\\data が見つかりません。");
        }
      }
    }

    try {
      return await appRootHandle.getDirectoryHandle("data", { create: true });
    } catch (error) {
      console.error("data フォルダの取得に失敗しました。", error);
      throw new Error("data フォルダを作成または取得できませんでした。");
    }
  }

  async function writeTextFile(fileHandle, content) {
    var writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function readTextFile(fileHandle) {
    var file = await fileHandle.getFile();
    return file.text();
  }

  async function getDataFileHandles(rootHandle) {
    var dataDirectory = await resolveDataDirectory(rootHandle);
    return {
      eventsFile: await dataDirectory.getFileHandle("events.js", { create: true }),
      historyFile: await dataDirectory.getFileHandle("event_history.js", { create: true })
    };
  }

  async function saveDataFiles(payload) {
    if (!isSupported()) {
      return {
        ok: false,
        type: "warning",
        message: getSupportMessage()
      };
    }

    if (!state.directoryHandle) {
      return {
        ok: false,
        type: "warning",
        message: "保存先フォルダが未設定です。先に保存先設定を行ってください。"
      };
    }

    try {
      var granted = await ensurePermission(state.directoryHandle);
      if (!granted) {
        await clearPersistedDirectory();
        return {
          ok: false,
          type: "warning",
          message: "保存先フォルダの権限を再取得できませんでした。保存先設定をやり直してください。"
        };
      }

      var handles = await getDataFileHandles(state.directoryHandle);
      var eventsFile = handles.eventsFile;
      var historyFile = handles.historyFile;

      await writeTextFile(eventsFile, payload.eventsText);
      await writeTextFile(historyFile, payload.historyText);

      var savedAt = Utils.getCurrentTimestamp();
      window.localStorage.setItem(storageKeys.lastSavedAt, savedAt);

      return {
        ok: true,
        type: "success",
        savedAt: savedAt,
        message: "events.js / event_history.js を保存しました。"
      };
    } catch (error) {
      console.error("保存処理に失敗しました。", error);
      return {
        ok: false,
        type: "error",
        message: error && error.message ? error.message : "保存処理に失敗しました。"
      };
    }
  }

  async function readDataFiles() {
    if (!isSupported()) {
      return {
        ok: false,
        type: "warning",
        message: getSupportMessage()
      };
    }

    if (!state.directoryHandle) {
      return {
        ok: false,
        type: "warning",
        message: "保存先フォルダが未設定のため、ファイル再読込はできません。"
      };
    }

    try {
      var granted = await ensurePermission(state.directoryHandle);
      if (!granted) {
        await clearPersistedDirectory();
        return {
          ok: false,
          type: "warning",
          message: "保存先フォルダの権限を再取得できませんでした。保存先設定をやり直してください。"
        };
      }

      var handles = await getDataFileHandles(state.directoryHandle);
      return {
        ok: true,
        type: "success",
        eventsText: await readTextFile(handles.eventsFile),
        historyText: await readTextFile(handles.historyFile),
        message: "保存先ファイルを読み込みました。"
      };
    } catch (error) {
      console.error("保存先ファイルの読み込みに失敗しました。", error);
      return {
        ok: false,
        type: "error",
        message: error && error.message ? error.message : "保存先ファイルの読み込みに失敗しました。"
      };
    }
  }

  function getState() {
    return {
      supported: isSupported(),
      supportMessage: getSupportMessage(),
      hasDirectoryHandle: Boolean(state.directoryHandle),
      directoryName: state.directoryName || window.localStorage.getItem(storageKeys.lastFolderName) || "",
      lastSavedAt: window.localStorage.getItem(storageKeys.lastSavedAt) || ""
    };
  }

  return {
    isSupported: isSupported,
    getSupportMessage: getSupportMessage,
    pickDirectory: pickDirectory,
    restoreDirectory: restoreDirectory,
    readDataFiles: readDataFiles,
    saveDataFiles: saveDataFiles,
    getState: getState
  };
}());
