#!/usr/bin/env python3
"""Convert SVG to ICO icon format"""

from PIL import Image
import io
import cairosvg

# Convert SVG to PNG with high quality
svg_file = r'C:\Users\NGL18\dog_icon.svg'
png_data = io.BytesIO()

# Render SVG at multiple sizes for the ICO file
cairosvg.svg2png(url=svg_file, write_to=png_data, output_width=256, output_height=256)
png_data.seek(0)

# Open the PNG and convert to ICO
img = Image.open(png_data).convert('RGBA')

# Create different sizes for the icon
sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
icon_images = []

for size in sizes:
    icon_images.append(img.resize(size, Image.Resampling.LANCZOS))

# Save as ICO file with multiple sizes
icon_images[0].save(
    r'C:\Users\NGL18\icon.ico',
    format='ICO',
    sizes=[size for size in sizes]
)

print("✓ Icon converted successfully!")
print(f"✓ Saved to: C:\\Users\\NGL18\\icon.ico")
