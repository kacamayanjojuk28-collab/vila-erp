"""Convert the existing Urbanist 700 VILA wordmark to vector paths; no new symbol."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

font = instantiateVariableFont(TTFont('node_modules/@fontsource-variable/urbanist/files/urbanist-latin-wght-normal.woff2'), {'wght': 700})
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
pen = SVGPathPen(glyphs)
bounds = BoundsPen(glyphs)
x = 0
for char in 'VILA':
    name = cmap[ord(char)]
    transform = (1, 0, 0, -1, x, 0)
    glyphs[name].draw(TransformPen(pen, transform))
    glyphs[name].draw(TransformPen(bounds, transform))
    x += glyphs[name].width - font['head'].unitsPerEm * .02
x0, y0, x1, y1 = bounds.bounds
path = pen.getCommands()
out = Path('public/brand'); out.mkdir(parents=True, exist_ok=True)
def svg(width, height, scale_width):
    scale = scale_width / (x1-x0)
    tx = (width - (x1-x0)*scale)/2 - x0*scale
    ty = (height - (y1-y0)*scale)/2 - y0*scale
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><rect width="{width}" height="{height}" fill="#111513"/><path fill="#f2f4f0" transform="translate({tx} {ty}) scale({scale})" d="{path}"/></svg>'
(out/'icon.svg').write_text(svg(512,512,450),encoding='utf-8')
Path('.local/maskable.svg').write_text(svg(512,512,340),encoding='utf-8')
# Same wordmark, with a restrained existing lime accent; no claims or customer data.
og = svg(1200,630,650).replace('</svg>','<rect x="520" y="500" width="160" height="6" rx="3" fill="#c4ef4f"/></svg>')
Path('.local/og.svg').write_text(og,encoding='utf-8')
print('Existing VILA wordmark converted to paths')
