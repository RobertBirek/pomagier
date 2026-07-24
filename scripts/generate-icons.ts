import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1e40af"/>
  <text x="256" y="340" font-family="Arial,sans-serif" font-size="320" font-weight="bold" fill="white" text-anchor="middle">P</text>
</svg>`;

async function generate() {
  const buf = Buffer.from(svg);
  await sharp(buf).resize(192, 192).png().toFile("public/icon-192.png");
  await sharp(buf).resize(512, 512).png().toFile("public/icon-512.png");
  console.log("Icons generated");
}

generate();
