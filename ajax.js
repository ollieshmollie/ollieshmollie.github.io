var $main = $('main')

$(function() {

$('#tact').click(function(e) {
  e.preventDefault()
  $.get('ajax/tact/README.html', function(html) {
    console.log("Clicked tact")
    $main.empty
    $main.html(html)
  })
})

$('#shnake').click(function(e) {
  e.preventDefault()
  $.get('ajax/shnake/index.html', function(html) {
    console.log("Clicked shnake")
    $main.empty
    $main.html(html)
    $.getScript('ajax/shnake/serpent.js', function() {
      $.getScript('ajax/shnake/game.js', function() {
        $.getScript('ajax/shnake/play.js', function() {
          console.log("Running shnake scripts...")
        })
      })
    })
  })
})


})