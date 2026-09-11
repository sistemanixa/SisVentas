(function(){
  function imageFile(data){
    if(!data)return null;
    var files=Array.from(data.files||[]);
    if(!files.length)files=Array.from(data.items||[]).filter(function(i){return i.kind==='file';}).map(function(i){return i.getAsFile();});
    return files.find(function(f){return f&&/^image\//.test(f.type);})||null;
  }
  function destination(target){
    if(!target||!target.closest)return '';
    if(target.closest('#chat-box'))return 'chat';
    var form=target.closest('#prod-form-view');
    return form&&form.getClientRects().length?'product':'';
  }
  function receive(event){
    if(event.type==='drop')clearDrag();
    var dest=destination(event.target),file=imageFile(event.clipboardData||event.dataTransfer);
    if(!dest||!file)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(dest==='chat')window.chatEnviarArchivo(file);
    else window.previewImagenProducto({files:[file],value:''});
  }
  function clearDrag(){document.querySelectorAll('.chat-drop-active').forEach(function(el){el.classList.remove('chat-drop-active');});}
  document.addEventListener('dragend',clearDrag,true);
  document.addEventListener('drop',clearDrag,true);
  document.addEventListener('paste',receive,true);
  document.addEventListener('drop',receive,true);
  document.addEventListener('dragover',function(event){
    if(destination(event.target)&&Array.from(event.dataTransfer&&event.dataTransfer.types||[]).includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}
  },true);
})();
