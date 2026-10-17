/* Optional source refresh. Originals are checked in; the game never contacts Freesound. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const pages = {
  pour: '/people/ahamirikia/sounds/710550/',
  ice: '/people/Agonda/sounds/210586/',
  pump: '/people/16F_Panska_Belakova_Marketa/sounds/499324/',
  cup: '/people/kyles/sounds/637753/',
  cupAlternate: '/people/sidequesting/sounds/530250/',
  spoon: '/people/ScottStanderfer1/sounds/533789/',
  paper: '/people/sethlind/sounds/265020/',
  bell: '/people/3bagbrew/sounds/57743/',
  coin: '/people/HoseNoseSounds/sounds/510735/',
  splash: '/people/vibe_crc/sounds/50623/',
  bag: '/people/vladnegrila/sounds/339961/',
  steps: '/people/SpliceSound/sounds/170501/',
  plop: '/people/3dm0nd_M/sounds/380037/',
  foam: '/people/elizagoode/sounds/181409/',
};

async function main() {
  fs.mkdirSync(path.join(__dirname, 'recordings'), { recursive: true });
  const sources = [];
  const manifest = path.join(__dirname, 'recordings.json');
  const existing = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : [];
  // Sequential to avoid hammering the source host.
  for (const [id, page] of Object.entries(pages)) {
    const source = `https://freesound.org${page}`;
    const saved = existing.find((entry) => entry.id === id && entry.source === source);
    const local = path.join(__dirname, 'recordings', `${id}.mp3`);
    if (saved && fs.existsSync(local) && crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex') === saved.sha256) {
      sources.push(saved);
      continue;
    }
    const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${source}: ${response.status}`);
    const html = await response.text();
    if (!/https?:\/\/creativecommons.org\/publicdomain\/zero\/1.0\//.test(html)) {
      throw new Error(`CC0 license could not be verified: ${source}`);
    }
    const download = html.match(/https:\/\/cdn\.freesound\.org\/previews\/[^"<>\s]+-hq\.mp3/)?.[0];
    if (!download) throw new Error(`No public preview: ${source}`);
    const audio = await fetch(download, { signal: AbortSignal.timeout(30000) });
    if (!audio.ok) throw new Error(`${download}: ${audio.status}`);
    const bytes = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(path.join(__dirname, 'recordings', `${id}.mp3`), bytes);
    sources.push({
      id,
      title: html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim(),
      author: page.split('/')[2], source, download,
      license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    });
    console.log(`Fetched ${id} (${Math.round(bytes.length / 1024)} KB)`);
  }
  fs.writeFileSync(path.join(__dirname, 'recordings.json'), `${JSON.stringify(sources, null, 2)}\n`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
