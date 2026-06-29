const STORAGE_KEY = "studioCrewRpgSave";
const ENEMY_SPAWN_X = 84;
const ENEMY_DETECTION_X = 76;
const ENEMY_CONTACT_X = 43;

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
    attackRate: 1.35,
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
    attackRate: 1.05,
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
    attackRate: 1.45,
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
    attackRate: 1.8,
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
  stage: 1,
  enemyHp: 10,
  enemyMaxHp: 10,
  enemyX: ENEMY_SPAWN_X,
  clickPower: 1,
  playerLevel: 1,
  clearCount: 0,
  elapsed: 0,
  recruits: {},
  tools: {},
};

let state = loadState();
let saveCooldown = 0;
let lastTick = performance.now();
let isSpawningNext = false;
let nextAttackHint = 1;
let lastRosterKey = "";
let wasEnemyDetected = false;
const attackTimers = {};

const $ = (selector) => document.querySelector(selector);
const battlefield = $("#battlefield");
const allyLayer = $("#allyLayer");
const effectLayer = $("#effectLayer");
const goldText = $("#goldText");
const ideaText = $("#ideaText");
const stageText = $("#stageText");
const dpsText = $("#dpsText");
const enemy = $("#enemy");
const enemyName = $("#enemyName");
const enemyHpBar = $("#enemyHpBar");
const enemyHpText = $("#enemyHpText");
const battleLog = $("#battleLog");
const teamCountText = $("#teamCountText");
const clickPowerText = $("#clickPowerText");
const clearCountText = $("#clearCountText");
const playTimeText = $("#playTimeText");
const attackTimerText = $("#attackTimerText");
const saveStateText = $("#saveStateText");
const recruitList = $("#recruitList");
const toolList = $("#toolList");

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

function saveState(message = "저장 완료") {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    message = "저장소 접근 불가";
  }
  saveStateText.textContent = message;
}

function normalizeState(nextState) {
  return {
    ...cloneDefaultState(),
    ...nextState,
    gold: Number(nextState.gold) || 0,
    idea: Number(nextState.idea) || 0,
    stage: Math.max(1, Number(nextState.stage) || 1),
    enemyHp: Math.max(0, Number(nextState.enemyHp) || defaultState.enemyHp),
    enemyMaxHp: Math.max(1, Number(nextState.enemyMaxHp) || defaultState.enemyMaxHp),
    enemyX: Number(nextState.enemyX) || ENEMY_SPAWN_X,
    clickPower: Math.max(1, Number(nextState.clickPower) || 1),
    playerLevel: Math.max(1, Number(nextState.playerLevel) || 1),
    clearCount: Math.max(0, Number(nextState.clearCount) || 0),
    elapsed: Math.max(0, Number(nextState.elapsed) || 0),
    recruits: nextState.recruits && typeof nextState.recruits === "object" ? nextState.recruits : {},
    tools: nextState.tools && typeof nextState.tools === "object" ? nextState.tools : {},
  };
}

function getRecruitCount(id) {
  return state.recruits[id] || 0;
}

function getToolLevel(id) {
  return state.tools[id] || 0;
}

function costFor(baseCost, count) {
  return Math.floor(baseCost * Math.pow(1.32, count));
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
  const recruitDps = recruits.reduce((sum, recruit) => {
    return sum + getRecruitCount(recruit.id) * getRecruitPower(recruit);
  }, 0);
  return Math.max(1, Math.round((state.playerLevel + recruitDps) * getGlobalMultiplier()));
}

function getTeamCount() {
  return 1 + recruits.reduce((sum, recruit) => sum + getRecruitCount(recruit.id), 0);
}

function getEnemyName() {
  return enemyNames[Math.min(enemyNames.length - 1, Math.floor((state.stage - 1) / 4))];
}

