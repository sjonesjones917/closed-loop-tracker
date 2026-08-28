from pathlib import Path

path = Path('verify-adjudication.mjs')
text = path.read_text()
old = " const source=fs.readFileSync('workflow-engine.js','utf8');const release=source.slice(source.indexOf('function releaseMetrics('),source.indexOf('\\nfunction gate(',source.indexOf('function releaseMetrics(')));assert(release.includes('effectiveDetermination'),'releaseMetrics does not consume application adjudication.');"
new = " const source=fs.readFileSync('workflow-engine.js','utf8'),releaseStart=source.includes('function releaseMetricsUncached(')?source.indexOf('function releaseMetricsUncached('):source.indexOf('function releaseMetrics('),release=source.slice(releaseStart,source.indexOf('\\nfunction gate(',releaseStart));assert(release.includes('effectiveDetermination'),'releaseMetrics does not consume application adjudication.');"
if text.count(old) != 1:
    raise SystemExit(f'release reducer guard target mismatch: {text.count(old)}')
path.write_text(text.replace(old, new, 1))
