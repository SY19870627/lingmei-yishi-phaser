// scripts/gen-placeholders.mjs
// 以 SVG + sharp 程式化產生各類底圖/框架（含 @2x 與 webp）
// 執行：npm run gen:placeholders

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/* ---------------------- 視覺規格（集中管理） ---------------------- */
const PALETTE = {
  paper: '#F5E9D3',
  ink: '#1E1E1E',
  templeRed: '#A5352B',
  darkGold: '#C9A227',
  teal: '#1E6E64',
  gray: '#6B6B6B',
  white: '#FFFFFF',
  black: '#000000'
};

const FONT_FAMILY = `system-ui, "Noto Sans TC", "PingFang TC", "Heiti TC", sans-serif`;

/* ---------------------- 小工具 ---------------------- */
async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function svgHeader(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
}

function noisePattern(id, opacity = 0.06, density = 0.007) {
  // 重複小點的 pattern；density 0.007 約每千像素 7 個點
  return `
  <defs>
    <pattern id="${id}" width="64" height="64" patternUnits="userSpaceOnUse">
      <rect x="0" y="0" width="64" height="64" fill="transparent"/>
      ${Array.from({ length: Math.floor(64 * 64 * density) }).map(() => {
        const x = Math.floor(Math.random() * 64);
        const y = Math.floor(Math.random() * 64);
        const r = Math.random() * 0.9 + 0.2;
        return `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${PALETTE.ink}" opacity="${opacity}"/>`;
      }).join('')}
    </pattern>
  </defs>`;
}

function cloudWatermarkPath(w, h, scale = 0.22) {
  const cw = w * scale, ch = h * scale;
  const ox = w - cw - 24, oy = h - ch - 24;
  return `
  <g opacity="0.2" transform="translate(${ox},${oy})">
    <path d="
      M ${cw*0.1} ${ch*0.7}
      C ${cw*0.25} ${ch*0.5}, ${cw*0.45} ${ch*0.5}, ${cw*0.6} ${ch*0.7}
      C ${cw*0.8} ${ch*0.7}, ${cw*0.9} ${ch*0.85}, ${cw*0.8} ${ch*0.95}
      C ${cw*0.6} ${ch*0.95}, ${cw*0.45} ${ch*0.85}, ${cw*0.35} ${ch*0.85}
      C ${cw*0.25} ${ch*0.85}, ${cw*0.18} ${ch*0.8}, ${cw*0.1} ${ch*0.7}
      Z" fill="${PALETTE.gray}"/>
  </g>`;
}

function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function labelText(x, y, text, size = 24, color = PALETTE.gray, anchor = 'middle') {
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family='${FONT_FAMILY}' dominant-baseline="middle" text-anchor="${anchor}">${escapeXml(text)}</text>`;
}

