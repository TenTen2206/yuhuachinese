let selectedLevel = "HSK3";
let selectedLesson = "Bài 1";
let currentWords = [];

let flashIndex = 0;
let quizIndex = 0;
let quizScoreValue = 0;
let quizQuestions = [];
let translateIndex = 0;
let translateScoreValue = 0;
let translateChecked = false;

const stateKey = "chinese-vocab-progress-v1";

function $id(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeChinese(text) {
  return String(text)
    .trim()
    .replace(/[，。！？、,.!?;；:“”"'（）()\s]/g, "");
}

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(stateKey)) || {
      known: {},
      review: {},
      quiz: {}
    };
  } catch {
    return { known: {}, review: {}, quiz: {} };
  }
}

function saveProgress(progress) {
  localStorage.setItem(stateKey, JSON.stringify(progress));
  updateProgressPill();
}

function lessonKey() {
  return `${selectedLevel}-${selectedLesson}`;
}

function renderLevelButtons() {
  const wrap = $id("levelButtons");
  wrap.innerHTML = "";

  Object.keys(COURSE_DATA).forEach(level => {
    const btn = document.createElement("button");
    btn.className = `level-btn ${level === selectedLevel ? "active" : ""}`;
    btn.textContent = COURSE_DATA[level].title;

    btn.addEventListener("click", () => {
      selectedLevel = level;
      selectedLesson = Object.keys(COURSE_DATA[level].lessons)[0];
      renderLevelButtons();
      renderLessonSelect();
      loadLesson();
    });

    wrap.appendChild(btn);
  });
}

function renderLessonSelect() {
  const select = $id("lessonSelect");
  select.innerHTML = "";

  Object.keys(COURSE_DATA[selectedLevel].lessons).forEach(lesson => {
    const option = document.createElement("option");
    option.value = lesson;
    option.textContent = lesson;
    option.selected = lesson === selectedLesson;
    select.appendChild(option);
  });

  select.onchange = (e) => {
    selectedLesson = e.target.value;
    loadLesson();
  };
}

function loadLesson() {
  currentWords = COURSE_DATA[selectedLevel].lessons[selectedLesson];
  flashIndex = 0;
  renderBreadcrumbs();
  renderVocabulary();
  setupFlashcard();
  setupQuiz();
  setupTranslation();
  updateProgressPill();
}

function renderBreadcrumbs() {
  const text = `${COURSE_DATA[selectedLevel].title} • ${selectedLesson}`;
  ["vocabBreadcrumb", "flashBreadcrumb", "quizBreadcrumb", "translateBreadcrumb"]
    .forEach(id => $id(id).textContent = text);
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $id(viewId).classList.add("active");

  if (viewId === "vocabView") renderVocabulary();
  if (viewId === "flashcardView") setupFlashcard();
  if (viewId === "quizView") setupQuiz();
  if (viewId === "translateView") setupTranslation();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-go]").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.go));
});

$id("startLessonBtn").addEventListener("click", () => {
  loadLesson();
  showView("vocabView");
});

/* Vocabulary */
function renderVocabulary(filter = "") {
  const list = $id("vocabList");
  if (!list) return;

  const q = filter.trim().toLowerCase();
  const filtered = currentWords.filter(w =>
    `${w.chinese} ${w.pinyin} ${w.vietnamese}`.toLowerCase().includes(q)
  );

  list.innerHTML = filtered.map((w, idx) => `
    <article class="vocab-item">
      <div>
        <div class="vocab-hanzi">${escapeHtml(w.chinese)}</div>
        <div class="pinyin">${escapeHtml(w.pinyin)}</div>
      </div>
      <div>
        <div class="meaning">${escapeHtml(w.vietnamese)}</div>
        <div class="example">${escapeHtml(w.example)}</div>
        <div class="muted">${escapeHtml(w.exampleVi)}</div>
      </div>
      <button class="btn ghost speak-btn" data-text="${escapeHtml(w.chinese)}">🔊 Nghe</button>
    </article>
  `).join("");

  document.querySelectorAll(".speak-btn").forEach(btn => {
    btn.addEventListener("click", () => speakChinese(btn.dataset.text));
  });
}

