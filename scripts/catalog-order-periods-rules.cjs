module.exports={
  ".read": true,
  ".write": "auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && root.child('sv_chat_roles').child(auth.uid).child('rol').val() === 'admin'",
  ".validate": "newData.hasChildren(['periodos']) && newData.child('periodos').hasChild('0')",
  "periodos": {
    "$i": {
      ".validate": "$i.matches(/^(0|[1-9]|10|11)$/) && newData.hasChildren(['nombre','inicio','fin']) && newData.child('fin').val() >= newData.child('inicio').val()",
      "nombre": {
        ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 80"
      },
      "inicio": {
        ".validate": "newData.isNumber() && newData.val() % 1 === 0 && newData.val() >= 1 && newData.val() <= 31"
      },
      "fin": {
        ".validate": "newData.isNumber() && newData.val() % 1 === 0 && newData.val() >= 1 && newData.val() <= 31"
      },
      "$other": {
        ".validate": false
      }
    }
  },
  "$other": {
    ".validate": false
  }
};
