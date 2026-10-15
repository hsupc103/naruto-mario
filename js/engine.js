/**
 * Core Physics, Combat & Stage Engine for NARUTO × MARIO
 * Derived from REA Reverse-Engineering of HTML5 Mario (`character.js`, `fireball.js`, `enemy.js`)
 * and upgraded with Q-Naruto Chakra Physics:
 * - Mushroom -> Straight-flying Rasengan Light Spheres (1..5+ hits based on enemy strength)
 * - Invincibility Star -> Nine-Tails Kurama Transformation + 3 Tailed Beast Bombs (3.0s charge,
 *   wipes all on-screen enemies, requires 2-3 hits to defeat Stage Bosses)
 * - 3 Complete Stages calibrated for ~2 minutes of gameplay before the Boss Arena.
 */
class NarutoMarioEngine {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.avatarCanvas = document.getElementById("hudAvatarCanvas");
    this.renderer = new window.NarutoMarioRenderer(this.canvas, this.avatarCanvas);

    // Input state
    this.keys = {
      left: false,
      right: false,
      jump: false,
      shoot: false,
      charge: false
    };
    this.jumpPressedJustNow = false;
    this.shootPressedJustNow = false;

    // Physics constants (derived & scaled from REA Mario character.js analysis)
    this.GRAVITY = 1580;
    this.MAX_FALL_SPEED = 780;
    this.MOVE_ACCEL = 1950;
    this.MAX_MOVE_SPEED = 265;
    this.KURAMA_MOVE_SPEED = 325;
    this.GROUND_FRICTION = 0.84;
    this.AIR_FRICTION = 0.93;
    this.JUMP_VELOCITY = -655;
    this.DOUBLE_JUMP_VELOCITY = -580;
    this.BIJUUDAMA_CHARGE_SECONDS = 3.0; // Strictly 3.0 seconds charge!
    this.BIJUUDAMA_MAX_ORBS = 3;         // Strictly 3 Tailed Beast Bombs per Star!

    this.stageIndex = 0;
    this.score = 0;
    this.coinsCount = 0;
    this.combo = 0;
    this.lives = 3;

    this.syncViewportOrientation();
    this.initStage(0);
    this.bindEvents();
    this.lastTimestamp = performance.now();
    this.chargeSoundAccum = 0;

    // Expose telemetry for REA static & browser runtime verification
    window.__NARUTO_MARIO_GAME__ = this;
    this.syncTelemetry();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  syncViewportOrientation() {
    if (!this.canvas) return;
    const isPortraitMobile = window.innerHeight > window.innerWidth && window.innerWidth <= 920;
    const targetW = isPortraitMobile ? 820 : 1280;
    const targetH = 660;
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
    document.body.dataset.orientation = isPortraitMobile ? "portrait" : "landscape";
  }

  initStage(stageIdx) {
    this.stageIndex = ((stageIdx % 3) + 3) % 3;
    this.world = window.NarutoMarioLevels.buildStageWorld(this.stageIndex);
    const def = this.world.def;

    if (window.NinjaAudio) {
      window.NinjaAudio.currentStage = this.stageIndex;
      window.NinjaAudio.isBossFight = false;
    }

    const preserveRasengan = this.player ? this.player.hasRasengan : false;
    const preserveKurama = this.player ? this.player.kuramaTimer : 0;
    const preserveOrbs = this.player ? this.player.bijuudamaCount : 0;

    this.player = {
      x: 120,
      y: def.groundY - 66,
      vx: 0,
      vy: 0,
      w: 44,
      h: 66,
      hp: 100,
      maxHp: 100,
      lastCheckpointX: 120,
      facing: 1,
      onGround: false,
      jumpsRemaining: 2,
      coyoteTimer: 0,
      hasRasengan: preserveRasengan,
      kuramaTimer: preserveKurama,
      bijuudamaCount: preserveOrbs,
      isChargingBijuudama: false,
      chargeTime: 0,
      shootCooldown: 0,
      invulnTimer: 0
    };

    this.camera = {
      x: 0,
      lockedInArena: false,
      shake: 0
    };

    this.stageElapsedSec = 0;
    this.bijuudamaFlash = 0;
    this.items = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.particles = [];
    this.floatingTexts = [];

    // Initialize Boss at end of the 2-minute stage
    const bDef = def.boss;
    this.boss = {
      ...bDef,
      w: bDef.width,
      h: bDef.height,
      x: def.bossArenaEndX - 220,
      y: def.groundY - bDef.height,
      vx: -115,
      vy: 0,
      hp: bDef.maxHp,
      facing: -1,
      active: false,
      defeated: false,
      attackTimer: bDef.attackInterval,
      phase: 1,
      hurtFlash: 0,
      bijuudamaHitsTaken: 0,
      rasenganHitsTaken: 0
    };

    this.showBanner(
      `STAGE ${def.id} START`,
      def.title,
      `過關路程約 2 分鐘 ｜ 吃香菇發射「螺旋丸光彈」・吃無敵星星變身「九尾鳴人」集氣 3 秒發射「尾獸彈 (限3顆)」！`,
      3.6
    );
    this.updateHud();
    this.syncTelemetry();
  }

