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


})