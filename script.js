const STORAGE_KEY = "studioCrewRpgSave";

const recruits = [
  { id: "planner", name: "기획자", desc: "요구사항을 정리해 자동 기여도를 올립니다.", baseCost: 25, dps: 1 },
  { id: "developer", name: "개발자", desc: "핵심 기능을 빠르게 구현합니다.", baseCost: 55, dps: 3 },
  { id: "artist", name: "일러스트레이터", desc: "아트 리소스로 프로젝트 완성도를 높입니다.", baseCost: 90, dps: 5 },
  { id: "qa", name: "QA", desc: "버그를 발견해 적 체력을 꾸준히 깎습니다.", baseCost: 140, dps: 8 },
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
  clickPower: 1,
  playerLevel: 1,
  clearCount: 0,
  elapsed: 0,
  recruits: {},
  tools: {},
};

let state = loadState();
let attackCooldown = 0;
let saveCooldown = 0;
let lastTick = performance.now();

const $ = (selector) => document.querySelector(selector);
const goldText = $("#goldText");
const ideaText = $("#ideaText");
const stageText = $("#stageText");
const companyName = $("#companyName");
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

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState(message = "저장 완료") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveStateText.textContent = message;
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

function getTotalDps() {
  const recruitDps = recruits.reduce((sum, recruit) => {
    const count = getRecruitCount(recruit.id);
    const toolBonus = tools
      .filter((tool) => tool.target === recruit.id)
      .reduce((bonus, tool) => bonus + getToolLevel(tool.id) * tool.dps, 0);
    return sum + count * (recruit.dps + toolBonus);
  }, 0);
  const multiplier = tools.reduce((sum, tool) => sum + (tool.multiplier || 0) * getToolLevel(tool.id), 1);
  return Math.max(1, Math.round((state.playerLevel + recruitDps) * multiplier));
}

function getTeamCount() {
  return 1 + recruits.reduce((sum, recruit) => sum + getRecruitCount(recruit.id), 0);
}

function getEnemyName() {
  return enemyNames[Math.min(enemyNames.length - 1, Math.floor((state.stage - 1) / 4))];
}

function spawnEnemy() {
  const hp = Math.floor(8 + state.stage * 8 + Math.pow(state.stage, 1.45) * 5);
  state.enemyMaxHp = hp;
  state.enemyHp = hp;
  enemy.classList.remove("is-defeated");
  log(`${getEnemyName()} 업무가 들어왔습니다.`);
}

function damageEnemy(amount, source) {
  state.enemyHp = Math.max(0, state.enemyHp - amount);
  enemy.classList.add("is-hit");
  window.setTimeout(() => enemy.classList.remove("is-hit"), 120);

  if (state.enemyHp <= 0) {
    completeEnemy(source);
  } else if (source === "manual") {
    log(`직접 처리로 ${amount} 기여도를 넣었습니다.`);
  }

  render();
}

function completeEnemy(source) {
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
  }, 450);
}

function buyRecruit(id) {
  const recruit = recruits.find((item) => item.id === id);
  const count = getRecruitCount(id);
  const cost = costFor(recruit.baseCost, count);
  if (state.gold < cost) return;

  state.gold -= cost;
  state.recruits[id] = count + 1;
  log(`${recruit.name} 영입 완료`);
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

  goldText.textContent = Math.floor(state.gold);
  ideaText.textContent = Math.floor(state.idea);
  stageText.textContent = state.stage;
  companyName.textContent = state.stage > 10 ? "성장형 게임 스튜디오" : "1인 개발사";
  dpsText.textContent = `초당 기여도 ${getTotalDps()}`;
  enemyName.textContent = getEnemyName();
  enemyHpBar.style.width = `${hpPercent}%`;
  enemyHpText.textContent = `${Math.ceil(state.enemyHp)} / ${state.enemyMaxHp}`;
  teamCountText.textContent = `${getTeamCount()}명`;
  clickPowerText.textContent = state.clickPower;
  clearCountText.textContent = `${state.clearCount}건`;
  playTimeText.textContent = formatTime(state.elapsed);
  attackTimerText.textContent = `${Math.max(0, 1 - attackCooldown).toFixed(1)}초`;
  $("#upgradePlayerButton").textContent = `대표 역량 강화 (${playerCost} 자금)`;
  $("#upgradePlayerButton").disabled = state.gold < playerCost;
  renderShop();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function gameLoop(now) {
  const delta = Math.min(0.2, (now - lastTick) / 1000);
  lastTick = now;
  state.elapsed += delta;
  attackCooldown += delta;
  saveCooldown += delta;

  if (attackCooldown >= 1) {
    attackCooldown = 0;
    damageEnemy(getTotalDps(), "auto");
  }

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

$("#manualWorkButton").addEventListener("click", () => damageEnemy(state.clickPower, "manual"));
$("#upgradePlayerButton").addEventListener("click", upgradePlayer);
$("#nextStageButton").addEventListener("click", nextStage);
$("#saveButton").addEventListener("click", () => saveState("수동 저장 완료"));
$("#resetButton").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  spawnEnemy();
  saveState("초기화 완료");
  render();
});

if (state.enemyHp <= 0 || !state.enemyMaxHp) {
  spawnEnemy();
}

render();
requestAnimationFrame(gameLoop);
