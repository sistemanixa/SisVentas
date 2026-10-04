(async function(){
 const host=document.getElementById('content'),base='https://nixa-sisventas-default-rtdb.firebaseio.com/sv_catalogo_publico';
 const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const href=key=>'catalogo.html?producto='+encodeURIComponent(key);
 const photo=(p,hero=false)=>/^https:\/\//i.test(p.imagenUrl||'')?'<img src="'+escape(p.imagenUrl)+'" alt="'+escape(p.nombre)+'" '+(hero?'fetchpriority="high"':'loading="lazy"')+'>':'<span>Imagen no disponible</span>';
 async function read(path){const r=await fetch(base+path,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(r.status===401||r.status===403||r.status===404)return null;if(!r.ok)throw Error();return r.json();}
 const product=key=>read('/'+encodeURIComponent(key)+'.json');
 async function navigation(key){try{const ids=Object.keys(await read('_index.json')||{}).sort(),index=ids.indexOf(key);if(index<0||ids.length<2)return;
  async function neighbor(direction){for(let step=1;step<ids.length;step++){const id=ids[(index+direction*step+ids.length)%ids.length];if(await product(id))return id;}return null;}
  const [prev,next]=await Promise.all([neighbor(-1),neighbor(1)]);const nav=document.createElement('nav');nav.className='navigation';nav.setAttribute('aria-label','Productos');nav.innerHTML=(prev?'<a class="btn" href="'+href(prev)+'">← Producto anterior</a>':'')+(next?'<a class="btn" href="'+href(next)+'">Producto siguiente →</a>':'');host.appendChild(nav);
 }catch(_){/* La ficha permanece disponible aunque falle la navegación. */}}
 const key=new URLSearchParams(location.search).get('producto');
 try{
  if(key){const p=await product(key);if(!p){host.textContent='Este producto ya no está disponible en el catálogo.';return;}document.title=p.nombre+' · Catálogo';host.innerHTML='<article class="product"><div class="photo">'+photo(p,true)+'</div><div class="info"><span class="tag">'+escape(p.marca)+'</span><h1>'+escape(p.nombre)+'</h1><p>'+escape(p.descripcion)+'</p></div></article>';void navigation(key);return;}
  host.innerHTML='<h1>Catálogo</h1><input class="search" aria-label="Buscar producto" placeholder="Buscar producto…"><p data-loading>Cargando productos…</p><div class="grid"></div>';
  const ids=Object.keys(await read('_index.json')||{}),entries=[];let cursor=0,failed=0;
  const render=()=>{const q=host.querySelector('input').value.toLowerCase();host.querySelector('.grid').innerHTML=entries.filter(([,p])=>(p.nombre+' '+p.marca).toLowerCase().includes(q)).sort((a,b)=>a[1].nombre.localeCompare(b[1].nombre,'es')).map(([id,p])=>'<a class="tile" href="'+href(id)+'">'+photo(p)+'<h2>'+escape(p.nombre)+'</h2></a>').join('');};host.querySelector('input').oninput=render;
  await Promise.all(Array.from({length:Math.min(6,ids.length)},async()=>{while(cursor<ids.length){const id=ids[cursor++];try{const p=await product(id);if(p){entries.push([id,p]);render();}}catch(_){failed++;}}}));
  host.querySelector('[data-loading]').textContent=failed?'Algunos productos no pudieron cargarse. Recargá para reintentar.':entries.length?'':'No hay productos para mostrar.';
 }catch(_){host.textContent='No se pudo cargar el catálogo. Revisá la conexión y recargá la página.';}
})();
