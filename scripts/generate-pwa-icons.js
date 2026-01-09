/**
 * Generate PWA Icons
 * Creates 192x192 and 512x512 PNG icons for the PWA manifest
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const THEME_COLOR = '#3182CE';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function generateIcon(size) {
  const svgIcon = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${size}" height="${size}" fill="${THEME_COLOR}" rx="${size * 0.15}"/>

      <!-- Dollar sign symbol -->
      <g transform="translate(${size / 2}, ${size / 2})">
        <text
          x="0"
          y="0"
          font-family="Arial, sans-serif"
          font-size="${size * 0.6}"
          font-weight="bold"
          fill="white"
          text-anchor="middle"
          dominant-baseline="central"
        >$</text>
      </g>

      <!-- Small "Budget" text at bottom -->
      <text
        x="${size / 2}"
        y="${size * 0.85}"
        font-family="Arial, sans-serif"
        font-size="${size * 0.08}"
        font-weight="500"
        fill="white"
        text-anchor="middle"
        opacity="0.9"
      >BUDGET</text>
    </svg>
  `;

  const outputPath = path.join(PUBLIC_DIR, `icon-${size}x${size}.png`);

  await sharp(Buffer.from(svgIcon))
    .png()
    .toFile(outputPath);

  console.log(`✓ Generated ${outputPath}`);
}

async function main() {
  try {
    console.log('Generating PWA icons...\n');

    // Generate 192x192 icon
    await generateIcon(192);

    // Generate 512x512 icon
    await generateIcon(512);

    console.log('\n✓ All PWA icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();
