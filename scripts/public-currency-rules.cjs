const fields=['dolarConversion','oficial','blue','mep'];
function publicCurrencyRules(rules){
 const rate=rules.sisventas.config.tipoCambio;
 for(const field of fields)rate[field]={...(rate[field]||{}),'.read':true};
 return rules;
}
module.exports={publicCurrencyRules,fields};
