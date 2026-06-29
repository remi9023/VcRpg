const STORAGE_KEY = "studioCrewRpgSave";
const ENEMY_SPAWN_X = 86;
const ENEMY_CONTACT_X = 38;
const BASIC_ATTACK_RATE = 1;
const SKILL_ATTACK_RATE = 4;
const TICK_RATE = 1000 / 30;

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

let state;
let refs;
let isSpawningNext = false;
let lastRosterKey = "";
let basicAttackCooldown = 0.35;
let skillAttackCooldown = SKILL_ATTACK_RATE;
let saveCooldown = 0;
let lastTick = Date.now();
let gameTimer = null;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGame);
} else {
  initGame();
}

function initGame() {
  refs = {
    allyLayer: document.querySelector("#allyLayer"),
    effectLayer: document.querySelector("#effectLayer"),
    goldText: document.querySelector("#goldText"),
    ideaText: document.querySelector("#ideaText"),
    stageText: document.querySelector("#stageText"),
    dpsText: document.querySelector("#dpsText"),
    enemy: document.querySelector("#enemy"),
    enemyName: document.querySelector("#enemyName"),
    enemyHpBar: document.querySelector("#enemyHpBar"),
    enemyHpText: document.querySelector("#enemyHpText"),
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
  };

  state = loadState();
  if (state.enemyHp <= 0 || state.enemyX <= ENEMY_CONTACT_X || !state.enemyMaxHp) {
    spawnEnemy();
  }

  bindEvents();
  renderAll();
  startLoop();
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
    state.stage += 1;
    spawnEnemy();
    renderAll();
  });
  refs.saveButton.addEventListener("click", () => saveState("수동 저장 완료"));
  refs.resetButton.addEventListener("click", resetGame);
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

