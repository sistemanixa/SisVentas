/* ══════════════════════════════════════════════════════════════════════════════
   v20.339 — Dashboard: OT pendientes más compacto
   - PC: Ventas gana ancho; OT baja a panel secundario.
   - Compacta filas y padding de OT sin tocar datos ni lógica.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  function css333(){
    if(document.getElementById('sv333-dashboard-css')) return;
    var st=document.createElement('style');
    st.id='sv333-dashboard-css';
    st.textContent = `
      @media (min-width:1200px){
        #dash-row2-admin{
          grid-template-columns:minmax(680px,1.42fr) minmax(420px,.88fr)!important;
          gap:14px!important;
          align-items:stretch!important;
        }
        #dash-row2-admin > .card:first-child{
          min-width:0!important;
        }
        #dash-row2-admin > .card:nth-child(2){
          min-width:0!important;
          min-height:360px!important;
          padding:14px 16px!important;
        }
        #dash-row2-admin > .card:nth-child(2) .card-head{
          margin-bottom:10px!important;
        }
        #dash-row2-admin > .card:nth-child(2) table th{
          padding:0 8px 7px 0!important;
          font-size:10.5px!important;
        }
        #dash-row2-admin > .card:nth-child(2) table td{
          padding:6px 8px 6px 0!important;
          font-size:12px!important;
          line-height:1.18!important;
        }
        #dash-ot-pendientes td{
          line-height:1.18!important;
        }
        #dash-ot-pendientes .badge{
          font-size:10px!important;
          padding:2px 7px!important;
        }
        #dash-ot-pendientes i,
        #dash-ot-pendientes .ti{
          font-size:11px!important;
        }
      }
    `;
    document.head.appendChild(st);
  }
  css333();
  document.addEventListener('DOMContentLoaded', css333);
})();