/* ---------------------- 核心：畫底圖或框 ---------------------- */
function renderBaseOrFrame({
  w, h, radius = 16,
  filled = true,                   // true: 紙底（底圖）；false: 透明內部（框）
  strokeColor = PALETTE.ink,
  strokeWidth = 2,
  bgColor = PALETTE.paper,
  headerBand = 0,                  // 上方半透明帶高（像素）
  bottomBand = 0,                  // 下方帶
  showNoise = true,
  showWatermark = true,
  centerLabel, subLabel,
  extra = ''                       // 額外 SVG 片段
}) {
  const noiseId = `ptn${Math.floor(Math.random()*1e6)}`;
  const head = svgHeader(w, h);
  const defs = showNoise ? noisePattern(noiseId) : '<defs/>';
  // 外框
  const outer = `<rect x="0.5" y="0.5" rx="${radius}" ry="${radius}" width="${w-1}" height="${h-1}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;

  // 底紙 or 透明
  const paper = filled
    ? `<rect x="1" y="1" rx="${radius-1}" ry="${radius-1}" width="${w-2}" height="${h-2}" fill="${bgColor}" />` +
      (showNoise ? `<rect x="1" y="1" rx="${radius-1}" ry="${radius-1}" width="${w-2}" height="${h-2}" fill="url(#${noiseId})" />` : '')
    : ''; // 框：不填，保留透明

  // 上/下帶（半透明）
  const header = headerBand>0 ? `<rect x="1" y="1" width="${w-2}" height="${headerBand}" rx="${Math.min(radius-1, headerBand/2)}" fill="${PALETTE.black}" opacity="0.08"/>` : '';
  const bottom = bottomBand>0 ? `<rect x="1" y="${h-1-bottomBand}" width="${w-2}" height="${bottomBand}" rx="${Math.min(radius-1, bottomBand/2)}" fill="${PALETTE.black}" opacity="0.08"/>` : '';

  // 右下雲紋（只在需要時）
  const wm = showWatermark ? cloudWatermarkPath(w, h) : '';

  // 中央標籤
  const labels = centerLabel ? labelText(w/2, h/2, centerLabel, Math.max(18, Math.floor(Math.min(w,h)/14))) : '';
  const sub = subLabel ? labelText(w/2, h*0.62, subLabel, 18, PALETTE.gray) : '';

  return `${head}
  ${defs}
  ${paper}
  ${header}${bottom}
  ${wm}
  ${outer}
  ${labels}${sub}
  ${extra}
</svg>`;
}

/* ---------------------- 專用：小圖示與錨點 ---------------------- */
function iconSvg(name, size = 64, stroke = PALETTE.ink) {
  const s = size; const c = s/2;
  const head = svgHeader(s, s);
  const common = `fill="none" stroke="${stroke}" stroke-width="${Math.max(2, s*0.06)}" stroke-linecap="round" stroke-linejoin="round"`;
  let body = '';
  switch (name) {
    case 'save':
      body = `<rect x="${s*0.2}" y="${s*0.2}" width="${s*0.6}" height="${s*0.6}" rx="${s*0.06}" ${common}/>
              <polyline points="${s*0.28},${s*0.38} ${s*0.5},${s*0.6} ${s*0.72},${s*0.38}" ${common}/>`;
      break;
    case 'back':
      body = `<polyline points="${s*0.6},${s*0.2} ${s*0.3},${s*0.5} ${s*0.6},${s*0.8}" ${common}/>`;
      break;
    case 'dialogue':
      body = `<rect x="${s*0.18}" y="${s*0.2}" width="${s*0.64}" height="${s*0.44}" rx="${s*0.06}" ${common}/>
              <polyline points="${s*0.42},${s*0.64} ${s*0.36},${s*0.8} ${s*0.56},${s*0.66}" ${common}/>`;
      break;
    case 'hint':
      body = `<circle cx="${c}" cy="${c}" r="${s*0.35}" ${common}/>
              <line x1="${c}" y1="${s*0.32}" x2="${c}" y2="${s*0.46}" ${common}/>
              <circle cx="${c}" cy="${s*0.65}" r="${s*0.04}" fill="${stroke}"/>`;
      break;
    case 'cards':
      body = `<rect x="${s*0.2}" y="${s*0.18}" width="${s*0.42}" height="${s*0.64}" rx="${s*0.08}" ${common}/>
              <rect x="${s*0.42}" y="${s*0.24}" width="${s*0.42}" height="${s*0.64}" rx="${s*0.08}" ${common}/>`;
      break;
    case 'items':
      body = `<rect x="${s*0.22}" y="${s*0.22}" width="${s*0.56}" height="${s*0.56}" rx="${s*0.1}" ${common}/>
              <circle cx="${c}" cy="${c}" r="${s*0.16}" ${common}/>`;
      break;
    default:
      body = `<circle cx="${c}" cy="${c}" r="${s*0.4}" ${common}/>`;
  }
  return `${head}${body}</svg>`;
}

function anchorPinSvg(size = 64, resolved = false) {
  const s = size; const head = svgHeader(s, s);
  const cx = s/2, cy = s*0.42, r = s*0.18;
  const pin = `
   <defs>
     <radialGradient id="g" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${PALETTE.templeRed}" />
      <stop offset="100%" stop-color="${PALETTE.templeRed}" />
     </radialGradient>
   </defs>
   <path d="M ${cx} ${s*0.08}
            C ${s*0.75} ${s*0.08}, ${s*0.75} ${s*0.5}, ${cx} ${s*0.95}
            C ${s*0.25} ${s*0.5}, ${s*0.25} ${s*0.08}, ${cx} ${s*0.08} Z"
         fill="url(#g)" stroke="${PALETTE.ink}" stroke-width="${Math.max(2, s*0.04)}"/>
   <circle cx="${cx}" cy="${cy}" r="${r}" fill="${PALETTE.white}" stroke="${PALETTE.ink}" stroke-width="${Math.max(2, s*0.03)}"/>
  `;
  const mark = resolved ? `<polyline points="${s*0.28},${s*0.72} ${s*0.44},${s*0.85} ${s*0.78},${s*0.56}" fill="none" stroke="${PALETTE.white}" stroke-width="${s*0.07}" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  return `${head}${pin}${mark}</svg>`;
}

/* ---------------------- 輸出器 ---------------------- */
async function writeOutputs(svg, outBasePath, scales = [1, 2]) {
  await fs.writeFile(outBasePath.replace(/\.png$/, '.svg'), svg, 'utf8'); // debug 用
  for (const scale of scales) {
    const p = scale === 1 ? outBasePath : outBasePath.replace(/(\.\w+)$/, '@2x$1');
    const webp = p.replace(/\.png$/, '.webp');
    const img = sharp(Buffer.from(svg));
    await img.png({ compressionLevel: 9 }).toFile(p);
    await img.webp({ quality: 92 }).toFile(webp);
    const meta = await sharp(Buffer.from(svg)).metadata();
    console.log('✓', path.basename(p), `${meta.width}x${meta.height}`, 'and', path.basename(webp));
  }
}


