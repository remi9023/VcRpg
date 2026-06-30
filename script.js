const STORAGE_KEY = "studioCrewRpgSave";
const AUDIO_SETTINGS_KEY = "studioCrewRpgAudioSettings";
const ENEMY_SPAWN_X = 86;
const ENEMY_CONTACT_X = 38;
const ENEMY_MAX_COUNT = 5;
const NORMAL_STAGES_PER_CHAPTER = 5;
const BASIC_ATTACK_RATE = 1;
const SKILL_ATTACK_RATE = 4;
const TICK_RATE = 1000 / 30;
const BGM_TRACKS = {
  title: "Resource/Sound/BGM_Main_Theme.mp3",
  field: "Resource/Sound/BGM_Field.mp3",
  boss: "Resource/Sound/BGM_Boss.mp3",
};
const defaultAudioSettings = {
  volume: 0.45,
  muted: false,
};

const recruits = [
  {
    id: "planner",
    name: "기획자",
    shortName: "기획",
    mark: "P",
    color: "#f59e0b",
    desc: "요구사항을 정리해 자동 기여도를 올립니다.",
    baseCost: 25,
    dps: 1,
    attackType: "plan",
    skill: { type: "chain", name: "일정 공유", targets: 3, multiplier: 1.2 },
    sprites: {
      idle: "Anim/Player_2/GD_Idle.png",
      attack: "Anim/Player_2/GD_ATK.png",
      skill: "Anim/Player_2/GD_Skill.png",
    },
  },
  {
    id: "developer",
    name: "개발자",
    shortName: "개발",
    mark: "D",
    color: "#2563eb",
    desc: "핵심 기능을 빠르게 구현합니다.",
    baseCost: 55,
    dps: 3,
    attackType: "code",
    skill: { type: "aoe", name: "빌드 폭발", radius: 14, multiplier: 1.45 },
  },
  {
    id: "artist",
    name: "일러스트레이터",
    shortName: "아트",
    mark: "A",
    color: "#ec4899",
    desc: "펜으로 근접 베기 공격을 합니다.",
    baseCost: 90,
    dps: 5,
    attackType: "slash",
    skill: { type: "cleave", name: "잉크 소용돌이", targets: 2, multiplier: 1.9 },
  },
  {
    id: "qa",
    name: "QA",
    shortName: "QA",
    mark: "Q",
    color: "#7c3aed",
    desc: "버그를 발견해 적 체력을 꾸준히 깎습니다.",
    baseCost: 140,
    dps: 8,
    attackType: "qa",
    skill: { type: "all", name: "전체 회귀 테스트", multiplier: 0.9 },
  },
];

const tools = [
  { id: "engine", name: "게임 엔진", desc: "클릭 기여도 +1", baseCost: 35, click: 1 },
  { id: "aiTool", name: "AI 보조도구", desc: "전체 자동 기여도 +15%", baseCost: 85, multiplier: 0.15 },
  { id: "tablet", name: "드로잉 태블릿", desc: "일러스트레이터 효율 +2", baseCost: 120, target: "artist", dps: 2 },
  { id: "testKit", name: "테스트 키트", desc: "QA 효율 +3", baseCost: 160, target: "qa", dps: 3 },
];

const enemyNames = ["작은 버그", "촉박한 마감", "스코프 증가", "서버 장애", "대형 프로젝트"];

const defaultState = {
  gold: 0,
  idea: 0,
  chapter: 1,
  subStage: 1,
  battleMode: "normal",
  stage: 1,
  enemyHp: 10,
  enemyMaxHp: 10,
  enemyX: ENEMY_SPAWN_X,
  enemies: [],
  clickPower: 1,
  playerLevel: 1,
  clearCount: 0,
  elapsed: 0,
  recruits: {},
  tools: {},
};

let state;
let refs;
let isSpawningNext = false;
let lastRosterKey = "";
let basicAttackCooldown = 0.35;
let skillAttackCooldown = SKILL_ATTACK_RATE;
let saveCooldown = 0;
let lastTick = Date.now();
let gameTimer = null;
let enemySeq = 0;
let currentBgmKey = "title";
let hasStartedGame = false;
let titleBgmUnlockArmed = false;
let audioSettings = { ...defaultAudioSettings };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}

