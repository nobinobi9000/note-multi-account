// note アカウント切替 アイコン生成スクリプト
const { PNG } = require('pngjs');
const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const os = require('os');
const path = require('path');

// カラー定義
const BG     = [0x14, 0x14, 0x14]; // #141414 ダーク背景
const GREEN  = [0x41, 0xc9, 0xa0]; // #41c9a0 note.com グリーン
const WHITE  = [0xff, 0xff, 0xff]; // #ffffff

function inRoundedRect(x, y, size, r) {
  const pad = size * 0.04;
  const l = pad, t = pad, ri = size - pad, b = size - pad;
  if (x < l || x > ri || y < t || y > b) return false;
  // 四隅の角丸チェック
  const corners = [
    [l + r, t + r], [ri - r, t + r],
    [l + r, b - r], [ri - r, b - r],
  ];
  for (const [cx, cy] of corners) {
    if (Math.abs(x - cx) > r || Math.abs(y - cy) > r) continue;
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return false;
  }
  return true;
}

function createPNG(size) {
  const png = new PNG({ width: size, height: size });
  const r = size * 0.18; // 角丸半径

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) * 4;
      const nx = x / size;
      const ny = y / size;

      const inBg = inRoundedRect(x, y, size, r);

      // アイコン外は透明
      if (!inBg) {
        png.data.fill(0, idx, idx + 4);
        continue;
      }

      let color = BG; // デフォルト: 背景

      // ── "n" の左縦棒 ──
      if (nx >= 0.18 && nx <= 0.35 && ny >= 0.22 && ny <= 0.78) color = WHITE;

      // ── "n" の右縦棒 ──
      if (nx >= 0.65 && nx <= 0.82 && ny >= 0.22 && ny <= 0.78) color = WHITE;

      // ── "n" の横橋（アーチ上部） ──
      if (nx >= 0.35 && nx <= 0.65 && ny >= 0.22 && ny <= 0.40) color = WHITE;

      // ── ピリオド（.）: 右下の小さい緑の正方形 ──
      const dotSize = 0.10;
      const dotX = 0.82, dotY = 0.68;
      if (nx >= dotX && nx <= dotX + dotSize && ny >= dotY && ny <= dotY + dotSize) {
        color = GREEN;
      }

      png.data[idx]     = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = 0xff;
    }
  }

  return PNG.sync.write(png);
}

async function main() {
  const sizes = [16, 32, 48, 64, 128, 256];
  console.log('アイコンを生成中...');

  // 一時ディレクトリにPNGを書き出す
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-icon-'));
  const pngPaths = sizes.map(s => {
    console.log(`  ${s}x${s}`);
    const buf = createPNG(s);
    const p = path.join(tmpDir, `icon-${s}.png`);
    fs.writeFileSync(p, buf);
    return p;
  });

  // ICO に変換
  fs.mkdirSync('assets', { recursive: true });
  const ico = await pngToIco(pngPaths);
  fs.writeFileSync('assets/icon.ico', ico);

  // 一時ファイルを削除
  pngPaths.forEach(p => fs.unlinkSync(p));
  fs.rmdirSync(tmpDir);

  console.log('✓ assets/icon.ico を生成しました');
}

main().catch(console.error);
