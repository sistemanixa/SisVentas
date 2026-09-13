(function(){
  'use strict';
  var state=null;
  function ui(text,busy){
    var b=document.getElementById('ia-dictar'),listening=text==='Detener dictado';
    if(b){b.innerHTML='<i class="ti '+(listening?'ti-player-stop-filled':busy?'ti-loader-2':'ti-microphone')+'" aria-hidden="true"></i>';b.disabled=!!busy;b.setAttribute('aria-label',text);b.title=text;b.setAttribute('aria-pressed',String(listening));}
    var status=document.getElementById('ia-voice-status');
    if(status){status.hidden=text==='Dictar';status.querySelector('[data-voice-label]').textContent=listening?'Escuchando…':text;status.classList.toggle('is-listening',listening);}
  }
  function meter(s){
    try{var C=window.AudioContext||window.webkitAudioContext;s.meterContext=new C();s.meterSource=s.meterContext.createMediaStreamSource(s.stream);var analyser=s.meterContext.createAnalyser();analyser.fftSize=256;s.meterSource.connect(analyser);var data=new Uint8Array(analyser.frequencyBinCount),bars=document.querySelectorAll('#ia-voice-status [data-voice-bar]');
      function frame(){if(s.cancelled||!s.meterContext)return;analyser.getByteFrequencyData(data);bars.forEach(function(bar,i){var from=2+i*6,sum=0;for(var k=from;k<from+6;k++)sum+=data[k]||0;bar.style.height=(3+sum/6/255*21)+'px';});s.frame=requestAnimationFrame(frame);}s.meterContext.resume().catch(function(){});frame();
    }catch(e){/* Listening label remains available if visualization is unsupported. */}
  }
  function release(s){clearTimeout(s.timer);if(s.frame)cancelAnimationFrame(s.frame);if(s.meterSource){s.meterSource.disconnect();s.meterSource=null;}if(s.meterContext){s.meterContext.close().catch(function(){});s.meterContext=null;}if(s.stream)s.stream.getTracks().forEach(t=>t.stop());}
  function cancel(){var s=state;if(!s)return;s.cancelled=true;release(s);if(s.controller)s.controller.abort();if(s.recorder&&s.recorder.state!=='inactive')s.recorder.stop();state=null;ui('Dictar',false);}
  async function wav(blob){
    var C=window.AudioContext||window.webkitAudioContext,ctx=new C(),decoded;
    try{decoded=await ctx.decodeAudioData(await blob.arrayBuffer());}finally{await ctx.close();}
    var length=Math.ceil(decoded.duration*16000);if(length>16000*60)throw Error('El audio supera un minuto.');
    var off=new OfflineAudioContext(1,length,16000),src=off.createBufferSource();src.buffer=decoded;src.connect(off.destination);src.start();
    var mono=(await off.startRendering()).getChannelData(0),buffer=new ArrayBuffer(44+mono.length*2),view=new DataView(buffer);
    function text(offset,s){for(var i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));}
    text(0,'RIFF');view.setUint32(4,36+mono.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,mono.length*2,true);
    mono.forEach(function(x,i){x=Math.max(-1,Math.min(1,x));view.setInt16(44+i*2,x<0?x*32768:x*32767,true);});
    return new Promise(function(resolve,reject){var r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(new Blob([buffer],{type:'audio/wav'}));});
  }
  async function finish(s){
    release(s);if(s.cancelled)return;ui('Transcribiendo…',true);
    try{
      var user=window.fbAuth&&window.fbAuth.currentUser;if(!user)throw Error('Iniciá sesión para dictar.');
      var audio=await wav(new Blob(s.chunks,{type:s.recorder.mimeType}));if(s.cancelled)return;
      var token=await user.getIdToken();s.controller=new AbortController();
      var res=await fetch((window.SV_IA_ENDPOINT||'https://asistente-171899432710.southamerica-east1.run.app')+'/transcribe',{method:'POST',headers:{'Content-Type':'application/json','X-Frontend-Key':SISVENTAS_FUNCTIONS.frontendKey,Authorization:'Bearer '+token},body:JSON.stringify({audio:audio}),signal:s.controller.signal});
      var data=await res.json();if(!res.ok||data.error)throw Error(data.mensaje||'No se pudo transcribir.');if(!data.text)throw Error('No se reconoció voz. Probá nuevamente.');
      if(s.cancelled)return;var input=document.getElementById('ia-input');input.value=(input.value.trim()?input.value.trim()+' ':'')+data.text;input.dispatchEvent(new Event('input',{bubbles:true}));notify('Dictado listo. Revisalo y presioná Enviar o Enseñar.');
    }catch(e){if(!s.cancelled)notify(e.message||'No se pudo transcribir.');}finally{if(state===s){state=null;ui('Dictar',false);}}
  }
  async function toggle(){
    if(state){if(state.recorder&&state.recorder.state==='recording'){ui('Transcribiendo…',true);state.recorder.stop();}return;}
    if(!navigator.mediaDevices||!window.MediaRecorder){notify('Este navegador no permite grabar audio.');return;}
    var s={chunks:[],cancelled:false};state=s;ui('Abriendo micrófono…',true);
    try{s.stream=await navigator.mediaDevices.getUserMedia({audio:true});if(s.cancelled){release(s);return;}
      s.recorder=new MediaRecorder(s.stream);s.recorder.ondataavailable=e=>{if(e.data.size)s.chunks.push(e.data);};s.recorder.onstop=()=>finish(s);s.recorder.onerror=()=>{cancel();notify('No se pudo grabar.');};s.recorder.start();ui('Detener dictado',false);meter(s);s.timer=setTimeout(()=>{if(s.recorder.state==='recording')s.recorder.stop();},55000);
    }catch(e){release(s);if(state===s){state=null;ui('Dictar',false);}if(!s.cancelled)notify('No se pudo abrir el micrófono. Revisá el permiso del navegador.');}
  }
  window.svIaDictation={toggle:toggle,cancel:cancel};window.addEventListener('pagehide',cancel);
})();
