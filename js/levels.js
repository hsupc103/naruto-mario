/**
 * Level & Enemy Architecture for NARUTO × MARIO
 * Engineered from REA Reverse-Engineering of HTML5 Mario tile/sprite systems.
 *
 * Design Rule from User Specification:
 * - 3 Distinct Stages, each ending with a powerful Boss.
 * - Normal traversal before reaching the Boss Arena takes ~2 minutes (~120s),
 *   so each stage spans 12,400 px (Boss Gate at x = 11,200 px) across 4 rich tactical zones,
 *   with tiered enemies requiring 1 to 5 Rasengan Light Spheres depending on strength,
 *   plus abundant Chakra Mushroom blocks and Nine-Tails Invincibility Star shrines.
 */

const ENEMY_ARCHETYPES = {
  genin: {
    id: "genin",
    name: "音忍下忍斥候",
    tier: 1,
    maxHp: 1, // 1 Rasengan hit
    speed: 95,
    width: 42,
    height: 52,
    score: 150,
    colorPrimary: "#4cc9f0",
    colorSecondary: "#2b2d42",
    behavior: "patrol"
  },
  chunin: {
    id: "chunin",
    name: "咒印中忍傀儡兵",
    tier: 2,
    maxHp: 2, // 2 Rasengan hits
    speed: 120,
    width: 46,
    height: 58,
    score: 320,
    colorPrimary: "#f72585",
    colorSecondary: "#3a0ca3",
    behavior: "hopper"
  },
  jonin: {
    id: "jonin",
    name: "暗部上忍菁英",
    tier: 3,
    maxHp: 3, // 3 Rasengan hits
    speed: 138,
    width: 50,
    height: 64,
    score: 600,
    colorPrimary: "#ff9f1c",
    colorSecondary: "#1b263b",
    behavior: "shooter"
  },
  summon_heavy: {
    id: "summon_heavy",
    name: "重甲通靈巨蟒守衛",
    tier: 4,
    maxHp: 5, // 5 Rasengan hits (Heavy Elite)
    speed: 78,
    width: 64,
    height: 76,
    score: 1100,
    colorPrimary: "#80ed99",
    colorSecondary: "#22577a",
    behavior: "charger"
  }
};