function initGame() {
  refs = {
    allyLayer: document.querySelector("#allyLayer"),
    startScreen: document.querySelector("#startScreen"),
    gameShell: document.querySelector("#gameShell"),
    startButton: document.querySelector("#startButton"),
    titleMuteButton: document.querySelector("#titleMuteButton"),
    titleVolumeSlider: document.querySelector("#titleVolumeSlider"),
    titleVolumeValue: document.querySelector("#titleVolumeValue"),
    headerTitleButton: document.querySelector("#headerTitleButton"),
    battlefield: document.querySelector("#battlefield"),
    effectLayer: document.querySelector("#effectLayer"),
    goldText: document.querySelector("#goldText"),
    ideaText: document.querySelector("#ideaText"),
    stageText: document.querySelector("#stageText"),
    dpsText: document.querySelector("#dpsText"),
    enemyLayer: document.querySelector("#enemyLayer"),
    battleLog: document.querySelector("#battleLog"),
    teamCountText: document.querySelector("#teamCountText"),
    clickPowerText: document.querySelector("#clickPowerText"),
    clearCountText: document.querySelector("#clearCountText"),
    playTimeText: document.querySelector("#playTimeText"),
    attackTimerText: document.querySelector("#attackTimerText"),
    saveStateText: document.querySelector("#saveStateText"),
    recruitList: document.querySelector("#recruitList"),
    toolList: document.querySelector("#toolList"),
    manualWorkButton: document.querySelector("#manualWorkButton"),
    upgradePlayerButton: document.querySelector("#upgradePlayerButton"),
    nextStageButton: document.querySelector("#nextStageButton"),
    saveButton: document.querySelector("#saveButton"),
    resetButton: document.querySelector("#resetButton"),
    returnTitleButton: document.querySelector("#returnTitleButton"),
    muteButton: document.querySelector("#muteButton"),
    volumeSlider: document.querySelector("#volumeSlider"),
    volumeValue: document.querySelector("#volumeValue"),
    audioMuteButtons: [...document.querySelectorAll("[data-audio-mute]")],
    audioVolumeSliders: [...document.querySelectorAll("[data-audio-volume]")],
    audioVolumeValues: [...document.querySelectorAll("[data-audio-value]")],
    bgmAudio: document.querySelector("#bgmAudio"),
  };

  state = loadState();
  audioSettings = loadAudioSettings();
  if (!state.enemies.length) {
    spawnWave();
  }

  bindEvents();
  applyAudioSettings();
  renderAll();
  playBgm("title", { silentFail: true });
  armTitleBgmUnlock();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    const recruitButton = event.target.closest("[data-buy-recruit]");
    const toolButton = event.target.closest("[data-buy-tool]");

    if (tab) switchTab(tab);
    if (recruitButton) buyRecruit(recruitButton.dataset.buyRecruit);
    if (toolButton) buyTool(toolButton.dataset.buyTool);
  });

  refs.manualWorkButton.addEventListener("click", () => {
    attackUnit(getPlayerUnit(state.clickPower), { manual: true });
  });
  refs.upgradePlayerButton.addEventListener("click", upgradePlayer);
  refs.nextStageButton.addEventListener("click", () => {
    if (state.battleMode !== "boss") advanceBattleLayer();
    spawnWave();
    renderAll();
  });
  refs.saveButton.addEventListener("click", () => saveState("수동 저장 완료"));
  refs.resetButton.addEventListener("click", resetGame);
  refs.returnTitleButton.addEventListener("click", returnToTitle);
  refs.headerTitleButton.addEventListener("click", returnToTitle);
  refs.startButton.addEventListener("click", startGame);
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-audio-mute]")) toggleMute();
  });
  document.addEventListener("input", handleAudioInput);
  document.addEventListener("change", handleAudioInput);
}

function startGame() {
  hasStartedGame = true;
  refs.startScreen.classList.add("is-hidden");
  refs.gameShell.classList.remove("is-hidden");
  playBgm(getBattleBgmKey());
  renderAll();
  startLoop();
}

function returnToTitle() {
  hasStartedGame = false;
  stopLoop();
  refs.gameShell.classList.add("is-hidden");
  refs.startScreen.classList.remove("is-hidden");
  playBgm("title");
  armTitleBgmUnlock();
}

function playBgm(trackKey, options = {}) {
  if (!refs.bgmAudio) return;

  const nextSrc = BGM_TRACKS[trackKey] || BGM_TRACKS.title;
  const nextUrl = new URL(nextSrc, window.location.href).href;
  if (currentBgmKey !== trackKey || refs.bgmAudio.src !== nextUrl) {
    refs.bgmAudio.src = nextSrc;
    refs.bgmAudio.load();
    currentBgmKey = trackKey;
  }

  applyAudioSettings();
  const playPromise = refs.bgmAudio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      if (!options.silentFail) log("BGM 재생이 브라우저에서 차단되었습니다.");
    });
  }
}

