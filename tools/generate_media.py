"""Generate the sample site-progress photos and walkthrough videos used by the demo.

Run:  python3 tools/generate_media.py      (needs Pillow and ffmpeg with libx264 + libvpx-vp9)
Writes JPG photos, WebM + MP4 videos and poster frames into assets/media/.
"""
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'media')
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

STD = ['Site preparation', 'Foundation', 'Plinth', 'Superstructure', 'Brickwork', 'Roofing', 'Plastering', 'Finishes', 'Handover']
INT = ['Design approval', 'Civil changes', 'False ceiling', 'Electrical', 'Carpentry', 'Flooring', 'Painting', 'Handover']
# id, name, current stage, floors (0 = interior), photo count, sky tone
PROJECTS = [
    ('p1', 'Sundaram Residence', 6, 2, 4, 0), ('p2', 'Cauvery Heights Apartments', 3, 4, 4, 3),
    ('p3', 'Sri Balaji Commercial Complex', 4, 3, 2, 2), ('p4', 'Meenakshi Kalyana Mandapam', 1, 2, 2, 1),
    ('p5', 'Anand Farmhouse', 5, 1, 2, 4), ('p6', 'Fathima Clinic Interiors', 6, 0, 2, 0),
    ('p7', 'Vel Murugan Textiles Showroom', 2, 2, 2, 2), ('p8', 'Raghavan Villa', 8, 2, 2, 1),
]
SKIES = [((112, 166, 222), (214, 232, 245)), ((236, 170, 112), (250, 226, 196)), ((150, 166, 182), (222, 228, 233)),
         ((96, 160, 222), (226, 238, 247)), ((226, 150, 112), (247, 218, 196))]


def font(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, int(size))


def lerp(a, b, k):
    return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))


def gradient(d, box, top, bottom):
    x0, y0, x1, y1 = box
    for y in range(int(y0), int(y1)):
        d.line([(x0, y), (x1, y)], fill=lerp(top, bottom, (y - y0) / max(1, y1 - y0)))


