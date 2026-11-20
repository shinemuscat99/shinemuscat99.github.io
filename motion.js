/*
 * 화면 움직임 전용 파일 (motion.js)
 *   1) 화면이 열릴 때 요소들이 시차를 두고(stagger) 부드럽게 올라옴
 *   2) 스크롤하면 나타나는 리빌 + 사진이 천천히 따라오는 패럴랙스
 *   3) 버튼에 마우스를 올리면 글자가 위로 밀려 바뀌고, 버튼이 커서 쪽으로 자석처럼 끌림
 * (Framer Motion은 React 전용이라, 같은 효과를 브라우저 기본 기능(Web Animations API)으로 만들었어요.)
 * 선택 흐름과 데이터에는 관여하지 않아요. 이 파일이 없어도 페이지는 그대로 동작합니다.
 */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
  const app = document.querySelector(".app");
  if (!app) return;

  // ------------------------------------------------------------------
  // 3-1) 글자 올라가며 바뀌기: 버튼 글자를 두 줄(같은 글자)로 감쌈
  // ------------------------------------------------------------------
  function wrapRoll(btn) {
    if (btn.querySelector(".roll")) return;
    const label = btn.textContent.trim();
    if (!label) return;
    btn.textContent = "";
    const roll = document.createElement("span");
    roll.className = "roll";
    const track = document.createElement("span");
    track.className = "roll-track";
    const a = document.createElement("span");
    a.textContent = label;
    const b = document.createElement("span");
    b.textContent = label;
    b.setAttribute("aria-hidden", "true");
    track.append(a, b);
    roll.appendChild(track);
    btn.appendChild(roll);
  }
  const ROLL = ".btn, .btn-map";
  function wrapAll(root) {
    root.querySelectorAll(ROLL).forEach(wrapRoll);
  }

  // ------------------------------------------------------------------
  // 1) 시차 등장: [data-anim] 요소와 보기 칸들을 순서대로 올림
  // ------------------------------------------------------------------
  function rise(el, delay, distance) {
    if (reduce) { el.style.opacity = "1"; return; }
    const anim = el.animate(
      [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: "none" }],
      { duration: 800, delay, easing: EASE, fill: "both" }
    );
    // 끝나면 애니메이션을 지워서 자석 효과 등 다른 움직임과 겹치지 않게
    anim.onfinish = () => { el.style.opacity = "1"; anim.cancel(); };
  }

  function playIn(screen) {
    const items = [...screen.querySelectorAll("[data-anim]")].filter((el) => el.getClientRects().length);
    items.forEach((el, i) => rise(el, 120 + i * 90, 28));
  }

  function staggerOptions() {
    if (reduce) return;
    document.querySelectorAll("#options .option, .screen.is-active .step-chip").forEach((el, i) => {
      el.animate(
        [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
        { duration: 500, delay: i * 35, easing: EASE, fill: "backwards" }
      );
    });
  }

  if (!reduce) document.documentElement.classList.add("js-anim");

  // 화면이 바뀔 때마다 그 화면의 요소들을 올림
  document.querySelectorAll(".screen").forEach((screen) => {
    let wasActive = screen.classList.contains("is-active");
    new MutationObserver(() => {
      const active = screen.classList.contains("is-active");
      if (active && !wasActive) {
        // 다시 보일 때를 위해 이전 상태를 지우고 새로 올림
        screen.querySelectorAll("[data-anim]").forEach((el) => { el.style.opacity = ""; });
        playIn(screen);
        observeReveals(screen);
        updateParallax();
      }
      wasActive = active;
    }).observe(screen, { attributes: true, attributeFilter: ["class"] });
  });

  // 보기 칸은 단계마다 새로 그려지므로 그때마다 순서대로 올림
  const options = document.getElementById("options");
  if (options) new MutationObserver(staggerOptions).observe(options, { childList: true });

  // ------------------------------------------------------------------
  // 2-1) 스크롤 리빌: [data-reveal] 요소와 결과 화면 업체 줄
  // ------------------------------------------------------------------
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          io.unobserve(el);
          if (el.hasAttribute("data-reveal")) rise(el, 0, 36);
          else el.classList.add("is-in");
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" })
    : null;

  function observeReveals(root) {
    root.querySelectorAll("[data-reveal]").forEach((el) => {
      if (el.dataset.revealed) return;
      el.dataset.revealed = "1";
      if (io && !reduce) io.observe(el);
      else el.style.opacity = "1";
    });
  }

  const result = document.getElementById("screen-result");
  function watchResult() {
    if (!result || !io || reduce) return;
    result.querySelectorAll(".place-card, .other-areas, .suggestions").forEach((el) => {
      if (el.classList.contains("reveal")) return;
      el.classList.add("reveal");
      io.observe(el);
    });
  }

  // ------------------------------------------------------------------
  // 2-2) 패럴랙스: [data-parallax="속도"] 사진이 스크롤보다 천천히 움직임
  // ------------------------------------------------------------------
  let ticking = false;
  function updateParallax() {
    ticking = false;
    if (reduce) return;
    const vh = window.innerHeight;
    document.querySelectorAll(".screen.is-active [data-parallax]").forEach((img) => {
      const box = img.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      const speed = parseFloat(img.dataset.parallax) || 0.2;
      const room = Math.max(0, (img.offsetHeight - img.parentElement.offsetHeight) / 2);
      const raw = (box.top + box.height / 2 - vh / 2) * -speed;
      const y = Math.max(-room, Math.min(room, raw));
      img.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
  }
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateParallax); }
  }, { passive: true });
  window.addEventListener("resize", updateParallax);

  // 아래로 보기 원형 화살표: 부드럽게 스크롤
  document.querySelectorAll(".scroll-cue").forEach((cue) => {
    cue.addEventListener("click", (e) => {
      const target = document.querySelector(cue.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });

  // ------------------------------------------------------------------
  // 3-2) 자석 버튼: 커서 쪽으로 살짝 끌려옴 (마우스가 있는 기기에서만)
  // ------------------------------------------------------------------
  const MAGNET = ".magnetic, .btn-map, .btn-pill";
  let pulled = null;
  function release() {
    if (pulled) { pulled.style.transform = ""; pulled = null; }
  }
  if (finePointer && !reduce) {
    document.addEventListener("pointermove", (e) => {
      const el = e.target instanceof Element ? e.target.closest(MAGNET) : null;
      if (el !== pulled) release();
      if (!el || el.disabled) return;
      pulled = el;
      const box = el.getBoundingClientRect();
      const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2);
      const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2);
      const pull = el.classList.contains("magnetic") ? 10 : 5;
      el.style.transform = `translate(${(dx * pull).toFixed(1)}px, ${(dy * pull * 0.6).toFixed(1)}px)`;
    });
    document.addEventListener("pointerleave", release);
    window.addEventListener("blur", release);
  }

  // ------------------------------------------------------------------
  // 시작: 지금 화면 올리기 + app.js가 새로 만드는 버튼·업체 줄도 챙김
  // ------------------------------------------------------------------
  wrapAll(document);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      wrapAll(app);
      watchResult();
    });
  }).observe(app, { childList: true, subtree: true });

  const first = document.querySelector(".screen.is-active");
  if (first) { playIn(first); observeReveals(first); }
  updateParallax();
})();
