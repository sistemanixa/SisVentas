'use strict';

const Evidence = require('../../scripts/lib/commercial-cut-evidence.cjs');
const { createHash } = require('node:crypto');
const sha = label => createHash('sha256').update(label).digest('hex');

function fixture() {
  const observed = { sourceSha256: sha('observed-source'), rulesSha256: sha('observed-rules'), artifactSha256: sha('observation') };
  const candidate = { sourceSha256: sha('candidate-source'), rulesSha256: sha('candidate-rules'), artifactSha256: sha('candidate-artifact') };
  const writers = [...new Set(Object.values(Evidence.REQUIRED).flat())].map(domain => ({
    id: `${domain}-writer`, domain, entrypoint: `fixture/${domain}`, transport: 'sdk', fence: 'sdk-idle', proofSha256: sha(`proof/${domain}`)
  }));
  const operations = Object.keys(Evidence.REQUIRED).map(name => {
    const domains = Evidence.REQUIRED[name];
    const projections = Evidence.PROJECTIONS.map(projection => ({ name: projection, schema: 1, generation: `fixture-${projection}`,
      revision: 1, sourceSha256: candidate.sourceSha256, proofSha256: sha(projection) }));
    return { name, writerIds: writers.filter(row => domains.includes(row.domain)).map(row => row.id),
      fences: domains.map(domain => ({ domain, rulesSha256: candidate.rulesSha256, proofSha256: sha(`fence/${domain}`) })),
      projections, tests: Evidence.CIRCUITS.map(circuit => ({ circuit, result: 'passed', runner: 'node --test fixture',
        artifactSha256: sha(`${name}/${circuit}`), sourceSha256: candidate.sourceSha256, rulesSha256: candidate.rulesSha256,
        projectionSha256: sha(Evidence.canonical(projections)) })) };
  });
  return { schema: 1, observed, candidate, writers, operations };
}

module.exports = { fixture, sha };
