(async function(){
 const host=document.getElementById('content'),base='https://nixa-sisventas-default-rtdb.firebaseio.com/sv_catalogo_publico';
 const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const href=key=>'catalogo.html?producto='+encodeURIComponent(key);
 const photo=p=>/^https:\/\//i.test(p.imagenUrl||'')?'<img src="'+escape(p.imagenUrl)+'" alt="'+escape(p.nombre)+'" loading="lazy">':'<span>Imagen no disponible</span>';
 try{
  const response=await fetch(base+'_index.json',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();
  const ids=Object.keys(await response.json()||{});
  const entries=(await Promise.all(ids.map(async key=>{const r=await fetch(base+'/'+encodeURIComponent(key)+'.json',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});return r.ok?[key,await r.json()]:null;}))).filter(x=>x&&x[1]);
  entries.sort((a,b)=>a[1].nombre.localeCompare(b[1].nombre,'es'));
  const key=new URLSearchParams(location.search).get('producto');
  if(key){const index=entries.findIndex(e=>e[0]===key);if(index<0){host.textContent='Este producto ya no está disponible en el catálogo.';return;}const p=entries[index][1];document.title=p.nombre+' · Catálogo';host.innerHTML='<article class="product"><div class="photo">'+photo(p)+'</div><div class="info"><span class="tag">'+escape(p.marca)+'</span><h1>'+escape(p.nombre)+'</h1><p>'+escape(p.descripcion)+'</p></div></article>'+(entries.length>1?'<nav class="navigation" aria-label="Productos"><a class="btn" href="'+href(entries[(index-1+entries.length)%entries.length][0])+'">← Producto anterior</a><a class="btn" href="'+href(entries[(index+1)%entries.length][0])+'">Producto siguiente →</a></nav>':'');
  }else{host.innerHTML='<h1>Catálogo</h1><input class="search" aria-label="Buscar producto" placeholder="Buscar producto…"><div class="grid"></div>';const render=q=>{host.querySelector('.grid').innerHTML=entries.filter(([,p])=>(p.nombre+' '+p.marca).toLowerCase().includes(q.toLowerCase())).map(([id,p])=>'<a class="tile" href="'+href(id)+'">'+photo(p)+'<h2>'+escape(p.nombre)+'</h2></a>').join('')||'<p>No hay productos para mostrar.</p>';};render('');host.querySelector('input').oninput=e=>render(e.target.value);}
 }catch(_){host.textContent='No se pudo cargar el catálogo. Revisá la conexión y recargá la página.';}
})();