function loadAudioSettings() {
  try {
    const saved = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!saved) return { ...defaultAudioSettings };

    const parsed = JSON.parse(saved);
    return normalizeAudioSettings(parsed);
  } catch {
    return { ...defaultAudioSettings };
  }
}

function normalizeAudioSettings(settings) {
  const volume = Number(settings.volume);
  return {
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : defaultAudioSettings.volume,
    muted: Boolean(settings.muted),
  };
}

function saveAudioSettings() {
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(audioSettings));
  } catch {
    log("오디오 설정 저장에 실패했습니다.");
  }
}

function applyAudioSettings() {
  const volumePercent = Math.round(audioSettings.volume * 100);
  const isMuted = audioSettings.muted || audioSettings.volume <= 0;

  if (refs.bgmAudio) {
    refs.bgmAudio.volume = audioSettings.volume;
    refs.bgmAudio.muted = isMuted;
  }

  refs.audioVolumeSliders.forEach((slider) => {
    slider.value = String(volumePercent);
    slider.setAttribute("aria-valuetext", `${volumePercent}%`);
  });
  refs.audioVolumeValues.forEach((value) => {
    value.textContent = `${volumePercent}%`;
  });
  refs.audioMuteButtons.forEach((button) => {
    button.textContent = isMuted ? "음소거 해제" : "음소거";
    button.classList.toggle("is-muted", isMuted);
    button.setAttribute("aria-pressed", String(isMuted));
  });
}

function toggleMute() {
  const shouldUnmute = audioSettings.muted || audioSettings.volume <= 0;
  audioSettings.muted = !shouldUnmute;
  if (shouldUnmute && audioSettings.volume <= 0) {
    audioSettings.volume = defaultAudioSettings.volume;
  }
  applyAudioSettings();
  saveAudioSettings();
  if (!audioSettings.muted) playBgm(currentBgmKey || "title", { silentFail: true });
}

function handleAudioInput(event) {
  const slider = event.target.closest("[data-audio-volume]");
  if (!slider) return;

  const nextVolume = Math.min(100, Math.max(0, Number(slider.value) || 0)) / 100;
  audioSettings.volume = nextVolume;
  audioSettings.muted = nextVolume <= 0;
  applyAudioSettings();
  saveAudioSettings();
  if (!audioSettings.muted) playBgm(currentBgmKey || "title", { silentFail: true });
}

function getBattleBgmKey() {
  return state.battleMode === "boss" ? "boss" : "field";
}

function armTitleBgmUnlock() {
  if (titleBgmUnlockArmed) return;

  titleBgmUnlockArmed = true;
  const unlock = () => {
    titleBgmUnlockArmed = false;
    if (!hasStartedGame) playBgm("title", { silentFail: true });
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function startLoop() {
  if (gameTimer) window.clearInterval(gameTimer);
  lastTick = Date.now();
  gameTimer = window.setInterval(() => {
    const now = Date.now();
    const delta = Math.min(0.2, (now - lastTick) / 1000);
    lastTick = now;
    tick(delta);
  }, TICK_RATE);
}

function stopLoop() {
  if (!gameTimer) return;
  window.clearInterval(gameTimer);
  gameTimer = null;
}

function tick(delta) {
  try {
    state.elapsed += delta;
    saveCooldown += delta;

    moveEnemies(delta);
    updateAutoCombat(delta);

    if (saveCooldown >= 10) {
      saveCooldown = 0;
      saveState("자동 저장 완료");
    }

    renderBattle();
  } catch (error) {
    log(`전투 루프 오류: ${error.message}`);
  }
}

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function loadState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneDefaultState();
    return normalizeState({ ...cloneDefaultState(), ...JSON.parse(saved) });
  } catch {
    return cloneDefaultState();
  }
}