def worker(d, x, y, s, t, phase, hat, shirt, carry=False, woman=False):
    """Simple site worker figure standing on (x, y); s = height in px."""
    step = math.sin((t * 6 + phase) * math.pi * 2)
    leg = s * 0.12 * step
    skin = (124, 82, 56)
    lw = max(2, int(s * 0.07))
    if woman:  # saree
        d.polygon([(x - s * .12, y - s * .8), (x + s * .12, y - s * .8), (x + s * .18, y), (x - s * .18, y)], fill=shirt)
        d.line([(x - s * .12, y - s * .78), (x + s * .1, y - s * .45)], fill=lerp(shirt, (255, 220, 120), .5), width=max(2, int(s * .05)))
    else:
        d.line([(x, y - s * .45), (x - s * .1 + leg, y)], fill=(60, 64, 78), width=lw)
        d.line([(x, y - s * .45), (x + s * .1 - leg, y)], fill=(60, 64, 78), width=lw)
        d.rectangle([x - s * .12, y - s * .78, x + s * .12, y - s * .42], fill=shirt)
    arm = s * 0.1 * (-step if not carry else 0)
    if carry:
        d.line([(x - s * .1, y - s * .72), (x - s * .12, y - s * 1.02)], fill=skin, width=lw)
        d.line([(x + s * .1, y - s * .72), (x + s * .12, y - s * 1.02)], fill=skin, width=lw)
    else:
        d.line([(x - s * .11, y - s * .74), (x - s * .16 + arm, y - s * .46)], fill=skin, width=lw)
        d.line([(x + s * .11, y - s * .74), (x + s * .16 - arm, y - s * .46)], fill=skin, width=lw)
    r = s * .1
    d.ellipse([x - r, y - s * .98, x + r, y - s * .78], fill=skin)
    if carry:  # iron pan of cement on the head
        d.ellipse([x - s * .2, y - s * 1.08, x + s * .2, y - s * .96], fill=(96, 98, 102))
        d.ellipse([x - s * .15, y - s * 1.12, x + s * .15, y - s * 1.02], fill=(176, 172, 164))
    elif not woman:
        d.pieslice([x - r * 1.25, y - s * 1.03, x + r * 1.25, y - s * .83], 180, 360, fill=hat)
        d.line([(x - r * 1.5, y - s * .93), (x + r * 1.5, y - s * .93)], fill=hat, width=max(1, lw // 2))
    else:
        d.ellipse([x - r, y - s * 1.0, x + r, y - s * .86], fill=(30, 26, 24))


def palm(d, x, y, h, col):
    d.line([(x, y), (x + h * .08, y - h * .55), (x + h * .04, y - h)], fill=col, width=max(2, int(h * .045)))
    tx, ty = x + h * .04, y - h
    for a in range(0, 360, 40):
        ex, ey = tx + math.cos(math.radians(a)) * h * .32, ty + math.sin(math.radians(a)) * h * .16 + h * .06
        d.line([(tx, ty), ((tx + ex) / 2, ty - h * .05), (ex, ey)], fill=col, width=max(2, int(h * .03)))


def bricks(d, box, col=(176, 84, 60)):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=col)
    bh = max(4, (y1 - y0) / 9)
    row = 0
    y = y0
    while y < y1:
        d.line([(x0, y), (x1, y)], fill=(214, 186, 160), width=1)
        off = (bh * 1.2) if row % 2 else 0
        x = x0 + off
        while x < x1:
            d.line([(x, y), (x, min(y1, y + bh))], fill=(214, 186, 160), width=1)
            x += bh * 2.4
        y += bh
        row += 1


def exterior(W, H, st, floors, tone, t, var, seed):
    rng = random.Random(seed)
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img, 'RGBA')
    sky_t, sky_b = SKIES[tone % len(SKIES)]
    hz = H * .58
    gradient(d, (0, 0, W, hz + 2), sky_t, sky_b)
    for i in range(4):  # drifting clouds
        cx = (rng.random() * W * 1.3 + t * W * .05 * (1 + i % 2)) % (W * 1.3) - W * .15
        cy = H * (.08 + rng.random() * .22)
        for k in range(4):
            r = H * (.03 + rng.random() * .03)
            d.ellipse([cx + k * r * .9 - r, cy - r * .6, cx + k * r * .9 + r, cy + r * .6], fill=(255, 255, 255, 120))
    # tree line with coconut palms
    tree = lerp(sky_b, (52, 84, 52), .75)
    for i in range(int(W / 18)):
        x = i * 18 + rng.random() * 12
        r = H * (.025 + rng.random() * .03)
        d.ellipse([x - r, hz - r * 1.4, x + r, hz + r * .4], fill=tree)
    for i in range(9):
        palm(d, rng.random() * W, hz + 4, H * (.14 + rng.random() * .1), lerp(tree, (30, 52, 34), .4))
    # ground
    gradient(d, (0, hz, W, H), (186, 152, 108), (150, 116, 80))
    for _ in range(int(W * H / 900)):
        x, y = rng.random() * W, hz + rng.random() * (H - hz)
        c = rng.choice([(168, 134, 94, 160), (204, 176, 134, 140), (132, 102, 70, 120)])
        d.point((x, y), fill=c)
    # back boundary: tin sheet fence + company banner
    fy = hz + H * .02
    for i in range(int(W / 40) + 1):
        c = (58, 112, 150) if i % 2 else (52, 102, 140)
        d.rectangle([i * 40, fy - H * .055, i * 40 + 40, fy + H * .01], fill=c)
    bx0 = W * (.015 + .01 * var)
    d.rectangle([bx0, fy - H * .05, bx0 + W * .2, fy - H * .005], fill=(250, 250, 248))
    d.rectangle([bx0, fy - H * .05, bx0 + W * .012, fy - H * .005], fill=(212, 43, 42))
    d.text((bx0 + W * .02, fy - H * .044), 'SCALE SPACE BUILDERS', font=font(H * .02, True), fill=(30, 32, 36))
    d.text((bx0 + W * .02, fy - H * .022), 'Construction & Design · 78454 36496', font=font(H * .013), fill=(90, 94, 100))

    gy = hz + H * .2  # building ground line
    nf = max(1, floors)
    fh = H * (.13 if nf <= 2 else .105 if nf == 3 else .085)
    bw = min(W * .58, W * (.2 + .09 * nf))
    cx = W * (.5 + (var - 1) * .06)
    x0, x1 = cx - bw / 2, cx + bw / 2
    ncol = 4 + nf
    colx = [x0 + (x1 - x0) * i / (ncol - 1) for i in range(ncol)]
    grey, slab = (168, 168, 162), (150, 150, 146)

    if st == 0:  # cleared land, lime markings, material heaps
        for i in range(4):
            yy = gy - H * .02 + i * H * .03
            d.line([(x0 + i * 6, yy), (x1 - i * 6, yy)], fill=(245, 245, 240), width=2)
        for x in colx:
            d.line([(x, gy - H * .03), (x, gy + H * .06)], fill=(245, 245, 240), width=2)
            d.line([(x, gy - H * .05), (x, gy - H * .02)], fill=(120, 80, 40), width=3)
    elif st == 1:  # footing pits and rebar cages
        for x in colx:
            for row in range(2):
                yy = gy - H * .03 + row * H * .07
                d.polygon([(x - W * .025, yy), (x + W * .025, yy), (x + W * .03, yy + H * .035), (x - W * .03, yy + H * .035)], fill=(92, 66, 44))
                d.rectangle([x - W * .006, yy - H * .07, x + W * .006, yy + H * .02], outline=(70, 70, 74), width=2)
        d.polygon([(x1 + W * .03, gy + H * .05), (x1 + W * .12, gy + H * .05), (x1 + W * .08, gy - H * .02)], fill=(160, 120, 80))
    else:
        built = 0 if st == 2 else (max(1, nf - 1) if st == 3 else nf)
        # plinth beam
        d.rectangle([x0 - 6, gy - H * .045, x1 + 6, gy], fill=grey)
        d.rectangle([x0 - 6, gy - H * .045, x1 + 6, gy - H * .04], fill=(186, 186, 180))
        top = gy - H * .045
        for f in range(built):
            fb, ft = top - f * fh, top - (f + 1) * fh
            panels = list(zip(colx[:-1], colx[1:]))
            for pi, (a, b) in enumerate(panels):
                inner = (a + W * .006, ft + fh * .1, b - W * .006, fb)
                if st >= 4:
                    plastered = st >= 7 or (st == 6 and (pi + f) % 3 != 0)
                    if st >= 7:
                        d.rectangle(inner, fill=(239, 228, 206) if st >= 8 or pi % 4 else (232, 222, 200))
                    elif plastered:
                        d.rectangle(inner, fill=(204, 200, 192))
                    else:
                        bricks(d, inner)
                    if st >= 4 and pi % 2 == 1 and not (f == 0 and pi == len(panels) // 2):
                        wx0, wx1 = a + (b - a) * .25, b - (b - a) * .25
                        wy0, wy1 = ft + fh * .3, ft + fh * .72
                        if st >= 7:
                            d.rectangle([wx0, wy0, wx1, wy1], fill=(120, 150, 170), outline=(250, 250, 250), width=3)
                            d.line([((wx0 + wx1) / 2, wy0), ((wx0 + wx1) / 2, wy1)], fill=(250, 250, 250), width=2)
                        else:
                            d.rectangle([wx0, wy0, wx1, wy1], fill=(58, 52, 50))
                    if f == 0 and pi == len(panels) // 2:
                        dx0, dx1 = a + (b - a) * .3, b - (b - a) * .3
                        d.rectangle([dx0, ft + fh * .3, dx1, fb], fill=(150, 92, 52) if st >= 7 else (60, 54, 50))
            for x in colx:
                d.rectangle([x - W * .007, ft, x + W * .007, fb], fill=grey if st < 7 else (245, 242, 236))
            d.rectangle([x0 - 10, ft, x1 + 10, ft + fh * .1], fill=slab if st < 7 else (250, 248, 244))
            if st >= 7:
                d.rectangle([x0 - 10, ft + fh * .1, x1 + 10, ft + fh * .13], fill=(212, 43, 42) if f == built - 1 else (226, 220, 210))
        top_built = top - built * fh
        if st in (2, 3, 5) or (st == 3):
            # starter bars / props for the next floor
            for x in colx:
                d.line([(x, top_built), (x, top_built - H * .05)], fill=(70, 70, 74), width=2)
        if st in (3, 5):  # props and shuttering for the slab being cast
            ps = top_built - fh
            d.rectangle([x0 - 10, ps, x1 + 10, ps + fh * .08], fill=(196, 156, 98))
            for i in range(int(bw / 14)):
                xx = x0 + i * 14
                d.line([(xx, ps + fh * .08), (xx + 3, top_built)], fill=(120, 92, 56), width=2)
            for i in range(12):
                xx = x0 + (x1 - x0) * i / 11
                d.line([(xx, ps - 2), (xx + 10, ps - 6)], fill=(70, 70, 74), width=1)
        if st >= 8:  # parapet, compound wall, gate and plants
            d.rectangle([x0 - 10, top_built - fh * .25, x1 + 10, top_built], fill=(245, 242, 236))
            d.rectangle([0, gy + H * .07, W, gy + H * .1], fill=(226, 220, 208))
            d.rectangle([cx - W * .06, gy + H * .05, cx + W * .06, gy + H * .1], fill=(60, 60, 64))
            for i in range(7):
                px = rng.random() * W
                if abs(px - cx) > W * .08:
                    d.ellipse([px - H * .03, gy + H * .03, px + H * .03, gy + H * .085], fill=(66, 122, 70))
        if 4 <= st <= 6:  # scaffolding in front of the facade
            sc = (138, 116, 74, 220)
            sh = built * fh + H * .02
            for i in range(int(bw / (W * .05)) + 2):
                xx = x0 - 14 + i * W * .05
                d.line([(xx, gy), (xx, gy - sh)], fill=sc, width=2)
            for j in range(int(sh / (fh * .5)) + 1):
                yy = gy - j * fh * .5
                d.line([(x0 - 14, yy), (x1 + 14, yy)], fill=sc, width=2)
        if floors >= 3 and 3 <= st <= 6:  # tower crane with moving trolley
            tx = x1 + W * .07
            ttop = H * .1
            d.rectangle([tx - 5, ttop, tx + 5, gy], outline=(214, 162, 27), width=2)
            for yy in range(int(ttop), int(gy), 14):
                d.line([(tx - 5, yy), (tx + 5, yy + 14)], fill=(214, 162, 27), width=1)
            d.line([(tx - W * .3, ttop), (tx + W * .08, ttop)], fill=(214, 162, 27), width=6)
            d.line([(tx, ttop - H * .05), (tx - W * .28, ttop)], fill=(214, 162, 27), width=1)
            d.rectangle([tx + W * .05, ttop - 2, tx + W * .08, ttop + 16], fill=(90, 90, 96))
            trolley = tx - W * (.08 + .2 * (.5 + .5 * math.sin(t * math.pi * 2)))
            hook = ttop + H * (.15 + .1 * (.5 + .5 * math.cos(t * math.pi * 2)))
            d.line([(trolley, ttop), (trolley, hook)], fill=(60, 60, 64), width=1)
            d.rectangle([trolley - 12, hook, trolley + 12, hook + 9], fill=(110, 110, 116))

    # concrete mixer with rotating drum
    if 1 <= st <= 6:
        mx, my = W * (.1 + .05 * var), gy + H * .16
        d.rectangle([mx - W * .04, my - H * .02, mx + W * .05, my], fill=(70, 70, 76))
        for wx in (mx - W * .03, mx + W * .04):
            d.ellipse([wx - 9, my - 4, wx + 9, my + 14], fill=(30, 30, 32))
        d.ellipse([mx - W * .035, my - H * .11, mx + W * .035, my - H * .015], fill=(232, 182, 32))
        for k in range(3):
            a = t * 8 + k * 2.1
            ox = math.cos(a) * W * .025
            d.line([(mx + ox, my - H * .1), (mx + ox * .6, my - H * .025)], fill=(160, 120, 20), width=3)
    # material heaps in the foreground
    if st < 8:
        hx = W * (.78 - .05 * var)
        d.pieslice([hx - W * .09, H * .86, hx + W * .09, H * 1.05], 180, 360, fill=(198, 168, 120))
        d.pieslice([hx + W * .03, H * .9, hx + W * .16, H * 1.06], 180, 360, fill=(134, 132, 128))
        if st >= 3:
            for r in range(4):
                for c in range(6):
                    d.rectangle([W * .3 + c * 16 + (r % 2) * 8, H * .93 - r * 8, W * .3 + c * 16 + 14 + (r % 2) * 8, H * .93 - r * 8 + 7], fill=(176, 84, 60), outline=(150, 70, 50))
    # workers
    if st < 8:
        hats = [(244, 196, 30), (250, 250, 250), (240, 120, 40), (244, 196, 30)]
        shirts = [(56, 92, 150), (150, 60, 50), (70, 120, 80), (180, 150, 60), (90, 90, 120)]
        for i in range(7):
            ph = rng.random()
            base = W * (.15 + rng.random() * .7)
            amp = W * (.02 + rng.random() * .06)
            x = base + amp * math.sin((t * (.6 + rng.random() * .6) + ph) * math.pi * 2)
            y = gy + H * (.03 + rng.random() * .17)
            s = H * (.07 + (y - gy) / H * .25)
            woman = i in (2, 5)
            worker(d, x, y, s, t, ph, hats[i % 4], (170, 52, 92) if woman else shirts[i % 5], carry=woman, woman=woman)
        if st >= 3:  # crew working on the slab
            top_y = gy - H * .045 - (max(1, nf - 1) if st == 3 else nf) * fh
            for i in range(2):
                worker(d, x0 + bw * (.3 + .35 * i), top_y, H * .06, t * .3, i * .3, hats[i], shirts[i])
    return img


def interior(W, H, st, tone, t, var, seed, render=False):
    rng = random.Random(seed)
    img = Image.new('RGB', (W, H), (230, 226, 218))
    d = ImageDraw.Draw(img, 'RGBA')
    bx0, by0, bx1, by1 = W * (.24 + .03 * (var - 1)), H * .2, W * (.76 + .03 * (var - 1)), H * .64
    putty, paint = (238, 235, 228), (208, 230, 220)
    d.polygon([(0, 0), (W, 0), (bx1, by0), (bx0, by0)], fill=(246, 245, 241))  # ceiling
    d.polygon([(0, 0), (bx0, by0), (bx0, by1), (0, H)], fill=(226, 223, 215))  # left wall
    d.polygon([(W, 0), (bx1, by0), (bx1, by1), (W, H)], fill=(220, 217, 208))  # right wall
    d.rectangle([bx0, by0, bx1, by1], fill=putty)
    if render or st > 6:
        d.rectangle([bx0, by0, bx1, by1], fill=paint)
        d.polygon([(0, 0), (bx0, by0), (bx0, by1), (0, H)], fill=(196, 222, 210))
    elif st == 6:  # wall being painted, progress follows the roller
        k = .45 + .35 * t
        d.rectangle([bx0, by0, bx0 + (bx1 - bx0) * k, by1], fill=paint)
    # floor
    floor_col = (236, 232, 224) if st >= 5 or render else (172, 170, 166)
    d.polygon([(0, H), (bx0, by1), (bx1, by1), (W, H)], fill=floor_col)
    if st >= 5 or render:
        for i in range(9):
            k = i / 8
            d.line([(bx0 + (bx1 - bx0) * k, by1), (W * k, H)], fill=(206, 202, 194), width=1)
        for j in range(1, 7):
            k = (j / 6) ** 1.6
            y = by1 + (H - by1) * k
            d.line([(bx0 * (1 - k), y), (bx1 + (W - bx1) * k, y)], fill=(206, 202, 194), width=1)
    # false ceiling grid and downlights
    if st >= 2 or render:
        for i in range(1, 6):
            k = i / 6
            d.line([(W * k, 0), (bx0 + (bx1 - bx0) * k, by0)], fill=(220, 218, 212), width=2)
        for i in range(3):
            lx = bx0 + (bx1 - bx0) * (.2 + .3 * i)
            d.ellipse([lx - 14, by0 - 26, lx + 14, by0 - 16], fill=(255, 248, 220))
            d.polygon([(lx - 10, by0 - 18), (lx + 10, by0 - 18), (lx + 50, by1), (lx - 50, by1)], fill=(255, 250, 230, 26))
    # reception counter
    cy0 = by1 - H * .02
    if st >= 4 or render:
        d.rectangle([W * .32, cy0 - H * .16, W * .62, cy0 + H * .06], fill=(166, 124, 82))
        d.rectangle([W * .31, cy0 - H * .18, W * .63, cy0 - H * .155], fill=(250, 250, 248))
        for i in range(5):
            d.line([(W * .32 + i * W * .06, cy0 - H * .155), (W * .32 + i * W * .06, cy0 + H * .06)], fill=(146, 106, 70), width=2)
    if render:
        d.rectangle([bx0 + (bx1 - bx0) * .3, by0 + H * .06, bx1 - (bx1 - bx0) * .3, by0 + H * .16], fill=(250, 250, 248))
        d.text((bx0 + (bx1 - bx0) * .36, by0 + H * .085), 'FATHIMA CLINIC', font=font(H * .035, True), fill=(46, 120, 96))
        for px in (W * .12, W * .86):
            d.rectangle([px - 18, H * .78, px + 18, H * .86], fill=(120, 96, 70))
            d.ellipse([px - 44, H * .62, px + 44, H * .8], fill=(70, 130, 84))
        for i in range(3):
            sx = W * (.68 + .08 * i)
            d.rectangle([sx, H * .74, sx + W * .06, H * .79], fill=(46, 120, 96))
            d.rectangle([sx, H * .68, sx + W * .012, H * .79], fill=(46, 120, 96))
    else:
        # ladder + painter with moving roller
        lx = bx0 + (bx1 - bx0) * (.45 + .35 * t if st == 6 else .7)
        d.line([(lx - 30, H * .92), (lx - 10, H * .48)], fill=(160, 150, 130), width=5)
        d.line([(lx + 30, H * .92), (lx + 10, H * .48)], fill=(160, 150, 130), width=5)
        for i in range(6):
            yy = H * (.88 - i * .075)
            w = 30 - i * 3.6
            d.line([(lx - w, yy), (lx + w, yy)], fill=(160, 150, 130), width=4)
        worker(d, lx, H * .66, H * .26, t, 0, (250, 250, 250), (72, 104, 150))
        ry = by0 + (by1 - by0) * (.35 + .3 * math.sin(t * math.pi * 6))
        d.line([(lx + H * .03, H * .5), (lx + H * .07, ry)], fill=(90, 90, 96), width=3)
        d.rectangle([lx + H * .055, ry - 16, lx + H * .085, ry + 16], fill=paint if st >= 6 else (240, 240, 236), outline=(120, 120, 120))
        if st == 5:
            worker(d, W * .25, H * .9, H * .2, t * .5, .4, (244, 196, 30), (150, 60, 50))
        for i in range(4):  # paint tins and material
            d.rectangle([W * (.08 + i * .045), H * .88, W * (.08 + i * .045) + 26, H * .93], fill=(250, 250, 250), outline=(180, 180, 180))
    return img


def overlay(img, W, H, title, stage, t, stamp, video=True):
    d = ImageDraw.Draw(img, 'RGBA')
    if video:
        d.rectangle([0, H - H * .14, W, H], fill=(16, 18, 22, 170))
        d.rectangle([0, H - H * .14, W * .006, H], fill=(212, 43, 42))
        d.text((W * .03, H - H * .118), f'{title}', font=font(H * .036, True), fill=(255, 255, 255))
        d.text((W * .03, H - H * .065), f'{stage} · progress walkthrough · Scale Space Builders', font=font(H * .026), fill=(214, 218, 224))
        if int(t * 12) % 2 == 0:
            d.ellipse([W * .03, H * .045, W * .03 + H * .03, H * .075], fill=(230, 50, 50))
        d.text((W * .03 + H * .045, H * .043), 'REC', font=font(H * .03, True), fill=(255, 255, 255))
    d.text((W - W * (.2 if video else .3), H * .043 if video else H - H * .06), stamp, font=font(H * (.026 if video else .028)), fill=(255, 255, 255, 230))
    return img


def ken_burns(scene, W, H, k, var):
    """Crop a slowly moving window from an oversized scene (k = 0..1)."""
    sw, sh = scene.size
    z = 1.0 + .08 * k
    cw, ch = sw / 1.12 / z * 1.0, sh / 1.12 / z
    cx = (sw - cw) * (.2 + .6 * (k if var % 2 else 1 - k))
    cy = (sh - ch) * .5
    return scene.crop((int(cx), int(cy), int(cx + cw), int(cy + ch))).resize((W, H), Image.LANCZOS)


def scene(p, stage, t, var, seed, W, H, render=False):
    pid, name, cur, floors, nphoto, tone = p
    if floors == 0:
        return interior(W, H, stage, tone, t, var, seed, render)
    return exterior(W, H, stage, floors, tone, t, var, seed)


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]  # optional list of project ids
    for idx, p in enumerate(PROJECTS):
        pid, name, cur, floors, nphoto, tone = p
        if only and pid not in only:
            continue
        stages = INT if floors == 0 else STD
        # photos: alternate current and previous stage, as in the sample data
        for i in range(nphoto):
            st = max(0, cur - (i % 2))
            img = scene(p, st, .13 * (i + 1), i % 3, idx * 31 + i, 2400, 1600)
            img = img.resize((1200, 800), Image.LANCZOS)
            overlay(img, 1200, 800, name, stages[st], 0, f'{stages[st]} · {8 + (idx + i) % 9}:{(idx * 17 + i * 23) % 60:02d}', video=False)
            img.save(os.path.join(OUT, f'{pid}-photo-{i + 1}.jpg'), quality=82, optimize=True)
        if pid == 'p6':
            img = interior(2400, 1600, 7, 0, .5, 1, 99, render=True).resize((1200, 800), Image.LANCZOS)
            img.save(os.path.join(OUT, 'p6-3d-reception.jpg'), quality=85, optimize=True)
        # walkthrough video
        W, H, fps, secs = 960, 540, 24, 7
        n = fps * secs
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
               '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-deadline', 'good', '-cpu-used', '4', '-pix_fmt', 'yuv420p', '-an', os.path.join(OUT, f'{pid}-video.webm'),
               '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', os.path.join(OUT, f'{pid}-video.mp4')]
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for f in range(n):
            t = f / n
            sc = scene(p, cur, t, 1, idx * 31 + 7, int(W * 1.6), int(H * 1.6))
            fr = ken_burns(sc, W, H, t, idx)
            sec = 32 + f // fps
            overlay(fr, W, H, name, stages[cur], t, f'SITE CAM  10:41:{sec:02d}')
            if f == int(n * .35):
                fr.save(os.path.join(OUT, f'{pid}-video-poster.jpg'), quality=80, optimize=True)
            ff.stdin.write(fr.tobytes())
        ff.stdin.close()
        if ff.wait() != 0:
            sys.exit(f'ffmpeg failed for {pid}')
        print('done', pid)


if __name__ == '__main__':
    main()
