/**
 * High-DPI Anime Canvas Renderer for NARUTO × MARIO
 * Renders Q-Version Chibi Naruto (Normal, Rasengan Chakra Mode, Nine-Tails Kurama Mode),
 * 9 Animated Chakra Tails, Rasengan Light Spheres, 3-Second Charged Bijuudama,
 * Multi-Layer Parallax Ninja Worlds, Tiered Enemies, and 3 Iconic Stage Bosses.
 */
class NarutoMarioRenderer {
  constructor(canvas, avatarCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.avatarCanvas = avatarCanvas;
    this.avatarCtx = avatarCanvas ? avatarCanvas.getContext("2d") : null;
    this.weatherParticles = [];
    this.initWeather();
  }

  initWeather() {
    this.weatherParticles = [];
    for (let i = 0; i < 65; i++) {
      this.weatherParticles.push({
        x: Math.random() * 1280,
        y: Math.random() * 660,
        vx: -40 - Math.random() * 60,
        vy: 35 + Math.random() * 75,
        size: 3 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  render(state, timeSec, dt) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const stage = state.world.def;
    const theme = stage.theme;

    ctx.save();

    // Apply camera shake if active (e.g., Bijuudama charge / detonation / Boss slam)
    if (state.camera.shake > 0.2) {
      const dx = (Math.random() - 0.5) * state.camera.shake;
      const dy = (Math.random() - 0.5) * state.camera.shake;
      ctx.translate(dx, dy);
    }

    // 1. Multi-layer Parallax Sky & Moon/Sun
    this.drawSkyAndBackdrop(ctx, W, H, stage, theme, state.camera.x, timeSec);

    // 2. World Space Transform
    ctx.save();
    ctx.translate(-Math.floor(state.camera.x), 0);

    // 3. Stage Decorations (Torii gates, stone lanterns, boss gate)
    this.drawDecorations(ctx, state.world, stage, timeSec);

    // 4. Platforms & Ground Tiles
    this.drawPlatforms(ctx, state.world.platforms, theme, state.camera.x, W, timeSec);

    // 5. Interactive Blocks (? Chakra Scroll Blocks, Golden Star Shrines, Bricks)
    this.drawBlocks(ctx, state.world.blocks, state.camera.x, W, timeSec);

    // 6. Ryo Coins & Power-Up Items (Chakra Mushrooms & Invincibility Stars)
    this.drawCoinsAndItems(ctx, state.world.coins, state.items, state.camera.x, W, timeSec);

    // 7. Enemies with Tiered HP Pips
    this.drawEnemies(ctx, state.world.enemies, state.camera.x, W, timeSec);

    // 8. Stage Boss (Zabuza / Orochimaru / Pain)
    if (state.boss && !state.boss.defeated) {
      this.drawBoss(ctx, state.boss, timeSec);
    }

    // 9. Additive Chakra Particles (drawn behind Naruto so his face is always crystal-clear!)
    this.drawParticlesOnly(ctx, state.particles);

    // 10. Q-Version Anime Naruto (Normal / Rasengan Mode / Nine-Tails Kurama Mode)
    this.drawQChibiNaruto(ctx, state.player, timeSec);

    // 11. Projectiles (Rasengan Light Spheres, Charged Tailed Beast Bombs, Boss Jutsu)
    this.drawProjectiles(ctx, state.projectiles, state.enemyProjectiles, timeSec);

    // 12. Floating Damage & Status Texts
    this.drawFloatingTextsOnly(ctx, state.floatingTexts);

    ctx.restore();

    // 13. Screen-Space Weather & Bijuudama Apocalypse Flash
    this.drawWeatherAndScreenEffects(ctx, W, H, theme, state, timeSec, dt);

    ctx.restore();

    // Update HUD Avatar portrait
    if (this.avatarCtx) {
      this.drawAvatarPortrait(this.avatarCtx, state.player, timeSec);
    }
  }

  drawSkyAndBackdrop(ctx, W, H, stage, theme, camX, timeSec) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(0.55, theme.skyMid);
    skyGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Celestial Body (Stage 1: Warm Dawn Sun & Chakra Aura, Stage 2: Giant Blood Moon, Stage 3: Rinnegan Storm Vortex)
    ctx.save();
    if (stage.id === 1) {
      const sunX = W * 0.78 - (camX * 0.02) % 120;
      const sunY = 135;
      const rad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 130);
      rad.addColorStop(0, "rgba(255, 240, 180, 0.95)");
      rad.addColorStop(0.4, "rgba(255, 168, 52, 0.45)");
      rad.addColorStop(1, "rgba(255, 120, 20, 0)");
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 130, 0, Math.PI * 2);
      ctx.fill();
    } else if (stage.id === 2) {
      const moonX = W * 0.74;
      const moonY = 145;
      const rad = ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 150);
      rad.addColorStop(0, "rgba(255, 56, 100, 0.95)");
      rad.addColorStop(0.55, "rgba(181, 23, 158, 0.45)");
      rad.addColorStop(1, "rgba(181, 23, 158, 0)");
      ctx.fillStyle = rad;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 150, 0, Math.PI * 2);
      ctx.fill();
      // Sharingan / Curse pattern rings on the Crimson Moon
      ctx.strokeStyle = "rgba(40, 0, 20, 0.45)";
      ctx.lineWidth = 2;
      for (let r = 24; r <= 56; r += 16) {
        ctx.beginPath();
        ctx.arc(moonX, moonY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Stage 3 Rinnegan Storm Eye + Lightning flashes
      const eyeX = W * 0.72;
      const eyeY = 140;
      for (let ring = 1; ring <= 5; ring++) {
        ctx.strokeStyle = `rgba(185, 76, 255, ${0.32 - ring * 0.05})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, ring * 26 + Math.sin(timeSec * 3 + ring) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Far Parallax Mountains / Hokage Rock / Amegakure Towers
    ctx.fillStyle = theme.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 160; x += 80) {
      const worldX = x + camX * 0.15;
      const peak = Math.sin(worldX * 0.0035) * 95 + Math.cos(worldX * 0.008) * 45;
      ctx.lineTo(x, 360 - peak);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Mid Parallax Ninja Pagoda Silhouettes / Giant Trees
    ctx.fillStyle = theme.mountainNear;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 120; x += 60) {
      const worldX = x + camX * 0.32;
      const h = Math.sin(worldX * 0.006 + 1.2) * 65 + Math.cos(worldX * 0.015) * 30;
      ctx.lineTo(x, 435 - h);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  drawDecorations(ctx, world, stage, timeSec) {
    for (const dec of world.decorations) {
      if (dec.kind === "torii") {
        // Traditional Red Ninja Torii Gate
        ctx.save();
        ctx.fillStyle = "#d90429";
        ctx.fillRect(dec.x + 12, dec.y - 130, 12, 130);
        ctx.fillRect(dec.x + 86, dec.y - 130, 12, 130);
        ctx.fillRect(dec.x - 6, dec.y - 136, 122, 14);
        ctx.fillStyle = "#1b1b2f";
        ctx.fillRect(dec.x - 12, dec.y - 144, 134, 9);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(dec.x + 48, dec.y - 132, 14, 22);
        ctx.restore();
      } else if (dec.kind === "lantern") {
        ctx.save();
        ctx.fillStyle = "#6c757d";
        ctx.fillRect(dec.x + 10, dec.y - 54, 18, 54);
        ctx.fillRect(dec.x + 2, dec.y - 66, 34, 12);
        ctx.fillStyle = stage.theme.accentGlow;
        ctx.shadowColor = stage.theme.accentGlow;
        ctx.shadowBlur = 14;
        ctx.fillRect(dec.x + 12, dec.y - 46, 14, 16);
        ctx.restore();
      }
    }

    // Draw Giant Boss Gate Torii at stage.bossGateX
    const gx = stage.bossGateX;
    const gy = stage.groundY;
    ctx.save();
    ctx.fillStyle = "#9d0208";
    ctx.fillRect(gx, gy - 220, 22, 220);
    ctx.fillRect(gx + 140, gy - 220, 22, 220);
    ctx.fillStyle = "#dc2f02";
    ctx.fillRect(gx - 24, gy - 235, 210, 24);
    ctx.fillStyle = "#ffba08";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⛩️ 頭目決戰結界 BOSS ARENA ⛩️", gx + 81, gy - 246 + Math.sin(timeSec * 4) * 3);
    ctx.restore();
  }

  drawPlatforms(ctx, platforms, theme, camX, W, timeSec) {
    for (const p of platforms) {
      if (p.x + p.w < camX - 100 || p.x > camX + W + 100) continue;

      if (p.kind === "ground") {
        // Soil body
        const soilGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
        soilGrad.addColorStop(0, theme.groundSoil);
        soilGrad.addColorStop(1, "#09080d");
        ctx.fillStyle = soilGrad;
        ctx.fillRect(p.x, p.y, p.w, p.h);

        // Glowing anime top grass/stone trim
        ctx.fillStyle = theme.groundTop;
        ctx.fillRect(p.x, p.y, p.w, 12);

        // Brick/tile pattern lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        const startTile = Math.max(p.x, Math.floor(camX / 48) * 48);
        const endTile = Math.min(p.x + p.w, camX + W);
        for (let tx = startTile; tx < endTile; tx += 48) {
          ctx.strokeRect(tx, p.y + 12, 48, 36);
        }
      } else {
        // Pagoda / Moving Chakra Platform
        ctx.save();
        const isMoving = p.kind === "moving";
        ctx.fillStyle = isMoving ? "#3a0ca3" : "#2b2d42";
        ctx.fillRect(p.x, p.y, p.w, p.h);

        ctx.fillStyle = isMoving ? "#4cc9f0" : theme.groundTop;
        ctx.fillRect(p.x - 4, p.y, p.w + 8, 7);

        if (isMoving) {
          ctx.shadowColor = "#4cc9f0";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#90e0ef";
          ctx.fillRect(p.x + 8, p.y + 10, p.w - 16, 4);
        }
        ctx.restore();
      }
    }
  }

  drawBlocks(ctx, blocks, camX, W, timeSec) {
    for (const b of blocks) {
      if (b.x + b.w < camX - 80 || b.x > camX + W + 80) continue;
      ctx.save();
      const bounceY = b.bumpOffset || 0;
      const bx = b.x;
      const by = b.y + bounceY;

      if (b.hit) {
        ctx.fillStyle = "#343a40";
        ctx.strokeStyle = "#adb5bd";
        ctx.lineWidth = 2;
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.strokeRect(bx, by, b.w, b.h);
      } else if (b.kind === "star_block") {
        // Golden Nine-Tails Star Shrine Block
        const pulse = 0.7 + Math.sin(timeSec * 6) * 0.3;
        ctx.shadowColor = "#ffd43b";
        ctx.shadowBlur = 14 * pulse;
        const grad = ctx.createLinearGradient(bx, by, bx + b.w, by + b.h);
        grad.addColorStop(0, "#ffbe0b");
        grad.addColorStop(0.5, "#fb5607");
        grad.addColorStop(1, "#ff006e");
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.strokeStyle = "#fff3b0";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx + 1, by + 1, b.w - 2, b.h - 2);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", bx + b.w / 2, by + b.h / 2 + 1);
      } else if (b.kind === "question") {
        // Chakra Scroll ? Block (spawns Mushroom or Coin)
        const grad = ctx.createLinearGradient(bx, by, bx, by + b.h);
        grad.addColorStop(0, "#ff9f1c");
        grad.addColorStop(1, "#e76f51");
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, b.w - 2, b.h - 2);

        ctx.fillStyle = "#fff";
        ctx.font = "900 20px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", bx + b.w / 2, by + b.h / 2 + 1);
      } else {
        // Ninja Seal Brick
        ctx.fillStyle = "#7f4f24";
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.strokeStyle = "#b08968";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 1, by + 1, b.w - 2, b.h - 2);
      }
      ctx.restore();
    }
  }

  drawCoinsAndItems(ctx, coins, items, camX, W, timeSec) {
    // Ryo Coins
    for (const c of coins) {
      if (c.collected || c.x < camX - 50 || c.x > camX + W + 50) continue;
      ctx.save();
      const scaleX = Math.max(0.25, Math.abs(Math.cos(timeSec * 4 + c.x * 0.02)));
      ctx.translate(c.x, c.y);
      ctx.scale(scaleX, 1);
      ctx.fillStyle = "#ffd43b";
      ctx.shadowColor = "#ffd43b";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff3b0";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Spawned Power-ups: Chakra Mushroom & Invincibility Star
    for (const item of items) {
      ctx.save();
      const cx = item.x + item.w / 2;
      const cy = item.y + item.h / 2;
      if (item.kind === "mushroom") {
        // Sage Chakra Mushroom (unlocks Rasengan Light Sphere!)
        ctx.shadowColor = "#2de2ff";
        ctx.shadowBlur = 14;
        // Stem
        ctx.fillStyle = "#ffe5ec";
        ctx.fillRect(cx - 9, cy, 18, 14);
        // Cap
        ctx.fillStyle = "#00bbf9";
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 16, Math.PI, 0, false);
        ctx.fill();
        // Swirl spots
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx - 7, cy - 5, 4, 0, Math.PI * 2);
        ctx.arc(cx + 7, cy - 5, 4, 0, Math.PI * 2);
        ctx.arc(cx, cy - 10, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === "star") {
        // Nine-Tails Invincibility Star (transforms Naruto into Kurama Mode + 3 Bijuudama!)
        ctx.translate(cx, cy);
        ctx.rotate(timeSec * 5);
        ctx.shadowColor = "#ffd43b";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#ffd43b";
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const innerAngle = outerAngle + Math.PI / 5;
          ctx.lineTo(Math.cos(outerAngle) * 18, Math.sin(outerAngle) * 18);
          ctx.lineTo(Math.cos(innerAngle) * 8, Math.sin(innerAngle) * 8);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ff006e";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * Renders High-Detail 2-Head-Tall Q-Version Anime Naruto (Nendoroid / Chibi Scale)
   * Designed so Naruto's facial features (dual anime eyes, Konoha leaf symbol headband,
   * side-locks, 6 cheek whiskers, toothy grin, and Nine-Tails Kurama slit eyes + fangs + fox ears)
   * are crystal-clear and immediately recognizable in both Normal and Nine-Tails forms.
   */
  drawQChibiNaruto(ctx, player, timeSec) {
    ctx.save();
    const footX = player.x + player.w / 2;
    const footY = player.y + player.h;
    const isKurama = player.kuramaTimer > 0;
    const hasRasengan = player.hasRasengan || isKurama;

    // 1. Back-Layer Chakra Halo & 9 Outlined Articulated Kurama Fox Tails (Drawn BEHIND body/face!)
    if (isKurama) {
      ctx.save();
      // Outer golden-crimson halo behind torso (never washes out the face)
      const haloGrad = ctx.createRadialGradient(footX, footY - 38, 10, footX, footY - 38, 72);
      haloGrad.addColorStop(0, "rgba(255, 180, 0, 0.48)");
      haloGrad.addColorStop(0.6, "rgba(255, 60, 20, 0.28)");
      haloGrad.addColorStop(1, "rgba(255, 0, 60, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(footX, footY - 38, 72, 0, Math.PI * 2);
      ctx.fill();

      // 9 Distinct Outlined Nine-Tails Fox Tails fanning UPWARD and BEHIND Naruto
      for (let t = 0; t < 9; t++) {
        const frac = t / 8; // 0 (lowest tail behind waist) .. 1 (highest tail behind crown)
        const wave = Math.sin(timeSec * 7.5 + t * 0.7) * 0.06;
        // In local behind-up space: dx goes negative (behind player.facing), dy goes negative (upward)
        const elevationAngle = (0.08 + frac * 0.42 + wave) * Math.PI; // 14 deg to 90 deg upward
        const tailLen = 58 + (t % 2) * 10 + (player.isChargingBijuudama ? 10 : 0);

        const startX = footX - player.facing * 8;
        const startY = footY - 26;
        const ctrlX = startX - player.facing * Math.cos(elevationAngle * 0.85) * (tailLen * 0.62);
        const ctrlY = startY - Math.sin(elevationAngle * 0.85) * (tailLen * 0.62) - 10;
        const tipX = startX - player.facing * Math.cos(elevationAngle) * tailLen;
        const tipY = startY - Math.sin(elevationAngle) * tailLen;

        // Dark crimson anime ink outline for each tail
        ctx.strokeStyle = "#4a0404";
        ctx.lineWidth = 13.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
        ctx.stroke();

        // Inner blazing orange-gold tail fill
        ctx.strokeStyle = t % 2 === 0 ? "#ff9e00" : "#ff5400";
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
        ctx.stroke();

        // Bright golden chakra core streak
        ctx.strokeStyle = "#fff3b0";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
        ctx.stroke();
      }
      ctx.restore();
    } else if (hasRasengan) {
      // Subtle cyan wind-chakra ring behind body when Mushroom powered-up
      ctx.save();
      const aura = ctx.createRadialGradient(footX, footY - 36, 8, footX, footY - 36, 48);
      aura.addColorStop(0, "rgba(45, 226, 255, 0.28)");
      aura.addColorStop(1, "rgba(45, 226, 255, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(footX, footY - 36, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Invulnerability blink
    if (player.invulnTimer > 0 && Math.floor(timeSec * 20) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Transform to local character space anchored at feet (footX, footY)
    ctx.translate(footX, footY);
    ctx.scale(player.facing, 1);

    const isMoving = Math.abs(player.vx) > 15;
    const runSwing = isMoving ? Math.sin(timeSec * 16) * 7 : 0;
    const bodyBob = isMoving ? Math.abs(Math.cos(timeSec * 16)) * 2.5 : Math.sin(timeSec * 4) * 1.2;

    // 2. Flowing Konoha Headband Cloth Tails (behind head)
    ctx.save();
    ctx.fillStyle = isKurama ? "#ff9e00" : "#1d3557";
    ctx.strokeStyle = "#111622";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, -54 - bodyBob);
    ctx.quadraticCurveTo(
      -34,
      -60 - bodyBob + Math.sin(timeSec * 12) * 5,
      -44,
      -48 - bodyBob + Math.cos(timeSec * 12) * 4
    );
    ctx.lineTo(-38, -40 - bodyBob);
    ctx.quadraticCurveTo(-26, -46 - bodyBob, -15, -47 - bodyBob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Chibi Legs, White Shinobi Ankle Wraps & Blue Ninja Sandals
    ctx.save();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#141824";

    // Left (back) leg
    const legLX = -12 + runSwing * 0.55;
    ctx.fillStyle = isKurama ? "#ff9e00" : "#ff6d00";
    ctx.beginPath();
    ctx.roundRect(legLX, -20, 11, 14, 3);
    ctx.fill();
    ctx.stroke();
    // White ankle bandage
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(legLX + 1, -9, 9, 4);
    // Blue sandal
    ctx.fillStyle = isKurama ? "#d00000" : "#1d3557";
    ctx.beginPath();
    ctx.roundRect(legLX - 1, -6, 14, 6, 2);
    ctx.fill();
    ctx.stroke();

    // Right (front) leg
    const legRX = 2 - runSwing * 0.55;
    ctx.fillStyle = isKurama ? "#ffb703" : "#ff7b1c";
    ctx.beginPath();
    ctx.roundRect(legRX, -20, 11, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(legRX + 1, -9, 9, 4);
    ctx.fillStyle = isKurama ? "#d00000" : "#1d3557";
    ctx.beginPath();
    ctx.roundRect(legRX - 1, -6, 14, 6, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 4. Chibi Torso (Iconic Orange/Black Uzumaki Jacket or Golden Six-Paths Kurama Cloak)
    ctx.save();
    ctx.translate(0, -bodyBob);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#141824";
    ctx.fillStyle = isKurama ? "#ffd43b" : "#ff7b1c";
    ctx.beginPath();
    ctx.roundRect(-16, -38, 32, 22, 7);
    ctx.fill();
    ctx.stroke();

    // Black Shoulder Yoke
    ctx.fillStyle = "#181d2a";
    ctx.beginPath();
    ctx.roundRect(-15, -37, 30, 8, 4);
    ctx.fill();

    if (isKurama) {
      // Six-Paths Black Magatama Marks across chest + Kurama seal lines
      ctx.fillStyle = "#111111";
      for (let m = -9; m <= 9; m += 6) {
        ctx.beginPath();
        ctx.arc(m, -29, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#d00000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -23, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // High White Zipper Collar & Red Uzumaki Crest
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(-12, -40, 24, 4);
      ctx.strokeStyle = "#ced4da";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -37);
      ctx.lineTo(0, -17);
      ctx.stroke();

      ctx.fillStyle = "#e63946";
      ctx.beginPath();
      ctx.arc(-6, -25, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Left (Back) Arm & Right (Front) Arm
    ctx.fillStyle = isKurama ? "#ffd43b" : "#ff7b1c";
    ctx.strokeStyle = "#141824";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(10, -33, 12, 8, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffdcc2";
    ctx.beginPath();
    ctx.arc(23, -29, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // =========================================================================
    // 5. OVERSIZED 3/4-VIEW Q-ANIME NARUTO HEAD & FACE (Unmistakably Naruto!)
    // =========================================================================
    ctx.save();
    const headY = -58 - bodyBob;
    ctx.translate(2, headY);

    // 5A. Back & Crown Spiky Golden Hair (with Nine-Tails Fox-Ear Chakra Horns in Kurama Mode!)
    const spikeWave = isKurama ? Math.sin(timeSec * 12) * 2.5 : 0;
    ctx.fillStyle = isKurama ? "#fff352" : "#ffd43b";
    ctx.strokeStyle = isKurama ? "#b51700" : "#2b1d0e";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.lineTo(-30, -12 - spikeWave);
    ctx.lineTo(-21, -15);
    // Left Fox-Ear / Hair Spike
    ctx.lineTo(-27, -29 - (isKurama ? 8 : 0) - spikeWave);
    ctx.lineTo(-13, -22);
    // Center-Left Tall Spike
    ctx.lineTo(-14, -36 - (isKurama ? 6 : 0) - spikeWave);
    ctx.lineTo(-4, -24);
    // Center Main Naruto Spike
    ctx.lineTo(2, -39 - (isKurama ? 7 : 0) - spikeWave);
    ctx.lineTo(9, -24);
    // Center-Right Spike
    ctx.lineTo(18, -35 - (isKurama ? 8 : 0) - spikeWave);
    ctx.lineTo(17, -21);
    // Right Outer Spike
    ctx.lineTo(29, -25 - (isKurama ? 5 : 0) - spikeWave);
    ctx.lineTo(22, -11);
    ctx.lineTo(27, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // If in Nine-Tails Kurama Mode, draw the distinct Crimson-Orange Fox Ear Inner Triangles!
    if (isKurama) {
      ctx.fillStyle = "#ff4d00";
      ctx.beginPath();
      ctx.moveTo(-24, -33 - spikeWave);
      ctx.lineTo(-19, -22);
      ctx.lineTo(-14, -24);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(16, -38 - spikeWave);
      ctx.lineTo(11, -24);
      ctx.lineTo(17, -23);
      ctx.closePath();
      ctx.fill();
    }

    // 5B. Anime Face Contour (Wide, expressive Chibi 3/4 Face: 44px wide x 38px tall)
    ctx.fillStyle = isKurama ? "#ffe6ba" : "#ffd8be";
    ctx.strokeStyle = isKurama ? "#7a1c00" : "#2b1d14";
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.ellipse(0, 2, 22, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Soft anime cheek blush
    ctx.fillStyle = isKurama ? "rgba(255, 80, 40, 0.28)" : "rgba(255, 130, 120, 0.25)";
    ctx.beginPath();
    ctx.ellipse(-11, 6, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(13, 6, 5.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5C. Konoha Forehead Protector (Headband + Silver Plate + Konoha Leaf Spiral Symbol!)
    ctx.fillStyle = isKurama ? "#24162b" : "#1d3557";
    ctx.strokeStyle = "#0f141c";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-22, -16, 44, 11, 4);
    ctx.fill();
    ctx.stroke();

    // Metallic Forehead Plate
    const plateGrad = ctx.createLinearGradient(-14, -15, 16, -6);
    plateGrad.addColorStop(0, isKurama ? "#ffe066" : "#f8f9fa");
    plateGrad.addColorStop(0.5, isKurama ? "#fab005" : "#dee2e6");
    plateGrad.addColorStop(1, isKurama ? "#f08c00" : "#adb5bd");
    ctx.fillStyle = plateGrad;
    ctx.strokeStyle = "#212529";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-13, -15, 28, 9, 2.5);
    ctx.fill();
    ctx.stroke();

    // Engraved Konoha Leaf Spiral Symbol in the center of the forehead plate!
    ctx.strokeStyle = "#111622";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(1, -10.5, 2.8, 0, Math.PI * 1.65);
    ctx.lineTo(5.5, -12.5);
    ctx.lineTo(3.2, -8.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2.2, -10.5);
    ctx.lineTo(-4.8, -9.2);
    ctx.stroke();

    // 5D. Naruto's Signature Golden Side-Locks (雙側鬢角垂髮 hanging in front of ears!)
    ctx.fillStyle = isKurama ? "#fff352" : "#ffd43b";
    ctx.strokeStyle = "#2b1d0e";
    ctx.lineWidth = 1.8;
    // Left side-lock
    ctx.beginPath();
    ctx.moveTo(-22, -6);
    ctx.lineTo(-25, 8);
    ctx.lineTo(-18, 4);
    ctx.lineTo(-17, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right side-lock
    ctx.beginPath();
    ctx.moveTo(18, -6);
    ctx.lineTo(22, 7);
    ctx.lineTo(25, 2);
    ctx.lineTo(22, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5E. TWO Big Expressive Anime Eyes (3/4 View: Left Eye at x=-7, Right Eye at x=+8.5)
    const eyePositions = [
      { ex: -7.5, ey: 0.5, rx: 4.3, ry: 5.2 },
      { ex: 8.5, ey: 0.5, rx: 4.8, ry: 5.5 }
    ];

    for (const ep of eyePositions) {
      // In Nine-Tails Mode: Orange-Crimson Kurama pigmentation ring around each eye!
      if (isKurama) {
        ctx.fillStyle = "rgba(217, 4, 41, 0.38)";
        ctx.beginPath();
        ctx.ellipse(ep.ex, ep.ey, ep.rx + 2.2, ep.ry + 2.0, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // White Sclera
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#111622";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(ep.ex, ep.ey, ep.rx, ep.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isKurama) {
        // Nine-Tails Transformation: Glowing Crimson-Red Iris + Vertical Black Fox Slit Pupil!
        ctx.fillStyle = "#ff0a54";
        ctx.beginPath();
        ctx.ellipse(ep.ex + 0.6, ep.ey, ep.rx * 0.72, ep.ry * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();

        // Vertical Fox Slit Pupil
        ctx.fillStyle = "#090004";
        ctx.beginPath();
        ctx.ellipse(ep.ex + 0.7, ep.ey, 1.25, ep.ry * 0.68, 0, 0, Math.PI * 2);
        ctx.fill();

        // Fierce golden catchlight
        ctx.fillStyle = "#fff3b0";
        ctx.beginPath();
        ctx.arc(ep.ex - 0.8, ep.ey - 1.8, 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Classic Uzumaki Naruto: Deep Ocean-Blue Iris + Bright Cyan Crescent + Dual Catchlights!
        ctx.fillStyle = "#0077b6";
        ctx.beginPath();
        ctx.ellipse(ep.ex + 0.6, ep.ey, ep.rx * 0.72, ep.ry * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#48cae4";
        ctx.beginPath();
        ctx.arc(ep.ex + 0.6, ep.ey + 1.2, ep.rx * 0.48, 0, Math.PI);
        ctx.fill();

        // Dark Navy Pupil
        ctx.fillStyle = "#03045e";
        ctx.beginPath();
        ctx.arc(ep.ex + 0.7, ep.ey, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Sparkling White Anime Catchlights
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ep.ex - 0.8, ep.ey - 1.8, 1.5, 0, Math.PI * 2);
        ctx.arc(ep.ex + 1.6, ep.ey + 1.4, 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bold Black Upper Eyelash & Determined Golden Eyebrow
      ctx.strokeStyle = "#111622";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(ep.ex, ep.ey - 0.5, ep.rx + 0.3, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();

      ctx.strokeStyle = isKurama ? "#d00000" : "#b07d12";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (ep.ex < 0) {
        ctx.moveTo(ep.ex - 4, ep.ey - 6.8);
        ctx.lineTo(ep.ex + 3.5, ep.ey - 5.2);
      } else {
        ctx.moveTo(ep.ex - 3.5, ep.ey - 5.2);
        ctx.lineTo(ep.ex + 4.5, ep.ey - 6.8);
      }
      ctx.stroke();
    }

    // 5F. ICONIC 3 WHISKER MARKS ON BOTH CHEEKS (6 Total Whiskers — Thickened in Nine-Tails Mode!)
    ctx.strokeStyle = isKurama ? "#2b0000" : "#4a2c18";
    ctx.lineWidth = isKurama ? 2.4 : 1.7;
    ctx.lineCap = "round";
    for (let w = 0; w < 3; w++) {
      const wy = 4.5 + w * 3.1;
      // Left Cheek 3 Whiskers
      ctx.beginPath();
      ctx.moveTo(-19, wy - 0.5);
      ctx.lineTo(-11.5, wy + 0.4);
      ctx.stroke();

      // Right Cheek 3 Whiskers
      ctx.beginPath();
      ctx.moveTo(12.5, wy + 0.4);
      ctx.lineTo(20, wy - 0.5);
      ctx.stroke();
    }

    // 5G. Cute Anime Nose & Confident Smile / Nine-Tails Fangs!
    ctx.fillStyle = "#d99b78";
    ctx.beginPath();
    ctx.arc(1, 4.5, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Mouth: Confident Wide Grin (with 2 sharp canine fangs in Nine-Tails Kurama Mode!)
    ctx.fillStyle = "#9d0208";
    ctx.strokeStyle = "#2b1d14";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5.5, 9.5);
    ctx.quadraticCurveTo(1, 15.5, 7.5, 9.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (isKurama) {
      // Sharp White Nine-Tails Canine Fangs at both corners of the mouth!
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-4.2, 9.8);
      ctx.lineTo(-2.5, 13.2);
      ctx.lineTo(-1.0, 9.8);
      ctx.moveTo(2.8, 9.8);
      ctx.lineTo(4.3, 13.2);
      ctx.lineTo(5.8, 9.8);
      ctx.closePath();
      ctx.fill();
    } else {
      // Cheerful Naruto white upper teeth grin ("Dattebayo!")
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-3.8, 9.6, 9.2, 2.2);
    }

    ctx.restore(); // End Head & Face

    // 6. Extended Right Hand Holding Swirling Rasengan (Well in front of body, never covering face!)
    if (hasRasengan && !player.isChargingBijuudama) {
      const handX = 28;
      const handY = -28 - bodyBob;
      const rGrad = ctx.createRadialGradient(handX, handY, 2, handX, handY, 13);
      rGrad.addColorStop(0, "#ffffff");
      rGrad.addColorStop(0.45, "#2de2ff");
      rGrad.addColorStop(1, "rgba(0, 180, 216, 0)");
      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.arc(handX, handY, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(handX, handY, 6, timeSec * 18, timeSec * 18 + 2.2);
      ctx.stroke();
    }

    // 7. 3-Second Tailed Beast Bomb (Bijuudama) Charging Sphere (Held forward at x=+56 so Face is 100% clear!)
    if (player.isChargingBijuudama) {
      const progress = Math.min(1, player.chargeTime / 3.0);
      const orbX = 56;
      const orbY = -36 - bodyBob;
      const orbRadius = 10 + progress * 28;

      // Positive (Red) & Negative (Blue) Chakra Beads spiraling inward
      for (let b = 0; b < 10; b++) {
        const a = timeSec * 10 + (b * Math.PI * 2) / 10;
        const dist = (1 - ((timeSec * 2.5 + b * 0.1) % 1)) * 44;
        const bx = orbX + Math.cos(a) * dist;
        const by = orbY + Math.sin(a) * dist;
        ctx.fillStyle = b % 2 === 0 ? "#ff2a85" : "#2de2ff";
        ctx.beginPath();
        ctx.arc(bx, by, 3.0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dense Black-Purple Bijuudama Core
      const bGrad = ctx.createRadialGradient(orbX, orbY, 3, orbX, orbY, orbRadius * 1.35);
      bGrad.addColorStop(0, "#ffffff");
      bGrad.addColorStop(0.22, "#19002e");
      bGrad.addColorStop(0.65, "#9d4edd");
      bGrad.addColorStop(0.88, "#ff006e");
      bGrad.addColorStop(1, "rgba(255, 0, 110, 0)");
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(orbX, orbY, orbRadius * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Overhead 3.0s Charge Ring & Timer Label (High above HP bar at y = -126)
      ctx.save();
      ctx.scale(player.facing, 1);
      ctx.strokeStyle = progress >= 1 ? "#ffd43b" : "#ff2a85";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -126, 15, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = progress >= 1 ? "#ffd43b" : "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.font = "900 13px sans-serif";
      ctx.textAlign = "center";
      const label = progress >= 1 ? "尾獸彈滿載！" : `尾獸彈集氣 ${player.chargeTime.toFixed(1)}s / 3.0s`;
      ctx.strokeText(label, 0, -148);
      ctx.fillText(label, 0, -148);
      ctx.restore();
    }

    // 8. Overhead Naruto Player HP Bar (Directly above spiky hair crown so HP is always visible in action!)
    ctx.save();
    ctx.scale(player.facing, 1);
    const maxHp = player.maxHp || 100;
    const curHp = typeof player.hp === "number" ? player.hp : 100;
    const hpRatio = Math.max(0, Math.min(1, curHp / maxHp));
    const barW = 54;
    const barH = 8;
    const barX = -barW / 2;
    const barY = -98 - bodyBob * 0.5;

    // Dark capsule track
    ctx.fillStyle = "rgba(8, 12, 22, 0.88)";
    ctx.strokeStyle = isKurama ? "#ffd43b" : "#111622";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();
    ctx.stroke();

    // HP Fill
    if (hpRatio > 0) {
      if (isKurama) {
        ctx.fillStyle = "#ffd43b";
      } else if (hpRatio <= 0.3) {
        ctx.fillStyle = "#ff2a55";
      } else if (hpRatio <= 0.6) {
        ctx.fillStyle = "#ffb703";
      } else {
        ctx.fillStyle = "#38ef7d";
      }
      ctx.beginPath();
      ctx.roundRect(barX + 1.5, barY + 1.5, (barW - 3) * hpRatio, barH - 3, 3);
      ctx.fill();
    }

    // Crisp HP Numeric Label above bar
    ctx.font = "900 10.5px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.8;
    const hpLabel = isKurama ? `🦊無敵 ${curHp}/${maxHp}` : `HP ${curHp}/${maxHp}`;
    ctx.fillStyle = isKurama ? "#ffe94d" : hpRatio <= 0.3 ? "#ff8aa1" : "#ffffff";
    ctx.strokeText(hpLabel, 0, barY - 3);
    ctx.fillText(hpLabel, 0, barY - 3);
    ctx.restore();

    ctx.restore();
  }

  drawEnemies(ctx, enemies, camX, W, timeSec) {
    for (const e of enemies) {
      if (e.dead || e.x + e.w < camX - 80 || e.x > camX + W + 80) continue;
      ctx.save();
      const cx = e.x + e.w / 2;
      const cy = e.y + e.h / 2;

      if (e.hurtFlash > 0) {
        ctx.filter = "brightness(2.4)";
      }

      ctx.translate(cx, cy);
      ctx.scale(e.facing, 1);

      // Enemy Silhouette by Strength Tier (1..4)
      ctx.fillStyle = e.colorSecondary;
      ctx.beginPath();
      ctx.roundRect(-e.w / 2, -e.h / 2 + 10, e.w, e.h - 10, 6);
      ctx.fill();

      // Armor / Cloak trim
      ctx.fillStyle = e.colorPrimary;
      ctx.fillRect(-e.w / 2 + 2, -2, e.w - 4, 8);

      // Head
      ctx.fillStyle = e.tier === 4 ? "#80ed99" : "#e0afa0";
      ctx.beginPath();
      ctx.arc(0, -e.h / 2 + 10, 11 + e.tier, 0, Math.PI * 2);
      ctx.fill();

      // Glowing hostile eyes
      ctx.fillStyle = "#ff0055";
      ctx.fillRect(3, -e.h / 2 + 7, 5, 3);

      ctx.scale(e.facing, 1); // unflip for HP pips

      // Render Required Rasengan Shots / HP Pips above every enemy!
      const pipW = 8;
      const gap = 3;
      const totalW = e.maxHp * pipW + (e.maxHp - 1) * gap;
      let startX = -totalW / 2;
      const pipY = -e.h / 2 - 12;

      for (let i = 0; i < e.maxHp; i++) {
        ctx.fillStyle = i < e.hp ? "#2de2ff" : "rgba(255, 255, 255, 0.2)";
        ctx.strokeStyle = "#0b132b";
        ctx.lineWidth = 1;
        ctx.fillRect(startX + i * (pipW + gap), pipY, pipW, 5);
        ctx.strokeRect(startX + i * (pipW + gap), pipY, pipW, 5);
      }

      ctx.restore();
    }
  }

  drawBoss(ctx, boss, timeSec) {
    ctx.save();
    const bw = boss.w || boss.width || 80;
    const bh = boss.h || boss.height || 92;
    const cx = boss.x + bw / 2;
    const cy = boss.y + bh / 2;

    // Boss menacing chakra aura
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(cx, cy, 12, cx, cy, 82);
    aura.addColorStop(0, boss.auraColor);
    aura.addColorStop(0.55, boss.primaryColor);
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.55 + Math.sin(timeSec * 6) * 0.15;
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, 82, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (boss.hurtFlash > 0) {
      ctx.filter = "brightness(2.5)";
    }

    ctx.translate(cx, cy);
    ctx.scale(boss.facing, 1);

    // Boss Body Armor / Akatsuki Cloak
    ctx.fillStyle = "#141624";
    ctx.beginPath();
    ctx.roundRect(-boss.w / 2, -boss.h / 2 + 18, boss.w, boss.h - 18, 10);
    ctx.fill();

    ctx.strokeStyle = boss.primaryColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(-boss.w / 2 + 2, -boss.h / 2 + 20, boss.w - 4, boss.h - 22);

    // Boss Signature Weapon / Visual Feature
    if (boss.id === "zabuza") {
      // Giant Kubikiribocho Executioner's Blade
      ctx.fillStyle = "#adb5bd";
      ctx.fillRect(14, -48, 18, 86);
      ctx.fillStyle = "#141624";
      ctx.beginPath();
      ctx.arc(14, -10, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (boss.id === "orochimaru") {
      // Eight-Branches White Serpent Heads coiling behind Orochimaru
      ctx.strokeStyle = "#f8f9fa";
      ctx.lineWidth = 7;
      for (let s = 0; s < 4; s++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          -35,
          -30 - s * 12,
          28 + Math.cos(timeSec * 5 + s) * 14,
          -42 + s * 14
        );
        ctx.stroke();
      }
    } else {
      // Pain Tendo: Six Paths Rinnegan Rings & Floating Black Chakra Receivers
      for (let r = 0; r < 4; r++) {
        const angle = timeSec * 3 + (r * Math.PI) / 2;
        ctx.fillStyle = "#0b090a";
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 1.5;
        ctx.save();
        ctx.translate(Math.cos(angle) * 48, Math.sin(angle) * 36);
        ctx.rotate(angle);
        ctx.fillRect(-3, -16, 6, 32);
        ctx.strokeRect(-3, -16, 6, 32);
        ctx.restore();
      }
    }

    // Boss Head
    ctx.fillStyle = "#f1dca7";
    ctx.beginPath();
    ctx.arc(0, -boss.h / 2 + 18, 20, 0, Math.PI * 2);
    ctx.fill();

    // Boss Eyes
    ctx.fillStyle = boss.id === "pain" ? "#b5179e" : "#ff0055";
    ctx.beginPath();
    ctx.arc(7, -boss.h / 2 + 16, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawProjectiles(ctx, projectiles, enemyProjectiles, timeSec) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const p of projectiles) {
      if (p.kind === "rasengan") {
        // Straight-flying Rasengan Light Sphere (螺旋丸光彈)
        const rGrad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 1.9);
        rGrad.addColorStop(0, "#ffffff");
        rGrad.addColorStop(0.35, "#7ef4ff");
        rGrad.addColorStop(0.7, "#00b4d8");
        rGrad.addColorStop(1, "rgba(0, 180, 216, 0)");
        ctx.fillStyle = rGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 1.9, 0, Math.PI * 2);
        ctx.fill();

        // High-speed internal spiral arcs
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        for (let a = 0; a < 3; a++) {
          const startAngle = timeSec * 22 + (a * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.78, startAngle, startAngle + 1.35);
          ctx.stroke();
        }
      } else if (p.kind === "bijuudama") {
        // Colossal Tailed Beast Bomb (尾獸彈)
        const bGrad = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r * 2.2);
        bGrad.addColorStop(0, "#ffffff");
        bGrad.addColorStop(0.2, "#10002b");
        bGrad.addColorStop(0.55, "#7b2cbf");
        bGrad.addColorStop(0.82, "#ff006e");
        bGrad.addColorStop(1, "rgba(255, 212, 59, 0)");
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Golden lightning rings around Bijuudama
        ctx.strokeStyle = "#ffd43b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1.1 + Math.sin(timeSec * 30) * 0.15), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Enemy / Boss Jutsu Projectiles
    for (const ep of enemyProjectiles) {
      const eGrad = ctx.createRadialGradient(ep.x, ep.y, 2, ep.x, ep.y, ep.r * 1.6);
      eGrad.addColorStop(0, "#ffffff");
      eGrad.addColorStop(0.5, ep.color || "#ff2a85");
      eGrad.addColorStop(1, "rgba(255, 0, 85, 0)");
      ctx.fillStyle = eGrad;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.r * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawParticlesOnly(ctx, particles) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const pt of particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = alpha * 0.78;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFloatingTextsOnly(ctx, floatingTexts) {
    for (const ft of floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.size || 16}px sans-serif`;
      ctx.fillStyle = ft.color || "#ffd43b";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3.5;
      ctx.textAlign = "center";
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  drawWeatherAndScreenEffects(ctx, W, H, theme, state, timeSec, dt) {
    // Weather particles
    ctx.save();
    for (const wp of this.weatherParticles) {
      wp.x += wp.vx * dt;
      wp.y += wp.vy * dt;
      if (wp.x < 0) wp.x += W;
      if (wp.y > H) wp.y -= H;

      if (theme.weatherType === "leaves") {
        ctx.fillStyle = "rgba(255, 183, 197, 0.65)";
        ctx.beginPath();
        ctx.ellipse(wp.x, wp.y, wp.size, wp.size * 0.55, timeSec * 2 + wp.phase, 0, Math.PI * 2);
        ctx.fill();
      } else if (theme.weatherType === "embers") {
        ctx.fillStyle = "rgba(247, 37, 133, 0.7)";
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(144, 224, 239, 0.42)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wp.x, wp.y);
        ctx.lineTo(wp.x - 6, wp.y + 16);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Screen-Wide Bijuudama Shockwave Dome Effect!
    if (state.bijuudamaFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const grad = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.75);
      grad.addColorStop(0, `rgba(255, 255, 255, ${state.bijuudamaFlash})`);
      grad.addColorStop(0.45, `rgba(185, 76, 255, ${state.bijuudamaFlash * 0.85})`);
      grad.addColorStop(0.8, `rgba(255, 212, 59, ${state.bijuudamaFlash * 0.6})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  drawAvatarPortrait(actx, player, timeSec) {
    const W = actx.canvas ? actx.canvas.width : 72;
    const H = actx.canvas ? actx.canvas.height : 72;
    actx.clearRect(0, 0, W, H);
    const isKurama = player.kuramaTimer > 0;
    actx.save();
    actx.translate(W / 2, H / 2 + 6);

    // Background chakra ring in Kurama mode
    if (isKurama) {
      const bgGlow = actx.createRadialGradient(0, -4, 6, 0, -4, 34);
      bgGlow.addColorStop(0, "rgba(255, 212, 59, 0.65)");
      bgGlow.addColorStop(0.7, "rgba(255, 77, 0, 0.35)");
      bgGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      actx.fillStyle = bgGlow;
      actx.beginPath();
      actx.arc(0, -4, 34, 0, Math.PI * 2);
      actx.fill();
    }

    // Spiky Golden Hair + Kurama Fox-Ear Chakra Horns
    actx.fillStyle = isKurama ? "#ffe94d" : "#ffd43b";
    actx.strokeStyle = isKurama ? "#9a2b00" : "#5c3d00";
    actx.lineWidth = 2;
    actx.beginPath();
    actx.moveTo(-22, -6);
    actx.lineTo(-30, -16);
    actx.lineTo(-20, -19);
    if (isKurama) {
      actx.lineTo(-24, -36); // Left Fox-Ear Horn
      actx.lineTo(-10, -24);
      actx.lineTo(0, -34);
      actx.lineTo(10, -24);
      actx.lineTo(24, -36);  // Right Fox-Ear Horn
    } else {
      actx.lineTo(-22, -31);
      actx.lineTo(-11, -22);
      actx.lineTo(-4, -34);
      actx.lineTo(4, -23);
      actx.lineTo(13, -33);
    }
    actx.lineTo(20, -19);
    actx.lineTo(30, -16);
    actx.lineTo(22, -6);
    actx.closePath();
    actx.fill();
    actx.stroke();

    // Face contour
    actx.fillStyle = isKurama ? "#ffe5b4" : "#ffd6ba";
    actx.strokeStyle = isKurama ? "#7a1c00" : "#3b2314";
    actx.lineWidth = 2.2;
    actx.beginPath();
    actx.ellipse(0, 0, 20, 17.5, 0, 0, Math.PI * 2);
    actx.fill();
    actx.stroke();

    // Side locks framing face
    actx.fillStyle = isKurama ? "#ffe94d" : "#ffd43b";
    actx.strokeStyle = "#5c3d00";
    actx.lineWidth = 1.4;
    actx.beginPath();
    actx.moveTo(-20, -8);
    actx.lineTo(-23, 8);
    actx.lineTo(-15, 2);
    actx.closePath();
    actx.fill();
    actx.stroke();

    actx.beginPath();
    actx.moveTo(20, -8);
    actx.lineTo(23, 8);
    actx.lineTo(15, 2);
    actx.closePath();
    actx.fill();
    actx.stroke();

    // Forehead Protector (Hitai-ate)
    actx.fillStyle = isKurama ? "#d9480f" : "#1d3557";
    actx.strokeStyle = "#0b132b";
    actx.lineWidth = 1.6;
    actx.beginPath();
    actx.roundRect(-20, -16, 40, 8.5, 3);
    actx.fill();
    actx.stroke();

    // Metal plate
    actx.fillStyle = isKurama ? "#fff3b0" : "#e9ecef";
    actx.strokeStyle = "#2b2d42";
    actx.lineWidth = 1.3;
    actx.beginPath();
    actx.roundRect(-11, -15, 22, 6.5, 2);
    actx.fill();
    actx.stroke();

    // Konoha Leaf Spiral emblem
    actx.strokeStyle = "#1b1f2a";
    actx.lineWidth = 1.3;
    actx.beginPath();
    actx.arc(0, -11.7, 2.2, 0, Math.PI * 1.65);
    actx.moveTo(2, -11.7);
    actx.lineTo(4.5, -13.2);
    actx.stroke();

    // Big Anime Eyes (2 eyes)
    for (const ex of [-7.5, 7.5]) {
      actx.fillStyle = "#ffffff";
      actx.strokeStyle = "#111111";
      actx.lineWidth = 1.6;
      actx.beginPath();
      actx.ellipse(ex, -1.5, 4.4, 4.8, 0, 0, Math.PI * 2);
      actx.fill();
      actx.stroke();

      if (isKurama) {
        actx.fillStyle = "#ff1e42";
        actx.beginPath();
        actx.ellipse(ex, -1.5, 3.2, 3.8, 0, 0, Math.PI * 2);
        actx.fill();
        // Vertical Fox Slit Pupil
        actx.fillStyle = "#090004";
        actx.beginPath();
        actx.ellipse(ex, -1.5, 0.95, 3.3, 0, 0, Math.PI * 2);
        actx.fill();
      } else {
        actx.fillStyle = "#0077b6";
        actx.beginPath();
        actx.ellipse(ex, -1.5, 3.1, 3.6, 0, 0, Math.PI * 2);
        actx.fill();
        actx.fillStyle = "#03045e";
        actx.beginPath();
        actx.arc(ex, -1.5, 1.6, 0, Math.PI * 2);
        actx.fill();
      }

      // Eye shine catchlight
      actx.fillStyle = "#ffffff";
      actx.beginPath();
      actx.arc(ex - 1.2, -3.2, 1.3, 0, Math.PI * 2);
      actx.fill();
    }

    // Determined Eyebrows
    actx.strokeStyle = isKurama ? "#7a1c00" : "#5c3d00";
    actx.lineWidth = 2.2;
    actx.beginPath();
    actx.moveTo(-12.5, -7.2);
    actx.lineTo(-3.2, -5.2);
    actx.moveTo(12.5, -7.2);
    actx.lineTo(3.2, -5.2);
    actx.stroke();

    // 6 Iconic Naruto Cheek Whiskers (3 Left + 3 Right)
    actx.strokeStyle = isKurama ? "#7a1c00" : "#3d2314";
    actx.lineWidth = isKurama ? 2.1 : 1.6;
    for (let w = 0; w < 3; w++) {
      const wy = 2.2 + w * 2.8;
      actx.beginPath();
      actx.moveTo(-18.5, wy - 0.6);
      actx.lineTo(-10.5, wy);
      actx.stroke();

      actx.beginPath();
      actx.moveTo(10.5, wy);
      actx.lineTo(18.5, wy - 0.6);
      actx.stroke();
    }

    // Mouth / Kurama Fangs
    if (isKurama) {
      actx.fillStyle = "#7a001e";
      actx.strokeStyle = "#2b0008";
      actx.lineWidth = 1.4;
      actx.beginPath();
      actx.roundRect(-6.5, 6.5, 13, 5.5, 2.5);
      actx.fill();
      actx.stroke();
      // White Canine Fangs
      actx.fillStyle = "#ffffff";
      actx.beginPath();
      actx.moveTo(-4.8, 6.8);
      actx.lineTo(-2.8, 10.5);
      actx.lineTo(-1.2, 6.8);
      actx.moveTo(1.2, 6.8);
      actx.lineTo(2.8, 10.5);
      actx.lineTo(4.8, 6.8);
      actx.fill();
    } else {
      actx.fillStyle = "#ffffff";
      actx.strokeStyle = "#3b2314";
      actx.lineWidth = 1.4;
      actx.beginPath();
      actx.arc(0, 6.5, 5.2, 0, Math.PI);
      actx.closePath();
      actx.fill();
      actx.stroke();
    }

    actx.restore();
  }
}

window.NarutoMarioRenderer = NarutoMarioRenderer;
