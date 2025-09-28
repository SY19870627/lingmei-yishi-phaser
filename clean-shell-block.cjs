const fs = require('fs');
const path = 'src/scenes/ShellScene.ts';
let text = fs.readFileSync(path,'utf8');
const blockRegex = /    const background = this\.add\.image\(width \/ 2, height \/ 2, 'shell-background'\);\r\n[\s\S]*?    this\.lastLocation = world\?\.data\?\.位置;/;
const replacement = "    const background = this.add.image(width / 2, height / 2, 'shell-background');\r\n    const backgroundScale = Math.max(width / background.width, height / background.height);\r\n    background.setScale(backgroundScale);\r\n    background.setDepth(-1);\r\n\r\n    const protagonist = this.add.image(width * 0.2, height - 32, 'protagonist');\r\n    protagonist.setOrigin(0.5, 1);\r\n    const targetHeight = height * 0.75;\r\n    const targetWidth = width * 0.28;\r\n    const heightScale = targetHeight / protagonist.height;\r\n    const widthScale = targetWidth / protagonist.width;\r\n    const protagonistScale = Math.min(1, heightScale, widthScale);\r\n    protagonist.setScale(protagonistScale);\r\n\r\n    this.lastLocation = world?.data?.位置;";
if(!blockRegex.test(text)){
  throw new Error('Target block not found');
}
text = text.replace(blockRegex, replacement);
fs.writeFileSync(path,text,'utf8');