const STAGE_DEFS = [
  {
    id: 1,
    title: "STAGE 1：木葉森林與終末之谷",
    subtitle: "KONOHA FOREST & VALLEY OF THE END",
    targetSecondsToBoss: 120,
    lengthPx: 12400,
    bossGateX: 11180,
    bossArenaStartX: 11260,
    bossArenaEndX: 12280,
    groundY: 560,
    theme: {
      skyTop: "#0a1931",
      skyMid: "#183a5a",
      skyBottom: "#2b5876",
      mountainFar: "#162a45",
      mountainNear: "#1f4060",
      foliageColor: "#2d6a4f",
      groundTop: "#52b788",
      groundSoil: "#3b2d26",
      accentGlow: "#4cc9f0",
      weatherType: "leaves"
    },
    boss: {
      id: "zabuza",
      name: "桃地再不斬・霧隱鬼人",
      title: "斬首大刀 × 水遁・大瀑布之術",
      maxHp: 300,
      rasenganDamage: 15,      // 20 Rasengans to defeat
      bijuudamaDamage: 125,    // 3 Tailed Beast Bombs (125 * 3 = 375 >= 300) to defeat!
      width: 78,
      height: 92,
      primaryColor: "#00b4d8",
      auraColor: "#90e0ef",
      attackInterval: 2.2
    }
  },
  {
    id: 2,
    title: "STAGE 2：大蛇丸紅月音忍要塞",
    subtitle: "OROCHIMARU'S CRIMSON MOON FORTRESS",
    targetSecondsToBoss: 120,
    lengthPx: 12400,
    bossGateX: 11180,
    bossArenaStartX: 11260,
    bossArenaEndX: 12280,
    groundY: 560,
    theme: {
      skyTop: "#14051e",
      skyMid: "#360c42",
      skyBottom: "#5e1752",
      mountainFar: "#240a34",
      mountainNear: "#3c1354",
      foliageColor: "#6a1b4d",
      groundTop: "#9d4edd",
      groundSoil: "#241332",
      accentGlow: "#f72585",
      weatherType: "embers"
    },
    boss: {
      id: "orochimaru",
      name: "大蛇丸・八岐大蛇真身",
      title: "草薙劍影 × 萬蛇羅之陣",
      maxHp: 420,
      rasenganDamage: 16,      // ~27 Rasengans to defeat
      bijuudamaDamage: 175,    // 3 Tailed Beast Bombs (175 * 3 = 525 >= 420, 2 hits = 350) to defeat!
      width: 86,
      height: 98,
      primaryColor: "#b5179e",
      auraColor: "#f72585",
      attackInterval: 1.9
    }
  },
  {
    id: 3,
    title: "STAGE 3：曉之雷雲・雨隱神域決戰",
    subtitle: "AKATSUKI STORM CITADEL — AMEGAKURE",
    targetSecondsToBoss: 120,
    lengthPx: 12400,
    bossGateX: 11180,
    bossArenaStartX: 11260,
    bossArenaEndX: 12280,
    groundY: 560,
    theme: {
      skyTop: "#050716",
      skyMid: "#131836",
      skyBottom: "#291b47",
      mountainFar: "#10162f",
      mountainNear: "#1d2549",
      foliageColor: "#3a0ca3",
      groundTop: "#ff9e00",
      groundSoil: "#16182e",
      accentGlow: "#ffd166",
      weatherType: "rain_lightning"
    },
    boss: {
      id: "pain",
      name: "佩恩天道・六道神羅天徵",
      title: "輪迴眼引力 × 地爆天星",
      maxHp: 560,
      rasenganDamage: 18,      // ~32 Rasengans to defeat
      bijuudamaDamage: 230,    // 3 Tailed Beast Bombs (230 * 3 = 690 >= 560, 2 hits = 460) to defeat!
      width: 82,
      height: 96,
      primaryColor: "#ff5400",
      auraColor: "#ffd166",
      attackInterval: 1.65
    }
  }
];

/**
 * Deterministic Pseudo-Random Generator for reproducible level layout
 */
function createSeededRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Builds a complete playable stage with:
 * - Solid ground segments & ninja abyssal gaps (with safe bridges/platforms)
 * - Question blocks (`mushroom`, `star`, `coin`)
 * - Brick/seal blocks & elevated ninja roofs
 * - Moving chakra platforms
 * - Tiered enemy waves calibrated for a ~2-minute run before the Boss Arena
 */
