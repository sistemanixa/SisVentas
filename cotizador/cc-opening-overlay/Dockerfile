FROM southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:91381cc6432750386e75b1dd006b80f96bd5c6efa1cfdb5403a789aa50cc8702
WORKDIR /app
COPY attach.cjs ./cc-opening-attach.cjs
RUN node cc-opening-attach.cjs /app && node --check index.js && node --check commercial-ownership.js && node -e "const C=require('./commercial-ownership'); C.createCommercialOwnership({auth:{},db:{},listReadConcurrency:16}); let denied=false;try{C.createCommercialOwnership({listReadConcurrency:17});}catch{denied=true;}if(!denied)throw Error('Unbounded read pool');"
