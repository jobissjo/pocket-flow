import os
from PIL import Image

def remove_background(image_path, output_path, threshold=45):
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    
    # Get corner pixels sample
    corners = [
        img.getpixel((0, 0)),
        img.getpixel((width - 1, 0)),
        img.getpixel((0, height - 1)),
        img.getpixel((width - 1, height - 1))
    ]
    bg_r = sum(c[0] for c in corners) // 4
    bg_g = sum(c[1] for c in corners) // 4
    bg_b = sum(c[2] for c in corners) // 4

    pixels = img.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            diff = ((r - bg_r) ** 2 + (g - bg_g) ** 2 + (b - bg_b) ** 2) ** 0.5
            if diff < threshold or (r < 35 and g < 35 and b < 35):
                pixels[x, y] = (0, 0, 0, 0)

    img.save(output_path, "PNG")
    print(f"Successfully processed: {output_path}")

if __name__ == "__main__":
    for filename in ["android-icon-monochrome.png", "android-icon-foreground.png"]:
        path = os.path.join("assets", "images", filename)
        if os.path.exists(path):
            remove_background(path, path)
