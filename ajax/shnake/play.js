var canvas = document.getElementById('snakeCanvas');
var fps = 10;

var game = new Game(canvas, fps);
highScore();

document.addEventListener("keydown", function(e) {
  switch (e.keyCode) {
    case 38: 
      if (game.direction != "down") {
        game.direction = "up";
      }
      break;
    case 40:
      if (game.direction != "up") {
        game.direction = "down";
      }
      break;
    case 37: 
      if (game.direction != "right") {
        game.direction = "left";
      }
      break;
    case 39:
      if (game.direction != "left") {
        game.direction = "right";
      }
      break;
  }
});

var bufferSize = 70;

canvas.addEventListener("touchstart", function(e) {
  e.preventDefault();
  var x = parseInt(getTouchXPos(canvas, e)/10, 10)*10
  var y = parseInt(getTouchYPos(canvas, e)/10, 10)*10;
  var head = game.serpent.head;

  switch (game.direction) {
    case "up":
    case "down":
      game.direction = (x <= head.x) ? "left" : "right"
      break;
    case "left":
    case "right":
      game.direction = (y <= head.y) ? "up" : "down"
      break;
    default:
      if (x.between(head.x - bufferSize, head.x + bufferSize) && y <= head.y) { 
        game.direction = "up" 
      } else if (x.between(head.x - bufferSize, head.x + bufferSize) && y >= head.y) { 
          game.direction = "down" 
      } else if (y.between(head.y - bufferSize, head.y + bufferSize) && x <= head.x) { 
          game.direction = "left" 
      } else if (y.between(head.y - bufferSize, head.y + bufferSize) && x >= head.x) { 
          game.direction = "right" 
      } else { 
        console.log("Clicked in unknown direction");
      };
  }
});

function getTouchXPos(canvas, e) {
  var rect = canvas.getBoundingClientRect();
  return e.touches["0"].clientX - rect.left;
}

function getTouchYPos(canvas, e) {
  var rect = canvas.getBoundingClientRect();
  return e.touches["0"].clientY - rect.top;
}

function highScore() {
  if (typeof(Storage) !== "undefined") {
    if (localStorage.highScore) {
      if (game.score > localStorage.highScore) localStorage.highScore = game.score;
    } else {
      localStorage.highScore = game.score;
    }
    document.getElementById("highScore").innerHTML = "High Score: " + localStorage.highScore;
  } else {
    document.getElementById("highScore").innerHTML = "Sorry, no web storage.";
  }
}

var resetButton = document.getElementById("resetButton");
resetButton.addEventListener("click", function(e) {
  game.reset();
});