/* ---------------------- 任務定義 ---------------------- */
const tasks = [
  // 地圖底圖 & 縮圖
  {
    out: 'public/images/maps/base-map-blank.png',
    svg: () => renderBaseOrFrame({ w:1280, h:720, radius:24, filled:true, centerLabel:'地圖背景', subLabel:'Map Placeholder' })
  },
  {
    out: 'public/images/thumbnails/base-map-thumb.png',
    svg: () => renderBaseOrFrame({ w:320, h:180, radius:16, filled:true, centerLabel:'縮圖', subLabel:'Thumbnail' })
  },

  // 物品（正方形框，上緣標題帶）
  {
    out: 'public/images/items/frame-item.png',
    svg: () => renderBaseOrFrame({
      w:512, h:512, radius:16, filled:false,
      strokeColor: PALETTE.darkGold, headerBand:64,
      showWatermark:false, centerLabel:null
    })
  },

  // NPC 框（底部名牌帶）
  {
    out: 'public/images/npcs/frame-npc.png',
    svg: () => renderBaseOrFrame({
      w:768, h:1024, radius:20, filled:false,
      strokeColor: PALETTE.teal, bottomBand:96,
      showWatermark:false
    })
  },

  // Spirit 框（寺廟紅細框 + 右下雲紋 + 淡霧）
  {
    out: 'public/images/spirits/frame-spirit.png',
    svg: () => {
      const w=768,h=1024;
      const fog = `<rect x="1" y="1" width="${w-2}" height="${h-2}" fill="${PALETTE.white}" opacity="0.10" rx="20" ry="20"/>`;
      return renderBaseOrFrame({
        w, h, radius:20, filled:false,
        strokeColor: PALETTE.templeRed, showWatermark:true,
        extra: fog
      });
    }
  },

  // 天語卡牌
  {
    out: 'public/images/cards/frame-card-front.png',
    svg: () => renderBaseOrFrame({
      w:720, h:1080, radius:24, filled:false,
      strokeColor: PALETTE.ink, headerBand:220, bottomBand:180,
      showWatermark:false
    })
  },
  {
    out: 'public/images/cards/frame-card-back.png',
    svg: () => {
      const w=720,h=1080;
      const patternId = 'cardBackPtn';
      const head = svgHeader(w,h);
      const defs = `
        <defs>
          <pattern id="${patternId}" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="6" fill="${PALETTE.gray}" opacity="0.06"/>
            <circle cx="5" cy="5" r="3" fill="${PALETTE.gray}" opacity="0.04"/>
            <circle cx="35" cy="35" r="3" fill="${PALETTE.gray}" opacity="0.04"/>
          </pattern>
        </defs>`;
      const body = `
        <rect x="1" y="1" rx="24" ry="24" width="${w-2}" height="${h-2}" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="2"/>
        <rect x="1" y="1" rx="24" ry="24" width="${w-2}" height="${h-2}" fill="url(#${patternId})" />
        ${labelText(w/2, h/2, '天語', 86, PALETTE.gray)}
      `;
      return `${head}${defs}${body}</svg>`;
    }
  },

  // 劇情底圖
  {
    out: 'public/images/stories/base-story.png',
    svg: () => {
      const w=1280,h=720;
      const filmBars = `
        <rect x="0" y="0" width="${w}" height="8" fill="${PALETTE.black}" opacity="0.8"/>
        <rect x="0" y="${h-8}" width="${w}" height="8" fill="${PALETTE.black}" opacity="0.8"/>
      `;
      return renderBaseOrFrame({ w,h, radius:24, filled:true, centerLabel:'劇情', subLabel:'Story', extra: filmBars });
    }
  },

  // 錨點圖示（64/128）與已送行版
  ...[64,128].flatMap(size => ([
    {
      out: `public/images/anchors/anchor-pin-${size}.png`,
      svg: () => anchorPinSvg(size, false)
    },
    {
      out: `public/images/anchors/anchor-pin-resolved-${size}.png`,
      svg: () => anchorPinSvg(size, true)
    }
  ])),

  // 提示卡（左側彩帶）
  {
    out: 'public/images/hints/base-hint.png',
    svg: () => {
      const w=512,h=256;
      const ribbon = `<rect x="1" y="1" width="64" height="${h-2}" fill="${PALETTE.teal}" rx="12" ry="12" opacity="0.8"/>`;
      return renderBaseOrFrame({ w,h, radius:16, filled:true, centerLabel:'提示', subLabel:'Hint', extra:ribbon });
    }
  },

  // UI 小圖示（32 / 64）：save/back/dialogue/hint/cards/items
  ...[32,64].flatMap(size => ['save','back','dialogue','hint','cards','items'].map(name => ({
    out: `public/images/icons/${name}-${size}.png`,
    svg: () => iconSvg(name, size)
  })))
];

/* ---------------------- 執行 ---------------------- */
(async function main() {
  try {
    for (const t of tasks) {
      const dir = path.dirname(t.out);
      await ensureDir(dir);
      const svg = t.svg();
      // 1x / 2x：直接用同一 SVG，交給 sharp 以原始尺寸輸出，@2x 改名即可
      console.log('Generating', t.out);
      await writeOutputs(svg, t.out, [1, 2]);
    }
    console.log('\nAll placeholders generated.');
  } catch (err) {
    console.error('Generation error:', err);
    process.exit(1);
  }
})();
