/**
 * Gera os pôsteres e backdrops do catálogo como SVG em frontend/public/posters.
 *
 * Por que não usar URLs de um site de filmes? Três motivos práticos:
 *  - link externo quebra (e aí o catálogo inteiro fica com imagem rasgada);
 *  - obriga a afrouxar a CSP para aceitar imagens de terceiros;
 *  - adiciona latência de DNS/TLS a cada card da vitrine.
 *
 * SVG resolve os três: fica no nosso domínio, pesa ~2KB, é nítido em qualquer
 * densidade de tela e o gradiente é derivado do próprio título — cada filme
 * ganha uma identidade de cor estável, sem arquivo binário no repositório.
 *
 * Uso: node tools/generate-posters.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'posters');

const MOVIES = [
    { slug: 'duna-parte-dois', title: 'Duna: Parte Dois', year: 2024, hue: 28, accent: 48 },
    { slug: 'oppenheimer', title: 'Oppenheimer', year: 2023, hue: 12, accent: 40 },
    { slug: 'ainda-estou-aqui', title: 'Ainda Estou Aqui', year: 2024, hue: 186, accent: 158 },
    { slug: 'interestelar', title: 'Interestelar', year: 2014, hue: 214, accent: 196 },
    { slug: 'parasita', title: 'Parasita', year: 2019, hue: 96, accent: 66 },
    { slug: 'cidade-de-deus', title: 'Cidade de Deus', year: 2002, hue: 20, accent: 44 },
    { slug: 'aranhaverso', title: 'Homem-Aranha: Através do Aranhaverso', year: 2023, hue: 322, accent: 268 },
    { slug: 'bacurau', title: 'Bacurau', year: 2019, hue: 8, accent: 36 },
    { slug: 'tudo-em-todo-lugar', title: 'Tudo em Todo Lugar ao Mesmo Tempo', year: 2022, hue: 288, accent: 176 },
    { slug: 'a-chegada', title: 'A Chegada', year: 2016, hue: 200, accent: 168 },
    { slug: 'sociedade-do-anel', title: 'O Senhor dos Anéis: A Sociedade do Anel', year: 2001, hue: 142, accent: 46 },
    { slug: 'pobres-criaturas', title: 'Pobres Criaturas', year: 2024, hue: 330, accent: 300 },
];

const escapeXml = (value) =>
    value.replace(/[<>&'"]/g, (char) =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char],
    );

/** Quebra o título em linhas que caibam na largura do pôster. */
function wrapTitle(title, maxChars) {
    const words = title.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars && current) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }

    if (current) lines.push(current);
    return lines;
}

function buildSvg({ width, height, title, year, hue, accent, titleSize, maxChars, padding }) {
    const lines = wrapTitle(title, maxChars);
    const lineHeight = titleSize * 1.15;
    const blockHeight = lines.length * lineHeight;
    const baseY = height - padding - blockHeight;

    const titleTspans = lines
        .map(
            (line, index) =>
                `<tspan x="${padding}" y="${(baseY + index * lineHeight + titleSize * 0.8).toFixed(1)}">${escapeXml(line)}</tspan>`,
        )
        .join('');

    // IDs únicos por arquivo evitam colisão caso dois SVGs sejam inlinados
    // na mesma página (o navegador resolve fill="url(#id)" globalmente).
    const uid = Math.abs(hue * 31 + accent).toString(36);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg${uid}" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 55% 22%)"/>
      <stop offset="55%" stop-color="hsl(${(hue + 340) % 360} 45% 12%)"/>
      <stop offset="100%" stop-color="hsl(${hue} 30% 6%)"/>
    </linearGradient>
    <radialGradient id="glow${uid}" cx="0.72" cy="0.22" r="0.75">
      <stop offset="0%" stop-color="hsl(${accent} 85% 62%)" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="hsl(${accent} 85% 62%)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="veil${uid}" x1="0" y1="0.35" x2="0" y2="1">
      <stop offset="0%" stop-color="#05060a" stop-opacity="0"/>
      <stop offset="100%" stop-color="#05060a" stop-opacity="0.88"/>
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg${uid})"/>
  <rect width="${width}" height="${height}" fill="url(#glow${uid})"/>

  <g opacity="0.16" fill="none" stroke="hsl(${accent} 90% 78%)" stroke-width="1.2">
    <circle cx="${width * 0.72}" cy="${height * 0.24}" r="${width * 0.34}"/>
    <circle cx="${width * 0.72}" cy="${height * 0.24}" r="${width * 0.22}"/>
    <circle cx="${width * 0.72}" cy="${height * 0.24}" r="${width * 0.46}"/>
  </g>

  <rect width="${width}" height="${height}" fill="url(#veil${uid})"/>

  <text x="${padding}" y="${baseY - titleSize * 0.55}" fill="hsl(${accent} 80% 72%)"
        font-family="ui-sans-serif, 'Segoe UI', system-ui, sans-serif"
        font-size="${(titleSize * 0.34).toFixed(1)}" font-weight="600" letter-spacing="${(titleSize * 0.12).toFixed(1)}">${year}</text>

  <text fill="#f6f4f1" font-family="Georgia, 'Times New Roman', serif"
        font-size="${titleSize}" font-weight="700">${titleTspans}</text>
</svg>
`;
}

await mkdir(OUT_DIR, { recursive: true });

for (const movie of MOVIES) {
    const poster = buildSvg({
        ...movie,
        width: 500,
        height: 750,
        titleSize: 46,
        maxChars: 16,
        padding: 40,
    });

    const backdrop = buildSvg({
        ...movie,
        width: 1280,
        height: 720,
        titleSize: 64,
        maxChars: 26,
        padding: 72,
    });

    await writeFile(path.join(OUT_DIR, `${movie.slug}.svg`), poster, 'utf8');
    await writeFile(path.join(OUT_DIR, `${movie.slug}-wide.svg`), backdrop, 'utf8');
}

console.log(`${MOVIES.length * 2} imagens geradas em frontend/public/posters`);
