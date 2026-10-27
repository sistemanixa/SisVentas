FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 https://storage.googleapis.com/firebase-preview-drop/emulator/firebase-database-emulator-v4.11.2.jar -o /opt/emulator.jar && echo 'b70d99344caf17c98b6f910fa8f6edf32a7c016cb1035e8915f70d38901eb97f  /opt/emulator.jar' | sha256sum -c -
WORKDIR /work
COPY . /work/
USER 10001:10001
ENV SV_OT_ISOLATED_CONTAINER=1 HOME=/tmp/fictitious-home
CMD ["node", "test/isolated-ot/run.cjs"]