function tick(delta) {
  try {
    state.elapsed += delta;
    saveCooldown += delta;

    moveEnemy(delta);
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
  spawnEnemy();
  renderAll();
  saveState("초기화 완료");
}

function spawnEnemy() {
  const hp = Math.floor(8 + state.stage * 8 + Math.pow(state.stage, 1.45) * 5);
  state.enemyMaxHp = hp;
  state.enemyHp = hp;
  state.enemyX = ENEMY_SPAWN_X;
  isSpawningNext = false;
  basicAttackCooldown = 0.35;
  skillAttackCooldown = SKILL_ATTACK_RATE;
  if (refs && refs.enemy) refs.enemy.classList.remove("is-defeated");
  log(`${getEnemyName()} 업무가 오른쪽에서 접근합니다.`);
}

function moveEnemy(delta) {
  if (isSpawningNext || state.enemyHp <= 0) return;

  const speed = Math.min(5.4, 2.5 + state.stage * 0.08);
  state.enemyX = Math.max(ENEMY_CONTACT_X, state.enemyX - speed * delta);

  if (state.enemyX <= ENEMY_CONTACT_X) {
    state.enemyX = ENEMY_SPAWN_X;
    state.enemyHp = Math.min(state.enemyMaxHp, state.enemyHp + Math.ceil(state.enemyMaxHp * 0.12));
    log("업무가 팀 앞까지 밀려와 일정 압박이 커졌습니다.");
  }
}

function updateAutoCombat(delta) {
  if (isSpawningNext || state.enemyHp <= 0) return;

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
  if (isSpawningNext || state.enemyHp <= 0) return;

  const skill = Boolean(options.skill);
  const manual = Boolean(options.manual);
  const from = getUnitPosition(unit.id);
  const damage = skill ? Math.ceil(unit.power * 2.8 + state.playerLevel) : unit.power;

  if (unit.attackType === "slash") {
    playSlash(unit, skill);
    window.setTimeout(() => damageEnemy(damage, manual), 140);
  } else {
    playProjectile(unit, from, skill);
    window.setTimeout(() => damageEnemy(damage, manual), 240);
  }
}

function playProjectile(unit, from, skill) {
  const shot = document.createElement("span");
  shot.className = `projectile is-${unit.attackType}${skill ? " is-skill" : ""}`;
  shot.style.setProperty("--from-x", `${from.x}%`);
  shot.style.setProperty("--from-y", `${from.y}px`);
  shot.style.setProperty("--to-x", `${state.enemyX}%`);
  shot.style.setProperty("--shot-color", unit.color);
  refs.effectLayer.appendChild(shot);
  pulseUnit(unit.id, "is-attacking", 320);
  window.setTimeout(() => shot.remove(), 480);
}

function playSlash(unit, skill) {
  const ally = refs.allyLayer.querySelector(`[data-unit-id="${unit.id}"]`);
  if (ally) {
    ally.style.setProperty("--slash-x", `${Math.max(36, state.enemyX - 9)}%`);
    ally.classList.add("is-slashing");
    window.setTimeout(() => ally.classList.remove("is-slashing"), 300);
  }

  const slash = document.createElement("span");
  slash.className = `slash-effect${skill ? " is-skill" : ""}`;
  slash.style.setProperty("--hit-x", `${state.enemyX}%`);
  refs.effectLayer.appendChild(slash);
  window.setTimeout(() => slash.remove(), 360);
}

function damageEnemy(amount, manual) {
  if (isSpawningNext || state.enemyHp <= 0) return;

  const finalAmount = Math.max(1, Math.round(amount * getGlobalMultiplier()));
  state.enemyHp = Math.max(0, state.enemyHp - finalAmount);
  showDamage(finalAmount);
  refs.enemy.classList.add("is-hit");
  window.setTimeout(() => refs.enemy.classList.remove("is-hit"), 120);

  if (state.enemyHp <= 0) {
    completeEnemy(manual);
  } else if (manual) {
    log(`직접 처리로 ${finalAmount} 기여도를 넣었습니다.`);
  }
}

function completeEnemy(manual) {
  if (isSpawningNext) return;

  isSpawningNext = true;
  const goldGain = Math.floor(6 + state.stage * 4);
  const ideaGain = manual ? 2 : 1;
  state.gold += goldGain;
  state.idea += ideaGain;
  state.clearCount += 1;
  refs.enemy.classList.add("is-defeated");
  log(`업무 완료! 자금 +${goldGain}, 아이디어 +${ideaGain}`);

  window.setTimeout(() => {
    state.stage += 1;
    spawnEnemy();
    renderAll();
  }, 520);
}

function showDamage(amount) {
  const damage = document.createElement("span");
  damage.className = "damage-number";
  damage.textContent = `-${amount}`;
  damage.style.setProperty("--hit-x", `${state.enemyX}%`);
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
    sprite: "assets/player.svg",
    count: 1,
    power,
    attackType: "code",
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
  return {
    x: 14 + index * 7,
    y: 42 + (index % 2) * 66,
  };
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
  return enemyNames[Math.min(enemyNames.length - 1, Math.floor((state.stage - 1) / 4))];
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
  renderBattle();
}

function renderBattle() {
  const hpPercent = Math.max(0, Math.round((state.enemyHp / state.enemyMaxHp) * 100));
  const playerCost = Math.floor(18 * Math.pow(1.4, state.playerLevel - 1));

  refs.goldText.textContent = Math.floor(state.gold);
  refs.ideaText.textContent = Math.floor(state.idea);
  refs.stageText.textContent = state.stage;
  setText(refs.dpsText, `초당 기여도 ${getTotalDps()}`);
  setText(refs.enemyName, getEnemyName());
  refs.enemy.style.setProperty("--enemy-x", `${state.enemyX}%`);
  refs.enemyHpBar.style.width = `${hpPercent}%`;
  setText(refs.enemyHpText, `${Math.ceil(state.enemyHp)} / ${state.enemyMaxHp}`);
  setText(refs.teamCountText, `${getTeamCount()}명`);
  setText(refs.clickPowerText, state.clickPower);
  setText(refs.clearCountText, `${state.clearCount}건`);
  setText(refs.playTimeText, formatTime(state.elapsed));
  setText(refs.attackTimerText, `${Math.max(0, Math.min(basicAttackCooldown, skillAttackCooldown)).toFixed(1)}초`);
  refs.upgradePlayerButton.textContent = `대표 역량 강화 (${playerCost} 자금)`;
  refs.upgradePlayerButton.disabled = state.gold < playerCost;
}

function renderAllies() {
  const units = getUnits();
  const rosterKey = units.map((unit) => `${unit.id}:${unit.count}:${unit.power}`).join("|");
  if (rosterKey === lastRosterKey) return;

  lastRosterKey = rosterKey;
  refs.allyLayer.innerHTML = units
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
