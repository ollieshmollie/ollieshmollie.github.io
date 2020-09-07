---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: home
---

<div class="my-container" style="display: flex; align-items: center; margin-bottom: 20px;">
    <img src="/~ajbond/wall_street_square.jpg" alt="That's me." width="200" style="border-radius: 50%; margin-right: 20px;"/>
    <div>
        Hi. I'm seeking an entry-level electrical engineering position. I possess strong technology fundamentals, teamwork and communication skills, and an excellent academic record.
    </div>
</div>
<link rel="stylesheet" href="shnake.css">
<div id="shnake-wrapper">
    <div id="shnake">
        <span id="gameOver">Game Over</span>
        <canvas id="snakeCanvas" width="300" height="300">
        Sorry, your browser does not support HTML canvas.
        </canvas>
        <span id="snakeLength">Snake Length: 1</span>
        <span id="highScore">High Score: 0</span>
        <br><br>
        <button type="button" id="resetButton">Reset</button>
    </div>
</div>
<script src="nativeExtensions.js"></script>
<script src="serpent.js"></script>
<script src="game.js"></script>
<script src="play.js"></script>
<script>
var $shnake = document.getElementById("shnake");
var $wrapper = document.getElementById("shnake-wrapper");
var hasMouseOverHandler = true;

$wrapper.addEventListener("mouseover", showShnake);
$wrapper.addEventListener("mouseout", hideShnake);
$wrapper.addEventListener("click", toggleMouseOverEvent);

function toggleMouseOverEvent() {
    if (hasMouseOverHandler) {
        $wrapper.removeEventListener("mouseout", hideShnake);
        hasMouseOverHandler = false;
    } else {
        $wrapper.addEventListener("mouseout", hideShnake);
        hasMouseOverHandler = true;
    }
}

function showShnake() {
    document.getElementById("shnake").style.visibility = "visible";
}

function hideShnake() {
    document.getElementById("shnake").style.visibility = "hidden";
}
</script>