function normalizeState(nextState) {
  return {
    ...cloneDefaultState(),
    ...nextState,
    gold: Number(nextState.gold) || 0,
    idea: Number(nextState.idea) || 0,
    chapter: Math.max(1, Number(nextState.chapter) || Number(nextState.stage) || 1),
    subStage: Math.min(
      NORMAL_STAGES_PER_CHAPTER,
      Math.max(1, Number(nextState.subStage) || deriveSubStageFromLegacy(nextState.stage))
    ),
    battleMode: nextState.battleMode === "boss" ? "boss" : "normal",
    stage: Math.max(1, Number(nextState.chapter) || Number(nextState.stage) || 1),
    enemyHp: Math.max(0, Number(nextState.enemyHp) || defaultState.enemyHp),
    enemyMaxHp: Math.max(1, Number(nextState.enemyMaxHp) || defaultState.enemyMaxHp),
    enemyX: Number(nextState.enemyX) || ENEMY_SPAWN_X,
    enemies: normalizeEnemies(nextState.enemies),
    clickPower: Math.max(1, Number(nextState.clickPower) || 1),
    playerLevel: Math.max(1, Number(nextState.playerLevel) || 1),
    clearCount: Math.max(0, Number(nextState.clearCount) || 0),
    elapsed: Math.max(0, Number(nextState.elapsed) || 0),
    recruits: nextState.recruits && typeof nextState.recruits === "object" ? nextState.recruits : {},
    tools: nextState.tools && typeof nextState.tools === "object" ? nextState.tools : {},
  };
}

function saveState(message) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    message = "저장소 접근 불가";
  }
  refs.saveStateText.textContent = message;
}

function resetGame() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    refs.saveStateText.textContent = "저장소 접근 불가";
  }
  state = cloneDefaultState();
  lastRosterKey = "";
  spawnWave();
  renderAll();
  saveState("초기화 완료");
}

function normalizeEnemies(enemies) {
  if (!Array.isArray(enemies)) return [];
  return enemies
    .map((enemy, index) => ({
      id: enemy.id || `saved-${index}`,
      name: enemy.name || getEnemyName(),
      hp: Math.max(1, Number(enemy.hp) || 1),
      maxHp: Math.max(1, Number(enemy.maxHp) || 1),
      x: Number(enemy.x) || ENEMY_SPAWN_X,
      y: Number(enemy.y) || getEnemyLaneY(index),
      lane: Number(enemy.lane) || index,
      isBoss: Boolean(enemy.isBoss),
    }))
    .filter((enemy) => enemy.hp > 0);
}

function spawnWave() {
  state.stage = state.chapter;
  state.enemies = state.battleMode === "boss" ? createBossWave() : createNormalWave();
  state.enemyMaxHp = state.enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0);
  state.enemyHp = state.enemies.reduce((sum, enemy) => sum + enemy.hp, 0);
  state.enemyX = ENEMY_SPAWN_X;
  isSpawningNext = false;
  basicAttackCooldown = 0.35;
  skillAttackCooldown = SKILL_ATTACK_RATE;
  if (hasStartedGame) playBgm(getBattleBgmKey());
  log(`${getProgressLabel()} ${state.battleMode === "boss" ? "보스" : "업무"}가 오른쪽에서 접근합니다.`);
}

function createNormalWave() {
  const count = getWaveEnemyCount();
  const hp = getEnemyHp();
  return Array.from({ length: count }, (_, index) => ({
    id: `enemy-${Date.now()}-${enemySeq++}`,
    name: getEnemyName(),
    hp,
    maxHp: hp,
    x: ENEMY_SPAWN_X + index * 4,
    y: getEnemyLaneY(index),
    lane: index,
    isBoss: false,
  }));
}

function createBossWave() {
  const hp = getBossHp();
  return [
    {
      id: `boss-${Date.now()}-${enemySeq++}`,
      name: `${state.chapter}스테이지 보스`,
      hp,
      maxHp: hp,
      x: ENEMY_SPAWN_X,
      y: 72,
      lane: 0,
      isBoss: true,
    },
  ];
}

function getWaveEnemyCount() {
  return Math.min(ENEMY_MAX_COUNT, 2 + Math.floor((state.subStage - 1) / 2) + Math.floor((state.chapter - 1) / 3));
}

function getEnemyHp() {
  return Math.floor(6 + state.chapter * 2.2 + state.subStage * 1.4);
}

function getBossHp() {
  return Math.floor(getEnemyHp() * (5.5 + state.chapter * 0.4));
}

function getEnemyLaneY(index) {
  const lanes = [34, 62, 90, 118, 48];
  return lanes[index % lanes.length];
}

function moveEnemies(delta) {
  if (isSpawningNext || !state.enemies.length) return;

  const speed = Math.min(5.2, 2.2 + state.stage * 0.06);
  state.enemies.forEach((enemy) => {
    enemy.x = Math.max(ENEMY_CONTACT_X, enemy.x - speed * delta);

    if (enemy.x <= ENEMY_CONTACT_X) {
      if (enemy.isBoss) {
        failBossBattle();
        return;
      }

      enemy.x = ENEMY_SPAWN_X + enemy.lane * 3;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.ceil(enemy.maxHp * 0.1));
      log("업무가 팀 앞까지 밀려와 일정 압박이 커졌습니다.");
    }
  });

  syncEnemySummary();
}