  bindEvents() {
    const refocusCanvas = (ev) => {
      if (ev && ev.currentTarget && typeof ev.currentTarget.blur === "function") {
        ev.currentTarget.blur();
      }
      if (this.canvas && typeof this.canvas.focus === "function") {
        this.canvas.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", (e) => {
      if (window.NinjaAudio) window.NinjaAudio.ensureContext();
      const code = e.code || "";
      const key = (e.key || "").toLowerCase();
      const kc = e.keyCode || 0;

      const isLeft = code === "ArrowLeft" || code === "KeyA" || key === "a" || key === "arrowleft" || kc === 37 || kc === 65;
      const isRight = code === "ArrowRight" || code === "KeyD" || key === "d" || key === "arrowright" || kc === 39 || kc === 68;
      const isJump = code === "ArrowUp" || code === "KeyW" || code === "Space" || key === "w" || key === " " || key === "arrowup" || kc === 38 || kc === 87 || kc === 32;
      const isShoot = code === "KeyJ" || code === "KeyZ" || code === "Enter" || key === "j" || key === "z" || kc === 74 || kc === 90 || kc === 13;
      const isCharge =
        code === "KeyK" ||
        code === "KeyX" ||
        code === "KeyB" ||
        code === "ShiftLeft" ||
        code === "ShiftRight" ||
        key === "k" ||
        key === "x" ||
        key === "b" ||
        kc === 75 ||
        kc === 88 ||
        kc === 66 ||
        kc === 16;

      if (isLeft || isRight || isJump || isShoot || isCharge) {
        e.preventDefault();
      }

      if (isLeft) this.keys.left = true;
      if (isRight) this.keys.right = true;
      if (isJump) {
        if (!this.keys.jump) this.jumpPressedJustNow = true;
        this.keys.jump = true;
      }
      if (isShoot) {
        if (!this.keys.shoot) this.shootPressedJustNow = true;
        this.keys.shoot = true;
      }
      if (isCharge) {
        this.keys.charge = true;
        this.triggerBijuudamaCharge(false);
      }
    });

    window.addEventListener("keyup", (e) => {
      const code = e.code || "";
      const key = (e.key || "").toLowerCase();
      const kc = e.keyCode || 0;

      if (code === "ArrowLeft" || code === "KeyA" || key === "a" || key === "arrowleft" || kc === 37 || kc === 65) {
        this.keys.left = false;
      }
      if (code === "ArrowRight" || code === "KeyD" || key === "d" || key === "arrowright" || kc === 39 || kc === 68) {
        this.keys.right = false;
      }
      if (code === "ArrowUp" || code === "KeyW" || code === "Space" || key === "w" || key === " " || key === "arrowup" || kc === 38 || kc === 87 || kc === 32) {
        this.keys.jump = false;
      }
      if (code === "KeyJ" || code === "KeyZ" || code === "Enter" || key === "j" || key === "z" || kc === 74 || kc === 90 || kc === 13) {
        this.keys.shoot = false;
        this.shootHoldDuration = 0;
      }
      if (
        code === "KeyK" ||
        code === "KeyX" ||
        code === "KeyB" ||
        code === "ShiftLeft" ||
        code === "ShiftRight" ||
        key === "k" ||
        key === "x" ||
        key === "b" ||
        kc === 75 ||
        kc === 88 ||
        kc === 66 ||
        kc === 16
      ) {
        this.keys.charge = false;
      }
    });

    // Quick Action / Testing Toolbar Buttons
    document.getElementById("btnGiveMushroom")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      if (window.NinjaAudio) window.NinjaAudio.ensureContext();
      this.eatMushroom();
    });

    document.getElementById("btnGiveStar")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      if (window.NinjaAudio) window.NinjaAudio.ensureContext();
      this.eatStar();
    });

    document.getElementById("btnFireBijuudama")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      if (window.NinjaAudio) window.NinjaAudio.ensureContext();
      this.triggerBijuudamaCharge(true);
    });

    document.getElementById("slotKurama")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      if (window.NinjaAudio) window.NinjaAudio.ensureContext();
      this.triggerBijuudamaCharge(false);
    });

    document.getElementById("btnWarpMid")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      this.player.x = 5600;
      this.player.y = this.world.def.groundY - 120;
      this.player.vy = 0;
      this.stageElapsedSec = Math.max(this.stageElapsedSec, 60);
      this.addFloatingText("⛩️ 已傳送至 01:00 中繼點！", this.player.x, this.player.y - 30, "#4cc9f0", 18);
    });

    document.getElementById("btnWarpBoss")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      this.player.x = this.world.def.bossGateX - 90;
      this.player.y = this.world.def.groundY - 110;
      this.player.vy = 0;
      this.stageElapsedSec = Math.max(this.stageElapsedSec, 118);
      this.addFloatingText("👹 已傳送至關卡頭目結界前！", this.player.x, this.player.y - 30, "#ffba08", 18);
    });

    document.getElementById("btnStage1")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      this.initStage(0);
    });
    document.getElementById("btnStage2")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      this.initStage(1);
    });
    document.getElementById("btnStage3")?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      this.initStage(2);
    });

    const audioBtn = document.getElementById("btnToggleAudio");
    audioBtn?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      if (!window.NinjaAudio) return;
      const on = window.NinjaAudio.toggle();
      audioBtn.textContent = on ? "🔊 音效: 開" : "🔇 音效: 關";
    });

    const gamepadBtn = document.getElementById("btnToggleGamepad");
    gamepadBtn?.addEventListener("click", (ev) => {
      refocusCanvas(ev);
      document.body.classList.toggle("show-gamepad");
    });

    // Dynamic Portrait / Landscape orientation adaptation
    window.addEventListener("resize", () => this.syncViewportOrientation());
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.syncViewportOrientation(), 80);
    });

    // Mobile Multi-Touch & Pointer Gamepad Controls (Portrait & Landscape)
    const btnLeft = document.getElementById("touchLeft");
    const btnRight = document.getElementById("touchRight");
    const dpadZone = document.getElementById("touchDpadZone");
    const btnJump = document.getElementById("touchJump");
    const btnShoot = document.getElementById("touchShoot");
    const btnBijuudama = document.getElementById("touchBijuudama");

    const updateDpadState = (leftActive, rightActive) => {
      this.keys.left = leftActive;
      this.keys.right = rightActive;
      btnLeft?.classList.toggle("pressed", leftActive);
      btnRight?.classList.toggle("pressed", rightActive);
    };

    const handleDpadTouches = (e) => {
      if (e.cancelable) e.preventDefault();
      if (window.NinjaAudio) window.NinjaAudio.ensureContext();
      let leftHit = false;
      let rightHit = false;
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const el = document.elementFromPoint(t.clientX, t.clientY)?.closest(".touch-dir");
        if (el && el.dataset.dir === "left") leftHit = true;
        if (el && el.dataset.dir === "right") rightHit = true;
      }
      updateDpadState(leftHit, rightHit);
    };

    if (dpadZone) {
      dpadZone.addEventListener("touchstart", handleDpadTouches, { passive: false });
      dpadZone.addEventListener("touchmove", handleDpadTouches, { passive: false });
      dpadZone.addEventListener("touchend", handleDpadTouches, { passive: false });
      dpadZone.addEventListener("touchcancel", handleDpadTouches, { passive: false });
    }

    // Pointer fallback for mouse / desktop testing on D-pad buttons
    [
      { btn: btnLeft, dir: "left" },
      { btn: btnRight, dir: "right" }
    ].forEach(({ btn, dir }) => {
      if (!btn) return;
      btn.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch") return;
        e.preventDefault();
        if (window.NinjaAudio) window.NinjaAudio.ensureContext();
        updateDpadState(dir === "left", dir === "right");
      });
      const releaseDir = (e) => {
        if (e.pointerType === "touch") return;
        updateDpadState(false, false);
      };
      btn.addEventListener("pointerup", releaseDir);
      btn.addEventListener("pointerleave", releaseDir);
      btn.addEventListener("pointercancel", releaseDir);
    });

    // Jump Button (Supports Double Ninja Jump)
    if (btnJump) {
      const pressJump = (e) => {
        if (e.cancelable) e.preventDefault();
        if (window.NinjaAudio) window.NinjaAudio.ensureContext();
        if (!this.keys.jump) this.jumpPressedJustNow = true;
        this.keys.jump = true;
        btnJump.classList.add("pressed");
      };
      const releaseJump = (e) => {
        if (e.cancelable) e.preventDefault();
        this.keys.jump = false;
        btnJump.classList.remove("pressed");
      };
      btnJump.addEventListener("touchstart", pressJump, { passive: false });
      btnJump.addEventListener("touchend", releaseJump, { passive: false });
      btnJump.addEventListener("touchcancel", releaseJump, { passive: false });
      btnJump.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") pressJump(e);
      });
      btnJump.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "touch") releaseJump(e);
      });
      btnJump.addEventListener("pointerleave", (e) => {
        if (e.pointerType !== "touch") releaseJump(e);
      });
    }

    // Rasengan Shoot Button
    if (btnShoot) {
      const pressShoot = (e) => {
        if (e.cancelable) e.preventDefault();
        if (window.NinjaAudio) window.NinjaAudio.ensureContext();
        this.shootPressedJustNow = true;
        this.keys.shoot = true;
        btnShoot.classList.add("pressed");
      };
      const releaseShoot = (e) => {
        if (e.cancelable) e.preventDefault();
        this.keys.shoot = false;
        this.shootHoldDuration = 0;
        btnShoot.classList.remove("pressed");
      };
      btnShoot.addEventListener("touchstart", pressShoot, { passive: false });
      btnShoot.addEventListener("touchend", releaseShoot, { passive: false });
      btnShoot.addEventListener("touchcancel", releaseShoot, { passive: false });
      btnShoot.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") pressShoot(e);
      });
      btnShoot.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "touch") releaseShoot(e);
      });
      btnShoot.addEventListener("pointerleave", (e) => {
        if (e.pointerType !== "touch") releaseShoot(e);
      });
    }

    // Bijuudama 3-Second Charge & Fire Button
    if (btnBijuudama) {
      const pressBijuudama = (e) => {
        if (e.cancelable) e.preventDefault();
        if (window.NinjaAudio) window.NinjaAudio.ensureContext();
        btnBijuudama.classList.add("pressed");
        this.triggerBijuudamaCharge(false);
      };
      const releaseBijuudama = (e) => {
        if (e.cancelable) e.preventDefault();
        btnBijuudama.classList.remove("pressed");
      };
      btnBijuudama.addEventListener("touchstart", pressBijuudama, { passive: false });
      btnBijuudama.addEventListener("touchend", releaseBijuudama, { passive: false });
      btnBijuudama.addEventListener("touchcancel", releaseBijuudama, { passive: false });
      btnBijuudama.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch") pressBijuudama(e);
      });
      btnBijuudama.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "touch") releaseBijuudama(e);
      });
      btnBijuudama.addEventListener("pointerleave", (e) => {
        if (e.pointerType !== "touch") releaseBijuudama(e);
      });
    }
  }

  showBanner(subtitle, title, desc, durationSec = 3.0) {
    const el = document.getElementById("centerBanner");
    if (!el) return;
    document.getElementById("bannerSubtitle").textContent = subtitle;
    document.getElementById("bannerTitle").textContent = title;
    document.getElementById("bannerDesc").textContent = desc;
    el.classList.remove("hidden");
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      el.classList.add("hidden");
    }, durationSec * 1000);
  }

  addFloatingText(text, x, y, color = "#ffd43b", size = 16) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -55,
      color,
      size,
      life: 1.15,
      maxLife: 1.15
    });
  }

  spawnChakraBurst(x, y, color, count = 18, speed = 220) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const spd = (0.35 + Math.random() * 0.75) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: 4 + Math.random() * 5,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8
      });
    }
  }

  eatMushroom() {
    this.player.hasRasengan = true;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
    this.score += 500;
    if (window.NinjaAudio) {
      window.NinjaAudio.playMushroomPowerup();
      window.NinjaAudio.startBgm();
    }
    this.spawnChakraBurst(this.player.x + 22, this.player.y + 38, "#2de2ff", 24, 260);
    this.addFloatingText("🍄 查克拉香菇！解鎖【螺旋丸光彈】並回復 +40 HP！", this.player.x + 22, this.player.y - 48, "#2de2ff", 18);
    this.updateHud();
    this.syncTelemetry();
  }

  eatStar() {
    this.player.hasRasengan = true;
    this.player.hp = this.player.maxHp;
    this.player.kuramaTimer = 42.0; // Nine-Tails Kurama Chakra Mode duration
    this.player.bijuudamaCount = this.BIJUUDAMA_MAX_ORBS; // Strictly 3 Tailed Beast Bombs!
    this.player.chargeTime = 0;
    this.score += 1000;
    this.camera.shake = 12;

    if (window.NinjaAudio) {
      window.NinjaAudio.isKuramaMode = true;
      window.NinjaAudio.playStarKurama();
      window.NinjaAudio.startBgm();
    }
    this.spawnChakraBurst(this.player.x + 22, this.player.y + 38, "#ffd43b", 36, 340);
    this.spawnChakraBurst(this.player.x + 22, this.player.y + 38, "#ff006e", 22, 280);
    this.addFloatingText(
      "⭐ 九尾查克拉模式！HP全滿＋獲得【尾獸彈 × 3】(按 K / X 集氣3秒發射)！",
      this.player.x + 22,
      this.player.y - 92,
      "#ffd43b",
      19
    );
    this.updateHud();
    this.syncTelemetry();
  }

  shootRasengan() {
    if (!this.player.hasRasengan && this.player.kuramaTimer <= 0) {
      this.addFloatingText("需先吃「查克拉香菇」才能發射螺旋丸！", this.player.x + 22, this.player.y - 45, "#ff8aa1", 14);
      return false;
    }
    if (this.player.shootCooldown > 0) return false;

    this.player.shootCooldown = 0.22;
    const spawnX = this.player.facing === 1 ? this.player.x + this.player.w + 8 : this.player.x - 8;
    const spawnY = this.player.y + this.player.h * 0.48;

    this.projectiles.push({
      kind: "rasengan",
      x: spawnX,
      y: spawnY,
      vx: this.player.facing * 720, // Flies straight horizontally!
      vy: 0,
      r: 14,
      facing: this.player.facing,
      travelDist: 0,
      maxDist: 920
    });

    if (window.NinjaAudio) window.NinjaAudio.playRasenganShoot();
    this.spawnChakraBurst(spawnX, spawnY, "#2de2ff", 10, 140);
    return true;
  }

  triggerBijuudamaCharge(autoActivateStarIfNeeded = false) {
    const p = this.player;
    if (p.isChargingBijuudama) return true;

    if (p.kuramaTimer <= 0) {
      if (autoActivateStarIfNeeded) {
        this.eatStar();
      } else {
        this.addFloatingText(
          "需先吃「⭐無敵星星」變身九尾鳴人才能發射尾獸彈！",
          p.x + 22,
          p.y - 54,
          "#ffd43b",
          15
        );
        return false;
      }
    }

    if (p.bijuudamaCount <= 0) {
      if (autoActivateStarIfNeeded) {
        this.eatStar();
      } else {
        this.addFloatingText(
          "3 顆尾獸彈已射完！請再吃一顆「⭐無敵星星」補充！",
          p.x + 22,
          p.y - 54,
          "#ff8aa1",
          15
        );
        return false;
      }
    }

    p.isChargingBijuudama = true;
    p.chargeTime = 0.01;
    this.addFloatingText(
      "🦊 尾獸彈開始 3.0 秒集氣！集滿自動發射！",
      p.x + 22,
      p.y - 68,
      "#ff94ff",
      16
    );
    this.updateHud();
    this.syncTelemetry();
    return true;
  }

  handleChargeRelease() {
    // Charge is now latch-activated on K / X press so IME or brief key release never aborts the 3.0s charge!
    if (this.player.isChargingBijuudama && this.player.chargeTime >= this.BIJUUDAMA_CHARGE_SECONDS) {
      this.fireBijuudama();
    }
  }

  fireBijuudama() {
    if (this.player.kuramaTimer <= 0 || this.player.bijuudamaCount <= 0) return false;

    this.player.bijuudamaCount = Math.max(0, this.player.bijuudamaCount - 1);
    this.player.isChargingBijuudama = false;
    this.player.chargeTime = 0;
    this.camera.shake = 22;

    const spawnX = this.player.facing === 1 ? this.player.x + this.player.w + 26 : this.player.x - 26;
    const spawnY = this.player.y + this.player.h * 0.42;

    this.projectiles.push({
      kind: "bijuudama",
      x: spawnX,
      y: spawnY,
      vx: this.player.facing * 560,
      vy: 0,
      r: 32,
      facing: this.player.facing,
      travelDist: 0,
      maxDist: 420
    });

    this.addFloatingText(
      `🦊 超大玉尾獸彈發射！(剩餘 ${this.player.bijuudamaCount} 顆)`,
      this.player.x + 22,
      this.player.y - 54,
      "#ffd43b",
      20
    );
    this.updateHud();
    this.syncTelemetry();
    return true;
  }

  /**
   * Detonates the Tailed Beast Bomb:
   * 1. Obliterates ALL normal/elite enemies currently visible on screen!
   * 2. Deals massive Boss damage (requires 2-3 Bijuudama hits to defeat a Stage Boss!).
   */
  detonateBijuudama(impactX, impactY) {
    this.bijuudamaFlash = 0.95;
    this.camera.shake = 34;
    if (window.NinjaAudio) window.NinjaAudio.playBijuudamaBoom();

    this.spawnChakraBurst(impactX, impactY, "#b94cff", 55, 480);
    this.spawnChakraBurst(impactX, impactY, "#ffd43b", 40, 390);

    // 1. Wipe ALL on-screen regular/elite enemies!
    const screenLeft = this.camera.x - 80;
    const screenRight = this.camera.x + this.canvas.width + 120;
    let wipedCount = 0;

    for (const e of this.world.enemies) {
      if (!e.dead && e.x + e.w >= screenLeft && e.x <= screenRight) {
        e.hp = 0;
        e.dead = true;
        wipedCount++;
        this.score += e.score;
        this.combo++;
        this.spawnChakraBurst(e.x + e.w / 2, e.y + e.h / 2, "#ff006e", 16, 240);
      }
    }

    if (wipedCount > 0) {
      this.addFloatingText(
        `💥 尾獸彈全畫面湮滅！瞬間消滅 ${wipedCount} 名敵人！`,
        this.camera.x + this.canvas.width / 2,
        190,
        "#ffd43b",
        22
      );
    }

    // 2. Boss Damage Rule: 2 to 3 Bijuudamas required to defeat the Stage Boss!
    if (this.boss && !this.boss.defeated) {
      const bossOnScreen =
        this.boss.x + this.boss.w >= screenLeft - 160 && this.boss.x <= screenRight + 160;
      if (this.boss.active || bossOnScreen) {
        this.boss.active = true;
        this.boss.bijuudamaHitsTaken++;
        const dmg = this.boss.bijuudamaDamage;
        this.boss.hp = Math.max(0, this.boss.hp - dmg);
        this.boss.hurtFlash = 0.35;

        const remainingShots = Math.ceil(this.boss.hp / this.boss.bijuudamaDamage);
        this.addFloatingText(
          `💥 尾獸彈重創頭目 -${dmg} HP！(再 ${remainingShots} 發尾獸彈擊破)`,
          this.boss.x + this.boss.w / 2,
          this.boss.y - 25,
          "#ff2a85",
          20
        );

        if (this.boss.hp <= 0) {
          this.handleBossDefeated();
        }
      }
    }

    this.updateHud();
    this.syncTelemetry();
  }

  handleBossDefeated() {
    if (!this.boss || this.boss.defeated) return;
    this.boss.defeated = true;
    this.boss.hp = 0;
    this.score += 5000;
    this.camera.shake = 30;
    if (window.NinjaAudio) {
      window.NinjaAudio.isBossFight = false;
      window.NinjaAudio.playStageClear();
    }
    this.spawnChakraBurst(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, "#ffd43b", 65, 420);

    const isFinalStage = this.stageIndex === 2;
    this.showBanner(
      isFinalStage ? "VICTORY // 全三關頭目完全擊破" : `STAGE ${this.stageIndex + 1} CLEAR!`,
      `擊破頭目：${this.boss.name}！`,
      isFinalStage
        ? "恭喜！九尾鳴人成功擊敗再不斬、大蛇丸與佩恩天道，完成忍界大冒險！4 秒後重新巡迴第 1 關。"
        : "4 秒後自動進入下一關卡，挑戰更強大的忍界頭目！",
      4.0
    );

    setTimeout(() => {
      this.initStage((this.stageIndex + 1) % 3);
    }, 4200);
  }

  loop(timestamp) {
    const dt = Math.min(0.04, Math.max(0.001, (timestamp - this.lastTimestamp) / 1000));
    this.lastTimestamp = timestamp;
    const timeSec = timestamp / 1000;

    this.update(dt, timeSec);
    this.renderer.render(this, timeSec, dt);

    requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt, timeSec) {
    this.stageElapsedSec += dt;
    if (this.camera.shake > 0) this.camera.shake = Math.max(0, this.camera.shake - 45 * dt);
    if (this.bijuudamaFlash > 0) this.bijuudamaFlash = Math.max(0, this.bijuudamaFlash - 1.8 * dt);

    this.updateMovingPlatforms(dt, timeSec);
    this.updatePlayer(dt, timeSec);
    this.updateItemsAndCoins(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt, timeSec);
    this.updateBoss(dt, timeSec);
    this.updateParticlesAndText(dt);
    this.updateCamera();
    this.updateHud();
    this.syncTelemetry();
  }

  updateMovingPlatforms(dt, timeSec) {
    for (const p of this.world.platforms) {
      if (p.kind === "moving") {
        const prevX = p.x;
        p.x = p.baseX + Math.sin(timeSec * p.speed) * p.moveRangeX;
        p.dx = p.x - prevX;
      }
    }
  }

  updatePlayer(dt, timeSec) {
    const p = this.player;
    if (p.shootCooldown > 0) p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);

    if (p.kuramaTimer > 0) {
      p.kuramaTimer = Math.max(0, p.kuramaTimer - dt);
      if (p.kuramaTimer === 0) {
        p.isChargingBijuudama = false;
        p.chargeTime = 0;
        p.bijuudamaCount = 0;
        if (window.NinjaAudio) window.NinjaAudio.isKuramaMode = false;
      }
    }

    // 1. Handle 3-Second Tailed Beast Bomb Charging (works on single K/X tap, holding K/X, clicking button, or holding J/Z in Kurama mode!)
    if (this.keys.shoot && p.kuramaTimer > 0 && p.bijuudamaCount > 0 && !p.isChargingBijuudama) {
      this.shootHoldDuration = (this.shootHoldDuration || 0) + dt;
      if (this.shootHoldDuration >= 0.25) {
        this.triggerBijuudamaCharge(false);
      }
    }

    if (p.isChargingBijuudama || this.keys.charge) {
      if (p.kuramaTimer > 0 && p.bijuudamaCount > 0) {
        p.isChargingBijuudama = true;
        p.chargeTime += dt;
        this.camera.shake = Math.max(this.camera.shake, 2.5 + (p.chargeTime / 3.0) * 6);

        this.chargeSoundAccum += dt;
        if (this.chargeSoundAccum >= 0.14) {
          this.chargeSoundAccum = 0;
          if (window.NinjaAudio) {
            window.NinjaAudio.playChargePulse(Math.min(1, p.chargeTime / this.BIJUUDAMA_CHARGE_SECONDS));
          }
        }

        // Auto-launch the moment 3.0 seconds of charging is completed!
        if (p.chargeTime >= this.BIJUUDAMA_CHARGE_SECONDS) {
          this.fireBijuudama();
          this.keys.charge = false;
        }
      } else if (p.kuramaTimer <= 0) {
        p.isChargingBijuudama = false;
        this.keys.charge = false;
        this.addFloatingText("需先吃「無敵星星」變身九尾鳴人才能集氣尾獸彈！", p.x + 22, p.y - 48, "#ffd43b", 14);
      } else if (p.bijuudamaCount <= 0) {
        p.isChargingBijuudama = false;
        this.keys.charge = false;
        this.addFloatingText("3 顆尾獸彈已用盡！請再吃一顆無敵星星補充！", p.x + 22, p.y - 48, "#ff8aa1", 14);
      }
    }

    // 2. Shoot Straight-Flying Rasengan Light Sphere
    if (this.shootPressedJustNow) {
      this.shootPressedJustNow = false;
      this.shootRasengan();
    }

    // 3. Horizontal Movement (slowed slightly while concentrating 3s Bijuudama charge)
    const maxSpd = p.kuramaTimer > 0 ? this.KURAMA_MOVE_SPEED : this.MAX_MOVE_SPEED;
    const chargeMoveFactor = p.isChargingBijuudama ? 0.45 : 1.0;

    if (this.keys.left) {
      p.vx -= this.MOVE_ACCEL * chargeMoveFactor * dt;
      p.facing = -1;
    } else if (this.keys.right) {
      p.vx += this.MOVE_ACCEL * chargeMoveFactor * dt;
      p.facing = 1;
    } else {
      p.vx *= p.onGround ? this.GROUND_FRICTION : this.AIR_FRICTION;
      if (Math.abs(p.vx) < 6) p.vx = 0;
    }
    p.vx = Math.max(-maxSpd * chargeMoveFactor, Math.min(maxSpd * chargeMoveFactor, p.vx));

    // 4. Jump & Double Ninja Jump with Coyote Time
    if (p.onGround) {
      p.coyoteTimer = 0.1;
      p.jumpsRemaining = 2;
    } else if (p.coyoteTimer > 0) {
      p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
    }

    if (this.jumpPressedJustNow) {
      this.jumpPressedJustNow = false;
      if (p.onGround || p.coyoteTimer > 0) {
        p.vy = this.JUMP_VELOCITY;
        p.onGround = false;
        p.coyoteTimer = 0;
        p.jumpsRemaining = 1;
        if (window.NinjaAudio) window.NinjaAudio.playJump(false);
      } else if (p.jumpsRemaining > 0) {
        p.vy = this.DOUBLE_JUMP_VELOCITY;
        p.jumpsRemaining = 0;
        if (window.NinjaAudio) window.NinjaAudio.playJump(true);
        this.spawnChakraBurst(p.x + p.w / 2, p.y + p.h, "#2de2ff", 10, 130);
      }
    }

    // Variable jump height when releasing jump key early
    if (!this.keys.jump && p.vy < -240) {
      p.vy *= 0.9;
    }

    // Gravity
    p.vy = Math.min(this.MAX_FALL_SPEED, p.vy + this.GRAVITY * dt);

    // 5. Integrate X & Resolve Horizontal Block Collisions
    p.x += p.vx * dt;
    const minX = this.camera.lockedInArena ? this.world.def.bossArenaStartX : 0;
    const maxX = this.world.def.lengthPx - p.w;
    if (p.x < minX) {
      p.x = minX;
      p.vx = 0;
    }
    if (p.x > maxX) {
      p.x = maxX;
      p.vx = 0;
    }

    for (const b of this.world.blocks) {
      if (this.rectOverlap(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
        if (p.vx > 0) p.x = b.x - p.w;
        else if (p.vx < 0) p.x = b.x + b.w;
        p.vx = 0;
      }
    }

    // 6. Integrate Y & Resolve Ground / Platform / Question Block Collisions
    const prevBottom = p.y + p.h;
    const prevTop = p.y;
    p.y += p.vy * dt;
    p.onGround = false;

    // Landing on platforms
    if (p.vy >= 0) {
      for (const plat of this.world.platforms) {
        const withinX = p.x + p.w > plat.x + 4 && p.x < plat.x + plat.w - 4;
        if (withinX && prevBottom <= plat.y + 14 && p.y + p.h >= plat.y) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
          if (plat.dx) p.x += plat.dx;
          break;
        }
      }
    }

    // Colliding with Interactive Blocks (? Mushroom/Star blocks)
    for (const b of this.world.blocks) {
      if (b.bumpOffset && b.bumpOffset < 0) {
        b.bumpOffset = Math.min(0, b.bumpOffset + 90 * dt);
      }
      if (this.rectOverlap(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
        if (p.vy > 0 && prevBottom <= b.y + 14) {
          // Landed on top of block
          p.y = b.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else if (p.vy < 0 && prevTop >= b.y + b.h - 16) {
          // Head-bumped block from below (Mario style!)
          p.y = b.y + b.h;
          p.vy = 80;
          this.triggerBlockBump(b);
        }
      }
    }

    // Record passed Torii Checkpoints so Naruto respawns at the latest gate upon death
    if (this.world.toriiGates) {
      for (const gate of this.world.toriiGates) {
        if (!gate.isBossGate && p.x >= gate.x && (p.lastCheckpointX || 120) < gate.x) {
          p.lastCheckpointX = gate.x;
          this.addFloatingText(`⛩️ 已記錄檢查點：${gate.label}`, gate.x + 20, this.world.def.groundY - 190, "#ffd43b", 15);
        }
      }
    }

    // Pit fall damage (-35 HP; if HP hits 0, triggers full death/respawn)
    if (p.y > this.canvas.height + 90) {
      p.y = this.world.def.groundY - 180;
      p.vy = 0;
      p.x = Math.max(80, p.x - 160);
      this.handlePlayerHurt(true, 35);
    }
  }

  triggerBlockBump(block) {
    if (block.hit) {
      if (window.NinjaAudio) window.NinjaAudio.playBlockBump();
      return;
    }
    block.hit = true;
    block.bumpOffset = -12;
    if (window.NinjaAudio) window.NinjaAudio.playBlockBump();

    if (block.content === "mushroom") {
      this.items.push({
        kind: "mushroom",
        x: block.x + 5,
        y: block.y - 34,
        vx: 95,
        vy: -220,
        w: 32,
        h: 32
      });
      if (window.NinjaAudio) window.NinjaAudio.playItemSpawn();
      this.addFloatingText("🍄 查克拉香菇出現！", block.x + 20, block.y - 25, "#2de2ff", 15);
    } else if (block.content === "star") {
      this.items.push({
        kind: "star",
        x: block.x + 5,
        y: block.y - 36,
        vx: 110,
        vy: -260,
        w: 34,
        h: 34
      });
      if (window.NinjaAudio) window.NinjaAudio.playItemSpawn();
      this.addFloatingText("⭐ 九尾無敵星星出現！", block.x + 20, block.y - 25, "#ffd43b", 16);
    } else {
      this.coinsCount++;
      this.score += 100;
      if (window.NinjaAudio) window.NinjaAudio.playCoin();
      this.addFloatingText("+100 忍幣", block.x + 20, block.y - 18, "#ffd43b", 14);
    }
  }

  updateItemsAndCoins(dt) {
    const p = this.player;

    // Collect Ryo Coins
    for (const c of this.world.coins) {
      if (!c.collected) {
        const dx = p.x + p.w / 2 - c.x;
        const dy = p.y + p.h / 2 - c.y;
        if (dx * dx + dy * dy < 30 * 30) {
          c.collected = true;
          this.coinsCount++;
          this.score += 50;
          if (window.NinjaAudio) window.NinjaAudio.playCoin();
        }
      }
    }

    // Update & Collect Mushrooms and Invincibility Stars
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.vy = Math.min(520, it.vy + this.GRAVITY * 0.75 * dt);
      it.x += it.vx * dt;
      it.y += it.vy * dt;

      // Bounce/slide on platforms
      for (const plat of this.world.platforms) {
        if (
          it.vy >= 0 &&
          it.x + it.w > plat.x &&
          it.x < plat.x + plat.w &&
          it.y + it.h >= plat.y &&
          it.y + it.h <= plat.y + 24
        ) {
          it.y = plat.y - it.h;
          it.vy = it.kind === "star" ? -290 : 0; // Stars bounce like Mario!
        }
      }

      if (this.rectOverlap(p.x, p.y, p.w, p.h, it.x, it.y, it.w, it.h)) {
        if (it.kind === "mushroom") {
          this.eatMushroom();
        } else if (it.kind === "star") {
          this.eatStar();
        }
        this.items.splice(i, 1);
      } else if (it.y > this.canvas.height + 120) {
        this.items.splice(i, 1);
      }
    }
  }

  updateProjectiles(dt) {
    // Player Projectiles: Rasengan Light Spheres & Charged Tailed Beast Bombs
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      const stepX = pr.vx * dt;
      pr.x += stepX;
      pr.y += pr.vy * dt;
      pr.travelDist += Math.abs(stepX);

      let consumed = false;

      if (pr.kind === "bijuudama") {
        // Check impact with any enemy or boss or max travel distance -> triggers screen-wide detonation!
        const hitEnemy = this.world.enemies.find(
          (e) => !e.dead && this.circleRectOverlap(pr.x, pr.y, pr.r, e.x, e.y, e.w, e.h)
        );
        const hitBoss =
          this.boss &&
          !this.boss.defeated &&
          this.circleRectOverlap(pr.x, pr.y, pr.r, this.boss.x, this.boss.y, this.boss.w, this.boss.h);

        if (hitEnemy || hitBoss || pr.travelDist >= pr.maxDist) {
          this.detonateBijuudama(pr.x, pr.y);
          consumed = true;
        }
      } else if (pr.kind === "rasengan") {
        // Straight-flying Rasengan Light Sphere vs Enemies (stronger enemies need more shots!)
        for (const e of this.world.enemies) {
          if (!e.dead && this.circleRectOverlap(pr.x, pr.y, pr.r, e.x, e.y, e.w, e.h)) {
            e.hp -= 1;
            e.hurtFlash = 0.18;
            consumed = true;
            this.spawnChakraBurst(pr.x, pr.y, "#2de2ff", 14, 190);

            if (e.hp <= 0) {
              e.dead = true;
              this.score += e.score;
              this.combo++;
              if (window.NinjaAudio) window.NinjaAudio.playRasenganHit(true);
              this.addFloatingText(
                `🌀 螺旋丸擊破 ${e.name}！+${e.score}`,
                e.x + e.w / 2,
                e.y - 12,
                "#2de2ff",
                15
              );
            } else {
              if (window.NinjaAudio) window.NinjaAudio.playRasenganHit(false);
              this.addFloatingText(
                `🌀 命中 -1 (還需 ${e.hp} 發螺旋丸)`,
                e.x + e.w / 2,
                e.y - 12,
                "#90e0ef",
                13
              );
            }
            break;
          }
        }

        // Rasengan vs Stage Boss
        if (
          !consumed &&
          this.boss &&
          !this.boss.defeated &&
          this.circleRectOverlap(pr.x, pr.y, pr.r, this.boss.x, this.boss.y, this.boss.w, this.boss.h)
        ) {
          this.boss.active = true;
          this.boss.rasenganHitsTaken++;
          this.boss.hp = Math.max(0, this.boss.hp - this.boss.rasenganDamage);
          this.boss.hurtFlash = 0.15;
          consumed = true;
          if (window.NinjaAudio) window.NinjaAudio.playRasenganHit(this.boss.hp <= 0);
          this.spawnChakraBurst(pr.x, pr.y, "#2de2ff", 18, 220);
          this.addFloatingText(
            `🌀 螺旋丸 -${this.boss.rasenganDamage}`,
            this.boss.x + this.boss.w / 2,
            this.boss.y - 10,
            "#2de2ff",
            15
          );
          if (this.boss.hp <= 0) {
            this.handleBossDefeated();
          }
        }

        if (pr.travelDist >= pr.maxDist) consumed = true;
      }

      if (consumed) {
        this.projectiles.splice(i, 1);
      }
    }

    // Enemy / Boss Jutsu Projectiles
    const p = this.player;
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;
      ep.life -= dt;

      if (this.circleRectOverlap(ep.x, ep.y, ep.r, p.x, p.y, p.w, p.h)) {
        if (p.kuramaTimer <= 0) {
          this.handlePlayerHurt(false);
        } else {
          this.spawnChakraBurst(ep.x, ep.y, "#ffd43b", 8, 120);
        }
        this.enemyProjectiles.splice(i, 1);
      } else if (ep.life <= 0) {
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  updateEnemies(dt, timeSec) {
    const p = this.player;
    const camLeft = this.camera.x - 160;
    const camRight = this.camera.x + this.canvas.width + 220;

    for (const e of this.world.enemies) {
      if (e.dead) continue;
      if (e.hurtFlash > 0) e.hurtFlash = Math.max(0, e.hurtFlash - dt);
      if (e.x < camLeft || e.x > camRight) continue;

      // Patrol movement
      e.x += e.vx * dt;
      if (e.x <= e.patrolMinX) {
        e.x = e.patrolMinX;
        e.vx = Math.abs(e.speed);
        e.facing = 1;
      } else if (e.x >= e.patrolMaxX) {
        e.x = e.patrolMaxX;
        e.vx = -Math.abs(e.speed);
        e.facing = -1;
      }

      // Jonin ranged shuriken/kunai attack
      if (e.behavior === "shooter") {
        e.attackCooldown -= dt;
        if (e.attackCooldown <= 0 && Math.abs(p.x - e.x) < 460) {
          e.attackCooldown = 2.4;
          const dir = p.x < e.x ? -1 : 1;
          e.facing = dir;
          this.enemyProjectiles.push({
            x: e.x + e.w / 2,
            y: e.y + e.h * 0.45,
            vx: dir * 310,
            vy: 0,
            r: 8,
            color: "#ff9f1c",
            life: 2.2
          });
        }
      }

      // Player vs Enemy collision (Mario stomp or Kurama contact invincibility)
      if (this.rectOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        if (p.kuramaTimer > 0) {
          // Nine-Tails Kurama cloak incinerates regular enemies on contact!
          e.hp = 0;
          e.dead = true;
          this.score += e.score;
          this.spawnChakraBurst(e.x + e.w / 2, e.y + e.h / 2, "#ffd43b", 16, 200);
          this.addFloatingText(`🦊 九尾查克拉衝撞擊破！+${e.score}`, e.x, e.y - 14, "#ffd43b", 14);
        } else if (p.vy > 40 && p.y + p.h - p.vy * dt <= e.y + 18) {
          // Mario-style Ninja Head Stomp!
          p.vy = -440;
          e.hp -= 1;
          e.hurtFlash = 0.2;
          if (e.hp <= 0) {
            e.dead = true;
            this.score += e.score;
            this.addFloatingText(`👟 忍躍踩擊擊破！+${e.score}`, e.x, e.y - 12, "#ffd43b", 14);
          } else {
            this.addFloatingText(`👟 踩擊 -1 (剩餘 ${e.hp} HP)`, e.x, e.y - 12, "#ffffff", 13);
          }
        } else {
          this.handlePlayerHurt(false);
        }
      }
    }
  }

  updateBoss(dt, timeSec) {
    const b = this.boss;
    if (!b || b.defeated) return;
    if (b.hurtFlash > 0) b.hurtFlash = Math.max(0, b.hurtFlash - dt);

    const def = this.world.def;
    const p = this.player;

    // Activate Boss Fight when Naruto crosses the Boss Gate!
    if (!b.active && p.x >= def.bossGateX - 40) {
      b.active = true;
      this.camera.lockedInArena = true;
      if (window.NinjaAudio) {
        window.NinjaAudio.isBossFight = true;
        window.NinjaAudio.playBossWarning();
      }
      this.showBanner(
        "WARNING // BOSS ENGAGED",
        b.name,
        `${b.title} ｜ 尾獸彈需 2~3 發擊破頭目，場景上方有 ★ 無敵星星與香菇補給方塊！`,
        3.5
      );
    }

    if (!b.active) return;

    // Boss Arena Movement & Multi-Projectile Jutsu Attacks
    b.x += b.vx * dt;
    if (b.x <= def.bossArenaStartX + 60) {
      b.x = def.bossArenaStartX + 60;
      b.vx = Math.abs(b.vx);
    } else if (b.x + b.w >= def.bossArenaEndX - 60) {
      b.x = def.bossArenaEndX - 60 - b.w;
      b.vx = -Math.abs(b.vx);
    }
    b.facing = p.x < b.x ? -1 : 1;

    b.attackTimer -= dt;
    if (b.attackTimer <= 0) {
      b.attackTimer = b.attackInterval;
      const dir = b.facing;
      // Launch 3-way Boss Jutsu wave
      const speeds = [
        { vx: dir * 340, vy: 0 },
        { vx: dir * 310, vy: -95 },
        { vx: dir * 280, vy: -180 }
      ];
      for (const s of speeds) {
        this.enemyProjectiles.push({
          x: b.x + b.w / 2 + dir * 30,
          y: b.y + b.h * 0.45,
          vx: s.vx,
          vy: s.vy,
          r: 13,
          color: b.primaryColor,
          life: 3.0
        });
      }
    }

    // Contact with Boss
    if (this.rectOverlap(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
      if (p.vy > 60 && p.y + p.h - p.vy * dt <= b.y + 24) {
        p.vy = -500;
        b.hp = Math.max(0, b.hp - 12);
        b.hurtFlash = 0.15;
        this.addFloatingText("👟 頭目踏擊 -12", b.x + b.w / 2, b.y - 12, "#ffd43b", 15);
        if (b.hp <= 0) this.handleBossDefeated();
      } else if (p.kuramaTimer <= 0) {
        this.handlePlayerHurt(false, 28);
      }
    }
  }

  handlePlayerHurt(isPit, customDamage = 0) {
    const p = this.player;
    if (p.invulnTimer > 0 && !isPit) return;

    const dmg = customDamage > 0 ? customDamage : isPit ? 35 : 20;
    p.hp = Math.max(0, p.hp - dmg);
    p.invulnTimer = 1.5;
    this.combo = 0;
    this.camera.shake = 12;
    if (window.NinjaAudio) window.NinjaAudio.playHurt();
    this.spawnChakraBurst(p.x + p.w / 2, p.y + p.h / 2, "#ff4d6d", 14, 180);

    if (p.hp <= 0) {
      this.handlePlayerDeath();
      return;
    }

    if (p.hasRasengan && p.hp <= 40 && !isPit) {
      p.hasRasengan = false;
      this.addFloatingText(
        `💔 受到重創 -${dmg} HP (剩餘 ${p.hp}/${p.maxHp})！螺旋丸查克拉潰散！`,
        p.x + 22,
        p.y - 48,
        "#ff4d6d",
        15
      );
    } else {
      this.addFloatingText(
        `💥 鳴人受傷 -${dmg} HP！(剩餘 ${p.hp} / ${p.maxHp} HP)`,
        p.x + 22,
        p.y - 48,
        "#ff4d6d",
        15
      );
    }

    this.updateHud();
    this.syncTelemetry();
  }

  handlePlayerDeath() {
    const p = this.player;
    const def = this.world.def;
    this.lives = Math.max(0, this.lives - 1);
    this.camera.shake = 26;
    this.spawnChakraBurst(p.x + p.w / 2, p.y + p.h / 2, "#ff1e42", 42, 340);

    p.hasRasengan = false;
    p.kuramaTimer = 0;
    p.bijuudamaCount = 0;
    p.isChargingBijuudama = false;
    p.chargeTime = 0;
    if (window.NinjaAudio) window.NinjaAudio.isKuramaMode = false;

    if (this.lives > 0) {
      // Respawn at latest checkpoint (or just before Boss Gate if died inside Boss Arena)
      const respawnX = this.camera.lockedInArena
        ? Math.max(120, def.bossGateX - 200)
        : p.lastCheckpointX || 120;

      if (this.camera.lockedInArena && this.boss) {
        this.camera.lockedInArena = false;
        this.boss.active = false;
        this.boss.hp = this.boss.maxHp;
        this.enemyProjectiles = [];
        if (window.NinjaAudio) window.NinjaAudio.isBossFight = false;
      }

      p.x = respawnX;
      p.y = def.groundY - p.h;
      p.vx = 0;
      p.vy = 0;
      p.hp = p.maxHp;
      p.invulnTimer = 2.4;

      this.addFloatingText(
        `💀 鳴人戰敗陣亡！消耗 1 條命 (剩餘 ❤️ × ${this.lives}) — 檢查點滿血復活！`,
        p.x + 22,
        p.y - 60,
        "#ff2a55",
        17
      );
      this.showBanner(
        `PLAYER DOWN // 剩餘命數 ❤️ × ${this.lives}`,
        "鳴人生命值歸零！已於最近鳥居檢查點重生",
        "提示：撞擊「?」方塊吃查克拉香菇可回復 +40 HP，吃無敵星星變身九尾可直接回滿 100 HP！",
        2.6
      );
    } else {
      // All 3 Lives Exhausted -> True GAME OVER & Stage Restart!
      this.lives = 3;
      this.score = Math.max(0, this.score - 1000);
      this.initStage(this.stageIndex);
      this.showBanner(
        "💀 GAME OVER // 鳴人忍道挫敗",
        "HP 歸零且 3 條命全數耗盡！",
        "已重新開始本關卡並恢復 ❤️ × 3 與 100 HP，善用二段跳與螺旋丸光彈突破敵陣！",
        3.8
      );
    }

    this.updateHud();
    this.syncTelemetry();
  }

  updateParticlesAndText(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  updateCamera() {
    const def = this.world.def;
    const leadOffset = Math.min(360, Math.round(this.canvas.width * 0.3));
    if (this.camera.lockedInArena) {
      if (this.canvas.width >= 1060) {
        const targetX = def.bossArenaStartX - 30;
        this.camera.x += (targetX - this.camera.x) * 0.12;
      } else {
        const minArenaCam = def.bossArenaStartX - 20;
        const maxArenaCam = Math.max(minArenaCam, def.bossArenaEndX - this.canvas.width + 20);
        const targetX = Math.max(minArenaCam, Math.min(maxArenaCam, this.player.x - leadOffset));
        this.camera.x += (targetX - this.camera.x) * 0.14;
      }
    } else {
      const targetX = Math.max(0, Math.min(def.lengthPx - this.canvas.width, this.player.x - leadOffset));
      this.camera.x += (targetX - this.camera.x) * 0.14;
    }
  }

  updateHud() {
    const p = this.player;
    const def = this.world.def;

    const formBadge = document.getElementById("hudFormBadge");
    const avatarRing = document.getElementById("hudAvatarRing");
    if (formBadge && avatarRing) {
      if (p.kuramaTimer > 0) {
        formBadge.textContent = "🦊 九尾查克拉鳴人";
        formBadge.className = "badge-tag kurama";
        avatarRing.className = "avatar-ring mode-kurama";
      } else if (p.hasRasengan) {
        formBadge.textContent = "🌀 螺旋丸強化鳴人";
        formBadge.className = "badge-tag rasengan";
        avatarRing.className = "avatar-ring mode-rasengan";
      } else {
        formBadge.textContent = "普通鳴人 (Q版)";
        formBadge.className = "badge-tag";
        avatarRing.className = "avatar-ring";
      }
    }

    document.getElementById("hudLives").textContent = `❤️ × ${this.lives}`;

    // Naruto Player HP Bar in HUD
    const hpFill = document.getElementById("hudHpFill");
    const hpLag = document.getElementById("hudHpLag");
    const hpText = document.getElementById("hudHpText");
    if (hpFill && hpLag && hpText) {
      const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
      hpFill.style.width = `${hpPct}%`;
      hpLag.style.width = `${hpPct}%`;
      const track = hpFill.parentElement;
      if (p.kuramaTimer > 0) {
        hpFill.className = "player-hp-fill hp-kurama";
        if (track) track.className = "player-hp-track kurama-invuln";
        hpText.textContent = `🦊 九尾無敵護體 HP ${p.hp} / ${p.maxHp}`;
      } else {
        if (track) track.className = "player-hp-track";
        if (hpPct <= 30) {
          hpFill.className = "player-hp-fill hp-danger";
        } else if (hpPct <= 60) {
          hpFill.className = "player-hp-fill hp-warn";
        } else {
          hpFill.className = "player-hp-fill";
        }
        hpText.textContent = `HP ${p.hp} / ${p.maxHp}`;
      }
    }

    document.getElementById("hudCoins").textContent = String(this.coinsCount);
    document.getElementById("hudCombo").textContent = String(this.combo);
    document.getElementById("hudScore").textContent = String(this.score);

    const rasState = document.getElementById("hudRasenganState");
    if (rasState) {
      if (p.hasRasengan || p.kuramaTimer > 0) {
        rasState.textContent = "已啟動！按 J / Z 直線發射螺旋丸光彈";
        rasState.className = "ability-state active";
      } else {
        rasState.textContent = "未解鎖 (撞擊 ? 方塊或點下方按鈕吃香菇)";
        rasState.className = "ability-state";
      }
    }

    const kuramaTimerEl = document.getElementById("hudKuramaTimer");
    if (kuramaTimerEl) {
      kuramaTimerEl.textContent = p.kuramaTimer > 0 ? `(${p.kuramaTimer.toFixed(0)}s)` : "";
    }

    // 3 Tailed Beast Bomb Orbs
    const orbsWrap = document.getElementById("hudBijuudamaOrbs");
    if (orbsWrap) {
      const orbs = orbsWrap.querySelectorAll(".orb");
      orbs.forEach((orb, idx) => {
        orb.className = idx < p.bijuudamaCount ? "orb filled" : "orb empty";
      });
    }

    // 3.0s Charge Progress Bar
    const chargeFill = document.getElementById("hudChargeFill");
    const chargeText = document.getElementById("hudChargeText");
    if (chargeFill && chargeText) {
      const pct = Math.min(100, (p.chargeTime / this.BIJUUDAMA_CHARGE_SECONDS) * 100);
      chargeFill.style.width = `${pct}%`;
      if (p.kuramaTimer > 0) {
        chargeText.textContent =
          p.bijuudamaCount > 0
            ? `尾獸彈集氣 ${p.chargeTime.toFixed(1)}s / 3.0s (剩 ${p.bijuudamaCount} 顆)`
            : "尾獸彈已射完 (0/3)";
      } else {
        chargeText.textContent = "集氣 0.0s / 3.0s (需無敵星星變身九尾)";
      }
    }

    // Stage & 2-Minute Timer
    document.getElementById("hudStageName").textContent = def.title;
    const mins = String(Math.floor(this.stageElapsedSec / 60)).padStart(2, "0");
    const secs = String(Math.floor(this.stageElapsedSec % 60)).padStart(2, "0");
    document.getElementById("hudStageTimer").textContent = `⏱️ ${mins}:${secs} / 預計 02:00 抵達頭目`;

    const progressPct = Math.min(100, Math.max(0, (p.x / def.bossGateX) * 100));
    document.getElementById("hudStageProgress").style.width = `${progressPct}%`;
    document.getElementById("hudBossDist").textContent = `${Math.max(0, 100 - Math.floor(progressPct))}%`;

    // Boss HUD
    const bossHud = document.getElementById("bossHud");
    if (bossHud && this.boss) {
      if (this.boss.active && !this.boss.defeated) {
        bossHud.classList.remove("hidden");
        document.getElementById("bossName").textContent = this.boss.name;
        document.getElementById("bossHpCurrent").textContent = String(this.boss.hp);
        document.getElementById("bossHpMax").textContent = String(this.boss.maxHp);
        const hpPct = Math.max(0, (this.boss.hp / this.boss.maxHp) * 100);
        document.getElementById("bossHpFill").style.width = `${hpPct}%`;
        document.getElementById("bossHpLag").style.width = `${hpPct}%`;
      } else {
        bossHud.classList.add("hidden");
      }
    }
  }

  syncTelemetry() {
    window.__NARUTO_MARIO_STATE__ = {
      stageId: this.world.def.id,
      stageTitle: this.world.def.title,
      targetSecondsToBoss: this.world.def.targetSecondsToBoss,
      stageLengthPx: this.world.def.lengthPx,
      bossGateX: this.world.def.bossGateX,
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        hp: this.player.hp,
        maxHp: this.player.maxHp,
        lives: this.lives,
        hasRasengan: this.player.hasRasengan,
        isNineTailsKurama: this.player.kuramaTimer > 0,
        kuramaTimer: Number(this.player.kuramaTimer.toFixed(2)),
        bijuudamaCount: this.player.bijuudamaCount,
        bijuudamaMaxOrbs: this.BIJUUDAMA_MAX_ORBS,
        bijuudamaChargeRequiredSeconds: this.BIJUUDAMA_CHARGE_SECONDS,
        chargeTime: Number(this.player.chargeTime.toFixed(2))
      },
      enemiesAlive: this.world.enemies.filter((e) => !e.dead).length,
      enemyTierMaxHp: {
        genin: 1,
        chunin: 2,
        jonin: 3 + this.stageIndex,
        summon_heavy: 5 + this.stageIndex
      },
      boss: this.boss
        ? {
            name: this.boss.name,
            active: this.boss.active,
            defeated: this.boss.defeated,
            hp: this.boss.hp,
            maxHp: this.boss.maxHp,
            bijuudamaDamage: this.boss.bijuudamaDamage,
            bijuudamaShotsToKill: Math.ceil(this.boss.maxHp / this.boss.bijuudamaDamage)
          }
        : null
    };
  }

  rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= cr * cr;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new NarutoMarioEngine();
});
