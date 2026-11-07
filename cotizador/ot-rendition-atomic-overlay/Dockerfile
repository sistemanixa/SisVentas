FROM southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:cf7bcefb95650282ecb6a29aec3f33871c5f05371976ff3b1970d0122825dc65
WORKDIR /app
COPY ot-rendition-stock-plan.js ot-rendition-model.js ot-rendition-material-state.js ot-rendition-stock-model.js ot-rendition-money.js ot-rendition-hooks.json ot-rendition-overlay.manifest.json ot-rendition-attach.cjs ./
RUN node ot-rendition-attach.cjs apply /app __MANIFEST_SHA__ && node ot-rendition-attach.cjs verify /app __MANIFEST_SHA__ && node --check index.js && node --check ot-lifecycle.js && node --check ot-lifecycle-policy.js && node -e "require('./ot-rendition-stock-plan');require('./ot-rendition-model');require('./ot-lifecycle');"
