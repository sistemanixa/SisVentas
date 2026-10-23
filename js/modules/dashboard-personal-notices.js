(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SVPersonalNoticesView = api;
})(typeof window === 'object' ? window : null, function() {
  'use strict';
  var mounts = new WeakMap();
  var money = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', minimumFractionDigits:2, maximumFractionDigits:2 });
  var months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var types = [
    { key:'bonificacion', title:'Tus bonificaciones', subject:'bonificación', icon:'🎉', button:'Ver bonificaciones' },
    { key:'comision', title:'Tus comisiones', subject:'comisión', icon:'🙌', button:'Ver comisiones' }
  ];
  function amount(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? money.format(value) : null; }
  function node(doc, tag, name, text) {
    var element = doc.createElement(tag);
    if (name) element.className = name;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }
  function period(value) {
    var match = String(value || '').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    return match ? months[Number(match[2]) - 1] + ' de ' + match[1] : '';
  }
  function date(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    var parsed = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) return '';
    return match[3] + '/' + match[2] + '/' + match[1];
  }
  function clear(container) {
    if (!container || typeof container.replaceChildren !== 'function') return false;
    var mounted = mounts.get(container);
    if (mounted) {
      mounted.active = false;
      mounted.buttons.forEach(function(entry) { entry.button.removeEventListener('click', entry.handler); });
      mounts.delete(container);
    }
    container.replaceChildren();
    container.hidden = true;
    container.classList.remove('personal-notices');
    container.removeAttribute('aria-busy');
    container.removeAttribute('data-personal-notices-state');
    return true;
  }
  function message(doc, container, status) {
    var texts = {
      loading:['Cargando tu cuenta…','Esperando los movimientos de tu cuenta.'],
      error:['No se pudo cargar tu cuenta','Las bonificaciones y comisiones no pudieron confirmarse.'],
      incomplete:['Información incompleta','Faltan datos para confirmar los movimientos de tu cuenta.']
    };
    var copy = texts[status], box = node(doc, 'div', 'personal-notices-state personal-notices-state--' + status);
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.append(node(doc, 'strong', '', copy[0]), node(doc, 'span', '', copy[1]));
    container.append(box);
  }
  function movement(doc, item, type) {
    var state = ['aprobado','pagado_parcial','pagado','pendiente'].includes(item.status) ? item.status : 'pendiente';
    var unknownPaid = item.paidAmountUnknown === true;
    var headings = {
      aprobado:'¡Tenés una nueva ' + type.subject + ' aprobada!',
      pagado_parcial:'Tu ' + type.subject + ' tiene un pago parcial',
      pagado:unknownPaid ? 'Tu ' + type.subject + ' figura marcada como pagada' : '¡Tu ' + type.subject + ' ya está pagada!',
      pendiente:'Tenés una ' + type.subject + ' pendiente de aprobación'
    };
    var row = node(doc, 'li', 'personal-notices-item');
    row.setAttribute('data-personal-notice-id', String(item.id || ''));
    row.setAttribute('data-personal-notice-status', state);
    row.append(node(doc, 'h3', 'personal-notices-title', headings[state]));
    var value = amount(item.amount);
    var summary = node(doc, 'p', 'personal-notices-summary');
    summary.append(node(doc, 'span', 'personal-notices-description', item.description || (type.key === 'bonificacion' ? 'Bonificación' : 'Comisión')),
      node(doc, 'span', '', ' · ' + (state === 'pendiente' ? 'Importe informado · ARS ' : 'ARS ')),
      node(doc, 'strong', 'personal-notices-amount', value || 'Importe por confirmar'));
    row.append(summary);
    var details = [];
    var computed = period(item.period), granted = date(item.date);
    details.push(computed ? 'Cómputo: ' + computed : 'Mes de cómputo sin confirmar');
    if (granted) details.push('Fecha: ' + granted);
    var unit = amount(item.unitAmount);
    if (typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 && unit !== null) {
      details.push(new Intl.NumberFormat('es-AR', { maximumFractionDigits:6 }).format(item.quantity) + ' × ' + unit + ' por unidad');
    }
    row.append(node(doc, 'p', 'personal-notices-detail', details.join(' · ')));
    if (state === 'pendiente') {
      row.append(node(doc, 'p', 'personal-notices-note', 'Pendiente de aprobación; el importe todavía no está autorizado.'));
    } else if (unknownPaid) {
      row.append(node(doc, 'p', 'personal-notices-note', 'Importe abonado sin confirmar.'));
    } else if (state === 'pagado_parcial') {
      var payments = ['Pago parcial'];
      var paid = amount(item.paidAmount), remaining = amount(item.remaining);
      if (paid !== null && item.paidAmount > 0) payments.push('Pagado: ' + paid);
      if (remaining !== null && item.remaining > 0) payments.push('Pendiente de pago: ' + remaining);
      row.append(node(doc, 'p', 'personal-notices-detail', payments.join(' · ')));
    }
    return row;
  }
  function render(container, state, options) {
    if (!container || !container.ownerDocument || typeof container.replaceChildren !== 'function') return false;
    var doc = container.ownerDocument, previous = mounts.get(container), focusedType = '';
    if (previous) previous.buttons.forEach(function(entry) { if (doc.activeElement === entry.button) focusedType = entry.type; });
    clear(container);
    state = state || {}; options = options || {};
    var status = ['ready','loading','error','incomplete','none'].includes(state.status) ? state.status : 'incomplete';
    container.setAttribute('data-personal-notices-state', status);
    if (status === 'none') return true;
    container.hidden = false;
    container.classList.add('personal-notices');
    container.setAttribute('aria-busy', String(status === 'loading'));
    var items = Array.isArray(state.items) ? state.items : [];
    var verified = items.some(function(item) { return item && ['bonificacion','comision'].includes(item.type); });
    if (status === 'ready' && !verified && !(Array.isArray(state.issues) && state.issues.length)) {
      container.hidden = true;
      return true;
    }
    if (status !== 'ready' && !(status === 'incomplete' && verified)) { message(doc, container, status); return true; }
    var mounted = { active:true, buttons:[] };
    mounts.set(container, mounted);
    if (status === 'incomplete') {
      var partial = node(doc, 'p', 'personal-notices-issues', 'Hay movimientos por confirmar; mostramos sólo los verificados.');
      partial.setAttribute('role', 'status'); container.append(partial);
    }
    types.forEach(function(type) {
      var matching = items.filter(function(item) { return item && item.type === type.key; });
      if (!matching.length) return;
      var card = node(doc, 'section', 'personal-notices-card personal-notices-card--' + type.key);
      card.setAttribute('aria-label', type.title);
      var icon = node(doc, 'span', 'personal-notices-icon', matching[0].status === 'pendiente' ? '⏳' : type.icon);
      icon.setAttribute('aria-hidden', 'true');
      card.append(icon);
      var content = node(doc, 'div', 'personal-notices-content');
      var list = node(doc, 'ul', 'personal-notices-list');
      matching.slice(0,1).forEach(function(item) { list.append(movement(doc, item, type)); });
      content.append(list);
      if (matching.length > 1) content.append(node(doc, 'p', 'personal-notices-more', (matching.length - 1) + ' movimiento' + (matching.length - 1 === 1 ? '' : 's') + ' reciente' + (matching.length - 1 === 1 ? '' : 's') + ' más en tu cuenta.'));
      card.append(content);
      if (options.canOpen === true && typeof options.onOpen === 'function') {
        var button = node(doc, 'button', 'personal-notices-open', type.button);
        button.type = 'button';
        button.setAttribute('data-personal-notices-open', type.key);
        var handler = function() {
          if (mounted.active && mounts.get(container) === mounted && !container.hidden && !button.disabled) options.onOpen(type.key, button);
        };
        button.addEventListener('click', handler);
        mounted.buttons.push({ type:type.key, button:button, handler:handler });
        card.append(button);
      }
      container.append(card);
    });
    if (status === 'ready' && Array.isArray(state.issues) && state.issues.length) {
      var warning = node(doc, 'p', 'personal-notices-issues', 'Hay movimientos por revisar. Se conserva la información disponible.');
      warning.setAttribute('role', 'status'); container.append(warning);
    }
    if (focusedType) {
      var next = mounted.buttons.find(function(entry) { return entry.type === focusedType; });
      if (next) next.button.focus({ preventScroll:true });
    }
    return true;
  }
  return Object.freeze({ render:render, clear:clear });
});
