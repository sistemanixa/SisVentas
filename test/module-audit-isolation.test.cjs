'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {page}=require('../scripts/dev-module-audit.cjs');
test('la copia de módulos excluye SDK, autenticación y scripts externos',()=>{
 const html=page();assert.doesNotMatch(html,/<script[^>]+src=["'](?:https?:|[^"']*\/firebase\.js)/i);
 assert.match(html,/fixture-bootstrap\.js/);assert.match(html,/fixture-start\.js/);assert.match(html,/app\.v3\./);
});
