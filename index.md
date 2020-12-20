---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: home
---

<link rel="stylesheet" href="shnake.css">

<div class="my-container">
    <div>
        <p>
        Hi. I'm seeking an entry-level electrical engineering position.
        </p>

        <p>
        I possess strong technology fundamentals, teamwork and communication skills, and an excellent academic record. I've taken classes on digital design, computer architecture, analog circuits, applied electromagnetics, electrical energy conversion, and statistics.
        </p>

        <p>
        Outside of school, I do a lot of toy projects in programming languages including C, C++, Rust, and Go (see my <a href="/~ajbond/portfolio.html">portfolio</a> for these and other projects). You can find my Github at the bottom of the page.
        </p>

        <p>
        I have the talent, perspective, and people skills to make your organization better. Feel free to drop me a line, and thanks for reading. <span id="shnake-span"></span>
        </p>
    </div>
</div>
<div id="shnake-wrapper">
    <img src="headshot2.png" alt="That's me." id="image" width="300" style="border-radius: 50%; position:absolute"/>
    <div id="shnake" style="position: absolute;">
        <span id="gameOver">Game Over</span>
        <canvas id="snakeCanvas" width="300" height="300">
        Sorry, your browser does not support HTML canvas.
        </canvas>
        <span id="snakeLength">Snake Length: 1</span>
        <span id="highScore">High Score: 0</span>
    </div>
</div>
<script src="nativeExtensions.js"></script>
<script src="serpent.js"></script>
<script src="game.js"></script>
<script src="play.js"></script>
<script>
var $shnake = document.getElementById("shnake");
var $wrapper = document.getElementById("shnake-wrapper");
var $image = document.getElementById("image");
var hasMouseEnterHandler = true;

var images = [
    {src: "headshot2.png", alt: "That's me."},
    {src: "inhibit_pcb.png", alt: "An inhibit scheme I designed for AggieSat6."},
    {src: "sr_latch.png", alt: "Verilog I wrote for a digital design class."},
    {src: "blinky.png", alt: "An arduino project I've been working on."}
];
var image_idx = 0;

$wrapper.addEventListener("mouseenter", showShnake);
$wrapper.addEventListener("mouseleave", hideShnake);

// $wrapper.addEventListener("click", toggleMouseEnterEvent);
//
// function toggleMouseEnterEvent() {
//     if (hasMouseEnterHandler) {
//         $wrapper.removeEventListener("mouseleave", hideShnake);
//         hasMouseEnterHandler = false;
//     } else {
//         $wrapper.addEventListener("mouseleave", hideShnake);
//         hasMouseEnterHandler = true;
//     }
// }

function showShnake() {
    $shnake.style.visibility = "visible";
    $image.style.visibility = "hidden";
    image_idx = (image_idx + 1) % images.length;
    $image.src = images[image_idx].src;
    $image.alt = images[image_idx].alt;
}

function hideShnake() {
    $shnake.style.visibility = "hidden";
    $image.style.visibility = "visible";
    game.reset();
}
</script>