function getUnits() {
  const units = [
    {
      id: "player",
      name: "대표",
      shortName: "대표",
      mark: "C",
      color: "#059669",
      sprite: "assets/player.svg",
      count: 1,
      power: state.playerLevel,
      attackType: "code",
      attackRate: 1,
    },
  ];

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

function spawnEnemy() {
  const hp = Math.floor(8 + state.stage * 8 + Math.pow(state.stage, 1.45) * 5);
  state.enemyMaxHp = hp;
  state.enemyHp = hp;
  state.enemyX = ENEMY_SPAWN_X;
  isSpawningNext = false;
  wasEnemyDetected = false;
  resetAttackTimers(0);
  enemy.classList.remove("is-defeated");
  log(`${getEnemyName()} 업무가 오른쪽에서 접근합니다.`);
}

function isEnemyDetected() {
  return state.enemyX <= ENEMY_DETECTION_X && state.enemyHp > 0 && !isSpawningNext;
}

function moveEnemy(delta) {
  if (isSpawningNext || state.enemyHp <= 0) return;

  const speed = Math.min(8, 4.8 + state.stage * 0.12);
  state.enemyX -= speed * delta;

  if (state.enemyX <= ENEMY_CONTACT_X) {
    state.enemyX = ENEMY_SPAWN_X;
    state.enemyHp = Math.min(state.enemyMaxHp, state.enemyHp + Math.ceil(state.enemyMaxHp * 0.15));
    log("업무가 팀 앞까지 밀려와 일정 압박이 커졌습니다.");
  }
}

function damageEnemy(amount, source, unitId = "player") {
  if (isSpawningNext || state.enemyHp <= 0) return;

  const finalAmount = Math.max(1, Math.round(amount * getGlobalMultiplier()));
  state.enemyHp = Math.max(0, state.enemyHp - finalAmount);
  showDamage(finalAmount);
  enemy.classList.add("is-hit");
  window.setTimeout(() => enemy.classList.remove("is-hit"), 120);

  if (state.enemyHp <= 0) {
    completeEnemy(source);
  } else if (source === "manual") {
    log(`직접 처리로 ${finalAmount} 기여도를 넣었습니다.`);
  } else if (unitId === "artist") {
    log("일러스트레이터가 펜으로 빠르게 베었습니다.");
  }
}

function completeEnemy(source) {
  if (isSpawningNext) return;

  isSpawningNext = true;
  const goldGain = Math.floor(6 + state.stage * 4);
  const ideaGain = source === "manual" ? 2 : 1;
  state.gold += goldGain;
  state.idea += ideaGain;
  state.clearCount += 1;
  enemy.classList.add("is-defeated");
  log(`업무 완료! 자금 +${goldGain}, 아이디어 +${ideaGain}`);

  window.setTimeout(() => {
    state.stage += 1;
    spawnEnemy();
    render();
  }, 520);
}

function attackWithUnit(unit, manual = false) {
  if (!manual && !isEnemyDetected()) return;

  const from = getUnitPosition(unit.id);
  const toX = state.enemyX;

  if (unit.attackType === "slash") {
    playSlash(unit, toX);
    window.setTimeout(() => damageEnemy(unit.power, "auto", unit.id), 160);
    return;
  }

  playProjectile(unit, from.x, from.y, toX);
  window.setTimeout(() => damageEnemy(unit.power, manual ? "manual" : "auto", unit.id), 300);
}

function playProjectile(unit, fromX, fromY, toX) {
  const shot = document.createElement("span");
  shot.className = `projectile is-${unit.attackType}`;
  shot.style.setProperty("--from-x", `${fromX}%`);
  shot.style.setProperty("--from-y", `${fromY}px`);
  shot.style.setProperty("--to-x", `${toX}%`);
  shot.style.setProperty("--shot-color", unit.color);
  effectLayer.appendChild(shot);
  window.setTimeout(() => shot.remove(), 420);
  pulseUnit(unit.id, "is-attacking", 320);
}

function playSlash(unit, toX) {
  const ally = allyLayer.querySelector(`[data-unit-id="${unit.id}"]`);
  if (ally) {
    ally.style.setProperty("--slash-x", `${Math.max(36, toX - 9)}%`);
    ally.classList.add("is-slashing");
    window.setTimeout(() => ally.classList.remove("is-slashing"), 300);
  }

  const slash = document.createElement("span");
  slash.className = "slash-effect";
  slash.style.setProperty("--hit-x", `${toX}%`);
  effectLayer.appendChild(slash);
  window.setTimeout(() => slash.remove(), 320);
}

function showDamage(amount) {
  const damage = document.createElement("span");
  damage.className = "damage-number";
  damage.textContent = `-${amount}`;
  damage.style.setProperty("--hit-x", `${state.enemyX}%`);
  effectLayer.appendChild(damage);
  window.setTimeout(() => damage.remove(), 760);
}

function pulseUnit(unitId, className, duration) {
  const ally = allyLayer.querySelector(`[data-unit-id="${unitId}"]`);
  if (!ally) return;
  ally.classList.add(className);
  window.setTimeout(() => ally.classList.remove(className), duration);
}

function resetAttackTimers(value = 0) {
  getUnits().forEach((unit) => {
    attackTimers[unit.id] = value;
  });
}

function getUnitPosition(unitId) {
  const index = getUnits().findIndex((unit) => unit.id === unitId);
  return {
    x: 14 + Math.max(0, index) * 7,
    y: 42 + (index % 2) * 66,
  };
}

function buyRecruit(id) {
  const recruit = recruits.find((item) => item.id === id);
  const count = getRecruitCount(id);
  const cost = costFor(recruit.baseCost, count);
  if (state.gold < cost) return;

  state.gold -= cost;
  state.recruits[id] = count + 1;
  attackTimers[id] = 0;
  log(`${recruit.name} 영입 완료. 전투 화면에 배치되었습니다.`);
  render();
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
  render();
}

function upgradePlayer() {
  const cost = Math.floor(18 * Math.pow(1.4, state.playerLevel - 1));
  if (state.gold < cost) return;

  state.gold -= cost;
  state.playerLevel += 1;
  state.clickPower += 1;
  log("대표 역량이 강화되었습니다.");
  render();
}

function nextStage() {
  state.stage += 1;
  spawnEnemy();
  render();
}

function log(message) {
  battleLog.textContent = message;
}

function renderAllies() {
  const units = getUnits();
  const rosterKey = units.map((unit) => `${unit.id}:${unit.count}:${unit.power}`).join("|");
  if (rosterKey === lastRosterKey) return;

  lastRosterKey = rosterKey;
  allyLayer.innerHTML = units
    .map((unit, index) => {
      const x = 14 + index * 7;
      const y = 42 + (index % 2) * 66;
      const countText = unit.count > 1 ? ` x${unit.count}` : "";
      const spriteMarkup = unit.sprite
        ? `<img src="${unit.sprite}" alt="${unit.name}" class="ally-sprite-image" />`
        : `<span class="ally-sprite">${unit.mark}</span>`;
      return `
        <div class="ally" data-unit-id="${unit.id}" style="--ally-x: ${x}%; --ally-y: ${y}px; --ally-color: ${unit.color};">
          ${spriteMarkup}
          <span class="ally-role">${unit.shortName}${countText}</span>
        </div>
      `;
    })
    .join("");
}

function renderShop() {
  recruitList.innerHTML = recruits
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

  toolList.innerHTML = tools
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

function render() {
  const hpPercent = Math.max(0, Math.round((state.enemyHp / state.enemyMaxHp) * 100));
  const playerCost = Math.floor(18 * Math.pow(1.4, state.playerLevel - 1));
  const detected = isEnemyDetected();

  goldText.textContent = Math.floor(state.gold);
  ideaText.textContent = Math.floor(state.idea);
  stageText.textContent = state.stage;
  dpsText.textContent = `초당 기여도 ${getTotalDps()}`;
  enemyName.textContent = getEnemyName();
  enemy.style.setProperty("--enemy-x", `${state.enemyX}%`);
  enemyHpBar.style.width = `${hpPercent}%`;
  enemyHpText.textContent = `${Math.ceil(state.enemyHp)} / ${state.enemyMaxHp}`;
  teamCountText.textContent = `${getTeamCount()}명`;
  clickPowerText.textContent = state.clickPower;
  clearCountText.textContent = `${state.clearCount}건`;
  playTimeText.textContent = formatTime(state.elapsed);
  attackTimerText.textContent = detected ? `${Math.max(0, nextAttackHint).toFixed(1)}초` : "탐색중";
  $("#upgradePlayerButton").textContent = `대표 역량 강화 (${playerCost} 자금)`;
  $("#upgradePlayerButton").disabled = state.gold < playerCost;
  renderAllies();
  renderShop();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function updateAttacks(delta) {
  if (isSpawningNext) return;

  if (!isEnemyDetected()) {
    wasEnemyDetected = false;
    nextAttackHint = 1;
    return;
  }

  if (!wasEnemyDetected) {
    wasEnemyDetected = true;
    getUnits().forEach((unit) => {
      attackTimers[unit.id] = unit.attackRate;
    });
    log(`${getEnemyName()} 업무를 인식했습니다. 공격을 시작합니다.`);
  }

  let soonest = 9;
  getUnits().forEach((unit) => {
    attackTimers[unit.id] = (attackTimers[unit.id] || 0) + delta;
    const rate = unit.attackRate;
    if (attackTimers[unit.id] >= rate) {
      attackTimers[unit.id] = 0;
      attackWithUnit(unit);
    }
    soonest = Math.min(soonest, rate - attackTimers[unit.id]);
  });
  nextAttackHint = soonest;
}

function gameLoop(now) {
  const delta = Math.min(0.2, (now - lastTick) / 1000);
  lastTick = now;
  state.elapsed += delta;
  saveCooldown += delta;

  moveEnemy(delta);
  updateAttacks(delta);

  if (saveCooldown >= 10) {
    saveCooldown = 0;
    saveState("자동 저장 완료");
  }

  render();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  const recruitButton = event.target.closest("[data-buy-recruit]");
  const toolButton = event.target.closest("[data-buy-tool]");

  if (tab) {
    document.querySelectorAll(".tab-button").forEach((button) => button.classList.toggle("is-active", button === tab));
    document
      .querySelectorAll(".tab-panel")
      .forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tab.dataset.tab));
  }

  if (recruitButton) buyRecruit(recruitButton.dataset.buyRecruit);
  if (toolButton) buyTool(toolButton.dataset.buyTool);
});

$("#manualWorkButton").addEventListener("click", () => {
  attackWithUnit({
    id: "player",
    color: "#059669",
    attackType: "code",
    power: state.clickPower,
  }, true);
});
$("#upgradePlayerButton").addEventListener("click", upgradePlayer);
$("#nextStageButton").addEventListener("click", nextStage);
$("#saveButton").addEventListener("click", () => saveState("수동 저장 완료"));
$("#resetButton").addEventListener("click", () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    saveStateText.textContent = "저장소 접근 불가";
  }
  state = cloneDefaultState();
  lastRosterKey = "";
  spawnEnemy();
  saveState("초기화 완료");
  render();
});

if (state.enemyHp <= 0 || !state.enemyMaxHp) {
  spawnEnemy();
}

if (!state.enemyX) {
  state.enemyX = ENEMY_SPAWN_X;
}

render();
requestAnimationFrame(gameLoop);