function updateAutoCombat(delta) {
  if (isSpawningNext || !state.enemies.length) return;

  basicAttackCooldown -= delta;
  skillAttackCooldown -= delta;

  if (basicAttackCooldown <= 0) {
    basicAttackCooldown += BASIC_ATTACK_RATE;
    performAttackRound(false);
  }

  if (skillAttackCooldown <= 0) {
    skillAttackCooldown += SKILL_ATTACK_RATE;
    performAttackRound(true);
    log("팀 스킬 공격!");
  }
}

function performAttackRound(skill) {
  getUnits().forEach((unit, index) => {
    window.setTimeout(() => attackUnit(unit, { skill }), index * 120);
  });
}

function attackUnit(unit, options = {}) {
  const target = getTargetEnemy();
  if (isSpawningNext || !target) return;

  const skill = Boolean(options.skill);
  const manual = Boolean(options.manual);
  const from = getUnitPosition(unit.id);

  if (skill && unit.skill) {
    castSkill(unit, from);
    return;
  }

  const damage = unit.power;

  if (unit.attackType === "slash") {
    playSlash(unit, target, skill);
    window.setTimeout(() => damageEnemy(target.id, damage, manual), 140);
  } else {
    playProjectile(unit, from, target, skill);
    window.setTimeout(() => damageEnemy(target.id, damage, manual), 240);
  }
}

function castSkill(unit, from) {
  const targets = getSkillTargets(unit.skill);
  if (!targets.length) return;

  pulseUnit(unit.id, "is-skill", 520);
  playSkillEffect(unit, targets);

  targets.forEach((target, index) => {
    const damage = Math.ceil(unit.power * unit.skill.multiplier + state.playerLevel * 0.6);
    window.setTimeout(() => damageEnemy(target.id, damage, false), 120 + index * 70);
  });

  log(`${unit.shortName} 스킬: ${unit.skill.name}`);
}

function getSkillTargets(skill) {
  const target = getTargetEnemy();
  if (!target) return [];

  if (skill.type === "all") return [...state.enemies];

  if (skill.type === "aoe") {
    return state.enemies.filter((enemy) => Math.abs(enemy.x - target.x) <= skill.radius);
  }

  if (skill.type === "chain" || skill.type === "cleave") {
    return [...state.enemies].sort((a, b) => a.x - b.x || a.y - b.y).slice(0, skill.targets);
  }

  return [target];
}

function playProjectile(unit, from, target, skill) {
  const shot = document.createElement("span");
  shot.className = `projectile is-${unit.attackType}${skill ? " is-skill" : ""}`;
  shot.style.setProperty("--from-x", `${from.x}%`);
  shot.style.setProperty("--from-y", `${from.y}px`);
  shot.style.setProperty("--to-x", `${target.x}%`);
  shot.style.setProperty("--shot-color", unit.color);
  refs.effectLayer.appendChild(shot);
  pulseUnit(unit.id, "is-attacking", 320);
  window.setTimeout(() => shot.remove(), 480);
}

function playSlash(unit, target, skill) {
  const ally = refs.allyLayer.querySelector(`[data-unit-id="${unit.id}"]`);
  if (ally) {
    ally.style.setProperty("--slash-x", `${Math.max(36, target.x - 9)}%`);
    ally.classList.add("is-slashing");
    window.setTimeout(() => ally.classList.remove("is-slashing"), 300);
  }

  const slash = document.createElement("span");
  slash.className = `slash-effect${skill ? " is-skill" : ""}`;
  slash.style.setProperty("--hit-x", `${target.x}%`);
  refs.effectLayer.appendChild(slash);
  window.setTimeout(() => slash.remove(), 360);
}

function playSkillEffect(unit, targets) {
  const centerX = targets.reduce((sum, target) => sum + target.x, 0) / targets.length;
  const centerY = targets.reduce((sum, target) => sum + target.y, 0) / targets.length + 64;
  const effect = document.createElement("span");
  effect.className = `skill-zone is-${unit.skill.type}`;
  effect.textContent = unit.skill.type === "all" ? "TEST" : unit.skill.type === "chain" ? "LINK" : "";
  effect.style.setProperty("--skill-x", `${centerX}%`);
  effect.style.setProperty("--skill-y", `${centerY}px`);
  effect.style.setProperty("--skill-color", unit.color);
  refs.effectLayer.appendChild(effect);
  window.setTimeout(() => effect.remove(), 620);

  targets.forEach((target) => {
    const marker = document.createElement("span");
    marker.className = "skill-hit-marker";
    marker.style.setProperty("--hit-x", `${target.x}%`);
    marker.style.setProperty("--hit-y", `${target.y + 82}px`);
    marker.style.setProperty("--skill-color", unit.color);
    refs.effectLayer.appendChild(marker);
    window.setTimeout(() => marker.remove(), 520);
  });
}

