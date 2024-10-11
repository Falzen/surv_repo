$(document).ready(function() {
  

  // Démarre la boucle du jeu
  gameLoop();
});


const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // Initialisation du joueur
  const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 15,
    speed: 4,
    color: 'white',
    health: 100,
    maxHealth: 100,
    experience: 0,
    level: 1,
    attacks: []
  };

  let enemies = [];
  let keysPressed = {};
  let score = 0;
  let mouseX = 0;
  let mouseY = 0;
  let projectiles = [];
  let xpOrbs = [];
  let isGamePaused = false;
  let last = 0;
  const everyXseconds = 1;
  const desiredFPS = 60;
  let lastTime = performance.now();

  // Types d'attaques
  const attackTypes = {
    basicShot: {
      name: "Basic Shot",
      damage: 10,
      speed: 10,
      cooldown: 500,
      projectileRadius: 5,
      color: 'yellow',
      lastFired: 0,
      fire(x, y) {
        const angle = Math.atan2(mouseY - y, mouseX - x);
        return {
          x: x,
          y: y,
          radius: this.projectileRadius,
          speed: this.speed,
          damage: this.damage,
          color: this.color,
          angle: angle
        };
      },
      canFire() {
        return Date.now() - this.lastFired >= this.cooldown;
      }
    },
    spread: {
      name: "Spread Shot",
      damage: 5,
      speed: 1,
      duration: 5000,
      cooldown: 10000,
      projectileRadius: 15,
      color: 'cyan',
      lastFired: 0,
      orbitRadius: 100,
      projectileCount: 2,
      fire(x, y) {
        const projectiles = [];
        for (let i = 0; i < this.projectileCount; i++) {
          const angle = (Math.PI * 2 / this.projectileCount) * i;
          projectiles.push({
            x: x + Math.cos(angle) * this.orbitRadius,
            y: y + Math.sin(angle) * this.orbitRadius,
            radius: this.projectileRadius,
            speed: this.speed,
            damage: this.damage,
            color: this.color,
            angle: angle,
            createdAt: Date.now()
          });
        }
        return projectiles;
      },
      canFire() {
        return Date.now() - this.lastFired >= this.cooldown;
      }
    }
  };

  // Initialiser le joueur avec les deux attaques
  player.attacks.push({ ...attackTypes.basicShot });
  player.attacks.push({ ...attackTypes.spread });

  // Gestion des événements clavier et souris
  $(document).mousemove((event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });

  $(document).keydown((e) => {
    if (e.code === 'Space') {
      togglePause();
      return;
    }
    keysPressed[e.key] = true;
  });

  $(document).keyup((e) => {
    delete keysPressed[e.key];
  });

  // Fonction pour déplacer le joueur
  function movePlayer() {
    if (keysPressed["ArrowUp"] || keysPressed["z"]) player.y -= player.speed;
    if (keysPressed["ArrowDown"] || keysPressed["s"]) player.y += player.speed;
    if (keysPressed["ArrowLeft"] || keysPressed["q"]) player.x -= player.speed;
    if (keysPressed["ArrowRight"] || keysPressed["d"]) player.x += player.speed;

    // Empêche le joueur de sortir des limites du canvas
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    // Gestion de la collecte des orbes d'XP
    xpOrbs = xpOrbs.filter((orb) => {
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const distanceSquared = dx * dx + dy * dy;
      const combinedRadius = player.radius + orb.radius;
      if (distanceSquared < combinedRadius * combinedRadius) {
        score += 10;
        player.experience += 10;
        checkLevelUp();
        return false; // L'orbe est collectée
      }
      return true; // L'orbe reste
    });
  }

  // Affiche le joueur sur le canvas
  function drawPlayer() {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();

    // Barre de santé du joueur
    ctx.fillStyle = 'red';
    ctx.fillRect(player.x - 20, player.y - 30, 40, 5);
    ctx.fillStyle = 'green';
    ctx.fillRect(player.x - 20, player.y - 30, 40 * (player.health / player.maxHealth), 5);
  }

  // Fonction pour faire apparaître un ennemi
  function spawnEnemy() {
    const enemy = {
      x: 0,
      y: 0,
      radius: 10,
      speed: 1 + Math.random(),
      color: 'red',
      health: 20
    };

    // Positionnement de l'ennemi en dehors de l'écran
    const side = Math.floor(Math.random() * 4);
    const externalMargin = 10;
    switch (side) {
      case 0: enemy.x = Math.random() * canvas.width; enemy.y = -externalMargin; break;
      case 1: enemy.x = canvas.width + externalMargin; enemy.y = Math.random() * canvas.height; break;
      case 2: enemy.x = Math.random() * canvas.width; enemy.y = canvas.height + externalMargin; break;
      case 3: enemy.x = -externalMargin; enemy.y = Math.random() * canvas.height; break;
    }

    enemies.push(enemy);
  }

  // Affiche les ennemis sur le canvas
  function drawEnemies() {
    enemies.forEach((enemy) => {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = enemy.color;
      ctx.fill();
      ctx.closePath();
    });
  }

  // Met à jour la position des ennemis et vérifie les collisions
  function updateEnemies() {
    enemies = enemies.filter((enemy) => {
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed;
      enemy.y += Math.sin(angle) * enemy.speed;

      // Collision avec le joueur
      if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < player.radius + enemy.radius) {
        player.health -= 1;
        if (player.health <= 0) {
          alert("Game Over! Your score: " + score);
          document.location.reload();
        }
        return true; // L'ennemi reste
      }
      return true; // L'ennemi reste
    });
  }

  // Met à jour les projectiles et vérifie les collisions
  function updateProjectiles() {
    const now = Date.now();
    projectiles = projectiles.filter((projectile) => {
      if (projectile.createdAt && now - projectile.createdAt > attackTypes.spread.duration) {
        return false; // Le projectile disparaît après sa durée de vie
      }

      // Déplace les projectiles
      if (projectile.angle !== undefined) {
        if (projectile.createdAt) {  // Pour le Spread Shot
          const newAngle = projectile.angle + projectile.speed * 0.05;
          projectile.x = player.x + Math.cos(newAngle) * attackTypes.spread.orbitRadius;
          projectile.y = player.y + Math.sin(newAngle) * attackTypes.spread.orbitRadius;
          projectile.angle = newAngle;
        } else {  // Pour le Basic Shot
          projectile.x += Math.cos(projectile.angle) * projectile.speed;
          projectile.y += Math.sin(projectile.angle) * projectile.speed;
        }
      }

      // Vérifie si le projectile sort des limites de l'écran
      if (projectile.x < -50 || projectile.x > canvas.width + 50 ||
          projectile.y < -50 || projectile.y > canvas.height + 50) {
        return false;
      }

      // Collision avec les ennemis
      let hitEnemy = false;
      enemies.forEach((enemy, enemyIndex) => {
        const distance = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
        if (distance < projectile.radius + enemy.radius) {
          enemy.health -= projectile.damage;
          hitEnemy = true;
          if (enemy.health <= 0) {
            enemies.splice(enemyIndex, 1);
            dropXp(enemy);
          }
        }
      });

            // Si c'est un tir de base et qu'il a touché un ennemi, on le supprime
      if (!projectile.createdAt && hitEnemy) {
        return false;
      }

      return true; // Le projectile reste
    });
  }

  // Fonction pour faire apparaître un orbe d'XP lorsqu'un ennemi meurt
  function dropXp(entity) {
    const xpOrb = {
      x: entity.x,
      y: entity.y,
      radius: 5,
      speed: 0,
      color: "darkblue"
    };
    xpOrbs.push(xpOrb);
  }

  // Affiche les orbes d'XP sur le canvas
  function drawXpOrbs() {
    xpOrbs.forEach((orb) => {
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fillStyle = orb.color;
      ctx.fill();
      ctx.closePath();
    });
  }

  // Affiche les projectiles sur le canvas
  function drawProjectiles() {
    projectiles.forEach((projectile) => {
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      ctx.fillStyle = projectile.color;
      ctx.fill();
      ctx.closePath();
    });
  }

  // Vérifie si le joueur doit monter de niveau
  function checkLevelUp() {
    if (player.experience >= player.level * 100) {
      doLevelUp();
    }
  }

  // Logique de montée de niveau du joueur
  function doLevelUp() {
    player.level++;
    player.experience = 0;
    player.maxHealth += 20;
    player.health = player.maxHealth;
    upgradeRandomAttack();
  }

  // Améliore aléatoirement une attaque du joueur
  function upgradeRandomAttack() {
    const attack = player.attacks[Math.floor(Math.random() * player.attacks.length)];
    if (attack.name === "Basic Shot") {
      attack.damage *= 1.2;
      attack.speed *= 1.1;
      attack.cooldown *= 0.9;
    } else if (attack.name === "Spread Shot") {
      attack.speed *= 1.2;
      attack.projectileCount++;
    }
    console.log(`Upgraded ${attack.name}`);
  }

  // Affiche les informations du joueur sur le canvas (score, niveau, XP)
  function drawInfo() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`Level: ${player.level}`, 10, 60);
    ctx.fillText(`XP: ${player.experience}/${player.level * 100}`, 10, 90);
  }

  // Fonction pour activer ou désactiver la pause
  function togglePause() {
    isGamePaused = !isGamePaused;
    if (!isGamePaused) {
      gameLoop();
    }
  }

  // Boucle principale du jeu
  function gameLoop(timeStamp) {
    const timeInSecond = timeStamp / 1000;

    // Limite la fréquence de rafraîchissement à 60 FPS
    if (timeStamp - lastTime >= 1000 / desiredFPS) {
      lastTime = timeStamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      movePlayer();
      drawPlayer();

      updateEnemies();
      drawEnemies();

      updateAttacks();
      updateProjectiles();
      drawProjectiles();
      drawXpOrbs();

      drawInfo();

      // Fait apparaître un ennemi toutes les X secondes
      if (timeInSecond - last >= everyXseconds) {
        last = timeInSecond;
        spawnEnemy();
      }
    }

    // Continue la boucle si le jeu n'est pas en pause
    if (!isGamePaused) {
      requestAnimationFrame(gameLoop);
    }
  }


// Met à jour les attaques du joueur et tire si le délai de tir est écoulé
function updateAttacks() {
  const now = Date.now();
  player.attacks.forEach((attack) => {
    if (attack.canFire()) {
      const newProjectiles = attack.fire(player.x, player.y);
      if (Array.isArray(newProjectiles)) {
        projectiles.push(...newProjectiles);
      } else {
        projectiles.push(newProjectiles);
      }
      attack.lastFired = now;
    }
  });
}


// Fonction utilitaire pour mélanger une copie d'un tableau
function getCopyShuffled(originalArray) {
  const array = [...originalArray];
  let currentIndex = array.length;
  let temporaryValue, randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

// Vérifie si un objet avec une propriété spécifique existe dans une liste
function containsObjectByPropertyName(obj, list, propertyName) {
  return list.some((item) => item[propertyName] === obj[propertyName]);
}

