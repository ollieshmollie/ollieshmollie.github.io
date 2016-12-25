$.fn.extend({
  slideFromLeft: function(html, success=null) {
    return this.each(function() {
      $(this).css({right: '0'})
      $(this).animate({right: '-100%'}, function() {
        $(this).empty()
        $(this).removeAttr('style')
        $(this).css({left: '-100%'})
        $(this).html(html)
        $(this).animate({left: '0'}, function() {
          $(this).removeAttr('style')
          if (success) success()
        })
      })
    })
  }
})

var $main = $('main')

$(function() {

$('#tact').click(function(e) {
  e.preventDefault()
  $.get('ajax/tact/README.html', function(html) {
    console.log("Clicked tact")
    $main.slideFromLeft(html)
  })
})

$('#shnake').click(function(e) {
  e.preventDefault()
  $.get('ajax/shnake/index.html', function(html) {
    console.log("Clicked shnake")
    $main.slideFromLeft(html, function() {
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


})