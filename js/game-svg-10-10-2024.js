$(document).ready(function() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  
  let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 15,
    speed: 3,
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
  
  const attackTypes = {
    basicShot: {
      name: "Basic Shot",
      damage: 10,
      speed: 5,
      cooldown: 500,
      projectileRadius: 5,
      color: 'yellow',
      lastFired: 0,
      fire: function(x, y) {
        let angle = Math.atan2(mouseY - y, mouseX - x);
        return {
          x: x,
          y: y,
          radius: this.projectileRadius,
          speed: this.speed,
          damage: this.damage,
          color: this.color,
          angle: angle
        };
      }
    },
    spread: {
      name: "Spread Shot",
      damage: 5,
      speed: 1,  // Vitesse de rotation
      duration: 5000,  // 5 secondes
      cooldown: 10000,  // 10 secondes
      projectileRadius: 15,  // Même taille que le joueur
      color: 'cyan',
      lastFired: 0,
      orbitRadius: 100,  // Réduit à 100px
      projectileCount: 2,
      fire: function(x, y) {
        let projectiles = [];
        for (let i = 0; i < this.projectileCount; i++) {
          let angle = (Math.PI * 2 / this.projectileCount) * i;
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
      }
    }
  };
  
  // Initialiser le joueur avec les deux attaques
  player.attacks.push({...attackTypes.basicShot});
  player.attacks.push({...attackTypes.spread});
  
  $(document).mousemove(function(event) {
    let rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  
  $(document).keydown(function(e) { 
    if(e.code == 'Space') {
      togglePause()
      return;
    }

    keysPressed[e.key] = true;
  });

  $(document).keyup(function(e) {
    delete keysPressed[e.key];
  });
  
  function movePlayer() {
    if (keysPressed["ArrowUp"] || keysPressed["z"]) player.y -= player.speed;
    if (keysPressed["ArrowDown"] || keysPressed["s"]) player.y += player.speed;
    if (keysPressed["ArrowLeft"] || keysPressed["q"]) player.x -= player.speed;
    if (keysPressed["ArrowRight"] || keysPressed["d"]) player.x += player.speed;
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));


    let touchOrb = false;
    xpOrbs.forEach((orb, orbIndex) => {
      let distance = Math.hypot(player.x - orb.x, player.y - orb.y);
      if (distance < player.radius + orb.radius) {
        touchOrb = true;
          xpOrbs.splice(orbIndex, 1);
          score += 10;
          player.experience += 10;
          checkLevelUp();
          // dropXp(orb);
      }
    });
    
  }
  
  function drawPlayer() {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();
    
    ctx.fillStyle = 'red';
    ctx.fillRect(player.x - 20, player.y - 30, 40, 5);
    ctx.fillStyle = 'green';
    ctx.fillRect(player.x - 20, player.y - 30, 40 * (player.health / player.maxHealth), 5);
  }
  
  function spawnEnemy() {
    let enemy = {
      x: 0,
      y: 0,
      radius: 10,
      speed: 1 + Math.random(),
      color: 'red',
      health: 20
    };

    let side = Math.floor(Math.random() * 4);
    let externalMargin = 10;
    switch(side) {
      case 0: enemy.x = Math.random() * canvas.width; enemy.y = -externalMargin; break;
      case 1: enemy.x = canvas.width + externalMargin; enemy.y = Math.random() * canvas.height; break;
      case 2: enemy.x = Math.random() * canvas.width; enemy.y = canvas.height + externalMargin; break;
      case 3: enemy.x = -externalMargin; enemy.y = Math.random() * canvas.height; break;
    }

    enemies.push(enemy);
  }
  
  function drawEnemies() {
    enemies.forEach((enemy) => {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = enemy.color;
      ctx.fill();
      ctx.closePath();
    });
  }
  
  function updateEnemies() {
    enemies.forEach((enemy, index) => {
      let angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed;
      enemy.y += Math.sin(angle) * enemy.speed;
      
      if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < player.radius + enemy.radius) {
        player.health -= 1;
        if (player.health <= 0) {
          alert("Game Over! Your score: " + score);
          document.location.reload();
        }
      }
    });
  }
  
  let projectiles = [];
  let xpOrbs = [];
  
  function updateAttacks() {
    let now = Date.now();
    player.attacks.forEach(attack => {
      if (now - attack.lastFired >= attack.cooldown) {
        let newProjectiles = attack.fire(player.x, player.y);
        if (Array.isArray(newProjectiles)) {
          projectiles.push(...newProjectiles);
        } else {
          projectiles.push(newProjectiles);
        }
        attack.lastFired = now;
      }
    });
  }
  
  function updateProjectiles() {
    let now = Date.now();
    projectiles = projectiles.filter((projectile) => {
      if (projectile.createdAt && now - projectile.createdAt > attackTypes.spread.duration) {
        return false;
      }
      
      if (projectile.angle !== undefined) {
        if (projectile.createdAt) {  // Spread shot
          let newAngle = projectile.angle + projectile.speed * 0.05;
          projectile.x = player.x + Math.cos(newAngle) * attackTypes.spread.orbitRadius;
          projectile.y = player.y + Math.sin(newAngle) * attackTypes.spread.orbitRadius;
          projectile.angle = newAngle;
        } else {  // Basic shot
          projectile.x += Math.cos(projectile.angle) * projectile.speed;
          projectile.y += Math.sin(projectile.angle) * projectile.speed;
        }
      }
      
      if (projectile.x < -50 || projectile.x > canvas.width + 50 || 
          projectile.y < -50 || projectile.y > canvas.height + 50) {
        return false;
      }
      
      let hitEnemy = false;
      enemies.forEach((enemy, enemyIndex) => {
        let distance = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
        if (distance < projectile.radius + enemy.radius) {
          enemy.health -= projectile.damage;
          hitEnemy = true;
          if (enemy.health <= 0) {
            enemies.splice(enemyIndex, 1);
            // score += 10;
            // player.experience += 10;
            // checkLevelUp();
            dropXp(enemy);
          }
        }
      });
      
      // Si c'est un tir de base et qu'il a touché un ennemi, on le supprime
      if (!projectile.createdAt && hitEnemy) {
        return false;
      }
      
      return true;
    });
  }

  function dropXp(entity) {
    let xpOrb = {
      x: entity.x,
      y: entity.y,
      radius: 5,
      speed: 0,
      color: "darkblue"
    }
    xpOrbs.push(xpOrb);
  }
  
  function drawXpOrbs() {
    xpOrbs.forEach(orb => {
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fillStyle = orb.color;
      ctx.fill();
      ctx.closePath();
    });
  }
  
  function drawProjectiles() {
    projectiles.forEach(projectile => {
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      ctx.fillStyle = projectile.color;
      ctx.fill();
      ctx.closePath();
    });
  }
  
  function checkLevelUp() {
    if (player.experience >= player.level * 100) {
      //setPause(true);
      doLevelUp();
    }
  }

  function doLevelUp() {
      player.level++;
      player.experience = 0;

      player.maxHealth += 20;
      player.health = player.maxHealth;

      upgradeRandomAttack();
      //showSkillLevelUpPopup();
  }

  function showSkillLevelUpPopup() {
    debugger;
    // get 3 random attacks from list
    let shuffledSkills = getCopyShuffled(attackTypes);
    let chosenSkills = shuffledSkills.slice(0, 3);
    let popupContentOutput = '<div class="level-up-content"><ul>';
    for (var i = 0; i < chosenSkills.length; i++) {
      popupContentOutput += '</li>';
      popupContentOutput += makeSkillContent(chosenSkills[i]);
      popupContentOutput += '</li>';
    }
    popupContentOutput += '</ul></div>';
    $('#levelUpPopup').html(popupContentOutput).show();
  }

  function makeSkillContent(chosenSkill) {
    debugger;
    let isPlayerOwned = containsObjectByPropertyName(chosenSkill, player.attacks, 'name');
    let output = '<div class="one-skill' + (isPlayerOwned ? 'owned' : '') + '">';
    output += '<p>' + chosenSkill + ' ' + (isPlayerOwned ? '(owned)' : '') + '</p>'
    output += '</div>'
  }
  
  function upgradeRandomAttack() {
    let attack = player.attacks[Math.floor(Math.random() * player.attacks.length)];
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
  
  function drawInfo() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);
    ctx.fillText(`Level: ${player.level}`, 10, 60);
    ctx.fillText(`XP: ${player.experience}/${player.level * 100}`, 10, 90);
  }


  function togglePause() {
    isGamePaused = !isGamePaused;
    if(isGamePaused == false) {
      gameLoop();
    }
  }

  function setPause(shouldPause) {
    isGamePaused = shouldPause;
    if(shouldPause == false) {
      gameLoop();
    }
  }

  var isGamePaused = false;  
  let last = 0;
  let everyXseconds = 1 ;
  function gameLoop(timeStamp) {
    let timeInSecond = timeStamp / 1000;
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

    if (timeInSecond - last >= everyXseconds) {
      last = timeInSecond;
      spawnEnemy();
    }

    if(!isGamePaused) {
      requestAnimationFrame(gameLoop);
    }
  }
  
  //setInterval(spawnEnemy, 1000);
  
  gameLoop();
});



// returns a shuffled copy of originalArray
function getCopyShuffled(originalArray) {
  var array = [].concat(originalArray);
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}



// checks if array contains object by property name
function containsObjectByPropertyName(obj, list, propertyName) {
    for (let i = 0; i < list.length; i++) {
        if (list[i][propertyName] === obj[propertyName]) {
            return true;
        }
    }
    return false;
}