function damageEnemy(enemyId, amount, manual) {
  if (isSpawningNext) return;

  const target = state.enemies.find((enemy) => enemy.id === enemyId) || getTargetEnemy();
  if (!target) return;

  const finalAmount = Math.max(1, Math.round(amount * getGlobalMultiplier()));
  target.hp = Math.max(0, target.hp - finalAmount);
  showDamage(finalAmount, target);
  pulseEnemy(target.id);

  if (target.hp <= 0) {
    defeatEnemy(target.id, manual);
  } else if (manual) {
    log(`직접 처리로 ${finalAmount} 기여도를 넣었습니다.`);
  }
  syncEnemySummary();
}

function defeatEnemy(enemyId, manual) {
  state.enemies = state.enemies.filter((enemy) => enemy.id !== enemyId);
  const goldGain = Math.floor(3 + state.chapter * 1.4 + state.subStage * 0.6);
  const ideaGain = manual ? 1 : 0;
  state.gold += goldGain;
  state.idea += ideaGain;
  state.clearCount += 1;

  if (!state.enemies.length) completeWave(manual);
}

function completeWave(manual) {
  if (isSpawningNext) return;

  isSpawningNext = true;
  const clearedBoss = state.battleMode === "boss";
  const bonusIdea = clearedBoss ? 8 + state.chapter * 2 : manual ? 1 : 2;
  state.idea += bonusIdea;
  log(clearedBoss ? `${state.chapter}스테이지 보스 클리어! 아이디어 +${bonusIdea}` : `${getProgressLabel()} 클리어!`);

  window.setTimeout(() => {
    advanceBattleLayer();
    spawnWave();
    renderAll();
  }, 520);
}

function failBossBattle() {
  if (isSpawningNext) return;

  isSpawningNext = true;
  state.battleMode = "normal";
  state.subStage = NORMAL_STAGES_PER_CHAPTER;
  state.enemies = [];
  syncEnemySummary();
  log(`${state.chapter}스테이지 보스 퇴치 실패. ${state.chapter}-${state.subStage}로 복귀합니다.`);

  window.setTimeout(() => {
    spawnWave();
    renderAll();
  }, 700);
}

function advanceBattleLayer() {
  if (state.battleMode === "boss") {
    state.chapter += 1;
    state.subStage = 1;
    state.battleMode = "normal";
  } else if (state.subStage >= NORMAL_STAGES_PER_CHAPTER) {
    state.battleMode = "boss";
  } else {
    state.subStage += 1;
  }
  state.stage = state.chapter;
}

function getTargetEnemy() {
  return [...state.enemies].sort((a, b) => a.x - b.x || a.y - b.y)[0] || null;
}

function pulseEnemy(enemyId) {
  const enemy = refs.enemyLayer.querySelector(`[data-enemy-id="${enemyId}"]`);
  if (!enemy) return;
  enemy.classList.add("is-hit");
  window.setTimeout(() => enemy.classList.remove("is-hit"), 120);
}

function syncEnemySummary() {
  state.enemyHp = state.enemies.reduce((sum, enemy) => sum + enemy.hp, 0);
  state.enemyMaxHp = state.enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0) || 1;
  const target = getTargetEnemy();
  state.enemyX = target ? target.x : ENEMY_SPAWN_X;
}

function showDamage(amount, target) {
  const damage = document.createElement("span");
  damage.className = "damage-number";
  damage.textContent = `-${amount}`;
  damage.style.setProperty("--hit-x", `${target.x}%`);
  damage.style.setProperty("--hit-y", `${target.y + 92}px`);
  refs.effectLayer.appendChild(damage);
  window.setTimeout(() => damage.remove(), 760);
}

function pulseUnit(unitId, className, duration) {
  const ally = refs.allyLayer.querySelector(`[data-unit-id="${unitId}"]`);
  if (!ally) return;
  ally.classList.add(className);
  window.setTimeout(() => ally.classList.remove(className), duration);
}

