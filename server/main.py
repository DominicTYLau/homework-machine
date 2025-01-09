import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from snowflake import SnowflakeGenerator
from file import chatgpt
from scanner.scan import DocScanner


from handsynth.demo import Hand

OUTPUT_DIR = "handsynth_output"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URLs here
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

hand = Hand(max_line_length=100)

snow_gen = SnowflakeGenerator(0)


class SynthesisInput(BaseModel):
    text: str


def gen_svg_image(lines: List[str], *, bias: float = 0.5, style: int = 0, stroke_color: str = "black", stroke_width: float = 1):
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created ${OUTPUT_DIR} directory.")

    print("Generating SVG image of handwriting...")

    lines_n = len(lines)
    output_file_path = os.path.join(OUTPUT_DIR, f"output_{next(snow_gen)}.svg")

    hand.write(
        filename=output_file_path,
        lines=lines,
        biases=[bias for _ in range(lines_n)],
        styles=[style for _ in range(lines_n)],
        stroke_colors=[stroke_color for _ in range(lines_n)],
        stroke_widths=[stroke_width for _ in range(lines_n)],
    )

    return output_file_path

@app.get("/")
def index():
    return {"yay": "Things are looking up!"}


@app.post("/synthesize")
def synthesize(inp: SynthesisInput):
    with open(gen_svg_image([inp.text], bias=1), "r", encoding="utf-8") as f:
        svg_content = f.read()
    return {"svg": svg_content}

@app.post("/submit-frame")
async def submit_frame(image: UploadFile):
    # Grayscale and make the image look better using scanner import
    DocScanner(output_dir="scanner_output").scan(UploadFile, output_basename="processed_image.jpg")

    # Call ChatGPT to get the answers
    answers = chatgpt.query_gpt()

    # Synthesize the answers
    svg_content = gen_svg_image(answers, bias=1)

    return {svg_content}



if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

