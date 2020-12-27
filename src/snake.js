Number.prototype.times = function (f) {
    for (var i = 0; i < this; i++) {
        f();
    }
    return this;
};

Number.prototype.between = function (a, b) {
    var min = Math.min(a, b);
    var max = Math.max(a, b);

    return this > min && this < max;
};

class Segment {
    constructor(x, y, ctx, color = "lightgreen") {
        this.x = x;
        this.y = y;
        this.ctx = ctx;
        this.height = 10;
        this.width = 10;
        this.currAxis;
        this.color = color;
    }

    chase() {
        this.moveTo(this.targetX, this.targetY);
    }

    moveTo(newX, newY) {
        this.clear();
        this.draw(newX, newY);
        this.x = newX;
        this.y = newY;
    }

    draw(x, y) {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(x, y, this.height, this.width);
    }

    clear() {
        this.ctx.clearRect(this.x, this.y, this.height, this.width);
    }
}

class Head extends Segment {
    constructor(x, y, ctx) {
        super(x, y, ctx);
        this.direction;
        this.draw(x, y);
    }

    draw(x, y) {
        super.draw(x, y);
        var head = this;
        function drawLeftEye() {
            head.ctx.clearRect(x + 2, y + 2, 2, 2);
        }
        function drawRightEye() {
            head.ctx.clearRect(x + 6, y + 2, 2, 2);
        }
        function drawBottomEyes() {
            head.ctx.clearRect(x + 2, y + 6, 2, 2);
            head.ctx.clearRect(x + 6, y + 6, 2, 2);
        }
        switch (this.currAxis) {
            case "+x":
                drawRightEye();
                break;
            case "-x":
                drawLeftEye();
                break;
            case "+y":
                drawBottomEyes();
                break;
            default:
                drawRightEye();
                drawLeftEye();
        }
    }

    move() {
        switch (this.direction) {
            case "up":
                this.moveTo(
                    this.x % snakeCanvas.width,
                    this.y - this.height < 0
                        ? snakeCanvas.height
                        : this.y - this.height
                );
                this.currAxis = "-y";
                break;
            case "down":
                this.moveTo(
                    this.x % snakeCanvas.width,
                    (this.y + this.height) % snakeCanvas.height
                );
                this.currAxis = "+y";
                break;
            case "left":
                this.moveTo(
                    this.x - this.width < 0
                        ? snakeCanvas.width
                        : this.x - this.width,
                    this.y % snakeCanvas.height
                );
                this.currAxis = "-x";
                break;
            case "right":
                this.moveTo(
                    (this.x + this.width) % snakeCanvas.width,
                    this.y % snakeCanvas.height
                );
                this.currAxis = "+x";
                break;
        }
    }
}

class Treat extends Segment {
    constructor(ctx, color = "rgb(255, 0, 0") {
        super(null, null, ctx, color);
        this.x = this.randomPos(ctx.canvas.width);
        this.y = this.randomPos(ctx.canvas.height);
    }

    draw() {
        this.ctx.fillStyle = this.color;
        super.draw(this.x, this.y);
        this.ctx.fillStyle = "rgb(0, 0, 0)";
    }

    randomPos(max) {
        var num = Math.floor(Math.random() * max);
        return parseInt(num / 10, 10) * 10;
    }
}

class Serpent {
    constructor(x, y, ctx, direction = "right") {
        this.head = new Head(x, y, ctx, direction);
        this.segments = [this.head];
        this.ctx = ctx;
    }

    move() {
        for (var i = 1; i < this.segments.length; i++) {
            this.segments[i].targetX = this.segments[i - 1].x;
            this.segments[i].targetY = this.segments[i - 1].y;

            if (
                this.segments[i].x == this.segments[i].targetX &&
                this.segments[i].targetY > this.segments[i].y
            ) {
                this.segments[i].currAxis = "+y";
            }

            if (
                this.segments[i].y == this.segments[i].targetY &&
                this.segments[i].targetX > this.segments[i].x
            ) {
                this.segments[i].currAxis = "+x";
            }

            if (
                this.segments[i].x == this.segments[i].targetX &&
                this.segments[i].targetY < this.segments[i].y
            ) {
                this.segments[i].currAxis = "-y";
            }

            if (
                this.segments[i].y == this.segments[i].targetY &&
                this.segments[i].targetX < this.segments[i].x
            ) {
                this.segments[i].currAxis = "-x";
            }
        }

        this.head.move();

        for (i = 1; i < this.segments.length; i++) {
            this.segments[i].chase();
        }
    }

    get length() {
        return this.segments.length;
    }

    get tail() {
        return this.segments[this.segments.length - 1];
    }

    get touchingSelf() {
        for (var i = 1; i < this.segments.length; i++) {
            var seg = this.segments[i];
            if (this.head.x == seg.x && this.head.y == seg.y) return true;
        }
        return false;
    }

    addSegment() {
        var seg = new Segment(null, null, this.ctx);
        switch (this.tail.currAxis) {
            case "+y":
                seg.x = this.tail.x;
                seg.y = this.tail.y - seg.height;
                break;
            case "+x":
                seg.x = this.tail.x - seg.width;
                seg.y = this.tail.y;
                break;
            case "-y":
                seg.x = this.tail.x;
                seg.y = this.tail.y + seg.height;
                break;
            case "-x":
                seg.x = this.tail.x + seg.width;
                seg.y = this.tail.y;
        }
        this.segments.push(seg);
        seg.draw(seg.x, seg.y);
    }
}

const INITIAL_FPS = 15;

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.serpent = new Serpent(
            canvas.width / 2,
            canvas.height / 2,
            this.ctx
        );
        this.fps = INITIAL_FPS;
        this.treat = new Treat(this.ctx);
        this._over = false;
    }

    get score() {
        return this.serpent.length - 1;
    }

    get over() {
        return this._over || this.serpent.touchingSelf; // || this.outOfBounds
    }

    set over(newOver) {
        this._over = newOver;
    }

    get outOfBounds() {
        return (
            this.serpent.head.x > this.canvas.width - this.serpent.head.width ||
            this.serpent.head.x < 0 ||
            this.serpent.head.y >
                this.canvas.height - this.serpent.head.height ||
            this.serpent.head.y < 0
        );
    }

    get direction() {
        return this.serpent.head.direction;
    }

    set direction(newDirection) {
        this.serpent.head.direction = newDirection;
    }

    reset() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.serpent = new Serpent(
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.ctx
        );
        this.fps = INITIAL_FPS;
        document.removeEventListener("keydown", this.handleKeyPress);
    }

    play() {
        document.addEventListener("keydown", this.handleKeyPress);
        this.over = false;
        var game = this;
        this.loop = setTimeout(function () {
            game.serpent.move();
            game.checkTreat();
            game.offerTreat();
            if (game.over) {
                hideSnake();
                output("Game over. Score: " + game.score);
                game.reset();
                return;
            } else {
                game.play();
            }
        }, 1000 / this.fps);

        this.offerTreat();
    }

    offerTreat() {
        this.treat.draw();
    }

    checkTreat() {
        if (
            this.serpent.head.x == this.treat.x &&
            this.serpent.head.y == this.treat.y
        ) {
            this.serpent.addSegment();
            this.treat = new Treat(this.ctx);
            this.fps += 0.7;
        }
    }

    quit() {
        game.over = true;
    }

    handleKeyPress(e) {
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
            case 81:
                e.preventDefault();
                game.quit();
        }
    }
}