function getPlayerUnit(power = state.playerLevel) {
  return {
    id: "player",
    name: "대표",
    shortName: "대표",
    mark: "C",
    color: "#059669",
    spriteSheet: "Anim/Player_1/Motion.png",
    count: 1,
    power,
    attackType: "code",
    skill: { type: "aoe", name: "핫픽스 배포", radius: 12, multiplier: 1.35 },
  };
}

function getUnits() {
  const units = [getPlayerUnit()];
  recruits.forEach((recruit) => {
    const count = getRecruitCount(recruit.id);
    if (count > 0) {
      units.push({
        ...recruit,
        count,
        power: getRecruitPower(recruit) * count,
      });
    }
  });
  return units;
}

function getUnitPosition(unitId) {
  const index = Math.max(0, getUnits().findIndex((unit) => unit.id === unitId));
  return getAllyPosition(index);
}

function getRecruitCount(id) {
  return state.recruits[id] || 0;
}

function getToolLevel(id) {
  return state.tools[id] || 0;
}

function getRecruitPower(recruit) {
  const toolBonus = tools
    .filter((tool) => tool.target === recruit.id)
    .reduce((bonus, tool) => bonus + getToolLevel(tool.id) * tool.dps, 0);
  return recruit.dps + toolBonus;
}

function getGlobalMultiplier() {
  return tools.reduce((sum, tool) => sum + (tool.multiplier || 0) * getToolLevel(tool.id), 1);
}

function getTotalDps() {
  const recruitDps = recruits.reduce((sum, recruit) => sum + getRecruitCount(recruit.id) * getRecruitPower(recruit), 0);
  return Math.max(1, Math.round((state.playerLevel + recruitDps) * getGlobalMultiplier()));
}

function getTeamCount() {
  return 1 + recruits.reduce((sum, recruit) => sum + getRecruitCount(recruit.id), 0);
}

function getEnemyName() {
  return enemyNames[Math.min(enemyNames.length - 1, state.chapter - 1)];
}

function getProgressLabel() {
  return state.battleMode === "boss" ? `${state.chapter}-BOSS` : `${state.chapter}-${state.subStage}`;
}

function getBattleBackground() {
  const bgIndex = ((state.chapter - 1) % 3) + 1;
  return `Resource/BackGround/BG_${bgIndex}.png`;
}

function deriveSubStageFromLegacy(stage) {
  const legacyStage = Math.max(1, Number(stage) || 1);
  return ((legacyStage - 1) % NORMAL_STAGES_PER_CHAPTER) + 1;
}

function costFor(baseCost, count) {
  return Math.floor(baseCost * Math.pow(1.32, count));
}

function buyRecruit(id) {
  const recruit = recruits.find((item) => item.id === id);
  const count = getRecruitCount(id);
  const cost = costFor(recruit.baseCost, count);
  if (state.gold < cost) return;

  state.gold -= cost;
  state.recruits[id] = count + 1;
  basicAttackCooldown = Math.min(basicAttackCooldown, 0.2);
  log(`${recruit.name} 영입 완료. 전투 화면에 배치되었습니다.`);
  renderAll();
}

function buyTool(id) {
  const tool = tools.find((item) => item.id === id);
  const level = getToolLevel(id);
  const cost = costFor(tool.baseCost, level);
  if (state.idea < cost) return;

  state.idea -= cost;
  state.tools[id] = level + 1;
  if (tool.click) state.clickPower += tool.click;
  log(`${tool.name} 강화 완료`);
  renderAll();
}

function upgradePlayer() {
  const cost = Math.floor(18 * Math.pow(1.4, state.playerLevel - 1));
  if (state.gold < cost) return;

  state.gold -= cost;
  state.playerLevel += 1;
  state.clickPower += 1;
  log("대표 역량이 강화되었습니다.");
  renderAll();
}

function switchTab(tab) {
  document.querySelectorAll(".tab-button").forEach((button) => button.classList.toggle("is-active", button === tab));
  document
    .querySelectorAll(".tab-panel")
    .forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tab.dataset.tab));
}

function renderAll() {
  renderAllies();
  renderShop();
  renderEnemies();
  renderBattle();
}

