import os
from fastapi import FastAPI
from fastapi.responses import FileResponse

from handsynth.demo import Hand

app = FastAPI()

IMG_DIR = "img"

if not os.path.exists(IMG_DIR):
    os.makedirs(IMG_DIR)


def image():
    print("Generating image...")
    lines = [
        "Now this is a story all about how",
        "My life got flipped turned upside down",
        "And I'd like to take a minute, just sit right there",
        "I'll tell you how I became the prince of a town called Bel-Air",
    ]
    biases = [.75 for _ in lines]
    styles = [9 for _ in lines]
    stroke_colors = ['red', 'green', 'black', 'blue']
    stroke_widths = [1, 2, 1, 2]

    hand = Hand()
    filename = 'img/usage_demo.svg'
    hand.write(
        filename=filename,
        lines=lines,
        biases=biases,
        styles=styles,
        stroke_colors=stroke_colors,
        stroke_widths=stroke_widths
    )
    return filename


@app.get("/generate-handwriting")
def generate_handwriting():
    filename = image()
    return FileResponse(filename, media_type='image/svg+xml', headers={"Content-Disposition": f"attachment; filename={os.path.basename(filename)}"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

