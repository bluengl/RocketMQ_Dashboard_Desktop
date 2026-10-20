#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert SVG to ICO using Pillow"""

from PIL import Image, ImageDraw
import sys

if sys.stdout.encoding == 'gbk':
    sys.stdout.reconfigure(encoding='utf-8')

def draw_dog(draw, size):
    """Draw a cute dog on the image"""
    scale = size / 200
    offset = (size - 200 * scale) / 2

    # Head
    head_radius = 45 * scale
    draw.ellipse([100*scale + offset - head_radius, 80*scale + offset - head_radius,
                  100*scale + offset + head_radius, 80*scale + offset + head_radius],
                 fill='#D4A574')

    # Ears
    for ear_x in [70, 130]:
        ear_cx = ear_x * scale + offset
        ear_cy = 40 * scale + offset
        ear_rx = 18 * scale
        ear_ry = 35 * scale
        draw.ellipse([ear_cx - ear_rx, ear_cy - ear_ry,
                      ear_cx + ear_rx, ear_cy + ear_ry], fill='#C4956B')

    # Snout
    snout_x = 100 * scale + offset
    snout_y = 95 * scale + offset
    draw.ellipse([snout_x - 28*scale, snout_y - 24*scale,
                  snout_x + 28*scale, snout_y + 24*scale],
                 fill='#E8D4B8')

    # Nose
    nose_x = 100 * scale + offset
    nose_y = 88 * scale + offset
    draw.ellipse([nose_x - 12*scale, nose_y - 10*scale,
                  nose_x + 12*scale, nose_y + 10*scale],
                 fill='#3D3D3D')

    # Eyes
    for eye_x in [85, 115]:
        eye_cx = eye_x * scale + offset
        eye_cy = 70 * scale + offset
        draw.ellipse([eye_cx - 6*scale, eye_cy - 6*scale,
                      eye_cx + 6*scale, eye_cy + 6*scale],
                     fill='#000000')
        draw.ellipse([eye_cx - 2*scale, eye_cy - 8*scale,
                      eye_cx + 2*scale, eye_cy - 4*scale],
                     fill='#FFFFFF')

    # Body
    body_x = 100 * scale + offset
    body_y = 140 * scale + offset
    draw.ellipse([body_x - 38*scale, body_y - 45*scale,
                  body_x + 38*scale, body_y + 45*scale],
                 fill='#D4A574')

    # Paws
    for paw_x in [75, 111]:
        paw_x_pos = paw_x * scale + offset
        paw_y_pos = 170 * scale + offset
        draw.rectangle([paw_x_pos, paw_y_pos,
                        paw_x_pos + 14*scale, paw_y_pos + 28*scale],
                       fill='#C4956B')

    # Tongue
    tongue_x = 100 * scale + offset
    tongue_y = 108 * scale + offset
    draw.ellipse([tongue_x - 8*scale, tongue_y - 6*scale,
                  tongue_x + 8*scale, tongue_y + 6*scale],
                 fill='#FF9999')

# Create icon at 256x256 and convert to other sizes
img_256 = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
draw = ImageDraw.Draw(img_256)
draw_dog(draw, 256)

# Create other size variants
sizes_list = [256, 128, 64, 48, 32, 16]
all_images = [img_256]

for size in sizes_list[1:]:
    img_resized = img_256.resize((size, size), Image.Resampling.LANCZOS)
    all_images.append(img_resized)

# Save as ICO with multiple sizes
all_images[0].save(
    r'C:\Users\NGL18\icon.ico',
    format='ICO',
    sizes=[(s, s) for s in sizes_list]
)

print("Dog icon created successfully!")
print("Saved to: C:\\Users\\NGL18\\icon.ico")
print("Icon includes multiple sizes: 256x256, 128x128, 64x64, 48x48, 32x32, 16x16")