function buildStageWorld(stageIndex) {
  const def = STAGE_DEFS[stageIndex % STAGE_DEFS.length];
  const rng = createSeededRng((stageIndex + 1) * 98765);
  const groundY = def.groundY;

  const platforms = [];
  const blocks = [];
  const enemies = [];
  const coins = [];
  const decorations = [];
  const pits = [];

  // Create pit locations along the 11,180px pre-boss route (avoid start, checkpoints, and boss arena)
  const candidatePitXs = [
    1350, 2150, 3100, 3950, 4850, 6050, 6950, 7850, 8750, 9650, 10350
  ];
  for (const px of candidatePitXs) {
    const pitWidth = 110 + Math.floor(rng() * 35);
    pits.push({ x1: px, x2: px + pitWidth });
    // Add a moving or high ninja bridge above every pit so it's thrilling and fair
    platforms.push({
      x: px - 10,
      y: groundY - 95,
      w: pitWidth + 20,
      h: 18,
      kind: "moving",
      baseX: px - 10,
      baseY: groundY - 95,
      moveRangeX: 35,
      moveRangeY: 0,
      speed: 1.8
    });
  }

  // Generate ground segments around pits
  let cursorX = 0;
  for (const pit of pits) {
    if (pit.x1 > cursorX) {
      platforms.push({
        x: cursorX,
        y: groundY,
        w: pit.x1 - cursorX,
        h: 120,
        kind: "ground"
      });
    }
    cursorX = pit.x2;
  }
  platforms.push({
    x: cursorX,
    y: groundY,
    w: def.lengthPx - cursorX + 400,
    h: 120,
    kind: "ground"
  });

  // Guarantee early Mushroom block & Invincibility Star block right near the start so the player
  // immediately experiences Mushroom -> Rasengan and Star -> Nine-Tails Bijuudama!
  blocks.push(
    { id: "b_start_mush", x: 340, y: groundY - 125, w: 42, h: 42, kind: "question", content: "mushroom", hit: false },
    { id: "b_start_coin1", x: 386, y: groundY - 125, w: 42, h: 42, kind: "brick", content: "coin", hit: false },
    { id: "b_start_star", x: 432, y: groundY - 125, w: 42, h: 42, kind: "star_block", content: "star", hit: false },
    { id: "b_start_mush2", x: 680, y: groundY - 135, w: 42, h: 42, kind: "question", content: "mushroom", hit: false }
  );

  // Build 26 tactical ninja structures across the 4 zones (x = 520 to 10,950)
  for (let section = 0; section < 26; section++) {
    const baseX = 560 + section * 405;
    const zoneIndex = Math.min(3, Math.floor(section / 6.5)); // 0, 1, 2, 3

    // Elevated ninja pagoda platform
    const platY = groundY - (105 + (section % 3) * 42);
    const platW = 150 + (section % 2) * 70;
    platforms.push({
      x: baseX,
      y: platY,
      w: platW,
      h: 22,
      kind: section % 4 === 2 ? "moving" : "pagoda",
      baseX: baseX,
      baseY: platY,
      moveRangeX: section % 4 === 2 ? 55 : 0,
      moveRangeY: 0,
      speed: 1.5 + (section % 3) * 0.4
    });

    // Upper tier aerial platform for verticality
    if (section % 2 === 0) {
      platforms.push({
        x: baseX + 110,
        y: platY - 105,
        w: 130,
        h: 20,
        kind: "pagoda"
      });
    }

    // Question & Star blocks in each section
    const blockY = platY - 115;
    if (section % 3 === 0) {
      blocks.push({
        id: `b_mush_${section}`,
        x: baseX + 25,
        y: blockY,
        w: 42,
        h: 42,
        kind: "question",
        content: "mushroom",
        hit: false
      });
    }
    if (section % 4 === 1 || section === 24 || section === 25) {
      // Star Shrine Blocks (gives Nine-Tails + 3 Tailed Beast Bombs)
      blocks.push({
        id: `b_star_${section}`,
        x: baseX + 75,
        y: blockY,
        w: 42,
        h: 42,
        kind: "star_block",
        content: "star",
        hit: false
      });
    } else {
      blocks.push({
        id: `b_coin_${section}`,
        x: baseX + 75,
        y: blockY,
        w: 42,
        h: 42,
        kind: "question",
        content: "coin",
        hit: false
      });
    }

    // Add Ryo Coin arcs
    for (let c = 0; c < 4; c++) {
      coins.push({
        x: baseX + 20 + c * 34,
        y: platY - 36 - Math.sin((c / 3) * Math.PI) * 28,
        r: 11,
        collected: false
      });
    }

    // Spawn Enemies scaled by Zone & Stage difficulty
    // Early enemies: Genin (1 hit) + Chunin (2 hits)
    // Mid/Late enemies: Chunin (2 hits) + Jonin (3 hits) + Summon Heavy (5 hits)
    const enemySquad = [];
    if (zoneIndex === 0) {
      enemySquad.push({ type: "genin", offsetX: -40, onPlatform: false });
      enemySquad.push({ type: section % 2 === 0 ? "chunin" : "genin", offsetX: 55, onPlatform: true });
    } else if (zoneIndex === 1) {
      enemySquad.push({ type: "genin", offsetX: -50, onPlatform: false });
      enemySquad.push({ type: "chunin", offsetX: 35, onPlatform: true });
      if (section % 2 === 1) {
        enemySquad.push({ type: "jonin", offsetX: 145, onPlatform: false });
      }
    } else if (zoneIndex === 2) {
      enemySquad.push({ type: "chunin", offsetX: -30, onPlatform: false });
      enemySquad.push({ type: "jonin", offsetX: 45, onPlatform: true });
      if (section % 2 === 0) {
        enemySquad.push({ type: "summon_heavy", offsetX: 170, onPlatform: false });
      }
    } else {
      // Zone 4 Fortress Gauntlet before Boss
      enemySquad.push({ type: "chunin", offsetX: -45, onPlatform: false });
      enemySquad.push({ type: "jonin", offsetX: 35, onPlatform: true });
      enemySquad.push({ type: "summon_heavy", offsetX: 155, onPlatform: false });
    }

    enemySquad.forEach((spec, idx) => {
      const arch = ENEMY_ARCHETYPES[spec.type];
      const spawnX = Math.max(460, Math.min(def.bossGateX - 180, baseX + spec.offsetX));
      // Avoid spawning directly over a pit
      const overPit = pits.some((p) => spawnX > p.x1 - 30 && spawnX < p.x2 + 30);
      const finalX = overPit ? baseX + 30 : spawnX;
      const finalY = spec.onPlatform ? platY - arch.height : groundY - arch.height;

      // Scale enemy HP slightly in Stage 2 & 3 for elites while keeping Tier 1 at 1 shot
      const stageBonusHp = arch.tier >= 3 ? stageIndex : 0;
      const totalHp = arch.maxHp + stageBonusHp;

      enemies.push({
        id: `enemy_${stageIndex}_${section}_${idx}`,
        type: arch.id,
        name: arch.name,
        tier: arch.tier,
        x: finalX,
        y: finalY,
        vx: -arch.speed,
        vy: 0,
        w: arch.width,
        h: arch.height,
        hp: totalHp,
        maxHp: totalHp,
        speed: arch.speed,
        score: arch.score,
        colorPrimary: arch.colorPrimary,
        colorSecondary: arch.colorSecondary,
        behavior: arch.behavior,
        facing: -1,
        onGround: true,
        patrolMinX: finalX - 140,
        patrolMaxX: finalX + 160,
        attackCooldown: 1.5 + (idx % 3) * 0.7,
        hurtFlash: 0,
        dead: false,
        deathTimer: 0
      });
    });

    // Decorative Torii Gates, Ninja Scrolls, Stone Lanterns
    decorations.push({
      x: baseX - 80,
      y: groundY,
      kind: section % 3 === 0 ? "torii" : section % 3 === 1 ? "lantern" : "banner",
      zoneIndex
    });
  }

  // Pre-Boss Supply Shrine at x = 11,020 (Right before the Boss Gate so player can stock up on Mushroom & Star!)
  blocks.push(
    { id: "b_boss_mush", x: 10960, y: groundY - 130, w: 44, h: 44, kind: "question", content: "mushroom", hit: false },
    { id: "b_boss_star1", x: 11020, y: groundY - 130, w: 44, h: 44, kind: "star_block", content: "star", hit: false },
    { id: "b_boss_star2", x: 11080, y: groundY - 130, w: 44, h: 44, kind: "star_block", content: "star", hit: false }
  );

  // Boss Arena tactical platforms (inside x = 11,260 .. 12,280) + Resupply Star blocks in Boss Arena
  platforms.push(
    { x: 11420, y: groundY - 125, w: 145, h: 20, kind: "pagoda" },
    { x: 11710, y: groundY - 190, w: 150, h: 20, kind: "pagoda" },
    { x: 11990, y: groundY - 125, w: 145, h: 20, kind: "pagoda" }
  );
  blocks.push(
    { id: "b_arena_star_left", x: 11470, y: groundY - 245, w: 44, h: 44, kind: "star_block", content: "star", hit: false },
    { id: "b_arena_mush_mid", x: 11765, y: groundY - 305, w: 44, h: 44, kind: "question", content: "mushroom", hit: false },
    { id: "b_arena_star_right", x: 12040, y: groundY - 245, w: 44, h: 44, kind: "star_block", content: "star", hit: false }
  );

  return {
    def,
    platforms,
    blocks,
    enemies,
    coins,
    decorations,
    pits
  };
}

window.NarutoMarioLevels = {
  ENEMY_ARCHETYPES,
  STAGE_DEFS,
  buildStageWorld
};
