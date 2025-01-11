import os
import shutil
from typing import List

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from snowflake import SnowflakeGenerator
from file import chatgpt
from scanner.scan import DocScanner


import preprocessing
# from handsynth.demo import Hand

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
    # Below parameters are for testing only
    bias: float = 1
    style: int = 0
    line_width: int = 70


class Test(BaseModel):
    bias: float = Form(1)
    style: int = Form(0)
    line_width: int = Form(70)


def gen_svg_image(lines: List[str], *, bias: float, style: int, stroke_color: str = "black", stroke_width: float = 1):
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created ${OUTPUT_DIR} directory.")

    lines_n = len(lines)
    output_file_path = os.path.join(OUTPUT_DIR, f"output_{next(snow_gen)}.svg")

    print(lines_n, " lines received:\n\n", "\n".join(lines), sep="", end="\n\n")

    hand.write(
        filename=output_file_path,
        lines=lines,
        biases=[bias for _ in range(lines_n)],
        styles=[style for _ in range(lines_n)],
        stroke_colors=[stroke_color for _ in range(lines_n)],
        stroke_widths=[stroke_width for _ in range(lines_n)],
    )

    print("Generated SVG image of handwriting in", output_file_path)

    return output_file_path


def _synthesize(text: str, bias: float, style: int, line_width: int):
    normalized = preprocessing.normalize(text)
    placeholded = preprocessing.placehold(normalized)
    lines = preprocessing.split(placeholded, line_width)

    with open(gen_svg_image(lines, bias=bias, style=style), "r", encoding="utf-8") as f:
        svg_content = f.read()

    return {"svg": svg_content}


@app.get("/")
def index():
    return {"yay": "Things are looking up!"}


@app.post("/synthesize")
def synthesize(inp: SynthesisInput):
    # return _synthesize(**dict(inp))
    print("good")
    return {"yay": "Things are looking up!"}


@app.post("/submit-frame")
async def submit_frame(image: UploadFile = File(...), line_width: int = Form(70)):
    # Save image to scanner_output
    with open("scanner_output/paper_image.jpg", "wb") as file:
        shutil.copyfileobj(image.file, file)

    # Grayscale and make the image look better using scanner import
    DocScanner(output_dir="scanner_output").scan("scanner_output/paper_image.jpg", output_basename="processed_image.jpg")

    # Call ChatGPT to get the answers
    # answers = chatgpt.query_gpt()
    answers = """1. According to Gay-Lussac's Law, the pressure of a gas increases with temperature if the volume is constant. In a hot car, the pressure inside the can increases, potentially causing it to burst."""

    # Synthesize and return handwriting
    return _synthesize(answers, 1, 0, line_width)

@app.post("/solve")
async def solve(image: UploadFile = File(...), line_width: int = Form(70)):
    # Save image to scanner_output
    with open("scanner_output/paper_image.jpg", "wb") as file:
        shutil.copyfileobj(image.file, file)

    # Grayscale and make the image look better using scanner import
    DocScanner(output_dir="scanner_output").scan("scanner_output/paper_image.jpg", output_basename="processed_image.jpg")

    # Call ChatGPT to get the answers
    # answers = chatgpt.query_gpt()
    answers = """1. According to Gay-Lussac's Law, the pressure of a gas increases with temperature if the volume is constant. In a hot car, the pressure inside the can increases, potentially causing it to burst."""

    # Synthesize and return handwriting
    return JSONResponse(content={"result": answers})

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

