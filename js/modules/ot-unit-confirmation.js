(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SVOTUnitReviewFactory = api;
  if (!root || !root.document) return;
  const controller = api.create({
    document: root.document,
    scan: options => {if(!root.SVSerialCamera)throw Error('El lector no está disponible. Podés escribir la serie.');return root.SVSerialCamera.open(options);},
    closeScanner: () => root.SVSerialCamera?.close(),
    model: root.SVOTUnitConfirmation,
    today: () => root.svFechaLocalISO(),
    context() {
      const valid = root.svCapturarContextoOperacion?.();
      const user = root.fbAuth?.currentUser, view = root._impersonacionOriginal;
      const route = root.location.hash, otId = root.otActualId;
      return () => !!user && user === root.fbAuth?.currentUser && !view && view === root._impersonacionOriginal &&
        route === root.location.hash && otId === root.otActualId && (!valid || valid());
    },
    async request(action, body, signal) {
      if (root._impersonacionOriginal) throw Error('Volvé a tu cuenta para confirmar las unidades.');
      const valid = root.svCapturarContextoOperacion?.(), user = root.fbAuth?.currentUser;
      const route = root.location.hash, otId = root.otActualId;
      const live = () => !!user && user === root.fbAuth?.currentUser && !root._impersonacionOriginal &&
        route === root.location.hash && otId === root.otActualId && !signal.aborted && (!valid || valid());
      if (!live()) throw Error('La sesión o la OT cambiaron. Volvé a preparar las unidades.');
      const base = root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;
      if (!base || !root.SVServiceAuth?.headers) throw Error('No se pudo conectar con la confirmación de unidades.');
      const url = new URL(base);
      url.pathname = url.pathname.replace(/\/$/, '') + '/ot/unidades/' + action;
      url.search = ''; url.hash = '';
      const headers = await root.SVServiceAuth.headers({'Content-Type':'application/json'});
      if (!live()) throw Error('La sesión o la OT cambiaron. Volvé a preparar las unidades.');
      const response = await root.fetch(url.href, {method:'POST', headers, body:JSON.stringify(body), signal:AbortSignal.any([signal, AbortSignal.timeout(45000)]), cache:'no-store', credentials:'omit', redirect:'error'});
      const data = await response.json();
      if (!live()) throw Error('La sesión o la OT cambiaron. Volvé a preparar las unidades.');
      if (!response.ok || data.ok === false) throw Error(data.mensaje || 'No se pudo confirmar la revisión.');
      return data;
    }
  });
  root.SVOTUnitReview = controller;
  root.garantiaRevisarCierreOT = function(ot) {
    if (!ot || isClaim(ot) || !(ot.ventaFbKey || ot.ventaKey || ot.ventaId || ot.venta)) return Promise.resolve({skip:true});
    if (!root.tienePermiso?.('equipos.confirmarInstalacion')) return Promise.resolve({skip:true});
    return controller.open(ot, {closing:true});
  };
  root.garantiaPrepararOT = function() {
    const ot = (root.otData || []).find(row => row.id === root.otActualId || row.fbKey === root.otActualId);
    if (!ot) return;
    if (isClaim(ot)) { root.notify('El reclamo conserva las garantías originales; no se vuelven a generar.'); return; }
    return controller.open(ot);
  };
  const previous = root.garantiaAbrirUnidades;
  root.garantiaAbrirUnidades = function(venta, ot, options) {
    if (ot) {
      if (isClaim(ot)) { if (!options?.automatica) root.notify('El reclamo conserva las garantías originales.'); return; }
      return controller.open(ot);
    }
    return previous?.(venta, ot, options);
  };
  function isClaim(ot) {
    return String(ot.origen || '').toLowerCase() === 'reclamo' || ot.reclamoKey || ot.reclamoFbKey || ot.reclamoId ||
      /reclamo|post.?venta/i.test(ot.tipoVisita || '');
  }
})(typeof window === 'object' ? window : null, function() {
  'use strict';
  function create({document, model, today, context, request, scan, closeScanner}) {
    let active = null;
    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function button(text, className, action) {
      const node = element('button', className || 'btn', text);
      node.type = 'button'; node.addEventListener('click', action); return node;
    }
    function close(state, result) {
      if (active !== state) return;
      active = null;
      if(state.cameraOpen){state.cameraOpen=false;closeScanner?.();}
      state.abort.abort();
      ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed'].forEach(name => document.removeEventListener(name, state.retire));
      state.dialog.close(); state.dialog.remove();
      if (state.focus?.isConnected && typeof state.focus.focus === 'function') state.focus.focus({preventScroll:true});
      state.resolve(result);
    }
    function current(state) {
      return active === state && state.valid() && state.dialog.isConnected && !state.abort.signal.aborted;
    }
    function message(state, text, error) {
      state.status.textContent = text;
      state.status.className = 'ot-unit-status' + (error ? ' is-error' : '');
      state.status.setAttribute('role', error ? 'alert' : 'status');
    }
    function busy(state, on, text) {
      state.busy = on;
      state.dialog.setAttribute('aria-busy', String(on));
      state.dialog.classList.toggle('is-busy', on);
      state.controls.forEach(node => { node.disabled = on; });
      if (!on) state.rows?.forEach(row => row.sync?.());
      state.cancel.disabled = on && state.saving;
      state.confirm.disabled = on || !state.ready;
      state.confirm.textContent = text || (state.closing ? 'Confirmar y continuar cierre' : 'Guardar confirmación');
      state.spinner.hidden = !on;
    }
    function errorText(error) { return error?.message || 'No se pudo completar. Podés volver a intentar.'; }
    function render(state, data) {
      if (!data || !data.sale || typeof data.revision !== 'string') throw Error('No se pudo comprobar el detalle de las unidades.');
      state.data = data;
      state.plan = model.build(data.sale, {isLabor:item => item.esManoDeObra === true, unitOf:item => item.unidad});
      const summaries = state.plan.summaries.filter(summary => summary.reason !== 'labor');
      const units = state.plan.units.concat(summaries.map(summary => ({itemKey:summary.itemKey,n:null,item:summary.item,config:summary.item.garantiaConfig || null,key:null,needsReview:true,reason:summary.reason,summary:true})));
      state.body.replaceChildren(); state.rows = []; state.controls = [];
      const intro = element('p', 'ot-unit-intro', 'Indicá qué pasó con cada unidad. La garantía conserva las condiciones de la venta.');
      state.body.append(intro);
      const dateLabel = element('label', 'ot-unit-date', 'Fecha efectiva');
      state.date = element('input', 'search-input'); state.date.type = 'date'; state.date.value = today();
      state.date.max = today(); dateLabel.append(state.date); state.body.append(dateLabel); state.controls.push(state.date);
      for (const [index, unit] of units.entries()) {
        const card = element('section', 'ot-unit-card');
        const name = unit.item.desc || unit.item.descripcion || unit.item.nombre || unit.item.cod || unit.item.codigo || 'Producto';
        const unitLabel = unit.summary ? ' · Material (' + (unit.item.qty ?? unit.item.cantidad ?? 'cantidad sin definir') + ' ' + (unit.item.unidad || '') + ')' : ' · Unidad ' + (unit.n + 1);
        const heading = element('h3', '', name + unitLabel);
        card.append(heading);
        const descriptors = Array.isArray(data.manualUnits) ? data.manualUnits.filter(row => row && row.itemKey === unit.itemKey && row.n === unit.n && model.key(row.key)) : [];
        if (descriptors.length === 1) {unit.manualKey = descriptors[0].key;if(descriptors[0].knownTerms)unit.config={...(unit.config||{}),...descriptors[0].knownTerms};}
        const original = key => key && data.existing && Object.prototype.hasOwnProperty.call(data.existing, key) ? data.existing[key] : null;
        const existing = original(unit.key) || original(unit.manualKey);
        if (existing) {
          const record = existing.record || existing;
          card.classList.add('is-existing');
          card.append(element('p', 'ot-unit-existing', 'Ya registrada · Se conserva sin cambios.'));
          card.append(element('p', 'ot-unit-meta', [record.serie && 'Serie: ' + record.serie, (record.dir || record.ubicacion) && 'Ubicación: ' + (record.dir || record.ubicacion), record.fechaVenc && 'Vencimiento: ' + record.fechaVenc].filter(Boolean).join(' · ')));
          if (record.manualConfirmado === true) card.append(element('p', 'ot-unit-meta', [record.garantiaEstado === 'no' ? 'Sin garantía' : record.garantiaEstado === 'si' && Number.isInteger(record.garantiaMeses) ? record.garantiaMeses + ' meses de garantía' : '', record.garantiaInicio === 'entrega' ? 'Desde la entrega' : record.garantiaInicio === 'instalacion' ? 'Desde la instalación' : '', record.fechaManual && 'Fecha confirmada: ' + record.fechaManual].filter(Boolean).join(' · ')));
          state.body.append(card); continue;
        }
        let warning;
        if (unit.needsReview || unit.creationBlocked) { warning = element('p', 'ot-unit-warning', unit.summary ? 'Material sin seguimiento individual. Se anota el resultado técnico, sin crear equipos ni cobertura por unidad.' : 'Condiciones o identidad histórica pendientes de revisión. Se anota el trabajo técnico, sin iniciar una garantía.'); card.append(warning); }
        else card.append(element('p', 'ot-unit-meta', unit.config.estado === 'si' ? unit.config.meses + ' meses · Desde ' + (unit.config.inicio === 'entrega' ? 'la entrega confirmada' : 'la instalación confirmada') : 'Sin garantía en las condiciones de la venta.'));
        const label = element('label', 'ot-unit-decision', unit.summary ? 'Resultado del material' : '¿Se instaló esta unidad?');
        const select = element('select', 'search-input'); select.setAttribute('aria-label', name + unitLabel + ': resultado');
        for (const [value, text] of [['','Elegí el resultado…'],['instalado','Sí, instalada'],['entregado','No, entregada sin instalar'],['pendiente','No, quedó pendiente']]) {
          const option = element('option', '', text); option.value = value; select.append(option);
        }
        label.append(select); card.append(label);
        const fields = element('div', 'ot-unit-fields');
        const serieLabel = element('label', '', 'Número de serie' + (unit.config?.serie ? ' · obligatorio' : ''));
        const serie = element('input', 'search-input'); serie.type = 'text'; serie.maxLength = 200; serie.autocomplete = 'off'; serieLabel.append(serie);
        if(descriptors.length===1&&descriptors[0].knownSerie){serie.value=descriptors[0].knownSerie;serie.readOnly=true;}
        const locationLabel = element('label', '', 'Ubicación');
        const location = element('input', 'search-input'); location.type = 'text'; location.maxLength = 300; location.placeholder = 'Ej.: acceso principal'; locationLabel.append(location);
        const scanButton=button('Escanear serie','btn ot-unit-scan',()=>{
          if(!current(state)||state.busy||serie.disabled||serie.readOnly)return;
          if(typeof scan!=='function'){message(state,'El lector no está disponible. Podés escribir la serie.',true);serie.focus({preventScroll:true});return;}
          const original=serie.value;
          try{state.cameraOpen=true;scan({label:name+unitLabel,kind:'serial',onRead:value=>{
            state.cameraOpen=false;
            if(!current(state)||state.busy||!serie.isConnected||serie.disabled||serie.readOnly)return;
            if(typeof value!=='string'||!value.trim()||value.trim().length>120||/[\u0000-\u001f\u007f]/.test(value)){message(state,'La lectura no es una serie válida. Volvé a escanear o escribila.',true);return;}
            const next=value.trim();
            if(serie.value!==original&&serie.value!==next){message(state,'La serie cambió mientras se leía. Revisala antes de volver a escanear.',true);return;}
            const duplicate=state.rows.find(other=>other.serie!==serie&&other.select.value!=='pendiente'&&other.serie.value.trim().toLocaleUpperCase('es-AR')===next.toLocaleUpperCase('es-AR'));
            if(duplicate){message(state,'Esa serie ya está cargada en otra unidad. Revisá las etiquetas.',true);duplicate.serie.focus({preventScroll:true});return;}
            serie.value=next;message(state,'Serie leída. Revisala antes de guardar.');serie.focus({preventScroll:true});
          }});}catch(error){state.cameraOpen=false;message(state,errorText(error),true);serie.focus({preventScroll:true});}
        });
        scanButton.setAttribute('aria-label','Escanear serie de '+name+unitLabel);
        const serialBox=element('div','ot-unit-serial');serialBox.append(serieLabel,scanButton);
        fields.append(serialBox, locationLabel); card.append(fields);
        const detail = element('p', 'ot-unit-meta'); card.append(detail);
        const row = {unit, select, serie, location, fields, index, scanButton};
        if (data.capabilities?.manualReview === true && model.key(unit.manualKey) && model.canReviewManually?.(unit)) {
          const manual = {active:false, controls:[]}; row.manual = manual;
          manual.toggle = button('Revisar condiciones', 'btn ot-unit-manual-toggle', () => {
            if (state.busy || !['instalado','entregado'].includes(select.value)) return;
            manual.active = !manual.active; row.sync();
            if (manual.active) manual.estado.focus({preventScroll:true});
          });
          manual.toggle.setAttribute('aria-expanded', 'false');
          manual.form = element('div', 'ot-unit-manual-form'); manual.form.id = 'ot-unit-manual-' + index; manual.form.hidden = true;
          manual.toggle.setAttribute('aria-controls', manual.form.id);
          manual.form.append(element('p', 'ot-unit-meta', 'Completá las condiciones de esta unidad y la fecha en que fue instalada o entregada.'));
          const grid = element('div', 'ot-unit-manual-grid');
          const field = (fieldName, title, type, options) => {
            const label = element('label', '', title), input = element(options ? 'select' : 'input', 'search-input');
            if (options) for (const [value, text] of [['','Seleccionar…'], ...options]) { const option = element('option', '', text); option.value = value; input.append(option); }
            else { input.type = type; input.value = ''; }
            input.setAttribute('aria-label', name + unitLabel + ': ' + title); input.required = true; input.disabled = true;
            label.append(input); grid.append(label); manual[fieldName] = input; manual.controls.push(input); return input;
          };
          field('estado', 'Garantía', '', [['si','Sí'],['no','No']]);
          const months = field('meses', 'Meses de garantía', 'number'); months.min = '1'; months.max = '120'; months.step = '1';
          field('inicio', 'Inicio de la garantía', '', [['instalacion','Instalación'],['entrega','Entrega']]);
          field('serie', '¿Requiere número de serie?', '', [['si','Sí'],['no','No']]);
          field('fecha', 'Fecha de instalación o entrega', 'date').max = today();
          manual.fixed = [];
          const original = unit.config || {};
          for (const [field,value] of Object.entries(original)) {
            const valid = field==='estado'?['si','no'].includes(value):field==='meses'?Number.isInteger(value)&&value>=1&&value<=120&&original.estado==='si':field==='inicio'?['instalacion','entrega'].includes(value)&&original.estado==='si':field==='serie'?typeof value==='boolean':false;
            if(valid&&manual[field]){manual[field].value=field==='serie'?(value?'si':'no'):String(value);manual.fixed.push(manual[field]);}
          }
          manual.form.append(grid);
          const consent = element('label', 'ot-unit-manual-consent'); manual.confirmado = element('input'); manual.confirmado.type = 'checkbox'; manual.confirmado.checked = false; manual.confirmado.disabled = true;
          manual.confirmado.setAttribute('aria-label', name + unitLabel + ': Confirmo las condiciones de esta unidad');
          consent.append(manual.confirmado, element('span', '', 'Confirmo las condiciones de esta unidad')); manual.controls.push(manual.confirmado); manual.form.append(consent);
          manual.estado.addEventListener('change', () => row.sync());
          manual.serie.addEventListener('change', () => row.sync());
          card.append(manual.toggle, manual.form); state.controls.push(manual.toggle, ...manual.controls);
        }
        row.sync = () => {
          const pending = select.value === '' || select.value === 'pendiente';
          fields.hidden = pending; serie.disabled = state.busy || pending; location.disabled = state.busy || pending;
          scanButton.disabled=!!(state.busy||pending||serie.readOnly);
          location.required = select.value === 'instalado';
          if (row.manual) {
            const manual = row.manual;
            if (pending) manual.active = false;
            manual.toggle.disabled = state.busy || pending;
            manual.toggle.setAttribute('aria-expanded', String(manual.active)); manual.form.hidden = !manual.active;
            if (warning) warning.textContent = manual.active ? 'Las condiciones se aplicarán a esta unidad según el resultado y la fecha confirmados.' : 'Condiciones o identidad histórica pendientes de revisión. Se anota el trabajo técnico, sin iniciar una garantía.';
            manual.controls.forEach(node => { node.disabled = state.busy || !manual.active; });
            manual.meses.disabled = manual.inicio.disabled = state.busy || !manual.active || manual.estado.value !== 'si';
            manual.meses.required = manual.inicio.required = manual.active && manual.estado.value === 'si';
            manual.fixed.forEach(node=>{node.disabled=true;});
          }
          serie.required = !pending && (row.manual?.active ? row.manual.serie.value === 'si' : unit.config?.serie === true);
          detail.textContent = select.value === 'pendiente' ? 'Queda pendiente. No se crea un equipo ni comienza la cobertura.' :
            select.value === 'entregado' && (row.manual?.active ? row.manual.inicio.value === 'instalacion' && row.manual.estado.value === 'si' : unit.config?.inicio === 'instalacion') ? 'La cobertura espera la confirmación de la instalación.' : '';
        };
        select.addEventListener('change', row.sync);
        fields.hidden = true; serie.disabled = true; location.disabled = true;
        state.rows.push(row); state.controls.push(select, serie, location, scanButton);
        state.body.append(card);
      }
      if (state.plan.summaries?.length) {
        const note = element('details', 'ot-unit-summaries'); note.append(element('summary', '', 'Materiales y servicios: ' + state.plan.summaries.length + ' renglones'));
        for (const summary of state.plan.summaries) note.append(element('p', 'ot-unit-meta', summary.item?.desc || summary.item?.nombre || summary.description || 'Material o servicio sin seguimiento por unidad.'));
        state.body.append(note);
      }
      if (state.plan.issues?.some(issue => issue.blocking)) {
        const omitted = state.plan.issues.reduce((sum, issue) => sum + (issue.omitted || 0), 0);
        state.body.append(element('p', 'ot-unit-warning', omitted ? 'Esta revisión muestra hasta ' + model.MAX_UNITS + ' unidades; faltan ' + omitted + ' por revisar. No se generan coberturas en este lote. Pedí a administración que separe las cantidades.' : 'Revisá las condiciones pendientes de cada unidad. Las garantías se registran únicamente después de confirmarlas.'));
      }
      state.ready = true;
      message(state, state.rows.length ? 'Sin selección automática: revisá cada unidad antes de confirmar.' : 'Las unidades ya registradas conservan su cobertura.');
      busy(state, false);
      if (!units.length && !state.plan.issues?.some(issue => issue.blocking)) close(state, {skip:true});
      else state.rows[0]?.select.focus({preventScroll:true});
    }
    async function prepare(state) {
      if (!current(state)) { if (active === state) close(state, false); return; }
      busy(state, true, 'Cargando unidades…');
      message(state, 'Comprobando la OT y sus unidades…');
      try {
        const data = await request('preparar', {otKey:state.otKey}, state.abort.signal);
        if (!current(state)) { if (active === state) close(state, false); return; }
        render(state, data);
      } catch (error) {
        if (!current(state)) { if (active === state) close(state, false); return; }
        state.ready = false; busy(state, false); message(state, errorText(error), true);
        state.retryFocus = button('Volver a cargar', 'btn', () => prepare(state));
        state.body.replaceChildren(state.retryFocus);
        state.cancel.disabled = false;
      }
    }
    async function confirm(state) {
      if (!current(state) || state.busy || !state.ready) return;
      const units = [],serials=new Map();
      let warrantyReviewPendingCount = 0;
      try {
        for (const row of state.rows) {
          const value = {decision:row.select.value, serie:row.serie.value.trim(), ubicacion:row.location.value.trim()};
          try {
            let unit = row.unit, effectiveDate = state.date.value;
            if (row.manual?.active) {
              const manual = row.manual;
              const missing = (node, text) => { node.focus({preventScroll:true}); throw Error(text); };
              if (state.data.capabilities?.manualReview !== true || !model.canReviewManually?.(unit)) throw Error('Tu rol no permite revisar las condiciones de esta unidad.');
              if (!['instalado','entregado'].includes(value.decision)) missing(row.select, 'Elegí instalada o entregada para revisar sus condiciones.');
              if (!['si','no'].includes(manual.estado.value)) missing(manual.estado, 'Elegí si esta unidad tiene garantía.');
              if (manual.estado.value === 'si' && (!/^[1-9]\d*$/.test(manual.meses.value) || Number(manual.meses.value) > 120)) missing(manual.meses, 'Ingresá de 1 a 120 meses de garantía.');
              if (manual.estado.value === 'si' && !['instalacion','entrega'].includes(manual.inicio.value)) missing(manual.inicio, 'Elegí cuándo comienza la garantía.');
              if (!['si','no'].includes(manual.serie.value)) missing(manual.serie, 'Elegí si esta unidad requiere número de serie.');
              if (!model.date(manual.fecha.value) || manual.fecha.value > today()) missing(manual.fecha, 'Ingresá la fecha real de instalación o entrega, válida y no futura.');
              if (manual.confirmado.checked !== true) missing(manual.confirmado, 'Confirmá las condiciones de esta unidad antes de guardar.');
              value.manual = {confirmado:true, estado:manual.estado.value, meses:manual.estado.value === 'si' ? Number(manual.meses.value) : 0, inicio:manual.estado.value === 'si' ? manual.inicio.value : '', serie:manual.serie.value === 'si', fecha:manual.fecha.value};
              unit = model.manualUnit(unit, value.manual, today()); effectiveDate = value.manual.fecha;
            }
            const result = model.decision(unit, value, effectiveDate, today());
            const target = result.needsReview || result.decision === 'pendiente' ? 'reviewOT' : result.decision === 'instalado' ? 'equipos' : result.cobertura ? 'garantias' : 'reviewOT';
            if (state.data.capabilities?.[target] !== true) throw Error(target === 'garantias' ? 'Tu rol no permite registrar garantías de entrega. Pedí a administración que confirme esta unidad.' : 'Tu rol no permite guardar este resultado de la OT.');
            if (!row.unit.summary && result.needsReview) warrantyReviewPendingCount++;
          }
          catch (error) {
            if (error.reason === 'required-series') row.serie.focus({preventScroll:true});
            else if (error.reason === 'required-location') row.location.focus({preventScroll:true});
            else if (!row.manual?.active || !row.manual.controls.includes(document.activeElement)) row.select.focus({preventScroll:true});
            throw error;
          }
          if(value.decision!=='pendiente'&&value.serie){const serial=value.serie.toLocaleUpperCase('es-AR');if(serials.has(serial)){row.serie.focus({preventScroll:true});throw Error('La misma serie está cargada en dos unidades. Revisá las etiquetas.');}serials.set(serial,row);}
          units.push({itemKey:row.unit.itemKey, n:row.unit.n, ...value});
        }
        if (!model.date(state.date.value) || state.date.value > today()) throw Error('Ingresá una fecha efectiva válida, no futura.');
      } catch (error) { message(state, errorText(error), true); return; }
      state.saving = true;
      busy(state, true, 'Guardando confirmación…'); message(state, 'Comprobando cambios y registrando las unidades…');
      try {
        const result = await request('confirmar', {otKey:state.otKey, revision:state.data.revision, fecha:state.date.value, units}, state.abort.signal);
        if (!current(state)) { if (active === state) close(state, false); return; }
        // UI-only summary of validated rows, exposed after acknowledgement.
        // It is neither submitted nor persisted and never asserts coverage.
        close(state, warrantyReviewPendingCount > 0 ? {...result, warrantyReviewPendingCount} : result);
      } catch (error) {
        if (!current(state)) { if (active === state) close(state, false); return; }
        state.saving = false;
        busy(state, false);
        // Unknown acknowledgement is never a successful close. The same unit
        // identities allow an explicit retry to preserve an earlier commit.
        message(state, errorText(error) + ' La OT todavía no se cerró.', true);
      }
    }
    function open(ot, options) {
      if (active && active.otKey === ot?.fbKey) return active.promise;
      if (active) close(active, false);
      if (!model || !ot?.fbKey) return Promise.resolve(false);
      const dialog = element('dialog', 'ot-unit-dialog'); dialog.id = 'ot-unit-confirmation-dialog';
      dialog.setAttribute('aria-labelledby', 'ot-unit-title');
      const header = element('header', 'ot-unit-head');
      header.append(element('h2', '', options?.closing ? 'Antes de finalizar la OT' : 'Equipos de la OT'));
      header.firstChild.id = 'ot-unit-title';
      const state = {dialog, otKey:ot.fbKey, closing:!!options?.closing, focus:document.activeElement, valid:context(), abort:new AbortController(), ready:false, busy:false, controls:[]};
      state.promise = new Promise(resolve => { state.resolve = resolve; });
      state.retire = () => close(state, false);
      state.body = element('div', 'ot-unit-body');
      state.status = element('p', 'ot-unit-status'); state.status.setAttribute('aria-live', 'polite');
      const footer = element('footer', 'ot-unit-footer');
      state.cancel = button('Cancelar', 'btn', () => { if (!state.saving) close(state, false); });
      const save = element('span', 'ot-unit-save'); state.spinner = element('span', 'ot-unit-spinner'); state.spinner.setAttribute('aria-hidden','true');
      state.confirm = button('Confirmar y continuar cierre', 'btn btn-primary', () => confirm(state));
      save.append(state.spinner, state.confirm); footer.append(state.cancel, save);
      dialog.append(header, state.body, state.status, footer);
      dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const first = state.ready ? state.date : state.retryFocus || state.cancel;
        const last = state.confirm.disabled ? state.cancel : state.confirm;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last.focus({preventScroll:true});
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus({preventScroll:true});
        }
      });
      dialog.addEventListener('cancel', event => { event.preventDefault(); if (!state.saving) close(state, false); });
      active = state;
      ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed'].forEach(name => document.addEventListener(name, state.retire));
      document.body.append(dialog); dialog.showModal(); prepare(state);
      return state.promise;
    }
    return Object.freeze({open, cancel:() => { if (active && !active.saving) close(active, false); }});
  }
  return Object.freeze({create});
});
