document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("draft-form");
  const docTypeInput = document.getElementById("doc_type");
  const titleInput = document.getElementById("title");
  const whenInput = document.getElementById("when");
  const whereInput = document.getElementById("where");
  const whoInput = document.getElementById("who");
  const howInput = document.getElementById("how");
  const contactInput = document.getElementById("contact");
  const recipientInput = document.getElementById("recipient");
  const toneInput = document.getElementById("tone");

  const errorBox = document.getElementById("error-message");
  const loadingBox = document.getElementById("loading-indicator");
  const statusBox = document.getElementById("status-message");
  const draftOutput = document.getElementById("draft-output");
  const draftEditor = document.getElementById("draft-editor");

  const generateBtn = document.getElementById("generate-btn");
  const saveFactsBtn = document.getElementById("save-facts-btn");
  const loadFactsBtn = document.getElementById("load-facts-btn");
  const fillExampleBtn = document.getElementById("fill-example-btn");
  const toggleEditBtn = document.getElementById("toggle-edit-btn");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");

  const FACTS_STORAGE_KEY = "doc_draft_facts_card";
  const EMPTY_PREVIEW_TEXT =
    "왼쪽에서 문서 정보를 입력하고 [초안 생성] 버튼을 누르면 여기에 초안이 나타납니다.";
  let currentDraftMarkdown = "";
  let isEditMode = false;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function showStatus(message) {
    statusBox.textContent = message;
    statusBox.hidden = false;
  }

  function clearStatus() {
    statusBox.textContent = "";
    statusBox.hidden = true;
  }

  function setLoading(isLoading) {
    loadingBox.hidden = !isLoading;
    generateBtn.disabled = isLoading;
  }

  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, "_").trim();
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatInlineMarkdown(text) {
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/\[확인 필요\]/g, '<span class="needs-check">[확인 필요]</span>');
    return html;
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const htmlParts = [];
    let listType = null;

    function closeList() {
      if (listType) {
        htmlParts.push(`</${listType}>`);
        listType = null;
      }
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        closeList();
        continue;
      }

      if (/^---+$/.test(line)) {
        closeList();
        htmlParts.push("<hr>");
        continue;
      }

      const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
      if (headingMatch) {
        closeList();
        const level = headingMatch[1].length;
        htmlParts.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
        continue;
      }

      const ulMatch = line.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          htmlParts.push("<ul>");
        }
        htmlParts.push(`<li>${formatInlineMarkdown(ulMatch[1])}</li>`);
        continue;
      }

      const olMatch = line.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (listType !== "ol") {
          closeList();
          listType = "ol";
          htmlParts.push("<ol>");
        }
        htmlParts.push(`<li>${formatInlineMarkdown(olMatch[1])}</li>`);
        continue;
      }

      const quoteMatch = line.match(/^>\s?(.*)$/);
      if (quoteMatch) {
        closeList();
        htmlParts.push(`<blockquote>${formatInlineMarkdown(quoteMatch[1])}</blockquote>`);
        continue;
      }

      closeList();
      htmlParts.push(`<p>${formatInlineMarkdown(line)}</p>`);
    }

    closeList();
    return htmlParts.join("");
  }

  function showDraftPreview(markdown) {
    currentDraftMarkdown = markdown;
    draftEditor.value = markdown;
    if (!markdown.trim()) {
      draftOutput.classList.add("empty-preview");
      draftOutput.textContent = EMPTY_PREVIEW_TEXT;
      return;
    }
    draftOutput.classList.remove("empty-preview");
    draftOutput.innerHTML = renderMarkdown(markdown);
  }

  function setEditMode(editing) {
    isEditMode = editing;
    draftOutput.hidden = editing;
    draftEditor.hidden = !editing;
    toggleEditBtn.textContent = editing ? "미리보기" : "직접 수정";
    if (editing) {
      draftEditor.focus();
    } else {
      showDraftPreview(currentDraftMarkdown);
    }
  }

  function saveFormToStorage() {
    const selectedPrompt = document.querySelector('input[name="prompt_type"]:checked');
    const formData = {
      doc_type: docTypeInput.value,
      title: titleInput.value,
      when: whenInput.value,
      where: whereInput.value,
      who: whoInput.value,
      how: howInput.value,
      contact: contactInput.value,
      recipient: recipientInput.value,
      tone: toneInput.value,
      prompt_type: selectedPrompt ? selectedPrompt.value : "A",
    };
    try {
      localStorage.setItem(FACTS_STORAGE_KEY, JSON.stringify(formData));
      return true;
    } catch (_err) {
      return false;
    }
  }

  saveFactsBtn.addEventListener("click", () => {
    clearError();
    clearStatus();
    if (saveFormToStorage()) {
      showStatus("현재 입력된 문서 정보가 저장되었습니다.");
    } else {
      showError("브라우저 저장소에 저장할 수 없습니다.");
    }
  });

  loadFactsBtn.addEventListener("click", () => {
    clearError();
    clearStatus();

    try {
      const raw = localStorage.getItem(FACTS_STORAGE_KEY);
      if (!raw) {
        showError("저장된 문서 정보가 아직 없습니다.");
        return;
      }

      const formData = JSON.parse(raw);
      docTypeInput.value = formData.doc_type || "";
      titleInput.value = formData.title || "";
      whenInput.value = formData.when || "";
      whereInput.value = formData.where || "";
      whoInput.value = formData.who || "";
      howInput.value = formData.how || "";
      contactInput.value = formData.contact || "";
      recipientInput.value = formData.recipient || "";
      toneInput.value = formData.tone || "공식적";

      const targetPrompt = formData.prompt_type || "A";
      const promptRadio = document.querySelector(
        `input[name="prompt_type"][value="${targetPrompt}"]`
      );
      if (promptRadio) {
        promptRadio.checked = true;
      }

      showStatus("저장된 문서 정보를 불러왔습니다.");
    } catch (_err) {
      showError("저장된 문서 정보를 불러오는 중 문제가 발생했습니다.");
    }
  });

  fillExampleBtn.addEventListener("click", () => {
    clearError();
    clearStatus();

    docTypeInput.value = "안내문";
    titleInput.value = "2026학년도 동계 비교과 프로그램 특강 안내";
    whenInput.value = "2026년 12월 10일(목) 14:00 ~ 16:00";
    whereInput.value = "학생회관 3층 대강당";
    whoInput.value = "학부 재학생 전체";
    howInput.value = "학교 포털 > 비교과 신청 메뉴에서 선착순 접수";
    contactInput.value = "교수학습지원센터 (02-1234-5678)";
    recipientInput.value = "학부 재학생";
    toneInput.value = "공식적";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    clearStatus();

    const docType = docTypeInput.value.trim();
    const title = titleInput.value.trim();

    // 화면에서도 필수 입력(문서 종류, 제목)이 비어 있는지 먼저 확인합니다.
    if (!docType || !title) {
      showError("문서 종류와 제목은 반드시 입력해 주세요.");
      if (!docType) {
        docTypeInput.focus();
      } else {
        titleInput.focus();
      }
      return;
    }

    const selectedPrompt = document.querySelector('input[name="prompt_type"]:checked');
    const payload = {
      doc_type: docType,
      title: title,
      when: whenInput.value.trim(),
      where: whereInput.value.trim(),
      who: whoInput.value.trim(),
      how: howInput.value.trim(),
      contact: contactInput.value.trim(),
      recipient: recipientInput.value.trim(),
      tone: toneInput.value,
      prompt_type: selectedPrompt ? selectedPrompt.value : "A",
    };

    setLoading(true);
    setEditMode(false);
    toggleEditBtn.disabled = true;
    copyBtn.disabled = true;
    downloadBtn.disabled = true;

    try {
      const response = await fetch("/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        showError(data.error || "문서 초안을 생성하는 중 오류가 발생했습니다.");
        return;
      }

      draftOutput.classList.remove("empty-preview");
      showDraftPreview(data.draft || "");
      const hasDraft = Boolean(currentDraftMarkdown.trim());
      toggleEditBtn.disabled = !hasDraft;
      copyBtn.disabled = !hasDraft;
      downloadBtn.disabled = !hasDraft;

      if (hasDraft) {
        showStatus("초안 생성이 완료되었습니다.");
      }
    } catch (_err) {
      showError("서버와 통신할 수 없습니다. 서버가 실행 중인지 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  });

  toggleEditBtn.addEventListener("click", () => {
    setEditMode(!isEditMode);
  });

  draftEditor.addEventListener("input", () => {
    currentDraftMarkdown = draftEditor.value;
    const hasDraft = Boolean(currentDraftMarkdown.trim());
    copyBtn.disabled = !hasDraft;
    downloadBtn.disabled = !hasDraft;
  });

  copyBtn.addEventListener("click", async () => {
    const text = isEditMode
      ? currentDraftMarkdown
      : (draftOutput.innerText || draftOutput.textContent || "").trim();
    if (!text) return;

    clearError();
    const copiedMessage = isEditMode
      ? "마크다운 원본이 클립보드에 복사되었습니다."
      : "미리보기 내용이 마크다운 기호 없이 복사되었습니다.";

    try {
      await navigator.clipboard.writeText(text);
      showStatus(copiedMessage);
    } catch (_err) {
      const tempTextarea = document.createElement("textarea");
      tempTextarea.value = text;
      document.body.appendChild(tempTextarea);
      tempTextarea.select();
      document.execCommand("copy");
      document.body.removeChild(tempTextarea);
      showStatus(copiedMessage);
    }
  });

  downloadBtn.addEventListener("click", () => {
    const text = currentDraftMarkdown;
    if (!text) return;

    clearError();
    const safeTitle = sanitizeFilename(titleInput.value) || "document-draft";
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showStatus(`'${safeTitle}.md' 파일로 다운로드했습니다.`);
  });

  // PWA 서비스 워커 등록 및 설치 팝업(Android Chrome / iOS Safari)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  const pwaBanner = document.getElementById("pwa-install-banner");
  const pwaInstallBtn = document.getElementById("pwa-install-btn");
  const pwaLaterBtn = document.getElementById("pwa-later-btn");
  const pwaIosGuide = document.getElementById("pwa-ios-guide");
  const pwaBannerDesc = document.getElementById("pwa-banner-desc");

  const PWA_DISMISS_KEY = "doc_draft_pwa_dismissed_until";
  const DISMISS_DAYS = 7;

  function isStandaloneMode() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isDismissedRecently() {
    try {
      const until = Number(localStorage.getItem(PWA_DISMISS_KEY) || "0");
      return Date.now() < until;
    } catch (_err) {
      return false;
    }
  }

  function dismissPwaBanner() {
    pwaBanner.hidden = true;
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(PWA_DISMISS_KEY, String(until));
    } catch (_err) {
      // 저장소가 막혀 있어도 팝업은 닫습니다.
    }
  }

  function isIosSafari() {
    const ua = window.navigator.userAgent || "";
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIos && isSafari;
  }

  let deferredInstallPrompt = null;

  if (!isStandaloneMode() && !isDismissedRecently()) {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      pwaIosGuide.hidden = true;
      pwaInstallBtn.textContent = "설치";
      pwaBanner.hidden = false;
    });

    if (isIosSafari()) {
      pwaBannerDesc.textContent = "Safari에서 홈 화면에 추가하면 앱처럼 쓸 수 있어요.";
      pwaInstallBtn.textContent = "설치 방법";
      pwaBanner.hidden = false;
    }
  }

  pwaLaterBtn.addEventListener("click", dismissPwaBanner);

  pwaInstallBtn.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice && choice.outcome === "accepted") {
        pwaBanner.hidden = true;
      } else {
        dismissPwaBanner();
      }
      return;
    }

    if (isIosSafari()) {
      const isGuideHidden = pwaIosGuide.hidden;
      pwaIosGuide.hidden = !isGuideHidden;
      pwaInstallBtn.textContent = isGuideHidden ? "확인" : "설치 방법";
      if (!isGuideHidden) {
        dismissPwaBanner();
      }
    }
  });

  window.addEventListener("appinstalled", () => {
    pwaBanner.hidden = true;
    deferredInstallPrompt = null;
  });
});