function renderBattle() {
  const hpPercent = Math.max(0, Math.round((state.enemyHp / state.enemyMaxHp) * 100));
  const playerCost = Math.floor(18 * Math.pow(1.4, state.playerLevel - 1));

  refs.goldText.textContent = Math.floor(state.gold);
  refs.ideaText.textContent = Math.floor(state.idea);
  refs.stageText.textContent = getProgressLabel();
  refs.battlefield.style.setProperty("--battle-bg", `url("${getBattleBackground()}")`);
  setText(refs.dpsText, `초당 기여도 ${getTotalDps()}`);
  renderEnemies();
  setText(refs.teamCountText, `${getTeamCount()}명`);
  setText(refs.clickPowerText, state.clickPower);
  setText(refs.clearCountText, `${state.clearCount}건`);
  setText(refs.playTimeText, formatTime(state.elapsed));
  setText(refs.attackTimerText, `${Math.max(0, Math.min(basicAttackCooldown, skillAttackCooldown)).toFixed(1)}초`);
  refs.upgradePlayerButton.textContent = `대표 역량 강화 (${playerCost} 자금)`;
  refs.upgradePlayerButton.disabled = state.gold < playerCost;
  refs.nextStageButton.textContent = state.battleMode === "boss" ? "보스 재도전" : "다음 단계";
}

function renderEnemies() {
  refs.enemyLayer.innerHTML = state.enemies
    .map((enemy) => {
      const hpPercent = Math.max(0, Math.round((enemy.hp / enemy.maxHp) * 100));
      return `
        <div class="enemy${enemy.isBoss ? " is-boss" : ""}" data-enemy-id="${enemy.id}" style="--enemy-x: ${enemy.x}%; --enemy-y: ${enemy.y}px;">
          <img src="assets/enemy.svg" alt="버그 몬스터" class="enemy-sprite" />
          <div class="enemy-card">
            <strong>${enemy.name}</strong>
            <div class="hp-bar" aria-label="상대 체력">
              <span style="width: ${hpPercent}%"></span>
            </div>
            <small>${Math.ceil(enemy.hp)} / ${enemy.maxHp}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAllies() {
  const units = getUnits();
  const rosterKey = units.map((unit) => `${unit.id}:${unit.count}:${unit.power}`).join("|");
  if (rosterKey === lastRosterKey) return;

  lastRosterKey = rosterKey;
  refs.allyLayer.innerHTML = units
    .map((unit, index) => {
      const position = getAllyPosition(index);
      const countText = unit.count > 1 ? ` x${unit.count}` : "";
      const spriteMarkup = unit.sprites
        ? `<span class="ally-state-sprite" role="img" aria-label="${unit.name}" style="--idle-url: url('${unit.sprites.idle}'); --attack-url: url('${unit.sprites.attack}'); --skill-url: url('${unit.sprites.skill}')"></span>`
        : unit.spriteSheet
        ? `<span class="ally-sprite-sheet" role="img" aria-label="${unit.name}" style="--sprite-url: url('${unit.spriteSheet}')"></span>`
        : unit.sprite
        ? `<img src="${unit.sprite}" alt="${unit.name}" class="ally-sprite-image" />`
        : `<span class="ally-sprite">${unit.mark}</span>`;
      return `
        <div class="ally" data-unit-id="${unit.id}" style="--ally-x: ${position.x}%; --ally-y: ${position.y}px; --ally-color: ${unit.color};">
          ${spriteMarkup}
          <span class="ally-role">${unit.shortName}${countText}</span>
        </div>
      `;
    })
    .join("");
}

function getAllyPosition(index) {
  const positions = [
    { x: 15, y: 64 },
    { x: 24, y: 42 },
    { x: 24, y: 106 },
    { x: 32, y: 72 },
    { x: 20, y: 138 },
  ];
  return positions[index] || { x: 16 + index * 5, y: 42 + (index % 3) * 46 };
}

function renderShop() {
  refs.recruitList.innerHTML = recruits
    .map((recruit) => {
      const count = getRecruitCount(recruit.id);
      const cost = costFor(recruit.baseCost, count);
      return `
        <div class="shop-item">
          <div>
            <strong>${recruit.name} Lv.${count}</strong>
            <span class="shop-meta">${recruit.desc} / 초당 +${recruit.dps}</span>
          </div>
          <button type="button" data-buy-recruit="${recruit.id}" ${state.gold < cost ? "disabled" : ""}>${cost} 자금</button>
        </div>
      `;
    })
    .join("");

  refs.toolList.innerHTML = tools
    .map((tool) => {
      const level = getToolLevel(tool.id);
      const cost = costFor(tool.baseCost, level);
      return `
        <div class="shop-item">
          <div>
            <strong>${tool.name} Lv.${level}</strong>
            <span class="shop-meta">${tool.desc}</span>
          </div>
          <button type="button" data-buy-tool="${tool.id}" ${state.idea < cost ? "disabled" : ""}>${cost} 아이디어</button>
        </div>
      `;
    })
    .join("");
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function log(message) {
  if (refs && refs.battleLog) refs.battleLog.textContent = message;
}