$id("searchInput").addEventListener("input", e => renderVocabulary(e.target.value));

function speakChinese(text) {
  if (!("speechSynthesis" in window)) {
    alert("Trình duyệt này chưa hỗ trợ chức năng đọc.");
    return;
  }

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-CN";
  utter.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

/* Flashcards */
function setupFlashcard() {
  const card = $id("flashcard");
  if (!card || !currentWords.length) return;
  card.classList.remove("flipped");
  renderFlashcard();
  updateReviewCount();
}

function renderFlashcard() {
  const word = currentWords[flashIndex];
  if (!word) return;

  $id("flashIndex").textContent = `${flashIndex + 1} / ${currentWords.length}`;
  $id("flashHanzi").textContent = word.chinese;
  $id("flashPinyin").textContent = word.pinyin;
  $id("flashMeaning").textContent = word.vietnamese;
  $id("flashExample").textContent = word.example;
  $id("flashExampleVi").textContent = word.exampleVi;
  $id("flashcard").classList.remove("flipped");
}

$id("flashcard").addEventListener("click", () => {
  $id("flashcard").classList.toggle("flipped");
});

$id("prevCard").addEventListener("click", () => {
  flashIndex = (flashIndex - 1 + currentWords.length) % currentWords.length;
  renderFlashcard();
});

$id("nextCard").addEventListener("click", () => {
  flashIndex = (flashIndex + 1) % currentWords.length;
  renderFlashcard();
});

$id("knowBtn").addEventListener("click", () => {
  const progress = getProgress();
  const key = lessonKey();
  progress.known[key] = progress.known[key] || [];
  progress.review[key] = progress.review[key] || [];

  const word = currentWords[flashIndex].chinese;
  if (!progress.known[key].includes(word)) progress.known[key].push(word);
  progress.review[key] = progress.review[key].filter(x => x !== word);

  saveProgress(progress);
  updateReviewCount();
  flashIndex = (flashIndex + 1) % currentWords.length;
  renderFlashcard();
});

$id("dontKnowBtn").addEventListener("click", () => {
  const progress = getProgress();
  const key = lessonKey();
  progress.review[key] = progress.review[key] || [];

  const word = currentWords[flashIndex].chinese;
  if (!progress.review[key].includes(word)) progress.review[key].push(word);

  saveProgress(progress);
  updateReviewCount();
  flashIndex = (flashIndex + 1) % currentWords.length;
  renderFlashcard();
});

function updateReviewCount() {
  const progress = getProgress();
  const review = progress.review[lessonKey()] || [];
  $id("reviewCount").textContent = review.length;
}

/* Quiz */
function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function setupQuiz() {
  if (!currentWords.length) return;
  quizIndex = 0;
  quizScoreValue = 0;
  quizQuestions = shuffle(currentWords).map(word => {
    const wrong = shuffle(currentWords.filter(w => w.chinese !== word.chinese))
      .slice(0, Math.min(3, currentWords.length - 1))
      .map(w => w.vietnamese);

    const fallback = ["đi học", "mua đồ", "ăn cơm", "làm việc"];
    while (wrong.length < 3) {
      const f = fallback.find(x => !wrong.includes(x) && x !== word.vietnamese);
      if (!f) break;
      wrong.push(f);
    }

    return {
      word,
      options: shuffle([word.vietnamese, ...wrong]).slice(0, 4)
    };
  });

  renderQuiz();
}

function renderQuiz() {
  const item = quizQuestions[quizIndex];
  if (!item) return;

  $id("quizCounter").textContent = `Câu ${quizIndex + 1}/${quizQuestions.length}`;
  $id("quizScore").textContent = `Điểm: ${quizScoreValue}`;
  $id("quizQuestion").innerHTML = `“<strong>${escapeHtml(item.word.chinese)}</strong>” nghĩa là gì?`;
  $id("quizFeedback").textContent = "";
  $id("nextQuestionBtn").disabled = true;

  $id("quizOptions").innerHTML = item.options.map(opt =>
    `<button class="option">${escapeHtml(opt)}</button>`
  ).join("");

  document.querySelectorAll("#quizOptions .option").forEach(btn => {
    btn.addEventListener("click", () => answerQuiz(btn, item.word.vietnamese));
  });
}

function answerQuiz(button, correctAnswer) {
  const options = document.querySelectorAll("#quizOptions .option");
  options.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correctAnswer) btn.classList.add("correct");
  });

  if (button.textContent === correctAnswer) {
    quizScoreValue++;
    $id("quizFeedback").textContent = "✅ Chính xác!";
  } else {
    button.classList.add("wrong");
    $id("quizFeedback").textContent = `❌ Chưa đúng. Đáp án: ${correctAnswer}`;
  }

  $id("quizScore").textContent = `Điểm: ${quizScoreValue}`;
  $id("nextQuestionBtn").disabled = false;
}

