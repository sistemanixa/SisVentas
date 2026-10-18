(function(root){
 'use strict';let current=null;
 function open(options){
  if(current?.isConnected){current.focus();return;}
  const d=document.createElement('dialog');current=d;d.className='sv-product-ranking';d.setAttribute('aria-labelledby','product-ranking-title');
  const heading=document.createElement('div');heading.className='sv-ranking-head';heading.innerHTML='<h2 id="product-ranking-title">Más vendidos</h2><button class="icon-btn" type="button" aria-label="Cerrar ranking"><span aria-hidden="true" style="font-size:24px;line-height:1">×</span></button>';d.appendChild(heading);heading.querySelector('button').onclick=()=>d.close();
  const body=document.createElement('div');body.className='sv-ranking-body';d.appendChild(body);
  const label=document.createElement('label');label.className='sv-ranking-period';label.textContent='Período';const select=document.createElement('select');select.setAttribute('aria-label','Período del ranking');for(const [value,text]of [[1,'Último mes'],[3,'Últimos 3 meses'],[6,'Últimos 6 meses'],[12,'Último año']]){const op=document.createElement('option');op.value=value;op.textContent=text;select.appendChild(op);}label.appendChild(select);body.appendChild(label);
  const dates=document.createElement('p');dates.className='sv-ranking-dates';dates.setAttribute('aria-live','polite');body.appendChild(dates);
  const note=document.createElement('p');note.className='sv-ranking-note';note.textContent='Top 50 · Cada producto cuenta una vez por venta. Sin mano de obra.';body.appendChild(note);
  const list=document.createElement('ol');list.className='sv-ranking-list';body.appendChild(list);
  function draw(){const range=root.SVProductRanking.periodRange(select.value),rows=options.ranking(Number(select.value));const format=s=>new Date(s+'T12:00:00').toLocaleDateString('es-AR');dates.textContent='Del '+format(range.from)+' al '+format(range.to)+' · '+rows.length+' producto'+(rows.length===1?'':'s');list.replaceChildren();
   for(const r of rows){const row=document.createElement('li');row.className='sv-ranking-row';const pos=document.createElement('span');pos.className='sv-ranking-position';pos.textContent=r.position;row.appendChild(pos);const image=document.createElement('img');image.alt='';image.loading='lazy';const src=options.image?.(r.product);if(src){image.src=src;image.onerror=()=>{image.removeAttribute('src');image.classList.add('empty');};}else image.classList.add('empty');row.appendChild(image);
    const name=document.createElement('div'),title=document.createElement('strong'),code=document.createElement('small');title.textContent=r.product.nombre||r.product.descripcion||'Producto';code.textContent=r.product.codigo||r.product.cod||'';name.append(title,code);row.appendChild(name);const count=document.createElement('span');count.className='sv-ranking-sales';const n=document.createElement('strong'),caption=document.createElement('small');n.textContent=r.sales;caption.textContent=r.sales===1?'venta':'ventas';count.append(n,caption);row.appendChild(count);list.appendChild(row);}
   if(!rows.length){const empty=document.createElement('li');empty.className='sv-ranking-empty';empty.textContent='No hay ventas de productos en este período.';list.appendChild(empty);}
  }
  select.onchange=draw;draw();const previous=document.activeElement,overflow=document.body.style.overflow;document.body.appendChild(d);document.body.style.overflow='hidden';d.addEventListener('close',()=>{document.body.style.overflow=overflow;d.remove();current=null;if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.showModal();select.focus();
 }
 root.SVProductRankingDialog={open};
})(window);
