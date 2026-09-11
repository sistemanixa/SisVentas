(function(){
  var selector='input.qty,input.credito-historico-cantidad,input.oc-manual-qty,input.oc-receive-now,input[class*="asist-qty-inp-"],input[class*="ot-ex-"],input[onchange*="actualizarCantidadKit"],input[onchange*="otCarritoCant"]';
  document.addEventListener('wheel',function(event){
    var input=event.target;
    if(!input||!input.matches||!input.matches(selector)||input.type!=='number'||input.disabled||input.readOnly||event.ctrlKey||!event.deltaY)return;
    event.preventDefault();
    var value=Number(input.value);if(!Number.isFinite(value))return;
    var min=input.min!==''?Number(input.min):0,max=input.max!==''?Number(input.max):Infinity;
    var next=event.deltaY<0?Math.floor(value)+1:Math.ceil(value)-1;
    next=Math.max(Math.ceil(min),Math.min(Math.floor(max),next));
    if(next===value||!Number.isFinite(next))return;
    input.value=String(next);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  },{passive:false});
})();
