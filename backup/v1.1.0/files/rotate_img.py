from PIL import Image
import os

def rotate_image(path, angle):
    try:
        img = Image.open(path)
        # 順時針旋轉是用負值或用特定的方法
        rotated = img.rotate(-angle, expand=True)
        rotated.save(path)
        print(f"SUCCESS: Rotated {path}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    rotate_image("img/mazda_cx5_wufeng_real.jpg", 90)
