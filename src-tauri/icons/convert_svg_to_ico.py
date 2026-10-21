# -*- coding: utf-8 -*-
"""Convert RocketMQ SVG to ICO icon"""

from PIL import Image, ImageDraw
import sys
import xml.etree.ElementTree as ET

if sys.stdout.encoding == 'gbk':
    sys.stdout.reconfigure(encoding='utf-8')

def parse_svg_path(svg_path):
    """Parse SVG file and extract path data"""
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Find all path elements
    paths = []
    for path in root.findall('.//{http://www.w3.org/2000/svg}path'):
        d = path.get('d')
        fill = path.get('fill', '#000000')
        paths.append({'d': d, 'fill': fill})

    return paths

def create_rocketmq_icon(size):
    """Create RocketMQ icon from SVG paths"""
    # Create transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Scale factor from viewBox 1024x1024 to target size
    scale = size / 1024.0

    # Colors from SVG
    dark_color = '#191919'
    blue_color = '#005DE5'

    # Draw outer frame path (simplified)
    # Frame corners and edges
    frame_coords = [
        (int(119 * scale), int(64 * scale)),
        (int(904 * scale), int(64 * scale)),
        (int(904 * scale), int(960 * scale)),
        (int(119 * scale), int(960 * scale))
    ]

    # Draw frame outline
    frame_width = max(1, int(8 * scale))
    draw.rectangle([
        int(64 * scale), int(64 * scale),
        int(960 * scale), int(960 * scale)
    ], outline=dark_color, width=frame_width)

    # Draw bottom rectangles
    # Left rectangle
    draw.rectangle([
        int(381 * scale), int(960 * scale),
        int(468 * scale), int(1024 * scale)
    ], fill=dark_color)

    # Right rectangle
    draw.rectangle([
        int(555 * scale), int(960 * scale),
        int(642 * scale), int(1024 * scale)
    ], fill=dark_color)

    # Draw rocket shape (simplified blue rocket)
    # Main rocket body - trapezoid shape
    rocket_points = [
        (int(310 * scale), int(352 * scale)),
        (int(440 * scale), int(352 * scale)),
        (int(520 * scale), int(600 * scale)),
        (int(360 * scale), int(712 * scale)),
        (int(195 * scale), int(508 * scale))
    ]
    draw.polygon(rocket_points, fill=blue_color)

    # Rocket window/circle
    circle_center = (int(672 * scale), int(402 * scale))
    circle_radius = int(50 * scale)
    draw.ellipse([
        circle_center[0] - circle_radius,
        circle_center[1] - circle_radius,
        circle_center[0] + circle_radius,
        circle_center[1] + circle_radius
    ], fill=blue_color)

    # Rocket flame trail
    flame_points = [
        (int(440 * scale), int(352 * scale)),
        (int(705 * scale), int(192 * scale)),
        (int(750 * scale), int(280 * scale)),
        (int(520 * scale), int(450 * scale))
    ]
    draw.polygon(flame_points, fill=blue_color)

    # Extended rocket body
    body_points = [
        (int(360 * scale), int(712 * scale)),
        (int(472 * scale), int(802 * scale)),
        (int(472 * scale), int(713 * scale)),
        (int(520 * scale), int(600 * scale))
    ]
    draw.polygon(body_points, fill=blue_color)

    return img

# Generate icons at different sizes
import os
output_dir = os.path.dirname(os.path.abspath(__file__))

sizes = [256, 128, 64, 48, 32, 16]
images = []

print("Converting RocketMQ SVG to ICO...")
for size in sizes:
    img = create_rocketmq_icon(size)
    images.append(img)
    print(f"  Generated {size}x{size}")

# Save as ICO
icon_path = os.path.join(output_dir, 'icon.ico')
images[0].save(
    icon_path,
    format='ICO',
    sizes=[(s, s) for s in sizes]
)

# Also save as PNG for preview
preview_path = os.path.join(output_dir, 'icon_preview.png')
images[0].save(preview_path)

print(f"\nSuccess!")
print(f"Saved to: {icon_path}")
print(f"Preview: {preview_path}")
print(f"Icon converted from RocketMQ.svg")
