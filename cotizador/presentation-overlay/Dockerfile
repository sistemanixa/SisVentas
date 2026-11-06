FROM southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador:return910199-bbf61e86@sha256:09a9d7f6bfffb4a13ec2aa00235dbc52c442bc4f86737d49f3d82a161888353f
WORKDIR /app
COPY budget-presentation-trial.js budget-presentation-trial-model.js ./
COPY presentation-overlay/attach.cjs /tmp/presentation-attach.cjs
RUN node /tmp/presentation-attach.cjs && node --check /app/index.js && node --check /app/budget-presentation-trial.js && node --check /app/budget-presentation-trial-model.js
