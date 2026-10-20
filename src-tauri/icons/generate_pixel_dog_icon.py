# -*- coding: utf-8 -*-
"""Generate a pixel art dog head icon"""

from PIL import Image, ImageDraw
import sys

if sys.stdout.encoding == 'gbk':
    sys.stdout.reconfigure(encoding='utf-8')

def create_pixel_dog_icon(size):
    """Create a detailed pixel art dog head"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pixels = img.load()

    # Scale factor for different sizes
    scale = size / 256

    # Color palette
    colors = {
        'dark_brown': (101, 67, 33),
        'brown': (160, 100, 50),
        'light_brown': (200, 140, 80),
        'tan': (220, 180, 130),
        'dark_tan': (180, 140, 100),
        'black': (30, 30, 30),
        'white': (255, 255, 255),
        'pink': (255, 150, 150),
        'dark_pink': (200, 100, 100),
    }

    # Pixel data for 256x256 dog head (will be scaled)
    def set_pixel(x, y, color):
        """Set pixel with scaling"""
        sx = int(x * scale)
        sy = int(y * scale)
        scale_size = max(1, int(scale))
        for dx in range(scale_size):
            for dy in range(scale_size):
                if sx + dx < size and sy + dy < size:
                    pixels[sx + dx, sy + dy] = color + (255,)

    # Draw pixel art dog head
    # Head outline and fill
    for y in range(60, 180):
        for x in range(70, 186):
            # Head shape - rounded square with dents for ears
            dist_from_center_x = abs(x - 128)
            dist_from_center_y = abs(y - 120)

            # Main head area
            if dist_from_center_x < 58 and dist_from_center_y < 60:
                if y < 80:  # Upper part - narrower
                    if dist_from_center_x < 45:
                        set_pixel(x, y, colors['brown'])
                else:
                    set_pixel(x, y, colors['brown'])

    # Ears - left and right
    for y in range(50, 95):
        for x in range(85, 105):
            if x < 98:  # Left ear
                if y < 65 or (y >= 65 and x < 92):
                    set_pixel(x, y, colors['brown'])
        for x in range(151, 171):
            if x > 158:  # Right ear
                if y < 65 or (y >= 65 and x > 164):
                    set_pixel(x, y, colors['brown'])

    # Inner ears - lighter
    for y in range(55, 85):
        for x in range(88, 100):
            if x < 95:
                if y < 70 or (y >= 70 and x < 92):
                    set_pixel(x, y, colors['light_brown'])

    for y in range(55, 85):
        for x in range(156, 168):
            if x > 161:
                if y < 70 or (y >= 70 and x > 164):
                    set_pixel(x, y, colors['light_brown'])

    # Snout - lighter area
    for y in range(130, 160):
        for x in range(105, 151):
            dist_from_center = abs(x - 128)
            if dist_from_center < 23:
                set_pixel(x, y, colors['tan'])

    # Nose - dark area
    for y in range(133, 143):
        for x in range(118, 138):
            if abs(x - 128) < 10 and abs(y - 138) < 5:
                set_pixel(x, y, colors['black'])

    # Nostril highlights
    set_pixel(120, 137, colors['dark_brown'])
    set_pixel(136, 137, colors['dark_brown'])

    # Mouth line
    for x in range(115, 141):
        set_pixel(x, 145, colors['black'])

    # Mouth curve details
    for x in range(118, 128):
        set_pixel(x, 146, colors['dark_pink'])
    for x in range(128, 138):
        set_pixel(x, 146, colors['dark_pink'])

    # Tongue
    for y in range(147, 155):
        for x in range(120, 136):
            if abs(y - 150) < 4 and abs(x - 128) < 8:
                set_pixel(x, y, colors['pink'])

    # Left eye
    for y in range(95, 113):
        for x in range(100, 114):
            if abs(x - 107) < 7 and abs(y - 104) < 9:
                if abs(x - 107) < 5 or abs(y - 104) < 6:
                    set_pixel(x, y, colors['black'])

    # Left eye highlight
    for y in range(97, 100):
        for x in range(110, 113):
            set_pixel(x, y, colors['white'])

    # Right eye
    for y in range(95, 113):
        for x in range(142, 156):
            if abs(x - 149) < 7 and abs(y - 104) < 9:
                if abs(x - 149) < 5 or abs(y - 104) < 6:
                    set_pixel(x, y, colors['black'])

    # Right eye highlight
    for y in range(97, 100):
        for x in range(152, 155):
            set_pixel(x, y, colors['white'])

    # Eyebrows - dark brown lines
    for x in range(100, 115):
        set_pixel(x, 92, colors['dark_brown'])
    for x in range(141, 156):
        set_pixel(x, 92, colors['dark_brown'])

    # Head outline/shading
    # Left side shading
    for y in range(70, 160):
        set_pixel(68, y, colors['dark_brown'])
    # Right side shading
    for y in range(70, 160):
        set_pixel(187, y, colors['dark_brown'])

    # Face spotting details
    for x in range(80, 90):
        for y in range(115, 125):
            if (x + y) % 3 == 0:
                set_pixel(x, y, colors['dark_brown'])

    for x in range(166, 176):
        for y in range(115, 125):
            if (x + y) % 3 == 0:
                set_pixel(x, y, colors['dark_brown'])

    return img

# Generate icons at different sizes
output_dir = r'F:\workspace\AI\rocketmqMg\src-tauri\icons'

sizes = [256, 128, 64, 48, 32, 16]
images = []

print("Generating pixel art dog head icons...")
for size in sizes:
    img = create_pixel_dog_icon(size)
    images.append(img)
    print(f"  Generated {size}x{size}")

# Save as ICO
images[0].save(
    output_dir + r'\icon.ico',
    format='ICO',
    sizes=[(s, s) for s in sizes]
)

# Also save as PNG for preview
images[0].save(output_dir + r'\icon_preview.png')

print(f"\nSuccess!")
print(f"Saved to: {output_dir}\\icon.ico")
print(f"Preview: {output_dir}\\icon_preview.png")
print(f"Sizes included: {', '.join(str(s) + 'x' + str(s) for s in sizes)}")
