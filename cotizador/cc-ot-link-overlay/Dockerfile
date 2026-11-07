FROM southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:ced87f6f3b3ecbb25afd23ba77be4b2d88a4be53ba89e7942e82ba2a2e43c2c4
WORKDIR /app
COPY attach.cjs ./cc-ot-link-attach.cjs
RUN node cc-ot-link-attach.cjs /app && node --check ot-lifecycle-model.js && node -e "require('./ot-lifecycle-model');require('./commercial-ownership').createCommercialOwnership({auth:{},db:{},listReadConcurrency:16});"
