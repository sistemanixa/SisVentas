FROM southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:ce214d16acc17a89acecab937a499c4984ca49c5f6a097fedba2d5aab73fb8a2
WORKDIR /app
COPY tecnoprices-login.js ./
COPY attach.cjs ./tecnoprices-stock-attach.cjs
RUN node tecnoprices-stock-attach.cjs apply /app/index.js && node tecnoprices-stock-attach.cjs verify /app/index.js && node --check index.js
