import os
import shutil
from PIL import Image, ImageDraw, ImageFilter

def make_icons():
    src_logo = "image.png"
    if not os.path.exists(src_logo):
        print("image.png not found!")
        return

    # 1. Update public/logo.png directly
    shutil.copy2(src_logo, "public/logo.png")
    shutil.copy2(src_logo, "dist-desktop/app-logo.png")
    print("Copied image.png to public/logo.png and dist-desktop/app-logo.png")

    img = Image.open(src_logo).convert("RGBA")
    
    # 2. Build 1024x1024 Master Icon
    size = 1024
    master = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(master)
    
    # Draw rounded squircle background (Deep obsidian cadastral blue #0b132b)
    pad = 32
    rad = 180
    bg_color = (11, 19, 43, 255) # Sleek deep navy
    border_color = (56, 189, 248, 220) # Bright cyan accent border
    border_width = 12
    
    draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=rad, fill=bg_color, outline=border_color, width=border_width)
    
    # Add subtle white/glow plate in center for logo contrast
    inner_pad = 72
    inner_rad = 140
    inner_color = (255, 255, 255, 250)
    draw.rounded_rectangle([inner_pad, inner_pad + 120, size - inner_pad, size - inner_pad - 120], radius=inner_rad, fill=inner_color)
    
    # Scale logo into center
    target_w = size - inner_pad * 2 - 80 # ~760px wide
    aspect = img.height / img.width
    target_h = int(target_w * aspect)
    
    resized_logo = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    pos_x = (size - target_w) // 2
    pos_y = (size - target_h) // 2
    
    master.paste(resized_logo, (pos_x, pos_y), resized_logo)
    
    # Save master icon
    os.makedirs("src-tauri/icons", exist_ok=True)
    master.save("src-tauri/icons/icon-master.png", "PNG")
    master.resize((512, 512), Image.Resampling.LANCZOS).save("src-tauri/icons/icon.png", "PNG")
    master.resize((512, 512), Image.Resampling.LANCZOS).save("public/favicon.png", "PNG")
    
    # Generate Windows ICO with standard multi-resolution mipmaps
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.save("src-tauri/icons/icon.ico", format="ICO", sizes=ico_sizes)
    master.save("public/favicon.ico", format="ICO", sizes=ico_sizes)
    
    # Generate all specific sizes
    standard_sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }
    
    for filename, dim in standard_sizes.items():
        resized = master.resize((dim, dim), Image.Resampling.LANCZOS)
        resized.save(os.path.join("src-tauri/icons", filename), "PNG")
        
    print("Successfully generated all icons from image.png!")

if __name__ == "__main__":
    make_icons()
