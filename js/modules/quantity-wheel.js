(function(){
  // La rueda desplaza la página; nunca modifica un importe o cantidad.
  document.addEventListener('wheel',function(event){
    var input=event.target;
    if(!input||!input.matches||!input.matches('input[type="number"]')||event.ctrlKey)return;
    if(document.activeElement===input)input.blur();
  },{capture:true,passive:true});
})();