$id("nextQuestionBtn").addEventListener("click", () => {
  if (quizIndex < quizQuestions.length - 1) {
    quizIndex++;
    renderQuiz();
  } else {
    const progress = getProgress();
    progress.quiz[lessonKey()] = {
      score: quizScoreValue,
      total: quizQuestions.length,
      updatedAt: new Date().toISOString()
    };
    saveProgress(progress);

    $id("quizQuestion").textContent = "Hoàn thành!";
    $id("quizOptions").innerHTML = "";
    $id("quizFeedback").textContent =
      `Bạn trả lời đúng ${quizScoreValue}/${quizQuestions.length} câu.`;
    $id("nextQuestionBtn").disabled = true;
  }
});

/* Translation */
function setupTranslation() {
  translateIndex = 0;
  translateScoreValue = 0;
  translateChecked = false;
  renderTranslation();
}

function renderTranslation() {
  const word = currentWords[translateIndex];
  if (!word) return;

  $id("translateCounter").textContent = `Câu ${translateIndex + 1}/${currentWords.length}`;
  $id("translateScore").textContent = `Đúng: ${translateScoreValue}`;
  $id("translatePrompt").textContent = word.translatePrompt;
  $id("translateAnswer").value = "";
  $id("translateFeedback").textContent = "";
  translateChecked = false;
}

$id("checkTranslateBtn").addEventListener("click", () => {
  if (translateChecked) return;

  const word = currentWords[translateIndex];
  const user = normalizeChinese($id("translateAnswer").value);
  const correct = normalizeChinese(word.translateAnswer);

  if (!user) {
    $id("translateFeedback").textContent = "Hãy nhập câu trả lời trước.";
    return;
  }

  if (user === correct) {
    translateScoreValue++;
    $id("translateFeedback").textContent = "✅ Chính xác!";
  } else {
    $id("translateFeedback").textContent =
      `❌ Chưa trùng khớp. Đáp án gợi ý: ${word.translateAnswer}`;
  }

  translateChecked = true;
  $id("translateScore").textContent = `Đúng: ${translateScoreValue}`;
});

$id("showAnswerBtn").addEventListener("click", () => {
  const word = currentWords[translateIndex];
  $id("translateFeedback").textContent = `Đáp án: ${word.translateAnswer}`;
});

$id("nextTranslateBtn").addEventListener("click", () => {
  translateIndex = (translateIndex + 1) % currentWords.length;
  renderTranslation();
});

/* Overall progress */
function updateProgressPill() {
  const progress = getProgress();
  const known = progress.known[lessonKey()] || [];
  const total = currentWords.length || 1;
  const percent = Math.round((known.length / total) * 100);
  const pill = $id("progressPill");
  if (pill) pill.textContent = `Tiến độ: ${percent}%`;
}

/* Init */
renderLevelButtons();
renderLessonSelect();
loadLesson();
