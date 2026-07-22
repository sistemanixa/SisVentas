(function(){
  function e(id){ return document.getElementById(id); }
  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function hoyISO(){ return new Date().toISOString().slice(0,10); }
  function fechaISO(v){
    if(!v) return '';
    var s = String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if(m) return m[3] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[1]).padStart(2,'0');
    return s.slice(0,10);
  }
  function inicioSemana(d){
    var x = new Date(d + 'T00:00:00');
    var day = x.getDay();
    var diff = (day === 0 ? -6 : 1 - day);
    x.setDate(x.getDate() + diff);
    return x.toISOString().slice(0,10);
  }
  function finSemana(d){
    var x = new Date(inicioSemana(d) + 'T00:00:00');
    x.setDate(x.getDate() + 6);
    return x.toISOString().slice(0,10);
  }
  function matchPeriodoOT(o, periodo){
    if(!periodo || periodo === 'todos') return true;
    var f = fechaISO(o && o.fecha);
    if(!f) return false;
    var h = hoyISO();
    if(periodo === 'hoy') return f === h;
    if(periodo === 'mes') return f.slice(0,7) === h.slice(0,7);
    if(periodo === 'semana') return f >= inicioSemana(h) && f <= finSemana(h);
    return true;
  }
  function estadoNormal(o){ return String(o && o.estado || '').toLowerCase(); }
  function esCompletada(o){ return ['completada','con_observaciones'].indexOf(estadoNormal(o)) >= 0; }

  window.otFiltroRapido315 = function(tipo){
    var est = e('ot-filtro-estado');
    var per = e('ot-filtro-periodo');
    var tec = e('ot-filtro-tecnico');
    var busq = e('ot-busq');
    if(busq) busq.value = '';
    if(tec) tec.value = '';
    window._otFiltroEspecial315 = '';
    if(tipo === 'abiertas') { if(est) est.value = 'abiertas'; if(per) per.value = 'todos'; window._otFiltroEspecial315 = 'abiertas'; }
    if(tipo === 'hoy') { if(est) est.value = ''; if(per) per.value = 'hoy'; }
    if(tipo === 'completadas') { if(est) est.value = 'completada'; if(per) per.value = 'todos'; }
    if(typeof window.renderOTTabla === 'function') window.renderOTTabla();
  };

  var prevRenderAdmin = window._renderOTVistaAdmin;
  if(typeof prevRenderAdmin === 'function' && !prevRenderAdmin._sv315){
    window._renderOTVistaAdmin = function(filtro, hoy){
      var tbody = e('ot-tbody');
      if(!tbody) return prevRenderAdmin.apply(this, arguments);
      var busq = (e('ot-busq') || {}).value || '';
      var filtroTec = (e('ot-filtro-tecnico') || {}).value || '';
      var periodo = (e('ot-filtro-periodo') || {}).value || 'todos';
      var selTec = e('ot-filtro-tecnico');
      if (selTec && selTec.options.length <= 1) {
        var tecDeOTs = new Set(arr(window.otData).map(function(o){ return o && o.tecnico; }).filter(Boolean));
        var tecDeEmps = arr(window.empData).filter(function(x){ return x && x.activo !== false; }).map(function(x){ return x.nombre; });
        Array.from(new Set(Array.from(tecDeOTs).concat(tecDeEmps).filter(Boolean))).sort().forEach(function(t){
          var opt = document.createElement('option'); opt.value = t; opt.textContent = t; selTec.appendChild(opt);
        });
      }
      var especial = window._otFiltroEspecial315 || '';
      var rows = arr(window.otData).filter(function(o){
        if(!o) return false;
        var est = estadoNormal(o);
        var mostrarAbiertas = especial === 'abiertas' || String(filtro || '').toLowerCase() === 'abiertas';
        var matchFiltro = mostrarAbiertas ? !esCompletada(o) : (!filtro || est === String(filtro).toLowerCase());
        var matchTec = !filtroTec || String(o.tecnico || '') === String(filtroTec);
        var t = (String(o.id||'') + ' ' + String(o.cliente||'')).toLowerCase();
        var matchBusq = !busq || t.indexOf(String(busq).toLowerCase()) >= 0;
        return matchFiltro && matchTec && matchBusq && matchPeriodoOT(o, periodo);
      });
      hoy = hoy || hoyISO();
      rows.sort(function(a,b){
        function score(o){
          var f = fechaISO(o && o.fecha);
          if(o && o.prioridad) return 0;
          if(f && f < hoy && !esCompletada(o)) return 1;
          if(f === hoy) return 2;
          if(f && f > hoy) return 3;
          return 4;
        }
        return score(a)-score(b) || String(fechaISO(a.fecha)||'9999').localeCompare(String(fechaISO(b.fecha)||'9999'));
      });
      var puedeEliminarOT = typeof window.tienePermiso === 'function'
        ? window.tienePermiso('ot.eliminar')
        : String(window.currentRole || '').toLowerCase() === 'admin';
      tbody.innerHTML = rows.map(function(o){
        var f = fechaISO(o.fecha);
        var esPrioridad = o.prioridad === true || o.prioridad === 'true';
        var esAtrasada = f && f < hoy && !esCompletada(o);
        var rowColor = esPrioridad || esAtrasada ? 'background:rgba(239,68,68,.06)' : f === hoy ? 'background:rgba(245,158,11,.04)' : '';
        var visitasPrev = (typeof window._contarVisitasPrevias === 'function') ? window._contarVisitasPrevias(o.cliente, o.dir, o.id) : 0;
        var iconoRep = visitasPrev > 0 ? '<i class="ti ti-repeat" style="font-size:12px;color:var(--amber);margin-right:4px" title="Visita N°'+(visitasPrev+1)+'"></i>' : '';
        var key = esc(o.fbKey || o.id || '');
        return '<tr style="'+rowColor+'">' +
          '<td style="text-align:center">'+(esPrioridad?'<i class="ti ti-flame" style="color:var(--red);font-size:14px"></i>':'')+(esAtrasada&&!esPrioridad?'<i class="ti ti-clock" style="color:var(--amber);font-size:14px"></i>':'')+'</td>' +
          '<td style="font-weight:500;font-family:monospace;font-size:12px">'+iconoRep+esc(o.id||'')+'</td>' +
          '<td>'+esc(o.cliente||'—')+'</td>' +
          '<td style="font-size:12px;color:var(--text3)">'+esc(o.tecnico||'Sin asignar')+'</td>' +
          '<td style="font-size:12px;color:'+(esAtrasada?'var(--red)':f===hoy?'var(--amber)':'var(--text3)')+'">'+esc(o.fecha ? (typeof window._mostrarFecha === 'function' ? window._mostrarFecha(o.fecha) : o.fecha) : 'Sin fecha')+(o.hora?' '+esc(o.hora):'')+'</td>' +
          '<td style="font-size:12px;color:var(--text3)">'+esc(o.tipoVisita||o.tipo||'—')+'</td>' +
          '<td style="min-width:80px"><div class="progress-bar" style="margin:0"><div class="progress-fill" style="width:'+(o.progreso||0)+'%"></div></div><div style="font-size:10px;color:var(--text3);margin-top:2px">'+(o.progreso||0)+'%</div></td>' +
          '<td>'+ (typeof window.otBadge === 'function' ? window.otBadge(o) : esc(o.estado||'')) +'</td>' +
          '<td style="white-space:nowrap"><button class="btn btn-sm btn-icon" onclick="verOT(\''+key+'\')"><i class="ti ti-eye" style="font-size:14px"></i></button>' +
            (puedeEliminarOT ? '<button class="btn btn-sm btn-icon" onclick="eliminarOT(\''+key+'\')"><i class="ti ti-trash" style="font-size:14px"></i></button>' : '') +
          '</td>' +
        '</tr>';
      }).join('');
      if(!rows.length) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Sin órdenes</td></tr>';
    };
    window._renderOTVistaAdmin._sv315 = true;
  }

  window.filtrarOT = function(v){ window._otFiltroEspecial315 = ''; if(typeof window.renderOTTabla === 'function') window.renderOTTabla(v); };
  window.buscarOT = function(){ if(typeof window.renderOTTabla === 'function') window.renderOTTabla(); };
  window.filtrarOTTecnico = function(){ if(typeof window.renderOTTabla === 'function') window.renderOTTabla(); };
})();
