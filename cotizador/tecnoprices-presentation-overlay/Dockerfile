FROM southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:813a22a1b2614280109ddecd2320c5ac9a768963c8cc2cf80bc6e00f52ef813b
WORKDIR /app
COPY tecnoprices-login.js ./
COPY attach.cjs ./tecnoprices-overlay-attach.cjs
RUN node tecnoprices-overlay-attach.cjs apply /app/index.js && node tecnoprices-overlay-attach.cjs verify /app/index.js && node --check index.js && node --check tecnoprices-login.js
